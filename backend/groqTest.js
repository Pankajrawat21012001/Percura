const { generateAIResponse } = require("./engine/groqService");

async function run() {
    try {
        console.log("Starting test...");
        const result = await generateAIResponse(
            "You are a test bot. Return a JSON object with a greeting.",
            "Say hello.",
            0.5
        );
        console.log("Result:", result);
    } catch (e) {
        console.error("Uncaught error:", e);
    }
}
run();
