'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
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
    '#D63384', // PainPoint — magenta
    '#0D6EFD', // CustomerSegment — bright blue
    '#198754', // PricingModel — teal-green
    '#9b59b6', // fallback 1
    '#27ae60', // fallback 2
];

const TYPE_ORDER = ['Idea', 'Segment', 'Persona', 'Competitor', 'Risk', 'Trend', 'Verdict', 'ZepEntity', 'PainPoint', 'CustomerSegment', 'PricingModel'];

function getColor(type) {
    const idx = TYPE_ORDER.indexOf(type);
    return idx >= 0 ? COLOR_PALETTE[idx] : COLOR_PALETTE[8];
}

export default function GraphExplorer({ graphId, idea, segments, marketContext, onClose, headless = false }) {
    const [graphData, setGraphData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [showEdgeLabels, setShowEdgeLabels] = useState(true);
    const [nodeCount, setNodeCount] = useState(0);
    const [edgeCount, setEdgeCount] = useState(0);
    const [source, setSource] = useState('local');
    const [activeTab, setActiveTab] = useState('force'); // 'force' | 'entities' | 'relations'
    const [isFullscreen, setIsFullscreen] = useState(false);

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
    }, [graphId, idea, segments, marketContext]);
    
    // ── Data Normalization ──
    const { nodes, edges } = useMemo(() => {
        if (!graphData) return { nodes: [], edges: [] };
        
        const rawNodes = graphData.nodes || [];
        const rawEdges = graphData.edges || [];

        const processedNodes = rawNodes
            .filter(n => n.uuid || n.id)
            .map(n => ({
                id: n.uuid || n.id,
                name: n.name || 'Unknown',
                type: (n.labels || []).find(l => !['Entity', 'Node'].includes(l)) || 'Entity',
                rawData: n,
            }));

        const nodeIds = new Set(processedNodes.map(n => n.id));

        const processedEdges = rawEdges
            .map(e => ({
                source: e.source || e.source_node_uuid,
                target: e.target || e.target_node_uuid,
                type: e.type || e.fact_type || '',
                rawData: e
            }))
            .filter(e => e.source && e.target && nodeIds.has(e.source) && nodeIds.has(e.target));
            
        return { nodes: processedNodes, edges: processedEdges };
    }, [graphData]);
    
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

    // ── Handle Dimensions ──
    useEffect(() => {
        if (!containerRef.current) return;
        
        const updateDims = () => {
             const { clientWidth, clientHeight } = containerRef.current;
             if (clientWidth > 0 && clientHeight > 0) {
                 setDimensions({ width: clientWidth, height: clientHeight });
             }
        };

        // Initialize immediately
        updateDims();

        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                    setDimensions({ width, height });
                }
            }
        });
        
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, [isFullscreen, activeTab]); // Re-observe if layout drastically shifts

    // ── D3 Rendering ──
    useEffect(() => {
        // Fallback to client dimensions if state hasn't updated yet but we have nodes
        const width = dimensions.width || (containerRef.current?.clientWidth) || 0;
        const height = dimensions.height || (containerRef.current?.clientHeight) || 0;
        
        if (!nodes.length || !svgRef.current || !containerRef.current || activeTab !== 'force' || width <= 0) return;
        
        if (simulationRef.current) simulationRef.current.stop();

        const svg = d3.select(svgRef.current)
            .attr('width', width)
            .attr('height', height)
            .attr('viewBox', `0 0 ${width} ${height}`);
        svg.selectAll('*').remove();

        const g = svg.append('g');

        // Zoom setup
        const zoom = d3.zoom().on('zoom', (event) => {
            g.attr('transform', event.transform);
        });
        svg.call(zoom);
        
        // Initial transform - Center the graph
        svg.call(zoom.transform, d3.zoomIdentity.translate(width/2, height/2).scale(0.8));

        console.log(`[GRAPH] Initializing simulation: ${width}x${height} with ${nodes.length} nodes`);

        // Create LOCAL copies for simulation as d3 modifies them in-place
        const simNodes = nodes.map(d => ({...d}));
        const simEdges = edges.map(d => ({...d}));

        const simulation = d3.forceSimulation(simNodes)
            .force('link', d3.forceLink(simEdges).id(d => d.id).distance(150))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(0, 0))
            .force('collision', d3.forceCollide().radius(60));

        simulationRef.current = simulation;

        const linkLayer = g.append('g')
            .selectAll('line')
            .data(simEdges)
            .enter().append('line')
            .attr('stroke', 'rgba(0,0,0,0.1)')
            .attr('stroke-width', 1.5);

        const nodeLayer = g.append('g')
            .selectAll('g')
            .data(simNodes)
            .enter().append('g')
            .call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));

        nodeLayer.append('circle')
            .attr('r', d => d.type === 'Idea' ? 16 : 13)
            .attr('fill', d => getColor(d.type))
            .attr('stroke', '#000')
            .attr('stroke-width', 2)
            .attr('class', 'cursor-pointer hover:scale-125 transition-transform')
            .on('click', (e, d) => setSelectedItem({ type: 'node', data: d }));

        nodeLayer.append('text')
            .text(d => d.name)
            .attr('fill', 'rgba(0,0,0,0.7)')
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .attr('dy', 25)
            .attr('text-anchor', 'middle')
            .attr('class', 'pointer-events-none');

        simulation.on('tick', () => {
            linkLayer
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            nodeLayer
                .attr('transform', d => `translate(${d.x},${d.y})`);
        });

        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }

        return () => {
            simulation.stop();
        };
    }, [nodes, edges, activeTab, dimensions]);

    // ── Controls ──
    const handleZoomIn = () => {
        d3.select(svgRef.current).transition().duration(300).call(d3.zoom().scaleBy, 1.3);
    };
    const handleZoomOut = () => {
        d3.select(svgRef.current).transition().duration(300).call(d3.zoom().scaleBy, 0.7);
    };
    const handleReset = () => {
        const container = containerRef.current;
        if (!container) return;
        const width = container.clientWidth;
        const height = container.clientHeight;
        d3.select(svgRef.current).transition().duration(500).call(
            d3.zoom().transform, 
            d3.zoomIdentity.translate(width/2, height/2).scale(0.8)
        );
    };

    if (loading) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-black/50">
                <div className="w-10 h-10 rounded-full border-2 border-t-purple-500 border-black/[0.04] animate-spin mb-4" />
                <span className="text-[11px] uppercase tracking-widest font-black">Synthesizing Neural Graph...</span>
            </div>
        );
    }

    if (!nodes || nodes.length === 0) {
        return (
            <div className="flex flex-col h-full w-full bg-[#FAFAFA] items-center justify-center p-12 text-center relative overflow-hidden group">
                {/* Error/Empty state decor */}
                <div className="absolute inset-0 bg-grid opacity-5 pointer-events-none" />
                <div className="w-16 h-16 rounded-2xl bg-black/[0.02] border border-black/[0.04] flex items-center justify-center mb-6 text-black/20 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <h3 className="text-xl font-bold text-[#1a1a1a] mb-2 font-serif tracking-tight">Graph Synthesis Incomplete</h3>
                <p className="text-sm text-black/50 max-w-sm leading-relaxed mb-6">
                    The neural extraction engine could not generate nodes for this market context. This usually happens if the API rate limits were exceeded or the input idea lacked sufficient depth.
                </p>
                <div className="text-[10px] uppercase font-mono tracking-widest text-[#E85D3A] bg-[#E85D3A]/8 px-4 py-1.5 rounded-full border border-[#E85D3A]/10">
                    {error || "0 Nodes Extracted"}
                </div>
            </div>
        );
    }

    const renderTabs = () => (
        <div className="flex items-center gap-1 p-1 bg-black/[0.02] border-b border-black/[0.06]">
            {['force', 'entities', 'relations'].map((tab) => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`
                        px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all
                        ${activeTab === tab 
                            ? "bg-black/[0.06] text-[#1a1a1a] shadow-inner" 
                            : "text-black/40 hover:text-black/60 hover:bg-[#FAFAFA]"}
                    `}
                >
                    {tab === 'force' ? 'Neural Graph' : tab === 'entities' ? 'Entity List' : 'Relations Scan'}
                </button>
            ))}
        </div>
    );

    return (
        <div 
            className={`
                flex flex-col h-full w-full bg-white transition-all duration-500 overflow-hidden
                ${isFullscreen ? "fixed inset-0 z-[1000]" : "relative"}
            `}
        >
            {/* Header / Tabs */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-black/[0.08] shrink-0 bg-white/80 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="text-[12px] font-black italic tracking-tighter text-[#1a1a1a]">MARKET EXPLORER</div>
                    {renderTabs()}
                </div>
                <div className="flex items-center gap-3">
                    <button 
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="p-2 text-black/50 hover:text-[#1a1a1a] transition-colors"
                        title="Toggle Fullscreen"
                    >
                        {isFullscreen ? (
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                        )}
                    </button>
                    {!isFullscreen && onClose && (
                        <button onClick={onClose} className="text-black/50 hover:text-[#1a1a1a] transition-colors">✕</button>
                    )}
                </div>
            </div>

            <div className="flex-1 relative flex overflow-hidden h-full w-full">
                <div className="flex-1 relative flex overflow-hidden bg-[#FAFAFA] h-full w-full">
                    {activeTab === 'force' && (
                        <>
                            <div ref={containerRef} className="absolute inset-0 cursor-grab active:cursor-grabbing overflow-hidden">
                                <svg ref={svgRef} className="w-full h-full" />
                            </div>
                            
                            {/* Force Controls */}
                            <div className="absolute bottom-6 right-6 flex flex-col gap-2 scale-90">
                                <button onClick={handleZoomIn} className="p-3 bg-black/[0.04] hover:bg-white/[0.1] border border-black/[0.08] rounded-xl text-black/60 hover:text-[#1a1a1a] transition-all backdrop-blur-md">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                </button>
                                <button onClick={handleZoomOut} className="p-3 bg-black/[0.04] hover:bg-white/[0.1] border border-black/[0.08] rounded-xl text-black/60 hover:text-[#1a1a1a] transition-all backdrop-blur-md">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                                </button>
                                <button onClick={handleReset} className="p-3 bg-black/[0.04] hover:bg-white/[0.1] border border-black/[0.08] rounded-xl text-black/60 hover:text-[#1a1a1a] transition-all backdrop-blur-md">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                </button>
                            </div>
                        </>
                    )}

                    {activeTab === 'entities' && (
                        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-black/[0.08]">
                                        <th className="py-3 px-4 text-[11px] uppercase font-black text-black/50 tracking-widest">Type</th>
                                        <th className="py-3 px-4 text-[11px] uppercase font-black text-black/50 tracking-widest">Entity Name</th>
                                        <th className="py-3 px-4 text-[11px] uppercase font-black text-black/50 tracking-widest">Properties</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {nodes.map((node, i) => (
                                        <tr key={node.id} className="border-b border-white/[0.03] hover:bg-[#FAFAFA] group transition-colors font-sans">
                                            <td className="py-4 px-4 whitespace-nowrap">
                                                <span 
                                                    className="px-2 py-1 rounded text-[11px] font-black uppercase border"
                                                    style={{ 
                                                        color: getColor(node.type), 
                                                        borderColor: `${getColor(node.type)}44`,
                                                        background: `${getColor(node.type)}11`
                                                    }}
                                                >
                                                    {node.type}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 font-normal text-[#1a1a1a] text-[14px]">{node.name}</td>
                                            <td className="py-4 px-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {Object.entries(node.rawData || {}).map(([key, val]) => (
                                                        !['uuid', 'labels', 'name', 'id'].includes(key) && val && (
                                                            <div key={key} className="flex gap-2 text-[11px]">
                                                                <span className="text-black/30 capitalize">{key}:</span>
                                                                <span className="text-black/60">{String(val)}</span>
                                                            </div>
                                                        )
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === 'relations' && (
                        <div className="flex-1 overflow-auto p-4 custom-scrollbar">
                            <div className="grid gap-3">
                                {edges.map((edge, i) => {
                                    const sNode = nodes.find(n => n.id === (edge.source?.id || edge.source));
                                    const tNode = nodes.find(n => n.id === (edge.target?.id || edge.target));
                                    return (
                                        <div key={i} className="flex items-center gap-6 p-4 bg-[#FAFAFA] border border-black/[0.04] rounded-2xl group hover:border-black/[0.08] transition-colors">
                                            <div className="flex flex-col gap-1 w-[40%] text-right overflow-hidden">
                                                <span className="text-[11px] text-black/30 uppercase font-black tracking-widest">{sNode?.type}</span>
                                                <span className="text-[13px] font-normal text-[#1a1a1a] truncate">{sNode?.name || "Unknown"}</span>
                                            </div>
                                            <div className="flex-1 flex flex-col items-center justify-center gap-1">
                                                <div className="w-full h-[1px] bg-white/10 relative">
                                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-[#111] border border-black/[0.08] rounded-full text-[11px] font-black uppercase tracking-widest text-black/50 shadow-xl">
                                                        {edge.type}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1 w-[40%] text-left overflow-hidden">
                                                <span className="text-[11px] text-black/30 uppercase font-black tracking-widest">{tNode?.type}</span>
                                                <span className="text-[13px] font-normal text-[#1a1a1a] truncate">{tNode?.name || "Unknown"}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Panel for Selection */}
                {selectedItem && (
                    <div className="w-80 border-l border-black/[0.08] bg-white/80 backdrop-blur-2xl p-6 overflow-y-auto hidden lg:block custom-scrollbar shadow-[-20px_0_40px_rgba(0,0,0,0.5)]">
                        <div className="flex justify-between items-start mb-6">
                            <span 
                                className="px-2 py-1 rounded text-[11px] font-black uppercase border"
                                style={{ 
                                    color: getColor(selectedItem.data.type), 
                                    borderColor: `${getColor(selectedItem.data.type)}44`,
                                    background: `${getColor(selectedItem.data.type)}11`
                                }}
                            >
                                {selectedItem.data.type}
                            </span>
                            <button onClick={() => setSelectedItem(null)} className="text-black/30 hover:text-[#1a1a1a] transition-colors">✕</button>
                        </div>
                        <h3 className="text-xl font-bold text-[#1a1a1a] mb-4">{selectedItem.data.name}</h3>
                        <div className="space-y-4">
                            {Object.entries(selectedItem.data.rawData || {}).map(([key, val]) => (
                                !['uuid', 'labels', 'name', 'id'].includes(key) && val && (
                                    <div key={key} className="space-y-1">
                                        <p className="text-[11px] text-black/40 uppercase font-black tracking-widest">{key}</p>
                                        <p className="text-sm text-black/70 leading-relaxed font-normal">{String(val)}</p>
                                    </div>
                                )
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
