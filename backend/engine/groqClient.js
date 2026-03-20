const Groq = require('groq-sdk');
require('dotenv').config();

let groq;

if (process.env.GROQ_API_KEY) {
    global.groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
    groq = global.groqClient;
} else {
    console.warn("⚠️  GROQ_API_KEY is missing. Using mock responses for development.");
}

async function generateAIResponse(systemPrompt, userPrompt, temperature = 0.7, jsonMode = true) {
    if (!groq) {
        // Mock fallback if no API key
        if (jsonMode) return { competitors: [], risks: [], trends: [] };
        return "Mock AI Response due to missing GROQ_API_KEY";
    }

    try {
        const response = await groq.chat.completions.create({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            model: "llama-3.3-70b-versatile",
            temperature: temperature,
            ...(jsonMode && { response_format: { type: "json_object" } }),
        });

        const content = response.choices[0]?.message?.content || "";
        return jsonMode ? JSON.parse(content) : content;
    } catch (error) {
        console.error("Groq API Error:", error.message);
        throw error;
    }
}

module.exports = {
  generateAIResponse,
  groq,
};
