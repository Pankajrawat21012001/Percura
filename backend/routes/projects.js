const express = require('express');
const router = express.Router();

// In-memory store for projects (Replace with DB later)
const projectsStore = new Map();

/**
 * POST /api/projects
 * Create a new project grouping for simulations.
 */
router.post('/', (req, res) => {
    const { name, description } = req.body;
    
    if (!name) {
        return res.status(400).json({ success: false, error: 'Project name is required' });
    }

    const projectId = `proj_${Date.now()}`;
    const newProject = {
        id: projectId,
        name,
        description: description || '',
        createdAt: new Date().toISOString()
    };

    projectsStore.set(projectId, newProject);

    res.json({
        success: true,
        project: newProject
    });
});

/**
 * GET /api/projects/:id/simulations
 * List all simulations for a given project.
 * NOTE: Currently relies on the simulation.js in-memory store filtering.
 * In a real DB, this would be a simple `SELECT * WHERE projectId = ?`.
 */
router.get('/:id/simulations', (req, res) => {
    const { id } = req.params;
    
    // We would cross-reference the simulationStore here.
    // Since we export `getSimulation` but not a `getAll` from simulation.js,
    // we'd typically have a DB query. For the mock, we'll return a placeholder.
    
    res.json({
        success: true,
        projectId: id,
        simulations: [] // Placeholder until DB is integrated
    });
});

/**
 * GET /api/projects/:id/compare
 * Compare high-level metrics across all simulations in a project.
 */
router.get('/:id/compare', (req, res) => {
    const { id } = req.params;
    
    res.json({
        success: true,
        projectId: id,
        comparison: {
            message: "Project comparison requires multiple persisted simulations."
        }
    });
});

module.exports = router;
