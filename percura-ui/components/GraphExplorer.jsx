'use client';

import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import API_BASE_URL from '../lib/apiConfig';

const COLOR_PALETTE = [
    '#FF6B35', // Idea — orange
    '#1A936F', // Segment — green
    '#3498db', // Persona — blue
    '#C5283D', // Competitor — red
    '#E9724C', // Risk — coral
    '#f39c12', // Trend — amber
    '#7B2D8E', // Verdict — purple
    '#004E89', // ZepEntity — navy
    '#9b59b6', // fallback 1
    '#27ae60', // fallback 2
];

const TYPE_ORDER = ['Idea', 'Segment', 'Persona', 'Competitor', 'Risk', 'Trend', 'Verdict', 'ZepEntity'];

function getColor(type) {
    const idx = TYPE_ORDER.indexOf(type);
    return idx >= 0 ? COLOR_PALETTE[idx] : COLOR_PALETTE[8];
}

export default function GraphExplorer({ graphId, idea, segments, marketContext, onClose }) {
    const [graphData, setGraphData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [showEdgeLabels, setShowEdgeLabels] = useState(true);
    const [nodeCount, setNodeCount] = useState(0);
    const [edgeCount, setEdgeCount] = useState(0);
    const [source, setSource] = useState('local');

    const svgRef = useRef(null);
    const containerRef = useRef(null);
    const simulationRef = useRef(null);

    // ── Data Fetching ──
    useEffect(() => {
        setLoading(true);
        setError(null);

        fetch(`${API_BASE_URL}/api/graph/data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                graphId: graphId || null,
                idea: idea || null,
                segments: segments || [],
                marketContext: marketContext || null,
            }),
        })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    setGraphData(data);
                    setNodeCount(data.node_count);
                    setEdgeCount(data.edge_count);
                    setSource(data.source || 'local');
                } else {
                    setError(data.error || 'Failed to load graph');
                }
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [graphId]);

    // ── D3 Rendering ──
    useEffect(() => {
        if (!graphData || !svgRef.current || !containerRef.current) return;
        if (simulationRef.current) simulationRef.current.stop();

        const { nodes: rawNodes, edges: rawEdges } = graphData;
        const container = containerRef.current;
        const width = container.clientWidth;
        const height = container.clientHeight;

        const svg = d3.select(svgRef.current)
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', `0 0 ${width} ${height}`);
        svg.selectAll('*').remove();

        // Build node objects
        const nodeIds = new Set(rawNodes.map(n => n.uuid));
        const nodes = rawNodes.map(n => ({
            id: n.uuid,
            name: n.name || 'Unknown',
            type: (n.labels || []).find(l => !['Entity', 'Node'].includes(l)) || 'Entity',
            rawData: n,
        }));

        // Build edge objects — filter invalid, handle multi-edges & self-loops
        const edgePairCount = {};
        const selfLoopMap = {};

        const validRawEdges = rawEdges.filter(e =>
            nodeIds.has(e.source_node_uuid) && nodeIds.has(e.target_node_uuid)
        );

        validRawEdges.forEach(e => {
            if (e.source_node_uuid === e.target_node_uuid) {
                if (!selfLoopMap[e.source_node_uuid]) selfLoopMap[e.source_node_uuid] = [];
                selfLoopMap[e.source_node_uuid].push(e);
            } else {
                const key = [e.source_node_uuid, e.target_node_uuid].sort().join('__');
                edgePairCount[key] = (edgePairCount[key] || 0) + 1;
            }
        });

        const edgePairIndex = {};
        const processedSelfLoops = new Set();
        const edges = [];

        validRawEdges.forEach(e => {
            if (e.source_node_uuid === e.target_node_uuid) {
                if (processedSelfLoops.has(e.source_node_uuid)) return;
                processedSelfLoops.add(e.source_node_uuid);
                const loops = selfLoopMap[e.source_node_uuid];
                edges.push({
                    source: e.source_node_uuid,
                    target: e.target_node_uuid,
                    name: `Self (${loops.length})`,
                    curvature: 0,
                    isSelfLoop: true,
                    rawData: { isSelfLoopGroup: true, selfLoopEdges: loops, source_name: e.source_node_name },
                });
                return;
            }

            const key = [e.source_node_uuid, e.target_node_uuid].sort().join('__');
            const total = edgePairCount[key];
            const idx = edgePairIndex[key] || 0;
            edgePairIndex[key] = idx + 1;
            const isReversed = e.source_node_uuid > e.target_node_uuid;
            let curvature = 0;
            if (total > 1) {
                const range = Math.min(1.2, 0.6 + total * 0.15);
                curvature = ((idx / (total - 1)) - 0.5) * range * 2;
                if (isReversed) curvature = -curvature;
            }
            edges.push({
                source: e.source_node_uuid,
                target: e.target_node_uuid,
                name: e.name || e.fact_type || 'RELATED',
                curvature,
                isSelfLoop: false,
                pairTotal: total,
                rawData: e,
            });
        });

        // Zoom
        const g = svg.append('g');
        svg.call(
            d3.zoom()
                .scaleExtent([0.1, 4])
                .on('zoom', event => g.attr('transform', event.transform))
        );

        // Arrow marker
        svg.append('defs').append('marker')
            .attr('id', 'arrow')
            .attr('viewBox', '0 0 10 10')
            .attr('refX', 18).attr('refY', 5)
            .attr('markerWidth', 6).attr('markerHeight', 6)
            .attr('orient', 'auto-start-reverse')
            .append('path')
            .attr('d', 'M2 1L8 5L2 9')
            .attr('fill', 'none')
            .attr('stroke', '#888')
            .attr('stroke-width', 1.5);

        // Path helpers
        const getLinkPath = d => {
            const sx = d.source.x, sy = d.source.y;
            const tx = d.target.x, ty = d.target.y;
            if (d.isSelfLoop) return `M${sx + 8},${sy - 4} A30,30 0 1,1 ${sx + 8},${sy + 4}`;
            if (d.curvature === 0) return `M${sx},${sy} L${tx},${ty}`;
            const dx = tx - sx, dy = ty - sy;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const total = d.pairTotal || 1;
            const offsetRatio = 0.25 + total * 0.05;
            const baseOffset = Math.max(35, dist * offsetRatio);
            const cx = (sx + tx) / 2 + (-dy / dist * d.curvature * baseOffset);
            const cy = (sy + ty) / 2 + (dx / dist * d.curvature * baseOffset);
            return `M${sx},${sy} Q${cx},${cy} ${tx},${ty}`;
        };

        const getLinkMidpoint = d => {
            const sx = d.source.x, sy = d.source.y;
            const tx = d.target.x, ty = d.target.y;
            if (d.isSelfLoop) return { x: sx + 55, y: sy };
            if (d.curvature === 0) return { x: (sx + tx) / 2, y: (sy + ty) / 2 };
            const dx = tx - sx, dy = ty - sy;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const total = d.pairTotal || 1;
            const offsetRatio = 0.25 + total * 0.05;
            const baseOffset = Math.max(35, dist * offsetRatio);
            const cx = (sx + tx) / 2 + (-dy / dist * d.curvature * baseOffset);
            const cy = (sy + ty) / 2 + (dx / dist * d.curvature * baseOffset);
            return { x: 0.25 * sx + 0.5 * cx + 0.25 * tx, y: 0.25 * sy + 0.5 * cy + 0.25 * ty };
        };

        // Render links
        const linkGroup = g.append('g');
        const link = linkGroup.selectAll('path').data(edges).enter().append('path')
            .attr('stroke', '#ffffff22')
            .attr('stroke-width', 1.5)
            .attr('fill', 'none')
            .attr('marker-end', 'url(#arrow)')
            .style('cursor', 'pointer')
            .on('click', function (event, d) {
                event.stopPropagation();
                link.attr('stroke', '#ffffff22').attr('stroke-width', 1.5);
                d3.select(this).attr('stroke', '#3498db').attr('stroke-width', 2.5);
                setSelectedItem({ type: 'edge', data: d.rawData });
            });

        // Edge label backgrounds
        const linkLabelBg = linkGroup.selectAll('rect.label-bg').data(edges).enter().append('rect')
            .attr('class', 'label-bg')
            .attr('fill', 'rgba(15,15,15,0.85)')
            .attr('rx', 3)
            .style('display', showEdgeLabels ? 'block' : 'none')
            .style('pointer-events', 'none');

        // Edge labels
        const linkLabel = linkGroup.selectAll('text.edge-label').data(edges).enter().append('text')
            .attr('class', 'edge-label')
            .text(d => d.name.length > 14 ? d.name.substring(0, 14) + '…' : d.name)
            .attr('font-size', '9px')
            .attr('fill', '#ffffff66')
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('font-family', 'system-ui, sans-serif')
            .style('display', showEdgeLabels ? 'block' : 'none')
            .style('pointer-events', 'none');

        // Render nodes
        const nodeGroup = g.append('g');

        // Node glow (larger, transparent)
        nodeGroup.selectAll('circle.glow').data(nodes).enter().append('circle')
            .attr('class', 'glow')
            .attr('r', d => d.type === 'Idea' ? 22 : 16)
            .attr('fill', d => getColor(d.type))
            .attr('opacity', 0.15)
            .style('pointer-events', 'none');

        // Node circles
        const node = nodeGroup.selectAll('circle.main').data(nodes).enter().append('circle')
            .attr('class', 'main')
            .attr('r', d => d.type === 'Idea' ? 14 : 10)
            .attr('fill', d => getColor(d.type))
            .attr('stroke', '#1a1a1a')
            .attr('stroke-width', 2)
            .style('cursor', 'pointer')
            .on('click', function (event, d) {
                event.stopPropagation();
                node.attr('stroke', '#1a1a1a').attr('stroke-width', 2);
                link.attr('stroke', '#ffffff22').attr('stroke-width', 1.5);
                d3.select(this).attr('stroke', '#E91E63').attr('stroke-width', 3.5);
                link.filter(l => l.source.id === d.id || l.target.id === d.id)
                    .attr('stroke', '#E91E63').attr('stroke-width', 2);
                setSelectedItem({ type: 'node', data: d.rawData, entityType: d.type, color: getColor(d.type) });
            })
            .on('mouseenter', function () {
                d3.select(this).attr('stroke', '#ffffff').attr('stroke-width', 2.5);
            })
            .on('mouseleave', function (event, d) {
                d3.select(this).attr('stroke', '#1a1a1a').attr('stroke-width', 2);
            })
            .call(
                d3.drag()
                    .on('start', (event, d) => { d.fx = d.x; d.fy = d.y; })
                    .on('drag', (event, d) => {
                        d.fx = event.x; d.fy = event.y;
                        simulation.alpha(0.3).restart();
                    })
                    .on('end', (event, d) => {
                        simulation.alphaTarget(0);
                        d.fx = null; d.fy = null;
                    })
            );

        // Node labels
        nodeGroup.selectAll('text.node-label').data(nodes).enter().append('text')
            .attr('class', 'node-label')
            .text(d => d.name.length > 12 ? d.name.substring(0, 12) + '…' : d.name)
            .attr('font-size', d => d.type === 'Idea' ? '12px' : '10px')
            .attr('fill', '#ffffffcc')
            .attr('font-weight', d => d.type === 'Idea' ? '600' : '400')
            .attr('dx', d => d.type === 'Idea' ? 17 : 13)
            .attr('dy', 4)
            .style('pointer-events', 'none')
            .style('font-family', 'system-ui, sans-serif');

        // Click background to deselect
        svg.on('click', () => {
            node.attr('stroke', '#1a1a1a').attr('stroke-width', 2);
            link.attr('stroke', '#ffffff22').attr('stroke-width', 1.5);
            setSelectedItem(null);
        });

        // Force simulation
        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(edges).id(d => d.id).distance(150))
            .force('charge', d3.forceManyBody().strength(-400))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collide', d3.forceCollide(50))
            .force('x', d3.forceX(width / 2).strength(0.04))
            .force('y', d3.forceY(height / 2).strength(0.04))
            .on('tick', () => {
                link.attr('d', getLinkPath);
                linkLabel.each(function (d) {
                    const mid = getLinkMidpoint(d);
                    d3.select(this).attr('x', mid.x).attr('y', mid.y);
                });
                linkLabelBg.each(function (d, i) {
                    const mid = getLinkMidpoint(d);
                    const textEl = linkLabel.nodes()[i];
                    try {
                        const bbox = textEl.getBBox();
                        d3.select(this)
                            .attr('x', mid.x - bbox.width / 2 - 3)
                            .attr('y', mid.y - bbox.height / 2 - 2)
                            .attr('width', bbox.width + 6)
                            .attr('height', bbox.height + 4);
                    } catch (e) { /* ignore bbox errors */ }
                });
                nodeGroup.selectAll('circle.glow')
                    .attr('cx', d => d.x).attr('cy', d => d.y);
                node.attr('cx', d => d.x).attr('cy', d => d.y);
                nodeGroup.selectAll('text.node-label')
                    .attr('x', d => d.x).attr('y', d => d.y);
            });

        simulationRef.current = simulation;

        return () => simulation.stop();
    }, [graphData, showEdgeLabels]);

    // Cleanup simulation on unmount
    useEffect(() => {
        return () => {
            if (simulationRef.current) simulationRef.current.stop();
        };
    }, []);

    // Entity types for legend
    const entityTypes = graphData ? (() => {
        const typeMap = {};
        graphData.nodes.forEach(n => {
            const type = (n.labels || []).find(l => !['Entity', 'Node'].includes(l)) || 'Entity';
            if (!typeMap[type]) typeMap[type] = { name: type, color: getColor(type), count: 0 };
            typeMap[type].count++;
        });
        return Object.values(typeMap);
    })() : [];

    return (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
                <div>
                    <h2 className="text-white font-medium text-lg">Market Knowledge Graph</h2>
                    <p className="text-white/40 text-xs mt-0.5">
                        {nodeCount} entities · {edgeCount} relationships
                        {source === 'merged' && <span className="ml-2 text-cyan-400/60">· Zep enhanced</span>}
                        {source === 'local' && <span className="ml-2 text-white/20">· Built from simulation data</span>}
                    </p>
                </div>
                <div className="flex items-center gap-6">
                    {/* Edge Labels Toggle */}
                    <label className="flex items-center gap-2 cursor-pointer">
                        <div
                            className={`relative w-8 h-4 rounded-full transition-colors ${showEdgeLabels ? 'bg-blue-500' : 'bg-white/20'}`}
                            onClick={() => setShowEdgeLabels(v => !v)}
                        >
                            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${showEdgeLabels ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </div>
                        <span className="text-white/50 text-xs">Edge Labels</span>
                    </label>
                    {/* Close */}
                    <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none transition-colors">×</button>
                </div>
            </div>

            {/* Main */}
            <div className="flex flex-1 overflow-hidden">
                {/* Graph Canvas */}
                <div
                    ref={containerRef}
                    className="flex-1 relative"
                    style={{ background: 'radial-gradient(ellipse at center, #0d1117 0%, #000 100%)' }}
                >
                    {loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                            <div className="w-10 h-10 rounded-full border-2 border-t-blue-500 border-white/10 animate-spin" />
                            <p className="text-white/40 text-sm">Building knowledge graph...</p>
                        </div>
                    )}

                    {error && !loading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-8">
                            <svg className="w-12 h-12 text-white/10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                            <p className="text-white/40 text-sm">{error}</p>
                            <p className="text-white/20 text-xs max-w-md">
                                Knowledge graph not available. Make sure a simulation has been run. The graph visualizes competitors, risks, trends, segments, and their relationships.
                            </p>
                        </div>
                    )}

                    {!loading && !error && graphData && (
                        <svg ref={svgRef} className="w-full h-full" />
                    )}

                    {/* Entity type legend — bottom left */}
                    {entityTypes.length > 0 && (
                        <div className="absolute bottom-6 left-6 bg-black/70 backdrop-blur-sm border border-white/10 rounded-xl p-4">
                            <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-3">Entity Types</p>
                            <div className="flex flex-wrap gap-x-4 gap-y-2 max-w-xs">
                                {entityTypes.map(t => (
                                    <div key={t.name} className="flex items-center gap-1.5">
                                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                                        <span className="text-[10px] text-white/60">{t.name}</span>
                                        <span className="text-[9px] text-white/25">({t.count})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Detail Panel */}
                {selectedItem && (
                    <div className="w-80 flex-shrink-0 border-l border-white/10 bg-black/60 flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                            <div className="flex items-center gap-2">
                                <span className="text-white/80 text-sm font-medium">
                                    {selectedItem.type === 'node' ? 'Entity' : 'Relationship'}
                                </span>
                                {selectedItem.type === 'node' && (
                                    <span
                                        className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
                                        style={{
                                            backgroundColor: selectedItem.color + '22',
                                            color: selectedItem.color,
                                            border: `1px solid ${selectedItem.color}44`,
                                        }}
                                    >
                                        {selectedItem.entityType}
                                    </span>
                                )}
                            </div>
                            <button onClick={() => setSelectedItem(null)} className="text-white/30 hover:text-white transition-colors">×</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {selectedItem.type === 'node' ? (
                                <>
                                    <div>
                                        <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-1">Name</p>
                                        <p className="text-white/80 text-sm">{selectedItem.data.name}</p>
                                    </div>
                                    {selectedItem.data.summary && (
                                        <div>
                                            <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-1">Summary</p>
                                            <p className="text-white/60 text-xs leading-relaxed">{selectedItem.data.summary}</p>
                                        </div>
                                    )}
                                    {selectedItem.data.attributes && Object.keys(selectedItem.data.attributes).filter(k => selectedItem.data.attributes[k]).length > 0 && (
                                        <div>
                                            <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-2">Properties</p>
                                            <div className="space-y-2">
                                                {Object.entries(selectedItem.data.attributes)
                                                    .filter(([, v]) => v !== '' && v !== undefined && v !== null)
                                                    .map(([k, v]) => (
                                                        <div key={k} className="flex gap-2">
                                                            <span className="text-white/30 text-[10px] min-w-[80px] capitalize">{k.replace(/_/g, ' ')}</span>
                                                            <span className="text-white/60 text-[10px] flex-1">{String(v)}</span>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    )}
                                    {selectedItem.data.labels?.length > 0 && (
                                        <div>
                                            <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-2">Labels</p>
                                            <div className="flex flex-wrap gap-1">
                                                {selectedItem.data.labels.map(l => (
                                                    <span key={l} className="px-2 py-0.5 bg-white/5 border border-white/10 rounded-full text-[9px] text-white/50">{l}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : selectedItem.data.isSelfLoopGroup ? (
                                <>
                                    <div>
                                        <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-1">Self Relations</p>
                                        <p className="text-white/60 text-xs">{selectedItem.data.source_name} — {selectedItem.data.selfLoopEdges?.length} connections</p>
                                    </div>
                                    <div className="space-y-2">
                                        {(selectedItem.data.selfLoopEdges || []).map((loop, i) => (
                                            <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-3">
                                                <p className="text-[10px] text-white/50 font-medium mb-1">{loop.name || loop.fact_type || 'RELATED'}</p>
                                                {loop.fact && <p className="text-[10px] text-white/40 leading-relaxed">{loop.fact}</p>}
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>
                                        <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-1">Relationship</p>
                                        <p className="text-white/70 text-sm">
                                            {selectedItem.data.source_node_name} → {selectedItem.data.name || selectedItem.data.fact_type} → {selectedItem.data.target_node_name}
                                        </p>
                                    </div>
                                    {selectedItem.data.fact && (
                                        <div>
                                            <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-1">Fact</p>
                                            <p className="text-white/60 text-xs leading-relaxed">{selectedItem.data.fact}</p>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-1">Type</p>
                                        <p className="text-white/50 text-xs">{selectedItem.data.fact_type || 'RELATED'}</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
