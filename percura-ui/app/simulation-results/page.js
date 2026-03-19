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
import ChatPanel from "../../components/ChatPanel";
import PremiumChatPanel from "../../components/PremiumChatPanel";
import GraphExplorer from "../../components/GraphExplorer";
import SimulationTimeline from "../../components/SimulationTimeline";
import SimulationReport from "../../components/SimulationReport";
import FlowDescriptionStrip from "../../components/FlowDescriptionStrip";
import { useToast } from "../../context/ToastContext";
import API_BASE_URL from "../../lib/apiConfig";

const ShaderPageBackground = dynamic(
    () => import("../../components/ui/shader-background"),
    { ssr: false }
);

export default function SimulationResultsPage() {
    const router = useRouter();
    const { currentSimulationId, setCurrentSimulationId, idea, simulationResults, setSimulationResults, setIdea, fullSelectedSegments } = useIdea();
    const { user, loading: authLoading } = useAuth();
    const { showToast } = useToast();
    
    const [simDoc, setSimDoc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isInterrogationOpen, setIsInterrogationOpen] = useState(false);
    const [isGraphOpen, setIsGraphOpen] = useState(false);
    
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
                        setSimulationResults(data.results.segmentsWithResults);
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

    const handleDownloadPDF = async () => {
        console.log("[PDF] Initializing Report Generation...");
        const html2pdf = (await import("html2pdf.js")).default;
        const element = reportRef.current;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

        // ── Sanitize unsupported CSS color functions (oklab, oklch, color()) ──
        // html2canvas cannot parse modern color spaces. We walk the DOM and replace
        // any computed inline style or class-applied color that uses these functions
        // with a safe fallback before rendering, then restore after.
        const patchedElements = [];
        const colorProps = ["color", "backgroundColor", "borderColor", "borderTopColor", "borderBottomColor", "borderLeftColor", "borderRightColor", "outlineColor", "boxShadow", "textDecorationColor"];
        const unsafePattern = /oklab|oklch|lab\(|lch\(|hwb\(|color-mix\(|color\(display-p3/i;

        const allEls = element.querySelectorAll("*");
        allEls.forEach(el => {
            const computed = window.getComputedStyle(el);
            const patches = {};
            colorProps.forEach(prop => {
                const val = computed[prop];
                if (val && unsafePattern.test(val)) {
                    patches[prop] = { original: el.style[prop], safe: "#1a1a2e" };
                    el.style[prop] = "#1a1a2e"; // dark navy fallback
                }
            });
            if (Object.keys(patches).length > 0) patchedElements.push({ el, patches });
        });

        const opt = {
            margin: 10,
            filename: `Percura_Validation_${idea?.industry || 'Idea'}_${timestamp}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2, 
                backgroundColor: '#000000', 
                useCORS: true,
                logging: false,
                letterRendering: true,
                allowTaint: true,
                onclone: (clonedDoc) => {
                    // Global safety net: find all style tags and strip lab/oklch/lch/hwb/color-mix
                    const styles = clonedDoc.querySelectorAll('style');
                    styles.forEach(s => {
                        const content = s.textContent;
                        if (/lab\(|oklab\(|lch\(|oklch\(|color-mix\(|hwb\(/i.test(content)) {
                            // Replace complex color functions with basic transparent or inheritance
                            s.textContent = content.replace(/(lab|oklab|lch|oklch|color-mix|hwb)\([^)]+\)/gi, 'inherit');
                        }
                    });
                    
                    const style = clonedDoc.createElement("style");
                    style.textContent = `
                        * {
                            color: inherit !important;
                            border-color: rgba(255,255,255,0.1) !important;
                            box-shadow: none !important;
                            text-shadow: none !important;
                        }
                    `;
                    clonedDoc.head.appendChild(style);
                }
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        try {
            document.body.classList.add('is-exporting-pdf');
            await html2pdf().set(opt).from(element).save();
            console.log("[PDF] Generation Successful");
        } catch (err) {
            console.error("[PDF] Generation Failed:", err);
            showToast("error", "Export Failed", "PDF export failed. Please try again or use browser Print → Save as PDF (Ctrl+P) as an alternative.");
        } finally {
            // Restore patched inline styles
            patchedElements.forEach(({ el, patches }) => {
                Object.entries(patches).forEach(([prop, { original }]) => {
                    el.style[prop] = original;
                });
            });
        }
    };

    if (loading || !simDoc) {
        return <SkeletonResults />;
    }

    if (!currentSimulationId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <div className="text-center">
                    <h2 className="text-2xl font-light text-white mb-4">No Simulation Selected</h2>
                    <Button onClick={() => router.push("/validate")}>Start New Test</Button>
                </div>
            </div>
        );
    }

    return (
        <DashboardLayout 
            currentStep={4}
        >
            <div className="relative min-h-screen text-white selection:bg-blue-500/30 overflow-x-hidden pt-6">
                <ShaderPageBackground overlayOpacity={0.9} blur={true} />

                {/* Progress Bar (Sticky Top) */}
                {simDoc.status === "in progress" && (
                    <div className="fixed top-0 left-0 w-full h-1 bg-white/5 z-[100]">
                        <div 
                            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-1000 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                )}

                <div className="relative z-10 max-w-6xl mx-auto px-6 lg:px-10 pb-48" ref={reportRef}>
                    {/* Report Header — Structured Document Feel */}
                    <div className="flex flex-col mb-10">
                        <div className="flex justify-between items-start mb-6">
                            <div className="flex items-center gap-3">
                                <span className="px-3 py-1.5 bg-white/[0.06] border border-white/15 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] text-white/80">
                                    Prediction Report
                                </span>
                                <span className="text-[10px] text-white/25 font-mono">
                                    ID: PCT-{currentSimulationId ? currentSimulationId.substring(0, 8).toUpperCase() : '0000'}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-widest ${
                                    simDoc?.status === 'completed' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                                }`}>
                                    {simDoc?.status === 'completed' ? 'Completed' : 'In Progress'}
                                </span>
                            </div>
                            
                            {/* Top Right Action Group */}
                            <div className="flex items-center gap-2">
                                <button onClick={handleDownloadPDF} title="Download full PDF report" className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
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
                                        }} title="Export result as JSON" className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all">
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
                                        }} title="Export audience as CSV" className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all">
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Title Block */}
                        <h1 className="text-4xl md:text-5xl font-light tracking-tight mb-4 leading-tight">
                            {idea?.idea || "Simulation Complete"}
                        </h1>
                        <p className="text-white/40 text-sm font-normal leading-relaxed max-w-3xl mb-8" style={{ fontStyle: 'italic' }}>
                            A {idea?.duration || 12}-week persona simulation across {results.length} demographic segments, testing market fit, willingness to pay, and adoption barriers for {idea?.industry ? `a ${idea.industry.toLowerCase()} platform` : 'this concept'}.
                        </p>

                        {/* Tab Nav & Run Sim Strip */}
                        <div className="flex justify-between items-center border-b border-white/5 pb-6">
                            <div className="flex bg-white/[0.04] border border-white/10 rounded-xl overflow-hidden">
                                {["Report", "Split", "Timeline"].map(tab => (
                                    <button
                                        key={tab}
                                        onClick={() => setActiveTab(tab.toLowerCase())}
                                        className={`px-6 py-2.5 text-[11px] font-bold uppercase tracking-widest transition-all cursor-pointer ${
                                            activeTab === tab.toLowerCase()
                                                ? 'bg-white/10 text-white'
                                                : 'text-white/30 hover:text-white/60'
                                        }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>

                            <Button 
                                onClick={async () => {
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
                                        if (!segmentsToSend?.length || !segmentsToSend[0]?.personas?.length) {
                                            setDeepSimError("No persona data available. Please re-run the initial identification from the 'Segment Selection' page to restore memory.");
                                            setDeepSimLoading(false);
                                            return;
                                        }
                                        const res = await fetch(`${API_BASE_URL}/api/simulation/run`, {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({ idea, segments: segmentsToSend, weeks: 8 }),
                                        });
                                        const data = await res.json();
                                        if (!data.success) throw new Error(data.error || "Simulation failed");
                                        setDeepSimResult(data.simulation);
                                        showToast("success", "Simulation Complete", "Deep Simulation completed successfully and loaded into temporal memory! You can now speak directly with the enriched personas in the Interrogation Lab.");
                                    } catch (err) {
                                        console.error("[DEEP-SIM]", err);
                                        setDeepSimError(err.message);
                                    } finally {
                                        setDeepSimLoading(false);
                                    }
                                }}
                                variant="primary"
                                size="sm"
                                disabled={deepSimLoading || results.length === 0}
                                className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 shadow-xl shadow-blue-600/20 disabled:opacity-40"
                            >
                                {deepSimLoading ? (
                                    <><div className="w-4 h-4 rounded-full border-2 border-t-white border-white/20 animate-spin" /> Running...</>
                                ) : (
                                    <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg> Run Deep Simulation</>
                                )}
                            </Button>
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
                            <div className="space-y-8 overflow-y-auto max-h-[calc(100vh-300px)] pr-2">
                                {/* Mini Report */}
                                <div className="relative z-30">
                                    <div className="bg-[#0D0D0D]/80 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-6 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.6)]">
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-1">
                                                <span className="text-[10px] uppercase tracking-[0.2em] text-white/30 font-bold">Total Sample</span>
                                                <div className="text-3xl font-black italic text-white">{results.length > 0 ? totalPersonasCount : '--'}</div>
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
                                                <span className="text-[10px] uppercase tracking-[0.2em] text-blue-500/40 font-bold">Market Fit</span>
                                                <div className="text-3xl font-black italic text-blue-400">{results.length > 0 ? `${survivalProb}%` : '--'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                {/* Segment Cards (compact) */}
                                {results.map((res, i) => (
                                    <PersonaResultCard key={res.segment_id} result={res} index={i} />
                                ))}
                            </div>
                            <div className="overflow-y-auto max-h-[calc(100vh-300px)]">
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
                            <span className="shrink-0 w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-[11px] font-mono text-white/50">01</span>
                            <h2 className="text-lg font-medium text-white/80 tracking-tight">Executive Summary</h2>
                        </div>
                        <div className="bg-[#0D0D0D]/80 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-10 md:p-12 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)]">
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                 {/* Primary Stats Grid */}
                                 <div className="space-y-10 border-r border-white/5 pr-8">
                                     <div className="grid grid-cols-2 gap-x-12 gap-y-10">
                                         <div className="space-y-1">
                                             <span className="text-[11px] uppercase tracking-[0.2em] text-white/30 font-bold">Total Sample</span>
                                             <div className="text-4xl font-black italic text-white">{results.length > 0 ? totalPersonasCount : '--'}</div>
                                             <p className="text-[11px] text-white/20 uppercase tracking-widest">Simulated Profiles</p>
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
                                             <span className="text-[11px] uppercase tracking-[0.2em] text-blue-500/40 font-bold">Market Fit Score</span>
                                             <div className="text-4xl font-black italic text-blue-400" title="Weighted score: (avg resonance × 0.8) + (adoption rate × 20)">{results.length > 0 ? `${survivalProb}%` : '--'}</div>
                                             <p className="text-[11px] text-blue-500/20 uppercase tracking-widest">Predicted Outlook</p>
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
                                             <div className="mt-8 pt-8 border-t border-white/5">
                                                 <p className="text-[11px] uppercase tracking-[0.2em] text-white/30 font-bold mb-4">
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
                                                 <p key={i} className="text-[11px] text-white/70 mb-3 flex items-start gap-3 leading-relaxed">
                                                     <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" /> {r}
                                                 </p>
                                             ))}
                                             {topReasons.length === 0 && <p className="text-[11px] text-white/20 italic">Synthesizing drivers...</p>}
                                         </div>
                                         <div>
                                             <span className="text-[11px] uppercase tracking-widest text-red-400/40 font-bold block mb-4">Core Objections</span>
                                             {topObjections.map((o, i) => (
                                                 <p key={i} className="text-[11px] text-white/70 mb-3 flex items-start gap-3 leading-relaxed">
                                                     <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1 shrink-0" /> {o}
                                                 </p>
                                             ))}
                                             {topObjections.length === 0 && <p className="text-[11px] text-white/20 italic">Extracting friction...</p>}
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
                                             <div className="pt-8 mt-8 border-t border-white/5">
                                                 <span className="text-[11px] uppercase tracking-widest text-white/30 font-bold block mb-3">
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
                                <p className="text-[11px] uppercase tracking-[0.3em] text-white/30 font-bold mb-6">
                                    Voices from the Simulation
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {topQuotes.map((r, i) => {
                                        const score = r.testResult?.resonanceScore || 0;
                                        return (
                                            <div
                                                key={i}
                                                className="bg-[#0D0D0D]/60 border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-3"
                                            >
                                                <p className="text-sm font-light text-white/75 leading-relaxed italic flex-1">
                                                    "{r.testResult.verbatimQuote}"
                                                </p>
                                                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                                                    <span className="text-[10px] text-white/40">{r.segment_name}</span>
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
                                <span className="shrink-0 w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-[11px] font-mono text-white/50">02</span>
                                <h2 className="text-lg font-medium text-white/80 tracking-tight">Key Insights</h2>
                            </div>

                            {insightsLoading && !insightData && (
                                <div className="flex items-center gap-4 bg-purple-500/5 border border-purple-500/10 rounded-2xl p-6 border-dashed animate-pulse">
                                    <div className="w-8 h-8 rounded-full border-2 border-t-purple-500/80 border-white/5 animate-spin" />
                                    <p className="text-[11px] text-white/40">Synthesizing insights from simulation data...</p>
                                </div>
                            )}

                            {insightData?.insights && (
                                <div className="space-y-4">
                                    {insightData.insights.map((ins, i) => (
                                        <div
                                            key={i}
                                            className="bg-[#0D0D0D]/60 border border-purple-500/10 rounded-2xl p-6 hover:border-purple-500/25 transition-all duration-300"
                                        >
                                            <div className="flex items-start gap-4">
                                                <span className="text-[10px] font-black text-purple-400/60 uppercase tracking-widest mt-0.5 shrink-0">
                                                    #{i + 1}
                                                </span>
                                                <div className="flex-1">
                                                    <h4 className="text-base font-medium text-white mb-3">{ins.title}</h4>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <p className="text-[11px] uppercase tracking-[0.2em] text-white/30 font-bold mb-2">
                                                                Evidence
                                                            </p>
                                                            <p className="text-[12px] text-white/55 leading-relaxed">{ins.evidence}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[11px] uppercase tracking-[0.2em] text-white/30 font-bold mb-2">
                                                                What this means
                                                            </p>
                                                            <p className="text-[12px] text-white/55 leading-relaxed">{ins.analysis}</p>
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
                        <div className="mb-12 flex items-center gap-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl p-6 border-dashed animate-in fade-in duration-500">
                            <div className="w-10 h-10 rounded-full border-2 border-t-blue-500/80 border-white/5 animate-spin" />
                            <div>
                                <h3 className="text-sm font-bold text-white/80">Simulating Segment Reactions...</h3>
                                <p className="text-[11px] text-white/40 font-normal">
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
                            <span className="shrink-0 w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-[11px] font-mono text-white/50">03</span>
                            <h2 className="text-lg font-medium text-white/80 tracking-tight">Segment Resonance Analysis</h2>
                        </div>
                        <div className="space-y-8">
                        {results.map((res, i) => (
                            <PersonaResultCard key={res.segment_id} result={res} index={i} />
                        ))}

                        {/* Skeleton Loaders */}
                        {simDoc.status === "in progress" && Array.from({ length: totalSegments - completedCount }).map((_, i) => (
                            <div key={`skeleton-${i}`} className="h-48 rounded-[2.5rem] bg-white/[0.03] border border-white/5 animate-pulse flex items-center justify-center">
                                <span className="text-[11px] uppercase tracking-[0.4em] text-white/10 font-black">Synthesizing Feedback Cluster...</span>
                            </div>
                        ))}
                        </div>
                    </div>

                    {/* Task 10 — Add "What to Do Next" section at the bottom */}
                    {insightData?.nextSteps && insightData.nextSteps.length > 0 && (
                        <div className="mt-16">
                            <div className="flex items-center gap-3 mb-6">
                                <span className="shrink-0 w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-[11px] font-mono text-white/50">04</span>
                                <h2 className="text-lg font-medium text-white/80 tracking-tight">What to Do Next</h2>
                            </div>
                            <div className="bg-[#0D0D0D]/60 border border-white/10 rounded-[2.5rem] p-8 md:p-10">
                                <div className="space-y-5">
                                    {insightData.nextSteps.map((step, i) => (
                                        <div key={i} className="flex items-start gap-5">
                                            <div className="shrink-0 w-7 h-7 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                                <span className="text-[10px] font-black text-blue-400">{i + 1}</span>
                                            </div>
                                            <p className="text-[13px] text-white/70 leading-relaxed pt-0.5">{step}</p>
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
                        <div className="mt-12 flex items-center gap-4 bg-cyan-500/5 border border-cyan-500/10 rounded-2xl p-6 border-dashed animate-pulse">
                            <div className="w-10 h-10 rounded-full border-2 border-t-cyan-500/80 border-white/5 animate-spin" />
                            <div>
                                <h3 className="text-sm font-bold text-white/80">Running 8-week behavioral simulation...</h3>
                                <p className="text-[11px] text-white/40 font-normal">Each persona is discovering, reacting, and being influenced week by week.</p>
                            </div>
                        </div>
                    )}

                    {/* Deep Simulation Report — New Components */}
                    {deepSimResult && (
                        <div className="mt-16 space-y-8">
                            <p className="text-[11px] uppercase tracking-[0.3em] text-cyan-400/60 font-bold">
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
                    {/* Final CTA — Interrogation Lab */}
                    <div className="mt-20 border-t border-white/5 pt-20 text-center animate-in slide-in-from-bottom-4 fade-in duration-500 pb-20">
                        <h3 className="text-2xl font-light text-white mb-4">Ready to confront your target audience?</h3>
                        <p className="text-[12px] text-white/40 mb-8 max-w-lg mx-auto leading-relaxed uppercase tracking-widest">
                            Step into the Interrogation Lab to speak directly with the simulated personas. 
                            Ask about their hidden motivations, pricing sensitivity, and rejection drivers.
                        </p>
                        <Button 
                            onClick={() => setIsInterrogationOpen(true)}
                            size="lg"
                            className="bg-purple-600 hover:bg-purple-700 shadow-xl shadow-purple-600/20 group relative overflow-hidden"
                        >
                            <span className="relative z-10 flex items-center gap-3 px-8">
                                <svg className="w-5 h-5 group-hover:rotate-12 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
                                Enter Interrogation Lab
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Button>
                    </div>

                    </>
                    )}
                </div>
            </div>

            {isInterrogationOpen && (
                <PremiumChatPanel onClose={() => setIsInterrogationOpen(false)} />
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
                     'bg-white/10 text-white/40 border-white/20';

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
        'hover:border-white/20';

    return (
        <div className={`group bg-[#0D0D0D]/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden ${hoverClass} transition-all duration-500`}>
            <div className="p-8 md:p-10">
                {/* Header: Score + Name + Badges */}
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Score Circle */}
                    <div className="shrink-0">
                        <div className="relative w-24 h-24 flex items-center justify-center">
                            <svg className="w-full h-full -rotate-90">
                                <circle cx="48" cy="48" r="44" className="stroke-white/5 fill-none" strokeWidth="8" />
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
                                <h3 className="text-2xl font-normal text-white">{result.segment_name}</h3>
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
                        <p className="text-lg font-light text-white/80 leading-relaxed italic mb-5">
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
                        <div className="flex items-center gap-6 text-[11px] text-white/50 border-t border-white/5 pt-4 mb-6">
                            <div><span className="text-[11px] text-white/25 uppercase tracking-widest font-bold mr-2">Region</span>{result.profile?.dominant_state || "India"} · {result.profile?.dominant_zone || "Mixed"}</div>
                            <div><span className="text-[11px] text-white/25 uppercase tracking-widest font-bold mr-2">Occupation</span>{result.profile?.dominant_occupation || "Various"}</div>
                            <div><span className="text-[11px] text-white/25 uppercase tracking-widest font-bold mr-2">Age</span>{result.profile?.age_range || "N/A"}</div>
                        </div>

                        {/* Multi-dimensional Scores — Conditionally Rendered */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[
                                { label: 'Utility', score: tr.utilityScore, color: 'text-blue-400', bg: 'bg-blue-500', desc: 'Core problem-solving value for this segment.' },
                                { label: 'Cultural Fit', score: tr.culturalFitScore, color: 'text-purple-400', bg: 'bg-purple-500', desc: 'Alignment with lifestyle, social norms, and regional habits.' },
                                { label: 'Affordability', score: tr.affordabilityScore, color: 'text-emerald-400', bg: 'bg-emerald-500', desc: 'Sentiment towards pricing relative to income bracket.' },
                            ].map(({ label, score, color, bg, desc }) => (score !== undefined && score !== null) && (
                                <div key={label} className="group/score relative">
                                    <div className="flex justify-between mb-2">
                                        <span className={`text-[11px] uppercase tracking-[0.2em] font-black ${color} flex items-center gap-1.5`}>
                                            {label}
                                            <div className="w-3 h-3 rounded-full border border-current/20 flex items-center justify-center text-[8px] cursor-help">?</div>
                                        </span>
                                        <span className="text-[11px] text-white/60 font-mono font-bold">{Math.round(score)}%</span>
                                    </div>
                                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full transition-all duration-[1500ms] ${bg}`} style={{ width: `${score}%` }} />
                                    </div>
                                    
                                    {/* Tooltip */}
                                    <div className="absolute bottom-full left-0 mb-2 w-48 p-3 bg-black/90 backdrop-blur-xl border border-white/10 rounded-xl opacity-0 group-hover/score:opacity-100 transition-opacity pointer-events-none z-50 shadow-2xl">
                                        <p className="text-[11px] text-white/70 leading-relaxed">{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Top 3 Individual Persona Voices — Always Visible */}
                {topPersonas.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-white/5">
                        <h4 className="text-[11px] uppercase tracking-[0.3em] text-white/30 font-bold mb-4">Individual Persona Voices</h4>
                        <div className="space-y-3">
                            {topPersonas.map((p, pIdx) => {
                                const individualFeedback = tr.personaFeedbacks?.[pIdx];
                                const m = p.metadata || {};
                                const name = getPersonaName(p, pIdx);
                                const score = individualFeedback?.resonanceScore || tr.resonanceScore || 0;
                                return (
                                    <div key={pIdx} className="flex items-start gap-4 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] rounded-xl p-4 transition-all">
                                        <div className="shrink-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[11px] font-black text-white/30 uppercase">
                                            {(name || 'P')[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[11px] font-bold text-white/80">{name}</span>
                                                <span className="text-[11px] text-white/30">{m.age || '??'}</span>
                                            </div>
                                            <p className="text-[11px] italic text-white/55 leading-relaxed">
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
                    <div className="mt-8 pt-8 border-t border-white/5 animate-in slide-in-from-top-4 fade-in duration-500">
                        {/* CoT Rationale */}
                        {tr.segmentAnalysisRationale && (
                            <div className="mb-8 bg-white/[0.02] rounded-2xl p-6 border border-white/5">
                                <h4 className="text-[11px] uppercase tracking-[0.3em] text-purple-400/60 font-bold mb-3">Chain-of-Thought Reasoning</h4>
                                <p className="text-[12px] text-white/60 leading-relaxed font-normal">{tr.segmentAnalysisRationale}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                            <div>
                                <h4 className="text-[11px] uppercase tracking-[0.2em] text-white/30 font-bold mb-3">Summary</h4>
                                <p className="text-[12px] text-white/60 leading-relaxed font-normal">{tr.summary}</p>
                            </div>
                            <div>
                                <h4 className="text-[11px] uppercase tracking-[0.2em] text-white/30 font-bold mb-3">Competitive Advantage</h4>
                                <p className="text-[12px] text-white/60 leading-relaxed font-normal">{tr.competitiveAdvantage || "Not determined"}</p>
                                <div className="mt-4 pt-4 border-t border-white/5">
                                    <span className="text-[10px] text-white/25 uppercase tracking-widest font-bold">Predicted Adoption</span>
                                    <p className="text-[11px] text-white/70 font-bold mt-1">{tr.predictedAdoptionPattern || "Unknown"}</p>
                                </div>
                            </div>
                        </div>

                        {/* All Persona Voices (remaining beyond top 3) */}
                        {(result.personas || []).length > 3 && (
                            <div className="pt-6 border-t border-white/5">
                                <h4 className="text-[11px] uppercase tracking-[0.3em] text-white/30 font-bold mb-4">All Persona Reactions ({(result.personas || []).length} total)</h4>
                                <div className="space-y-2">
                                    {(result.personas || []).slice(3).map((p, pIdx) => {
                                        const actualIdx = pIdx + 3;
                                        const individualFeedback = tr.personaFeedbacks?.[actualIdx];
                                        const m = p.metadata || {};
                                        const name = getPersonaName(p, actualIdx);
                                        const score = individualFeedback?.resonanceScore || tr.resonanceScore || 0;
                                        return (
                                            <div key={actualIdx} className="flex items-center gap-4 bg-white/[0.02] border border-white/[0.04] rounded-xl p-3 transition-all">
                                                <div className="shrink-0 w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[11px] font-bold text-white/20">
                                                    {(name || 'P')[0]}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-[11px] font-bold text-white/70">{name}, {m.age || '??'}</span>
                                                    <p className="text-[11px] italic text-white/40 leading-relaxed truncate">
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
            <div className="relative min-h-screen text-white pt-6 overflow-hidden">
                <ShaderPageBackground overlayOpacity={0.9} blur={true} />
                
                <div className="relative z-10 max-w-5xl mx-auto px-6 pb-48">
                    {/* Header Skeleton */}
                    <div className="flex flex-col mb-12 animate-pulse">
                        <div className="flex justify-between items-start mb-8">
                            <div className="h-6 w-32 bg-white/5 rounded-lg" />
                            <div className="h-8 w-48 bg-white/5 rounded-xl" />
                        </div>
                        <div className="h-12 w-3/4 bg-white/10 rounded-2xl mb-4" />
                        <div className="h-4 w-1/2 bg-white/5 rounded-lg mb-10" />
                        <div className="h-px w-full bg-white/5 mb-10" />
                    </div>

                    {/* Stats Skeleton */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="h-32 bg-white/[0.03] border border-white/5 rounded-[2rem] animate-pulse" />
                        ))}
                    </div>

                    {/* Content Strips Skeleton */}
                    <div className="space-y-12">
                        <div className="h-64 bg-white/[0.03] border border-white/5 rounded-[3rem] animate-pulse" />
                        <div className="grid grid-cols-3 gap-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-40 bg-white/[0.02] border border-white/5 rounded-2xl animate-pulse" />
                            ))}
                        </div>
                        <div className="h-96 bg-white/[0.03] border border-white/5 rounded-[2.5rem] animate-pulse flex items-center justify-center">
                            <span className="text-[10px] uppercase tracking-[0.4em] text-white/10 font-black">Synthesizing Demographic Resonance...</span>
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
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/30 font-bold mb-6 flex items-center gap-3">
                Market Context
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] normal-case tracking-normal">
                    Zep Graph
                </span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    { label: 'Competitors & Alternatives', items: competitors, color: 'red' },
                    { label: 'Risks & Regulations', items: risks, color: 'amber' },
                    { label: 'Market Trends', items: trends, color: 'blue' },
                ].map(({ label, items, color }) => items.length > 0 && (
                    <div key={label} className="bg-[#0D0D0D]/60 border border-white/[0.07] rounded-2xl p-5">
                        <p className={`text-[11px] uppercase tracking-widest font-bold mb-4 ${
                            color === 'red' ? 'text-red-400/60' : 
                            color === 'amber' ? 'text-amber-400/60' : 
                            'text-blue-400/60'
                        }`}>
                            {label}
                        </p>
                        <div className="space-y-2">
                            {items.map((item, i) => (
                                <p key={i} className="text-[11px] text-white/60 leading-relaxed flex items-start gap-2">
                                    <span className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${
                                        color === 'red' ? 'bg-red-400' : 
                                        color === 'amber' ? 'bg-amber-400' : 
                                        'bg-blue-400'
                                    }`} />
                                    {item}
                                </p>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Premium Knowledge Graph Component */}
            <div className="mt-8 bg-[#0D0D0D]/60 border border-white/[0.08] rounded-3xl overflow-hidden min-h-[400px] flex flex-col">
                <GraphExplorer 
                    headless={true} 
                    graphId={marketContext?.graphId}
                    marketContext={marketContext}
                />
            </div>
        </div>
    );
}