const express = require('express');
const router = express.Router();
const { handlePersonaChat } = require('../engine/chatService');

/**
 * Route: Audience Dialogue Chat
 * Simulates conversation with personas or segments.
 */
router.post('/chat', async (req, res) => {
    try {
        const { simulationId, target, message, history, context } = req.body;
        
        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        console.log(`💬 Chat request for simulation ${simulationId}, target: ${target}`);

        const reply = await handlePersonaChat(simulationId, target, message, history, context);
        
        res.json(reply);
    } catch (error) {
        console.error('[CHAT-ROUTE ERROR]', error.message);
        res.status(500).json({ success: false, error: 'Neural Engine failed to respond. Please try again.' });
    }
});

module.exports = router;
