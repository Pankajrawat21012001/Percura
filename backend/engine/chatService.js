/**
 * Persona Chat Engine — UPGRADED
 * 
 * Simulates real-time dialogue between a user and a persona or segment.
 * Now uses enriched behavioral profiles for deeply authentic responses.
 */

const { generateAIResponse } = require('./groqService');

async function handlePersonaChat(simulationId, target, message, history, context) {
    const { idea, simulationResults } = context;
    
    const targets = Array.isArray(target) ? target : [target];
    const isAll = targets.includes("all");
    
    const isPanel = !isAll && targets.length > 1;

    if (isPanel) {
        const replies = [];
        for (const targetId of targets) {
            const personaReply = await getSingleTargetResponse(targetId, message, history, idea, simulationResults);
            replies.push({
                name: String(personaReply.name || "Persona"),
                reply: String(personaReply.reply || "...")
            });
        }
        return { isPanel: true, replies };
    }

    const targetId = targets[0];
    const personaReply = await getSingleTargetResponse(targetId, message, history, idea, simulationResults);
    return { 
        isPanel: false, 
        reply: String(personaReply.reply || "..."), 
        name: String(personaReply.name || "Persona")
    };
}

async function getSingleTargetResponse(targetId, message, history, idea, simulationResults) {
    const isAll = targetId === "all";
    let targetContext = "";
    let targetName = "Audience";

    if (isAll) {
        const segmentsSummary = (simulationResults || []).map(s => 
            `- ${s.segment_name}: ${s.testResult?.verdict || "Neutral"}`
        ).join("\n");

        targetContext = `
        You are representing the collective voice of the following target audience segments:
        ${segmentsSummary}
        
        Acknowledge the diverse opinions but try to find the "average" sentiment unless there's a major deal-breaker.
        Respond as a group of people discussing the idea synchronously.
        `;
        targetName = "Collective Audience";
    } else {
        // Try to find as segment first, then as individual persona
        let segment = (simulationResults || []).find(s => s.segment_id === targetId);
        let persona = null;

        if (!segment) {
            for (const s of (simulationResults || [])) {
                persona = (s.personas || []).find(p => (p.persona_id || p.id) == targetId);
                if (persona) {
                    segment = s;
                    break;
                }
            }
        }

        if (persona) {
            const ep = persona.enrichedProfile;

            if (ep) {
                // ── UPGRADE 2: Rich context from enriched profile ──
                const ms = ep.memoryState || {};
                
                targetName = ep.fullName ? `${ep.fullName} (${persona.metadata?.age || ''})` : (persona.metadata?.name || 'Persona');

                const experiencesList = (ms.keyExperiences || []).length > 0
                    ? ms.keyExperiences.map(e => `- ${e}`).join("\n")
                    : "Nothing yet";

                targetContext = `
You are ${ep.fullName}, ${persona.metadata?.age || '28'} years old, ${persona.metadata?.occupation || 'professional'} from ${persona.metadata?.state || 'India'} (${persona.metadata?.zone || 'Urban'}).

YOUR INNER WORLD:
${ep.internalNarrative}

HOW YOU MAKE DECISIONS:
- Decision style: ${ep.behaviorPatterns?.decisionMaking || 'Research-heavy'}
- You trust: ${ep.behaviorPatterns?.socialInfluence || 'Family and friends'}
- Adoption style: ${ep.behaviorPatterns?.adoptionStyle || 'Early Majority'}
- How you talk: ${ep.behaviorPatterns?.communicationStyle || 'Casual, Hindi-English mix'}

YOUR CURRENT STATE IN THIS SIMULATION:
- Times you've heard about this idea: ${ms.exposureCount || 0}
- Your current feeling toward it (0=hate, 1=love): ${ms.sentimentScore !== undefined ? ms.sentimentScore : 0.5}
- Things you've experienced:
${experiencesList}
- Heard about it from someone you know: ${ms.heardFromPeers ? 'Yes' : 'No'}

WHAT EXCITES YOU ABOUT THIS IDEA:
${(ep.triggerPoints || []).map(t => `- ${t}`).join("\n")}

WHAT MAKES YOU SKEPTICAL:
${(ep.frictionPoints || []).map(f => `- ${f}`).join("\n")}

YOUR INITIAL GUT REACTION WAS:
${ep.reactionToIdea || 'I need to think about this more.'}

STRICT RULES:
1. You are a REAL HUMAN. Never break character.
2. Respond in your natural voice — ${ep.behaviorPatterns?.communicationStyle || 'casual and direct'}.
3. Keep responses to 2-3 sentences max.
4. Your answer must be shaped by your current sentimentScore and exposureCount.
5. If sentimentScore is below 0.3, be resistant or skeptical.
6. If sentimentScore is above 0.7, be enthusiastic or curious.
7. If exposureCount is 0, this is your first time hearing about this — react freshly.
8. Never mention that you are a simulation, persona, or AI.
9. Reference specific details from your life when relevant.
                `;
            } else {
                // ── FALLBACK: original behavior for unenriched personas ──
                const personaId = persona.persona_id || persona.id;
                const currentName = persona.metadata?.name || persona.name;
                let rawName = "Persona";

                if (currentName && !currentName.includes("Persona") && currentName !== "Custom Persona") {
                    rawName = currentName;
                } else {
                    const names = ["Aarav", "Arjun", "Aditya", "Amit", "Alok", "Ananya", "Aavya", "Bhavna", "Ishani", "Jiya"];
                    const surnames = ["Sharma", "Verma", "Gupta", "Malhotra", "Kapoor", "Patel", "Shah", "Kumar", "Singh", "Yadav"];
                    const seed = parseInt(personaId.toString().replace(/\D/g, '')) || 0;
                    rawName = `${names[seed % names.length]} ${surnames[(seed * 7) % surnames.length]}`;
                }

                const age = persona.metadata?.age || persona.age || (20 + (parseInt(personaId) % 40));
                targetName = age ? `${rawName} (${age})` : rawName;
                
                targetContext = `
            You are ${rawName}, a ${age}-year-old ${persona.metadata?.occupation || "consumer"} from ${persona.metadata?.state || "India"}.
            You are part of the "${segment.segment_name}" audience segment.
            
            YOUR PSYCHOLOGICAL PROFILE:
            - Occupation: ${persona.metadata?.occupation}
            - Background: ${persona.metadata?.summary}
            - Education: ${persona.metadata?.education_level}
            - Geography: ${persona.metadata?.state}, ${persona.metadata?.zone}
            
            YOUR VIEW ON THIS PRODUCT IDEA:
            Your segment's verdict was ${segment.testResult?.verdict}.
            Common friction points you might share: ${segment.testResult?.frictionPoints?.join(", ")}.
            
            AUTHENTICITY GUIDELINES:
            Be honest and critical. If the product is expensive, mention it. If it solves a real pain point for someone in your job, be excited. Use colloquial Indian English.
            `;
            }
        } else if (segment) {
            targetName = segment.segment_name;
            targetContext = `
            You are a representative from the "${segment.segment_name}" segment.
            Occupation: ${segment.profile?.dominant_occupation}
            Verdict: ${segment.testResult?.verdict}
            Drivers: ${segment.testResult?.keyDrivers?.slice(0, 3).join(", ")}
            `;
        } else {
            targetContext = "You are a potential consumer interested in the following startup idea.";
        }
    }

    const chatHistory = (history || []).map(msg => 
        `${msg.sender === "user" ? "Founder" : (msg.senderName || "Persona")}: ${msg.text}`
    ).join("\n");

    const systemPrompt = `
    ${targetContext}
    
    STARTUP IDEA BEING DISCUSSED:
    - Definition: ${idea?.idea}
    - Industry: ${idea?.industry}

    CONVERSATION HISTORY:
    ${chatHistory}

    RESPONSE FORMAT (JSON):
    {
      "reply": "The actual response text"
    }

    STRICT GUIDELINES:
    1. Respond as a REAL human, not an AI.
    2. Keep responses short (1-2 sentences).
    3. Do not mention that you are an AI or a simulation.
    `;

    const userPrompt = `The founder says: "${message}"`;

    try {
        const result = await generateAIResponse(systemPrompt, userPrompt, 0.7);
        let replyText = "I'm not sure what to say to that.";
        if (result) {
            if (typeof result.reply === "string") replyText = result.reply;
            else if (typeof result === "string") replyText = result;
        }
        return { 
            name: targetName, 
            reply: replyText
        };
    } catch (error) {
        console.error("[CHAT-SERVICE] AI Error:", error);
        return { 
            name: targetName, 
            reply: "I'm having trouble thinking right now. Can we talk in a bit?" 
        };
    }
}

module.exports = { handlePersonaChat };
