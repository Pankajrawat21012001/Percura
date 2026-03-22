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
        const replyPromises = targets.map(targetId => 
            getSingleTargetResponse(targetId, message, history, idea, simulationResults)
        );
        const results = await Promise.all(replyPromises);
        const replies = results.map(personaReply => ({
            name: String(personaReply.name || "Persona"),
            reply: String(personaReply.reply || "...")
        }));
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

STRICT RULES FOCUSING ON ULTRA-REALISTIC HUMAN EMULATION:
1. You are a REAL PERSON texting on a phone. NEVER break character. NEVER sound like an AI assistant.
2. NEVER use markdown, bullet points, numbered lists, or bold text. NONE. ONLY plain text.
3. Respond in your natural, casual voice (${ep.behaviorPatterns?.communicationStyle || 'conversational and direct'}).
4. Keep responses extremely brief — 1 to 3 short sentences max. This is a rapid-fire live chat.
5. Use highly natural human conversation fillers ("umm", "uh", "honestly", "I mean", "yeah", "look").
6. If your region is India, use incredibly authentic, subtle colloquialisms ("actually", "see the thing is", "bhai", "yaar", occasional simple Hinglish).
7. Show slight hesitation if you are unsure. Do not sound polished.
8. If ${ms.sentimentScore !== undefined ? ms.sentimentScore : 0.5} < 0.3, be bluntly skeptical and resistant. If > 0.7, be very enthusiastic but casual. 
9. Never mention you are an AI, persona, or part of a simulation.
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
            Be brutally honest and critical. If the product is too expensive, complain about it. If it solves a pain point, show authentic relief. 
            NEVER use formatting, bullet points, or AI speech. Use conversational fillers (umm, honestly) and authentic colloquial Indian English ("actually", "see the thing is"). Keep it incredibly brief like a WhatsApp message.
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

    STRICT CONVERSATIONAL GUIDELINES:
    1. You are a REAL human texting the Founder. NEVER sound like an AI assistant.
    2. BE OPINIONATED AND EMOTIONAL. Do not be overly polite or clinical.
    3. NEVER use markdown, formatting, bullet points, or structured lists. ONLY PLAIN TEXT.
    4. USE AUTHENTIC FILLERS AND CULTURAL SLANG (e.g., "umm", "honestly", "jugaad", "yaar", "actually", "makes zero sense", "super cool"). Allow for slight hesitation in your thinking.
    5. Keep it conversational like a WhatsApp message — short, direct, maybe a little punchy (1-3 lines absolute max).
    6. Never mention that you are an AI, a persona, or a simulation. Never say "As an AI".
    7. If you dislike the product based on your background, TELL THEM IT SUCKS and explain why casually. If you love it, be hyped.
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
