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

/**
 * Build a Zep graph from the idea and extract market context
 * Returns structured context to inject into Groq prompts
 */
async function buildIdeaContext(idea, targetAudience, industry, businessModel) {
    const client = getZepClient();
    
    // If Zep not configured, return empty context gracefully
    if (!client) {
        console.log('⚠️ [ZEP] ZEP_API_KEY not set — skipping market context enrichment.');
        return null;
    }

    const cacheKey = `${idea}::${industry}::${targetAudience}`;
    if (graphCache.has(cacheKey)) {
        console.log('⚡ [ZEP] Using cached market context.');
        return graphCache.get(cacheKey);
    }

    try {
        console.log('🔗 [ZEP] Building idea knowledge graph...');

        // The text we feed Zep — structured for maximum entity extraction
        const seedText = `
Startup idea: ${idea}

Target audience: ${targetAudience}

Industry: ${industry || 'General'}

Business model: ${businessModel || 'Not specified'}

Indian market context: This product will operate in the Indian market, 
targeting consumers across urban, semi-urban and rural zones. 
Consider relevant Indian regulations, competitor brands, consumer behavior 
patterns, payment infrastructure (UPI, cash), language diversity, and 
socioeconomic factors relevant to this industry.
        `.trim();

        // Generate a deterministic userId from the idea for Zep graph scoping
        const crypto = require('crypto');
        const userId = `percura_${crypto.createHash('md5').update(cacheKey).digest('hex').slice(0, 12)}`;

        // Step 1: Ensure the user exists in Zep (required before any graph operation)
        console.log(`🔗 [ZEP] Ensuring user exists: ${userId}`);
        try {
            await client.user.get(userId);
            console.log(`✅ [ZEP] User already exists: ${userId}`);
        } catch (userErr) {
            // User doesn't exist — create them
            if (userErr?.body?.message === 'not found' || userErr?.status === 404 || userErr?.message?.includes('404')) {
                await client.user.add({
                    userId: userId,
                    firstName: 'Percura',
                    lastName: 'Simulation',
                    metadata: { source: 'percura', idea: idea.slice(0, 100) }
                });
                console.log(`✅ [ZEP] User created: ${userId}`);
            } else {
                throw userErr; // Re-throw unexpected errors
            }
        }

        // Add to Zep graph (Zep auto-extracts entities and relationships)
        console.log(`🔗 [ZEP] Sending data to graph for user: ${userId}`);
        
        await client.graph.add({
            userId: userId,
            data: seedText,
            type: 'text',
        });

        console.log(`✅ [ZEP] Graph data added for: ${userId}`);

        // Wait briefly for Zep to process entities (async extraction)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Search the graph for key market signals
        const searchParams = [
            { query: `competitors and alternative products for ${idea} in India` },
            { query: `risks regulations barriers challenges for ${industry} in India` },
            { query: `market trends consumer behavior ${targetAudience} India` },
        ].map(p => ({
            ...p,
            limit: 5,
            userId: userId,
        }));

        const [competitorResults, riskResults, trendResults] = await Promise.allSettled(
            searchParams.map(params => client.graph.search(params))
        );

        // Extract edges (facts/relationships) from results
        const extractEdges = (result) => {
            if (result.status === 'rejected') {
                console.warn(`⚠️ [ZEP] Search failed:`, result.reason?.message || result.reason);
                return [];
            }
            return (result.value?.edges || result.value?.results || [])
                .map(e => e.fact || e.content || e.summary || '')
                .filter(Boolean)
                .slice(0, 3);
        };

        const competitors = extractEdges(competitorResults);
        const risks = extractEdges(riskResults);
        const trends = extractEdges(trendResults);

        const context = {
            graphId: userId,
            competitors,
            risks,
            trends,
            // Flattened string for Groq prompt injection
            groqContext: [
                competitors.length ? `COMPETITORS/ALTERNATIVES: ${competitors.join('. ')}` : '',
                risks.length ? `MARKET RISKS/REGULATIONS: ${risks.join('. ')}` : '',
                trends.length ? `MARKET TRENDS: ${trends.join('. ')}` : '',
            ].filter(Boolean).join('\n'),
            extractedAt: new Date().toISOString(),
        };

        graphCache.set(cacheKey, context);
        console.log('✅ [ZEP] Market context ready:', JSON.stringify({ competitors: competitors.length, risks: risks.length, trends: trends.length }));

        return context;

    } catch (err) {
        console.error('⚠️ [ZEP] Graph operation failed:', {
            message: err.message,
            status: err.status,
            name: err.name,
            body: err.body
        });
        return null; // Always graceful — never crash the simulation
    }
}

module.exports = { buildIdeaContext };