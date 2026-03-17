const express = require('express');
const router = express.Router();
const { handlePersonaChat } = require('../engine/chatService');

// Import simulation store lookup
let getSimulation;
try {
    getSimulation = require('./simulation').getSimulation;
} catch (e) {
    getSimulation = () => null;
}

/**
 * Route: Audience Dialogue Chat
 * Simulates conversation with personas or segments.
 * Now supports simulationId to inject post-simulation persona states.
 */
router.post('/chat', async (req, res) => {
    try {
        const { simulationId, target, message, history, context } = req.body;
        
        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        console.log(`💬 Chat request for simulation ${simulationId}, target: ${target}`);

        // UPGRADE 4: If simulationId provided, merge final persona states into context
        let enrichedContext = { ...context };
        
        if (simulationId && context?.simulationResults) {
            const sim = getSimulation(simulationId);
            if (sim && sim.personaFinalStates) {
                // Deep-merge final states into simulationResults personas
                const mergedResults = (context.simulationResults || []).map(segment => {
                    const mergedPersonas = (segment.personas || []).map(persona => {
                        const pid = persona.persona_id || persona.id;
                        const finalState = sim.personaFinalStates[pid];
                        
                        if (finalState && persona.enrichedProfile) {
                            // Override the memoryState with the simulation's final state
                            return {
                                ...persona,
                                enrichedProfile: {
                                    ...persona.enrichedProfile,
                                    memoryState: {
                                        exposureCount: finalState.exposureCount,
                                        sentimentScore: finalState.sentimentScore,
                                        keyExperiences: finalState.keyExperiences,
                                        heardFromPeers: finalState.heardFromPeers,
                                        triedProduct: finalState.triedProduct,
                                    }
                                },
                                simulationState: {
                                    converted: finalState.converted,
                                    churned: finalState.churned,
                                    sentimentScore: finalState.sentimentScore,
                                    exposureCount: finalState.exposureCount,
                                }
                            };
                        }
                        return persona;
                    });
                    return { ...segment, personas: mergedPersonas };
                });
                
                enrichedContext = { ...context, simulationResults: mergedResults };
            }
        }

        const reply = await handlePersonaChat(simulationId, target, message, history, enrichedContext);
        
        res.json(reply);
    } catch (error) {
        console.error('[CHAT-ROUTE ERROR]', error.message);
        res.status(500).json({ success: false, error: 'Neural Engine failed to respond. Please try again.' });
    }
});

module.exports = router;
