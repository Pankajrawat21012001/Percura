const axios = require('axios');

async function testSimulation() {
    console.log('--- Testing Phase 5, 6, 7 Features ---');
    try {
        console.log('1. Creating a project...');
        const projRes = await axios.post('http://localhost:3001/api/projects', {
            name: 'Test Project',
            description: 'Testing new features'
        });
        const projectId = projRes.data.project.id;
        console.log(`✅ Project Created: ${projectId}`);

        console.log('2. Running a simulation...');
        const simPayload = {
            idea: {
                idea: "A WhatsApp-based micro-lending platform for street food vendors in Mumbai",
                targetAudience: "Street food vendors (Vada Pav, Chaat stalls)",
                industry: "Fintech",
                businessModel: "B2B SaaS"
            },
            segments: [
                {
                    segment_id: "seg_1",
                    segment_name: "Tech-Savvy Vendors",
                    personas: [
                        {
                            persona_id: "p_1",
                            name: "Raju",
                            age: 35,
                            occupation: "Vada Pav Stall Owner",
                            state: "Maharashtra",
                            zone: "Urban"
                        }
                    ]
                }
            ],
            weeks: 2,
            projectId: projectId
        };

        const simRes = await axios.post('http://localhost:3001/api/simulation/run', simPayload);
        const simData = simRes.data.simulation;
        console.log(`✅ Simulation Completed: ${simData.id}`);
        console.log(`   - Events generated: ${simData.allEvents.length}`);
        
        const socialEvents = simData.allEvents.filter(e => e.type === 'SOCIAL');
        console.log(`   - Social Events generated: ${socialEvents.length}`);

        console.log('3. Testing AI Analyst Chat...');
        const chatPayload = {
            simulationId: simData.id,
            message: "What was the main reason Raju churned or converted?",
            chatHistory: [],
            simulationResult: simData
        };
        const chatRes = await axios.post('http://localhost:3001/api/report-chat', chatPayload);
        console.log(`✅ AI Analyst Replied:`);
        console.log(chatRes.data.reply);

        console.log('\n✅ ALL TESTS PASSED!');

    } catch (err) {
        console.error('❌ Test failed:', err.response?.data || err.message);
    }
}

testSimulation();
