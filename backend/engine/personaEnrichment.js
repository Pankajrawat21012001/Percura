/**
 * Persona Enrichment Engine
 * 
 * Takes a raw demographic persona and generates a deep behavioral profile
 * using the Groq LLM. Each enriched persona becomes a fully realized character
 * with internal narrative, decision patterns, and reaction to the startup idea.
 */

const { generateAIResponse } = require('./groqService');

// In-memory cache: `${persona_id}::${ideaHash}` → enrichedProfile
const enrichmentCache = new Map();
const MAX_CACHE_SIZE = 500;

function getIdeaHash(idea) {
    const raw = typeof idea === 'string' ? idea : (idea?.idea || '');
    return raw.substring(0, 80).replace(/\s+/g, '_').toLowerCase();
}

/**
 * Enrich a single persona with a full behavioral profile.
 * @param {Object} persona - Raw persona object with metadata
 * @param {Object} idea - The startup idea being tested
 * @returns {Object} persona with `enrichedProfile` field added
 */
async function enrichPersona(persona, idea) {
    const personaId = persona.persona_id || persona.id;
    const ideaHash = getIdeaHash(idea);
    const cacheKey = `${personaId}::${ideaHash}`;

    if (enrichmentCache.has(cacheKey)) {
        console.log(`⚡ [ENRICH] Cache hit for persona ${personaId}`);
        return { ...persona, enrichedProfile: enrichmentCache.get(cacheKey) };
    }

    const m = persona.metadata || persona;
    const name = m.name || 'Unknown';
    const age = m.age || 28;
    const occupation = m.occupation || 'Professional';
    const state = m.state || 'Maharashtra';
    const zone = m.zone || 'Urban';
    const education = m.education_level || 'Graduate';
    const sex = m.sex || 'Male';
    const summary = m.summary || '';
    const ideaText = typeof idea === 'string' ? idea : (idea?.idea || 'a new startup product');
    const industry = (typeof idea === 'object' ? idea?.industry : '') || 'General';
    const targetAudience = (typeof idea === 'object' ? idea?.targetAudience : '') || '';

    const systemPrompt = `You are a behavioral psychologist creating a deep profile of an Indian consumer persona for market simulation.

You must return ONLY valid JSON with these exact fields:

{
  "fullName": "A realistic Indian name matching demographics",
  "internalNarrative": "300-400 word first-person internal monologue written AS this person — their daily life, financial pressures, aspirations, what they care about, what they're afraid of, what they read, who influences them. Must feel like a real human wrote it. Reference their specific occupation, age, state, and zone.",
  "behaviorPatterns": {
    "decisionMaking": "How they evaluate new products — impulsive vs research-heavy, price-sensitive vs value-driven",
    "socialInfluence": "Who they trust — friends, influencers, family, reviews, ads",
    "adoptionStyle": "One of: Innovator, Early Adopter, Early Majority, Late Majority, Laggard",
    "communicationStyle": "How they talk — formal/casual, English/Hindi/mix, short/verbose, emotional/logical"
  },
  "memoryState": {
    "exposureCount": 0,
    "sentimentScore": 0.5,
    "keyExperiences": [],
    "heardFromPeers": false,
    "triedProduct": false
  },
  "reactionToIdea": "Their INITIAL gut reaction to the startup idea — one paragraph, written in their voice, referencing their specific life context. Not a verdict. A human reaction.",
  "triggerPoints": ["3-5 specific things that would make this person excited about the idea"],
  "frictionPoints": ["3-5 specific things that would make this person skeptical or reject the idea"]
}

RULES:
- The internalNarrative must be deeply specific to their occupation, age, state, zone, and education.
- triggerPoints and frictionPoints must reference concrete, specific things (prices in rupees, specific features, real platforms they'd use).
- The reactionToIdea should use their natural voice (casual if young urban, more formal if older etc).
- adoptionStyle must be exactly one of the five values listed.
- Do NOT use generic marketing language. Write as if you are this person.`;

    const userPrompt = `PERSONA DEMOGRAPHICS:
- Name: ${name}
- Age: ${age}
- Sex: ${sex}
- Occupation: ${occupation}
- State: ${state}
- Zone: ${zone}
- Education: ${education}
- Summary: ${summary}

STARTUP IDEA BEING TESTED:
"${ideaText}"
Industry: ${industry}
Target Audience: ${targetAudience}

Generate a complete behavioral profile for this person. Make it deeply authentic and specific to their life circumstances.`;

    try {
        console.log(`🧬 [ENRICH] Generating behavioral profile for ${name} (ID: ${personaId})...`);
        const result = await generateAIResponse(systemPrompt, userPrompt, 0.6);

        if (!result) {
            console.warn(`⚠️ [ENRICH] LLM returned null for persona ${personaId}, using fallback.`);
            return { ...persona, enrichedProfile: buildFallbackProfile(m, ideaText) };
        }

        // Validate and sanitize the result
        const enrichedProfile = {
            fullName: result.fullName || name,
            internalNarrative: result.internalNarrative || `I am ${name}, a ${age}-year-old ${occupation} from ${state}.`,
            behaviorPatterns: {
                decisionMaking: result.behaviorPatterns?.decisionMaking || 'Research-heavy, moderately price-sensitive',
                socialInfluence: result.behaviorPatterns?.socialInfluence || 'Trusts family and close friends',
                adoptionStyle: validateAdoptionStyle(result.behaviorPatterns?.adoptionStyle),
                communicationStyle: result.behaviorPatterns?.communicationStyle || 'Casual, Hindi-English mix'
            },
            memoryState: {
                exposureCount: 0,
                sentimentScore: 0.5,
                keyExperiences: [],
                heardFromPeers: false,
                triedProduct: false
            },
            reactionToIdea: result.reactionToIdea || 'Interesting concept, let me think about it.',
            triggerPoints: Array.isArray(result.triggerPoints) ? result.triggerPoints.slice(0, 5) : ['Saves time', 'Affordable price'],
            frictionPoints: Array.isArray(result.frictionPoints) ? result.frictionPoints.slice(0, 5) : ['High price', 'Trust issues']
        };

        // Cache the result
        if (enrichmentCache.size >= MAX_CACHE_SIZE) {
            const firstKey = enrichmentCache.keys().next().value;
            enrichmentCache.delete(firstKey);
        }
        enrichmentCache.set(cacheKey, enrichedProfile);

        console.log(`✅ [ENRICH] Profile complete for ${enrichedProfile.fullName}`);
        return { ...persona, enrichedProfile };

    } catch (err) {
        console.error(`❌ [ENRICH] Failed for persona ${personaId}:`, err.message);
        return { ...persona, enrichedProfile: buildFallbackProfile(m, ideaText) };
    }
}

function validateAdoptionStyle(style) {
    const valid = ['Innovator', 'Early Adopter', 'Early Majority', 'Late Majority', 'Laggard'];
    if (valid.includes(style)) return style;
    // Map partial matches
    if (style && typeof style === 'string') {
        const lower = style.toLowerCase();
        if (lower.includes('innovator')) return 'Innovator';
        if (lower.includes('early adopter')) return 'Early Adopter';
        if (lower.includes('early majority')) return 'Early Majority';
        if (lower.includes('late majority')) return 'Late Majority';
        if (lower.includes('laggard')) return 'Laggard';
    }
    return 'Early Majority'; // Safe default
}

function buildFallbackProfile(m, ideaText) {
    const name = m.name || 'Unknown';
    const age = m.age || 28;
    const occupation = m.occupation || 'Professional';
    const state = m.state || 'Maharashtra';
    const zone = m.zone || 'Urban';

    return {
        fullName: name,
        internalNarrative: `I'm ${name}, ${age} years old, working as a ${occupation} in ${state}. My day starts early and I'm always looking for ways to make my life simpler. Money is important to me — I budget carefully and don't spend on things I can't justify. I usually hear about new products through friends or social media, and I like reading reviews before trying anything.`,
        behaviorPatterns: {
            decisionMaking: 'Moderately research-heavy, price-sensitive',
            socialInfluence: 'Trusts peers and online reviews',
            adoptionStyle: 'Early Majority',
            communicationStyle: 'Casual, uses Hindi-English mix'
        },
        memoryState: {
            exposureCount: 0,
            sentimentScore: 0.5,
            keyExperiences: [],
            heardFromPeers: false,
            triedProduct: false
        },
        reactionToIdea: `Hmm, interesting idea. I'd want to know more about the pricing and whether people I know are already using it before I commit.`,
        triggerPoints: ['Saves daily time', 'Trusted by people I know', 'Easy to use on phone'],
        frictionPoints: ['High price point', 'No Hindi support', 'Unfamiliar brand']
    };
}

/**
 * Enrich the top N personas per segment in parallel.
 * @param {Array} segments - Array of segment objects with personas
 * @param {Object} idea - The startup idea
 * @param {number} perSegment - How many personas to enrich per segment (default 3)
 * @returns {Array} segments with enriched personas
 */
async function enrichSegments(segments, idea, perSegment = 3) {
    console.log(`🧬 [ENRICH] Starting enrichment across ${segments.length} segments (top ${perSegment} each)...`);

    const enrichmentPromises = [];

    for (const segment of segments) {
        const personasToEnrich = (segment.personas || []).slice(0, perSegment);
        for (const persona of personasToEnrich) {
            enrichmentPromises.push(
                enrichPersona(persona, idea).then(enriched => ({
                    segmentId: segment.segment_id,
                    personaId: enriched.persona_id || enriched.id,
                    enriched
                }))
            );
        }
    }

    const results = await Promise.all(enrichmentPromises);

    // Map enriched personas back into their segments
    const enrichedSegments = segments.map(segment => {
        const enrichedPersonas = segment.personas.map(persona => {
            const enrichedResult = results.find(
                r => r.segmentId === segment.segment_id && r.personaId === (persona.persona_id || persona.id)
            );
            return enrichedResult ? enrichedResult.enriched : persona;
        });
        return { ...segment, personas: enrichedPersonas };
    });

    const enrichedCount = results.length;
    console.log(`✅ [ENRICH] Enrichment complete. ${enrichedCount} personas enriched.`);
    return enrichedSegments;
}

module.exports = { enrichPersona, enrichSegments };
