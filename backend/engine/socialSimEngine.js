/**
 * Social Platform Simulation Engine (India Context)
 * 
 * Simulates viral spread and social interactions across WhatsApp, Instagram, and X/Twitter.
 * Uses LLM calls to generate authentic, persona-specific content for each social action.
 */

const { generateTextResponse, generateAIResponse } = require('./groqService');
const { addSimulationEvent } = require('./zepService');

// Platform constants
const PLATFORMS = {
    WHATSAPP: { name: 'WhatsApp', viralMultiplier: 1.5, trustFactor: 0.9, actions: ['FORWARDED', 'VOICE_NOTE', 'STATUS_UPDATE'] },
    INSTAGRAM: { name: 'Instagram', viralMultiplier: 2.0, trustFactor: 0.5, actions: ['POSTED_STORY', 'REELS_REVIEW', 'COMMENTED'] },
    YOUTUBE: { name: 'YouTube', viralMultiplier: 1.2, trustFactor: 0.8, actions: ['COMMENTED', 'SHORT_REVIEW'] },
    X: { name: 'X', viralMultiplier: 2.5, trustFactor: 0.4, actions: ['TWEETED', 'QUOTE_RETWEETED', 'REPLIED'] }
};

// Platform-specific content templates (used as LLM context)
const PLATFORM_TEMPLATES = {
    WHATSAPP: {
        style: 'informal Hindi-English mix, like a message to a family WhatsApp group',
        examples: [
            'Bhai check this out, mujhe bahut accha laga ye app 👍',
            'Guys has anyone tried this? My friend was raving about it',
            'Forwarded: *Must try this new service* - very useful for daily needs'
        ]
    },
    INSTAGRAM: {
        style: 'casual and visual, with relevant hashtags and emojis',
        examples: [
            'Just tried this amazing new product! 🔥 #earlyadopter #review',
            'Honest review: Is this worth the hype? Swipe to find out ➡️',
            'POV: When you finally find a product that actually works 💯'
        ]
    },
    X: {
        style: 'opinionated, concise, Twitter-style hot takes',
        examples: [
            'Hot take: This product could actually disrupt the market in India. Here\'s why 🧵',
            'Tried the new [product]. Verdict? Mixed feelings. Thread below.',
            'Unpopular opinion: We don\'t need another [category] app. But this one is different.'
        ]
    }
};

/**
 * Generate authentic social media content for a persona using LLM
 */
async function generateSocialContent(persona, platform, action, ideaText, sentiment) {
    const ep = persona.enrichedProfile || {};
    const template = PLATFORM_TEMPLATES[platform.toUpperCase()] || PLATFORM_TEMPLATES.WHATSAPP;
    const personaName = persona.name || ep.fullName || 'Unknown';
    const lang = ep.languagePreference || 'Hindi-English mix';

    const systemPrompt = `You are writing a single social media post as an Indian consumer named ${personaName}.
Write in ${template.style}.
The post should be about their experience with: "${ideaText}"
Their sentiment is ${sentiment > 0.7 ? 'very positive' : sentiment > 0.4 ? 'mixed/curious' : 'negative/skeptical'}.
Language: ${lang}

RULES:
- ONE post only, max 2 lines
- Must feel authentic to an Indian ${platform} user
- Include 1-2 emojis max
- No hashtags on WhatsApp
- Reference examples: ${template.examples.slice(0, 2).join(' | ')}`;

    const userPrompt = `Write the ${platform} post now. Just the post text, nothing else.`;

    try {
        const content = await generateTextResponse(systemPrompt, userPrompt, 0.8);
        if (content && content.length > 5 && content.length < 500) {
            return content.replace(/^["']|["']$/g, '').trim(); // Strip wrapping quotes
        }
    } catch (e) {
        // Fall through to template
    }

    // Fallback templates if LLM fails
    const fallbacks = {
        WHATSAPP: `Check this out guys: ${ideaText.substring(0, 40)}... ${sentiment > 0.6 ? '👍' : '🤔'}`,
        INSTAGRAM: `My honest take on ${ideaText.substring(0, 30)}... ${sentiment > 0.6 ? '🔥' : '👀'} #review`,
        X: `${sentiment > 0.6 ? 'Impressed by' : 'Mixed feelings about'} ${ideaText.substring(0, 40)}...`,
        YOUTUBE: `Review: ${ideaText.substring(0, 50)}... ${sentiment > 0.6 ? 'Worth it!' : 'Not sure yet.'}`
    };
    return fallbacks[platform.toUpperCase()] || fallbacks.WHATSAPP;
}

/**
 * Generate a reaction to someone else's post (for viral chains)
 */
async function generateReaction(reactor, originalPost, platform, ideaText) {
    const ep = reactor.enrichedProfile || {};
    const reactorName = reactor.name || ep.fullName || 'Someone';
    const sentiment = reactor.socialState?.sentiment || 0.5;

    const systemPrompt = `You are ${reactorName}, an Indian consumer on ${platform}.
Someone in your network shared: "${originalPost}"
Your current feeling about "${ideaText}" is ${sentiment > 0.6 ? 'positive' : sentiment > 0.4 ? 'neutral' : 'skeptical'}.

Write a SHORT reply/reaction (1 line max). Just the reply text.`;

    try {
        const reply = await generateTextResponse(systemPrompt, 'Write the reply:', 0.8);
        if (reply && reply.length > 3 && reply.length < 200) {
            return reply.replace(/^["']|["']$/g, '').trim();
        }
    } catch (e) { /* fallback */ }

    return sentiment > 0.6 ? 'Haan, I was thinking the same! 👍' : 'Hmm, not sure about this...';
}

/**
 * Run a multi-week social simulation cycle
 */
async function runSocialSimulation(segments, idea, config, weeks = 4, graphId = null) {
    console.log(`📱 [SOCIAL-SIM] Starting ${weeks}-week social simulation with LLM content...`);
    const allSocialEvents = [];
    const ideaText = idea?.idea || 'a new product';
    
    // Flatten all personas
    const population = [];
    for (const segment of segments) {
        for (const persona of (segment.personas || [])) {
            population.push({
                ...persona,
                segmentId: segment.segment_id,
                segmentName: segment.segment_name
            });
        }
    }

    if (population.length === 0) {
        console.warn(`[SOCIAL-SIM] No personas found, skipping.`);
        return [];
    }

    // Initialize network state
    population.forEach(p => {
        p.socialState = {
            hasShared: false,
            timesSeen: p.simulationState?.exposureCount || 0,
            sentiment: p.simulationState?.sentimentScore || 0.5,
            posts: [] // Track what they posted for reaction chains
        };
    });

    for (let week = 1; week <= weeks; week++) {
        const weekEvents = [];
        
        // Seed events in week 1
        if (week === 1 && config.seedEvents) {
            weekEvents.push({
                week, type: 'SOCIAL', actor: 'System', action: 'BROADCAST',
                platform: 'Web', content: config.seedEvents[0] || 'Product Launch',
                influence: 1.0, reach: population.length
            });
            population.forEach(p => p.socialState.timesSeen += 1);
        }

        // Collect personas who will share this week
        const sharers = [];
        for (const persona of population) {
            const ep = persona.enrichedProfile || {};
            const socialBehavior = ep.socialMediaBehavior || {};
            const freq = socialBehavior.postingFrequency || 'Weekly';
            const infWeight = ep.behaviorPatterns?.influenceWeight || 0.5;

            const baselineChance = (persona.socialState.timesSeen * 0.1) * persona.socialState.sentiment;
            let shouldShare = false;
            const roll = Math.random();

            if (freq === 'Daily' && roll < baselineChance + 0.3) shouldShare = true;
            if (freq === 'Weekly' && roll < baselineChance + 0.1) shouldShare = true;
            if (freq === 'Rarely' && roll < baselineChance - 0.1) shouldShare = true;
            if (persona.socialState.sentiment > 0.7 && !persona.socialState.hasShared) shouldShare = true;

            if (shouldShare) {
                sharers.push({ persona, infWeight });
            }
        }

        // Batch LLM calls for content generation (max 5 per week to control API usage)
        const batchSize = Math.min(sharers.length, 5);
        const batch = sharers.slice(0, batchSize);

        for (const { persona, infWeight } of batch) {
            persona.socialState.hasShared = true;
            const ep = persona.enrichedProfile || {};
            const socialBehavior = ep.socialMediaBehavior || {};
            const platformsUsed = Array.isArray(socialBehavior.platforms) ? socialBehavior.platforms : ['WhatsApp'];
            const platform = platformsUsed[Math.floor(Math.random() * platformsUsed.length)] || 'WhatsApp';
            const pConfig = PLATFORMS[platform.toUpperCase()] || PLATFORMS.WHATSAPP;
            const action = pConfig.actions[Math.floor(Math.random() * pConfig.actions.length)];

            // LLM-generated content
            const content = await generateSocialContent(persona, platform, action, ideaText, persona.socialState.sentiment);

            const event = {
                week, type: 'SOCIAL',
                actor: persona.name || ep.fullName || 'Unknown',
                personaId: persona.persona_id || persona.id,
                segmentName: persona.segmentName,
                action, platform, content,
                influence: infWeight,
                reach: Math.floor(infWeight * pConfig.viralMultiplier * 100)
            };
            weekEvents.push(event);
            persona.socialState.posts.push(content);

            // Viral effect: propagate to others + generate reactions
            const targetsHit = Math.min(Math.floor(event.reach * 0.1), 3); // Cap reactions at 3
            for (let i = 0; i < targetsHit; i++) {
                const target = population[Math.floor(Math.random() * population.length)];
                if (target.persona_id !== persona.persona_id) {
                    target.socialState.timesSeen += 1;

                    // Generate a reaction for the first target only (to save API calls)
                    if (i === 0 && Math.random() < 0.5) {
                        const reaction = await generateReaction(target, content, platform, ideaText);
                        weekEvents.push({
                            week, type: 'SOCIAL',
                            actor: target.name || target.enrichedProfile?.fullName || 'Unknown',
                            personaId: target.persona_id || target.id,
                            segmentName: target.segmentName,
                            action: 'REACTED', platform,
                            content: reaction,
                            influence: 0.2,
                            reach: Math.floor(0.2 * pConfig.viralMultiplier * 50)
                        });
                    }

                    // Peer influence on sentiment
                    const shift = (persona.socialState.sentiment - target.socialState.sentiment) * (pConfig.trustFactor * 0.2);
                    target.socialState.sentiment = Math.max(0, Math.min(1, target.socialState.sentiment + shift));
                }
            }
        }

        allSocialEvents.push(...weekEvents);
    }

    // Log top events to Zep
    if (graphId) {
        const topEvents = [...allSocialEvents]
            .filter(e => e.personaId)
            .sort((a, b) => (b.influence || 0) - (a.influence || 0))
            .slice(0, 3);
        for (const evt of topEvents) {
            try {
                await addSimulationEvent(
                    graphId, evt.personaId,
                    `${evt.actor} (${evt.segmentName}) ${evt.action} on ${evt.platform}: "${evt.content.substring(0, 80)}"`
                );
            } catch (e) {
                console.warn(`[SOCIAL-SIM] Graph log failed: ${e.message}`);
            }
        }
    }

    console.log(`📱 [SOCIAL-SIM] Generated ${allSocialEvents.length} social events with LLM content.`);
    return allSocialEvents;
}

module.exports = { runSocialSimulation };
