const express = require('express');
const router = express.Router();
const { buildIdeaContext } = require('../engine/zepService');

/**
 * POST /api/graph/build
 * Explicitly triggers Zep Ontology/Graph extraction for an Idea.
 * Returns the extracted context (Competitors, Risks, Trends).
 */
router.post('/build', async (req, res) => {
    try {
        const { idea, industry, businessModel, targetAudience } = req.body;
        
        console.log(`🧠 [GRAPH ROUTE] Building market context for "${idea?.substring(0, 30)}..."`);
        const context = await buildIdeaContext(idea, targetAudience, industry, businessModel);
        
        if (!context) {
            return res.status(500).json({ success: false, error: "Failed to establish knowledge graph context." });
        }

        res.json({
            success: true,
            graphId: context.graphId,
            context: context
        });

    } catch (err) {
        console.error('[GRAPH BUILD] Error:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/graph/data
 * Builds a knowledge graph from simulation data (always available)
 * and optionally merges Zep graph data when configured.
 */
router.post('/data', async (req, res) => {
    try {
        const { graphId, idea, segments, marketContext: reqMarketContext } = req.body;

        // ── Step 1: Build local graph from simulation data ──
        const nodeMap = {};
        const edges = [];

        function addNode(id, name, type, attributes) {
            if (!nodeMap[id]) {
                nodeMap[id] = { id, name, type, attributes: attributes || {} };
            }
            return id;
        }

        function addEdge(sourceId, targetId, name, factType, fact) {
            edges.push({ sourceId, targetId, name, factType, fact });
        }

        // Idea node (central hub)
        const ideaText = idea?.idea || 'Untitled Idea';
        const ideaId = 'idea_root';
        addNode(ideaId, ideaText.substring(0, 40), 'Idea', {
            industry: idea?.industry || '',
            targetAudience: idea?.targetAudience || '',
            businessModel: idea?.businessModel || ''
        });

        // Segment nodes + edges to idea
        const segs = Array.isArray(segments) ? segments : [];
        segs.forEach((segment, i) => {
            const segId = `seg_${segment.segment_id || i}`;
            addNode(segId, segment.segment_name || `Segment ${i + 1}`, 'Segment', {
                resonanceScore: segment.testResult?.resonanceScore || '',
                verdict: segment.testResult?.verdict || '',
                dominantOccupation: segment.profile?.dominant_occupation || '',
                zone: segment.profile?.dominant_zone || '',
                ageRange: segment.profile?.age_range || ''
            });
            addEdge(segId, ideaId,
                segment.testResult?.verdict || 'TARGETS', 'TARGETS',
                `${segment.segment_name || 'Segment'} has verdict: ${segment.testResult?.verdict || 'NEUTRAL'}`
            );

            // Key drivers as edges from segment → idea
            (segment.testResult?.keyDrivers || []).slice(0, 3).forEach(driver => {
                addEdge(segId, ideaId, 'DRIVEN_BY', 'KEY_DRIVER', driver);
            });

            // Friction points as edges from segment → idea
            (segment.testResult?.frictionPoints || []).slice(0, 3).forEach(friction => {
                addEdge(segId, ideaId, 'FRICTION', 'FRICTION_POINT', friction);
            });

            // Persona nodes (top 3 per segment)
            (segment.personas || []).slice(0, 3).forEach(persona => {
                const ep = persona.enrichedProfile;
                const pName = ep?.fullName || persona.metadata?.name || `Persona ${persona.persona_id || persona.id}`;
                const pId = `persona_${persona.persona_id || persona.id}`;
                addNode(pId, pName, 'Persona', {
                    age: persona.metadata?.age || '',
                    occupation: persona.metadata?.occupation || '',
                    state: persona.metadata?.state || '',
                    adoptionStyle: ep?.behaviorPatterns?.adoptionStyle || '',
                    sentimentScore: ep?.memoryState?.sentimentScore || 0.5,
                    reactionToIdea: (ep?.reactionToIdea || '').substring(0, 100)
                });
                addEdge(pId, segId, 'BELONGS_TO', 'BELONGS_TO',
                    `${pName} is part of ${segment.segment_name || 'Segment'}`
                );
            });
        });

        // Market context nodes — check multiple sources
        const mc = reqMarketContext || idea?.marketContext || null;

        if (mc) {
            (mc.competitors || []).forEach((comp, i) => {
                const name = typeof comp === 'string' ? comp : (comp.name || `Competitor ${i}`);
                const detail = typeof comp === 'string' ? comp : (comp.description || name);
                const cId = `comp_${name.substring(0, 20).replace(/\s+/g, '_').toLowerCase()}`;
                addNode(cId, name.substring(0, 35), 'Competitor', { detail });
                addEdge(ideaId, cId, 'COMPETES_WITH', 'COMPETES_WITH', name);
            });

            (mc.risks || []).forEach((risk, i) => {
                const name = typeof risk === 'string' ? risk : (risk.name || `Risk ${i}`);
                const detail = typeof risk === 'string' ? risk : (risk.description || name);
                const rId = `risk_${i}`;
                addNode(rId, name.substring(0, 35), 'Risk', { detail });
                addEdge(ideaId, rId, 'FACES_RISK', 'FACES_RISK', name);
            });

            (mc.trends || []).forEach((trend, i) => {
                const name = typeof trend === 'string' ? trend : (trend.name || `Trend ${i}`);
                const detail = typeof trend === 'string' ? trend : (trend.description || name);
                const tId = `trend_${i}`;
                addNode(tId, name.substring(0, 35), 'Trend', { detail });
                addEdge(tId, ideaId, 'SHAPES', 'SHAPES', name);
            });
        }

        // Convert to output arrays
        const localNodes = Object.values(nodeMap).map(n => ({
            uuid: n.id,
            name: n.name,
            labels: [n.type],
            summary: n.attributes ? Object.entries(n.attributes)
                .filter(([k, v]) => v !== '' && v !== undefined && v !== null)
                .map(([k, v]) => `${k}: ${v}`)
                .join(' | ') : '',
            attributes: n.attributes || {}
        }));

        const localEdges = edges.map((e, i) => ({
            uuid: `edge_${i}`,
            name: e.name,
            fact: e.fact,
            fact_type: e.factType,
            source_node_uuid: e.sourceId,
            target_node_uuid: e.targetId,
            source_node_name: nodeMap[e.sourceId]?.name || '',
            target_node_name: nodeMap[e.targetId]?.name || ''
        }));

        // ── Step 2: Optionally merge Zep data ──
        let zepNodes = [];
        let zepEdges = [];
        let source = 'local';

        if (process.env.ZEP_API_KEY && graphId) {
            try {
                const { ZepClient } = require('@getzep/zep-cloud');
                const client = new ZepClient({ apiKey: process.env.ZEP_API_KEY });

                const [nodeResult, edgeResult] = await Promise.allSettled([
                    client.graph.search({ query: 'market entities competitors risks trends', limit: 40, userId: graphId, scope: 'nodes' }),
                    client.graph.search({ query: 'relationships connections', limit: 80, userId: graphId, scope: 'edges' })
                ]);

                if (nodeResult.status === 'fulfilled' && nodeResult.value?.nodes) {
                    zepNodes = nodeResult.value.nodes.map(n => ({
                        uuid: `zep_${n.uuid_ || n.uuid}`,
                        name: n.name || 'Unknown',
                        labels: [...(n.labels || []), 'ZepEntity'],
                        summary: n.summary || '',
                        attributes: n.attributes || {}
                    }));
                }

                if (edgeResult.status === 'fulfilled' && edgeResult.value?.edges) {
                    zepEdges = edgeResult.value.edges.map((e, i) => ({
                        uuid: `zep_edge_${e.uuid_ || i}`,
                        name: e.name || '',
                        fact: e.fact || '',
                        fact_type: e.fact_type || e.name || 'RELATED',
                        source_node_uuid: `zep_${e.source_node_uuid}`,
                        target_node_uuid: `zep_${e.target_node_uuid}`,
                        source_node_name: e.source_node_name || '',
                        target_node_name: e.target_node_name || ''
                    }));
                }

                if (zepNodes.length > 0) source = 'merged';
                console.log(`🔗 [GRAPH] Zep merge: ${zepNodes.length} nodes, ${zepEdges.length} edges`);
            } catch (zepErr) {
                console.warn('[GRAPH] Zep fetch failed, using local only:', zepErr.message);
            }
        }

        // ── Step 3: Merge and return ──
        const allNodes = [...localNodes, ...zepNodes];
        const allEdges = [...localEdges, ...zepEdges];

        res.json({
            success: true,
            nodes: allNodes,
            edges: allEdges,
            node_count: allNodes.length,
            edge_count: allEdges.length,
            source
        });

    } catch (err) {
        console.error('[GRAPH] Error:', err.message);
        res.json({
            success: false,
            error: err.message,
            nodes: [],
            edges: []
        });
    }
});

module.exports = router;
