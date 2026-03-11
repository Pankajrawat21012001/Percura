
const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');
const { Pinecone } = require('@pinecone-database/pinecone');
const axios = require('axios');
const { testSegmentResonance } = require('../engine/segmentTest');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

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

const HF_TOKEN = process.env.HF_TOKEN;
const EMBED_MODEL = "sentence-transformers/all-MiniLM-L6-v2";

/**
 * Helper: Generate Embedding via Hugging Face API
 */
async function getEmbedding(text) {
    try {
        console.log(`🧠 [CLOUD] Requesting AI Vector from Hugging Face...`);
        // The standard feature-extraction endpoint for sentence-transformers
        const response = await axios.post(
            `https://api-inference.huggingface.co/pipeline/feature-extraction/${EMBED_MODEL}`,
            { inputs: text }, // Note: passing just text instead of [text] array
            { headers: { Authorization: `Bearer ${HF_TOKEN}` } }
        );
        
        // HF can return an array of arrays when providing a list of inputs
        const vector = Array.isArray(response.data[0]) ? response.data[0] : response.data;
        console.log(`✅ [CLOUD] Successfully generated ${vector.length}-dimension vector.`);
        return vector;
    } catch (err) {
        console.error('❌ HF Embedding Error:', err.message, err.response?.data || '');
        console.log('⚠️ Using Fallback Zero-Vector due to API error.');
        return Array(384).fill(0); // Fallback
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
 * Main Persona Retrieval Route
 */
router.post('/retrieve-personas', async (req, res) => {
    try {
        const { idea, targetAudience, industry, businessModel, state, sex, ageMin, ageMax } = req.body;
        console.log(`[CLOUD-SEARCH] Idea: "${idea.substring(0, 50)}..." | Target: "${targetAudience?.substring(0, 30)}..."`);

        // 1. Get AI Vector (384 Dimensions)
        // We give more weight to the Target Audience by repeating it in the query string
        // and including industry/business model context.
        const weightedQueryText = `
            TARGET AUDIENCE: ${targetAudience} ${targetAudience} ${targetAudience}
            CORE IDEA: ${idea}
            INDUSTRY: ${industry || 'General'}
            BUSINESS MODEL: ${businessModel || 'Any'}
        `.trim();
        
        const vector = await getEmbedding(weightedQueryText);

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
        
        let sql = "SELECT * FROM personas WHERE id IN (?)";
        const params = [matchedIds];

        if (state && state !== "All India") { sql += " AND state = ?"; params.push(state); }
        if (sex && sex !== "All") { sql += " AND sex = ?"; params.push(sex); }
        if (ageMin) { sql += " AND age >= ?"; params.push(ageMin); }
        if (ageMax) { sql += " AND age <= ?"; params.push(ageMax); }

        let rows = [];
        try {
            const [queryRows] = await pool.query(sql, params);
            rows = queryRows;
            
            // Even if query succeeds, some rows might not have names or might have generic names
            rows = rows.map(r => ({
                ...r,
                name: (r.name && !r.name.includes("Persona")) ? r.name : generateRealName(r.id)
            }));

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

        // 4. WEIGHTED RESONANCE CALCULATOR
        const calculateResonance = (persona) => {
            let score = (matchScores[persona.id] || 0.4) * 25;
            const pText = `${persona.occupation} ${persona.summary} ${persona.education_level}`.toLowerCase();
            const targetLower = (targetAudience || "").toLowerCase();
            
            const targetKeywords = targetLower.split(/[,\s]+/).filter(k => k.length > 3);
            let targetMatches = 0;
            targetKeywords.forEach(k => { if (pText.includes(k)) targetMatches++; });
            score += Math.min(50, (targetMatches / (targetKeywords.length || 1)) * 100);

            if (industry && pText.includes(industry.toLowerCase())) score += 15;
            if (businessModel && pText.includes(businessModel.toLowerCase())) score += 10;

            return Math.min(100, Math.round(score));
        };

        const formattedPersonas = rows.map(r => ({
            persona_id: r.id,
            similarity_score: calculateResonance(r) / 100,
            metadata: { ...r }
        })).sort((a, b) => b.similarity_score - a.similarity_score);

        // 5. FEATURE-BASED DYNAMIC SEGMENTATION
        const groups = {};
        formattedPersonas.forEach(p => {
            const occ = (p.metadata.occupation || "General").split(' ')[0]; // Use first word of occupation as base feature
            const zone = p.metadata.zone || "Urban";
            const key = `${zone} ${occ}`.trim();
            if (!groups[key]) groups[key] = { key, personas: [], zone, feature: occ };
            groups[key].personas.push(p);
        });

        // Ensure we handle at least 5 segments of 10 personas
        const sortedGroups = Object.values(groups)
            .sort((a, b) => b.personas.length - a.personas.length);

        const segments = sortedGroups.slice(0, 5).map((g, index) => {
            const topPersonas = g.personas.slice(0, 10);
            
            // Feature-based Naming: Extract most frequent word across this group's occupations
            const words = g.personas.flatMap(p => (p.metadata.occupation || "").split(/\s+/));
            const wordFreq = {};
            words.forEach(w => { if(w.length > 3) wordFreq[w] = (wordFreq[w] || 0) + 1; });
            const topWord = Object.keys(wordFreq).sort((a,b) => wordFreq[b] - wordFreq[a])[0] || g.feature;
            
            const segmentName = `${g.zone} ${topWord} Cluster`.trim();
            const avgResonance = Math.round(topPersonas.reduce((acc, p) => acc + p.similarity_score, 0) / topPersonas.length * 100);
            
            const ages = topPersonas.map(p => p.metadata.age);

            return {
                segment_id: `seg_${index}`,
                segment_name: segmentName,
                count: topPersonas.length,
                resonance_score: avgResonance,
                profile: {
                    dominant_state: topPersonas[0].metadata.state,
                    dominant_occupation: [...new Set(topPersonas.map(p => p.metadata.occupation))].slice(0, 2).join(", "),
                    dominant_zone: g.zone,
                    dominant_sex: "Mixed",
                    age_range: `${Math.min(...ages)}-${Math.max(...ages)}`
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

        res.json({
            success: true,
            totalMatched: formattedPersonas.length,
            personas: formattedPersonas,
            segments: segments,
            query: idea
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
        const { idea, segment } = req.body;
        console.log(`🧪 Testing resonance for segment: ${segment.segment_name}`);
        
        const testResult = await testSegmentResonance(idea, segment);
        
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

module.exports = router;
