const express = require('express');
const cors = require('cors');
require('dotenv').config();

const path = require('path');
const simulationRoutes = require('./routes/simulation');
const personaRoutes = require('./routes/personas');
const chatRoutes = require('./routes/chat');
const graphRoutes = require('./routes/graph');
const surveyRoutes = require('./routes/survey');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/simulation', simulationRoutes);
app.use('/api/graph', graphRoutes);
app.use('/api', personaRoutes);
app.use('/api', chatRoutes);
app.use('/api/survey', surveyRoutes);

// Health check
app.get('/health', async (req, res) => {
    // In the cloud environment, we are ready as soon as the Node server is up
    // since we use Pinecone/MySQL directly via SDKs.
    const ragStatus = 'ready';

    res.json({ 
        status: 'ok', 
        service: 'simulation-backend',
        rag: ragStatus
    });
});

// Serve static files from the 'public' directory (Next.js static export)
// On Hostinger, we will place the 'out' folder contents into a folder named 'public'
const outDir = path.join(__dirname, 'public');
app.use(express.static(outDir));

// Handle clean URLs for Next.js static export
// Maps /validate → validate.html, /dashboard → dashboard.html, etc.
const fs = require('fs');
app.get('*', (req, res) => {
    // Strip trailing slash and leading slash
    const cleanPath = req.path.replace(/^\/+|\/+$/g, '');

    // Try exact .html match first (e.g. /validate → validate.html)
    if (cleanPath) {
        const htmlFile = path.join(outDir, `${cleanPath}.html`);
        if (fs.existsSync(htmlFile)) {
            return res.sendFile(htmlFile);
        }

        // Try as directory index (e.g. /validate/ → validate/index.html)
        const indexFile = path.join(outDir, cleanPath, 'index.html');
        if (fs.existsSync(indexFile)) {
            return res.sendFile(indexFile);
        }
    }

    // Fallback to index.html for client-side routing
    res.sendFile(path.join(outDir, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Simulation Backend running on http://localhost:${PORT}`);
});
