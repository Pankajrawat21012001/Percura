"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { useIdea } from "../context/IdeaContext";
import { useAuth } from "../context/AuthContext";
import API_BASE_URL from "../lib/apiConfig";

export default function ChatPanel({ onClose }) {
    const { currentSimulationId, simulationResults, idea } = useIdea();
    const { user } = useAuth();

    // Target can be an array of IDs: ["all"] or ["seg1", "seg2", ...]
    const [selectedTargets, setSelectedTargets] = useState(["all"]);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [rateLimitCounter, setRateLimitCounter] = useState(0);
    const [isBlocked, setIsBlocked] = useState(false);
    const [blockTimeRemaining, setBlockTimeRemaining] = useState(0);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // Derived Firestore ID (deterministic)
    const chatInstanceId = [...selectedTargets].sort().join("_");

    const messagesEndRef = useRef(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (!currentSimulationId || !chatInstanceId) return;

        const q = query(
            collection(db, "simulations", currentSimulationId, "chats", chatInstanceId, "messages"),
            orderBy("timestamp", "asc")
        );

        const unsubscribe = onSnapshot(q,
            (snapshot) => {
                const msgs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setMessages(msgs);
                scrollToBottom();
            },
            (err) => {
                console.error("[FIRESTORE] Chat listener failed:", err.message);
                if (err.message.includes("permissions")) {
                    setMessages([{
                        text: "⚠️ Firestore access denied. Chat history might not persist, but internal simulation logic will stay active.",
                        sender: "system",
                        senderName: "System",
                        timestamp: { toDate: () => new Date() }
                    }]);
                }
            }
        );

        return () => unsubscribe();
    }, [currentSimulationId, chatInstanceId]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading || isBlocked) return;

        // Rate limiting logic
        if (rateLimitCounter >= 10) {
            startBlock();
            return;
        }

        const userMsg = input.trim();
        const currentMessages = [...messages, { text: userMsg, sender: "user" }];

        setInput("");
        setLoading(true);
        setRateLimitCounter(prev => prev + 1);

        try {
            // Attempt to save user message to Firestore
            try {
                await addDoc(collection(db, "simulations", currentSimulationId, "chats", chatInstanceId, "messages"), {
                    text: userMsg,
                    sender: "user",
                    senderName: user?.displayName || user?.email?.split('@')[0] || "Founder",
                    timestamp: serverTimestamp()
                });
            } catch (dbErr) {
                console.warn("[CHAT] Persistence failed, using local-only mode:", dbErr.message);
                if (messages.length > 0 && messages[messages.length - 1].text !== userMsg) {
                    setMessages(prev => [...prev, {
                        text: userMsg,
                        sender: "user",
                        senderName: "Founder",
                        timestamp: { toDate: () => new Date() }
                    }]);
                }
            }

            console.log(`[CHAT] Sending message to targets: ${selectedTargets.join(", ")}`);

            // Call backend for AI response
            const response = await fetch(`${API_BASE_URL}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    simulationId: currentSimulationId,
                    target: selectedTargets,
                    message: userMsg,
                    history: currentMessages.slice(-6),
                    context: { idea, simulationResults }
                })
            });

            const data = await response.json();

            // Extract reply text - handle both single and panel responses
            let responseText = "";
            let aiName = "Audience";

            if (data.replies && Array.isArray(data.replies)) {
                // For panel responses in the mini-chat, we join them or just show they are discussing
                responseText = data.replies.map(r => `${r.name}: ${r.reply}`).join("\n\n");
                aiName = "Panel Discussion";
            } else if (data.reply) {
                responseText = data.reply;
                aiName = data.name || (selectedTargets.includes("all") ? "Collective Response" : "Persona");
            }

            if (responseText) {
                console.log(`[CHAT] Received response from AI: ${responseText.substring(0, 50)}...`);

                // Attempt to save AI message to Firestore
                try {
                    await addDoc(collection(db, "simulations", currentSimulationId, "chats", chatInstanceId, "messages"), {
                        text: responseText,
                        sender: "ai",
                        senderName: aiName,
                        timestamp: serverTimestamp()
                    });
                } catch (dbErr) {
                    setMessages(prev => [...prev, {
                        text: responseText,
                        sender: "ai",
                        senderName: aiName,
                        timestamp: { toDate: () => new Date() }
                    }]);
                }
            } else {
                throw new Error(data.error || "No response text received from neural engine");
            }

        } catch (err) {
            console.error("Chat error:", err);
            // Show error message in chat for user
            setMessages(prev => [...prev, {
                text: "⚠️ System: " + (err.message || "Failed to get AI response. Check your connection."),
                sender: "system",
                senderName: "System",
                timestamp: { toDate: () => new Date() }
            }]);
        } finally {
            setLoading(false);
        }
    };

    const startBlock = () => {
        setIsBlocked(true);
        setBlockTimeRemaining(10);
        const interval = setInterval(() => {
            setBlockTimeRemaining(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    setIsBlocked(false);
                    setRateLimitCounter(0);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    };

    // Build targets with simulation state indicators where available
    const targets = [
        { id: "all", name: "Collective Audience", simState: null },
        ...(simulationResults || []).flatMap(r => {
            const segTarget = { id: r.segment_id, name: r.segment_name, simState: null };
            // Also expose individual enriched personas from each segment
            const personaTargets = (r.personas || [])
                .filter(p => p.enrichedProfile)
                .map(p => {
                    const pid = p.persona_id || p.id;
                    const ep = p.enrichedProfile;
                    const ss = p.simulationState || ep?.memoryState || {};
                    return {
                        id: pid,
                        name: ep.fullName || p.metadata?.name || `Persona ${pid}`,
                        simState: {
                            converted: ss.converted || false,
                            churned: ss.churned || false,
                            sentimentScore: ss.sentimentScore !== undefined ? ss.sentimentScore : (ep?.memoryState?.sentimentScore || 0.5)
                        }
                    };
                });
            return [segTarget, ...personaTargets];
        })
    ];

    if (!currentSimulationId) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-white/20">
                <svg className="w-16 h-16 mb-6 opacity-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                <p className="text-sm italic">Select a simulation to start chatting with personas</p>
            </div>
        );
    }

    const toggleTarget = (id) => {
        if (id === "all") {
            setSelectedTargets(["all"]);
            setIsDropdownOpen(false); // Close if selecting all
        } else {
            let next = selectedTargets.filter(t => t !== "all");
            if (next.includes(id)) {
                next = next.filter(t => t !== id);
                if (next.length === 0) {
                    next = ["all"];
                    setIsDropdownOpen(false);
                }
            } else {
                next.push(id);
            }
            setSelectedTargets(next);
        }
    };

    const currentTargetName = selectedTargets.includes("all")
        ? "Collective Audience"
        : selectedTargets.length === 1
            ? (targets.find(t => t.id === selectedTargets[0])?.name || "Audience")
            : `Collective (${selectedTargets.length} Segments)`;

    return (
        <div className="flex flex-col h-full bg-[#0D0D0D] border-l border-white/5 shadow-2xl relative">
            {/* Header - High Z-Index to stay on top of messages */}
            <div className="p-6 border-b border-white/5 bg-black/40 backdrop-blur-xl relative z-50">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-[11px] uppercase tracking-[0.4em] text-white/40 font-black">Audience Dialogue</h2>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 rounded-xl hover:bg-white/10 text-white/30 transition-all"
                        title="Close Dialogue"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <button
                    onClick={() => {
                        // We need a way to trigger the full screen view from here.
                        // Since they are siblings or shared via state, I'll assume 
                        // the user will prefer the button in the main page, 
                        // but I can add a hint here.
                        window.dispatchEvent(new CustomEvent('open-interrogation'));
                        onClose();
                    }}
                    className="w-full mb-6 py-3 bg-purple-600/20 border border-purple-500/30 rounded-2xl text-[11px] uppercase tracking-widest font-black text-purple-400 hover:bg-purple-600/30 transition-all flex items-center justify-center gap-2"
                >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                    Expand to Full View
                </button>

                {/* Premium Custom Dropdown */}
                <div className="relative group z-50" ref={dropdownRef}>
                    <div
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsDropdownOpen(!isDropdownOpen);
                        }}
                        className={`
                            relative w-full bg-white/[0.03] border rounded-2xl px-5 py-4 text-[13px] font-medium transition-all cursor-pointer flex justify-between items-center
                            ${isDropdownOpen ? "border-purple-500/50 bg-white/[0.06] ring-1 ring-purple-500/10" : "border-white/10 hover:border-white/20 hover:bg-white/[0.05]"}
                        `}
                    >
                        <span className="text-white/80">{currentTargetName}</span>
                        <svg
                            className={`w-4 h-4 text-white/20 transition-transform duration-300 ${isDropdownOpen ? "rotate-180" : ""}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>

                    {isDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-2 py-2 bg-[#121212] border border-white/15 rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.9)] backdrop-blur-3xl animate-in fade-in zoom-in duration-200 origin-top z-[200]">
                            {targets.map(t => {
                                const isSelected = selectedTargets.includes(t.id);
                                return (
                                    <div
                                        key={t.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleTarget(t.id);
                                        }}
                                        className={`
                                            px-5 py-3.5 text-[12px] cursor-pointer transition-all relative z-[210] flex items-center justify-between group/item
                                            ${isSelected ? "text-purple-400 bg-purple-500/5 font-bold" : "text-white/50 hover:text-white hover:bg-white/5"}
                                        `}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-4 h-4 rounded-md border transition-all flex items-center justify-center ${isSelected ? "bg-purple-500 border-purple-500" : "border-white/10 group-hover/item:border-white/30"}`}>
                                                {isSelected && (
                                                    <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </div>
                                            <span>{t.name}</span>
                                            {t.simState && (
                                                <div className="flex items-center gap-1.5 ml-auto">
                                                    <div className={`w-2 h-2 rounded-full ${t.simState.converted ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : t.simState.churned ? 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]' : 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.3)]'}`} />
                                                    <span className="text-[11px] font-mono text-white/30">{(t.simState.sentimentScore * 100).toFixed(0)}%</span>
                                                </div>
                                            )}
                                        </div>
                                        {isSelected && <div className="text-[11px] uppercase tracking-tighter opacity-40">Active</div>}
                                    </div>
                                );
                            })}
                            <div className="mt-2 px-5 py-3 border-t border-white/5 bg-black/20 text-center">
                                <button
                                    onClick={() => setIsDropdownOpen(false)}
                                    className="text-[11px] uppercase tracking-widest text-white/40 hover:text-white font-bold transition-colors"
                                >
                                    Done Selection
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Messages */}
            <div className="relative flex-1 min-h-0">
                <div className="absolute inset-0 overflow-y-auto p-6 space-y-6 custom-scrollbar flex flex-col">
                    {messages.length === 0 && (
                        <div className="bg-white/[0.02] border border-dashed border-white/10 rounded-[2.5rem] p-10 text-center animate-in fade-in zoom-in duration-700 my-auto">
                            <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-center text-xl mx-auto mb-6 text-white/40">💬</div>
                            <p className="text-[11px] uppercase tracking-widest text-white/30 mb-2 font-bold leading-relaxed">System Ready</p>
                            <p className="text-sm font-light text-white/50 leading-relaxed italic">
                                Start a dialogue with the <span className="text-white font-medium not-italic">"{currentTargetName}"</span> based on their specific demographic profile.
                            </p>
                        </div>
                    )}
                    {messages.map((m, idx) => (
                        <div key={m.id || idx} className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start underline-none"} ${m.sender === "system" ? "w-full items-center py-4" : ""}`}>
                            {m.sender !== "system" && (
                                <div className="flex items-center gap-2 mb-2 px-1">
                                    {m.sender === "ai" && <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
                                    <span className="text-[11px] uppercase tracking-widest text-white/30 font-bold">{m.senderName}</span>
                                </div>
                            )}
                            <div className={`
                                max-h-[1000px] leading-relaxed
                                ${m.sender === "user"
                                    ? "max-w-[85%] px-5 py-4 rounded-2xl bg-purple-600/20 border border-purple-500/30 text-white rounded-tr-none shadow-lg shadow-purple-500/5 text-sm"
                                    : m.sender === "system"
                                        ? "text-[11px] text-white/20 italic px-8 py-2 border-y border-white/5 w-full text-center bg-white/[0.01]"
                                        : "max-w-[85%] px-5 py-4 rounded-2xl bg-white/[0.05] border border-white/10 text-white/90 rounded-tl-none text-sm"}
                            `}>
                                {m.text}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex flex-col items-start animate-in fade-in duration-300">
                            <div className="flex items-center gap-2 mb-2 px-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                <span className="text-[11px] uppercase tracking-widest text-white/30 font-bold">Audience is thinking...</span>
                            </div>
                            <div className="bg-white/[0.05] border border-white/10 rounded-2xl rounded-tl-none px-5 py-4 flex gap-1">
                                <span className="w-1.5 h-1.5 bg-white/20 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-1.5 h-1.5 bg-white/20 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-1.5 h-1.5 bg-white/20 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} className="h-4 w-full flex-shrink-0" />
                </div>
            </div>

            {/* Input */}
            <div className="p-6 border-t border-white/5 bg-black/20">
                {isBlocked && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-center">
                        <p className="text-[11px] text-red-400 font-bold uppercase tracking-widest">
                            Rate Limit Hit. Cooling down for {blockTimeRemaining}s
                        </p>
                    </div>
                )}
                {!isBlocked && rateLimitCounter >= 3 && (
                    <p className="text-[11px] text-amber-400/60 font-medium mb-3 text-center uppercase tracking-widest">
                        Note: You are approaching the simulation rate limit
                    </p>
                )}
                <form onSubmit={handleSendMessage} className="relative group">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isBlocked ? "System blocked..." : "Ask your audience anything..."}
                        disabled={loading || isBlocked}
                        className={`
                            w-full bg-white/[0.07] border border-white/20 rounded-2xl pl-6 pr-14 py-4 text-sm transition-all
                            focus:outline-none focus:border-purple-500/50 focus:bg-white/[0.10]
                            ${isBlocked ? "opacity-30 cursor-not-allowed" : ""}
                        `}
                    />
                    <button
                        type="submit"
                        disabled={loading || isBlocked || !input.trim()}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-xl bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-20 disabled:scale-100 disabled:bg-white/10"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    </button>
                </form>
                <p className="text-[11px] text-white/20 mt-4 text-center">
                    Simulated responses based on demographic psychological profiles.
                </p>
            </div>
        </div>
    );
}
