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
import API_BASE_URL from "../../lib/apiConfig";

const ShaderPageBackground = dynamic(
    () => import("../../components/ui/shader-background"),
    { ssr: false }
);

export default function SimulationResultsPage() {
    const router = useRouter();
    const { currentSimulationId, idea, simulationResults, setSimulationResults, setIdea } = useIdea();
    const { user, loading: authLoading } = useAuth();
    
    const [simDoc, setSimDoc] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isInterrogationOpen, setIsInterrogationOpen] = useState(false);
    
    const reportRef = useRef(null);

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
            const segmentsToTest = simDoc.results?.segments || [];
            const existingResults = simDoc.results?.segmentsWithResults || [];
            
            const results = [...existingResults];
            
            for (const segment of segmentsToTest) {
                // Skip if already has result
                if (existingResults.find(r => r.segment_id === segment.segment_id)) continue;

                try {
                    const response = await fetch(`${API_BASE_URL}/api/test-segment`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ idea: simDoc.ideaData, segment })
                    });
                    const data = await response.json();
                    if (data.success) {
                        results.push({ ...segment, testResult: data.testResult });
                        
                        // Update local state immediately so UI reflects progress
                        setSimulationResults([...results]);

                        // Try to persist to Firestore — but don't crash if it fails
                        try {
                            await setDoc(doc(db, "simulations", currentSimulationId), {
                                results: {
                                    segmentsWithResults: results
                                }
                            }, { merge: true });
                        } catch (permErr) {
                            console.warn("[FIRESTORE] Could not persist partial results (permission issue). Using local state.", permErr.message);
                        }
                    }
                } catch (err) {
                    console.error("Error testing segment:", segment.segment_name, err);
                }
            }

            // Try to finalize status in Firestore
            try {
                await setDoc(doc(db, "simulations", currentSimulationId), {
                    status: "completed"
                }, { merge: true });
            } catch (permErr) {
                console.warn("[FIRESTORE] Could not update simulation status:", permErr.message);
            }

            setIsProcessing(false);
        };

        processSimulation();
    }, [simDoc, isProcessing, currentSimulationId]);

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
            alert("PDF export failed. Please try again or use browser Print → Save as PDF (Ctrl+P) as an alternative.");
        } finally {
            // Restore patched inline styles
            patchedElements.forEach(({ el, patches }) => {
                Object.entries(patches).forEach(([prop, { original }]) => {
                    el.style[prop] = original;
                });
            });
            document.body.classList.remove('is-exporting-pdf');
        }
    };

    if (loading) {
        return <div className="min-h-screen bg-black flex items-center justify-center text-white/50">Loading Simulation...</div>;
    }

    if (!currentSimulationId || !simDoc) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-black">
                <div className="text-center">
                    <h2 className="text-2xl font-light text-white mb-4">No Simulation Selected</h2>
                    <Button onClick={() => router.push("/validate")}>Start New Test</Button>
                </div>
            </div>
        );
    }

    const results = simulationResults || [];
    const totalSegments = simDoc.results?.segments?.length || 0;
    const completedCount = results.length;
    const progressPercent = totalSegments > 0 ? Math.round((completedCount / totalSegments) * 100) : 0;

    // Aggregate stats
    const averageResonance = results.length > 0 
        ? Math.round(results.reduce((acc, curr) => acc + (curr.testResult?.resonanceScore || 0), 0) / results.length)
        : 0;
    const skepticPercentage = results.length > 0
        ? Math.round(results.reduce((acc, curr) => acc + (curr.testResult?.resonanceScore < 50 ? 1 : 0), 0) / results.length * 100)
        : 0;
    
    const totalPersonasCount = results.reduce((acc, r) => acc + (r.personas?.length || 0), 0);
    const adoptionCount = results.filter(r => (r.testResult?.resonanceScore || 0) >= 70)
                                 .reduce((acc, r) => acc + (r.personas?.length || 0), 0);
    const rejectedCount = results.filter(r => (r.testResult?.resonanceScore || 0) < 50)
                                 .reduce((acc, r) => acc + (r.personas?.length || 0), 0);
    
    // Survival probability formula: weighted resonance vs resistance
    const survivalProb = Math.min(99, Math.max(5, Math.round((averageResonance * 0.8) + (20 * (adoptionCount / (totalPersonasCount || 1))))));

    const allDrivers = results.flatMap(r => r.testResult?.keyDrivers || []);
    const topReasons = [...new Set(allDrivers)].slice(0, 3);
    
    const allObjections = results.flatMap(r => r.testResult?.frictionPoints || []);
    const topObjections = [...new Set(allObjections)].slice(0, 3);

    return (
        <DashboardLayout rightPanel={<ChatPanel />}>
            <div className="relative min-h-screen text-white selection:bg-blue-500/30 overflow-x-hidden pt-40">
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

                <div className="relative z-10 max-w-5xl mx-auto px-6 pb-48" ref={reportRef}>
                    {/* Header */}
                    <div className="mb-12 flex justify-between items-end">
                        <div>
                            <p className="text-[10px] uppercase tracking-[0.4em] text-blue-400 font-black mb-4">Validation Outcome</p>
                            <h1 className="text-5xl font-light tracking-tighter mb-2">
                                Market <span className="text-gradient-blue italic font-normal">Resonance</span> Echo
                            </h1>
                            <p className="text-white/40 text-sm font-normal">Based on 50 high-resonance personas • {idea?.duration || 12} Week Horizon</p>
                        </div>
                        <div className="flex gap-4 mb-4">
                            <Button 
                                onClick={handleDownloadPDF}
                                variant="secondary"
                                size="sm"
                                className="flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                Download Report
                            </Button>
                            <Button 
                                onClick={() => setIsInterrogationOpen(true)}
                                variant="primary"
                                size="sm"
                                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 shadow-xl shadow-purple-600/20"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                                Interrogation Lab
                            </Button>
                        </div>
                    </div>

                    {/* Summary Card */}
                    <div className="relative z-30 mb-12">
                        <div className="bg-[#0D0D0D]/80 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-10 md:p-12 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)]">
                             <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                 {/* Primary Stats Grid */}
                                 <div className="grid grid-cols-2 gap-x-12 gap-y-10 border-r border-white/5 pr-4">
                                     <div className="space-y-1">
                                         <span className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-bold">Total Sample</span>
                                         <div className="text-4xl font-black italic text-white">{results.length > 0 ? totalPersonasCount : '--'}</div>
                                         <p className="text-[9px] text-white/20 uppercase tracking-widest">Synthetic Humans</p>
                                     </div>
                                     <div className="space-y-1">
                                         <span className="text-[9px] uppercase tracking-[0.2em] text-emerald-500/40 font-bold">Market Adoption</span>
                                         <div className="text-4xl font-black italic text-emerald-400">{results.length > 0 ? adoptionCount : '--'}</div>
                                         <p className="text-[9px] text-emerald-500/20 uppercase tracking-widest">Resonant Personas</p>
                                     </div>
                                     <div className="space-y-1">
                                         <span className="text-[9px] uppercase tracking-[0.2em] text-red-500/40 font-bold">Rejected</span>
                                         <div className="text-4xl font-black italic text-red-500/80">{results.length > 0 ? rejectedCount : '--'}</div>
                                         <p className="text-[9px] text-red-500/20 uppercase tracking-widest">Skeptical Profiles</p>
                                     </div>
                                     <div className="space-y-1">
                                         <span className="text-[9px] uppercase tracking-[0.2em] text-blue-500/40 font-bold">Survival Prob.</span>
                                         <div className="text-4xl font-black italic text-blue-400">{results.length > 0 ? `${survivalProb}%` : '--'}</div>
                                         <p className="text-[9px] text-blue-500/20 uppercase tracking-widest">Predicted Outlook</p>
                                     </div>
                                 </div>

                                 {/* Qualitative Insights */}
                                 <div className="space-y-8">
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                         <div>
                                             <span className="text-[9px] uppercase tracking-widest text-emerald-400/40 font-bold block mb-4">Top Motivators</span>
                                             {topReasons.map((r, i) => (
                                                 <p key={i} className="text-[11px] text-white/70 mb-3 flex items-start gap-3 leading-relaxed">
                                                     <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1 shrink-0" /> {r}
                                                 </p>
                                             ))}
                                             {topReasons.length === 0 && <p className="text-[11px] text-white/20 italic">Synthesizing drivers...</p>}
                                         </div>
                                         <div>
                                             <span className="text-[9px] uppercase tracking-widest text-red-400/40 font-bold block mb-4">Core Objections</span>
                                             {topObjections.map((o, i) => (
                                                 <p key={i} className="text-[11px] text-white/70 mb-3 flex items-start gap-3 leading-relaxed">
                                                     <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1 shrink-0" /> {o}
                                                 </p>
                                             ))}
                                             {topObjections.length === 0 && <p className="text-[11px] text-white/20 italic">Extracting friction...</p>}
                                         </div>
                                     </div>
                                 </div>
                             </div>
                        </div>
                    </div>

                    {/* Simulation Status Overlay */}
                    {simDoc.status === "in progress" && completedCount < totalSegments && (
                        <div className="mb-12 flex items-center gap-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl p-6 border-dashed animate-in fade-in duration-500">
                            <div className="w-10 h-10 rounded-full border-2 border-t-blue-500/80 border-white/5 animate-spin" />
                            <div>
                                <h3 className="text-sm font-bold text-white/80">Neural Crowd Processing...</h3>
                                <p className="text-[11px] text-white/40 font-normal">Synthesizing cluster resonance. {completedCount} of {totalSegments} clusters identified.</p>
                            </div>
                        </div>
                    )}

                    {/* Result Cards */}
                    <div className="space-y-8">
                        {results.map((res, i) => (
                            <PersonaResultCard key={res.segment_id} result={res} index={i} />
                        ))}

                        {/* Skeleton Loaders */}
                        {simDoc.status === "in progress" && Array.from({ length: totalSegments - completedCount }).map((_, i) => (
                            <div key={`skeleton-${i}`} className="h-48 rounded-[2.5rem] bg-white/[0.03] border border-white/5 animate-pulse flex items-center justify-center">
                                <span className="text-[9px] uppercase tracking-[0.4em] text-white/10 font-black">Synthesizing Feedback Cluster...</span>
                            </div>
                        ))}
                    </div>
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

    return (
        <div className="group bg-[#0D0D0D]/60 backdrop-blur-xl border border-white/10 rounded-[2.5rem] overflow-hidden hover:border-blue-500/40 transition-all duration-500">
            <div className="p-8 md:p-10">
                <div className="flex flex-col md:flex-row gap-8">
                    {/* Score Circle */}
                    <div className="shrink-0">
                        <div className="relative w-24 h-24 flex items-center justify-center">
                            <svg className="w-full h-full -rotate-90">
                                <circle cx="48" cy="48" r="44" className="stroke-white/5 fill-none" strokeWidth="8" />
                                <circle cx="48" cy="48" r="44" className="stroke-blue-500 fill-none transition-all duration-1000" strokeWidth="8" strokeDasharray={276} strokeDashoffset={276 - (276 * (tr.resonanceScore || 0) / 100)} strokeLinecap="round" />
                            </svg>
                            <span className="absolute text-2xl font-black italic">{tr.resonanceScore || 0}%</span>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1">
                        <div className="flex justify-between items-start mb-4">
                             <div>
                                 <p className="text-sm font-medium text-white">Cluster {index + 1} Reaction</p>
                                 <h3 className="text-2xl font-normal text-white">{result.segment_name}</h3>
                                 <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1">Status: <span className="text-white/60 font-bold">{tr.verdict}</span></p>
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
                        
                        <p className="text-lg font-light text-white/80 leading-relaxed italic mb-6">
                            "{tr.verbatimQuote}"
                        </p>

                        <div className="flex flex-wrap gap-2">
                            {tr.keyDrivers?.slice(0, 3).map((d, idx) => (
                                <span key={idx} className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400/80 font-medium">✦ {d}</span>
                            ))}
                            {tr.frictionPoints?.slice(0, 3).map((f, idx) => (
                                <span key={idx} className="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] text-red-400/80 font-medium">! {f}</span>
                            ))}
                        </div>
                    </div>
                </div>

                {isExpanded && (
                    <div className="mt-10 pt-10 border-t border-white/5 animate-in slide-in-from-top-4 fade-in duration-500">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                             <div>
                                <h4 className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-bold mb-6">Psychological Profile Reaction</h4>
                                <p className="text-sm text-white/60 leading-relaxed font-normal">
                                    {tr.summary}
                                </p>
                             </div>
                             <div>
                                <h4 className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-bold mb-6">Audience Markers</h4>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center py-2 border-b border-white/[0.03]">
                                        <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Willingness to Pay</span>
                                        <span className={`text-[11px] font-bold ${tr.willingnessToPay === 'High' ? 'text-emerald-400' : 'text-amber-400'}`}>{tr.willingnessToPay}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-white/[0.03]">
                                        <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Dominant Occupation</span>
                                        <span className="text-[11px] text-white/70 font-normal">{result.profile?.dominant_occupation}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-white/[0.03]">
                                        <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Region</span>
                                        <span className="text-[11px] text-white/70 font-normal">{result.profile?.dominant_state}</span>
                                    </div>
                                </div>
                             </div>
                        </div>
                        {/* Individual Persona Voices */}
                        <div className="mt-10 pt-8 border-t border-white/5">
                            <h4 className="text-[11px] uppercase tracking-[0.2em] text-white/40 font-bold mb-6">Individual Persona Voices</h4>
                            <div className="space-y-2">
                                {(result.personas || []).map((p, pIdx) => {
                                    const individualFeedback = result.testResult?.personaFeedbacks?.[pIdx];
                                    const m = p.metadata || {};
                                    return (
                                     <div key={pIdx} className="group bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.05] rounded-xl p-3 transition-all flex items-center gap-4">
                                         <div className="flex-shrink-0 flex items-center gap-3 w-40">
                                             <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[9px] font-bold text-white/20">
                                                 {pIdx + 1}
                                             </div>
                                             <div className="truncate">
                                                 <div className="text-[10px] font-bold text-white/80 truncate">
                                                     {(() => {
                                                         const rawName = m.name || (m.occupation ? `Persona of ${m.occupation}` : `Persona ${p.persona_id || p.id}`);
                                                         if (rawName.includes("Persona")) {
                                                             const seed = parseInt((p.persona_id || p.id).toString().replace(/\D/g, '')) || 0;
                                                             const names = ["Aarav", "Arjun", "Aditya", "Amit", "Alok", "Ananya", "Aavya", "Bhavna", "Ishani", "Jiya"];
                                                             const surnames = ["Sharma", "Verma", "Gupta", "Malhotra", "Kapoor", "Patel", "Shah", "Kumar", "Singh", "Yadav"];
                                                             const firstName = names[seed % names.length];
                                                             const lastName = surnames[(seed * 7) % surnames.length];
                                                             return `${firstName} ${lastName} (${m.age || '??'})`;
                                                         }
                                                         return `${rawName} (${m.age || '??'})`;
                                                     })()}
                                                 </div>
                                                 <div className="text-[8px] text-white/30 uppercase tracking-tighter truncate">{m.occupation || "Market"} &middot; {m.state || "India"}</div>
                                             </div>
                                         </div>
                                         <div className="flex-grow border-l border-white/5 pl-4 overflow-hidden">
                                             <p className="text-[10px] italic text-white/50 group-hover:text-white/70 transition-colors leading-relaxed">
                                                 "{individualFeedback?.feedback || "Synthesizing individual reaction..."}"
                                             </p>
                                         </div>
                                         <div className="flex-shrink-0 text-right w-12">
                                             <div className={`text-[10px] font-black italic ${ (individualFeedback?.resonanceScore || result.testResult?.resonanceScore) >= 70 ? "text-emerald-400" : (individualFeedback?.resonanceScore || result.testResult?.resonanceScore) < 50 ? "text-red-400" : "text-white/40"}`}>
                                                 {individualFeedback?.resonanceScore || result.testResult?.resonanceScore || 0}%
                                             </div>
                                         </div>
                                     </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
