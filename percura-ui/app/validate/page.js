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
import FlowDescriptionStrip from "../../components/FlowDescriptionStrip";

const ShaderPageBackground = dynamic(
    () => import("../../components/ui/shader-background"),
    { ssr: false }
);

const TEST_TYPES = ["Idea Validation"];

// Premium Custom Dropdown Component
function PremiumSelect({ label, value, options, onChange, placeholder = "Select option" }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <label className="block text-[11px] text-white/70 mb-2 uppercase tracking-[0.15em] font-bold ml-1">
                {label} <span className="text-purple-500/80">*</span>
            </label>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    group w-full bg-white/[0.07] border border-white/20 rounded-xl px-4 py-3.5 
                    text-sm transition-all duration-300 ease-out cursor-pointer flex justify-between items-center
                    hover:bg-white/[0.10] hover:border-white/30
                    ${isOpen ? "border-purple-500/40 bg-white/[0.12] ring-1 ring-purple-500/10" : ""}
                `}
            >
                <span className={value ? "text-white/90" : "text-white/35"}>
                    {value || placeholder}
                </span>
                <svg
                    className={`w-4 h-4 text-white/60 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                </svg>
            </div>

            {isOpen && (
                <div className="absolute z-[100] w-full mt-2 py-2 bg-[#0A0A0A] border border-white/25 rounded-xl shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in duration-200 origin-top max-h-60 overflow-y-auto">
                    {options.map((opt) => (
                        <div
                            key={opt}
                            onClick={() => {
                                onChange(opt);
                                setIsOpen(false);
                            }}
                            className={`
                                px-4 py-2.5 text-sm cursor-pointer transition-colors
                                ${value === opt ? "text-purple-400 bg-white/[0.08]" : "text-white/70 hover:text-white hover:bg-white/[0.05]"}
                            `}
                        >
                            {opt}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

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

    const canSubmit = 
        backendStatus === "ready" &&
        form.idea.trim().length >= 20 && 
        form.industry.trim().length > 0 && 
        form.businessModel.trim().length > 0 && 
        form.targetAudience.trim().length > 0 && 
        form.testType.trim().length > 0;

    const handleBuildGraph = async () => {
        if (!canSubmit) return;

        let currentUser = user;
        if (!currentUser) {
            try {
                currentUser = await signInWithGoogle();
            } catch (error) {
                console.error("Authentication cancelled or failed");
                return;
            }
        }

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
            <div className="relative min-h-screen flex flex-col items-center justify-start bg-black overflow-x-hidden selection:bg-white/20">
                {/* Neural shader background */}
                <ShaderPageBackground overlayOpacity={0.75} blur={true} />

                <div className="relative z-10 w-full max-w-5xl mx-auto px-6 lg:px-12 pt-6 pb-24">
                    {/* Header */}
                    <div className="text-center mb-12 fade-in-blur">
                        <h1 className="text-4xl md:text-5xl lg:text-7xl font-light tracking-tight mb-6 text-white">
                            Validate Your <span className="text-gradient font-normal">Startup Idea</span>
                        </h1>
                        <p className="text-white/60 font-normal text-base max-w-xl mx-auto leading-relaxed">
                            Input your vision. Our engine will synthesize the <span className="text-white/90 font-bold">50 best-fit personas</span> from 1M+ Indian profiles for testing.
                        </p>
                    </div>

                    {/* Form Card (Step 1) */}
                    {step === 1 && (
                    <div className="bg-white/[0.06] border border-white/18 rounded-[2.5rem] p-8 md:p-12 backdrop-blur-md fade-in-up shadow-2xl overflow-hidden relative group">
                        {/* Subtle inner glow */}
                        <div className="absolute -top-24 -right-24 w-48 h-48 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none group-hover:bg-purple-500/20 transition-all duration-700" />
                        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 blur-[80px] rounded-full pointer-events-none group-hover:bg-blue-500/20 transition-all duration-700" />

                        <h2 className="text-xs uppercase tracking-[0.3em] text-white/55 mb-10 font-bold text-center">Idea Definition Form</h2>

                        {/* Main idea textarea */}
                        <div className="mb-10">
                            <label className="block text-[11px] text-white/65 mb-3 uppercase tracking-[0.15em] font-bold ml-1">
                                Idea Definition <span className="text-purple-500/80">*</span>
                            </label>
                            <textarea
                                value={form.idea}
                                onChange={(e) => setForm({ ...form, idea: e.target.value })}
                                placeholder="e.g. A hyperlocal delivery platform for fresh farm produce connecting rural farmers directly with urban households..."
                                rows={5}
                                className="w-full bg-white/[0.07] border border-white/20 rounded-2xl px-6 py-5 text-white/95 placeholder:text-white/35 focus:outline-none focus:border-purple-500/30 focus:bg-white/[0.10] resize-none transition-all duration-500 ease-out text-base leading-relaxed font-normal shadow-inner"
                            />
                            <div className="flex justify-between items-center mt-3 px-1">
                                <p className="text-[11px] font-normal">
                                    {form.idea.length === 0 ? (
                                        <span className="text-white/30">Describe your idea and its core value proposition</span>
                                    ) : form.idea.length < 20 ? (
                                        <span className="text-amber-400/80">Minimum 20 characters required</span>
                                    ) : (
                                        <span className="text-emerald-400/50 flex items-center gap-1.5">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Ready for persona matching
                                        </span>
                                    )}
                                </p>
                                <p className="text-[11px] text-white/35 tabular-nums font-normal">{form.idea.length} characters</p>
                            </div>
                        </div>

                        {/* Secondary fields grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8 mb-12">
                            <div>
                                <label className="block text-[11px] text-white/70 mb-2 uppercase tracking-[0.15em] font-bold ml-1">
                                    Industry <span className="text-purple-500/80">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.industry}
                                    onChange={(e) => setForm({ ...form, industry: e.target.value })}
                                    placeholder="e.g. AgriTech, EdTech, FinTech"
                                    className="w-full bg-white/[0.07] border border-white/20 rounded-xl px-4 py-3.5 text-white/95 text-sm placeholder:text-white/35 focus:outline-none focus:border-purple-500/30 transition-all duration-300 font-normal"
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] text-white/70 mb-2 uppercase tracking-[0.15em] font-bold ml-1">
                                    Business Model <span className="text-purple-500/80">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.businessModel}
                                    onChange={(e) => setForm({ ...form, businessModel: e.target.value })}
                                    placeholder="e.g. Marketplace, SaaS, D2C"
                                    className="w-full bg-white/[0.07] border border-white/20 rounded-xl px-4 py-3.5 text-white/95 text-sm placeholder:text-white/35 focus:outline-none focus:border-purple-500/30 transition-all duration-300 font-normal"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[11px] text-white/70 mb-2 uppercase tracking-[0.15em] font-bold ml-1">
                                    Target Audience (Detailed) <span className="text-purple-500/80">*</span>
                                </label>
                                <textarea
                                    value={form.targetAudience}
                                    onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
                                    placeholder="e.g. Urban middle-class working women aged 25-45 who want fresh organic produce delivered at home but can't visit mandis..."
                                    rows={3}
                                    className="w-full bg-white/[0.07] border border-white/20 rounded-xl px-4 py-3.5 text-white/95 text-sm placeholder:text-white/35 focus:outline-none focus:border-purple-500/30 resize-none transition-all duration-300 font-normal"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-[11px] text-white/70 mb-3 uppercase tracking-[0.15em] font-bold ml-1">
                                    What to Test
                                </label>
                                <div className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-6 py-4 flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                                    <span className="text-white/90 text-sm font-medium tracking-wide">Idea Validation</span>
                                </div>
                            </div>

                            {/* Simulation Duration Slider */}
                            <div className="md:col-span-2 mt-4">
                                <label className="block text-[11px] text-white/70 mb-6 uppercase tracking-[0.15em] font-bold ml-1">
                                    Simulation Horizon (Weeks)
                                </label>
                                <div className="flex items-center gap-6 px-2">
                                    <div className="relative flex-1 h-1.5 bg-white/10 rounded-full">
                                        <div 
                                            className="absolute h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.4)]"
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
                                            className="absolute w-4 h-4 bg-white rounded-full border-2 border-purple-500 shadow-[0_0_8px_white] top-1/2 -translate-y-1/2 -ml-2 pointer-events-none transition-transform active:scale-125"
                                            style={{ left: `${(form.duration / 52) * 100}%` }}
                                        />
                                    </div>
                                    <div className="shrink-0 min-w-[48px] text-right">
                                        <span className="text-xl font-black italic text-purple-400 tabular-nums">
                                            {form.duration}
                                        </span>
                                        <span className="text-[11px] uppercase tracking-widest text-white/40 ml-1 font-bold">W</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Submit */}
                        <Button
                            size="xl"
                            onClick={handleBuildGraph}
                            disabled={!canSubmit}
                            showArrow={canSubmit}
                            className="w-full relative group shadow-xl hover:shadow-purple-500/10 uppercase tracking-widest"
                        >
                            {backendStatus === "ready" ? "Build Knowledge Graph" : "Waiting for Engine..."}
                        </Button>

                        <p className="text-center text-[12px] text-white/40 mt-6 font-normal tracking-wide">
                            Deep extraction of Indian market ontology before querying 1M+ personas.
                        </p>
                    </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}