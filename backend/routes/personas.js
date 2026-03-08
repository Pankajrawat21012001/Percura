
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

/**
 * Main Persona Retrieval Route
 */
router.post('/retrieve-personas', async (req, res) => {
    try {
        const { idea, targetAudience, state, sex, ageMin, ageMax } = req.body;
        console.log(`[CLOUD-SEARCH] Idea: "${idea.substring(0, 50)}..."`);

        // 1. Get AI Vector (384 Dimensions)
        const queryText = `${idea} ${targetAudience || ''}`.trim();
        const vector = await getEmbedding(queryText);

        // 2. Search Pinecone
        console.log(`🌲 [PINECONE] Searching Cloud Brain (Vector DB) for top matches...`);
        const searchResults = await index.query({
            vector: vector,
            topK: 200, // Increased from 50 to 200 to better handle metadata filtering
            includeMetadata: false
        });

        const matchedIds = searchResults.matches.map(m => parseInt(m.id));
        console.log(`✅ [PINECONE] Found ${matchedIds.length} potential matches.`);

        if (matchedIds.length === 0) {
            // Sample fallback if Pinecone is still empty
            matchedIds.push(...Array.from({length: 20}, (_, i) => i));
        }

        // Get scores from metadata
        const matchScores = {};
        searchResults.matches.forEach(m => {
            matchScores[parseInt(m.id)] = m.score;
        });

        // 3. Fetch Details from Hostinger MySQL
        console.log(`🗄️ [HOSTINGER MYSQL] Filtering and fetching text details...`);
        const connection = await mysql.createConnection(dbConfig);
        
        let sql = "SELECT * FROM personas WHERE id IN (?)";
        const params = [matchedIds];

        if (state && state !== "All India") { sql += " AND state = ?"; params.push(state); }
        if (sex && sex !== "All") { sql += " AND sex = ?"; params.push(sex); }
        if (ageMin) { sql += " AND age >= ?"; params.push(ageMin); }
        if (ageMax) { sql += " AND age <= ?"; params.push(ageMax); }

        const [rows] = await connection.query(sql, params);
        await connection.end();
        console.log(`✅ [HOSTINGER MYSQL] Successfully retrieved ${rows.length} relevant rows.`);

        // 4. Format and group for Frontend
        const formattedPersonas = rows.map(r => ({
            persona_id: r.id,
            similarity_score: matchScores[r.id] || 0.5,
            metadata: {
                name: r.name,
                occupation: r.occupation,
                age: r.age,
                sex: r.sex,
                state: r.state,
                zone: r.zone,
                education_level: r.education_level,
                summary: r.summary
            }
        })).sort((a, b) => b.similarity_score - a.similarity_score);

        // Group into multiple segments based on demographics
        const getAgeCategory = (age) => {
            if (age < 25) return "Gen Z (18-24)";
            if (age <= 35) return "Young Millennials (25-35)";
            if (age <= 45) return "Older Millennials (36-45)";
            return "Gen X & Boomers (46+)";
        };

        const groups = {};
        formattedPersonas.forEach(p => {
            const z = p.metadata.zone || "Urban";
            const ageCat = getAgeCategory(p.metadata.age);
            const key = `${z} - ${ageCat}`;
            if (!groups[key]) groups[key] = { name: key, personas: [], zone: z, ageCat };
            groups[key].personas.push(p);
        });

        // Convert to array and sort by group size (or total similarity)
        const sortedGroups = Object.values(groups).sort((a, b) => b.personas.length - a.personas.length);
        
        // Take top 5 segments at most
        const topSegmentsData = sortedGroups.slice(0, 5);
        
        const segments = topSegmentsData.map((g, index) => {
            // ONLY 10 PERSONA BEST SIMILARITY
            const topPersonas = g.personas.slice(0, 10);
            
            // derive dominant state and occupation
            const stateCounts = {};
            topPersonas.forEach(p => {
                stateCounts[p.metadata.state] = (stateCounts[p.metadata.state] || 0) + 1;
            });
            const dominantState = Object.keys(stateCounts).sort((a,b) => stateCounts[b] - stateCounts[a])[0] || "Multiple States";
            
            const occupationCounts = {};
            topPersonas.forEach(p => {
                occupationCounts[p.metadata.occupation] = (occupationCounts[p.metadata.occupation] || 0) + 1;
            });
            const dominantOccupation = Object.keys(occupationCounts).sort((a,b) => occupationCounts[b] - occupationCounts[a])[0] || "Mixed Profiles";

            return {
                segment_id: `seg_${index}`,
                segment_name: g.name,
                count: topPersonas.length,
                profile: {
                    dominant_state: dominantState,
                    dominant_occupation: dominantOccupation,
                    dominant_zone: g.zone,
                    dominant_sex: "Mixed",
                    age_range: g.ageCat
                },
                personas: topPersonas
            };
        });

        // Fallback if no matching personas are found
        if (segments.length === 0) {
            segments.push({
                segment_id: "seg_fallback",
                segment_name: "General Audience",
                count: 0,
                profile: {
                    dominant_state: "N/A",
                    dominant_occupation: "Mixed",
                    dominant_zone: "N/A",
                    dominant_sex: "N/A",
                    age_range: "N/A"
                },
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
