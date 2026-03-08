/**
 * Persona Chat Engine
 * 
 * Simulates real-time dialogue between a user and a persona or segment.
 */

const { generateAIResponse } = require('./groqService');

async function handlePersonaChat(simulationId, target, message, history, context) {
    const { idea, simulationResults } = context;
    
    const targets = Array.isArray(target) ? target : [target];
    const isAll = targets.includes("all");
    
    // Find the specific target (segment or collective)
    let targetContext = "";
    
    if (isAll || targets.length > 1) {
        // Filter segments based on selection, or all if "all" is selected
        const activeSegments = isAll 
            ? (simulationResults || []) 
            : (simulationResults || []).filter(s => targets.includes(s.segment_id));

        const segmentsSummary = activeSegments.map(s => 
            `- ${s.segment_name}: ${s.testResult?.verdict || "Neutral"}. Drivers: ${s.testResult?.keyDrivers?.slice(0, 3).join(", ")}`
        ).join("\n");

        targetContext = `
        You are representing the collective voice of the following target audience segments:
        ${segmentsSummary}
        
        Acknowledge the diverse opinions but try to find the "average" sentiment unless there's a major deal-breaker.
        Respond as a group of people discussing the idea synchronously.
        `;
    } else {
        const targetId = targets[0];
        const segment = (simulationResults || []).find(s => s.segment_id === targetId);
        if (segment) {
            targetContext = `
            You are a representative persona from the "${segment.segment_name}" segment.
            
            YOUR PROFILE:
            - Occupation: ${segment.profile?.dominant_occupation}
            - Geography: ${segment.profile?.dominant_state}
            - Age: ${segment.profile?.age_range || "N/A"}
            
            YOUR RECENT FEEDBACK ON THE IDEA:
            - Verdict: ${segment.testResult?.verdict}
            - Key Drivers: ${segment.testResult?.keyDrivers?.slice(0, 3).join(", ")}
            - Friction Points: ${segment.testResult?.frictionPoints?.slice(0, 3).join(", ")}
            
            YOUR PSYCHOLOGY:
            Be authentic to this persona. If you have friction points, mention them if the founder's response doesn't address them honestly. Use your specific background to give honest, price-sensitive Indian market feedback.
            `;
        } else {
            targetContext = "You are a potential consumer interested in the following startup idea.";
        }
    }

    // Format history for the prompt
    const chatHistory = (history || []).map(msg => 
        `${msg.sender === "user" ? "Founder" : "Persona"}: ${msg.text}`
    ).join("\n");

    const systemPrompt = `
    ${targetContext}
    
    STARTUP IDEA BEING DISCUSSED:
    - Definition: ${idea?.idea}
    - Industry: ${idea?.industry}
    - Target Audience: ${idea?.targetAudience}

    CONVERSATION HISTORY:
    ${chatHistory}

    RESPONSE FORMAT (JSON):
    {
      "reply": "The actual response text"
    }

    STRICT GUIDELINES:
    1. Respond as a REAL human, not an AI. Use direct, colloquial Indian English where appropriate.
    2. Be consistent with your segment's psychological profile and conversion history.
    3. Keep responses concise (2-4 sentences).
    4. Do not mention that you are an AI or a simulation.
    5. Mention specific local context if relevant to your occupation or region.
    `;

    const userPrompt = `The founder says: "${message}"`;

    try {
        const result = await generateAIResponse(systemPrompt, userPrompt, 0.7);
        return result?.reply || "I'm not sure what to say to that.";
    } catch (error) {
        console.error("[CHAT-SERVICE] AI Error:", error);
        return "I'm having trouble thinking right now. Can we talk in a bit?";
    }
}

module.exports = { handlePersonaChat };
