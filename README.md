# Percura - Persona Segment Testing Engine

Percura is a powerful AI-driven platform designed to transform startup idea validation through massive-scale persona simulation and look-alike segment testing.

## 🚀 Architecture Overview

The system consists of two core components running on a serverless/cloud stack:
1.  **Frontend (Next.js)**: A modern, high-performance dashboard for idea definition and result visualization.
2.  **Simulation Backend (Node.js/Express)**: Orchestrates simulation logic, connects to Groq AI for analysis, and handles semantic search via Pinecone.

### ☁️ Cloud Data Architecture
- **Vector Database (Pinecone)**: Stores 1M+ embeddings for semantic similarity search.
- **Relational Metadata (Hostinger MySQL)**: Scalable storage for detailed textual profiles of the personas.
- **Embedding Generation (Hugging Face API)**: Converts startup ideas into vectors using `sentence-transformers/all-MiniLM-L6-v2`.
- **Reasoning Engine (Groq / Llama 3)**: Performs the psychological and market fit analysis.

## 🛠️ Getting Started Locally

### Prerequisites
- Node.js (v18+)
- `.env` files configured in both `/percura-ui` and `/backend` with cloud credentials (Pinecone, Groq, HF, MySQL).

### Initial Setup
Install dependencies:
```bash
npm run setup
```

### Development
Start the full stack locally:
```bash
npm run dev
```
- **UI**: http://localhost:3000
- **Simulation API**: http://localhost:3001

## 🚢 Deployment (Hostinger Node.js Web App)

This application is built for Hostinger's "Node.js Web App" environment (using the **Express** framework preset). When deploying, you must create a flat ZIP file (often named `deploy_package.zip`) to upload.

### How to build the Deploy Package:
1. **Build the Frontend**: Run `npm run build` inside the `percura-ui` directory to generate the static export in `percura-ui/out`.
2. **Create the Folder**: Create a temporary folder named `deploy_package/`.
3. **Assemble the Backend**: Copy the contents of the `backend/` directory directly into the root of `deploy_package/` (including `server.js`, `package.json`, `routes/`, and `engine/`). Do **not** include `persona-database-migration-scripts/` or `node_modules/` or `env`.
4. **Assemble the Frontend**: Create a folder named `public/` inside the `deploy_package/` folder. Copy all the contents from `percura-ui/out/` into this new `public/` folder.
5. **Zip it**: Zip the *contents* of the `deploy_package/` folder (the zip should contain `server.js` and `public/` at its root, not a wrapper folder).
6. **Deploy**: Upload this zip file to Hostinger and set the Entry File to `server.js`. Make sure to set all your `.env` variables in the Hostinger dashboard.

## 📁 Project Structure
- `/percura-ui`: Next.js frontend application.
- `/backend`: Node.js simulation orchestrator.
- `/backend/persona-database-migration-scripts`: (Archive) The scripts and raw data originally used to stream the 1M personas into Pinecone and MySQL.
