"use client";

import { useState, useRef, useEffect } from "react";
import API_BASE_URL from "../../lib/apiConfig";
import Button from "../components/ui/Button";

const SUGGESTED_QUESTIONS = [
    "Why did you reject this product?",
    "What confused you about the value proposition?",
    "Would you pay for this? Why or why not?",
    "What feature would make you reconsider?",
    "Would you recommend this to others in your network?",
    "What was the biggest risk you saw?",
];

export default function AgentChatPanel({ agents }) {
    // Chat mode: 'single' or 'panel'
    const [mode, setMode] = useState("single");

    // Single chat state
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [conversations, setConversations] = useState({}); // { agentId: [{role, content}] }
    const [inputValue, setInputValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Panel discussion state
    const [panelAgents, setPanelAgents] = useState([]);
    const [panelMessages, setPanelMessages] = useState([]); // [{role, content, replies?}]

    const chatEndRef = useRef(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [conversations, panelMessages]);

    // ───────── SINGLE AGENT CHAT ─────────
    const sendSingleMessage = async (message) => {
        if (!selectedAgent || !message.trim()) return;

        const agentId = selectedAgent.id;
        const history = conversations[agentId] || [];
        const updatedHistory = [...history, { role: "user", content: message }];

        setConversations((prev) => ({ ...prev, [agentId]: updatedHistory }));
        setInputValue("");
        setIsLoading(true);

        try {
            const res = await fetch(`${API_BASE_URL}/api/agent-chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    agent: selectedAgent,
                    userMessage: message,
                    conversationHistory: updatedHistory,
                }),
            });

            const data = await res.json();
            const agentReply = data.reply || "...";

            setConversations((prev) => ({
                ...prev,
                [agentId]: [
                    ...prev[agentId],
                    { role: "agent", content: agentReply, name: selectedAgent.name },
                ],
            }));
        } catch {
            setConversations((prev) => ({
                ...prev,
                [agentId]: [
                    ...prev[agentId],
                    { role: "agent", content: "Connection lost. Agent unresponsive.", name: selectedAgent.name },
                ],
            }));
        } finally {
            setIsLoading(false);
        }
    };

    // ───────── PANEL DISCUSSION ─────────
    const togglePanelAgent = (agent) => {
        setPanelAgents((prev) =>
            prev.find((a) => a.id === agent.id)
                ? prev.filter((a) => a.id !== agent.id)
                : [...prev, agent]
        );
    };

    const sendPanelMessage = async (message) => {
        if (panelAgents.length === 0 || !message.trim()) return;

        const newMessages = [...panelMessages, { role: "user", content: message }];
        setPanelMessages(newMessages);
        setInputValue("");
        setIsLoading(true);

        try {
            const res = await fetch(`${API_BASE_URL}/api/agent-chat/panel`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agents: panelAgents, userMessage: message }),
            });

            const data = await res.json();
            const replies = data.replies || [];

            setPanelMessages((prev) => [
                ...prev,
                { role: "panel", replies },
            ]);
        } catch {
            setPanelMessages((prev) => [
                ...prev,
                { role: "panel", replies: [{ name: "System", reply: "Panel discussion failed. Try again." }] },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSend = () => {
        if (mode === "single") sendSingleMessage(inputValue);
        else sendPanelMessage(inputValue);
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
        <div className="mt-12 bg-white/[0.02] border border-white/10 rounded-3xl overflow-hidden" style={{ height: "700px" }}>
            <div className="flex h-full">
                {/* ── LEFT: Agent List ── */}
                <div className="w-72 border-r border-white/5 flex flex-col shrink-0 bg-black/20">
                    {/* Mode Toggle */}
                    <div className="p-4 border-b border-white/5">
                        <div className="flex bg-white/5 rounded-lg p-1">
                            <button
                                onClick={() => setMode("single")}
                                className={`flex-1 text-[10px] uppercase tracking-widest font-bold py-2 rounded-md transition-all ${mode === "single" ? "bg-purple-500/20 text-purple-400" : "text-white/40 hover:text-white/60"}`}
                            >
                                1:1 Interview
                            </button>
                            <button
                                onClick={() => setMode("panel")}
                                className={`flex-1 text-[10px] uppercase tracking-widest font-bold py-2 rounded-md transition-all ${mode === "panel" ? "bg-blue-500/20 text-blue-400" : "text-white/40 hover:text-white/60"}`}
                            >
                                Panel
                            </button>
                        </div>
                    </div>

                    {/* Agent Cards */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                        <p className="text-[11px] uppercase tracking-widest text-white/30 font-bold mb-2 ml-1">
                            Personas ({agents.length})
                        </p>
                        {agents.map((agent) => {
                            const isSelected = mode === "single"
                                ? selectedAgent?.id === agent.id
                                : panelAgents.find((a) => a.id === agent.id);

                            return (
                                <div
                                    key={agent.id}
                                    onClick={() => {
                                        if (mode === "single") setSelectedAgent(agent);
                                        else togglePanelAgent(agent);
                                    }}
                                    className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 ${isSelected
                                        ? "bg-purple-500/10 border-purple-500/30"
                                        : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10"
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <p className="text-sm font-medium text-white/90">{agent.name}</p>
                                            <p className="text-[10px] text-white/40">{agent.archetype}</p>
                                        </div>
                                        <div className={`w-2 h-2 rounded-full mt-1 ${agent.state === "adopted" ? "bg-emerald-500" : agent.state === "rejected" ? "bg-rose-500" : agent.state === "churned" ? "bg-amber-500" : "bg-white/20"}`} />
                                    </div>
                                    <div className="flex items-center gap-3 text-[10px] text-white/30">
                                        <span className={`uppercase font-bold ${agent.state === "adopted" ? "text-emerald-400/70" : agent.state === "rejected" ? "text-rose-400/70" : "text-white/40"}`}>
                                            {agent.state}
                                        </span>
                                        <span>Inf: {agent.influence}/10</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {mode === "panel" && panelAgents.length > 0 && (
                        <div className="p-3 border-t border-white/5">
                            <p className="text-[11px] uppercase tracking-widest text-blue-400/60 font-bold mb-1">
                                Panel: {panelAgents.length} selected
                            </p>
                            <div className="flex flex-wrap gap-1">
                                {panelAgents.map((a) => (
                                    <span key={a.id} className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-300 rounded border border-blue-500/20">
                                        {a.name}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ── CENTER: Chat Area ── */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Chat Header */}
                    <div className="px-6 py-4 border-b border-white/5 bg-black/20 shrink-0">
                        {mode === "single" && selectedAgent ? (
                            <div>
                                <p className="text-sm font-medium text-white">Talking to: <span className="text-purple-400">{selectedAgent.name}</span></p>
                                <p className="text-[10px] text-white/40">{selectedAgent.archetype} Persona &middot; Simulation Participant</p>
                            </div>
                        ) : mode === "panel" ? (
                            <div>
                                <p className="text-sm font-medium text-white">Panel Discussion</p>
                                <p className="text-[10px] text-white/40">{panelAgents.length} personas selected &middot; Sequential responses</p>
                            </div>
                        ) : (
                            <p className="text-sm text-white/40">Select a persona to begin the interview</p>
                        )}
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 custom-scrollbar">
                        {currentHistory.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-center">
                                <div className="text-4xl mb-4 opacity-20">💬</div>
                                <p className="text-white/30 text-sm mb-6">
                                    {mode === "single"
                                        ? "Start by asking a question to the selected persona"
                                        : "Select personas from the list and ask the panel a question"
                                    }
                                </p>
                                {/* Suggested Questions */}
                                <div className="flex flex-wrap gap-2 max-w-md justify-center">
                                    {SUGGESTED_QUESTIONS.slice(0, 4).map((q, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                setInputValue(q);
                                            }}
                                            className="text-[11px] px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/10 hover:border-white/20 transition-all"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {currentHistory.map((msg, i) => {
                            if (msg.role === "user") {
                                return (
                                    <div key={i} className="flex justify-end">
                                        <div className="max-w-[70%] bg-purple-500/15 border border-purple-500/20 rounded-2xl rounded-br-md px-4 py-3">
                                            <p className="text-sm text-white/90">{msg.content}</p>
                                        </div>
                                    </div>
                                );
                            }
                            if (msg.role === "agent") {
                                return (
                                    <div key={i} className="flex justify-start">
                                        <div className="max-w-[75%] bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-4 py-3">
                                            <p className="text-[10px] text-purple-400/70 font-bold uppercase tracking-widest mb-1">{msg.name}</p>
                                            <p className="text-sm text-white/80 leading-relaxed">{msg.content}</p>
                                        </div>
                                    </div>
                                );
                            }
                            if (msg.role === "panel") {
                                return (
                                    <div key={i} className="space-y-3">
                                        {msg.replies?.map((r, j) => (
                                            <div key={j} className="flex justify-start">
                                                <div className="max-w-[75%] bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-4 py-3">
                                                    <p className="text-[10px] text-blue-400/70 font-bold uppercase tracking-widest mb-1">{r.name}</p>
                                                    <p className="text-sm text-white/80 leading-relaxed">{r.reply}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            }
                            return null;
                        })}

                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-4 py-3">
                                    <div className="flex gap-1.5">
                                        <div className="w-2 h-2 bg-purple-500/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                                        <div className="w-2 h-2 bg-purple-500/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                                        <div className="w-2 h-2 bg-purple-500/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                                    </div>
                                </div>
                            </div>
                        )}

                        <div ref={chatEndRef} />
                    </div>

                    {/* Input Box */}
                    <div className="p-4 border-t border-white/5 bg-black/20 shrink-0">
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={mode === "single" ? "Ask this persona anything..." : "Ask the panel a question..."}
                                disabled={isLoading || (mode === "single" && !selectedAgent) || (mode === "panel" && panelAgents.length === 0)}
                                className="flex-1 bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/50 transition-all disabled:opacity-30"
                            />
                            <Button
                                onClick={handleSend}
                                disabled={isLoading || !inputValue.trim()}
                                showArrow={!isLoading && inputValue.trim().length > 0}
                                size="md"
                            >
                                Send
                            </Button>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT: Agent Profile Sidebar ── */}
                {mode === "single" && selectedAgent && (
                    <div className="w-72 border-l border-white/5 bg-black/20 overflow-y-auto p-5 shrink-0 custom-scrollbar hidden lg:block">
                        <div className="mb-6">
                            <h3 className="text-lg font-medium text-white mb-1">{selectedAgent.name}</h3>
                            <span className="px-2 py-0.5 rounded bg-white/10 text-[10px] text-white/70 uppercase tracking-wider">{selectedAgent.archetype}</span>
                            <span className={`ml-2 text-[10px] uppercase font-bold tracking-widest ${selectedAgent.state === "adopted" ? "text-emerald-400" : selectedAgent.state === "rejected" ? "text-rose-400" : "text-amber-400"}`}>
                                {selectedAgent.state}
                            </span>
                        </div>

                        {/* Neural Traits */}
                        <div className="mb-6">
                            <p className="text-[11px] uppercase tracking-widest text-white/40 font-bold mb-3">Neural Traits</p>
                            <div className="space-y-2">
                                {[
                                    { label: "Risk Tolerance", value: selectedAgent.riskTolerance, color: "bg-rose-500" },
                                    { label: "Influence", value: selectedAgent.influence, color: "bg-blue-500" },
                                    { label: "Tech Skill", value: selectedAgent.skills?.tech || 5, color: "bg-emerald-500" },
                                ].map((trait) => (
                                    <div key={trait.label}>
                                        <div className="flex justify-between text-[10px] mb-1">
                                            <span className="text-white/50">{trait.label}</span>
                                            <span className="text-white/80 font-mono">{trait.value}/10</span>
                                        </div>
                                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                            <div className={`h-full ${trait.color} rounded-full`} style={{ width: `${trait.value * 10}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Capital */}
                        <div className="mb-6">
                            <p className="text-[11px] uppercase tracking-widest text-white/40 font-bold mb-2">Capital</p>
                            <p className="text-xl font-mono text-white/90">${selectedAgent.capital}</p>
                        </div>

                        {/* Biases */}
                        {selectedAgent.biases?.length > 0 && (
                            <div className="mb-6">
                                <p className="text-[11px] uppercase tracking-widest text-white/40 font-bold mb-2">Cognitive Biases</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {selectedAgent.biases.map((b, i) => (
                                        <span key={i} className="text-[10px] px-2 py-1 bg-rose-500/10 text-rose-300 rounded border border-rose-500/20">{b}</span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Simulation Timeline */}
                        <div>
                            <p className="text-[11px] uppercase tracking-widest text-white/40 font-bold mb-3">Simulation Events</p>
                            <div className="space-y-2">
                                {(selectedAgent.knowledge || []).map((k, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                                        <p className="text-[11px] text-white/60 leading-relaxed">{k}</p>
                                    </div>
                                ))}
                                {(!selectedAgent.knowledge || selectedAgent.knowledge.length === 0) && (
                                    <p className="text-[11px] text-white/30 italic">No events logged.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
