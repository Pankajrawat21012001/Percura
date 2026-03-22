/**
 * Zep Market Context Service — Graph RAG v2
 * Builds a richly typed, multi-layered knowledge graph from founder's idea
 * and extracts multi-dimensional market context via schema-validated retrieval.
 *
 * Upgrades over v1:
 *   1. Typed ontology schema (10 entity types, 10 relationship types)
 *   2. Chunked ingestion (6 semantic chunks with polling)
 *   3. Multi-dimensional retrieval (6 parallel searches)
 *   4. Simulation activity write-back
 */

require('dotenv').config();

let zepClient = null;

function getZepClient() {
    if (!process.env.ZEP_API_KEY) return null;
    if (!zepClient) {
        const { ZepClient } = require('@getzep/zep-cloud');
        zepClient = new ZepClient({ apiKey: process.env.ZEP_API_KEY });
    }
    return zepClient;
}

// In-memory cache: ideaKey → { graphId, context, extractedAt }
const graphCache = new Map();

const { generateAIResponse } = require('./groqService');

// ─── Ontology Schema ────────────────────────────────────────────────────────

const ONTOLOGY_SCHEMA = {
    entities: {
        Startup:          { description: 'The startup idea being validated' },
        Competitor:       { description: 'A competing product or alternative solution in the market' },
        CustomerSegment:  { description: 'A defined group of target customers with shared characteristics' },
        PainPoint:        { description: 'A problem or frustration experienced by customers' },
        Feature:          { description: 'A product capability or functionality' },
        PricingModel:     { description: 'A pricing strategy or payment structure' },
        GeographicMarket: { description: 'A geographic region or market area' },
        RegulatoryBody:   { description: 'A government body or regulatory authority affecting the market' },
        Trend:            { description: 'An emerging market or behavioral trend' },
        Risk:             { description: 'A business risk, barrier, or threat' },
    },
    edges: {
        COMPETES_WITH: {
            description: 'Startup competes with competitor',
            sourceTargets: [{ source: 'Startup', target: 'Competitor' }],
        },
        TARGETS: {
            description: 'Startup targets a customer segment',
            sourceTargets: [{ source: 'Startup', target: 'CustomerSegment' }],
        },
        SOLVES: {
            description: 'Feature solves a pain point',
            sourceTargets: [{ source: 'Feature', target: 'PainPoint' }],
        },
        FACES: {
            description: 'Startup faces a risk',
            sourceTargets: [{ source: 'Startup', target: 'Risk' }],
        },
        OPERATES_IN: {
            description: 'Startup operates in a geographic market',
            sourceTargets: [{ source: 'Startup', target: 'GeographicMarket' }],
        },
        REGULATED_BY: {
            description: 'Startup regulated by a regulatory body',
            sourceTargets: [{ source: 'Startup', target: 'RegulatoryBody' }],
        },
        SHAPED_BY: {
            description: 'Customer segment shaped by a trend',
            sourceTargets: [{ source: 'CustomerSegment', target: 'Trend' }],
        },
        HAS_PRICING: {
            description: 'Startup has a pricing model',
            sourceTargets: [{ source: 'Startup', target: 'PricingModel' }],
        },
        EXPERIENCES: {
            description: 'Customer segment experiences a pain point',
            sourceTargets: [{ source: 'CustomerSegment', target: 'PainPoint' }],
        },
        ADOPTS: {
            description: 'Customer segment adopts a feature',
            sourceTargets: [{ source: 'CustomerSegment', target: 'Feature' }],
        },
    },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const extractEdges = (result) => {
    if (result.status === 'rejected') return [];
    return (result.value?.edges || result.value?.results || [])
        .map(e => e.fact || e.content || e.summary || '')
        .filter(Boolean)
        .slice(0, 5);
};

const extractNodes = (result) => {
    if (result.status === 'rejected') return [];
    return (result.value?.nodes || [])
        .map(n => ({ name: n.name, summary: n.summary, labels: n.labels }))
        .filter(n => n.name)
        .slice(0, 5);
};

// ─── Main: Build Idea Context ───────────────────────────────────────────────

/**
 * Build a Zep graph from the idea and extract market context.
 * Returns structured context to inject into Groq prompts AND render on the frontend.
 */
async function buildIdeaContext(idea, targetAudience, industry, businessModel) {
    const cacheKey = `${idea}::${industry}::${targetAudience}`;
    if (graphCache.has(cacheKey)) {
        console.log('⚡ [ZEP] Using cached market context.');
        return graphCache.get(cacheKey);
    }

    const client = getZepClient();
    if (!client) return null;

    try {
        const crypto = require('crypto');
        const userId = `percura_${crypto.createHash('md5').update(cacheKey).digest('hex').slice(0, 12)}`;

        // ── 1. Ensure Zep user exists ───────────────────────────────────
        try {
            await client.user.get(userId);
        } catch (userErr) {
            try {
                await client.user.add({
                    userId: userId,
                    firstName: 'Percura',
                    lastName: 'Simulation',
                    metadata: { source: 'percura_ontology', idea: idea.slice(0, 100) },
                });
                console.log(`✅ [ZEP] New user created: ${userId}`);
            } catch (addErr) {
                const errMsg = addErr.message || '';
                const isAlreadyExists =
                    errMsg.includes('already exists') ||
                    (addErr.body && JSON.stringify(addErr.body).includes('already exists'));
                if (!isAlreadyExists) {
                    console.warn(`⚠️ [ZEP] Failed to create user ${userId}:`, errMsg);
                }
            }
        }

        // ── 2. UPGRADE 1 — Set typed ontology schema ───────────────────
        try {
            await client.graph.setOntology({
                graphIds: [userId],
                ...ONTOLOGY_SCHEMA,
            });
            console.log(`✅ [ZEP] Typed ontology schema set for graph: ${userId}`);
        } catch (ontErr) {
            console.warn('⚠️ [ZEP] setOntology not available or failed (non-fatal):', ontErr.message);
            // Continue — ontology failure never blocks the flow
        }

        // ── 3. UPGRADE 2 — Chunked ingestion ───────────────────────────
        const chunks = [
            `Startup idea: ${idea}`,
            `Target audience: ${targetAudience}. Industry: ${industry || 'General'}. Business model: ${businessModel || 'Not specified'}.`,
            `Indian market context for ${industry || 'this industry'}: This product will operate across urban, semi-urban and rural zones in India. Consider UPI and cash payment infrastructure, language diversity across Hindi belt and South India, socioeconomic stratification, kirana retail networks, and WhatsApp-driven word of mouth adoption patterns.`,
            `Competitive landscape for ${idea} in India: Consider existing players, alternatives, and substitutes that Indian consumers might use instead.`,
            `Regulatory and risk context: Consider GST implications, RBI fintech regulations if applicable, data protection laws, and market entry barriers for ${industry || 'this sector'} in India.`,
            `Customer pain points and behaviors: What frustrations do ${targetAudience} currently experience that this product addresses? How do they currently solve this problem?`,
        ];

        console.log(`📦 [ZEP] Ingesting ${chunks.length} semantic chunks...`);
        for (const chunk of chunks) {
            try {
                await client.graph.add({
                    userId: userId,
                    data: chunk,
                    type: 'text',
                });
            } catch (chunkErr) {
                console.warn('⚠️ [ZEP] Chunk ingestion failed (non-fatal):', chunkErr.message);
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        console.log(`✅ [ZEP] All chunks ingested for user: ${userId}`);

        // ── 4. Poll for graph readiness (up to 8s) ─────────────────────
        let graphReady = false;
        for (let i = 0; i < 4; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
                const checkResult = await client.graph.search({
                    query: idea.substring(0, 50),
                    limit: 1,
                    userId: userId,
                });
                if (checkResult?.edges?.length > 0 || checkResult?.nodes?.length > 0) {
                    graphReady = true;
                    console.log(`✅ [ZEP] Graph populated after ${(i + 1) * 2}s`);
                    break;
                }
            } catch (e) {
                /* continue waiting */
            }
        }
        if (!graphReady) {
            console.warn('⚠️ [ZEP] Graph may not be fully populated yet, proceeding with search...');
        }

        // ── 5. UPGRADE 3 — Multi-dimensional retrieval ─────────────────
        const searchQueries = [
            { key: 'competitors', query: `competitors and alternative products to ${idea} in India` },
            { key: 'risks', query: `market risks regulations barriers challenges for ${industry} in India` },
            { key: 'trends', query: `market trends consumer behavior ${targetAudience} India 2024 2025` },
            { key: 'painPoints', query: `customer pain points problems frustrations ${targetAudience} currently face` },
            { key: 'segments', query: `customer segments demographics profiles who would use ${idea}` },
            { key: 'pricing', query: `pricing willingness to pay price sensitivity ${targetAudience} India` },
        ];

        console.log(`🔍 [ZEP] Running ${searchQueries.length} multi-dimensional searches...`);
        const searchResults = await Promise.allSettled(
            searchQueries.map(({ query }) =>
                client.graph.search({ query, limit: 8, userId: userId })
            )
        );

        // ── 6. Build context object ────────────────────────────────────

        // Generate structured ontology via Groq (for /context page rendering + fallback when Zep is rate-limited)
        let ontologyData = { competitors: [], risks: [], trends: [], painPoints: [], customerSegments: [], pricingInsights: [] };
        try {
            const ontologySystemPrompt = `
You are an elite startup consultant and market researcher specializing in the Indian market.
Your job is to generate a comprehensive Market Ontology (Knowledge Graph) for a new startup idea.
Be extremely specific. Do not use generic terms like "Other apps". Name actual competitors (Direct and Indirect), specific Indian regulations (e.g., FSSAI, RBI, TRAI), and distinct cultural/macro trends.

RESPONSE FORMAT (JSON):
{
  "competitors": [
    { "name": "Exact Brand Name", "type": "Direct or Indirect", "threatLevel": "High/Medium/Low", "description": "1 sentence why they are a threat" }
  ],
  "risks": [
    { "category": "Regulatory|Operational|Cultural", "name": "Specific Risk", "impact": "High/Medium/Low", "description": "1 sentence description" }
  ],
  "trends": [
    { "name": "Specific behavioral shift in India", "direction": "Growing/Declining", "description": "1 sentence explanation" }
  ],
  "painPoints": [
    { "name": "Specific frustration or problem", "severity": "High/Medium/Low", "description": "1 sentence about how this pain point affects the target audience" }
  ],
  "customerSegments": [
    { "name": "Distinct customer group", "size": "Large/Medium/Niche", "description": "1 sentence about who they are and why they would use this product" }
  ],
  "pricingInsights": [
    { "name": "Pricing strategy or insight", "direction": "Opportunity/Barrier", "description": "1 sentence about pricing expectations or willingness to pay" }
  ]
}
`;
            const ontologyUserPrompt = `
Startup Idea: ${idea}
Target Audience: ${targetAudience}
Industry: ${industry || 'Unknown'}
Business Model: ${businessModel || 'Unknown'}

Generate the specific JSON ontology for this concept in the Indian market context. Ensure you identify at least 3 competitors, 3 risks, 3 trends, 3 pain points, 3 customer segments, and 2 pricing insights.
`;
            const groqResult = await generateAIResponse(ontologySystemPrompt, ontologyUserPrompt, 0.3);
            if (groqResult && Array.isArray(groqResult.competitors)) {
                ontologyData = {
                    competitors: groqResult.competitors || [],
                    risks: groqResult.risks || [],
                    trends: groqResult.trends || [],
                    painPoints: groqResult.painPoints || [],
                    customerSegments: groqResult.customerSegments || [],
                    pricingInsights: groqResult.pricingInsights || [],
                };
            }
        } catch (groqErr) {
            console.warn('⚠️ [ONTOLOGY] Groq ontology generation failed (non-fatal):', groqErr.message);
        }

        // Use Zep search results when available, fall back to Groq ontology names
        const zepCompetitors = extractEdges(searchResults[0]);
        const zepRisks = extractEdges(searchResults[1]);
        const zepTrends = extractEdges(searchResults[2]);
        const zepPainPoints = extractEdges(searchResults[3]);
        const zepSegments = extractEdges(searchResults[4]);
        const zepPricing = extractEdges(searchResults[5]);

        const context = {
            graphId: userId,
            // Backward-compatible flat string arrays — prefer Zep edges, fallback to Groq names
            competitors: zepCompetitors.length > 0 ? zepCompetitors : ontologyData.competitors.map(c => c.name),
            risks: zepRisks.length > 0 ? zepRisks : ontologyData.risks.map(r => r.name),
            trends: zepTrends.length > 0 ? zepTrends : ontologyData.trends.map(t => t.name),
            // New dimensions — prefer Zep edges, fallback to Groq names
            painPoints: zepPainPoints.length > 0 ? zepPainPoints : ontologyData.painPoints.map(p => p.name),
            customerSegments: zepSegments.length > 0 ? zepSegments : ontologyData.customerSegments.map(s => s.name),
            pricingInsights: zepPricing.length > 0 ? zepPricing : ontologyData.pricingInsights.map(p => p.name),
            // Typed entity nodes
            entities: {
                competitors: extractNodes(searchResults[0]),
                segments: extractNodes(searchResults[4]),
                risks: extractNodes(searchResults[1]),
            },
            // Flat groqContext string for backward compatibility
            groqContext: [
                `COMPETITORS: ${(zepCompetitors.length > 0 ? zepCompetitors : ontologyData.competitors.map(c => c.name)).join('. ')}`,
                `RISKS: ${(zepRisks.length > 0 ? zepRisks : ontologyData.risks.map(r => r.name)).join('. ')}`,
                `TRENDS: ${(zepTrends.length > 0 ? zepTrends : ontologyData.trends.map(t => t.name)).join('. ')}`,
                `PAIN POINTS: ${(zepPainPoints.length > 0 ? zepPainPoints : ontologyData.painPoints.map(p => p.name)).join('. ')}`,
                `PRICING SIGNALS: ${(zepPricing.length > 0 ? zepPricing : ontologyData.pricingInsights.map(p => p.name)).join('. ')}`,
            ]
                .filter(Boolean)
                .join('\n'),
            extractedAt: new Date().toISOString(),
            // Structured ontology for /context page rendering (Competitors Grid, Risks, Trends)
            ontology: ontologyData,
        };

        graphCache.set(cacheKey, context);
        console.log('✅ [ZEP] Multi-dimensional market context ready');

        return context;
    } catch (err) {
        console.error('⚠️ [ZEP] Fatal error in buildIdeaContext:', err.message);
        return null; // Graceful fallback
    }
}

// ─── UPGRADE 4 — Simulation Activity Write-Back ────────────────────────────

/**
 * Write every persona's behavioral journey back into the Zep graph
 * as natural language facts after a simulation completes.
 */
async function writeSimulationActivityToGraph(graphId, simulationResult) {
    const client = getZepClient();
    if (!client) return;

    const { personaFinalStates, weeklySnapshots, finalReport } = simulationResult;

    if (!personaFinalStates) return;

    const activityTexts = [];

    // Write each persona's behavioral journey
    for (const [pid, state] of Object.entries(personaFinalStates)) {
        const name = state.name || `Persona ${pid}`;
        const segment = state.segmentName || 'Unknown Segment';
        const adoption = state.adoptionStyle || 'Unknown';

        const lines = [`${name} (${adoption}, ${segment}):`];

        if (state.converted) {
            lines.push(`${name} converted and would likely try or buy the product.`);
        } else if (state.churned) {
            lines.push(`${name} lost interest and churned after ${state.exposureCount} exposures.`);
        } else {
            lines.push(
                `${name} remained undecided after ${state.exposureCount} exposures with sentiment score ${state.sentimentScore?.toFixed(2)}.`
            );
        }

        if (state.heardFromPeers) {
            lines.push(`${name} heard about the product from peers in their segment.`);
        }

        if (state.keyExperiences?.length > 0) {
            state.keyExperiences.slice(0, 3).forEach(exp => {
                lines.push(`${name}: ${exp}`);
            });
        }

        activityTexts.push(lines.join(' '));
    }

    // Write final report findings
    if (finalReport) {
        activityTexts.push(
            `Simulation final verdict: ${finalReport.finalVerdict}. ${finalReport.adoptionTrajectory}`
        );
        if (finalReport.launchRecommendations?.length > 0) {
            activityTexts.push(
                `Key launch recommendations: ${finalReport.launchRecommendations.slice(0, 3).join('. ')}`
            );
        }
    }

    // Write weekly adoption curve
    if (weeklySnapshots?.length > 0) {
        const lastSnapshot = weeklySnapshots[weeklySnapshots.length - 1];
        const firstSnapshot = weeklySnapshots[1]; // skip week 0 baseline
        if (firstSnapshot && lastSnapshot) {
            const startPct = (firstSnapshot.overallAdoptionCurve * 100).toFixed(1);
            const endPct = (lastSnapshot.overallAdoptionCurve * 100).toFixed(1);
            activityTexts.push(
                `Overall adoption grew from ${startPct}% in week 1 to ${endPct}% by week ${lastSnapshot.week}.`
            );
        }
    }

    // Send in batches of 5 with 300ms delay between batches
    for (let i = 0; i < activityTexts.length; i += 5) {
        const batch = activityTexts.slice(i, i + 5);
        const batchText = batch.join('\n');
        try {
            await client.graph.add({
                userId: graphId,
                data: batchText,
                type: 'text',
            });
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err) {
            console.warn(`[ZEP WRITEBACK] Batch ${i / 5 + 1} failed:`, err.message);
        }
    }

    console.log(`✅ [ZEP WRITEBACK] Wrote ${activityTexts.length} activity facts to graph ${graphId}`);
}

// ─── Existing helpers (unchanged) ───────────────────────────────────────────

/**
 * Add a simulation event to the graph
 */
async function addSimulationEvent(graphId, event) {
    const client = getZepClient();
    if (!client || !graphId) return;

    try {
        const textData = `Week ${event.week}: ${event.personaName} (${event.segmentName}) performed action ${event.action}. ${event.description}. Sentiment change: ${event.sentimentDelta}. Current sentiment: ${event.sentiment}`;
        await client.graph.add({
            userId: graphId,
            data: textData,
            type: 'text',
        });
    } catch (err) {
        console.warn('⚠️ [ZEP] Failed to add simulation event:', err.message);
    }
}

/**
 * Search the simulation graph
 */
async function searchSimulationGraph(graphId, queryText, limit = 5) {
    const client = getZepClient();
    if (!client || !graphId) return [];

    try {
        const result = await client.graph.search({
            userId: graphId,
            query: queryText,
            limit: limit,
        });

        return (result?.edges || result?.results || [])
            .map(e => e.fact || e.content || e.summary || '')
            .filter(Boolean);
    } catch (err) {
        console.warn('⚠️ [ZEP] Graph search failed:', err.message);
        return [];
    }
}

/**
 * Get summary of the graph (all facts)
 */
async function getGraphSummary(graphId) {
    const client = getZepClient();
    if (!client || !graphId) return [];

    try {
        const result = await client.graph.search({
            userId: graphId,
            query: 'key events, trends, and outcomes from the simulation',
            limit: 10,
        });

        return (result?.edges || result?.results || [])
            .map(e => e.fact || e.content || e.summary || '')
            .filter(Boolean);
    } catch (err) {
        console.warn('⚠️ [ZEP] Graph summary failed:', err.message);
        return [];
    }
}

module.exports = {
    buildIdeaContext,
    writeSimulationActivityToGraph,
    addSimulationEvent,
    searchSimulationGraph,
    getGraphSummary,
};