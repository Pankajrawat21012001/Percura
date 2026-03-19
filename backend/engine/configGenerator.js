/**
 * Simulation Configuration Generator
 * 
 * Uses Groq to dynamically generate simulation parameters (virality, churn, thresholds)
 * based on the specifics of the idea, industry, and target audience.
 */

const { generateAIResponse } = require('./groqService');

// In-memory cache to prevent re-generating config for the same idea
const configCache = new Map();

async function generateSimulationConfig(ideaText, industry, targetAudience) {
    const cacheKey = `${ideaText}::${industry}::${targetAudience}`;
    
    if (configCache.has(cacheKey)) {
        console.log(`⚡ [CONFIG] Using cached simulation config for idea`);
        return configCache.get(cacheKey);
    }

    console.log(`⚙️ [CONFIG] Generating dynamic simulation parameters for "${industry}"...`);

    const systemPrompt = `You are an expert market analyst configuring a behavioral simulation for a new product.
Your job is to determine the statistical parameters for the simulation based on the product's industry and target audience.

RESPONSE FORMAT (JSON only):
{
  "discoveryRates": {
    "Innovator": 0.40,
    "Early Adopter": 0.25,
    "Early Majority": 0.10,
    "Late Majority": 0.05,
    "Laggard": 0.02
  },
  "peerInfluenceChance": 0.30,
  "churnThreshold": 0.40,
  "conversionThreshold": 0.70,
  "seedEvents": [
    "A popular tech influencer reviewed the product.",
    "The product was featured on a major news site."
  ]
}

CALIBRATION RULES:
1. discoveryRates: How likely is someone to discover this product organically each week? (Max 1.0)
   - Highly viral/social apps > 0.60 for Innovators
   - Enterprise/B2B tools < 0.25 for Innovators
2. peerInfluenceChance: How likely are users to talk about it? (0.0 to 1.0)
   - Social/consumer: 0.4 - 0.7
   - B2B/Niche: 0.1 - 0.3
3. churnThreshold: Sentiment score below which a user abandons the product (0.0 to 1.0)
   - Essential utilities context: 0.2 - 0.3 (high tolerance)
   - Nice-to-have/Luxury: 0.5 - 0.6 (low tolerance)
4. conversionThreshold: Sentiment score required to "convert/buy" (0.0 to 1.0)
   - Free/Cheap apps: 0.5 - 0.65
   - Expensive/High-friction: 0.75 - 0.85
5. seedEvents: Generate 2-4 realistic marketing/PR events that kick off week 1 of the simulation.`;

    const userPrompt = `PRODUCT: "${ideaText}"
INDUSTRY: ${industry || 'General'}
TARGET AUDIENCE: ${targetAudience || 'General Consumers'}

Generate the simulation parameters. Return strictly valid JSON.`;

    try {
        const result = await generateAIResponse(systemPrompt, userPrompt, 0.4);
        
        if (!result || !result.discoveryRates) {
            throw new Error("Invalid format returned by LLM");
        }
        
        // Ensure values are numbers and clamped to sane ranges
        const clamp = (val, min, max) => Math.max(min, Math.min(max, Number(val) || min));
        
        const config = {
            discoveryRates: {
                'Innovator': clamp(result.discoveryRates.Innovator, 0.05, 0.95),
                'Early Adopter': clamp(result.discoveryRates['Early Adopter'], 0.02, 0.80),
                'Early Majority': clamp(result.discoveryRates['Early Majority'], 0.01, 0.60),
                'Late Majority': clamp(result.discoveryRates['Late Majority'], 0.01, 0.40),
                'Laggard': clamp(result.discoveryRates.Laggard, 0.00, 0.20)
            },
            peerInfluenceChance: clamp(result.peerInfluenceChance, 0.05, 0.90),
            churnThreshold: clamp(result.churnThreshold, 0.1, 0.9),
            conversionThreshold: clamp(result.conversionThreshold, 0.5, 0.95),
            seedEvents: Array.isArray(result.seedEvents) ? result.seedEvents.slice(0, 4) : [
                "Product launched publicly",
                "Featured in niche community forums"
            ]
        };

        // Cache the config (cap at 100 entries)
        if (configCache.size > 100) {
            const firstKey = configCache.keys().next().value;
            configCache.delete(firstKey);
        }
        configCache.set(cacheKey, config);
        
        console.log(`✅ [CONFIG] Generated config: ConvThr=${config.conversionThreshold}, Peer=${config.peerInfluenceChance}`);
        return config;

    } catch (err) {
        console.warn('⚠️ [CONFIG] Failed to generate simulation config, using strict defaults:', err.message);
        return getDefaultConfig();
    }
}

function getDefaultConfig() {
    return {
        discoveryRates: {
            'Innovator': 0.40,
            'Early Adopter': 0.25,
            'Early Majority': 0.10,
            'Late Majority': 0.05,
            'Laggard': 0.02
        },
        peerInfluenceChance: 0.30,
        churnThreshold: 0.30,
        conversionThreshold: 0.72,
        seedEvents: ["Initial product announcement"]
    };
}

module.exports = { generateSimulationConfig };
