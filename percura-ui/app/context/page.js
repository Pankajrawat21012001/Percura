"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useIdea } from "../../context/IdeaContext";
import Button from "../../components/ui/Button";
import DashboardLayout from "../../components/DashboardLayout";
import API_BASE_URL from "../../lib/apiConfig";

import GraphExplorer from "../../components/GraphExplorer";
import FlowDescriptionStrip from "../../components/FlowDescriptionStrip";

const ShaderPageBackground = dynamic(
    () => import("../../components/ui/shader-background"),
    { ssr: false }
);

function LoadingState() {
    const [step, setStep] = useState(0);
    const steps = [
        "Analyzing core value proposition...",
        "Identifying direct & indirect competitors in India...",
        "Evaluating regulatory and operational risks...",
        "Synthesizing macro consumer trends...",
        "Structuring Market Ontology..."
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setStep(s => Math.min(s + 1, steps.length - 1));
        }, 1800);
        return () => clearInterval(interval);
    }, [steps.length]);

    return (
        <div className="flex flex-col items-center">
            <div className="flex flex-col items-center justify-center py-10">
                <div className="w-16 h-16 rounded-full border-4 border-t-blue-500 border-r-purple-500 border-white/10 animate-spin mb-8" />
                <h3 className="text-xl font-medium text-white/80 tracking-tight animate-pulse">{steps[step]}</h3>
                <p className="text-sm text-white/40 mt-4 uppercase tracking-[0.2em]">Neural Extraction Engine</p>
            </div>

            {/* Skeleton Preview */}
            <div className="w-full max-w-6xl mt-16 space-y-16 opacity-20 pointer-events-none">
                {[1, 2, 3].map((s) => (
                    <div key={s} className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-8 bg-white/10 rounded-lg animate-pulse" />
                            <div className="w-48 h-6 bg-white/10 rounded-md animate-pulse" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-40 bg-white/5 border border-white/10 rounded-2xl animate-pulse shimmer" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SectionBadge({ number }) {
    return (
        <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/10 flex items-center justify-center text-[11px] font-mono text-white/50 shrink-0">
            {number}
        </div>
    );
}

export default function OntologyContextPage() {
    const router = useRouter();
    const { idea, setIdea, marketContext, setMarketContext, setValidation, setPersonas, setCurrentSimulationId } = useIdea();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [isGraphVisible, setIsGraphVisible] = useState(true);

    useEffect(() => {
        if (!idea) {
            router.push('/validate');
            return;
        }

        // 1. If we already have the marketContext, skip fetching
        if (marketContext) {
            setLoading(false);
            return;
        }

        const buildGraph = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/api/graph/build`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(idea)
                });
                const data = await res.json();
                
                if (!data.success) throw new Error(data.error || "Extraction failed");
                
                // 2. Save EVERYTHING from the context object (including flat arrays for the backend)
                setMarketContext(data.context);

                // Update idea only if needed for context injection downstream
                if (data.context.groqContext !== idea.zepContext) {
                    setIdea(prev => ({ ...prev, zepContext: data.context.groqContext }));
                }
                
                setTimeout(() => setLoading(false), 800);
            } catch (err) {
                console.error("Graph build failed", err);
                setError(err.message);
                setLoading(false);
            }
        };

        buildGraph();
    }, [idea, router, setIdea, marketContext, setMarketContext]);

    const handlePersonaScan = async () => {
        setScanning(true);
        try {
            const response = await fetch(`${API_BASE_URL}/api/retrieve-personas`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    idea: idea.idea,
                    targetAudience: idea.targetAudience,
                    industry: idea.industry,
                    businessModel: idea.businessModel,
                    segmentCount: 5,
                    marketContext: marketContext
                }),
            });

            if (!response.ok) throw new Error("Persona retrieval engine unavailable");

            const data = await response.json();
            
            // Sync with global state
            setValidation({
                segments: data.segments || [],
                personas: data.personas || [],
                totalMatched: data.totalMatched || 0,
                filtersApplied: data.filtersApplied || {},
                testType: idea.testType,
                marketContext: marketContext,  
            });
            setPersonas(data.personas || []);

            router.push("/segment");
        } catch (err) {
            console.error("Persona scan failed:", err);
            setError("Failed to scan personas: " + err.message);
            setScanning(false);
        }
    };

    if (!idea) return null;

    const ontology = marketContext?.ontology;

    return (
        <DashboardLayout currentStep={2}>
            <div className="relative min-h-screen text-white selection:bg-blue-500/30 overflow-x-hidden pt-6 pb-48">
                <ShaderPageBackground overlayOpacity={0.9} blur={true} />
                
                <div className="relative z-10 max-w-6xl mx-auto px-6">
                    {/* Header */}
                    <div className="mb-12">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="text-[10px] text-blue-400 font-mono tracking-[0.2em] font-black uppercase">Phase 02</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500/40" />
                            <span className="text-[10px] text-white/40 font-mono tracking-widest uppercase">Market Ontology Extraction</span>
                        </div>
                        <h1 className="text-4xl font-light tracking-tight mb-4">
                            Market Context Established
                        </h1>
                        <p className="text-white/40 max-w-2xl text-lg leading-relaxed">
                            Before scanning our neural network for your target personas, we have extracted the foundational market constraints, competitors, and macro trends your startup will face in India.
                        </p>
                    </div>

                    {error ? (
                        <div className="p-8 border border-red-500/30 bg-red-500/10 rounded-2xl">
                            <h3 className="text-red-400 font-medium mb-2">Extraction Error</h3>
                            <p className="text-white/60 text-sm mb-4">{error}</p>
                            <Button onClick={handlePersonaScan} disabled={scanning}>
                                {scanning ? "Scanning..." : "Proceed to Persona Search"}
                            </Button>
                        </div>
                    ) : loading || !ontology ? (
                        <LoadingState />
                    ) : (
                        <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                            
                             {/* Competitors Grid */}
                            <section>
                                <div className="flex items-center gap-4 mb-8">
                                    <SectionBadge number="01" />
                                    <h2 className="text-2xl font-normal text-white/90 tracking-tight">Identified Competitors</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {(ontology.competitors || []).map((comp, i) => (
                                        <div key={i} className="p-5 bg-white/[0.02] border border-white/[0.05] rounded-xl hover:bg-white/[0.04] transition-colors relative overflow-hidden group">
                                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                                            </div>
                                            <div className="flex justify-between items-start mb-3">
                                                <h3 className="font-bold text-lg text-white/90">{comp.name}</h3>
                                                <span className={`text-[11px] px-2 py-1 rounded font-bold tracking-widest uppercase ${
                                                    comp.threatLevel?.toLowerCase() === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white/50'
                                                }`}>
                                                    {comp.type} • {comp.threatLevel}
                                                </span>
                                            </div>
                                            <p className="text-sm text-white/50 leading-relaxed font-light">{comp.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>

                             {/* Risks Grid */}
                            <section>
                                <div className="flex items-center gap-4 mb-8">
                                    <SectionBadge number="02" />
                                    <h2 className="text-2xl font-normal text-white/90 tracking-tight">Market Risks & Regulations</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(ontology.risks || []).map((risk, i) => (
                                        <div key={i} className="flex gap-4 p-5 bg-white/[0.02] border border-red-500/10 rounded-xl relative overflow-hidden">
                                            <div className="w-1 bg-red-500/50 absolute left-0 top-0 bottom-0" />
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <h3 className="font-medium text-white/90">{risk.name}</h3>
                                                    <span className="text-[11px] px-2 py-0.5 border border-white/10 rounded text-white/40 uppercase tracking-wider">{risk.category}</span>
                                                </div>
                                                <p className="text-sm text-white/50 leading-relaxed font-light">{risk.description}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                             {/* Macro Trends */}
                            <section>
                                <div className="flex items-center gap-4 mb-8">
                                    <SectionBadge number="03" />
                                    <h2 className="text-2xl font-normal text-white/90 tracking-tight">Behavioral Macro Trends</h2>
                                </div>
                                <div className="flex flex-col gap-3">
                                    {(ontology.trends || []).map((trend, i) => (
                                        <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-4 p-5 bg-white/[0.02] border border-white/[0.05] rounded-xl group hover:border-blue-500/30 transition-colors">
                                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                                                {trend.direction?.toLowerCase().includes('grow') ? (
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                                ) : (
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-medium text-white/90 mb-1">{trend.name}</h3>
                                                <p className="text-sm text-white/50 leading-relaxed font-light">{trend.description}</p>
                                            </div>
                                            <div className="text-[10px] uppercase font-mono tracking-widest text-blue-400 bg-blue-500/10 px-3 py-1 rounded-full whitespace-nowrap">
                                                {trend.direction}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>

                             {/* Market Knowledge Graph */}
                            <section className="border-t border-white/[0.05] pt-16">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-4">
                                        <SectionBadge number="04" />
                                        <div>
                                            <h2 className="text-2xl font-normal text-white/90 tracking-tight">Market Knowledge Graph</h2>
                                            <span className="text-[10px] text-blue-400/60 uppercase tracking-widest font-black">Powered by Zep Cloud</span>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setIsGraphVisible(!isGraphVisible)}
                                        className="text-[11px] font-bold uppercase tracking-widest text-white/30 hover:text-white transition-colors"
                                    >
                                        [ {isGraphVisible ? 'Hide' : 'Show'} View ]
                                    </button>
                                </div>
                                
                                <div id="graph-section" className={`bg-[#0D0D0D] border border-white/[0.08] rounded-3xl overflow-hidden min-h-[600px] flex flex-col transition-all duration-300 ${isGraphVisible ? 'opacity-100' : 'hidden opacity-0'}`}>
                                    <GraphExplorer 
                                        headless={true} 
                                        graphId={marketContext?.graphId}
                                        idea={idea}
                                        marketContext={marketContext}
                                    />
                                </div>

                                <div className="mt-6 flex flex-wrap gap-6 items-center justify-center">
                                    {[
                                        { label: 'Startup Idea', color: 'bg-purple-500' },
                                        { label: 'Competitor', color: 'bg-red-500' },
                                        { label: 'Market Risk', color: 'bg-amber-500' },
                                        { label: 'Behavioral Trend', color: 'bg-blue-500' },
                                        { label: 'Market Entity (Zep)', color: 'bg-indigo-900' }
                                    ].map((l, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full ${l.color}`} />
                                            <span className="text-[10px] uppercase tracking-widest text-white/30 font-bold">{l.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            {/* Action Footer */}
                            <div className="pt-12 mt-12 border-t border-white/[0.05] flex justify-center">
                                <Button 
                                    onClick={handlePersonaScan}
                                    disabled={scanning}
                                    size="lg"
                                    className="bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-500/20 px-12 py-4"
                                >
                                    {scanning ? "Scanning 1M+ Personas..." : "Scan 1M+ Personas →"}
                                </Button>
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}
