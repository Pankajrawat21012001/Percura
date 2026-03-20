const Groq = require('groq-sdk');
require('dotenv').config();

// Initialize Groq client
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
    timeout: 30000, // 30 seconds
    maxRetries: 2
});

// Simple in-memory cache to minimize API usage
const responseCache = new Map();

/**
 * Clean JSON string by removing markdown code blocks if present
 */
function cleanJsonString(str) {
    // Remove ```json and ``` wrapping if present
    let cleaned = str.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    // Remove generic ``` wrapping if present
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    return cleaned;
}

/**
 * Generate completion from Groq
 * @param {string} systemPrompt - strict system instruction
 * @param {string} userPrompt - dynamic user input
 * @param {number} temperature - creativity (def: 0.5)
 * @returns {Promise<Object>} - parsed JSON response
 */
async function generateAIResponse(systemPrompt, userPrompt, temperature = 0.5, forceJson = true) {
    if (!process.env.GROQ_API_KEY) {
        console.warn('GROQ_API_KEY is missing. Returning null to trigger fallback.');
        return null; // Signals caller to use fallback
    }

    // cache key based on prompts
    const cacheKey = `${systemPrompt}::${userPrompt}`;
    if (responseCache.has(cacheKey)) {
        console.log('⚡ Using cached AI response');
        return responseCache.get(cacheKey);
    }

    const models = [
        'llama-3.1-8b-instant',      // Fast, high rate limits
        'llama-3.3-70b-versatile',  // Best logic and JSON adherence
        'llama-3.1-70b-versatile',   // High-end fallback
        'llama3-70b-8192',           // Reliable legacy model
        'llama-3.2-11b-vision-preview'
    ];

    for (let i = 0; i < models.length; i++) {
        const currentModel = models[i];
        try {
            console.log(`🤖 Calling Groq API [Model: ${currentModel}]...`);
            const requestParams = {
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                model: currentModel,
                temperature: temperature
            };
            if (forceJson) {
                requestParams.response_format = { type: 'json_object' };
            }
            const completion = await groq.chat.completions.create(requestParams);

            const rawContent = completion.choices[0]?.message?.content;
            if (!rawContent) {
                throw new Error('Empty response from Groq');
            }

            if (forceJson) {
                const cleanedContent = cleanJsonString(rawContent);
                const parsedData = JSON.parse(cleanedContent);
                responseCache.set(cacheKey, parsedData);
                return parsedData;
            } else {
                // Return raw text (for markdown reports, chat, etc.)
                responseCache.set(cacheKey, rawContent);
                return rawContent;
            }

        } catch (error) {
            const isLastModel = i === models.length - 1;
            const isRateLimit = error.status === 429 || error.message?.includes('limit');
            
            console.error(`❌ Groq API Error [Model: ${currentModel}]:`, {
                message: error.message,
                status: error.status
            });

            // If it's a rate limit, wait a bit before moving to next model
            if (isRateLimit && !isLastModel) {
                const waitTime = 1000 * (i + 1); // Incremental wait
                console.warn(`⏳ Rate limit hit. Waiting ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            // If it's a transient or model-specific error, try the next model
            if (!isLastModel) {
                console.warn(`⚠️ Issue with ${currentModel}. Attempting fallback to ${models[i+1]}...`);
                continue;
            }

            // If we've exhausted all models, return null
            return null;
        }
    }
    return null;
}

/**
 * Generate a free-text/markdown response (NOT forced JSON).
 * Use this for report generation, analyst chat, and any natural language output.
 */
async function generateTextResponse(systemPrompt, userPrompt, temperature = 0.5) {
    return generateAIResponse(systemPrompt, userPrompt, temperature, false);
}

module.exports = { generateAIResponse, generateTextResponse, groq };
