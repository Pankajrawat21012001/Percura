"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useIdea } from "../../context/IdeaContext";
import Button from "../../components/ui/Button";
import DashboardLayout from "../../components/DashboardLayout";
import ChatPanel from "../../components/ChatPanel";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../lib/firebase";
import { doc, addDoc, updateDoc, collection, serverTimestamp } from "firebase/firestore";
import API_BASE_URL from "../../lib/apiConfig";

const ShaderPageBackground = dynamic(
    () => import("../../components/ui/shader-background"),
    { ssr: false }
);

export default function SegmentPage() {
    const router = useRouter();
    const { validation, idea, setSimulationResults, setCurrentSimulationId, currentSimulationId } = useIdea();
    const { user } = useAuth();
    
    const [selectedSegments, setSelectedSegments] = useState(new Set());
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
            <div className="min-h-screen flex items-center justify-center bg-black">
                <div className="text-center max-w-md px-6">
                    <div className="w-16 h-16 rounded-2xl bg-white/[0.07] border border-white/20 flex items-center justify-center text-2xl mx-auto mb-6">📊</div>
                    <h2 className="text-xl font-light text-white mb-2">No Results Found</h2>
                    <p className="text-sm text-white/50 mb-6 font-normal leading-relaxed">You haven't run a test yet, or your session has expired.</p>
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

    const handleRunSimulation = async () => {
        if (!user || selectedSegments.size === 0) return;
        setIsSimulating(true);

        // Filter selected segments
        const selectedList = [];
        if (selectedSegments.has("custom")) selectedList.push(customSegment);
        segments.forEach(seg => {
            if (selectedSegments.has(seg.segment_id)) selectedList.push(seg);
        });
        
        try {
            const simulationData = {
                userId: user.uid,
                ideaData: idea,
                status: "in progress",
                timestamp: serverTimestamp(),
                results: {
                    segments: selectedList,
                    totalMatched: validation.totalMatched,
                    testType: idea.testType
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
                // Fallback: Just create a new record if update fails (likely due to strict rules)
                const docRef = await addDoc(collection(db, "simulations"), simulationData);
                docId = docRef.id;
                setCurrentSimulationId(docId);
            }

            setSimulationResults([]);
            router.push("/simulation-results");
        } catch (err) {
            console.error("Failed to start simulation record:", err);
            setIsSimulating(false);
        }
    };

    return (
        <div className="relative min-h-screen text-white bg-black selection:bg-purple-500/30 overflow-x-hidden">
            <ShaderPageBackground overlayOpacity={0.8} blur={true} />

            <div className="relative z-10 max-w-6xl mx-auto px-6 py-24 pb-48">
                {/* Header Section */}
                <div className="text-center mb-20">
                    <p className="text-[10px] uppercase tracking-[0.4em] text-purple-400 font-black mb-4 flex items-center justify-center gap-3">
                        <span className="w-10 h-[1px] bg-purple-500/30" />
                        {segments.length} Look-alike Segments Identified
                        <span className="w-10 h-[1px] bg-purple-500/30" />
                    </p>
                    <h1 className="text-4xl md:text-6xl font-light tracking-tighter mb-6">
                        Target <span className="text-gradient italic font-normal">Audience</span> Selection
                    </h1>
                    <p className="text-white/40 text-sm font-light max-w-2xl mx-auto leading-relaxed">
                        Our engine synthesized the <span className="text-white/80 font-medium">50 best-fit personas</span> from 1M+ profiles. 
                        We've clustered them into tactical segments for a <span className="text-white/80 font-medium">{idea?.duration || 12}-week</span> simulation horizon.
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
                        />
                    ))}

                    {/* Custom Segment Box */}
                    <div 
                        onClick={() => toggleSegment("custom")}
                        className={`
                        relative rounded-[1.5rem] border overflow-hidden transition-all duration-700 h-full flex flex-col group cursor-pointer
                        ${selectedSegments.has("custom") 
                            ? "border-purple-500/50 bg-[#121212]/90 shadow-[0_0_60px_-15px_rgba(168,85,247,0.25)]" 
                            : "border-white/10 bg-[#0A0A0A]/80 hover:border-white/20"}
                    `}>
                        {/* Glow Effect */}
                        <div className="absolute top-0 left-0 w-32 h-32 bg-purple-600/10 blur-[60px] rounded-full pointer-events-none group-hover:bg-purple-600/20 transition-all duration-700" />
                        
                        <div className="p-8 pb-4 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <span className="text-[9px] uppercase tracking-[0.2em] text-purple-400 font-bold block mb-2">Custom Segment</span>
                                    <h3 className="text-xl font-normal text-white">Manual Audience</h3>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="text-3xl font-light text-white/80 tabular-nums">{customSegment.personas.length}</span>
                                    <div className={`w-6 h-6 shrink-0 rounded-full border flex items-center justify-center transition-all ${selectedSegments.has("custom") ? "bg-purple-500 border-purple-500" : "border-white/10"}`}>
                                        {selectedSegments.has("custom") && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor font-bold"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4 mb-8">
                                <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-white/40">
                                    <span>Control</span>
                                    <span className="text-purple-400 font-bold">User Defined</span>
                                </div>
                                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 w-full opacity-30" />
                                </div>
                            </div>

                            {/* Custom Persona List (Mini) */}
                            <div className="flex-1 space-y-3 mb-8">
                                {customSegment.personas.length > 0 ? (
                                    customSegment.personas.slice(0, 3).map((p, idx) => (
                                        <div key={idx} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex gap-3 text-[10px] items-center">
                                            <div className="w-6 h-6 shrink-0 rounded-lg bg-white/5 flex items-center justify-center text-white/40">👤</div>
                                            <div className="flex-1 truncate">
                                                <p className="text-white/80 font-bold truncate">{p.metadata.name || p.metadata.occupation}</p>
                                                <p className="text-white/30 truncate">{p.metadata.age}Y · {p.metadata.state}</p>
                                            </div>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveCustomPersona(p.persona_id);
                                                }}
                                                className="w-6 h-6 shrink-0 flex items-center justify-center text-white/20 hover:bg-red-500/10 hover:text-red-400 rounded-md transition-all"
                                                title="Remove Persona"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center opacity-20 border-2 border-dashed border-white/5 rounded-2xl p-6">
                                        <p className="text-[10px] tracking-widest uppercase mb-2">Empty Bucket</p>
                                    </div>
                                )}
                            </div>

                            <div className="mt-auto pt-6 border-t border-white/[0.03] space-y-4">
                                <Button 
                                    onClick={(e) => {
                                         e.stopPropagation();
                                         setIsCreatingCustom(true);
                                     }}
                                     className="w-full shadow-xl"
                                     size="sm"
                                 >
                                     + Add New Persona
                                 </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="fixed bottom-12 left-0 w-full flex justify-center px-8 z-40 pointer-events-none">
                    <div className="max-w-2xl w-full bg-[#080808]/90 backdrop-blur-2xl border border-white/[0.1] rounded-3xl p-4 flex gap-4 pointer-events-auto shadow-2xl">
                        <Button 
                            onClick={() => router.push("/validate")}
                            variant="ghost"
                            className="px-8 text-[10px] uppercase tracking-[0.2em] font-bold"
                        >
                            Modify Idea
                        </Button>
                        <Button 
                            disabled={selectedSegments.size === 0 || isSimulating}
                            onClick={handleRunSimulation}
                            showArrow={!isSimulating}
                            className="flex-1"
                        >
                            {isSimulating ? "Initializing..." : `Run Simulation (${selectedSegments.size})`}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Custom Creator Dialog */}
            {isCreatingCustom && (
                <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/80 backdrop-blur-md">
                    <div className="w-full max-w-xl bg-[#0D0D0D] border border-white/15 rounded-[2.5rem] p-10 shadow-2xl animate-in fade-in zoom-in duration-300 relative">
                        <button onClick={() => setIsCreatingCustom(false)} className="absolute top-8 right-8 text-white/30 hover:text-white">✕</button>
                        <h2 className="text-2xl font-light text-white mb-2">Create Target Persona</h2>
                        <div className="grid grid-cols-2 gap-6 mb-8 mt-8">
                            <div className="col-span-2">
                                <label className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-2 block">Full Name</label>
                                <input type="text" placeholder="e.g. Ramesh Singh" value={newPersona.name} onChange={e => setNewPersona({...newPersona, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20" />
                            </div>
                            <div>
                                <label className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-2 block">Occupation</label>
                                <input type="text" placeholder="e.g. Software Engineer" value={newPersona.occupation} onChange={e => setNewPersona({...newPersona, occupation: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20" />
                            </div>
                            <div>
                                <label className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-2 block">Age</label>
                                <input type="number" placeholder="e.g. 25" value={newPersona.age} onChange={e => setNewPersona({...newPersona, age: parseInt(e.target.value) || ""})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20" />
                            </div>
                            <div className="col-span-2">
                                <label className="text-[9px] uppercase tracking-widest text-white/30 font-bold mb-2 block">Summary</label>
                                <textarea placeholder="A brief description of this target user..." value={newPersona.summary} onChange={e => setNewPersona({...newPersona, summary: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white h-24 placeholder-white/20" />
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
        </div>
    );
}

function PersonaBox({ segment, index, isSelected, onToggle }) {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Demographic shortcuts from profile
    const profile = segment.profile || {};
    
    return (
        <div 
            onClick={onToggle}
            className={`
            relative rounded-[2rem] border transition-all duration-700 p-8 flex flex-col h-full group cursor-pointer
            ${isSelected 
                ? "border-purple-500/50 bg-[#121212] shadow-[0_20px_50px_-20px_rgba(168,85,247,0.15)]" 
                : "border-white/10 bg-[#0A0A0A] hover:border-white/20"}
        `}>
            {/* Index & Selection Status */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <span className="text-[9px] uppercase tracking-[0.3em] text-purple-400/60 font-black block mb-2">Segment Cluster {index}</span>
                    <h3 className="text-2xl font-normal text-white leading-tight">{segment.segment_name}</h3>
                </div>
                <div className={`w-6 h-6 shrink-0 rounded-full border flex items-center justify-center transition-all ${isSelected ? "bg-purple-500 border-purple-500" : "border-white/10"}`}>
                    {isSelected && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor font-bold"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
            </div>

            {/* Strategic Resonance Bar */}
            <div className="mb-8 p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                <div className="flex justify-between items-center mb-2.5">
                    <span className="text-[9px] uppercase tracking-widest text-white/30 font-bold">Strategic Resonance</span>
                    <span className="text-xs font-black italic text-purple-400">{segment.resonance_score || 0}%</span>
                </div>
                <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-gradient-to-r from-purple-500 via-purple-400 to-blue-500 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                        style={{ width: `${segment.resonance_score || 0}%` }}
                    />
                </div>
            </div>

            {/* Tactical Badges */}
            <div className="flex flex-wrap gap-2 mb-8">
                <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 flex items-center gap-2">
                    <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Age</span>
                    <span className="text-[11px] text-white/80">{profile.age_range || "N/A"}</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 flex items-center gap-2">
                    <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Zone</span>
                    <span className="text-[11px] text-white/80">{profile.dominant_zone || "N/A"}</span>
                </div>
                <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 flex items-center gap-2">
                    <span className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Sex</span>
                    <span className="text-[11px] text-white/80">{profile.dominant_sex || "N/A"}</span>
                </div>
            </div>

            {/* Segment Profile Summary */}
            <div className="mb-8">
                <p className="text-sm font-light text-white/50 leading-relaxed italic">
                    "This group typically resides in {profile.dominant_state} and is primarily composed of {profile.dominant_occupation} professionals looking for innovation in this sector."
                </p>
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
                            <div key={p.persona_id || pIdx} className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="text-[11px] font-bold text-white/80">
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
                                    <span className="text-[9px] text-purple-400 font-bold">{Math.round((p.similarity_score || 0) * 100)}% Match</span>
                                </div>
                                <p className="text-[10px] text-white/40 leading-relaxed font-normal">
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
