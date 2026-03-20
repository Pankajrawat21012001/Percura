"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useIdea } from "../../context/IdeaContext";
import Button from "../../components/ui/Button";
import DashboardLayout from "../../components/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import { doc, addDoc, updateDoc, collection, serverTimestamp } from "firebase/firestore";
import API_BASE_URL from "../../lib/apiConfig";
import LoadingScreen from "../../components/ui/LoadingScreen";


export default function SegmentPage() {
    const router = useRouter();
    const { validation, idea, setSimulationResults, setCurrentSimulationId, currentSimulationId } = useIdea();
    const { user } = useAuth();
    
    const [selectedSegments, setSelectedSegments] = useState(new Set());
    const [phase, setPhase] = useState("selection"); // "selection", "pulsing", "validated"
    const [pulseResults, setPulseResults] = useState({});
    const [isSimulating, setIsSimulating] = useState(false);
    const [isCreatingCustom, setIsCreatingCustom] = useState(false);
    
    const [customSegment, setCustomSegment] = useState({
        segment_id: "custom",
        segment_name: "User Defined Segment",
        profile: {
            age_range: "Manual",
            dominant_occupation: "Custom",
            dominant_state: "India",
            dominant_zone: "All",
            dominant_sex: "N/A"
        },
        personas: []
    });

    const [newPersona, setNewPersona] = useState({
        age: "",
        sex: "Male",
        state: "Maharashtra",
        zone: "Urban",
        occupation: "",
        education_level: "Graduate",
        summary: "",
        name: ""
    });

    if (!validation) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white">
                <div className="text-center max-w-md px-6">
                    <div className="w-16 h-16 rounded-2xl bg-[#FAFAFA] border border-black/[0.08] flex items-center justify-center text-2xl mx-auto mb-6">
                        <svg className="w-8 h-8 text-black/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <h2 className="text-xl text-[#1a1a1a] mb-2" style={{ fontFamily: "var(--font-serif)" }}>No Results Found</h2>
                    <p className="text-sm text-black/40 mb-6 leading-relaxed">You haven't run a test yet, or your session has expired.</p>
                    <Button
                        onClick={() => router.push("/validate")}
                        variant="secondary"
                        size="md"
                    >
                        Start Testing
                    </Button>
                </div>
            </div>
        );
    }

    const segments = validation.segments || [];
    const totalMatched = validation.totalMatched || 0;

    const toggleSegment = (id) => {
        if (id === "custom" && customSegment.personas.length === 0) return;
        const next = new Set(selectedSegments);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedSegments(next);
    };

    const handleAddCustomPersona = () => {
        const personaWithId = {
            persona_id: `custom_${Date.now()}`,
            metadata: { 
                ...newPersona,
                name: newPersona.name || "Custom Persona",
                summary: newPersona.summary || `A ${newPersona.age || "Unknown"} year old ${newPersona.occupation || "professional"} from ${newPersona.state}.` 
            },
            similarity_score: 1.0
        };
        
        setCustomSegment(prev => ({
            ...prev,
            personas: [...prev.personas, personaWithId]
        }));
        
        setNewPersona(prev => ({ ...prev, occupation: "", age: "", summary: "", name: "" }));
        setIsCreatingCustom(false);
        // Automatically select custom segment on adding first persona
        if (customSegment.personas.length === 0) {
            setSelectedSegments(prev => new Set(prev).add("custom"));
        }
    };

    const handleRemoveCustomPersona = (personaId) => {
        setCustomSegment(prev => {
            const updatedPersonas = prev.personas.filter(p => p.persona_id !== personaId);
            if (updatedPersonas.length === 0) {
                setSelectedSegments(s => {
                    const next = new Set(s);
                    next.delete("custom");
                    return next;
                });
            }
            return { ...prev, personas: updatedPersonas };
        });
    };

    const handleRunPulseTest = async () => {
        if (!user || selectedSegments.size === 0) return;
        setPhase("pulsing");

        const selectedList = [];
        if (selectedSegments.has("custom")) selectedList.push(customSegment);
        segments.forEach(seg => {
            if (selectedSegments.has(seg.segment_id)) selectedList.push(seg);
        });

        try {
            const response = await fetch(`${API_BASE_URL}/api/simulate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    idea: idea, 
                    segments: selectedList 
                })
            });

            const data = await response.json();
            if (data.success) {
                const resultsMap = {};
                data.results.forEach(r => {
                    resultsMap[r.segment_id] = r.testResult;
                });
                setPulseResults(resultsMap);
                setPhase("validated");
                
                // Automatically proceed to finalization to avoid "Run Simulation" twice
                // We pass the newly built resultsMap directly since setPulseResults is async
                await finalizeSimulation(resultsMap);
            } else {
                throw new Error("Pulse Test failed");
            }
        } catch (err) {
            console.error("Failed to run pulse test:", err);
            setPhase("selection");
            setIsSimulating(false);
        }
    };

    const finalizeSimulation = async (pResults) => {
        if (!user || selectedSegments.size === 0) return;
        setIsSimulating(true);

        const resultsToUse = pResults || pulseResults;

        // Build selected list with full persona data AND attach pulse validation results
        const selectedList = [];
        if (selectedSegments.has("custom")) selectedList.push({...customSegment, testResult: resultsToUse["custom"]});
        segments.forEach(seg => {
            if (selectedSegments.has(seg.segment_id)) {
                selectedList.push({...seg, testResult: resultsToUse[seg.segment_id]});
            }
        });

        // Save full segments (with personas and testResult) to localStorage for results page
        // This survives Firestore but resets on hard refresh
        try {
            const lsKey = `percura_segments_${currentSimulationId || 'pending'}`;
            localStorage.setItem(lsKey, JSON.stringify(selectedList));
        } catch (e) { /* localStorage full or unavailable */ }

        // Strip personas for Firestore (1MB limit)
        const selectedListForFirestore = selectedList.map(seg => {
            const { personas, ...rest } = seg;
            return { ...rest, personaCount: personas?.length || 0 };
        });
        
        try {
            const simulationData = {
                userId: user.uid,
                ideaData: idea,
                status: "completed", // Instantly completed because pulse is done
                timestamp: serverTimestamp(),
                results: {
                    segmentsWithResults: selectedListForFirestore, // Changed from segments to segmentsWithResults
                    totalMatched: validation.totalMatched,
                    testType: idea.testType,
                    marketContext: validation.marketContext || null,
                }
            };

            let docId = currentSimulationId;

            try {
                if (docId) {
                    // Use setDoc with merge: true as it's often more permissive in basic rules than updateDoc
                    const { setDoc } = await import("firebase/firestore");
                    await setDoc(doc(db, "simulations", docId), simulationData, { merge: true });
                } else {
                    const docRef = await addDoc(collection(db, "simulations"), simulationData);
                    docId = docRef.id;
                    setCurrentSimulationId(docId);
                }
            } catch (permError) {
                console.warn("Permission issue or document mismatch, falling back to new record creation:", permError);
                const docRef = await addDoc(collection(db, "simulations"), simulationData);
                docId = docRef.id;
                setCurrentSimulationId(docId);
            }

            // Re-key localStorage with the final docId (in case it was 'pending')
            try {
                const oldKey = `percura_segments_pending`;
                const stored = localStorage.getItem(oldKey);
                if (stored) {
                    localStorage.setItem(`percura_segments_${docId}`, stored);
                    localStorage.removeItem(oldKey);
                }
            } catch (e) { /* ignore */ }

            setSimulationResults([]);
            router.push("/simulation-results");
        } catch (err) {
            console.error("Failed to start simulation record:", err);
            setIsSimulating(false);
        }
    };
    if (isSimulating) {
        return (
            <LoadingScreen 
                message="Initializing Deep Pulse Simulation..."
                customSteps={[
                    "Loading persona profiles into neural buffer...",
                    "Injecting market context and ontology bias...",
                    "Running zero-shot response synthesis...",
                    "Aggregating cross-segment sentiments...",
                    "Generating final 8-week horizon report..."
                ]}
            />
        );
    }

    return (
        <DashboardLayout currentStep={3}>
            {/* Background */}
            <div className="absolute inset-0 bg-grid opacity-15 pointer-events-none" />

            <div className="relative z-10 max-w-6xl mx-auto px-6 pt-6 pb-48">
                {/* Header Section */}
                <div className="text-center mb-20">
                    <p className="text-[11px] uppercase tracking-[0.4em] text-[#E85D3A] font-bold mb-4 flex items-center justify-center gap-3">
                        <span className="w-10 h-[1px] bg-[#E85D3A]/30" />
                        {segments.length} Look-alike Segments Identified
                        <span className="w-10 h-[1px] bg-[#E85D3A]/30" />
                    </p>
                    <h1 className="text-4xl md:text-6xl tracking-tighter mb-6" style={{ fontFamily: "var(--font-serif)", fontWeight: 400 }}>
                        Target <em style={{ fontStyle: "italic" }}>Audience</em> Selection
                    </h1>
                    <p className="text-black/40 text-sm max-w-2xl mx-auto leading-relaxed">
                        Our engine synthesized the <span className="text-black/80 font-semibold">50 best-fit personas</span> from 1M+ profiles. 
                        We've clustered them into tactical segments for a <span className="text-black/80 font-semibold">{idea?.duration || 12}-week</span> simulation horizon.
                    </p>
                </div>

                {/* Segments Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8 mb-16">
                    {segments.map((seg, i) => (
                        <PersonaBox 
                            key={seg.segment_id}
                            segment={seg}
                            index={i + 1}
                            isSelected={selectedSegments.has(seg.segment_id)}
                            onToggle={() => toggleSegment(seg.segment_id)}
                            pulseResult={pulseResults[seg.segment_id]}
                        />
                    ))}

                    {/* Custom Segment Box */}
                    <div 
                        onClick={() => toggleSegment("custom")}
                        className={`
                        relative rounded-2xl border overflow-hidden transition-all duration-500 h-full flex flex-col group cursor-pointer
                        ${selectedSegments.has("custom") 
                            ? "border-[#E85D3A]/40 bg-white shadow-lg shadow-[#E85D3A]/5" 
                            : "border-black/[0.08] bg-white hover:border-black/15 hover:shadow-lg hover:shadow-black/[0.03]"}
                    `}>
                        <div className="p-8 pb-4 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <span className="text-[11px] uppercase tracking-[0.2em] text-[#E85D3A] font-bold block mb-2">Custom Segment</span>
                                    <h3 className="text-xl text-[#1a1a1a]" style={{ fontFamily: "var(--font-serif)" }}>Manual Audience</h3>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-3xl font-light text-black/80 tabular-nums">{customSegment.personas.length}</span>
                                    <div className={`w-6 h-6 shrink-0 rounded-full border flex items-center justify-center transition-all ${selectedSegments.has("custom") ? "bg-[#E85D3A] border-[#E85D3A]" : "border-black/15"}`}>
                                        {selectedSegments.has("custom") && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div className="flex justify-between items-center text-[11px] uppercase tracking-widest text-black/40">
                                    <span>Control</span>
                                    <span className="text-[#E85D3A] font-bold">User Defined</span>
                                </div>
                                <div className="w-full h-1.5 bg-black/[0.04] rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-[#E85D3A] to-emerald-500 w-full opacity-30" />
                                </div>
                            </div>

                            {/* Custom Persona List (Mini) */}
                            <div className="flex-1 space-y-3 mb-8">
                                {customSegment.personas.length > 0 ? (
                                    customSegment.personas.slice(0, 3).map((p, idx) => (
                                        <div key={idx} className="p-3 rounded-xl bg-[#FAFAFA] border border-black/[0.06] flex gap-3 text-[11px] items-center">
                                             <div className="w-6 h-6 shrink-0 rounded-lg bg-black/[0.04] flex items-center justify-center text-black/30">👤</div>
                                             <div className="flex-1 truncate">
                                                 <p className="text-black/80 font-semibold truncate">{p.metadata.name || p.metadata.occupation}</p>
                                                 <p className="text-black/30 truncate">{p.metadata.age}Y · {p.metadata.state}</p>
                                             </div>
                                             <button 
                                                 onClick={(e) => {
                                                     e.stopPropagation();
                                                     handleRemoveCustomPersona(p.persona_id);
                                                 }}
                                                 className="w-6 h-6 shrink-0 flex items-center justify-center text-black/20 hover:bg-red-50 hover:text-red-500 rounded-md transition-all"
                                                 title="Remove Persona"
                                             >
                                                 ✕
                                             </button>
                                         </div>
                                    ))
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30 border-2 border-dashed border-black/[0.08] rounded-2xl p-6">
                                        <p className="text-[11px] tracking-widest uppercase mb-2">Empty Bucket</p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-auto pt-6 border-t border-black/[0.06] space-y-4">
                                <Button 
                                    onClick={(e) => {
                                         e.stopPropagation();
                                         setIsCreatingCustom(true);
                                     }}
                                     className="w-full"
                                     size="sm"
                                 >
                                     + Add New Persona
                                 </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="fixed bottom-12 left-0 w-full flex justify-center px-8 z-40 pointer-events-none">
                <div className="max-w-2xl w-full bg-white/95 backdrop-blur-md border border-black/[0.08] rounded-2xl p-4 flex gap-4 pointer-events-auto shadow-xl shadow-black/[0.08]">
                    <Button 
                        onClick={() => router.push("/validate")}
                        variant="ghost"
                        className="px-8 text-[11px] uppercase tracking-[0.2em] font-semibold"
                    >
                        Modify Idea
                    </Button>
                    {phase === "selection" && (
                        <Button 
                            disabled={selectedSegments.size === 0 || isSimulating}
                            onClick={handleRunPulseTest}
                            showArrow={true}
                            className="flex-1 uppercase tracking-widest text-[11px]"
                        >
                            {isSimulating ? "Running Neural Simulation..." : "Run Deep Pulse Validation"}
                        </Button>
                    )}
                    {(phase === "pulsing" || phase === "validated") && (
                        <Button 
                            disabled={true}
                            className="flex-1 uppercase tracking-widest text-[11px] opacity-70"
                        >
                            {isSimulating ? "Synthesizing 8-Week Horizon..." : "Finalizing Neural Results..."}
                        </Button>
                    )}
                </div>
            </div>

            {/* Custom Creator Dialog */}
            {isCreatingCustom && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/20 backdrop-blur-sm">
                    <div className="w-full max-w-xl bg-white border border-black/[0.08] rounded-3xl p-10 shadow-2xl animate-in fade-in zoom-in duration-300 relative">
                        <button onClick={() => setIsCreatingCustom(false)} className="absolute top-8 right-8 text-black/30 hover:text-[#1a1a1a] transition-colors">✕</button>
                        <h2 className="text-2xl text-[#1a1a1a] mb-2" style={{ fontFamily: "var(--font-serif)" }}>Create Target Persona</h2>
                        <div className="grid grid-cols-2 gap-6 mb-8 mt-8">
                            <div className="col-span-2">
                                <label className="text-[11px] uppercase tracking-widest text-black/40 font-semibold mb-2 block">Full Name</label>
                                <input type="text" placeholder="e.g. Ramesh Singh" value={newPersona.name} onChange={e => setNewPersona({...newPersona, name: e.target.value})} className="w-full bg-[#FAFAFA] border border-black/[0.08] rounded-xl px-4 py-3 text-sm text-[#1a1a1a] placeholder-black/25 focus:outline-none focus:border-[#E85D3A]/30 focus:ring-1 focus:ring-[#E85D3A]/10" />
                            </div>
                            <div>
                                <label className="text-[11px] uppercase tracking-widest text-black/40 font-semibold mb-2 block">Occupation</label>
                                <input type="text" placeholder="e.g. Software Engineer" value={newPersona.occupation} onChange={e => setNewPersona({...newPersona, occupation: e.target.value})} className="w-full bg-[#FAFAFA] border border-black/[0.08] rounded-xl px-4 py-3 text-sm text-[#1a1a1a] placeholder-black/25 focus:outline-none focus:border-[#E85D3A]/30 focus:ring-1 focus:ring-[#E85D3A]/10" />
                            </div>
                            <div>
                                <label className="text-[11px] uppercase tracking-widest text-black/40 font-semibold mb-2 block">Age</label>
                                <input type="number" placeholder="e.g. 25" value={newPersona.age} onChange={e => setNewPersona({...newPersona, age: parseInt(e.target.value) || ""})} className="w-full bg-[#FAFAFA] border border-black/[0.08] rounded-xl px-4 py-3 text-sm text-[#1a1a1a] placeholder-black/25 focus:outline-none focus:border-[#E85D3A]/30 focus:ring-1 focus:ring-[#E85D3A]/10" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[11px] uppercase tracking-widest text-black/40 font-semibold mb-2 block">Summary</label>
                                <textarea placeholder="A brief description of this target user..." value={newPersona.summary} onChange={e => setNewPersona({...newPersona, summary: e.target.value})} className="w-full bg-[#FAFAFA] border border-black/[0.08] rounded-xl px-4 py-3 text-sm text-[#1a1a1a] h-24 placeholder-black/25 focus:outline-none focus:border-[#E85D3A]/30 focus:ring-1 focus:ring-[#E85D3A]/10" />
                            </div>
                        </div>
                        <Button 
                            disabled={!newPersona.occupation || !newPersona.age || !newPersona.summary || !newPersona.name}
                            onClick={handleAddCustomPersona} 
                            className="w-full"
                        >
                            Commit to Custom Bucket
                        </Button>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
}

function PersonaBox({ segment, index, isSelected, onToggle, pulseResult }) {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Demographic shortcuts from profile
    const profile = segment.profile || {};
    const verdict = pulseResult?.verdict;
    
    // Define dynamic styles based on verdict and selection
    const getVerdictStyles = () => {
        if (!verdict) {
            return isSelected 
                ? "border-[#E85D3A]/40 bg-white shadow-lg shadow-[#E85D3A]/5" 
                : "border-black/[0.08] bg-white hover:border-black/15 hover:shadow-lg hover:shadow-black/[0.03]";
        }

        const isPositive = ['ENTHUSIASTIC', 'CURIOUS'].includes(verdict);
        const isNeutral = verdict === 'NEUTRAL';
        const isNegative = ['SKEPTICAL', 'CRITICAL'].includes(verdict);
        if (isPositive) {
            return isSelected
                ? "border-[#E85D3A]/40 bg-white shadow-lg shadow-[#E85D3A]/5"
                : "border-black/[0.08] bg-white hover:border-emerald-400/40 hover:shadow-lg hover:shadow-emerald-500/5";
        }
        if (isNeutral) {
            return isSelected
                ? "border-[#E85D3A]/40 bg-white shadow-lg shadow-[#E85D3A]/5"
                : "border-black/[0.08] bg-white hover:border-amber-400/30 hover:shadow-lg hover:shadow-amber-500/5";
        }
        if (isNegative) {
            return isSelected
                ? "border-[#E85D3A]/40 bg-white shadow-lg shadow-[#E85D3A]/5"
                : "border-black/[0.08] bg-white hover:border-red-300/30 hover:shadow-lg hover:shadow-red-500/5";
        }
        
        return "border-black/[0.08] bg-white";
    };

    return (
        <div 
            onClick={onToggle}
            className={`
            relative rounded-2xl border transition-all duration-500 p-8 flex flex-col h-full group cursor-pointer
            ${getVerdictStyles()}
        `}>
            {/* Index & Selection Status */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <span className="text-[11px] uppercase tracking-[0.3em] text-[#E85D3A] font-bold block mb-2">Segment Cluster {index}</span>
                    <h3 className="text-2xl text-[#1a1a1a] leading-tight" style={{ fontFamily: "var(--font-serif)" }}>{segment.segment_name}</h3>
                </div>
                <div className={`w-6 h-6 shrink-0 rounded-full border flex items-center justify-center transition-all ${isSelected ? "bg-[#E85D3A] border-[#E85D3A]" : "border-black/15"}`}>
                    {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
            </div>

            {/* Strategic Resonance Bar, fallback to cosine match if no pulse available */}
            <div className="mb-8 p-4 rounded-2xl bg-[#FAFAFA] border border-black/[0.06] relative overflow-hidden">
                {pulseResult && (
                    <div className="absolute top-0 right-0 px-2 py-1 bg-[#FAFAFA] rounded-bl-lg text-[11px] uppercase tracking-widest font-bold text-[#E85D3A]">
                        Pulse Verified
                    </div>
                )}
                <div className="flex justify-between items-center mb-2.5">
                    <span className="text-[11px] uppercase tracking-widest text-black/30 font-semibold">Total Resonance</span>
                    <span className="text-xs font-bold italic text-[#E85D3A]">
                        {pulseResult ? Math.round(pulseResult.resonanceScore || 0) : (segment.resonance_score || 0)}%
                    </span>
                </div>
                <div className="w-full h-1.5 bg-black/[0.06] rounded-full overflow-hidden mb-4">
                    <div 
                        className="h-full bg-gradient-to-r from-[#E85D3A] via-[#D14E2E] to-rose-500 transition-all duration-1000 ease-out"
                        style={{ width: `${pulseResult ? Math.round(pulseResult.resonanceScore || 0) : (segment.resonance_score || 0)}%` }}
                    />
                </div>

                {/* New Pulse Result Multi-dimensional Scores */}
                {pulseResult && (
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-black/[0.06]">
                        <div>
                            <span className="block text-[11px] uppercase tracking-widest text-black/30 font-semibold">Utility</span>
                            <span className="block text-sm font-bold text-[#1a1a1a]">{Math.round(pulseResult.utilityScore || 0)}%</span>
                        </div>
                        <div>
                            <span className="block text-[11px] uppercase tracking-widest text-black/30 font-semibold">Culture</span>
                            <span className="block text-sm font-bold text-[#1a1a1a]">{Math.round(pulseResult.culturalFitScore || 0)}%</span>
                        </div>
                        <div>
                            <span className="block text-[11px] uppercase tracking-widest text-black/30 font-semibold">Afford</span>
                            <span className="block text-sm font-bold text-[#1a1a1a]">{Math.round(pulseResult.affordabilityScore || 0)}%</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Segment Profile Summary & Pulse Quotes */}
            <div className="mb-8">
                {pulseResult ? (
                    <div>
                        <div className="inline-block px-2 py-1 rounded bg-[#FAFAFA] border border-black/[0.06] mb-3 text-[11px] uppercase tracking-widest font-bold">
                            Verdict: <span className={pulseResult.verdict === 'CRITICAL' || pulseResult.verdict === 'SKEPTICAL' ? 'text-red-500' : 'text-emerald-500'}>{pulseResult.verdict}</span>
                        </div>
                        <p className="text-sm text-black/60 leading-relaxed italic border-l-2 border-[#E85D3A]/40 pl-3">
                            "{pulseResult.verbatimQuote}"
                        </p>
                        <p className="text-[11px] text-black/35 mt-3 uppercase tracking-wide">
                            Predicted Adoption: <strong className="text-black/70">{pulseResult.predictedAdoptionPattern}</strong>
                        </p>
                    </div>
                ) : (
                    <p className="text-sm text-black/40 leading-relaxed italic">
                        "This group typically resides in {profile.dominant_state} and is primarily composed of {profile.dominant_occupation} professionals looking for innovation in this sector."
                    </p>
                )}
            </div>

            {/* Action Area */}
            <div className="mt-auto space-y-4 pt-6">
                <div className="flex gap-3">
                    <Button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsExpanded(!isExpanded);
                        }}
                        variant={isExpanded ? "secondary" : "ghost"}
                        className="flex-1 text-[10px] uppercase tracking-[0.2em]"
                    >
                        {isExpanded ? "Hide Personas" : `View ${segment.personas?.length || 0} Personas`}
                        <svg className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </Button>
                </div>

                {/* Drill-down Persona List */}
                {isExpanded && (
                    <div className="space-y-3 mt-4 animate-in slide-in-from-top-2 duration-300 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {segment.personas?.map((p, pIdx) => (
                            <div key={p.persona_id || pIdx} className="p-4 rounded-xl bg-[#FAFAFA] border border-black/[0.06] hover:border-black/12 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="text-[11px] font-semibold text-black/80">
                                        {(() => {
                                            const rawName = p.metadata?.name || (p.metadata?.occupation ? `Persona of ${p.metadata.occupation}` : `Persona ${p.persona_id}`);
                                            const cleanName = (rawName || "").trim().toLowerCase();
                                            if (cleanName.includes("persona") || ["unknown", "n/a", ""].includes(cleanName)) {
                                                const seed = parseInt((p.persona_id).toString().replace(/\D/g, '')) || 0;
                                                const names = ["Aarav", "Arjun", "Aditya", "Amit", "Alok", "Ananya", "Aavya", "Bhavna", "Ishani", "Jiya"];
                                                const surnames = ["Sharma", "Verma", "Gupta", "Malhotra", "Kapoor", "Patel", "Shah", "Kumar", "Singh", "Yadav"];
                                                return `${names[seed % names.length]} ${surnames[(seed * 7) % surnames.length]}`;
                                            }
                                            return rawName;
                                        })()}
                                    </h4>
                                    <span className="text-[10px] text-[#E85D3A] font-bold">{Math.round((p.similarity_score || 0) * 100)}% Match</span>
                                </div>
                                 <p className="text-[11px] text-black/35 leading-relaxed">
                                     {p.metadata?.age}Y · {p.metadata?.occupation} · {p.metadata?.state}
                                 </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}