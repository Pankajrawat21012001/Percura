/**
 * Survey Route — Mass Persona Interrogation
 * 
 * POST /api/survey/run
 * Sends a question to multiple personas in parallel and collects their responses.
 */

const express = require('express');
const router = express.Router();
const { generateAIResponse } = require('../engine/groqService');

router.post('/run', async (req, res) => {
    try {
        const { question, personas, idea } = req.body;

        if (!question || !question.trim()) {
            return res.status(400).json({ success: false, error: 'Question is required' });
        }
        if (!personas || !Array.isArray(personas) || personas.length === 0) {
            return res.status(400).json({ success: false, error: 'At least one persona is required' });
        }

        const ideaText = idea?.idea || 'a new product';

        console.log(`📋 [SURVEY] Running survey: "${question.substring(0, 60)}..." across ${personas.length} personas`);

        // Process in batches of 5 to avoid rate limits
        const BATCH_SIZE = 5;
        const results = [];

        for (let i = 0; i < personas.length; i += BATCH_SIZE) {
            const batch = personas.slice(i, i + BATCH_SIZE);
            const batchPromises = batch.map(persona => processPersonaSurvey(persona, question, ideaText));
            const batchResults = await Promise.allSettled(batchPromises);

            for (let j = 0; j < batchResults.length; j++) {
                const persona = batch[j];
                if (batchResults[j].status === 'fulfilled') {
                    results.push({
                        personaName: persona.name || `Persona ${j}`,
                        segmentName: persona.segmentName || 'Unknown',
                        answer: batchResults[j].value,
                        question
                    });
                } else {
                    results.push({
                        personaName: persona.name || `Persona ${j}`,
                        segmentName: persona.segmentName || 'Unknown',
                        answer: 'Sorry, I was unable to respond at this time.',
                        question,
                        error: true
                    });
                }
            }

            // Small delay between batches
            if (i + BATCH_SIZE < personas.length) {
                await new Promise(r => setTimeout(r, 200));
            }
        }

        console.log(`✅ [SURVEY] Got ${results.length} responses`);

        return res.json({
            success: true,
            results,
            totalResponses: results.length,
            question
        });
    } catch (err) {
        console.error('❌ [SURVEY] Error:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

async function processPersonaSurvey(persona, question, ideaText) {
    const simHistory = (persona.keyExperiences || []).join('\n');
    const conversionStatus = persona.converted ? 'CONVERTED (would buy/try)' 
        : persona.churned ? 'CHURNED (lost interest)' 
        : 'STILL EVALUATING';

    const systemPrompt = `You are ${persona.name}, a real person who participated in a product evaluation.
Your background: ${(persona.internalNarrative || '').substring(0, 400)}
Your adoption style: ${persona.adoptionStyle || 'mainstream'}
Your final status: ${conversionStatus}
Current sentiment: ${((persona.sentimentScore || 0.5) * 100).toFixed(0)}% positive

Your journey with this product:
${simHistory || 'No specific experiences recorded.'}

RULES:
- Answer as this specific person, in first person.
- Your response should reflect your actual experiences and sentiment.
- Be authentic — if you churned, explain why honestly. If you converted, explain what won you over.
- Keep your answer to 2-4 sentences.
- Do NOT break character or mention being an AI.`;

    const userPrompt = `The product is: "${ideaText}"

Question asked by the researcher: "${question}"

Respond as ${persona.name}:`;

    const result = await generateAIResponse(systemPrompt, userPrompt, 0.7);
    
    if (typeof result === 'string') return result;
    if (result?.response) return result.response;
    if (result?.answer) return result.answer;
    return JSON.stringify(result);
}

module.exports = router;
