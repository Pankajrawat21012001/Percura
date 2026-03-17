const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { Pinecone } = require('@pinecone-database/pinecone');
const { pipeline } = require('@xenova/transformers');
const { testSegmentResonance } = require('../engine/segmentTest');
const { generateAIResponse } = require('../engine/groqService');
const { enrichSegments } = require('../engine/personaEnrichment');
const { buildIdeaContext } = require('../engine/zepService');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// Singleton embedder — initialised once on first call, reused for all subsequent calls
let _embedder = null;
async function getEmbedder() {
    if (!_embedder) {
        console.log('🔧 [LOCAL] Loading embedding model (first run only)...');
        _embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        console.log('✅ [LOCAL] Embedding model ready.');
    }
    return _embedder;
}

// --- CONFIG ---
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pc.index(process.env.PINECONE_INDEX || 'percura-personas');

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 20000, // 20 seconds timeout
});


/**
 * Helper: Generate Embedding via Hugging Face API
 */
async function getEmbedding(text) {
    try {
        console.log(`🧠 [LOCAL] Generating embedding vector...`);
        const embedder = await getEmbedder();
        const output = await embedder(text, { pooling: 'mean', normalize: true });
        const vector = Array.from(output.data);
        console.log(`✅ [LOCAL] Successfully generated ${vector.length}-dimension vector.`);
        return vector;
    } catch (err) {
        console.error('❌ Embedding Error:', err.message);
        console.log('⚠️ Using Fallback Zero-Vector due to error.');
        return Array(384).fill(0);
    }
}

const INDIAN_NAMES = [
    "Aarav", "Arjun", "Aditya", "Amit", "Alok", "Anil", "Bhuvan", "Chetan", "Deepak", "Dev", 
    "Gaurav", "Hrithik", "Ishaan", "Jatin", "Karan", "Kartik", "Lokesh", "Manish", "Nitin", "Pankaj",
    "Pranav", "Rahul", "Rajesh", "Rohan", "Sanjay", "Siddharth", "Tushar", "Utkarsh", "Varun", "Vivek",
    "Ananya", "Aavya", "Bhavna", "Ishani", "Jiya", "Kavya", "Meera", "Neha", "Pooja", "Priya",
    "Riya", "Sanya", "Tanvi", "Vanya", "Zoya", "Amrita", "Deepika", "Esha", "Gauri", "Hema"
];
const INDIAN_SURNAMES = [
    "Sharma", "Verma", "Gupta", "Malhotra", "Kapoor", "Khanna", "Joshi", "Patel", "Shah", "Mehta",
    "Reddy", "Nair", "Iyer", "Kumar", "Singh", "Yadav", "Chauhan", "Pandey", "Mishra", "Dubey"
];

function generateRealName(id) {
    const first = INDIAN_NAMES[id % INDIAN_NAMES.length];
    const last = INDIAN_SURNAMES[(id * 7) % INDIAN_SURNAMES.length];
    return `${first} ${last}`;
}

/**
 * Ask Groq to interpret the target audience and return a structured scoring rubric.
 * Result is cached in-memory so repeat searches with the same inputs skip the LLM call.
 */
const criteriaCache = new Map();

async function getCriteriaFromGroq(idea, targetAudience, industry, businessModel) {
    const cacheKey = `${idea}::${targetAudience}::${industry}::${businessModel}`;
    if (criteriaCache.has(cacheKey)) {
        console.log('⚡ [CRITERIA] Using cached scoring rubric.');
        return criteriaCache.get(cacheKey);
    }

    console.log('🎯 [CRITERIA] Asking Groq to interpret target audience...');

    const systemPrompt = `You are a persona-matching engine for an Indian market research platform.
Given a startup idea and its target audience description, return a JSON scoring rubric
that will be used to score Indian consumer personas from a database.

The persona database has these fields: occupation (string), zone (Urban/Semi-Urban/Rural),
education_level (string like "Graduate", "Postgraduate", "Below Graduate", "Illiterate"),
age (number), sex (Male/Female), state (Indian state name), first_language (e.g. Hindi, Tamil,
Gujarati, Bengali, Marathi), marital_status (Currently Married, Unmarried, Widowed),
hobbies (array of strings), skills (array of strings), career_goals_and_ambitions (string).

RESPONSE FORMAT (JSON only, no markdown, no explanation):
{
  "occupation_keywords": ["keyword1", "keyword2"],
  "occupation_weight": 0.0 to 1.0,
  "zone_scores": { "Urban": 0.0-1.0, "Semi-Urban": 0.0-1.0, "Rural": 0.0-1.0 },
  "zone_weight": 0.0 to 1.0,
  "education_keywords": ["Graduate", "Postgraduate"],
  "education_weight": 0.0 to 1.0,
  "age_min": number or null,
  "age_max": number or null,
  "age_weight": 0.0 to 1.0,
  "preferred_sex": "Male" or "Female" or "Any",
  "sex_weight": 0.0 to 1.0,
  "preferred_states": [],
  "state_weight": 0.0 to 1.0,
  "preferred_languages": [],
  "language_weight": 0.0 to 0.1
}

RULES:
- If target audience does not mention age, set age_min and age_max to null and age_weight to 0.
- If target audience does not mention gender/sex, set preferred_sex to "Any" and sex_weight to 0.
- If target audience does not mention a state or region, set preferred_states to [] and state_weight to 0.
- If target audience mentions a language (Hindi, Tamil, Gujarati etc.), set preferred_languages and language_weight up to 0.1.
- occupation_keywords should be 3-6 words that describe relevant job roles (in lowercase).
- zone_scores must always have all three keys with values summing to around 2.0.
- All weights must sum to 1.0 across: occupation_weight + zone_weight + education_weight + age_weight + sex_weight + state_weight + language_weight.`;

    const userPrompt = `STARTUP IDEA: ${idea}
TARGET AUDIENCE: ${targetAudience}
INDUSTRY: ${industry || 'General'}
BUSINESS MODEL: ${businessModel || 'Not specified'}`;

    try {
        const criteria = await generateAIResponse(systemPrompt, userPrompt, 0.1);
        if (!criteria) throw new Error('Groq returned null');

        console.log('✅ [CRITERIA] Scoring rubric ready:', JSON.stringify(criteria));
        criteriaCache.set(cacheKey, criteria);
        return criteria;
    } catch (err) {
        console.error('⚠️ [CRITERIA] Groq failed, using default rubric:', err.message);
        // Fallback rubric — weights persona by occupation + zone only
        return {
            occupation_keywords: targetAudience.toLowerCase().split(/[\s,]+/).filter(w => w.length > 3),
            occupation_weight: 0.5,
            zone_scores: { "Urban": 1.0, "Semi-Urban": 0.7, "Rural": 0.3 },
            zone_weight: 0.2,
            education_keywords: ["Graduate", "Postgraduate"],
            education_weight: 0.15,
            age_min: null,
            age_max: null,
            age_weight: 0.0,
            preferred_sex: "Any",
            sex_weight: 0.0,
            preferred_states: [],
            state_weight: 0.15
        };
    }
}

/**
 * Ask Groq to name all 5 segments in one call based on persona profiles + the idea.
 * Returns an array of 5 name strings in the same order as the input segments.
 */
async function nameSegmentsWithGroq(idea, targetAudience, rawSegments) {
    console.log('🏷️ [NAMING] Asking Groq to name segments...');

    // Build a compact summary of each segment to send to Groq
    const segmentSummaries = rawSegments.map((g, i) => {
        const topPersonas = g.personas.slice(0, 5);
        const occupations = [...new Set(topPersonas.map(p => p.metadata.occupation || 'Unknown'))];
        const ages = topPersonas.map(p => p.metadata.age).filter(Boolean);
        const ageRange = ages.length ? `${Math.min(...ages)}-${Math.max(...ages)}` : 'Unknown';
        const states = [...new Set(topPersonas.map(p => p.metadata.state || 'Unknown'))].slice(0, 2);
        const edu = [...new Set(topPersonas.map(p => p.metadata.education_level || 'Unknown'))].slice(0, 2);
        const languages = [...new Set(topPersonas.map(p => p.metadata.first_language).filter(Boolean))].slice(0, 2);
        const maritalMix = topPersonas.filter(p => p.metadata.marital_status === 'Currently Married').length;

        return {
            index: i,
            zone: g.zone,
            age_range: ageRange,
            top_occupations: occupations.slice(0, 3),
            top_states: states,
            education_levels: edu,
            primary_languages: languages,
            married_percent: Math.round((maritalMix / topPersonas.length) * 100),
            avg_relevance_score: Math.round(g.avgScore * 100)
        };
    });

    const systemPrompt = `You are naming audience segments for a startup idea validation tool.
Given an idea, its target audience, and demographic summaries of 5 persona clusters,
return a short descriptive name for each cluster that:
- Reflects WHO these people are in relation to the idea (not just their location or job title)
- Is 3-5 words max
- Sounds like a real audience archetype (e.g. "Young Urban Professionals", "Aspiring First-time Buyers", "Budget-Conscious Students")
- Is distinct from the other segment names

RESPONSE FORMAT (JSON only, no markdown):
{
  "segment_names": ["Name for segment 0", "Name for segment 1", "Name for segment 2", "Name for segment 3", "Name for segment 4"]
}

Return exactly 5 names in the same order as the input segments.`;

    const userPrompt = `IDEA: ${idea}
TARGET AUDIENCE: ${targetAudience}

SEGMENT SUMMARIES:
${JSON.stringify(segmentSummaries, null, 2)}`;

    try {
        const result = await generateAIResponse(systemPrompt, userPrompt, 0.4);
        if (!result?.segment_names || result.segment_names.length < rawSegments.length) {
            throw new Error('Groq returned incomplete segment names');
        }
        console.log('✅ [NAMING] Segment names:', result.segment_names);
        return result.segment_names;
    } catch (err) {
        console.error('⚠️ [NAMING] Groq naming failed, using fallback names:', err.message);
        // Fallback: zone + education label (better than occupation word)
        return rawSegments.map(g => {
            const eduLabel = (g.feature || 'General');
            return `${g.zone} ${eduLabel} Audience`;
        });
    }
}

/**
 * Main Persona Retrieval Route
 */
router.post('/retrieve-personas', async (req, res) => {
    try {
        const { idea, targetAudience, industry, businessModel, state, sex, ageMin, ageMax } = req.body;
        console.log(`[CLOUD-SEARCH] Idea: "${idea.substring(0, 50)}..." | Target: "${targetAudience?.substring(0, 30)}..."`);

        // 0. Get Groq scoring rubric — runs in parallel with embedding for speed
        const weightedQueryText = `
            TARGET AUDIENCE: ${targetAudience} ${targetAudience} ${targetAudience}
            CORE IDEA: ${idea}
            INDUSTRY: ${industry || 'General'}
            BUSINESS MODEL: ${businessModel || 'Any'}
        `.trim();

        const [vector, criteria, zepContext] = await Promise.all([
            getEmbedding(weightedQueryText),
            getCriteriaFromGroq(idea, targetAudience, industry, businessModel),
            buildIdeaContext(idea, targetAudience, industry, businessModel)
        ]);

        // 2. Search Pinecone
        console.log(`🌲 [PINECONE] Searching Cloud Brain for top weighted matches...`);
        const searchResults = await index.query({
            vector: vector,
            topK: 500, // Increased to 500 for better clustering pool
            includeMetadata: false
        });

        const matchedIds = searchResults.matches.map(m => parseInt(m.id));
        console.log(`✅ [PINECONE] Found ${matchedIds.length} potential matches.`);

        if (matchedIds.length === 0) {
            matchedIds.push(...Array.from({length: 50}, (_, i) => i));
        }

        const matchScores = {};
        searchResults.matches.forEach(m => {
            matchScores[parseInt(m.id)] = m.score;
        });

        // 3. Fetch Details from Hostinger MySQL
        console.log(`🗄️ [HOSTINGER MYSQL] Filtering and fetching text details...`);
        
        let sql = `SELECT * FROM personas WHERE id IN (?)`;
        const params = [matchedIds];

        if (state && state !== "All India") { sql += " AND state = ?"; params.push(state); }

        let rows = [];
        try {
            const [queryRows] = await pool.query(sql, params);
            rows = queryRows;
            
            // Even if query succeeds, some rows might not have names or might have generic names
            rows = queryRows.map(r => {
                let meta = {};
                try {
                    if (r.full_metadata) {
                        meta = typeof r.full_metadata === 'string' 
                            ? JSON.parse(r.full_metadata) 
                            : r.full_metadata;
                    }
                } catch (e) {
                    console.warn(`[MYSQL] Could not parse full_metadata for ID ${r.id}`);
                }

                return {
                    ...meta, // Primary data from JSON blob
                    ...r,    // Override with dedicated columns if they exist
                    name: (r.name && !r.name.toLowerCase().includes('persona') && !r.name.toLowerCase().includes('unknown')) 
                        ? r.name 
                        : (meta.name || generateRealName(r.id)),
                    // Ensure rich fields always exist (dedicated col -> meta blob -> null/default)
                    hobbies: r.hobbies || meta.hobbies || null,
                    skills: r.skills || meta.skills || null,
                    first_language: r.first_language || meta.first_language || null,
                    marital_status: r.marital_status || meta.marital_status || null,
                    education_degree: r.education_degree || meta.education_degree || null,
                    cultural_background: r.cultural_background || meta.cultural_background || null,
                    career_goals_and_ambitions: r.career_goals_and_ambitions || meta.career_goals_and_ambitions || null,
                    persona: r.persona || meta.persona || null,
                    professional_persona: r.professional_persona || meta.professional_persona || null,
                };
            });

            console.log(`✅ [HOSTINGER MYSQL] Successfully retrieved ${rows.length} relevant rows.`);
        } catch (dbError) {
            console.error('⚠️ [MYSQL FALLBACK] Database unreachable, synthesizing personas...', dbError.message);
            rows = matchedIds.slice(0, 100).map(id => ({
                id: id,
                name: generateRealName(id),
                occupation: id % 3 === 0 ? "Tech Professional" : id % 3 === 1 ? "Business Owner" : "Service Sector",
                age: 22 + (id % 35),
                sex: id % 2 === 0 ? "Male" : "Female",
                state: "Maharashtra",
                zone: id % 2 === 0 ? "Urban" : "Semi-Urban",
                education_level: "Graduate",
                summary: "Standard profile synthesized during cloud vault timeout."
            }));
        }

        // 4. GROQ-GUIDED RESONANCE CALCULATOR
        const calculateResonance = (persona) => {
            // Pinecone semantic score — always 40% of total (floor of relevance)
            const pineconeScore = (matchScores[persona.id] || 0.3) * 40;

            // Remaining 60% split by criteria weights from Groq
            const c = criteria;
            let criteriaScore = 0;

            // --- Occupation match (up to occupation_weight × 60 points) ---
            if (c.occupation_weight > 0 && c.occupation_keywords?.length > 0) {
                const occText = (persona.occupation || '').toLowerCase();
                const matched = c.occupation_keywords.filter(k => occText.includes(k.toLowerCase())).length;
                const occMatch = matched / c.occupation_keywords.length;
                criteriaScore += occMatch * c.occupation_weight * 60;
            }

            // --- Zone match ---
            if (c.zone_weight > 0) {
                const zoneScore = c.zone_scores?.[persona.zone] ?? 0.5;
                criteriaScore += zoneScore * c.zone_weight * 60;
            }

            // --- Education match ---
            if (c.education_weight > 0 && c.education_keywords?.length > 0) {
                const eduText = (persona.education_level || '').toLowerCase();
                const eduMatch = c.education_keywords.some(k => eduText.includes(k.toLowerCase())) ? 1 : 0;
                criteriaScore += eduMatch * c.education_weight * 60;
            }

            // --- Age match ---
            if (c.age_weight > 0 && (c.age_min !== null || c.age_max !== null)) {
                const age = persona.age || 0;
                const minOk = c.age_min === null || age >= c.age_min;
                const maxOk = c.age_max === null || age <= c.age_max;
                const ageMatch = (minOk && maxOk) ? 1 : 0.2; // 0.2 partial credit for outside range
                criteriaScore += ageMatch * c.age_weight * 60;
            }

            // --- Sex match ---
            if (c.sex_weight > 0 && c.preferred_sex && c.preferred_sex !== 'Any') {
                const sexMatch = persona.sex === c.preferred_sex ? 1 : 0;
                criteriaScore += sexMatch * c.sex_weight * 60;
            }

            // --- State match ---
            if (c.state_weight > 0 && c.preferred_states?.length > 0) {
                const stateMatch = c.preferred_states.includes(persona.state) ? 1 : 0.3;
                criteriaScore += stateMatch * c.state_weight * 60;
            }

            // --- First language match (uses Groq criteria rubric if available) ---
            if (c.language_weight > 0 && c.preferred_languages?.length > 0) {
                const personaLang = (persona.first_language || '').toLowerCase();
                const langMatch = c.preferred_languages.some(l =>
                    personaLang.includes(l.toLowerCase()) || l.toLowerCase().includes(personaLang)
                ) ? 1 : 0;
                criteriaScore += langMatch * c.language_weight * 60;
            }

            return Math.min(100, Math.round(pineconeScore + criteriaScore));
        };

        const formattedPersonas = rows.map(r => {
            const safeMetadata = { ...r };
            delete safeMetadata.full_metadata;
            delete safeMetadata.embedding;
            return {
                persona_id: r.id,
                similarity_score: calculateResonance(r) / 100,
                metadata: safeMetadata
            };
        }).sort((a, b) => b.similarity_score - a.similarity_score);

        // 5. FEATURE-BASED DYNAMIC SEGMENTATION
        // Filter to only top-scoring personas before segmenting
        const MIN_RESONANCE = 0.10; // Only segment personas with >10% match
        const relevantPersonas = formattedPersonas.filter(p => p.similarity_score >= MIN_RESONANCE);
        // Graceful fallback: if fewer than 20 pass the threshold, use top 100 by score
        const poolToSegment = relevantPersonas.length >= 20 ? relevantPersonas : formattedPersonas.slice(0, 100);

        // Group by education_level + zone — creates meaningful demographic segments
        const groups = {};
        poolToSegment.forEach(p => {
            const edu = (p.metadata.education_level || "General").split(' ')[0];
            const zone = p.metadata.zone || "Urban";
            const key = `${zone}_${edu}`;
            if (!groups[key]) groups[key] = { key, personas: [], zone, feature: edu };
            groups[key].personas.push(p);
        });

        // Sort groups by average similarity score (relevance), NOT by size
        const sortedGroups = Object.values(groups)
            .map(g => ({
                ...g,
                avgScore: g.personas.reduce((sum, p) => sum + p.similarity_score, 0) / (g.personas.length || 1)
            }))
            .sort((a, b) => b.avgScore - a.avgScore);

        const top5Groups = sortedGroups.slice(0, 5);

        // Ask Groq to name all 5 segments in one call
        const segmentNames = await nameSegmentsWithGroq(idea, targetAudience, top5Groups);

        const segments = top5Groups.map((g, index) => {
            const topPersonas = g.personas.slice(0, 10);
            const avgResonance = Math.round(
                topPersonas.reduce((acc, p) => acc + p.similarity_score, 0) / topPersonas.length * 100
            );
            const ages = topPersonas.map(p => p.metadata.age).filter(Boolean);

            // Rich profile fields from new DB columns
            const languages = [...new Set(topPersonas.map(p => p.metadata.first_language).filter(Boolean))].slice(0, 2);
            const maritalMix = topPersonas.filter(p => p.metadata.marital_status === 'Currently Married').length;
            const sexCounts = topPersonas.reduce((a, p) => { a[p.metadata.sex || 'Unknown'] = (a[p.metadata.sex || 'Unknown'] || 0) + 1; return a; }, {});
            const dominantSex = Object.entries(sexCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Mixed';

            return {
                segment_id: `seg_${index}`,
                segment_name: segmentNames[index] || `Segment ${index + 1}`,
                count: topPersonas.length,
                resonance_score: avgResonance,
                profile: {
                    dominant_state: topPersonas[0]?.metadata.state || 'N/A',
                    dominant_occupation: [...new Set(topPersonas.map(p => p.metadata.occupation))].slice(0, 2).join(", "),
                    dominant_zone: g.zone,
                    dominant_sex: dominantSex,
                    age_range: ages.length ? `${Math.min(...ages)}-${Math.max(...ages)}` : 'N/A',
                    primary_languages: languages,
                    married_percent: Math.round((maritalMix / topPersonas.length) * 100),
                    education_mix: g.feature || 'General',
                },
                personas: topPersonas
            };
        });

        if (segments.length === 0) {
            segments.push({
                segment_id: "seg_fallback",
                segment_name: "General Audience",
                count: 0,
                profile: { dominant_state: "N/A", dominant_occupation: "Mixed", dominant_zone: "N/A", dominant_sex: "N/A", age_range: "N/A" },
                personas: []
            });
        }

        // UPGRADE 1: Deep Persona Enrichment — enrich top 3 per segment
        let enrichedSegments = segments;
        try {
            enrichedSegments = await enrichSegments(segments, { idea, targetAudience, industry, businessModel }, 3);
            console.log('✅ [ENRICH] Persona enrichment complete.');
        } catch (enrichErr) {
            console.warn('⚠️ [ENRICH] Enrichment failed, using unenriched segments:', enrichErr.message);
            enrichedSegments = segments;
        }

        res.json({
            success: true,
            totalMatched: formattedPersonas.length,
            personas: formattedPersonas,
            segments: enrichedSegments,
            query: idea,
            marketContext: zepContext ? {
                competitors: zepContext.competitors,
                risks: zepContext.risks,
                trends: zepContext.trends,
                graphId: zepContext.graphId,
            } : null,
        });

    } catch (error) {
        console.error('[CLOUD-API ERROR]', error.message);
        res.status(500).json({ success: false, error: 'Searching error. Check your .env credentials.' });
    }
});

// Helper for states list
router.get('/states', (req, res) => {
    res.json({ success: true, states: ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Punjab", "Rajasthan", "Tamil Nadu", "Telangana", "Uttar Pradesh", "West Bengal", "Delhi"] });
});

/**
 * Route: Test a specific segment (Called during the "Results" loading)
 */
router.post('/test-segment', async (req, res) => {
    try {
        const { idea, segment, zepContext } = req.body;
        console.log(`🧪 Testing resonance for segment: ${segment.segment_name}`);
        
        // Attach zepContext to idea for segmentTest to use
        const ideaWithContext = {
            ...idea,
            zepContext: zepContext?.groqContext || null,
        };
        
        const testResult = await testSegmentResonance(ideaWithContext, segment);
        
        res.json({
            success: true,
            testResult: testResult
        });
    } catch (error) {
        console.error('[TEST-SEGMENT ERROR]', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Route: Global simulation (Legacy support for pulse dashboard)
 */
router.post('/simulate', async (req, res) => {
    try {
        const { idea, segments } = req.body;
        console.log(`📡 Simulating resonance across ${segments.length} segments`);
        
        // Run tests in parallel
        const results = await Promise.all(segments.map(async (s) => {
            const testResult = await testSegmentResonance(idea, s);
            return {
                ...s,
                testResult
            };
        }));

        res.json({
            success: true,
            results: results
        });
    } catch (error) {
        console.error('[SIMULATE ERROR]', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * Route: Generate high-level insights from all segment results
 */
router.post('/generate-insights', async (req, res) => {
    try {
        const { idea, segmentsWithResults } = req.body;
        console.log(`🧠 Generating global insights for idea: "${idea?.idea?.substring(0, 50)}..."`);

        // Prepare concise summaries for the AI
        const segmentSummaries = (segmentsWithResults || []).map(s => {
            const tr = s.testResult || {};
            return {
                name: s.segment_name,
                resonanceScore: tr.resonanceScore,
                verdict: tr.verdict,
                willingnessToPay: tr.willingnessToPay,
                topKeyDrivers: (tr.keyDrivers || []).slice(0, 2),
                topFrictionPoints: (tr.frictionPoints || []).slice(0, 2)
            };
        });

        const systemPrompt = `You are a market research analyst. Based on simulation results across multiple persona segments, generate a structured report.

RESPONSE FORMAT (JSON only, no markdown):
{
  "insights": [
    {
      "title": "Short punchy insight headline (5-8 words)",
      "evidence": "1-2 sentences citing specific patterns from the data",
      "analysis": "2-3 sentences explaining what this means for the founder and what action to take"
    }
  ],
  "nextSteps": [
    "Specific, actionable recommendation #1 (one sentence)",
    "Specific, actionable recommendation #2 (one sentence)",
    "Specific, actionable recommendation #3 (one sentence)"
  ]
}

Generate exactly 3 insights and exactly 3 nextSteps. Be specific to the data provided, not generic. Reference actual segment names, scores, and friction points from the data.`;

        const userPrompt = `
STARTUP IDEA:
- Idea: ${idea?.idea}
- Industry: ${idea?.industry}
- Target Audience: ${idea?.targetAudience}

SIMULATION AGGREGATE DATA:
${JSON.stringify(segmentSummaries, null, 2)}
`;

        const result = await generateAIResponse(systemPrompt, userPrompt, 0.4);

        if (!result) {
            throw new Error("AI Engine failed to return a structured insight report.");
        }

        res.json({
            success: true,
            insights: result.insights,
            nextSteps: result.nextSteps
        });

    } catch (error) {
        console.error('[GENERATE-INSIGHTS ERROR]', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;