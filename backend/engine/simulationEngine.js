/**
 * Time-Step Simulation Engine
 * 
 * Runs a week-by-week behavioral simulation for enriched personas
 * against a startup idea. Each persona discovers, reacts, gets influenced
 * by peers, and may convert or churn — all driven by LLM-powered reactions.
 */

const { generateAIResponse } = require('./groqService');

// Discovery probability by adoption style (per week)
const DISCOVERY_RATES = {
    'Innovator': 0.40,
    'Early Adopter': 0.25,
    'Early Majority': 0.10,
    'Late Majority': 0.05,
    'Laggard': 0.02
};

const PEER_INFLUENCE_CHANCE = 0.30;  // 30% chance of hearing from a peer
const PEER_SENTIMENT_PULL = 0.20;     // Moves 20% toward segment average
const CHURN_THRESHOLD = 0.30;
const CONVERSION_THRESHOLD = 0.65;    // Lowered from 0.72 for small pools
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
    const allEvents = []; // Per-persona timeline events across all weeks

    // ── Week 0: Baseline ──
    weeklySnapshots.push(buildSnapshot(0, segments, personaStates));

    // Scale discovery rates up when persona pool is small
    const totalPersonas = Object.keys(personaStates).length;
    const discoveryMultiplier = totalPersonas < 10 ? 3.0 : totalPersonas < 20 ? 2.0 : 1.0;
    console.log(`📊 [SIM] Pool size: ${totalPersonas} personas, discovery multiplier: ${discoveryMultiplier}x`);

    // ── Weeks 1 through N ──
    for (let week = 1; week <= weeks; week++) {
        console.log(`📅 [SIM] === Week ${week}/${weeks} ===`);
        const weekEvents = [];

        // Step 1: Organic Discovery (with batched LLM calls)
        const discoveryBatch = [];
        const activePids = Object.keys(personaStates).filter(pid => {
            const ps = personaStates[pid];
            return !ps.churned && !ps.converted;
        });

        for (const pid of activePids) {
            const ps = personaStates[pid];
            const baseRate = DISCOVERY_RATES[ps.adoptionStyle] || 0.10;
            const scaledRate = Math.min(0.85, baseRate * discoveryMultiplier);
            if (Math.random() < scaledRate) {
                discoveryBatch.push(pid);
            }
        }

        // Guarantee at least 1 discovery per week if there are active personas
        if (discoveryBatch.length === 0 && activePids.length > 0) {
            const randomPid = activePids[Math.floor(Math.random() * activePids.length)];
            discoveryBatch.push(randomPid);
        }

        console.log(`  🔍 Discoveries this week: ${discoveryBatch.length}/${activePids.length} active`);

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
                    const effectiveDelta = sentimentDelta === 0 ? 0.04 : sentimentDelta;
                    ps.sentimentScore = clamp(ps.sentimentScore + effectiveDelta, 0, 1);
                    ps.keyExperiences.push(`Week ${week}: ${experience}`);

                    // Emit timeline event
                    weekEvents.push({
                        id: `evt_${week}_disc_${pid}`,
                        week,
                        action: 'DISCOVERY',
                        personaId: pid,
                        personaName: ps.name,
                        segmentName: ps.segmentName,
                        description: experience,
                        sentiment: ps.sentimentScore,
                        sentimentDelta: effectiveDelta
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

                if (Math.random() < PEER_INFLUENCE_CHANCE) {
                    ps.heardFromPeers = true;
                    ps.exposureCount += 1;
                    const nudge = (segAvgSentiment - ps.sentimentScore) * PEER_SENTIMENT_PULL;
                    ps.sentimentScore = clamp(ps.sentimentScore + nudge, 0, 1);
                    ps.keyExperiences.push(`Week ${week}: Heard about it from a colleague/friend`);

                    weekEvents.push({
                        id: `evt_${week}_peer_${ps.personaId}`,
                        week,
                        action: 'PEER_INFLUENCE',
                        personaId: ps.personaId,
                        personaName: ps.name,
                        segmentName: ps.segmentName,
                        description: 'Heard about it from a colleague or friend in their network',
                        sentiment: ps.sentimentScore,
                        sentimentDelta: nudge
                    });
                }
            }
        }

        // Step 3: Churn Check
        for (const pid of Object.keys(personaStates)) {
            const ps = personaStates[pid];
            if (ps.churned || ps.converted) continue;
            if (ps.exposureCount >= 2 && ps.sentimentScore < CHURN_THRESHOLD) {
                ps.churned = true;
                ps.keyExperiences.push(`Week ${week}: Lost interest — churned`);

                weekEvents.push({
                    id: `evt_${week}_churn_${pid}`,
                    week,
                    action: 'CHURN',
                    personaId: pid,
                    personaName: ps.name,
                    segmentName: ps.segmentName,
                    description: 'Lost interest and stopped engaging — churned',
                    sentiment: ps.sentimentScore,
                    sentimentDelta: 0
                });
            }
        }

        // Step 4: Conversion Check
        for (const pid of Object.keys(personaStates)) {
            const ps = personaStates[pid];
            if (ps.churned || ps.converted) continue;
            if (ps.sentimentScore >= CONVERSION_THRESHOLD) {
                ps.converted = true;
                ps.keyExperiences.push(`Week ${week}: Converted — would try/buy`);

                weekEvents.push({
                    id: `evt_${week}_convert_${pid}`,
                    week,
                    action: 'CONVERSION',
                    personaId: pid,
                    personaName: ps.name,
                    segmentName: ps.segmentName,
                    description: 'Highly interested — converted and would try/buy the product',
                    sentiment: ps.sentimentScore,
                    sentimentDelta: 0
                });
            }
        }

        // Collect events for this week
        allEvents.push(...weekEvents);

        // Build weekly snapshot
        const snapshot = buildSnapshot(week, segments, personaStates, weekEvents);
        weeklySnapshots.push(snapshot);

        if (weeklyEventCallback) {
            try { weeklyEventCallback(snapshot); } catch (e) { /* ignore callback errors */ }
        }

        console.log(`  📊 Week ${week} complete — adoption curve: ${(snapshot.overallAdoptionCurve * 100).toFixed(1)}%`);
    }

    // ── Generate Final Report via Groq ──
    console.log(`🧠 [SIM] Generating final analysis report...`);
    const finalReport = await generateFinalReport(idea, weeklySnapshots, segments);

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
function buildSnapshot(week, segments, personaStates, weekEvents = []) {
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
    const totalChurned = allStates.filter(s => s.churned).length;
    const overallAdoptionCurve = allStates.length > 0
        ? parseFloat((totalConverted / allStates.length).toFixed(3))
        : 0;

    return {
        week,
        segmentSnapshots,
        overallAdoptionCurve,
        totalConverted,
        totalChurned,
        totalActive: allStates.length - totalConverted - totalChurned,
        events: weekEvents
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
