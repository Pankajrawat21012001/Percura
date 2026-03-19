/**
 * Zep Market Context Service
 * Builds a knowledge graph from founder's idea and extracts
 * market entities: competitors, risks, trends, regulations
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

const { generateAIResponse } = require('./groqClient');

/**
 * Build a Zep graph from the idea and extract market context
 * Returns structured context to inject into Groq prompts AND render on the frontend
 */
async function buildIdeaContext(idea, targetAudience, industry, businessModel) {
    const cacheKey = `${idea}::${industry}::${targetAudience}`;
    if (graphCache.has(cacheKey)) {
        console.log('⚡ [ZEP] Using cached market context.');
        return graphCache.get(cacheKey);
    }

    try {
        console.log('🧠 [ONTOLOGY] Generating deep market ontology via Groq...');

        // 1. Ask Groq to generate a highly detailed, MiroFish-style market ontology
        const systemPrompt = `
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
  ]
}
`;
        const userPrompt = `
Startup Idea: ${idea}
Target Audience: ${targetAudience}
Industry: ${industry || 'Unknown'}
Business Model: ${businessModel || 'Unknown'}

Generate the specific JSON ontology for this concept in the Indian market context. Ensure you identify at least 3 competitors, 3 risks, and 3 trends.
`;

        let ontologyData;
        try {
            ontologyData = await generateAIResponse(systemPrompt, userPrompt, 0.3);
        } catch (groqErr) {
            console.error('⚠️ [ONTOLOGY] Groq extraction failed:', groqErr.message);
            // Fallback empty ontology
            ontologyData = { competitors: [], risks: [], trends: [] };
        }

        // Validate ontology shape
        if (!ontologyData || !Array.isArray(ontologyData.competitors)) {
            ontologyData = { competitors: [], risks: [], trends: [] };
        }

        // 2. Feed this rich extracted knowledge into Zep for memory
        const client = getZepClient();
        const crypto = require('crypto');
        const userId = `percura_${crypto.createHash('md5').update(cacheKey).digest('hex').slice(0, 12)}`;

        if (client) {
            try {
                // Ensure user exists
                try {
                    await client.user.get(userId);
                } catch (userErr) {
                    if (userErr?.body?.message === 'not found' || userErr?.status === 404 || userErr?.message?.includes('404')) {
                        await client.user.add({
                            userId: userId,
                            firstName: 'Percura',
                            lastName: 'Simulation',
                            metadata: { source: 'percura_ontology', idea: idea.slice(0, 100) }
                        });
                    }
                }

                // Add the rich ontology to Zep Graph
                const zepText = `
Startup Idea: ${idea}
Competitors Identified: ${ontologyData.competitors.map(c => `${c.name} (${c.type}): ${c.description}`).join(' | ')}
Market Risks: ${ontologyData.risks.map(r => `${r.name} (${r.category}): ${r.description}`).join(' | ')}
Macro Trends: ${ontologyData.trends.map(t => `${t.name}: ${t.description}`).join(' | ')}
                `.trim();

                await client.graph.add({
                    userId: userId,
                    data: zepText,
                    type: 'text',
                });
                console.log(`✅ [ZEP] Rich ontology ingested for user: ${userId}`);
            } catch (zepErr) {
                console.error('⚠️ [ZEP] Ingestion failed (non-fatal):', zepErr.message);
            }
        }

        // 3. Construct and return context object
        const context = {
            graphId: userId,
            ontology: ontologyData, // Rich structured data for the frontend graph
            // Legacy flat arrays for older integrations
            competitors: ontologyData.competitors.map(c => c.name),
            risks: ontologyData.risks.map(r => r.name),
            trends: ontologyData.trends.map(t => t.name),
            // Flattened string for subsequent Groq prompt injection
            groqContext: `
COMPETITORS: ${ontologyData.competitors.map(c => c.name).join(', ')}
MARKET RISKS: ${ontologyData.risks.map(r => r.name).join(', ')}
TRENDS: ${ontologyData.trends.map(t => t.name).join(', ')}
            `.trim(),
            extractedAt: new Date().toISOString(),
        };

        graphCache.set(cacheKey, context);
        console.log('✅ [ONTOLOGY] Market context ready');

        return context;

    } catch (err) {
        console.error('⚠️ [ONTOLOGY] Fatal error:', err.message);
        return null; // Graceful fallback
    }
}

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
            type: 'text'
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
            limit: limit
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
            query: "key events, trends, and outcomes from the simulation",
            limit: 10
        });
        
        return (result?.edges || result?.results || [])
            .map(e => e.fact || e.content || e.summary || '')
            .filter(Boolean);
    } catch (err) {
        console.warn('⚠️ [ZEP] Graph summary failed:', err.message);
        return [];
    }
}

module.exports = { buildIdeaContext, addSimulationEvent, searchSimulationGraph, getGraphSummary };