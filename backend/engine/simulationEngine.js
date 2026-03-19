/**
 * Time-Step Simulation Engine
 * 
 * Runs a week-by-week behavioral simulation for enriched personas
 * against a startup idea. Each persona discovers, reacts, gets influenced
 * by peers, and may convert or churn — all driven by LLM-powered reactions.
 */

const { generateAIResponse } = require('./groqService');
const { generateIntelligentReport } = require('./reportAgent');
const { buildIdeaContext, addSimulationEvent } = require('./zepService');
const { generateSimulationConfig } = require('./configGenerator');
const { runSocialSimulation } = require('./socialSimEngine');

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 200;

/**
 * Run the full week-by-week simulation.
 * @param {Object} idea - The startup idea object
 * @param {Array} segments - Segments with enriched personas
 * @param {Object} options - { weeks, weeklyEventCallback }
 * @returns {Object} Full simulation result
 */
async function runSimulation(idea, segments, options = {}) {
    const weeks = options.weeks || 8;
    const weeklyEventCallback = options.weeklyEventCallback || null;
    const ideaText = idea?.idea || 'a new product';
    const ideaTargetAudience = idea?.targetAudience || 'Indian consumers';
    const ideaIndustry = idea?.industry || 'General';
    const ideaBusinessModel = idea?.businessModel || 'Not specified';

    let graphId = null;
    try {
        const graphCtx = await buildIdeaContext(ideaText, ideaTargetAudience, ideaIndustry, ideaBusinessModel);
        if (graphCtx && graphCtx.graphId) {
            graphId = graphCtx.graphId;
        }
    } catch (err) {
        console.warn('⚠️ [SIM] Failed to get Zep graph context:', err.message);
    }

    const config = await generateSimulationConfig(ideaText, ideaIndustry, ideaTargetAudience);

    // Keep the original pull constant
    const PEER_SENTIMENT_PULL = 0.20;

    console.log(`🚀 [SIM] Starting ${weeks}-week simulation across ${segments.length} segments`);

    // Initialize persona states — deep copy to avoid mutating originals
    const personaStates = {};
    for (const segment of segments) {
        for (const persona of (segment.personas || [])) {
            const pid = persona.persona_id || persona.id;
            const ep = persona.enrichedProfile || {};
            const ms = ep.memoryState || {};

            personaStates[pid] = {
                personaId: pid,
                segmentId: segment.segment_id,
                segmentName: segment.segment_name,
                name: ep.fullName || persona.metadata?.name || `Persona ${pid}`,
                adoptionStyle: ep.behaviorPatterns?.adoptionStyle || 'Early Majority',
                internalNarrative: ep.internalNarrative || '',
                communicationStyle: ep.behaviorPatterns?.communicationStyle || 'Casual',
                sentimentScore: ms.sentimentScore !== undefined ? ms.sentimentScore : 0.5,
                exposureCount: ms.exposureCount || 0,
                keyExperiences: [...(ms.keyExperiences || [])],
                heardFromPeers: ms.heardFromPeers || false,
                triedProduct: ms.triedProduct || false,
                converted: false,
                churned: false,
            };
        }
    }

    const weeklySnapshots = [];
    const allEvents = [];

    // Add seed events for Week 0
    (config.seedEvents || []).forEach((evt, idx) => {
        allEvents.push({
            id: `evt_seed_${idx}`,
            week: 0,
            action: 'MARKET_EVENT',
            personaName: 'Market',
            segmentName: 'Global',
            description: evt,
            sentiment: 0.5,
            sentimentDelta: 0
        });
    });

    // ── Week 0: Baseline ──
    weeklySnapshots.push(buildSnapshot(0, segments, personaStates));

    // ── Weeks 1 through N ──
    for (let week = 1; week <= weeks; week++) {
        console.log(`📅 [SIM] === Week ${week}/${weeks} ===`);

        // Define an array to collect events for Zep
        const weekEvents = [];

        // Step 1: Organic Discovery (with batched LLM calls)
        const discoveryBatch = [];
        for (const pid of Object.keys(personaStates)) {
            const ps = personaStates[pid];
            if (ps.churned || ps.converted) continue;

            const discoveryRate = config.discoveryRates[ps.adoptionStyle] || 0.10;
            if (Math.random() < discoveryRate) {
                discoveryBatch.push(pid);
            }
        }

        // Process discoveries in batches of BATCH_SIZE
        for (let i = 0; i < discoveryBatch.length; i += BATCH_SIZE) {
            const batch = discoveryBatch.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(pid => processDiscovery(pid, personaStates[pid], ideaText, week));
            const batchResults = await Promise.allSettled(batchPromises);

            for (let j = 0; j < batchResults.length; j++) {
                if (batchResults[j].status === 'fulfilled' && batchResults[j].value) {
                    const { sentimentDelta, experience } = batchResults[j].value;
                    const pid = batch[j];
                    const ps = personaStates[pid];
                    ps.exposureCount += 1;
                    ps.sentimentScore = clamp(ps.sentimentScore + sentimentDelta, 0, 1);
                    ps.keyExperiences.push(`Week ${week}: ${experience}`);
                    
                    weekEvents.push({
                        week, action: 'DISCOVERY', personaName: ps.name, segmentName: ps.segmentName,
                        description: experience, sentimentDelta: sentimentDelta.toFixed(2), sentiment: ps.sentimentScore.toFixed(2)
                    });
                }
            }

            if (i + BATCH_SIZE < discoveryBatch.length) {
                await delay(BATCH_DELAY_MS);
            }
        }

        // Step 2: Peer Influence
        for (const segment of segments) {
            const segPersonaIds = (segment.personas || []).map(p => p.persona_id || p.id);
            const segStates = segPersonaIds.map(id => personaStates[id]).filter(Boolean);
            const activeStates = segStates.filter(s => !s.churned);

            if (activeStates.length === 0) continue;

            const segAvgSentiment = activeStates.reduce((sum, s) => sum + s.sentimentScore, 0) / activeStates.length;
            const hasAdvocate = activeStates.some(s => s.sentimentScore > 0.65);

            for (const ps of activeStates) {
                if (ps.heardFromPeers || ps.converted) continue;
                if (!hasAdvocate) continue;

                if (Math.random() < config.peerInfluenceChance) {
                    ps.heardFromPeers = true;
                    ps.exposureCount += 1;
                    // Nudge toward segment average
                    const nudge = (segAvgSentiment - ps.sentimentScore) * PEER_SENTIMENT_PULL;
                    ps.sentimentScore = clamp(ps.sentimentScore + nudge, 0, 1);
                    ps.keyExperiences.push(`Week ${week}: Heard about it from a colleague/friend`);
                    
                    weekEvents.push({
                        week, action: 'PEER_INFLUENCE', personaName: ps.name, segmentName: ps.segmentName,
                        description: 'Heard about the product from a colleague/friend', sentimentDelta: nudge.toFixed(2), sentiment: ps.sentimentScore.toFixed(2)
                    });
                }
            }
        }

        // Step 3: Churn Check
        for (const pid of Object.keys(personaStates)) {
            const ps = personaStates[pid];
            if (ps.churned || ps.converted) continue;
            if (ps.exposureCount >= 2 && ps.sentimentScore < config.churnThreshold) {
                ps.churned = true;
                ps.keyExperiences.push(`Week ${week}: Lost interest — churned`);
                
                weekEvents.push({
                    week, action: 'CHURN', personaName: ps.name, segmentName: ps.segmentName,
                    description: 'Lost interest and churned', sentimentDelta: 0, sentiment: ps.sentimentScore.toFixed(2)
                });
            }
        }

        // Step 4: Conversion Check
        for (const pid of Object.keys(personaStates)) {
            const ps = personaStates[pid];
            if (ps.churned || ps.converted) continue;
            if (ps.sentimentScore >= config.conversionThreshold) {
                ps.converted = true;
                ps.keyExperiences.push(`Week ${week}: Converted — would try/buy`);
                
                weekEvents.push({
                    week, action: 'CONVERSION', personaName: ps.name, segmentName: ps.segmentName,
                    description: 'Converted and would try/buy the product', sentimentDelta: 0, sentiment: ps.sentimentScore.toFixed(2)
                });
            }
        }
        
        // Push events to Zep Graph asynchronously
        if (graphId && weekEvents.length > 0) {
            weekEvents.forEach(evt => addSimulationEvent(graphId, evt));
        }

        allEvents.push(...weekEvents);

        // Build weekly snapshot
        const snapshot = buildSnapshot(week, segments, personaStates);
        weeklySnapshots.push(snapshot);

        if (weeklyEventCallback) {
            try { weeklyEventCallback(snapshot); } catch (e) { /* ignore callback errors */ }
        }

        console.log(`  📊 Week ${week} complete — adoption curve: ${(snapshot.overallAdoptionCurve * 100).toFixed(1)}%`);
    }

    // ── Run Social Platform Simulation ──
    try {
        const socialEvents = await runSocialSimulation(segments, idea, config, weeks, graphId);
        allEvents.push(...socialEvents);
    } catch (e) {
        console.warn(`⚠️ [SIM] Social simulation failed:`, e.message);
    }

    // ── Generate Final Report via Groq ──
    console.log(`🧠 [SIM] Generating final analysis report...`);
    const finalReport = await generateIntelligentReport(idea, weeklySnapshots, segments, graphId);

    const simulationResult = {
        id: `sim_${Date.now()}`,
        idea,
        weeks,
        weeklySnapshots,
        allEvents,
        finalReport,
        personaFinalStates: personaStates,
        completedAt: new Date().toISOString()
    };

    console.log(`✅ [SIM] Simulation complete: ${simulationResult.id}`);
    return simulationResult;
}

/**
 * Call Groq to determine sentiment change for a persona discovering the product.
 */
async function processDiscovery(pid, personaState, ideaText, week) {
    const systemPrompt = `You are simulating a real Indian consumer's reaction to discovering a new product.

Given the persona's internal narrative and current sentiment, determine how their feeling changes after encountering the product this week.

RESPONSE FORMAT (JSON only):
{
  "sentimentDelta": number between -0.3 and +0.3,
  "experience": "One sentence describing what happened to them this week"
}

RULES:
- sentimentDelta should be positive if the product aligns with their needs, negative if it creates friction.
- The experience should be concrete and specific (e.g. "Saw an ad on Instagram", "A friend mentioned it at work").
- Keep experience to one short sentence.`;

    const userPrompt = `PERSONA: ${personaState.name}
ADOPTION STYLE: ${personaState.adoptionStyle}
CURRENT SENTIMENT: ${personaState.sentimentScore.toFixed(2)}
EXPOSURE COUNT: ${personaState.exposureCount}
INTERNAL NARRATIVE (abbreviated): ${(personaState.internalNarrative || '').substring(0, 300)}

PRODUCT IDEA: "${ideaText}"

WEEK: ${week}

How does this person react to discovering/encountering the product this week?`;

    try {
        const result = await generateAIResponse(systemPrompt, userPrompt, 0.5);
        if (!result) return { sentimentDelta: 0, experience: 'Noticed the product briefly but had no strong reaction.' };

        return {
            sentimentDelta: clamp(parseFloat(result.sentimentDelta) || 0, -0.3, 0.3),
            experience: result.experience || 'Encountered the product this week.'
        };
    } catch (err) {
        console.warn(`⚠️ [SIM] Discovery LLM failed for ${pid}:`, err.message);
        return { sentimentDelta: 0, experience: 'Had a brief, unremarkable encounter with the product.' };
    }
}

/**
 * Build a weekly snapshot from current persona states.
 */
function buildSnapshot(week, segments, personaStates) {
    const segmentSnapshots = segments.map(segment => {
        const segPersonaIds = (segment.personas || []).map(p => p.persona_id || p.id);
        const segStates = segPersonaIds.map(id => personaStates[id]).filter(Boolean);

        const convertedCount = segStates.filter(s => s.converted).length;
        const churnedCount = segStates.filter(s => s.churned).length;
        const activeCount = segStates.filter(s => !s.churned && !s.converted).length;
        const avgSentiment = segStates.length > 0
            ? parseFloat((segStates.reduce((sum, s) => sum + s.sentimentScore, 0) / segStates.length).toFixed(3))
            : 0.5;

        const newExperiences = segStates
            .flatMap(s => s.keyExperiences.filter(e => e.startsWith(`Week ${week}:`)))
            .slice(0, 5);

        return {
            segmentName: segment.segment_name,
            segmentId: segment.segment_id,
            avgSentiment,
            convertedCount,
            churnedCount,
            activeCount,
            totalPersonas: segStates.length,
            newExperiences
        };
    });

    const allStates = Object.values(personaStates);
    const totalConverted = allStates.filter(s => s.converted).length;
    const overallAdoptionCurve = allStates.length > 0
        ? parseFloat((totalConverted / allStates.length).toFixed(3))
        : 0;

    return {
        week,
        segmentSnapshots,
        overallAdoptionCurve
    };
}

/**
 * Generate a comprehensive final report using Groq.
 */
async function generateFinalReport(idea, weeklySnapshots, segments) {
    const ideaText = idea?.idea || 'the product';

    // Build compact summary of snapshots for the prompt
    const snapshotSummary = weeklySnapshots.map(s => ({
        week: s.week,
        adoptionCurve: s.overallAdoptionCurve,
        segments: s.segmentSnapshots.map(ss => ({
            name: ss.segmentName,
            avgSentiment: ss.avgSentiment,
            converted: ss.convertedCount,
            churned: ss.churnedCount,
            active: ss.activeCount
        }))
    }));

    const systemPrompt = `You are a market research analyst generating a final report from a multi-week behavioral simulation.

RESPONSE FORMAT (JSON only):
{
  "finalVerdict": "One of: Strong Launch Signal, Niche Opportunity, Pivot Required, Premature Market",
  "adoptionTrajectory": "Accelerating, Plateauing, or Declining — with one sentence of evidence",
  "segmentRanking": [
    { "segmentName": "...", "rank": 1, "reasoning": "..." }
  ],
  "keyTurningPoints": [
    { "week": 3, "event": "Description of what happened" }
  ],
  "launchRecommendations": [
    "Specific actionable recommendation #1",
    "Specific actionable recommendation #2",
    "Specific actionable recommendation #3"
  ]
}

RULES:
- Be specific. Reference actual segment names, week numbers, and conversion rates.
- Do NOT say "based on the data" or any filler phrases.
- launchRecommendations must be concrete steps, not generic advice.`;

    const userPrompt = `STARTUP IDEA: "${ideaText}"
INDUSTRY: ${idea?.industry || 'General'}
TARGET AUDIENCE: ${idea?.targetAudience || 'Indian consumers'}

WEEKLY SIMULATION DATA:
${JSON.stringify(snapshotSummary, null, 2)}`;

    try {
        const result = await generateAIResponse(systemPrompt, userPrompt, 0.4);
        if (!result) throw new Error('Final report LLM returned null');

        return {
            finalVerdict: result.finalVerdict || 'Niche Opportunity',
            adoptionTrajectory: result.adoptionTrajectory || 'Plateauing',
            segmentRanking: result.segmentRanking || [],
            keyTurningPoints: result.keyTurningPoints || [],
            launchRecommendations: result.launchRecommendations || ['Gather more user feedback', 'Test pricing models', 'Build an MVP']
        };
    } catch (err) {
        console.error('❌ [SIM] Final report generation failed:', err.message);
        return {
            finalVerdict: 'Niche Opportunity',
            adoptionTrajectory: 'Data insufficient for trajectory analysis',
            segmentRanking: [],
            keyTurningPoints: [],
            launchRecommendations: ['Run a longer simulation for more data', 'Focus on highest-converting segment', 'Validate pricing with real users']
        };
    }
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { runSimulation };
