const express = require('express');
const router = express.Router();
const { runSimulation } = require('../engine/simulationEngine');

// In-memory simulation store (Firestore migration later)
const simulationStore = new Map();

/**
 * POST /api/simulation/run
 * Runs the full time-step behavioral simulation.
 */
router.post('/run', async (req, res) => {
    try {
        const { idea, segments, weeks } = req.body;

        if (!idea || !segments || segments.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: idea, segments'
            });
        }

        console.log(`🚀 [SIM-ROUTE] Starting simulation for "${(idea.idea || '').substring(0, 50)}..." (${weeks || 8} weeks)`);

        const result = await runSimulation(idea, segments, { weeks: weeks || 8 });

        // Store in memory
        simulationStore.set(result.id, result);

        // Cap store at 100 entries
        if (simulationStore.size > 100) {
            const oldestKey = simulationStore.keys().next().value;
            simulationStore.delete(oldestKey);
        }

        res.json({
            success: true,
            simulation: result
        });

    } catch (error) {
        console.error('[SIM-ROUTE ERROR]', error.message);
        res.status(500).json({
            success: false,
            error: 'Simulation engine failed: ' + error.message
        });
    }
});

/**
 * GET /api/simulation/:id
 * Retrieve a stored simulation by ID.
 */
router.get('/:id', (req, res) => {
    const { id } = req.params;
    const simulation = simulationStore.get(id);

    if (!simulation) {
        return res.status(404).json({
            success: false,
            error: 'Simulation not found. It may have expired from memory.'
        });
    }

    res.json({
        success: true,
        simulation
    });
});

/**
 * Expose the store for chat route to look up persona final states.
 */
function getSimulation(id) {
    return simulationStore.get(id) || null;
}

module.exports = router;
module.exports.getSimulation = getSimulation;
