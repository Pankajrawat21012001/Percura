/**
 * Multi-Step Report Agent
 * 
 * Uses a Plan → Retrieve → Generate → Merge architecture:
 * 1. Gathers raw simulation stats
 * 2. Queries Zep graph for evidence per section
 * 3. Generates each report section independently
 * 4. Merges into a single markdown report
 */

const { generateTextResponse, generateAIResponse } = require('./groqService');
const { searchSimulationGraph } = require('./zepService');

/**
 * Generate a comprehensive, multi-section markdown report.
 */
async function generateIntelligentReport(idea, snapshots, segments, graphId) {
    console.log(`🧠 [REPORT AGENT] Starting multi-step report synthesis...`);
    
    // ── Step 1: Gather raw stats ──
    const finalSnapshot = snapshots[snapshots.length - 1];
    const totalPersonas = segments.reduce((acc, seg) => acc + (seg.personas?.length || 0), 0);
    const convertedCount = finalSnapshot?.totalConverted || 0;
    const churnedCount = finalSnapshot?.totalChurned || 0;
    const activeCount = finalSnapshot?.totalActive || 0;
    const ideaText = idea?.idea || 'Unknown';
    const targetAudience = idea?.targetAudience || 'General';
    const industry = idea?.industry || 'General';

    // Build weekly adoption data string
    const weeklyData = snapshots.map(s => 
        `Week ${s.week}: ${(s.overallAdoptionCurve * 100).toFixed(1)}% adoption, ${s.totalConverted || 0} converted, ${s.totalChurned || 0} churned`
    ).join('\n');

    // Build segment ranking data
    const segmentData = (finalSnapshot?.segments || []).map(seg =>
        `${seg.segmentName}: avgSentiment=${seg.avgSentiment}, converted=${seg.convertedCount}/${seg.totalPersonas}, churned=${seg.churnedCount}/${seg.totalPersonas}`
    ).join('\n');

    // ── Step 2: Retrieve Zep evidence (3 parallel queries) ──
    let adoptionEvidence = '';
    let frictionEvidence = '';
    let successEvidence = '';

    if (graphId) {
        console.log(`🔍 [REPORT AGENT] Querying Zep graph for evidence...`);
        const queries = [
            searchSimulationGraph(graphId, "What was the adoption trajectory? Did it accelerate or stall?", 5),
            searchSimulationGraph(graphId, "What friction points or objections did personas raise?", 5),
            searchSimulationGraph(graphId, "What drove conversions? What made personas excited?", 5)
        ];

        try {
            const [adoptionRes, frictionRes, successRes] = await Promise.allSettled(queries);
            if (adoptionRes.status === 'fulfilled' && adoptionRes.value?.length > 0) {
                adoptionEvidence = `\nGRAPH EVIDENCE:\n${adoptionRes.value.join('\n')}`;
            }
            if (frictionRes.status === 'fulfilled' && frictionRes.value?.length > 0) {
                frictionEvidence = `\nGRAPH EVIDENCE:\n${frictionRes.value.join('\n')}`;
            }
            if (successRes.status === 'fulfilled' && successRes.value?.length > 0) {
                successEvidence = `\nGRAPH EVIDENCE:\n${successRes.value.join('\n')}`;
            }
        } catch (e) {
            console.warn(`[REPORT AGENT] Zep queries failed: ${e.message}`);
        }
    }

    // ── Step 3: Generate each section independently ──
    const baseContext = `IDEA: "${ideaText}"
TARGET: ${targetAudience}
INDUSTRY: ${industry}
TOTAL PERSONAS: ${totalPersonas}
FINAL: ${convertedCount} converted, ${churnedCount} churned, ${activeCount} active`;

    const sectionPrompts = [
        {
            name: 'Executive Summary',
            system: `You are a ruthless market analyst. Write ONE powerful paragraph (max 4 sentences) summarizing whether this startup idea will succeed or fail in India. USE **BOLDING** FOR NUMBERS. Do NOT include headers — just the core text.`,
            user: `${baseContext}\n\nWEEKLY DATA:\n${weeklyData}\n${adoptionEvidence}\n${successEvidence}`
        },
        {
            name: 'Adoption Curve Analysis',
            system: `You are a growth analyst. Analyze the week-by-week trajectory. Format as a bulleted list. Each bullet MUST start with **Week X: [Category]** followed by the analysis. No header.`,
            user: `${baseContext}\n\nWEEKLY DATA:\n${weeklyData}\n${adoptionEvidence}`
        },
        {
            name: 'Segment Resonance Ranking',
            system: `You are a market segmentation expert. Rank performing segments. Format as a bulleted list. Each bullet MUST be **Segment Name**: One sentence of depth why they performed this way. No header.`,
            user: `${baseContext}\n\nSEGMENT DATA:\n${segmentData}\n${successEvidence}`
        },
        {
            name: 'Key Friction Points',
            system: `You are a product strategist. Identify top 3-5 churn reasons. Format as a bulleted list. Each bullet MUST be **Reason Category**: Why this matters in India. No header.`,
            user: `${baseContext}\n\nCHURN DATA: ${churnedCount} out of ${totalPersonas} churned\n${frictionEvidence}`
        },
        {
            name: 'Launch Recommendations',
            system: `You are a startup advisor. Give 5 specific action points. Format as a bulleted list. Each MUST be **Verb-based Action**: Detailed tactical next step. No header.`,
            user: `${baseContext}\n\n${frictionEvidence}\n${successEvidence}`
        }
    ];

    console.log(`📝 [REPORT AGENT] Generating ${sectionPrompts.length} sections in parallel...`);
    
    const sectionResults = await Promise.allSettled(
        sectionPrompts.map(sp => generateTextResponse(sp.system, sp.user, 0.4))
    );

    // ── Step 4: Merge into final markdown ──
    const sections = sectionPrompts.map((sp, i) => {
        const result = sectionResults[i];
        const content = result.status === 'fulfilled' && result.value
            ? result.value
            : '_Analysis unavailable for this section._';
        return `## ${sp.name}\n\n${content}`;
    });

    const finalReport = `# Market Validation Report\n\n**Idea:** ${ideaText}\n**Cohort:** ${totalPersonas} personas | **Converted:** ${convertedCount} | **Churned:** ${churnedCount}\n\n---\n\n${sections.join('\n\n---\n\n')}`;

    console.log(`✅ [REPORT AGENT] Multi-step report complete (${finalReport.length} chars)`);
    return finalReport;
}

module.exports = {
    generateIntelligentReport
};
