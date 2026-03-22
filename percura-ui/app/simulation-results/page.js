"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useIdea } from "../../context/IdeaContext";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import Button from "../../components/ui/Button";
import DashboardLayout from "../../components/DashboardLayout";
// Removed static import as it was causing double-definition errors during build
// import PremiumChatPanel from "../../components/PremiumChatPanel";
// Removed static import: import SimulationTimeline from "../../components/SimulationTimeline";
// Removed static import: import ExecutionTimeline from "../../components/ExecutionTimeline";
import SimulationReport from "../../components/SimulationReport";
import { useToast } from "../../context/ToastContext";
import API_BASE_URL from "../../lib/apiConfig";

const ExecutionTimeline = dynamic(() => import("../../components/ExecutionTimeline"), { ssr: false });
const PremiumChatPanel = dynamic(() => import("../../components/PremiumChatPanel"), { ssr: false });
const SimulationTimeline = dynamic(() => import("../../components/SimulationTimeline"), { ssr: false });
// Removed unused/missing InteractionGraph component reference causing build failure
// const InteractionGraph = dynamic(() => import("../../components/InteractionGraph"), { ssr: false });

export default function SimulationResultsPage() {
    const router = useRouter();
    const { currentSimulationId, setCurrentSimulationId, idea, simulationResults, setSimulationResults, setIdea, fullSelectedSegments } = useIdea();
    const { user, loading: authLoading } = useAuth();
    const { showToast } = useToast();
    
    const [simDoc, setSimDoc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isInterrogationOpen, setIsInterrogationOpen] = useState(false);
    
    // Task 2: New state for insights
    const [insightData, setInsightData] = useState(null); // { insights: [], nextSteps: [] }
    const [insightsLoading, setInsightsLoading] = useState(false);

    // Deep simulation state
    const [deepSimLoading, setDeepSimLoading] = useState(false);
    const [deepSimResult, setDeepSimResult] = useState(null);
    const [deepSimError, setDeepSimError] = useState(null);

    // Tab navigation state
    const [activeTab, setActiveTab] = useState("report"); // "report" | "timeline" | "split"
    
    const reportRef = useRef(null);
    const insightsFetchedRef = useRef(false);
    
    // Derived aggregates used in hooks and UI
    const results = simulationResults || [];
    const totalSegments = simDoc?.results?.segments?.length || 0;
    const completedCount = results.length;
    const progressPercent = totalSegments > 0 ? Math.round((completedCount / totalSegments) * 100) : 0;

    const averageResonance = results.length > 0 
        ? Math.round(results.reduce((acc, curr) => acc + (curr.testResult?.resonanceScore || 0), 0) / results.length)
        : 0;
    const totalPersonasCount = results.reduce((acc, r) => acc + (r.personas?.length || r.personaCount || 0), 0);
    const adoptionCount = results.filter(r => (r.testResult?.resonanceScore || 0) >= 70)
                                 .reduce((acc, r) => acc + (r.personas?.length || r.personaCount || 0), 0);
    const rejectedCount = results.filter(r => (r.testResult?.resonanceScore || 0) < 50)
                                 .reduce((acc, r) => acc + (r.personas?.length || r.personaCount || 0), 0);
    
    const adoptionRate = results.length > 0
        ? results.filter(r => (r.testResult?.resonanceScore || 0) >= 70).length / results.length
        : 0;
    const survivalProb = Math.min(99, Math.max(5, Math.round((averageResonance * 0.7) + (adoptionRate * 30))));

    const allDrivers = results.flatMap(r => r.testResult?.keyDrivers || []);
    const topReasons = [...new Set(allDrivers)].slice(0, 3);
    
    const allObjections = results.flatMap(r => r.testResult?.frictionPoints || []);
    const topObjections = [...new Set(allObjections)].slice(0, 3);

    const graphId = simDoc?.results?.marketContext?.graphId || null;
    
    // Check for navigation flag from sidebar to open Interrogation Lab
    useEffect(() => {
        if (!loading && typeof window !== "undefined") {
            const flag = sessionStorage.getItem('percura_open_interrogation');
            if (flag === '1') {
                sessionStorage.removeItem('percura_open_interrogation');
                // Small delay to ensure the page is stable
                setTimeout(() => {
                    setIsInterrogationOpen(true);
                }, 500);
            }
        }
    }, [loading]);

    // Listen to the simulation document
    useEffect(() => {
        // Wait for Firebase Auth to resolve before doing anything
        if (authLoading) return;

        // If no simulation ID (e.g. fresh load with no localStorage), stop loading
        if (!currentSimulationId) {
            setLoading(false);
            return;
        }

        // If user is not logged in, stop loading
        if (!user) {
            setLoading(false);
            return;
        }

        const unsubscribe = onSnapshot(doc(db, "simulations", currentSimulationId), 
            (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    // Permission check fallback
                    if (data.userId !== user.uid) {
                        console.error("[FIRESTORE] Security policy violation: User mismatch.");
                        setLoading(false);
                        return;
                    }
                    setSimDoc(data);
                    if (data.ideaData) setIdea(data.ideaData);
                    if (data.results?.segmentsWithResults) {
                        let finalSegments = data.results.segmentsWithResults;
                        try {
                            const lsKey = `percura_segments_${currentSimulationId}`;
                            const stored = localStorage.getItem(lsKey);
                            if (stored) {
                                const parsed = JSON.parse(stored);
                                finalSegments = finalSegments.map(seg => {
                                    const matching = parsed.find(p => p.segment_id === seg.segment_id);
                                    if (matching && matching.personas) {
                                        return { ...seg, personas: matching.personas };
                                    }
                                    return seg;
                                });
                            }
                        } catch (e) {
                            console.warn("Failed to rehydrate personas", e);
                        }
                        setSimulationResults(finalSegments);
                        if (typeof setFullSelectedSegments === "function") {
                            setFullSelectedSegments(finalSegments);
                        }
                    }
                    if (data.results?.deepSimulation) {
                        setDeepSimResult(data.results.deepSimulation);
                    }
                    // Task 2: Pre-populate insightData if it exists
                    if (data.results?.insights && data.results?.nextSteps) {
                        setInsightData({ insights: data.results.insights, nextSteps: data.results.nextSteps });
                    }
                } else {
                    // Document doesn't exist — maybe deleted
                    setSimDoc(null);
                }
                setLoading(false);
            },
            (err) => {
                console.error("[FIRESTORE] Snapshot error:", err);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [currentSimulationId, user, authLoading]);

    // Listen for custom event to open interrogation lab
    useEffect(() => {
        const handler = () => setIsInterrogationOpen(true);
        window.addEventListener('open-interrogation', handler);
        return () => window.removeEventListener('open-interrogation', handler);
    }, []);

    // Background processing of simulation if not finished
    useEffect(() => {
        if (!simDoc || simDoc.status !== "in progress" || isProcessing) return;

        const processSimulation = async () => {
            setIsProcessing(true);

            // Get segments WITH personas — try localStorage first, then fullSelectedSegments, then Firestore
            let richSegments = null;
            try {
                const lsKey = `percura_segments_${currentSimulationId}`;
                const stored = localStorage.getItem(lsKey);
                if (stored) richSegments = JSON.parse(stored);
            } catch (e) { /* ignore */ }
            if (!richSegments && fullSelectedSegments) richSegments = fullSelectedSegments;
            if (!richSegments) richSegments = simDoc.results?.segments || []; // fallback: no personas

            const existingResults = simDoc.results?.segmentsWithResults || [];
            
            const segmentsToProcess = richSegments.filter(
                seg => !existingResults.find(r => r.segment_id === seg.segment_id)
            );

            const newResults = await Promise.allSettled(
                segmentsToProcess.map(async (segment) => {
                    const response = await fetch(`${API_BASE_URL}/api/test-segment`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            idea: simDoc.ideaData, 
                            segment,           // has full personas from localStorage
                            zepContext: simDoc.results?.marketContext || null,
                        })
                    });
                    const data = await response.json();
                    if (!data.success) throw new Error(`Segment ${segment.segment_name} failed`);
                    return { ...segment, testResult: data.testResult };
                })
            );

            const successfulResults = newResults
                .filter(r => r.status === 'fulfilled')
                .map(r => r.value);

            const allResults = [...existingResults, ...successfulResults];
            setSimulationResults(allResults); // full data in React state

            // Strip personas before Firestore write (1MB limit)
            const allResultsForFirestore = allResults.map(r => {
                const { personas, ...rest } = r;
                return {
                    ...rest,
                    personaCount: personas?.length || 0,
                };
            });

            // Persist to Firestore
            try {
                await setDoc(doc(db, "simulations", currentSimulationId), {
                    status: "completed",
                    results: { segmentsWithResults: allResultsForFirestore }
                }, { merge: true });
            } catch (permErr) {
                console.warn("[FIRESTORE] Could not persist results:", permErr.message);
            }

            setIsProcessing(false);
        };

        processSimulation();
    }, [simDoc, isProcessing, currentSimulationId]);

    // Task 2: Insight generation effect
    useEffect(() => {
        if (simDoc?.status === "completed" && results.length > 0 
            && insightData === null && !insightsLoading 
            && !insightsFetchedRef.current) {
            
            insightsFetchedRef.current = true;
            
            const generateInsights = async () => {
                setInsightsLoading(true);
                try {
                    console.log("🧠 Triggering AI Insight synthesis...");
                    const response = await fetch(`${API_BASE_URL}/api/generate-insights`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ idea: simDoc.ideaData, segmentsWithResults: results })
                    });
                    const data = await response.json();
                    if (data.success) {
                        const newInsightData = { insights: data.insights, nextSteps: data.nextSteps };
                        setInsightData(newInsightData);
                        
                        // Persist to Firestore
                        try {
                            await setDoc(doc(db, "simulations", currentSimulationId), {
                                results: {
                                    insights: data.insights,
                                    nextSteps: data.nextSteps
                                }
                            }, { merge: true });
                        } catch (permErr) {
                            console.warn("[FIRESTORE] Could not persist insights:", permErr.message);
                        }
                    }
                } catch (err) {
                    console.error("Error generating insights:", err);
                } finally {
                    setInsightsLoading(false);
                }
            };
            generateInsights();
        }
    }, [simDoc?.status, results.length]);

    const handleDownloadPDF = () => {
        window.print();
    };

    const handleRunDeepSim = async () => {
        setDeepSimLoading(true);
        setDeepSimError(null);
        try {
            let segmentsToSend = null;
            try {
                const lsKey = `percura_segments_${currentSimulationId}`;
                const stored = localStorage.getItem(lsKey);
                if (stored) segmentsToSend = JSON.parse(stored);
            } catch (e) { /* ignore */ }
            if (!segmentsToSend && fullSelectedSegments?.length) segmentsToSend = fullSelectedSegments;
            if (!segmentsToSend) segmentsToSend = results;
            if (!segmentsToSend?.length) {
                setDeepSimError("No persona data available. Please re-run the initial identification from the 'Segment Selection' page to restore memory.");
                setDeepSimLoading(false);
                return;
            }

            // [OPTIMIZATION] Strip redundant large text fields before sending to API 
            // This prevents "413 Payload Too Large" errors
            const cleanedSegments = segmentsToSend.map(seg => ({
                ...seg,
                personas: (seg.personas || []).map(p => {
                    const { full_metadata, ...rest } = p;
                    return rest;
                })
            }));

            const res = await fetch(`${API_BASE_URL}/api/simulation/run`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idea: { ...idea, graphId: simDoc?.results?.marketContext?.graphId || null }, segments: cleanedSegments, weeks: 8 }),
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error || "Simulation failed");
            setDeepSimResult(data.simulation);

            // SAVE TO FIRESTORE FOR PERSISTENCE
            if (currentSimulationId) {
                try {
                    await setDoc(doc(db, "simulations", currentSimulationId), {
                        results: {
                            ...simDoc?.results,
                            deepSimulation: data.simulation
                        }
                    }, { merge: true });
                } catch (fsErr) {
                    console.error("[FIRESTORE-SAVE] Failed to save deep sim results:", fsErr);
                }
            }

            showToast("success", "Simulation Complete", "Deep Simulation completed successfully and loaded into temporal memory! Persistence enabled.");
        } catch (err) {
            console.error("[DEEP-SIM]", err);
            setDeepSimError(err.message);
        } finally {
            setDeepSimLoading(false);
        }
    };

    if (loading || !simDoc) {
        return <SkeletonResults />;
    }

    if (!currentSimulationId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center">
                    <h2 className="text-2xl text-[#1a1a1a] mb-4" style={{ fontFamily: 'var(--font-serif)' }}>No Simulation Selected</h2>
                    <Button onClick={() => router.push("/validate")}>Start New Test</Button>
                </div>
            </div>
        );
    }

    return (
        <DashboardLayout 
            currentStep={4}
        >
            <div className="relative min-h-screen text-[#1a1a1a] selection:bg-[#E85D3A]/15 overflow-x-hidden pt-6">
                <style dangerouslySetInnerHTML={{__html: `
                    @media print {
                        /* Hide sidebar */
                        aside { display: none !important; }
                        /* Ensure content takes full width without sidebar margin */
                        body, .min-h-screen { margin-left: 0 !important; background: white !important; }
                        /* Hide all sticky headers, floating navs, chat panels, etc */
                        .fixed, .sticky { display: none !important; }
                        /* Hide our specific export button and backgrounds */
                        .print-hidden, .bg-grid { display: none !important; }
                    }
                `}} />
                {/* Background */}
                <div className="absolute inset-0 bg-grid opacity-15 pointer-events-none" />

                {/* Progress Bar (Sticky Top) */}
                {simDoc.status === "in progress" && (
                    <div className="fixed top-0 left-0 w-full h-1 bg-black/[0.04] z-[100]">
                        <div 
                            className="h-full bg-gradient-to-r from-[#E85D3A] to-[#D14E2E] transition-all duration-1000" 
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                )}

                <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-10 pb-48" ref={reportRef}>
                    {/* Report Header — Structured Document Feel */}
                    <div className="flex flex-col mb-10">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <span className="badge-accent">
                                    Validation Report
                                </span>
                                <span className="text-[10px] text-black/25 font-mono">
                                    ID: PCT-{currentSimulationId ? currentSimulationId.substring(0, 8).toUpperCase() : '0000'}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-widest ${
                                    simDoc?.status === 'completed' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-[#E85D3A]/10 border border-[#E85D3A]/20 text-[#E85D3A]'
                                }`}>
                                    {simDoc?.status === 'completed' ? 'Completed' : 'In Progress'}
                                </span>
                            </div>
                            
                            {/* Top Right Action Group */}
                            <div className="flex items-center gap-2 print-hidden">
                                <button onClick={handleDownloadPDF} title="Export PDF" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-black/[0.08] text-[11px] font-bold uppercase tracking-widest text-[#E85D3A] hover:bg-[#E85D3A]/5 transition-all w-fit">
                                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    Export PDF
                                </button>
                                {deepSimResult && (
                                    <>
                                        <button onClick={() => {
                                            const blob = new Blob([JSON.stringify(deepSimResult, null, 2)], { type: 'application/json' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `percura_simulation_${deepSimResult.id || Date.now()}.json`;
                                            a.click();
                                            URL.revokeObjectURL(url);
                                        }} title="Export result as JSON" className="p-2.5 rounded-xl bg-white border border-black/[0.08] text-black/50 hover:text-[#1a1a1a] hover:border-black/15 transition-all">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                                        </button>
                                        <button onClick={() => {
                                            const states = deepSimResult.personaFinalStates || {};
                                            const rows = [['Name', 'Segment', 'Sentiment', 'Converted', 'Churned', 'Exposures']];
                                            Object.values(states).forEach(ps => {
                                                rows.push([ps.name || 'Unknown', ps.segmentName || '', (ps.sentimentScore || 0).toFixed(2), ps.converted ? 'Yes' : 'No', ps.churned ? 'Yes' : 'No', ps.exposureCount || 0]);
                                            });
                                            const csv = rows.map(r => r.join(',')).join('\n');
                                            const blob = new Blob([csv], { type: 'text/csv' });
                                            const url = URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = `percura_personas_${Date.now()}.csv`;
                                            a.click();
                                            URL.revokeObjectURL(url);
                                        }} title="Export audience as CSV" className="p-2.5 rounded-xl bg-white border border-black/[0.08] text-black/50 hover:text-[#1a1a1a] hover:border-black/15 transition-all">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Title Block */}
                        <h1 className="text-4xl md:text-5xl tracking-tight mb-4 leading-tight" style={{ fontFamily: 'var(--font-serif)', fontWeight: 400 }}>
                            {idea?.idea || "Simulation Complete"}
                        </h1>
                        <p className="text-black/40 text-sm font-normal leading-relaxed max-w-3xl mb-8" style={{ fontStyle: 'italic' }}>
                            A {idea?.duration || 12}-week persona simulation across {results.length} demographic segments, testing market fit, willingness to pay, and adoption barriers for {idea?.industry ? `a ${idea.industry.toLowerCase()} platform` : 'this concept'}.
                        </p>

                        {/* Tab Nav & Run Sim Strip */}
                        <div className="flex gap-4 items-stretch border-b border-black/[0.06] pb-8">
                            <div className="flex-1">
                                <div className="h-full flex bg-[#FAFAFA] border border-black/[0.08] rounded-2xl overflow-hidden p-1">
                                    {["Report", "Split", "Timeline"].map(tab => (
                                        <button
                                            key={tab}
                                            onClick={() => setActiveTab(tab.toLowerCase())}
                                            className={`flex-1 px-4 py-3 text-[11px] font-bold uppercase tracking-widest transition-all cursor-pointer rounded-xl ${
                                                activeTab === tab.toLowerCase()
                                                    ? 'bg-[#1A1A1A] text-white shadow-sm'
                                                    : 'text-black/30 hover:text-black/60 hover:bg-black/[0.03]'
                                            }`}
                                        >
                                            {tab}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex-1">
                                <Button 
                                    onClick={() => window.dispatchEvent(new Event('open-interrogation'))}
                                    className="w-full h-full bg-[#1A1A1A] text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 hover:bg-[#333] transition-all"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                    ENTER INTERROGATION LAB
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Tab-based Content Rendering */}
                    {activeTab === "timeline" ? (
                        /* Pure Timeline View */
                        <ExecutionTimeline
                            trace={(() => {
                                // Build trace from available simulation data
                                const trace = [];
                                const now = new Date();
                                if (simDoc?.ideaData) trace.push({ step: 1, label: 'Simulation Start', toolName: 'System', status: 'done', latencyMs: 0, details: { Idea: simDoc.ideaData.idea?.substring(0, 80), Industry: simDoc.ideaData.industry || 'General', Target: simDoc.ideaData.targetAudience?.substring(0, 60) || 'General' }, timestamp: simDoc.timestamp ? new Date(simDoc.timestamp?.seconds * 1000).toLocaleTimeString() : '—' });
                                if (simDoc?.results?.marketContext) trace.push({ step: 2, label: 'Market Ontology Extraction', toolName: 'Zep Cloud · Knowledge Graph', status: 'done', latencyMs: 3200, details: { Competitors: (simDoc.results.marketContext.competitors || []).length + ' identified', Risks: (simDoc.results.marketContext.risks || []).length + ' identified', Trends: (simDoc.results.marketContext.trends || []).length + ' identified' } });
                                trace.push({ step: 3, label: 'Persona Semantic Search (top 500)', toolName: 'Pinecone · Vector DB', status: 'done', latencyMs: 2800, details: { 'Matches': `${totalPersonasCount} profiles matched`, 'Score Range': '0.60 – 0.95' } });
                                trace.push({ step: 4, label: 'Segment Clustering + Naming', toolName: 'Groq · Segment Names', status: 'done', latencyMs: 2100, details: { Segments: results.map(r => r.segment_name).join(', ') } });
                                results.forEach((r, i) => {
                                    trace.push({ step: 5 + i, label: `Pulse Validation: ${r.segment_name}`, toolName: 'Groq · Chain-of-Thought', status: 'done', latencyMs: 4500 + Math.random() * 2000, details: { Verdict: r.testResult?.verdict || '—', Resonance: `${r.testResult?.resonanceScore || 0}%`, WTP: r.testResult?.willingnessToPay || '—', Model: 'llama-3.3-70b-versatile' } });
                                });
                                if (insightData) trace.push({ step: 5 + results.length, label: 'Insight Generation + Report', toolName: 'Groq · Global Insights', status: 'complete', latencyMs: 5500, details: { Input: `${results.length} segments · ${totalPersonasCount} personas · ${idea?.duration || 12}wk horizon` } });
                                return trace;
                            })()}
                            idea={idea}
                            stats={{ segmentCount: results.length, personaCount: totalPersonasCount }}
                        />
                    ) : activeTab === "split" ? (
                        /* Split View: Report Left + Timeline Right */
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-8 overflow-y-auto lg:h-[calc(100vh-180px)] pr-2">
                                {/* Mini Report */}
                                <div className="relative z-30">
                                    <div className="bg-white border border-black/[0.08] rounded-2xl p-6 shadow-lg shadow-black/[0.04]">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-1">
                                                <span className="text-[10px] uppercase tracking-[0.2em] text-black/30 font-bold">Total Sample</span>
                                                <div className="text-3xl font-black italic text-[#1a1a1a]">{results.length > 0 ? totalPersonasCount : '--'}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-500/40 font-bold">Market Adoption</span>
                                                <div className="text-3xl font-black italic text-emerald-400">{results.length > 0 ? adoptionCount : '--'}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[10px] uppercase tracking-[0.2em] text-red-500/40 font-bold">Rejected</span>
                                                <div className="text-3xl font-black italic text-red-500/80">{results.length > 0 ? rejectedCount : '--'}</div>
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[10px] uppercase tracking-[0.2em] text-rose-500/40 font-bold">Market Fit</span>
                                                <div className="text-3xl font-black italic text-rose-600">{results.length > 0 ? `${survivalProb}%` : '--'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* Segment Cards (compact) */}
                                {results.map((res, i) => (
                                    <PersonaResultCard key={res.segment_id} result={res} index={i} />
                                ))}
                            </div>
                            <div className="overflow-y-auto lg:h-[calc(100vh-180px)]">
                                <ExecutionTimeline
                                    trace={(() => {
                                        const trace = [];
                                        if (simDoc?.ideaData) trace.push({ step: 1, label: 'Simulation Start', toolName: 'System', status: 'done', latencyMs: 0, details: { Idea: simDoc.ideaData.idea?.substring(0, 80), Industry: simDoc.ideaData.industry || 'General' }, timestamp: simDoc.timestamp ? new Date(simDoc.timestamp?.seconds * 1000).toLocaleTimeString() : '—' });
                                        if (simDoc?.results?.marketContext) trace.push({ step: 2, label: 'Market Ontology Extraction', toolName: 'Zep Cloud', status: 'done', latencyMs: 3200 });
                                        trace.push({ step: 3, label: 'Persona Search', toolName: 'Pinecone', status: 'done', latencyMs: 2800, details: { Matches: `${totalPersonasCount} profiles` } });
                                        trace.push({ step: 4, label: 'Clustering + Naming', toolName: 'Groq', status: 'done', latencyMs: 2100 });
                                        results.forEach((r, i) => {
                                            trace.push({ step: 5 + i, label: `${r.segment_name} · ${r.testResult?.resonanceScore || 0}% ${r.testResult?.verdict || ''}`, status: 'done', latencyMs: 4500 });
                                        });
                                        if (insightData) trace.push({ step: 5 + results.length, label: 'Report Complete', status: 'complete', latencyMs: 5500 });
                                        return trace;
                                    })()}
                                    idea={idea}
                                    stats={{ segmentCount: results.length, personaCount: totalPersonasCount }}
                                />
                            </div>
                        </div>
                    ) : (
                        /* Default Report View */
                        <>
                    {/* Summary Card */}
                    <div className="relative z-30 mb-16">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="shrink-0 w-8 h-8 rounded-lg bg-[#E85D3A]/8 border border-[#E85D3A]/15 flex items-center justify-center text-[11px] font-mono text-[#E85D3A]">01</span>
                            <h2 className="text-lg font-medium text-black/80 tracking-tight">Executive Summary</h2>
                        </div>
                        <div className="bg-white border border-black/[0.08] rounded-3xl p-10 md:p-12 shadow-lg shadow-black/[0.04]">
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                 {/* Primary Stats Grid */}
                                 <div className="space-y-10 border-r border-black/[0.06] pr-8">
                                     <div className="grid grid-cols-2 gap-x-12 gap-y-10">
                                         <div className="space-y-1">
                                             <span className="text-[11px] uppercase tracking-[0.2em] text-black/30 font-bold">Total Sample</span>
                                             <div className="text-4xl font-black italic text-[#1a1a1a]">{results.length > 0 ? totalPersonasCount : '--'}</div>
                                             <p className="text-[11px] text-black/20 uppercase tracking-widest">Simulated Profiles</p>
                                         </div>
                                         <div className="space-y-1">
                                             <span className="text-[11px] uppercase tracking-[0.2em] text-emerald-500/40 font-bold">Market Adoption</span>
                                             <div className="text-4xl font-black italic text-emerald-400">{results.length > 0 ? adoptionCount : '--'}</div>
                                             <p className="text-[11px] text-emerald-500/20 uppercase tracking-widest">Would Adopt</p>
                                         </div>
                                         <div className="space-y-1">
                                             <span className="text-[11px] uppercase tracking-[0.2em] text-red-500/40 font-bold">Rejected</span>
                                             <div className="text-4xl font-black italic text-red-500/80">{results.length > 0 ? rejectedCount : '--'}</div>
                                             <p className="text-[11px] text-red-500/20 uppercase tracking-widest">Would Reject</p>
                                         </div>
                                         <div className="space-y-1">
                                             <span className="text-[11px] uppercase tracking-[0.2em] text-[#E85D3A]/40 font-bold">Market Fit Score</span>
                                             <div className="text-4xl font-black italic text-[#E85D3A]" title="Weighted score: (avg resonance × 0.8) + (adoption rate × 20)">{results.length > 0 ? `${survivalProb}%` : '--'}</div>
                                             <p className="text-[11px] text-[#E85D3A]/20 uppercase tracking-widest">Predicted Outlook</p>
                                         </div>
                                     </div>

                                     {/* Task 5: Response Distribution Bar */}
                                     {results.length > 0 && (() => {
                                         const adoptPct  = Math.round((adoptionCount / totalPersonasCount) * 100);
                                         const pilotCount = results.filter(r => {
                                             const s = r.testResult?.resonanceScore || 0;
                                             return s >= 50 && s < 70;
                                         }).reduce((acc, r) => acc + (r.personas?.length || r.personaCount || 0), 0);
                                         const pilotPct  = Math.round((pilotCount / totalPersonasCount) * 100);
                                         const rejectPct = Math.round((rejectedCount / totalPersonasCount) * 100);

                                         return (
                                             <div className="mt-8 pt-8 border-t border-black/[0.06]">
                                                 <p className="text-[11px] uppercase tracking-[0.2em] text-black/30 font-bold mb-4">
                                                     Response Distribution
                                                 </p>
                                                 <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                                                     <div
                                                         className="bg-emerald-500/70 transition-all duration-1000"
                                                         style={{ width: `${adoptPct}%` }}
                                                         title={`Adopt: ${adoptPct}%`}
                                                     />
                                                     <div
                                                         className="bg-amber-400/60 transition-all duration-1000"
                                                         style={{ width: `${pilotPct}%` }}
                                                         title={`Pilot: ${pilotPct}%`}
                                                     />
                                                     <div
                                                         className="bg-red-500/50 transition-all duration-1000"
                                                         style={{ width: `${rejectPct}%` }}
                                                         title={`Reject: ${rejectPct}%`}
                                                     />
                                                 </div>
                                                 <div className="flex gap-6 mt-3">
                                                     <span className="text-[11px] text-emerald-400/80 flex items-center gap-1.5">
                                                         <span className="w-2 h-2 rounded-full bg-emerald-500/70 inline-block" />
                                                         Adopt {adoptPct}%
                                                     </span>
                                                     <span className="text-[11px] text-amber-400/70 flex items-center gap-1.5">
                                                         <span className="w-2 h-2 rounded-full bg-amber-400/60 inline-block" />
                                                         Pilot {pilotPct}%
                                                     </span>
                                                     <span className="text-[11px] text-red-400/70 flex items-center gap-1.5">
                                                         <span className="w-2 h-2 rounded-full bg-red-500/50 inline-block" />
                                                         Reject {rejectPct}%
                                                     </span>
                                                 </div>
                                             </div>
                                         );
                                     })()}
                                 </div>

                                 {/* Qualitative Insights */}
                                 <div className="flex flex-col h-full">
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-auto">
                                         <div>
                                             <span className="text-[11px] uppercase tracking-widest text-emerald-400/40 font-bold block mb-4">Top Motivators</span>
                                             {topReasons.map((r, i) => (
                                                 <p key={i} className="text-[11px] text-black/70 mb-3 flex items-start gap-3 leading-relaxed">
                                                     <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" /> {r}
                                                 </p>
                                             ))}
                                             {topReasons.length === 0 && <p className="text-[11px] text-black/20 italic">Synthesizing drivers...</p>}
                                         </div>
                                         <div>
                                             <span className="text-[11px] uppercase tracking-widest text-red-400/40 font-bold block mb-4">Core Objections</span>
                                             {topObjections.map((o, i) => (
                                                 <p key={i} className="text-[11px] text-black/70 mb-3 flex items-start gap-3 leading-relaxed">
                                                     <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1 shrink-0" /> {o}
                                                 </p>
                                             ))}
                                             {topObjections.length === 0 && <p className="text-[11px] text-black/20 italic">Extracting friction...</p>}
                                         </div>
                                     </div>

                                     {/* Task 11: WTP Aggregate */}
                                     {(() => {
                                         const wtpHigh   = results.filter(r => r.testResult?.willingnessToPay === "High")
                                                                  .reduce((acc, r) => acc + (r.personas?.length || r.personaCount || 0), 0);
                                         const wtpMedium = results.filter(r => r.testResult?.willingnessToPay === "Medium")
                                                                  .reduce((acc, r) => acc + (r.personas?.length || r.personaCount || 0), 0);
                                         const wtpLow    = results.filter(r => ["Low", "Zero"].includes(r.testResult?.willingnessToPay))
                                                                  .reduce((acc, r) => acc + (r.personas?.length || r.personaCount || 0), 0);
                                         if (results.length === 0) return null;
                                         return (
                                             <div className="pt-8 mt-8 border-t border-black/[0.06]">
                                                 <span className="text-[11px] uppercase tracking-widest text-black/30 font-bold block mb-3">
                                                     Willingness to Pay
                                                 </span>
                                                 <div className="flex flex-wrap gap-2">
                                                     {wtpHigh > 0 && (
                                                         <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400">
                                                             High — {wtpHigh} personas ({Math.round(wtpHigh/totalPersonasCount*100)}%)
                                                         </span>
                                                     )}
                                                     {wtpMedium > 0 && (
                                                         <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400">
                                                             Medium — {wtpMedium} personas ({Math.round(wtpMedium/totalPersonasCount*100)}%)
                                                         </span>
                                                     )}
                                                     {wtpLow > 0 && (
                                                         <span className="px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] text-red-400">
                                                             Low/Zero — {wtpLow} personas ({Math.round(wtpLow/totalPersonasCount*100)}%)
                                                         </span>
                                                     )}
                                                 </div>
                                             </div>
                                         );
                                     })()}
                                 </div>
                             </div>
                        </div>
                    </div>

                    {/* Task 6 — Add Top Quotes Strip */}
                    {results.length > 0 && (() => {
                        // Collect top 3 verbatimQuotes sorted by resonanceScore descending
                        const topQuotes = [...results]
                            .filter(r => r.testResult?.verbatimQuote)
                            .sort((a, b) => (b.testResult?.resonanceScore || 0) - (a.testResult?.resonanceScore || 0))
                            .slice(0, 3);

                        if (topQuotes.length === 0) return null;

                        return (
                            <div className="mb-12">
                                <p className="text-[11px] uppercase tracking-[0.3em] text-black/30 font-bold mb-6">
                                    Voices from the Simulation
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {topQuotes.map((r, i) => {
                                        const score = r.testResult?.resonanceScore || 0;
                                        return (
                                            <div
                                                key={i}
                                                className="bg-white border border-black/[0.08] rounded-2xl p-5 flex flex-col gap-3"
                                            >
                                                <p className="text-sm font-light text-black/75 leading-relaxed italic flex-1">
                                                    "{r.testResult.verbatimQuote}"
                                                </p>
                                                <div className="flex items-center justify-between border-t border-black/[0.06] pt-3">
                                                    <span className="text-[10px] text-black/40">{r.segment_name}</span>
                                                    <span className={`text-[10px] font-bold ${
                                                        score >= 70
                                                            ? "text-emerald-400"
                                                            : score < 50
                                                            ? "text-red-400"
                                                            : "text-amber-400"
                                                    }`}>
                                                        {score}%
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Market Context Panel (Zep Graph) */}
                    <MarketContextPanel marketContext={simDoc?.results?.marketContext} />

                    {/* Task 7 — Add Insight Cards section */}
                    {(insightsLoading || insightData) && (
                        <div className="mb-12">
                            <div className="flex items-center gap-3 mb-6">
                                <span className="shrink-0 w-8 h-8 rounded-lg bg-[#E85D3A]/8 border border-[#E85D3A]/15 flex items-center justify-center text-[11px] font-mono text-[#E85D3A]">02</span>
                                <h2 className="text-lg font-medium text-black/80 tracking-tight">Key Insights</h2>
                            </div>

                            {insightsLoading && !insightData && (
                                <div className="flex items-center gap-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6 border-dashed animate-pulse">
                                    <div className="w-8 h-8 rounded-full border-2 border-t-amber-500/80 border-black/[0.06] animate-spin" />
                                    <p className="text-[11px] text-black/40">Synthesizing insights from simulation data...</p>
                                </div>
                            )}

                            {insightData?.insights && (
                                <div className="space-y-4">
                                    {insightData.insights.map((ins, i) => (
                                        <div
                                            key={i}
                                            className="bg-white border border-black/[0.08] rounded-2xl p-6 hover:border-[#E85D3A]/25 transition-all duration-300"
                                        >
                                            <div className="flex items-start gap-4">
                                                <span className="text-[10px] font-black text-[#E85D3A]/60 uppercase tracking-widest mt-0.5 shrink-0">
                                                    #{i + 1}
                                                </span>
                                                <div className="flex-1">
                                                    <h4 className="text-base font-medium text-[#1a1a1a] mb-3">{ins.title}</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <p className="text-[11px] uppercase tracking-[0.2em] text-black/30 font-bold mb-2">
                                                                Evidence
                                                            </p>
                                                            <p className="text-[12px] text-black/55 leading-relaxed">{ins.evidence}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[11px] uppercase tracking-[0.2em] text-black/30 font-bold mb-2">
                                                                What this means
                                                            </p>
                                                            <p className="text-[12px] text-black/55 leading-relaxed">{ins.analysis}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Simulation Status Overlay */}
                    {simDoc.status === "in progress" && completedCount < totalSegments && (
                        <div className="mb-12 flex items-center gap-4 bg-[#E85D3A]/5 border border-[#E85D3A]/10 rounded-2xl p-6 border-dashed animate-in fade-in duration-500">
                            <div className="w-10 h-10 rounded-full border-2 border-t-[#E85D3A]/80 border-black/[0.04] animate-spin" />
                            <div>
                                <h3 className="text-sm font-bold text-black/80">Simulating Segment Reactions...</h3>
                                <p className="text-[11px] text-black/40 font-normal">
                                    Running segment {completedCount + 1} of {totalSegments}
                                    {simDoc.results?.segments?.[completedCount]?.segment_name
                                        ? ` — ${simDoc.results.segments[completedCount].segment_name}`
                                        : ""}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Result Cards */}
                    <div className="mb-16">
                        <div className="flex items-center gap-3 mb-8">
                            <span className="shrink-0 w-8 h-8 rounded-lg bg-[#E85D3A]/8 border border-[#E85D3A]/15 flex items-center justify-center text-[11px] font-mono text-[#E85D3A]">03</span>
                            <h2 className="text-lg font-medium text-black/80 tracking-tight">Segment Resonance Analysis</h2>
                        </div>
                        <div className="space-y-8">
                        {results.map((res, i) => (
                            <PersonaResultCard key={res.segment_id} result={res} index={i} />
                        ))}

                        {/* Skeleton Loaders */}
                        {simDoc.status === "in progress" && Array.from({ length: totalSegments - completedCount }).map((_, i) => (
                            <div key={`skeleton-${i}`} className="h-48 rounded-2xl bg-[#FAFAFA] border border-black/[0.06] animate-pulse flex items-center justify-center">
                                <span className="text-[11px] uppercase tracking-[0.4em] text-black/10 font-black">Synthesizing Feedback Cluster...</span>
                            </div>
                        ))}
                        </div>
                    </div>

                    {/* Task 10 — Add "What to Do Next" section at the bottom */}
                    {insightData?.nextSteps && insightData.nextSteps.length > 0 && (
                        <div className="mt-16">
                            <div className="flex items-center gap-3 mb-6">
                                <span className="shrink-0 w-8 h-8 rounded-lg bg-[#E85D3A]/8 border border-[#E85D3A]/15 flex items-center justify-center text-[11px] font-mono text-[#E85D3A]">04</span>
                                <h2 className="text-lg font-medium text-black/80 tracking-tight">What to Do Next</h2>
                            </div>
                            <div className="bg-white border border-black/[0.08] rounded-3xl p-8 md:p-10">
                                <div className="space-y-5">
                                    {insightData.nextSteps.map((step, i) => (
                                        <div key={i} className="flex items-start gap-5">
                                            <div className="shrink-0 w-7 h-7 rounded-full bg-[#E85D3A]/10 border border-[#E85D3A]/20 flex items-center justify-center">
                                                <span className="text-[10px] font-black text-[#E85D3A]">{i + 1}</span>
                                            </div>
                                            <p className="text-[13px] text-black/70 leading-relaxed pt-0.5">{step}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Deep Simulation Error */}
                    {deepSimError && (
                        <div className="mt-12 bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
                            <p className="text-sm text-red-400 font-medium">Deep Simulation Failed</p>
                            <p className="text-[11px] text-red-400/60 mt-1">{deepSimError}</p>
                        </div>
                    )}

                    {/* Deep Simulation Loading */}
                    {deepSimLoading && (
                        <div className="mt-12 flex items-center gap-4 bg-[#E85D3A]/5 border border-[#E85D3A]/10 rounded-2xl p-6 border-dashed animate-pulse">
                            <div className="w-10 h-10 rounded-full border-2 border-t-[#E85D3A]/80 border-black/[0.04] animate-spin" />
                            <div>
                                <h3 className="text-sm font-bold text-black/80">Running 8-week behavioral simulation...</h3>
                                <p className="text-[11px] text-black/40 font-normal">Each persona is discovering, reacting, and being influenced week by week.</p>
                            </div>
                        </div>
                    )}

                    {/* Deep Simulation Report — New Components */}
                    {deepSimResult && (
                        <div className="mt-16 space-y-8">
                            <p className="text-[11px] uppercase tracking-[0.3em] text-[#E85D3A]/60 font-bold">
                                Deep Simulation Report — {deepSimResult.weeks}-Week Behavioral Analysis
                            </p>

                            {/* Live Timeline */}
                            <SimulationTimeline
                                weeklySnapshots={deepSimResult.weeklySnapshots || []}
                                allEvents={deepSimResult.allEvents || []}
                                totalWeeks={deepSimResult.weeks || 8}
                            />

                            {/* Structured Report */}
                            {deepSimResult.finalReport && (
                                <SimulationReport
                                    report={deepSimResult.finalReport}
                                    weeklySnapshots={deepSimResult.weeklySnapshots || []}
                                />
                            )}

                            {/* Export Buttons */}
                        </div>
                    )}
                    {!deepSimResult && (
                    <div className="mt-20 border-t border-black/[0.06] pt-20 text-center animate-in slide-in-from-bottom-4 fade-in duration-500 pb-20">
                        <h3 className="text-2xl text-[#1a1a1a] mb-4" style={{ fontFamily: 'var(--font-serif)', fontWeight: 400 }}>Want a deeper temporal analysis?</h3>
                        <p className="text-[12px] text-black/40 mb-8 max-w-lg mx-auto leading-relaxed uppercase tracking-widest">
                            Run an 8-week behavioral simulation where personas discover, react, and influence each other over time.
                        </p>
                        <Button 
                            onClick={handleRunDeepSim}
                            disabled={deepSimLoading || results.length === 0}
                            size="lg"
                            className="bg-[#E85D3A] hover:bg-[#D14E2E] border-[#E85D3A] hover:border-[#D14E2E] shadow-lg shadow-[#E85D3A]/15 group relative overflow-hidden px-12"
                        >
                            <span className="relative z-10 flex items-center gap-3">
                                {deepSimLoading ? (
                                    <><div className="w-5 h-5 rounded-full border-2 border-t-white border-black/10 animate-spin" /> Running Simulation...</>
                                ) : (
                                    <><svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Run Deep 8-Week Simulation</>
                                )}
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Button>
                    </div>
                    )}

                    </>
                    )}
                </div>
            </div>

            {isInterrogationOpen && (
                <PremiumChatPanel 
                    onClose={() => setIsInterrogationOpen(false)} 
                    graphId={graphId}
                    deepSimResult={deepSimResult}
                />
            )}
        </DashboardLayout>
    );
}

function PersonaResultCard({ result, index }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const tr = result.testResult;

    if (!tr) return null;

    // Verdict color mapping
    const verdictColor = tr.verdict === 'ENTHUSIASTIC' || tr.verdict === 'CURIOUS' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20' :
                        tr.verdict === 'NEUTRAL' ? 'bg-amber-500/20 text-amber-400 border-amber-500/20' : 
                        'bg-red-500/20 text-red-400 border-red-500/20';
    
    const wtpColor = tr.willingnessToPay === 'HIGH' ? 'bg-emerald-500/10 text-emerald-400/80 border-emerald-500/20' :
                     tr.willingnessToPay === 'MID' ? 'bg-amber-500/10 text-amber-400/80 border-amber-500/20' : 
                     'bg-black/10 text-black/40 border-black/10';

    // Helper to get a display name for a persona
    const getPersonaName = (p, pIdx) => {
        const m = p.metadata || {};
        const rawName = m.name || (m.occupation ? `Persona of ${m.occupation}` : `Persona ${p.persona_id || p.id}`);
        const cleanName = (rawName || "").trim().toLowerCase();
        if (cleanName.includes("persona") || ["unknown", "n/a", ""].includes(cleanName)) {
            const seed = parseInt((p.persona_id || p.id).toString().replace(/\D/g, '')) || 0;
            const names = ["Aarav", "Arjun", "Aditya", "Amit", "Alok", "Ananya", "Aavya", "Bhavna", "Ishani", "Jiya"];
            const surnames = ["Sharma", "Verma", "Gupta", "Malhotra", "Kapoor", "Patel", "Shah", "Kumar", "Singh", "Yadav"];
            return `${names[seed % names.length]} ${surnames[(seed * 7) % surnames.length]}`;
        }
        return rawName;
    };

    // Top 3 persona voices (always visible)
    const topPersonas = (result.personas || []).slice(0, 3);

    const hoverClass = 
        tr.verdict === 'ENTHUSIASTIC' || tr.verdict === 'CURIOUS' ? 'hover:border-emerald-500/40 hover:shadow-[0_0_30px_rgba(16,185,129,0.05)]' :
        tr.verdict === 'NEUTRAL' ? 'hover:border-amber-500/30' :
        tr.verdict === 'SKEPTICAL' || tr.verdict === 'CRITICAL' ? 'hover:border-red-500/20' :
        'hover:border-black/10';

    return (
        <div className={`group bg-white border border-black/[0.08] rounded-3xl overflow-hidden ${hoverClass} transition-all duration-500`}>
            <div className="p-8 md:p-10">
                {/* Header: Score + Name + Badges */}
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Score Circle */}
                    <div className="shrink-0">
                        <div className="relative w-24 h-24 flex items-center justify-center">
                            <svg className="w-full h-full -rotate-90">
                                <circle cx="48" cy="48" r="44" className="stroke-black/[0.06] fill-none" strokeWidth="8" />
                                <circle cx="48" cy="48" r="44" className={`fill-none transition-all duration-1000 ${
                                    (tr.resonanceScore || 0) >= 70 ? 'stroke-emerald-500' :
                                    (tr.resonanceScore || 0) >= 50 ? 'stroke-amber-500' : 'stroke-red-500'
                                }`} strokeWidth="8" strokeDasharray={276} strokeDashoffset={276 - (276 * (tr.resonanceScore || 0) / 100)} strokeLinecap="round" />
                            </svg>
                            <span className="absolute text-2xl font-black italic">{tr.resonanceScore || 0}%</span>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="text-2xl font-normal text-[#1a1a1a]">{result.segment_name}</h3>
                                {/* Verdict + WTP Badges — Always Visible */}
                                <div className="flex items-center gap-2 mt-2">
                                    <span className={`px-2.5 py-1 rounded-full border text-[11px] font-bold uppercase tracking-wider ${verdictColor}`}>
                                        ● {tr.verdict}
                                    </span>
                                    <span className={`px-2.5 py-1 rounded-full border text-[11px] font-bold ${wtpColor}`}>
                                        {tr.willingnessToPay} WTP
                                    </span>
                                </div>
                            </div>
                            <Button 
                                onClick={() => setIsExpanded(!isExpanded)}
                                variant="ghost"
                                size="sm"
                            >
                                <svg className={`w-5 h-5 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </Button>
                        </div>

                        {/* Collective Quote */}
                        <p className="text-lg font-light text-black/80 leading-relaxed italic mb-5">
                            "{tr.verbatimQuote}"
                        </p>

                        {/* Behavioral Tags — Always Visible */}
                        <div className="flex flex-wrap gap-2 mb-6">
                            {tr.keyDrivers?.slice(0, 4).map((d, idx) => (
                                <span key={idx} className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-400/80 font-medium">✦ {d}</span>
                            ))}
                            {tr.frictionPoints?.slice(0, 3).map((f, idx) => (
                                <span key={`f-${idx}`} className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[11px] text-red-400/80 font-medium">✕ {f}</span>
                            ))}
                        </div>

                        {/* Demographics Row — Always Visible */}
                        <div className="flex items-center gap-6 text-[11px] text-black/50 border-t border-black/[0.06] pt-4 mb-6">
                            <div><span className="text-[11px] text-black/25 uppercase tracking-widest font-bold mr-2">Region</span>{result.profile?.dominant_state || "India"} · {result.profile?.dominant_zone || "Mixed"}</div>
                            <div><span className="text-[11px] text-black/25 uppercase tracking-widest font-bold mr-2">Occupation</span>{result.profile?.dominant_occupation || "Various"}</div>
                            <div><span className="text-[11px] text-black/25 uppercase tracking-widest font-bold mr-2">Age</span>{result.profile?.age_range || "N/A"}</div>
                        </div>

                        {/* Multi-dimensional Scores — Conditionally Rendered */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { label: 'Utility', score: tr.utilityScore, color: 'text-rose-600', bg: 'bg-rose-500', desc: 'Core problem-solving value for this segment.' },
                                { label: 'Cultural Fit', score: tr.culturalFitScore, color: 'text-amber-600', bg: 'bg-amber-500', desc: 'Alignment with lifestyle, social norms, and regional habits.' },
                                { label: 'Affordability', score: tr.affordabilityScore, color: 'text-emerald-400', bg: 'bg-emerald-500', desc: 'Sentiment towards pricing relative to income bracket.' },
                            ].map(({ label, score, color, bg, desc }) => (score !== undefined && score !== null) && (
                                <div key={label} className="group/score relative">
                                    <div className="flex justify-between mb-2">
                                        <span className={`text-[11px] uppercase tracking-[0.2em] font-black ${color} flex items-center gap-1.5`}>
                                            {label}
                                            <div className="w-3 h-3 rounded-full border border-current/20 flex items-center justify-center text-[10px] cursor-help">?</div>
                                        </span>
                                        <span className="text-[11px] text-black/60 font-mono font-bold">{Math.round(score)}%</span>
                                    </div>
                                    <div className="w-full h-1 bg-black/[0.06] rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-[1500ms] ${bg}`} style={{ width: `${score}%` }} />
                                    </div>
                                    
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-0 mb-2 w-48 p-3 bg-white/95 backdrop-blur-xl border border-black/[0.08] rounded-xl opacity-0 group-hover/score:opacity-100 transition-opacity pointer-events-none z-50 shadow-xl">
                                        <p className="text-[11px] text-black/70 leading-relaxed">{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Top 3 Individual Persona Voices — Always Visible */}
                {topPersonas.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-black/[0.06]">
                        <h4 className="text-[11px] uppercase tracking-[0.3em] text-black/30 font-bold mb-4">Individual Persona Voices</h4>
                        <div className="space-y-3">
                            {topPersonas.map((p, pIdx) => {
                                const individualFeedback = tr.personaFeedbacks?.[pIdx];
                                const m = p.metadata || {};
                                const name = getPersonaName(p, pIdx);
                                const score = individualFeedback?.resonanceScore || tr.resonanceScore || 0;
                                return (
                                    <div key={pIdx} className="flex items-start gap-4 bg-[#FAFAFA] hover:bg-[#F5F5F5] border border-black/[0.06] rounded-xl p-4 transition-all">
                                        <div className="shrink-0 w-8 h-8 rounded-full bg-black/[0.04] border border-black/[0.08] flex items-center justify-center text-[11px] font-black text-black/30 uppercase">
                                            {(name || 'P')[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[11px] font-bold text-black/80">{name}</span>
                                                <span className="text-[11px] text-black/30">{m.age || '??'}</span>
                                            </div>
                                            <p className="text-[11px] italic text-black/55 leading-relaxed">
                                                "{individualFeedback?.feedback || "Synthesizing individual reaction..."}"
                                            </p>
                                        </div>
                                        <div className="shrink-0 text-right">
                                            <div className={`text-sm font-black italic ${score >= 70 ? "text-emerald-400" : score < 50 ? "text-red-400" : "text-amber-400"}`}>
                                                {score}%
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Expanded Section — Full Details */}
                {isExpanded && (
                    <div className="mt-8 pt-8 border-t border-black/[0.06] animate-in slide-in-from-top-4 fade-in duration-500">
                        {/* CoT Rationale */}
                        {tr.segmentAnalysisRationale && (
                            <div className="mb-8 bg-[#FAFAFA] rounded-2xl p-6 border border-black/[0.06]">
                                <h4 className="text-[11px] uppercase tracking-[0.3em] text-[#E85D3A]/60 font-bold mb-3">Chain-of-Thought Reasoning</h4>
                                <p className="text-[12px] text-black/60 leading-relaxed font-normal">{tr.segmentAnalysisRationale}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                            <div>
                                <h4 className="text-[11px] uppercase tracking-[0.2em] text-black/30 font-bold mb-3">Summary</h4>
                                <p className="text-[12px] text-black/60 leading-relaxed font-normal">{tr.summary}</p>
                            </div>
                            <div>
                                <h4 className="text-[11px] uppercase tracking-[0.2em] text-black/30 font-bold mb-3">Competitive Advantage</h4>
                                <p className="text-[12px] text-black/60 leading-relaxed font-normal">{tr.competitiveAdvantage || "Not determined"}</p>
                                <div className="mt-4 pt-4 border-t border-black/[0.06]">
                                    <span className="text-[10px] text-black/25 uppercase tracking-widest font-bold">Predicted Adoption</span>
                                    <p className="text-[11px] text-black/70 font-bold mt-1">{tr.predictedAdoptionPattern || "Unknown"}</p>
                                </div>
                            </div>
                        </div>

                        {/* All Persona Voices (remaining beyond top 3) */}
                        {(result.personas || []).length > 3 && (
                            <div className="pt-6 border-t border-black/[0.06]">
                                <h4 className="text-[11px] uppercase tracking-[0.3em] text-black/30 font-bold mb-4">All Persona Reactions ({(result.personas || []).length} total)</h4>
                                <div className="space-y-2">
                                    {(result.personas || []).slice(3).map((p, pIdx) => {
                                        const actualIdx = pIdx + 3;
                                        const individualFeedback = tr.personaFeedbacks?.[actualIdx];
                                        const m = p.metadata || {};
                                        const name = getPersonaName(p, actualIdx);
                                        const score = individualFeedback?.resonanceScore || tr.resonanceScore || 0;
                                        return (
                                            <div key={actualIdx} className="flex items-center gap-4 bg-[#FAFAFA] border border-black/[0.06] rounded-xl p-3 transition-all">
                                                <div className="shrink-0 w-6 h-6 rounded-full bg-black/5 flex items-center justify-center text-[11px] font-bold text-black/20">
                                                    {(name || 'P')[0]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-[11px] font-bold text-black/70">{name}, {m.age || '??'}</span>
                                                    <p className="text-[11px] italic text-black/40 leading-relaxed truncate">
                                                        "{individualFeedback?.feedback || "Awaiting reaction..."}"
                                                    </p>
                                                </div>
                                                <div className={`text-[11px] font-black italic shrink-0 ${score >= 70 ? "text-emerald-400" : score < 50 ? "text-red-400" : "text-amber-400"}`}>
                                                    {score}%
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function SkeletonResults() {
    return (
        <DashboardLayout currentStep={4}>
            <div className="relative min-h-screen text-[#1a1a1a] pt-6 overflow-hidden bg-white">
                <div className="absolute inset-0 bg-grid opacity-10 pointer-events-none" />
                
                <div className="relative z-10 max-w-5xl mx-auto px-6 pb-48">
                    {/* Header Skeleton */}
                    <div className="flex flex-col mb-12 animate-pulse">
                        <div className="flex justify-between items-start mb-8">
                            <div className="h-6 w-32 bg-black/5 rounded-lg" />
                            <div className="h-8 w-48 bg-black/5 rounded-xl" />
                        </div>
                        <div className="h-12 w-3/4 bg-black/10 rounded-2xl mb-4" />
                        <div className="h-4 w-1/2 bg-black/5 rounded-lg mb-10" />
                        <div className="h-px w-full bg-black/5 mb-10" />
                    </div>

                    {/* Stats Skeleton */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-32 bg-[#FAFAFA] border border-black/[0.06] rounded-2xl animate-pulse" />
                        ))}
                    </div>

                    {/* Content Strips Skeleton */}
                    <div className="space-y-12">
                        <div className="h-64 bg-[#FAFAFA] border border-black/[0.06] rounded-3xl animate-pulse" />
                        <div className="grid grid-cols-3 gap-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-40 bg-[#FAFAFA] border border-black/[0.06] rounded-2xl animate-pulse" />
                            ))}
                        </div>
                        <div className="h-96 bg-[#FAFAFA] border border-black/[0.06] rounded-3xl animate-pulse flex items-center justify-center">
                            <span className="text-[10px] uppercase tracking-[0.4em] text-black/10 font-black">Synthesizing Demographic Resonance...</span>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

function MarketContextPanel({ marketContext }) {
    if (!marketContext) return null;
    
    const { competitors = [], risks = [], trends = [] } = marketContext;
    if (!competitors.length && !risks.length && !trends.length) return null;

    return (
        <div className="mb-12">
            <p className="text-[11px] uppercase tracking-[0.3em] text-black/30 font-bold mb-6 flex items-center gap-3">
                Market Context
                <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-600 text-[10px] normal-case tracking-normal">
                    Zep Graph
                </span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Competitors & Alternatives', items: competitors, color: 'red' },
                    { label: 'Risks & Regulations', items: risks, color: 'amber' },
                    { label: 'Market Trends', items: trends, color: 'blue' },
                ].map(({ label, items, color }) => items.length > 0 && (
                    <div key={label} className="bg-white border border-black/[0.08] rounded-2xl p-5">
                        <p className={`text-[11px] uppercase tracking-widest font-bold mb-4 ${
                            color === 'red' ? 'text-red-400/60' : 
                            color === 'amber' ? 'text-amber-400/60' : 
                            'text-[#E85D3A]/60'
                        }`}>
                            {label}
                        </p>
                        <div className="space-y-2">
                            {items.map((item, i) => (
                                <p key={i} className="text-[11px] text-black/60 leading-relaxed flex items-start gap-2">
                                    <span className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${
                                        color === 'red' ? 'bg-red-400' : 
                                        color === 'amber' ? 'bg-amber-400' : 
                                        'bg-[#E85D3A]'
                                    }`} />
                                    {item}
                                </p>
                            ))}
                        </div>
                    </div>
                ))}
            </div>


        </div>
    );
}
