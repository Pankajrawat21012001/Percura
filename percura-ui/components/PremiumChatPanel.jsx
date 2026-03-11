"use client";

import { useState, useRef, useEffect } from "react";
import { useIdea } from "../context/IdeaContext";
import Button from "./ui/Button";
import API_BASE_URL from "../lib/apiConfig";

const FALLBACK_NAMES = [
    "Ananya", "Aavya", "Bhavna", "Ishani", "Jiya", "Kavya", "Meera", "Neha", "Pooja", "Priya",
    "Riya", "Sanya", "Tanvi", "Vanya", "Zoya", "Amrita", "Deepika", "Esha", "Gauri", "Hema"
];

const FALLBACK_SURNAMES = [
    "Sharma", "Verma", "Gupta", "Malhotra", "Kapoor", "Khanna", "Joshi", "Patel", "Shah", "Mehta",
    "Reddy", "Nair", "Iyer", "Kumar", "Singh", "Yadav", "Chauhan", "Pandey", "Mishra", "Dubey"
];

function getRealisticName(id, currentName) {
    if (currentName && !currentName.includes("Persona") && currentName !== "Custom Persona") {
        return currentName;
    }
    const seed = parseInt(id.toString().replace(/\D/g, '')) || 0;
    const first = FALLBACK_NAMES[seed % FALLBACK_NAMES.length];
    const last = FALLBACK_SURNAMES[(seed * 7) % FALLBACK_SURNAMES.length];
    return `${first} ${last}`;
}

const SUGGESTED_QUESTIONS = [
    "Why did you reject this product?",
    "What confused you about the value proposition?",
    "Would you pay for this? Why or why not?",
    "What feature would make you reconsider?",
    "Would you recommend this to others in your network?",
    "What was the biggest risk you saw?",
];

export default function PremiumChatPanel({ onClose }) {
    const { currentSimulationId, idea, simulationResults } = useIdea();

    // Chat mode: 'single' or 'panel'
    const [mode, setMode] = useState("single");

    // Selection state
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [panelAgents, setPanelAgents] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedSegmentFilter, setSelectedSegmentFilter] = useState("all");
    const [isSegmentDropdownOpen, setIsSegmentDropdownOpen] = useState(false);

    // Chat history state
    const [conversations, setConversations] = useState({}); // { agentId: [{sender, text, senderName}] }
    const [panelMessages, setPanelMessages] = useState([]); // [{sender, text, replies?}]
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const chatEndRef = useRef(null);

    // Prepare all agents from all segments
    const allAgents = (simulationResults || []).reduce((acc, segment) => {
        const personas = (segment.personas || []).map(p => {
            const personaId = p.persona_id || p.id;
            const rawName = getRealisticName(personaId, p.metadata?.name || p.name);
            const age = p.metadata?.age || p.age;
            const displayName = age ? `${rawName} (${age})` : rawName;

            return {
                ...p,
                id: personaId,
                name: rawName,
                displayName: displayName,
                age: age,
                archetype: p.metadata?.occupation || p.metadata?.archetype || p.archetype || segment.segment_name,
                state: p.state || (segment.testResult?.resonanceScore >= 70 ? "ADOPTED" : segment.testResult?.resonanceScore < 50 ? "REJECTED" : "NEUTRAL"),
                influence: p.influence || Math.floor(Math.random() * 6) + 3, // Fallback
                segmentId: segment.segment_id,
                segmentName: segment.segment_name
            };
        });
        return [...acc, ...personas];
    }, []);

    // Filter agents
    const filteredAgents = allAgents.filter(agent => {
        const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            agent.archetype.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesSegment = selectedSegmentFilter === "all" || agent.segmentId === selectedSegmentFilter;
        return matchesSearch && matchesSegment;
    });

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [conversations, panelMessages, isLoading]);

    // ───────── SELECTION LOGIC ─────────
    const handleAgentClick = (agent) => {
        if (mode === "single") {
            setSelectedAgent(agent);
        } else {
            setPanelAgents((prev) =>
                prev.find((a) => a.id === agent.id)
                    ? prev.filter((a) => a.id !== agent.id)
                    : [...prev, agent]
            );
        }
    };

    // ───────── MESSAGE HANDLING ─────────
    const handleSend = async () => {
        const message = inputValue.trim();
        if (!message || isLoading) return;

        if (mode === "single") {
            if (!selectedAgent) return;
            const agentId = selectedAgent.id;
            const history = conversations[agentId] || [];
            const userMsgObj = { sender: "user", text: message };
            const updatedHistory = [...history, userMsgObj];

            setConversations(prev => ({ ...prev, [agentId]: updatedHistory }));
            setInputValue("");
            setIsLoading(true);

            try {
                const res = await fetch(`${API_BASE_URL}/api/chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        simulationId: currentSimulationId,
                        target: [agentId],
                        message: message,
                        history: updatedHistory.slice(-10),
                        context: { idea, simulationResults }
                    }),
                });

                const data = await res.json();
                const agentReply = data.reply || "...";
                const agentName = data.name || selectedAgent.name;

                setConversations(prev => ({
                    ...prev,
                    [agentId]: [
                        ...prev[agentId],
                        { sender: "ai", text: agentReply, senderName: agentName },
                    ],
                }));
            } catch (err) {
                console.error("Chat error:", err);
                setConversations(prev => ({
                    ...prev,
                    [agentId]: [
                        ...prev[agentId],
                        { sender: "ai", text: "Connection lost. Agent unresponsive.", senderName: selectedAgent.name },
                    ],
                }));
            } finally {
                setIsLoading(false);
            }
        } else {
            if (panelAgents.length === 0) return;
            const userMsgObj = { sender: "user", text: message };
            const newMessages = [...panelMessages, userMsgObj];
            setPanelMessages(newMessages);
            setInputValue("");
            setIsLoading(true);

            try {
                const res = await fetch(`${API_BASE_URL}/api/chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        simulationId: currentSimulationId,
                        target: panelAgents.map(a => a.id),
                        message: message,
                        history: newMessages.slice(-10),
                        context: { idea, simulationResults }
                    }),
                });

                const data = await res.json();
                const replies = data.replies || [];

                setPanelMessages((prev) => [
                    ...prev,
                    { sender: "panel", replies },
                ]);
            } catch (err) {
                console.error("Panel chat error:", err);
                setPanelMessages((prev) => [
                    ...prev,
                    { sender: "panel", replies: [{ name: "System", reply: "Panel discussion failed. Neural synchronization error." }] },
                ]);
            } finally {
                setIsLoading(false);
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const currentHistory = mode === "single" && selectedAgent
        ? conversations[selectedAgent.id] || []
        : panelMessages;

    return (
        <div className="fixed inset-0 z-[100] bg-[#0A0A0C]/95 backdrop-blur-2xl flex items-center justify-center p-4 lg:p-10 animate-in fade-in duration-500">
            {/* Close Button */}
            <button
                onClick={onClose}
                className="absolute top-6 right-6 p-3 rounded-full bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all z-[110]"
            >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            {/* Main Container */}
            <div className="w-full h-full max-w-7xl bg-[#0F0F12] border border-white/10 rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,1)] flex overflow-hidden relative">

                {/* ── LEFT: Sidebar ── */}
                <div className="w-[320px] shrink-0 border-r border-white/5 flex flex-col bg-black/40">
                    {/* Header: Tabs */}
                    <div className="p-6 pb-4">
                        <div className="flex bg-white/[0.03] rounded-2xl p-1.5 border border-white/5">
                            <button
                                onClick={() => setMode("single")}
                                className={`flex-1 text-[10px] uppercase tracking-[0.2em] font-black py-3 rounded-xl transition-all ${mode === "single" ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20" : "text-white/30 hover:text-white/60"}`}
                            >
                                1:1 Interview
                            </button>
                            <button
                                onClick={() => setMode("panel")}
                                className={`flex-1 text-[10px] uppercase tracking-[0.2em] font-black py-3 rounded-xl transition-all ${mode === "panel" ? "bg-purple-600 text-white shadow-lg shadow-purple-600/20" : "text-white/30 hover:text-white/60"}`}
                            >
                                Panel
                            </button>
                        </div>
                    </div>

                    {/* Filter & Search */}
                    <div className="px-6 pb-4 space-y-3">
                        <div className="relative group">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            <input
                                type="text"
                                placeholder="Search personas..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/[0.03] border border-white/5 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 transition-all"
                            />
                        </div>
                        <div className="relative">
                            <button
                                onClick={() => setIsSegmentDropdownOpen(!isSegmentDropdownOpen)}
                                className="w-full bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 text-[10px] text-white/70 font-bold uppercase tracking-widest focus:outline-none focus:border-purple-500/50 transition-all flex items-center justify-between group hover:bg-white/[0.06]"
                            >
                                <span>
                                    {selectedSegmentFilter === "all"
                                        ? "Any Segment"
                                        : (simulationResults || []).find(s => s.segment_id === selectedSegmentFilter)?.segment_name}
                                </span>
                                <svg className={`w-3 h-3 text-white/20 group-hover:text-white/40 transition-transform duration-300 ${isSegmentDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>

                            {isSegmentDropdownOpen && (
                                <div className="absolute top-full left-0 w-full mt-2 bg-[#1A1A1F] border border-white/10 rounded-xl py-2 shadow-2xl z-50 animate-in slide-in-from-top-2 fade-in duration-200 backdrop-blur-xl">
                                    <button
                                        onClick={() => { setSelectedSegmentFilter("all"); setIsSegmentDropdownOpen(false); }}
                                        className={`w-full text-left px-4 py-2.5 text-[10px] uppercase tracking-widest font-bold transition-colors ${selectedSegmentFilter === "all" ? "text-purple-400 bg-purple-500/10" : "text-white/40 hover:text-white hover:bg-white/5"}`}
                                    >
                                        Any Segment
                                    </button>
                                    {(simulationResults || []).map(seg => (
                                        <button
                                            key={seg.segment_id}
                                            onClick={() => { setSelectedSegmentFilter(seg.segment_id); setIsSegmentDropdownOpen(false); }}
                                            className={`w-full text-left px-4 py-2.5 text-[10px] uppercase tracking-widest font-bold transition-colors ${selectedSegmentFilter === seg.segment_id ? "text-purple-400 bg-purple-500/10" : "text-white/40 hover:text-white hover:bg-white/5"}`}
                                        >
                                            {seg.segment_name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Agent List */}
                    <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-2 custom-scrollbar">
                        <p className="text-[9px] uppercase tracking-[0.2em] text-white/20 font-black mb-4 px-2">
                            Available Agents ({filteredAgents.length})
                        </p>
                        {filteredAgents.map((agent) => {
                            const isSelected = mode === "single"
                                ? selectedAgent?.id === agent.id
                                : panelAgents.find((a) => a.id === agent.id);

                            return (
                                <div
                                    key={agent.id}
                                    onClick={() => handleAgentClick(agent)}
                                    className={`group p-4 rounded-2xl border transition-all duration-300 cursor-pointer relative overflow-hidden ${isSelected
                                        ? "bg-purple-600/10 border-purple-500/50 ring-1 ring-purple-500/20"
                                        : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10"
                                        }`}
                                >
                                    {isSelected && <div className="absolute top-0 left-0 w-1 h-full bg-purple-500" />}

                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className={`text-sm font-bold transition-colors ${isSelected ? "text-white" : "text-white/80 group-hover:text-white"}`}>{agent.displayName}</p>
                                            <p className="text-[10px] text-white/30 font-medium group-hover:text-white/40">{agent.archetype}</p>
                                        </div>
                                        <div className={`w-2 h-2 rounded-full mt-1.5 shadow-[0_0_8px_rgba(0,0,0,0.5)] ${agent.state === "ADOPTED" ? "bg-emerald-500 shadow-emerald-500/20" : agent.state === "REJECTED" ? "bg-rose-500 shadow-rose-500/20" : "bg-white/20"}`} />
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className={`text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-md ${agent.state === "ADOPTED" ? "bg-emerald-500/10 text-emerald-400" : agent.state === "REJECTED" ? "bg-rose-500/10 text-rose-400" : "bg-white/5 text-white/30"}`}>
                                            {agent.state}
                                        </span>
                                        <span className="text-[10px] text-white/20 font-mono">Inf: <span className="text-white/40">{agent.influence}/10</span></span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Selection Summary (for Panel) */}
                    {mode === "panel" && panelAgents.length > 0 && (
                        <div className="p-6 border-t border-white/5 bg-purple-600/5">
                            <p className="text-[9px] uppercase tracking-widest text-purple-400/60 font-black mb-3">
                                Panel: {panelAgents.length} Personas
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                                {panelAgents.map((a) => (
                                    <span key={a.id} className="text-[9px] px-2 py-1 bg-purple-600/20 text-purple-300 rounded-lg border border-purple-500/20 font-bold">
                                        {a.displayName}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── CENTER: Chat Area ── */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#0C0C0E]">
                    {/* Header */}
                    <div className="px-8 py-6 border-b border-white/5 bg-black/40 flex items-center justify-between">
                        {mode === "single" && selectedAgent ? (
                            <div className="flex items-center gap-4 animate-in slide-in-from-left-4 duration-500">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center text-xl shadow-inner">
                                    {selectedAgent.name[0]}
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white tracking-tight">{selectedAgent.displayName}</h2>
                                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-[0.2em]">{selectedAgent.archetype} &middot; <span className={selectedAgent.state === "ADOPTED" ? "text-emerald-400/60" : "text-rose-400/60"}>{selectedAgent.segmentName}</span></p>
                                </div>
                            </div>
                        ) : mode === "panel" ? (
                            <div className="flex items-center gap-4 animate-in slide-in-from-left-4 duration-500">
                                <div className="flex -space-x-3">
                                    {panelAgents.slice(0, 3).map((a, i) => (
                                        <div key={i} className="w-10 h-10 rounded-xl bg-purple-600 border-2 border-[#0F0F12] flex items-center justify-center text-[10px] font-black text-white shadow-xl">
                                            {a.name[0]}
                                        </div>
                                    ))}
                                    {panelAgents.length > 3 && (
                                        <div className="w-10 h-10 rounded-xl bg-white/5 border-2 border-[#0F0F12] flex items-center justify-center text-[10px] font-black text-white/40 backdrop-blur-md">
                                            +{panelAgents.length - 3}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white tracking-tight">Panel Discussion</h2>
                                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-[0.2em]">{panelAgents.length} personas listening &middot; Collective intelligence</p>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <h2 className="text-lg font-bold text-white/20 tracking-tight">Interrogation Lab</h2>
                                <p className="text-[10px] text-white/10 font-bold uppercase tracking-[0.2em]">Select an agent to begin the interview</p>
                            </div>
                        )}
                    </div>

                    {/* Messages Window */}
                    <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8 custom-scrollbar">
                        {currentHistory.length === 0 && !isLoading && (
                            <div className="h-full flex flex-col items-center justify-center text-center max-w-lg mx-auto">
                                <div className="w-20 h-20 rounded-[2rem] bg-white/[0.02] border border-white/5 flex items-center justify-center text-4xl mb-8 animate-pulse text-white/10">💬</div>
                                <h3 className="text-xl font-bold text-white/80 mb-4 tracking-tight">Start the Conversation</h3>
                                <p className="text-white/30 text-sm leading-relaxed mb-10 font-medium italic">
                                    {mode === "single"
                                        ? "Direct 1:1 interaction with a persona to understand their deep psychological barriers and motivations."
                                        : "Ask a question to multiple personas simultaneously. Watch how different demographic segments react to the same prompt."
                                    }
                                </p>
                                <div className="grid grid-cols-2 gap-3 w-full">
                                    {SUGGESTED_QUESTIONS.map((q, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setInputValue(q)}
                                            className="text-[11px] text-left px-5 py-4 bg-white/[0.03] border border-white/10 rounded-2xl text-white/40 hover:text-white hover:bg-white/10 hover:border-purple-500/30 transition-all duration-300 font-medium leading-normal"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {currentHistory.map((msg, i) => {
                            if (msg.sender === "user") {
                                return (
                                    <div key={i} className="flex justify-end animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="max-w-[70%] bg-purple-600/20 border border-purple-500/30 rounded-3xl rounded-br-none px-6 py-4 shadow-2xl shadow-purple-500/5">
                                            <p className="text-sm text-white/90 leading-relaxed font-medium">{msg.text}</p>
                                        </div>
                                    </div>
                                );
                            }
                            if (msg.sender === "ai") {
                                return (
                                    <div key={i} className="flex justify-start animate-in fade-in slide-in-from-bottom-4 duration-500">
                                        <div className="max-w-[85%] space-y-2">
                                            <div className="flex items-center gap-2 px-1">
                                                <div className="w-1.5 h-1.5 rounded-full bg-purple-400/60" />
                                                <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">{msg.senderName}</p>
                                            </div>
                                            <div className="bg-white/[0.05] border border-white/10 rounded-3xl rounded-bl-none px-6 py-4 backdrop-blur-md">
                                                <p className="text-sm text-white/80 leading-relaxed">{msg.text}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            if (msg.sender === "panel") {
                                return (
                                    <div key={i} className="space-y-6">
                                        {msg.replies?.map((r, j) => (
                                            <div key={j} className="flex justify-start animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${j * 150}ms` }}>
                                                <div className="max-w-[85%] space-y-2">
                                                    <div className="flex items-center gap-2 px-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400/60" />
                                                        <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">{r.name}</p>
                                                    </div>
                                                    <div className="bg-white/[0.04] border border-white/10 rounded-3xl rounded-bl-none px-6 py-4 backdrop-blur-md">
                                                        <p className="text-sm text-white/80 leading-relaxed">{r.reply}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            }
                            return null;
                        })}

                        {isLoading && (
                            <div className="flex justify-start animate-in fade-in duration-300">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 px-1">
                                        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                                        <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em]">Synthesizing Response...</p>
                                    </div>
                                    <div className="bg-white/[0.03] border border-white/10 rounded-3xl px-6 py-5 flex gap-1.5 items-center justify-center w-24">
                                        <div className="w-1.5 h-1.5 bg-purple-500/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                        <div className="w-1.5 h-1.5 bg-purple-500/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                        <div className="w-1.5 h-1.5 bg-purple-500/50 rounded-full animate-bounce" />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input */}
                    <div className="p-8 border-t border-white/5 bg-black/40">
                        <div className="max-w-4xl mx-auto flex gap-4">
                            <div className="flex-1 relative group">
                                <textarea
                                    rows={1}
                                    value={inputValue}
                                    onChange={(e) => {
                                        setInputValue(e.target.value);
                                        e.target.style.height = 'auto';
                                        e.target.style.height = e.target.scrollHeight + 'px';
                                    }}
                                    onKeyDown={handleKeyDown}
                                    placeholder={mode === "single" ? (selectedAgent ? `Ask ${selectedAgent.name} anything...` : "Select an agent...") : "Ask the panel a question..."}
                                    disabled={isLoading || (mode === "single" && !selectedAgent) || (mode === "panel" && panelAgents.length === 0)}
                                    className="w-full bg-white/[0.05] border border-white/10 rounded-2xl px-6 py-4 pr-12 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.08] transition-all disabled:opacity-30 custom-scrollbar resize-none max-h-32"
                                />
                            </div>
                            <button
                                onClick={handleSend}
                                disabled={isLoading || !inputValue.trim()}
                                className="w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-600/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-20 disabled:scale-100 disabled:shadow-none shrink-0"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                        <p className="text-center text-[9px] text-white/10 uppercase tracking-[0.3em] mt-6 font-black">
                            Neural Simulation Engine &middot; Real-time Synthesis
                        </p>
                    </div>
                </div>

                {/* ── RIGHT: Profile Sidebar (Single Mode) ── */}
                {mode === "single" && selectedAgent && (
                    <div className="w-[300px] shrink-0 border-l border-white/5 bg-black/40 overflow-y-auto p-6 hidden xl:flex flex-col custom-scrollbar animate-in slide-in-from-right-4 duration-500">
                        <div className="mb-8">
                            <p className="text-[9px] uppercase tracking-[0.2em] text-white/20 font-black mb-6">Neural Signature</p>
                            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-white/10 flex items-center justify-center text-3xl mb-4 group hover:scale-105 transition-transform duration-500">
                                {selectedAgent.name[0]}
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">{selectedAgent.displayName}</h3>
                            <div className="flex flex-wrap gap-2">
                                <span className="px-2 py-0.5 rounded-lg bg-white/5 text-[9px] text-white/50 uppercase tracking-widest font-black border border-white/5">{selectedAgent.archetype}</span>
                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black tracking-widest uppercase border ${selectedAgent.state === "ADOPTED" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : selectedAgent.state === "REJECTED" ? "bg-rose-500/10 text-rose-400 border-rose-500/20" : "bg-white/5 text-white/30 border-white/10"}`}>
                                    {selectedAgent.state}
                                </span>
                            </div>
                        </div>

                        {/* Traits */}
                        <div className="space-y-6 mb-10">
                            <div>
                                <div className="flex justify-between text-[10px] mb-2">
                                    <span className="text-white/30 uppercase tracking-[0.1em] font-bold text-[9px]">Influence</span>
                                    <span className="text-purple-400 font-bold">{selectedAgent.influence}/10</span>
                                </div>
                                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-purple-500 rounded-full" style={{ width: `${selectedAgent.influence * 10}%` }} />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] mb-2">
                                    <span className="text-white/30 uppercase tracking-[0.1em] font-bold text-[9px]">Decision Confidence</span>
                                    <span className="text-blue-400 font-bold">8/10</span>
                                </div>
                                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `80%` }} />
                                </div>
                            </div>
                        </div>

                        {/* Capital */}
                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 mb-8">
                            <p className="text-[9px] uppercase tracking-[0.2em] text-white/20 font-black mb-2">Disposable Capital</p>
                            <p className="text-2xl font-black italic text-white/90 font-mono tracking-tighter">${selectedAgent.metadata?.capital || "4,200"}</p>
                        </div>

                        {/* Metadata Bits */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Region</span>
                                <span className="text-[11px] text-white/80 font-medium">{selectedAgent.metadata?.state || "Unknown"}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Occupation</span>
                                <span className="text-[11px] text-white/80 font-medium">{selectedAgent.metadata?.occupation || "Professional"}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-white/5">
                                <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Age</span>
                                <span className="text-[11px] text-white/80 font-medium">{selectedAgent.age || "N/A"}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
