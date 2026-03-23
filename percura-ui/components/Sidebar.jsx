"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useIdea } from "../context/IdeaContext";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

const STEPS = [
    { 
        number: 1, 
        label: "Validate Idea", 
        shortLabel: "Validate",
        path: "/validate", 
        description: "Define & test your startup concept",
        icon: (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        )
    },
    { 
        number: 2, 
        label: "Market Context", 
        shortLabel: "Context",
        path: "/context", 
        description: "Ontology & competitive landscape",
        icon: (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
        )
    },
    { 
        number: 3, 
        label: "Audience Segments", 
        shortLabel: "Segments",
        path: "/segment", 
        description: "Persona clustering & selection",
        icon: (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
        )
    },
    { 
        number: 4, 
        label: "Results & Report", 
        shortLabel: "Results",
        path: "/simulation-results", 
        description: "Simulation output & analysis",
        icon: (
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        )
    },
];

// Map pathname to step number for completion tracking
const PATH_TO_STEP = {
    "/validate": 1,
    "/context": 2,
    "/segment": 3,
    "/simulation-results": 4,
};

export default function Sidebar({ isOpen, setIsOpen, currentStep }) {
    const { user, logOut, signInWithGoogle } = useAuth();
    const { setCurrentSimulationId, currentSimulationId, setIdea, setSimulationResults, setValidation, setPersonas, setMarketContext, reset } = useIdea();
    const [history, setHistory] = useState([]);
    const [isHovered, setIsHovered] = useState(false);
    const [showChats, setShowChats] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const sidebarRef = useRef(null);
    const router = useRouter();
    const pathname = usePathname();

    // Track completed steps persistently per session
    const [completedSteps, setCompletedSteps] = useState([]);

    // Load from sessionStorage after mount to avoid hydration mismatch
    useEffect(() => {
        const stored = sessionStorage.getItem("percura_completed_steps");
        if (stored) {
            setCompletedSteps(JSON.parse(stored));
        }
    }, []);

    // Mark current step as completed whenever it changes
    useEffect(() => {
        const stepNum = PATH_TO_STEP[pathname];
        if (stepNum && !completedSteps.includes(stepNum)) {
            const updated = [...completedSteps, stepNum];
            setCompletedSteps(updated);
            if (typeof window !== "undefined") {
                sessionStorage.setItem("percura_completed_steps", JSON.stringify(updated));
            }
        }
    }, [pathname]);

    // Also mark the currentStep from props
    useEffect(() => {
        if (currentStep && !completedSteps.includes(currentStep)) {
            const updated = [...completedSteps, currentStep];
            setCompletedSteps(updated);
            if (typeof window !== "undefined") {
                sessionStorage.setItem("percura_completed_steps", JSON.stringify(updated));
            }
        }
    }, [currentStep]);

    useEffect(() => {
        if (!user) return;

        const q = query(
            collection(db, "simulations"),
            where("userId", "==", user.uid),
            orderBy("timestamp", "desc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const docs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setHistory(docs);
        });

        return () => unsubscribe();
    }, [user]);

    // Handle click outside to close mobile sidebar
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event) => {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, setIsOpen]);

    const handleSelectSimulation = (sim) => {
        // Fetch all relevant data from the simulation document
        setCurrentSimulationId(sim.id || sim.docId);
        setIdea(sim.ideaData || null);
        setSimulationResults(sim.results?.segmentsWithResults || []);
        setMarketContext(sim.results?.marketContext || null);
        setValidation({
            segments: sim.results?.segments || [],
            personas: sim.results?.personas || [],
            totalMatched: sim.results?.totalMatched || 0,
        });
        setPersonas(sim.results?.personas || []);

        // Mark all steps as accessible for past simulations before navigating
        const allSteps = [1, 2, 3, 4];
        setCompletedSteps(allSteps);
        if (typeof window !== "undefined") {
            sessionStorage.setItem("percura_completed_steps", JSON.stringify(allSteps));
        }

        router.push("/simulation-results");
        if (window.innerWidth < 1024) setIsOpen(false);
    };

    const handleDeleteSimulation = async (e, simId) => {
        e.stopPropagation();
        setDeletingId(simId);
        try {
            await deleteDoc(doc(db, "simulations", simId));
            if (currentSimulationId === simId) {
                setCurrentSimulationId(null);
            }
        } catch (err) {
            console.error("Failed to delete simulation:", err);
        } finally {
            setDeletingId(null);
        }
    };

    const handleNewSimulation = () => {
        // Reset all idea/simulation state in context
        reset();
        // Clear completed steps so the flow starts fresh
        setCompletedSteps([]);
        if (typeof window !== "undefined") {
            sessionStorage.removeItem("percura_completed_steps");
        }
        router.push("/validate");
        if (window.innerWidth < 1024) setIsOpen(false);
    };

    const isExpanded = isOpen || isHovered;

    // Only show recent 5 chats
    const recentHistory = history.slice(0, 5);

    return (
        <>
            {/* Backdrop for Mobile */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[65] lg:hidden animate-in fade-in duration-300" 
                    onClick={() => setIsOpen(false)}
                />
            )}

            <aside 
                ref={sidebarRef}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => { setIsHovered(false); setShowChats(false); }}
                className={`
                    fixed top-0 left-0 h-full bg-white border-r border-black/[0.06] z-[70] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
                    ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
                    ${isExpanded ? "w-72" : "w-72 lg:w-[72px]"}
                    flex flex-col
                `}
            >
                {/* Brand Header */}
                <div className={`h-20 flex items-center border-b border-black/[0.06] ${isExpanded ? 'px-6 justify-between' : 'px-0 justify-center'}`}>
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="w-10 h-10 rounded-xl bg-white border border-black/[0.08] flex items-center justify-center shadow-sm group-hover:shadow-md group-hover:scale-105 group-active:scale-95 transition-all duration-300 shrink-0 overflow-hidden">
                            <Image
                                src="/percura-icon.png"
                                alt="Percura"
                                width={28}
                                height={28}
                                className="object-contain"
                            />
                        </div>
                        <span className={`text-lg font-bold tracking-tight text-[#1a1a1a] transition-all duration-300 ${isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`} style={{ fontFamily: "var(--font-serif)" }}>
                            Percura
                        </span>
                    </Link>
                    <button onClick={() => setIsOpen(false)} className="lg:hidden p-1.5 text-black/30 hover:text-[#1a1a1a] rounded-lg hover:bg-black/5">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* New Simulation Button */}
                <div className={`py-4 flex justify-center ${isExpanded ? 'px-3' : 'px-4'}`}>
                    <button
                        onClick={handleNewSimulation}
                        title={!isExpanded ? "New Simulation" : undefined}
                        className={`
                            flex items-center transition-all duration-300 group
                            bg-[#1A1A1A] hover:bg-[#333] text-white
                            rounded-xl shadow-sm hover:shadow-md
                            ${isExpanded ? 'w-full p-3 gap-3 justify-start' : 'w-10 h-10 p-0 gap-0 justify-center'}
                        `}
                    >
                        <div className={`flex items-center justify-center rounded-lg bg-white/15 shrink-0 group-hover:scale-110 transition-transform ${isExpanded ? 'w-7 h-7' : 'w-10 h-10'}`}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </div>
                        <span className={`text-[13px] font-semibold whitespace-nowrap transition-all duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
                            New Simulation
                        </span>
                    </button>
                </div>

                {/* Navigation Steps */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                    <nav className={`py-4 space-y-1 ${isExpanded ? 'px-3' : 'px-4'}`}>
                        {STEPS.map((step, idx) => {
                            const stepNum = step.number;
                            const currentStepNum = PATH_TO_STEP[pathname] || 1;
                            const isActive = pathname === step.path;
                            const isDone = completedSteps.includes(stepNum) && !isActive;
                            // A step is accessible if it's the current one, any previous one, or already completed
                            const isAccessible = stepNum <= currentStepNum || completedSteps.includes(stepNum);

                            return (
                                <button
                                    key={step.number}
                                    onClick={() => isAccessible && router.push(step.path)}
                                    disabled={!isAccessible}
                                    title={!isExpanded ? step.label : undefined}
                                    className={`
                                        w-full flex items-center transition-all duration-300 group relative
                                        ${isExpanded ? 'p-3 gap-3 rounded-xl' : 'p-0 gap-0 h-10 rounded-xl justify-center'}
                                        ${isActive 
                                            ? "bg-[#1A1A1A] text-white shadow-sm" 
                                            : isDone 
                                                ? "text-[#1a1a1a] hover:bg-black/[0.04] cursor-pointer" 
                                                : isAccessible
                                                    ? "text-black/75 hover:bg-black/[0.03] hover:text-black/90 cursor-pointer"
                                                    : "text-black/15 cursor-not-allowed"}
                                    `}
                                >
                                    {/* Step Icon with status indicator */}
                                    <div className={`
                                        relative w-9 h-9 flex items-center justify-center rounded-lg shrink-0 transition-all duration-300
                                        ${isActive ? "bg-white/15 text-white" : 
                                          isDone ? "bg-[#E85D3A]/10 text-[#E85D3A] border border-[#E85D3A]/15" : 
                                          isAccessible ? "bg-black/[0.04] text-black/70 border border-black/[0.06]" :
                                          "bg-black/[0.02] text-black/12 border border-black/[0.03]"}
                                    `}>
                                        {isDone ? (
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            step.icon
                                        )}
                                    </div>

                                    {/* Label & Description */}
                                    <div className={`flex-1 text-left min-w-0 transition-all duration-300 ${isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`}>
                                        <p className={`text-[13px] font-semibold leading-tight truncate ${isActive ? 'text-white' : isDone ? 'text-[#1a1a1a]' : 'text-inherit'}`}>
                                            {step.label}
                                        </p>
                                        <p className={`text-[10px] mt-0.5 truncate ${isActive ? 'text-white/50' : 'text-black/45'}`}>
                                            {step.description}
                                        </p>
                                    </div>

                                    {/* Step number indicator */}
                                    <span className={`text-[10px] font-mono shrink-0 transition-all duration-300 ${isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"} ${isActive ? 'text-white/40' : 'text-black/15'}`}>
                                        {String(step.number).padStart(2, '0')}
                                    </span>
                                </button>
                            );
                        })}
                    </nav>

                    {/* Divider */}
                    <div className={`mx-4 my-2 border-t border-black/[0.06]`} />

                    {/* Interrogation Lab */}
                    <div className={`py-2 ${isExpanded ? 'px-3' : 'px-4'}`}>
                        <button
                            onClick={() => {
                                if (currentSimulationId) {
                                    sessionStorage.setItem('percura_open_interrogation', '1');
                                    router.push("/simulation-results");
                                }
                            }}
                            disabled={!currentSimulationId}
                            title={!isExpanded ? "Interrogation Lab" : undefined}
                            className={`
                                w-full flex items-center transition-all duration-300 group
                                ${isExpanded ? 'p-3 gap-3 rounded-xl' : 'p-0 gap-0 h-10 rounded-xl justify-center'}
                                ${!currentSimulationId ? "opacity-25 cursor-not-allowed" : "text-black/75 hover:text-[#1a1a1a] hover:bg-black/[0.04]"}
                            `}
                        >
                            <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-black/[0.03] border border-black/[0.06] shrink-0 group-hover:scale-105 transition-all">
                                <svg className="w-4.5 h-4.5 text-black/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                            </div>
                            <span className={`text-[13px] font-semibold tracking-tight whitespace-nowrap transition-all duration-300 ${isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`}>
                                Interrogation Lab
                            </span>
                        </button>
                    </div>

                    {/* Divider */}
                    <div className={`mx-4 my-2 border-t border-black/[0.06]`} />

                    {/* Chat History Toggle */}
                    <div className={`py-2 ${isExpanded ? 'px-3' : 'px-4'}`}>
                        <button
                            onClick={() => { if (isExpanded) setShowChats(!showChats); }}
                            title={!isExpanded ? "Past Simulations" : undefined}
                            className={`
                                w-full flex items-center transition-all duration-300
                                ${isExpanded ? 'p-3 gap-3 rounded-xl' : 'p-0 gap-0 h-10 rounded-xl justify-center'}
                                text-black/75 hover:text-black/95 hover:bg-black/[0.03]
                            `}
                        >
                            <div className="w-9 h-9 flex items-center justify-center rounded-lg bg-black/[0.03] border border-black/[0.06] shrink-0">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <span className={`flex-1 text-left text-[13px] font-semibold tracking-tight whitespace-nowrap transition-all duration-300 ${isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden"}`}>
                                Past Simulations
                            </span>
                            {isExpanded && history.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] bg-black/[0.05] text-black/40 px-1.5 py-0.5 rounded-md font-mono">
                                        {history.length}
                                    </span>
                                    <svg className={`w-3.5 h-3.5 transition-transform duration-300 text-black/20 ${showChats ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            )}
                        </button>

                        {/* Recent Simulations List (collapsible) */}
                        {showChats && isExpanded && (
                            <div className="mt-1 space-y-0.5 animate-in slide-in-from-top-2 fade-in duration-300">
                                {recentHistory.length === 0 && (
                                    <p className="text-[11px] text-black/25 px-4 py-3 text-center italic">No simulations yet</p>
                                )}
                                {recentHistory.map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => handleSelectSimulation(item)}
                                        className={`
                                            group flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all cursor-pointer
                                            ${currentSimulationId === item.id
                                                ? "bg-[#E85D3A]/8 border border-[#E85D3A]/15 text-[#1a1a1a]"
                                                : "hover:bg-black/[0.03] text-black/50 hover:text-[#1a1a1a] border border-transparent"}
                                        `}
                                    >
                                        {/* Status dot */}
                                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                            item.status === "completed" ? "bg-emerald-500" : 
                                            item.status === "in progress" ? "bg-[#E85D3A] animate-pulse" : "bg-black/15"
                                        }`} />
                                        
                                        {/* Text */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-medium truncate leading-tight">
                                                {item.ideaData?.idea?.substring(0, 40) || "Untitled Simulation"}
                                                {(item.ideaData?.idea?.length || 0) > 40 ? "..." : ""}
                                            </p>
                                            <p className="text-[10px] text-black/25 mt-0.5">
                                                {item.ideaData?.industry || "General"} · {item.status === "completed" ? "Done" : "In Progress"}
                                            </p>
                                        </div>

                                        {/* Delete button */}
                                        <button
                                            onClick={(e) => handleDeleteSimulation(e, item.id)}
                                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-red-500/10 hover:text-red-500 text-black/15 transition-all shrink-0"
                                            title="Delete simulation"
                                        >
                                            {deletingId === item.id ? (
                                                <div className="w-3 h-3 rounded-full border border-red-400 border-t-transparent animate-spin" />
                                            ) : (
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            )}
                                        </button>
                                    </div>
                                ))}

                                {history.length > 5 && (
                                    <p className="text-[10px] text-black/25 text-center py-2">
                                        +{history.length - 5} more simulations
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* User Profile Footer */}
                <div className={`p-3 mt-auto border-t border-black/[0.06] ${isExpanded ? 'px-4' : 'px-4'}`}>
                    <div className={`flex items-center transition-all duration-300 rounded-xl p-2 hover:bg-black/[0.03] ${isExpanded ? 'gap-3 justify-start' : 'p-0 h-10 justify-center'}`}>
                        <div className="relative shrink-0">
                            {user?.photoURL ? (
                                <img src={user.photoURL} alt={user.displayName} className="w-9 h-9 rounded-lg border border-black/[0.08] object-cover" />
                            ) : (
                                <div className="w-9 h-9 rounded-lg bg-[#1A1A1A] border border-black/[0.08] flex items-center justify-center text-white text-sm font-bold uppercase">
                                    {user?.displayName?.[0] || "?"}
                                </div>
                            )}
                            {user && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full" />}
                        </div>
                        <div className={`flex-1 min-w-0 transition-all duration-300 ${isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden pointer-events-none lg:hidden"}`}>
                            <p className="text-[12px] font-semibold text-[#1a1a1a] truncate leading-tight">{user?.displayName || "Guest"}</p>
                            {user ? (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); logOut(); }}
                                    className="text-[10px] text-black/50 font-semibold uppercase tracking-wider transition-all hover:text-red-500"
                                >
                                    Sign Out
                                </button>
                            ) : (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); signInWithGoogle(); }}
                                    className="text-[10px] text-[#E85D3A] font-bold uppercase tracking-wider transition-all hover:text-[#D14E2E]"
                                >
                                    Sign In
                                </button>
                            )}
                        </div>
                    </div>
                </div>

            </aside>
        </>
    );
}
