"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useIdea } from "../../context/IdeaContext";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import Button from "../../components/ui/Button";
import LoadingScreen from "../../components/ui/LoadingScreen";
import API_BASE_URL from "../../lib/apiConfig";

import DashboardLayout from "../../components/DashboardLayout";


// Removed PremiumSelect dropdown entirely.

export default function ValidatePage() {
    const router = useRouter();
    const { idea, setIdea, setValidation, setPersonas, reset, setCurrentSimulationId, setMarketContext } = useIdea();
    const { user, signInWithGoogle } = useAuth();

    const [form, setForm] = useState({
        idea: idea?.idea || "",
        industry: idea?.industry || "",
        businessModel: idea?.businessModel || "",
        targetAudience: idea?.targetAudience || "",
        testType: idea?.testType || "Idea Validation",
        duration: idea?.duration || 12,
    });
    const [loading, setLoading] = useState(false);
    const [backendStatus, setBackendStatus] = useState("checking");
    const [step, setStep] = useState(1);
    const [localMarketContext, setLocalMarketContext] = useState(null);
    const [loadingMessage, setLoadingMessage] = useState("Finding matching personas...");

    const [isQueued, setIsQueued] = useState(false);
    
    // We no longer reset global state automatically on mount 
    // to allow 'Modify Idea' functionality to work.
    useEffect(() => {
        // Only reset if specifically requested or on final completion if needed
    }, []);

    useEffect(() => {
        let isMounted = true;
        const checkHealth = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/health`);
                const data = await res.json();
                if (isMounted) {
                    setBackendStatus(data.rag || "unknown");
                    // Continue polling if not ready
                    if (data.rag !== "ready") {
                        setTimeout(checkHealth, 3000);
                    }
                }
            } catch (err) {
                if (isMounted) {
                    setBackendStatus("warming_up");
                    setTimeout(checkHealth, 3000);
                }
            }
        };
        checkHealth();
        return () => { isMounted = false; };
    }, []);

    // Queue processor
    useEffect(() => {
        if (isQueued && backendStatus === "ready") {
            setIsQueued(false);
            proceedToContext();
        }
    }, [isQueued, backendStatus]);

    const isFormValid = 
        form.idea.trim().length >= 20 && 
        form.industry.trim().length > 0 && 
        form.businessModel.trim().length > 0 && 
        form.targetAudience.trim().length > 0 && 
        form.testType.trim().length > 0;

    const handleBuildGraph = async () => {
        if (!isFormValid) return;

        if (backendStatus !== "ready") {
            setIsQueued(true);
            return;
        }

        proceedToContext();
    };

    const proceedToContext = () => {
        // Keep loading UI visible just during the transition
        setLoadingMessage("Initializing Market Context Engine...");
        setLoading(true);

        // Clear previous simulation states but keep the new form
        setMarketContext(null);
        setValidation(null);
        setPersonas(null);
        setCurrentSimulationId(null);

        // Save form to global context
        setIdea(form);
        
        // Let the new /context page handle the actual graph building
        router.push("/context");
    };

    const handleMatchPersonas = async (fallbackContext) => {
        const ctxToUse = fallbackContext !== undefined ? fallbackContext : localMarketContext;
        setLoadingMessage("Scanning 1M+ Personas for Top Matches...");
        setLoading(true);

        try {
            // Call persona retrieval endpoint (no changes needed here as it's for retrieval)
            const response = await fetch(`${API_BASE_URL}/api/retrieve-personas`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    idea: form.idea.trim(),
                    targetAudience: form.targetAudience.trim() || null,
                    industry: form.industry.trim() || null,
                    businessModel: form.businessModel.trim() || null,
                    segmentCount: 5,
                    marketContext: ctxToUse
                }),
            });

            if (!response.ok) {
                throw new Error("Persona retrieval engine unavailable");
            }

            const data = await response.json();

            // Store in Firebase immediately for history persistence
            // Strip persona arrays before saving to Firestore (1MB limit)
            // Full personas stay in React state (memory) only
            const segmentsForFirestore = (data.segments || []).map(seg => {
                const { personas, ...segWithoutPersonas } = seg;
                return {
                    ...segWithoutPersonas,
                    personaCount: personas?.length || 0, // keep count only
                };
            });

            const docRef = await addDoc(collection(db, "simulations"), {
                userId: user.uid,
                ideaData: form,
                status: "ready",
                timestamp: serverTimestamp(),
                results: {
                    segments: segmentsForFirestore,
                    totalMatched: data.totalMatched || 0,
                    testType: form.testType,
                    marketContext: data.marketContext || null,
                    // personas NOT saved to Firestore — kept in React state only
                }
            });

            // Sync with global state
            setCurrentSimulationId(docRef.id);
            setIdea(form);
            setValidation({
                segments: data.segments || [],
                personas: data.personas || [],
                totalMatched: data.totalMatched || 0,
                filtersApplied: data.filtersApplied || {},
                testType: form.testType,
                marketContext: data.marketContext || null,  // pass through to segment page
            });
            setPersonas(data.personas || []);

            router.push("/segment");
        } catch (error) {
            console.error("Persona retrieval failed:", error);
            setIdea(form);
            setValidation({
                segments: [],
                personas: [],
                totalMatched: 0,
                testType: form.testType,
                error: error.message,
            });
            router.push("/segment");
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <LoadingScreen message={loadingMessage} />;
    }

    return (
        <DashboardLayout currentStep={1}>
            <div className="relative min-h-screen flex flex-col items-center justify-start bg-white overflow-x-hidden selection:bg-[#E85D3A]/15">
                {/* Subtle background */}
                <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none" />
                <div className="absolute top-0 right-0 w-1/2 h-96 bg-gradient-to-bl from-orange-50/40 to-transparent pointer-events-none" />

                <div className="relative z-10 w-full max-w-5xl mx-auto px-6 lg:px-12 pt-6 pb-24">
                    {/* Header */}
                    <div className="text-center mb-12 fade-in-blur">
                        <div className="flex justify-center mb-6">
                            <span className="badge-accent">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#E85D3A]" />
                                Phase 01 · Idea Definition
                            </span>
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl tracking-tight mb-6 text-[#1a1a1a]" style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}>
                            Validate Your <em style={{ fontStyle: "italic" }}>Startup Idea</em>
                        </h1>
                        <p className="text-black/50 font-normal text-base max-w-xl mx-auto leading-relaxed">
                            Input your vision. Our engine will synthesize the <span className="text-[#1a1a1a] font-semibold">50 best-fit personas</span> from 1M+ Indian profiles for testing.
                        </p>
                    </div>

                    {/* Form Card (Step 1) */}
                    {step === 1 && (
                    <div className="bg-white border border-black/[0.08] rounded-3xl p-8 md:p-12 fade-in-up shadow-lg shadow-black/[0.04] overflow-hidden relative group">
                        {/* Subtle corner decoration */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-grid opacity-20 pointer-events-none" />

                        <h2 className="text-xs uppercase tracking-[0.3em] text-black/40 mb-10 font-semibold text-center">Idea Definition Form</h2>

                        {/* Main idea textarea */}
                        <div className="mb-10">
                            <label className="block text-[11px] text-black/60 mb-3 uppercase tracking-[0.15em] font-semibold ml-1">
                                Idea Definition <span className="text-[#E85D3A]">*</span>
                            </label>
                            <textarea
                                value={form.idea}
                                onChange={(e) => setForm({ ...form, idea: e.target.value })}
                                placeholder="e.g. A hyperlocal delivery platform for fresh farm produce connecting rural farmers directly with urban households..."
                                rows={5}
                                className="w-full bg-[#FAFAFA] border border-black/[0.08] rounded-2xl px-6 py-5 text-[#1a1a1a] placeholder:text-black/30 focus:outline-none focus:border-[#E85D3A]/30 focus:ring-1 focus:ring-[#E85D3A]/10 resize-none transition-all duration-300 text-base leading-relaxed font-normal"
                            />
                            <div className="flex justify-between items-center mt-3 px-1">
                                <p className="text-[11px] font-normal">
                                    {form.idea.length === 0 ? (
                                        <span className="text-black/30">Describe your idea and its core value proposition</span>
                                    ) : form.idea.length < 20 ? (
                                        <span className="text-[#E85D3A]">Minimum 20 characters required</span>
                                    ) : (
                                        <span className="text-emerald-500 flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Ready for persona matching
                                        </span>
                                    )}
                                </p>
                                <p className="text-[11px] text-black/30 tabular-nums font-normal">{form.idea.length} characters</p>
                            </div>
                        </div>

                        {/* Secondary fields grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8 mb-12">
                            <div>
                                <label className="block text-[11px] text-black/60 mb-2 uppercase tracking-[0.15em] font-semibold ml-1">
                                    Industry <span className="text-[#E85D3A]">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.industry}
                                    onChange={(e) => setForm({ ...form, industry: e.target.value })}
                                    placeholder="e.g. AgriTech, EdTech, FinTech"
                                    className="w-full bg-[#FAFAFA] border border-black/[0.08] rounded-xl px-4 py-3.5 text-[#1a1a1a] text-sm placeholder:text-black/30 focus:outline-none focus:border-[#E85D3A]/30 focus:ring-1 focus:ring-[#E85D3A]/10 transition-all duration-300 font-normal"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] text-black/60 mb-2 uppercase tracking-[0.15em] font-semibold ml-1">
                                    Business Model <span className="text-[#E85D3A]">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.businessModel}
                                    onChange={(e) => setForm({ ...form, businessModel: e.target.value })}
                                    placeholder="e.g. Marketplace, SaaS, D2C"
                                    className="w-full bg-[#FAFAFA] border border-black/[0.08] rounded-xl px-4 py-3.5 text-[#1a1a1a] text-sm placeholder:text-black/30 focus:outline-none focus:border-[#E85D3A]/30 focus:ring-1 focus:ring-[#E85D3A]/10 transition-all duration-300 font-normal"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[11px] text-black/60 mb-2 uppercase tracking-[0.15em] font-semibold ml-1">
                                    Target Audience (Detailed) <span className="text-[#E85D3A]">*</span>
                                </label>
                                <textarea
                                    value={form.targetAudience}
                                    onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                                    placeholder="e.g. Urban middle-class working women aged 25-45 who want fresh organic produce delivered at home but can't visit mandis..."
                                    rows={3}
                                    className="w-full bg-[#FAFAFA] border border-black/[0.08] rounded-xl px-4 py-3.5 text-[#1a1a1a] text-sm placeholder:text-black/30 focus:outline-none focus:border-[#E85D3A]/30 focus:ring-1 focus:ring-[#E85D3A]/10 resize-none transition-all duration-300 font-normal"
                                />
                                {typeof window !== "undefined" && !sessionStorage.getItem("hideIndiaWarning") && (
                                    <div className="mt-3 flex items-start gap-2 text-amber-800 bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 rounded-lg text-xs leading-relaxed">
                                        <span className="shrink-0 mt-0.5">⚠️</span>
                                        <div className="flex-1">
                                            <span className="font-semibold">Percura's persona database covers Indian demographics (1M+ profiles).</span> Results are most accurate for India-focused markets.
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.currentTarget.parentElement.style.display = 'none';
                                                sessionStorage.setItem("hideIndiaWarning", "true");
                                            }}
                                            className="text-amber-800/50 hover:text-amber-800"
                                        >✕</button>
                                    </div>
                                )}
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[11px] text-black/60 mb-3 uppercase tracking-[0.15em] font-semibold ml-1">
                                    What to Test
                                </label>
                                <div className="w-full bg-[#FAFAFA] border border-black/[0.08] rounded-xl px-6 py-4 flex flex-col gap-1 cursor-not-allowed">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-[#E85D3A]" />
                                        <span className="text-[#1a1a1a] text-sm font-medium">Idea Validation</span>
                                    </div>
                                    <span className="text-[11px] text-black/40 pl-5">More coming soon</span>
                                </div>
                            </div>

                            {/* Simulation Duration Slider */}
                            <div className="md:col-span-2 mt-4">
                                <label className="block text-[11px] text-black/60 mb-6 uppercase tracking-[0.15em] font-semibold ml-1">
                                    Simulation Horizon (Weeks)
                                </label>
                                <div className="flex items-center gap-6 px-2">
                                    <div className="relative flex-1 h-1.5 bg-black/[0.06] rounded-full">
                                        <div 
                                            className="absolute h-full bg-gradient-to-r from-[#E85D3A] to-[#D14E2E] rounded-full transition-all"
                                            style={{ width: `${(form.duration / 52) * 100}%` }}
                                        />
                                        <input 
                                            type="range" 
                                            min="1" 
                                            max="52" 
                                            value={form.duration}
                                            onChange={(e) => setForm({...form, duration: parseInt(e.target.value)})}
                                            className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                                        />
                                        <div 
                                            className="absolute w-4 h-4 bg-white rounded-full border-2 border-[#E85D3A] shadow-sm top-1/2 -translate-y-1/2 -ml-2 pointer-events-none transition-transform"
                                            style={{ left: `${(form.duration / 52) * 100}%` }}
                                        />
                                    </div>
                                    <div className="shrink-0 min-w-[48px] text-right">
                                        <span className="text-xl font-bold text-[#E85D3A] tabular-nums">
                                            {form.duration}
                                        </span>
                                        <span className="text-[11px] uppercase tracking-widest text-black/30 ml-1 font-semibold">W</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="relative w-full">
                            <Button
                                size="xl"
                                onClick={handleBuildGraph}
                                disabled={!isFormValid || isQueued}
                                showArrow={!isQueued}
                                className={`w-full relative group shadow-sm uppercase tracking-widest transition-all duration-300 ${!isFormValid ? "opacity-50 cursor-not-allowed" : "hover:shadow-md"}`}
                            >
                                {isQueued ? "Queued... Waiting for Engine" : "Build Knowledge Graph"}
                            </Button>
                            
                            {/* Backend Warmup Inline Message */}
                            {backendStatus !== "ready" && (
                                <div className="absolute top-full mt-3 w-full text-center fade-in">
                                    <p className="text-[11px] font-semibold text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5 border border-amber-200 inline-flex items-center gap-2">
                                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Engine warming up — your request will run as soon as it's ready (~15s)
                                    </p>
                                </div>
                            )}
                        </div>

                        <p className="text-center text-[12px] text-black/30 mt-6 font-normal">
                            Deep extraction of Indian market ontology before querying 1M+ personas.
                        </p>
                    </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
