const express = require('express');
const router = express.Router();

// This file is now primarily for legacy compatibility or redirected features.
// The main Persona Segment Testing logic resides in routes/personas.js.

/**
 * Legacy Simulation Endpoints
 * All redirected or decommissioned to focus on Persona Segment Testing.
 */

router.post('/run', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Legacy simulation disabled. Use the Persona Testing flow.',
        results: { pulse: { score: 0, signals: [] }, trajectory: [] }
    });
});

router.post('/run/pulse', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Legacy pulse simulation disabled.',
        results: { score: 0, signals: [] }
    });
});

router.post('/run/deep', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Legacy deep simulation disabled.',
        results: { analysis: "Feature decommissioned." }
    });
});

router.post('/startup-simulation', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Startup trajectory simulation disabled.',
        simulation: { status: 'decommissioned' }
    });
});

router.post('/brutal-test', (req, res) => {
    res.json({
        success: true,
        message: 'Brutal mode disabled.',
        verdict: { status: 'decommissioned' }
    });
});

module.exports = router;
