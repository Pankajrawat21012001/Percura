const express = require('express');
const router = express.Router();
const { generateTextResponse } = require('../engine/groqService');
const { searchSimulationGraph } = require('../engine/zepService');

/**
 * POST /api/report-chat
 * Ask the AI Analyst questions about the simulation data.
 * The AI queries Zep for evidence and responds.
 */
router.post('/', async (req, res) => {
    try {
        const { message, chatHistory, graphId, simulationResult } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        console.log(`🤖 [ANALYST] Received question: "${message.substring(0, 50)}..."`);

        // Search the Zep graph for relevant evidence
        let zepEvidence = [];
        if (graphId) {
            console.log(`🔗 [ANALYST] Searching graph ${graphId} for evidence...`);
            zepEvidence = await searchSimulationGraph(graphId, message, 5);
        }

        // Build simulation data fallback context
        let simContext = '';
        if (simulationResult) {
            const snapshots = simulationResult.weeklySnapshots || [];
            const finalSnap = snapshots[snapshots.length - 1];
            simContext = `\nSIMULATION STATS:\n- Total personas: ${simulationResult.personaFinalStates ? Object.keys(simulationResult.personaFinalStates).length : 'unknown'}\n- Weeks simulated: ${simulationResult.weeks || 'unknown'}\n- Final converted: ${finalSnap?.totalConverted || 0}\n- Final churned: ${finalSnap?.totalChurned || 0}\n- Final active: ${finalSnap?.totalActive || 0}\n`;
            
            // Add weekly adoption curve
            if (snapshots.length > 0) {
                simContext += '\nWEEKLY ADOPTION:\n' + snapshots.map(s => 
                    `  Week ${s.week}: ${((s.overallAdoptionCurve || 0) * 100).toFixed(1)}% adoption`
                ).join('\n');
            }
        }

        const systemPrompt = `You are an expert Data Analyst and Market Researcher for the Indian market.
You analyze behavioral simulation data and answer user questions with precision.
Always cite specific data points from the evidence provided (e.g. "Based on Week 3 data..." or "According to the simulation, 4 out of 10 personas...").
Be analytical, concise, and directly address the question. No pleasantries.
If the evidence doesn't answer the question, say so honestly and suggest what related data IS available.`;

        const evidenceString = zepEvidence.length > 0 
            ? zepEvidence.map((e, idx) => `${idx + 1}. ${e}`).join('\n')
            : 'No direct evidence found in the simulation graph for this query.';

        const formattedHistory = (chatHistory || []).map(msg => `${msg.sender === 'user' ? 'USER' : 'ANALYST'}: ${msg.text}`).join('\n\n');

        const userPrompt = `SIMULATION IDEA:
${simulationResult?.idea?.idea || 'Unknown product'}
${simContext}

GRAPH EVIDENCE:
${evidenceString}

CHAT HISTORY:
${formattedHistory}

USER QUESTION:
${message}
`;

        const analystReply = await generateTextResponse(systemPrompt, userPrompt, 0.5) 
            || "I am unable to answer that right now. The simulation data may not contain enough information about this topic.";

        res.json({
            success: true,
            reply: analystReply,
            evidenceUsed: zepEvidence
        });

    } catch (error) {
        console.error('[ANALYST ERROR]', error.message);
        res.status(500).json({
            success: false,
            error: 'AI Analyst failed to generate a response.',
            reply: "I encountered an error analyzing the simulation data. Please try again."
        });
    }
});

module.exports = router;
