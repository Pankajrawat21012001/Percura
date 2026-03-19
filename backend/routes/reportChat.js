const express = require('express');
const router = express.Router();
const { groq } = require('../engine/groqService');
const { searchSimulationGraph } = require('../engine/zepService');

/**
 * Tool definitions available to the AI Analyst
 */
const TOOLS = [
    {
        type: "function",
        function: {
            name: "search_simulation_graph",
            description: "Search the Zep knowledge graph for direct evidence from the simulation, including persona reactions, quotes, and behaviors.",
            parameters: {
                type: "object",
                properties: {
                    query: {
                        type: "string",
                        description: "The search query, e.g. 'Why did users churn?' or 'What did they like about the pricing?'",
                    }
                },
                required: ["query"],
            },
        },
    },
    {
        type: "function",
        function: {
            name: "calculate_aggregate_metrics",
            description: "Retrieve high-level aggregate metrics from the simulation dataset (e.g. conversion rates, churn numbers).",
            parameters: {
                type: "object",
                properties: {
                    data_point: {
                        type: "string",
                        description: "The metric to look up, e.g. 'total converted', 'adoption curve', 'total personas'",
                    }
                },
                required: ["data_point"],
            },
        },
    }
];

/**
 * POST /api/report-chat
 * Ask the AI Analyst questions about the simulation data using an Agentic loop.
 */
router.post('/', async (req, res) => {
    try {
        const { message, chatHistory, graphId, simulationResult } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        console.log(`🤖 [ANALYST] Received question: "${message.substring(0, 50)}..."`);
        const executedTools = [];

        // Build system message context
        let simContext = '';
        if (simulationResult) {
            const snapshots = simulationResult.weeklySnapshots || [];
            const finalSnap = snapshots[snapshots.length - 1];
            simContext = `\n[AVAILABLE DATA SUMMARY]:\n- Total personas: ${simulationResult.personaFinalStates ? Object.keys(simulationResult.personaFinalStates).length : 'unknown'}\n- Weeks simulated: ${simulationResult.weeks || 'unknown'}\n- Final converted: ${finalSnap?.totalConverted || 0}\n- Final churned: ${finalSnap?.totalChurned || 0}\n`;
        }

        const systemMessage = {
            role: "system",
            content: `You are an expert Data Analyst and Market Researcher for the Indian market.
You analyze behavioral simulation data and answer user questions with precision.
You have access to tools. ALWAYS use "search_simulation_graph" if you need specific persona quotes or reasons.
If you need high-level numbers, use "calculate_aggregate_metrics".
Always cite specific data points from the evidence provided.
Be analytical, concise, and directly address the question. No pleasantries.
${simContext}
IDEA: ${simulationResult?.idea?.idea || 'Unknown'}`
        };

        const messages = [systemMessage];

        // Format and append chat history
        (chatHistory || []).forEach(msg => {
            messages.push({
                role: msg.sender === 'user' ? 'user' : 'assistant',
                content: msg.text
            });
        });

        // Append the current user question
        messages.push({ role: "user", content: message });

        // 1. Initial LLM Call with Tools
        console.log(`🤖 [ANALYST] Deciding on tools...`);
        const initialResponse = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: messages,
            tools: TOOLS,
            tool_choice: "auto",
        });

        const responseMessage = initialResponse.choices[0].message;
        messages.push(responseMessage); // Add assistant's tool-call response to thread

        // 2. Check for tool calls and execute them
        if (responseMessage.tool_calls) {
            for (const toolCall of responseMessage.tool_calls) {
                const functionName = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);
                let toolResult = "";

                console.log(`🔧 [ANALYST] Executing Tool: ${functionName} with args:`, args);
                executedTools.push(functionName);

                if (functionName === "search_simulation_graph") {
                    if (graphId) {
                        const zepEvidence = await searchSimulationGraph(graphId, args.query, 5);
                        toolResult = zepEvidence.length > 0 
                            ? zepEvidence.map((e, idx) => `[Evidence ${idx + 1}]: ${e}`).join('\n')
                            : "No direct evidence found in the graph for this query.";
                    } else {
                        toolResult = "Graph ID not provided; cannot search graph.";
                    }
                } else if (functionName === "calculate_aggregate_metrics") {
                    if (simulationResult) {
                        const snapshots = simulationResult.weeklySnapshots || [];
                        const finalSnap = snapshots[snapshots.length - 1] || {};
                        const statesCount = simulationResult.personaFinalStates ? Object.keys(simulationResult.personaFinalStates).length : 0;
                        toolResult = `Simulation Summary for "${args.data_point}": Total Sample=${statesCount}, Converted=${finalSnap.totalConverted || 0}, Churned=${finalSnap.totalChurned || 0}, Active=${finalSnap.totalActive || 0}. Weekly curve: ${(finalSnap.overallAdoptionCurve || 0)*100}% adoption.`;
                    } else {
                        toolResult = "Simulation result data not provided in payload.";
                    }
                }

                // Add tool result back to the conversation
                messages.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: toolResult,
                });
            }

            // 3. Final LLM Call to synthesize the answer
            console.log(`🤖 [ANALYST] Synthesizing final answer using tool results...`);
            const finalResponse = await groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: messages,
            });

            return res.json({
                success: true,
                reply: finalResponse.choices[0].message.content,
                toolsUsed: executedTools
            });
            
        } else {
            // No tools were called, the AI just answered directly
            console.log(`🤖 [ANALYST] Answered directly without tools.`);
            return res.json({
                success: true,
                reply: responseMessage.content,
                toolsUsed: []
            });
        }

    } catch (error) {
        console.error('[ANALYST ERROR]', error.message);
        res.status(500).json({
            success: false,
            error: 'AI Analyst failed to generate a response.',
            reply: "I encountered an error analyzing the simulation data. Please try again."
        });
    }
});

module.exports = router;
