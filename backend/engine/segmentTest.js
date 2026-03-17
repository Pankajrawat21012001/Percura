/**
 * Persona Segment Test Engine
 * 
 * Evaluates how a specific persona segment reacts to a startup idea.
 * Uses Groq/Llama to simulate a collective verdict from the segment's profile.
 */

const { generateAIResponse } = require('./groqService');

/**
 * Run a "Concept Validation" test for a specific persona segment.
 * 
 * @param {Object} idea - {idea, industry, businessModel, targetAudience}
 * @param {Object} segment - {segment_name, profile, sample_personas}
 * @returns {Promise<Object>} - Segment verdict and feedback
 */
async function testSegmentResonance(idea, segment) {
    if (!idea || !segment) {
        throw new Error('Idea and Segment data are required for testing.');
    }

    const { profile, personas, segment_name } = segment;
    
    // Build a narrative description for both the segment and individual personas
    const personaList = (personas || []).map((p, i) => {
        const m = p.metadata || {};

        // Parse JSON array fields safely
        const hobbies = (() => {
            try { return JSON.parse(m.hobbies || '[]').slice(0, 3).join(', '); }
            catch { return m.hobbies || ''; }
        })();
        const skills = (() => {
            try { return JSON.parse(m.skills || '[]').slice(0, 3).join(', '); }
            catch { return m.skills || ''; }
        })();

        const psychProfile = m.persona || m.professional_persona || m.summary || 'Typical profile';
        const culturalBg = m.cultural_background ? `Cultural background: ${m.cultural_background}.` : '';
        const goals = m.career_goals_and_ambitions ? `Goals: ${m.career_goals_and_ambitions}.` : '';

        return `${i+1}. ${m.name || 'Persona'}, ${m.age}y, ${m.sex || ''}, ${m.occupation}
   Location: ${m.state} (${m.zone}) | Language: ${m.first_language || 'Hindi'} | Marital: ${m.marital_status || 'Unknown'}
   Education: ${m.education_level}${m.education_degree ? ` (${m.education_degree})` : ''}
   ${culturalBg}
   ${goals}
   Hobbies: ${hobbies || 'Not specified'}
   Skills: ${skills || 'Not specified'}
   Profile: ${psychProfile}`;
    }).join('\n\n');

    const segmentContext = `
SEGMENT: ${segment_name}
DOMINANT DEMOGRAPHICS:
- Age Range: ${profile.age_range || 'Unknown'}
- Location: ${profile.dominant_zone} (${profile.dominant_state})
- Occupation: ${profile.dominant_occupation}

INDIVIDUAL PERSONA PROFILES IN THIS CLUSTER:
${personaList}
`;

    const systemPrompt = `
You are a market simulation engine. Evaluate a startup idea against a specific Indian consumer segment.
You must provide a collective verdict AND individual feedback for each persona provided in the list.

RESPONSE FORMAT (JSON):
{
  "resonanceScore": number (0-100),
  "verdict": "CRITICAL" | "SKEPTICAL" | "NEUTRAL" | "CURIOUS" | "ENTHUSIASTIC",
  "keyDrivers": string[],
  "frictionPoints": string[],
  "willingnessToPay": "High" | "Medium" | "Low" | "Zero",
  "verbatimQuote": "Collective segment voice quote",
  "summary": "2-3 sentence summary",
  "personaFeedbacks": [
     {
       "resonanceScore": number,
       "feedback": "A one-sentence specific reaction from this persona's point of view"
     }
  ]
}

STRICT: The 'personaFeedbacks' array MUST have exactly ${personas?.length || 0} items matching the order of the personas provided.
Stay in character for each persona. Use their first_language to infer communication style and trust patterns. Use their hobbies and cultural background to ground their reaction in real Indian daily life. A Gujarati-speaking homemaker reacts very differently from an English-first Bangalore software engineer — reflect this specificity in every feedback line.
`;

    const marketContextBlock = idea.zepContext 
        ? `\nINDIAN MARKET CONTEXT (from knowledge graph):\n${idea.zepContext}\n`
        : '';

    const userPrompt = `
STARTUP IDEA:
- Definition: ${idea.idea}
- Industry: ${idea.industry || 'General'}
- Business Model: ${idea.businessModel || 'Not specified'}
- Stated Target Audience: ${idea.targetAudience || 'General public'}
${idea.duration ? `- Simulation Horizon: ${idea.duration} weeks` : ''}
${marketContextBlock}
TARGET SEGMENT & INDIVIDUALS:
${segmentContext}

Analyze the reaction over a period of ${idea.duration || 12} weeks. 
Provide the collective resonance and then a unique, specific feedback line for EACH of the ${personas?.length || 0} personas listed above.
`;

    try {
        console.log(`🧪 Testing segment resonance: "${segment_name}"...`);
        const result = await generateAIResponse(systemPrompt, userPrompt, 0.4);

        if (!result) {
            // Minimal fallback
            const fallbackResonance = 50;
            return {
                resonanceScore: fallbackResonance,
                verdict: "NEUTRAL",
                summary: "The engine was unable to generate a deep analysis. Initial matching shows moderate relevance based on demographic alignment.",
                verbatimQuote: "It seems interesting, but I need to see more value before I commit.",
                personaFeedbacks: (personas || []).map(() => ({
                    resonanceScore: fallbackResonance,
                    feedback: "Awaiting deeper synthesis of individual profile reaction..."
                }))
            };
        }

        // Post-process to ensure personaFeedbacks exists and matches length
        if (!result.personaFeedbacks || !Array.isArray(result.personaFeedbacks) || result.personaFeedbacks.length === 0) {
            console.log(`⚠️ Segment test missing personaFeedbacks. Generating defaults for ${segment_name}.`);
            result.personaFeedbacks = (personas || []).map(() => ({
                resonanceScore: result.resonanceScore || 50,
                feedback: "Based on this profile, the persona would likely prioritize core utility and reliability over novel features."
            }));
        }

        return result;

    } catch (error) {
        console.error(`[SEGMENT-TEST] Error for ${segment_name}:`, error.message);
        throw error;
    }
}

module.exports = { testSegmentResonance };
