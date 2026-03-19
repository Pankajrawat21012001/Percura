"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "../lib/firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useIdea } from "../context/IdeaContext";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const STEPS = [
    { 
        number: 1, 
        label: "Market Validation", 
        path: "/validate", 
        icon: (
            <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
        )
    },
    { 
        number: 2, 
        label: "Ontology Context", 
        path: "/context", 
        icon: (
            <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5S19.832 5.477 21 6.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
        )
    },
    { 
        number: 3, 
        label: "Recursive Segments", 
        path: "/segment", 
        icon: (
            <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
        )
    },
    { 
        number: 4, 
        label: "Simulation Reports", 
        path: "/simulation-results", 
        icon: (
            <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
        )
    },
];

export default function Sidebar({ isOpen, setIsOpen, currentStep }) {
    const { user, logOut } = useAuth();
    const { setCurrentSimulationId, currentSimulationId, setIdea, setSimulationResults, setValidation } = useIdea();
    const [history, setHistory] = useState([]);
    const [isHovered, setIsHovered] = useState(false);
    const sidebarRef = useRef(null);
    const router = useRouter();
    const pathname = usePathname();

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

    const groupHistory = (items) => {
        const groups = { Today: [], Yesterday: [], "Last 7 Days": [], Older: [] };
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
        const last7Days = new Date(today); last7Days.setDate(last7Days.getDate() - 7);

        items.forEach(item => {
            const date = item.timestamp?.toDate() || new Date();
            if (date >= today) groups.Today.push(item);
            else if (date >= yesterday) groups.Yesterday.push(item);
            else if (date >= last7Days) groups["Last 7 Days"].push(item);
            else groups.Older.push(item);
        });
        return groups;
    };

    const handleSelectSimulation = (sim) => {
        setCurrentSimulationId(sim.id || sim.docId);
        setIdea(sim.ideaData);
        setSimulationResults(sim.results?.segmentsWithResults || []);
        setValidation({
            segments: sim.results?.segments || [],
            personas: sim.results?.personas || [],
            totalMatched: sim.results?.totalMatched || 0,
        });

        if (sim.results?.segmentsWithResults?.length > 0 || sim.status === "completed") {
            router.push("/simulation-results");
        } else {
            router.push("/segment");
        }
        if (window.innerWidth < 1024) setIsOpen(false);
    };

    const groupedHistory = groupHistory(history);

    return (
        <>
            {/* Backdrop for Mobile */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/40 backdrop-blur-xl z-[65] lg:hidden animate-in fade-in duration-300" 
                    onClick={() => setIsOpen(false)}
                />
            )}

            <aside 
                ref={sidebarRef}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className={`
                    fixed top-0 left-0 h-full bg-[#050505] border-r border-white/10 z-[70] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-[0_0_80px_rgba(0,0,0,1)]
                    ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
                    ${isHovered ? "w-80" : "w-80 lg:w-24"}
                    flex flex-col
                `}
            >
                {/* Brand & Toggle Header */}
                <div className="p-8 pb-10 flex items-center justify-between lg:justify-start">
                    <Link href="/validate" className="flex items-center gap-5 group">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-indigo-700 flex items-center justify-center text-white font-black shadow-[0_8px_30px_rgba(99,102,241,0.4)] group-hover:scale-110 group-active:scale-95 transition-all duration-300 shrink-0">
                            P
                        </div>
                        <span className={`text-2xl font-black tracking-tighter text-white transition-all duration-500 delay-75 ${isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 lg:hidden"}`}>
                            PERCURA
                        </span>
                    </Link>
                    <button onClick={() => setIsOpen(false)} className="lg:hidden p-2 text-white/40 hover:text-white">✕</button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar px-5 space-y-12">
                    {/* Framework Section */}
                    <div className="space-y-3">
                        <p className={`text-[11px] uppercase tracking-[0.4em] text-white/40 font-black mb-6 px-5 transition-all duration-500 ${isHovered ? "opacity-100" : "opacity-0 lg:hidden"}`}>Framework</p>
                        {STEPS.map((step) => {
                            const isCompleted = currentStep > step.number;
                            const isActive = currentStep === step.number;
                            return (
                                <button
                                    key={step.number}
                                    onClick={() => isCompleted && router.push(step.path)}
                                    disabled={!isCompleted && !isActive}
                                    className={`
                                        w-full flex items-center gap-6 p-4 rounded-3xl transition-all duration-500 group relative
                                        ${isActive ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-[0_15px_40px_-10px_rgba(147,51,234,0.5)] scale-[1.03]" : 
                                          isCompleted ? "text-purple-400 hover:bg-white/[0.08] hover:translate-x-1" : "text-white/20 cursor-not-allowed"}
                                    `}
                                >
                                    <div className={`
                                        w-8 h-8 flex items-center justify-center transition-all duration-500 shrink-0
                                        ${isActive ? "scale-110 text-white drop-shadow-[0_0_10px_white]" : 
                                          isCompleted ? "text-purple-400 bg-purple-500/10 rounded-xl" : "text-white/40 bg-white/5 rounded-xl"}
                                    `}>
                                        {step.icon}
                                    </div>
                                    <span className={`text-[14px] font-black tracking-tight whitespace-nowrap transition-all duration-500 ${isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 lg:hidden"}`}>
                                        {step.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Exploration Section */}
                    <div className="space-y-3">
                        <p className={`text-[11px] uppercase tracking-[0.4em] text-white/40 font-black mb-6 px-5 transition-all duration-500 ${isHovered ? "opacity-100" : "opacity-0 lg:hidden"}`}>Exploration</p>
                        <button
                            onClick={() => router.push("/simulation-results")}
                            disabled={!currentSimulationId}
                            className={`w-full flex items-center gap-6 p-4 rounded-3xl transition-all group scale-100 active:scale-95 ${!currentSimulationId ? "opacity-20 cursor-not-allowed" : "text-white/60 hover:text-white hover:bg-white/[0.08] hover:translate-x-1"}`}
                        >
                            <div className="w-8 h-8 flex items-center justify-center shrink-0 grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all text-2xl group-hover:scale-125 duration-500">
                                🧠
                            </div>
                            <span className={`text-[14px] font-black tracking-tight whitespace-nowrap transition-all duration-500 ${isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4 lg:hidden"}`}>
                                Interrogation Lab
                            </span>
                        </button>
                    </div>

                    {/* Chat History Section */}
                    <div className="space-y-8 pb-10">
                        <p className={`text-[11px] uppercase tracking-[0.4em] text-white/30 font-black px-5 transition-all duration-500 ${isHovered ? "opacity-100" : "opacity-0 lg:hidden"}`}>Chat History</p>
                        {Object.entries(groupedHistory).map(([group, items]) => (
                            items.length > 0 && (
                                <div key={group} className="space-y-4 px-2">
                                    <h4 className={`text-[11px] uppercase tracking-[0.2em] text-white/10 font-black px-4 transition-all duration-500 ${isHovered ? "opacity-100" : "opacity-0 lg:hidden"}`}>{group}</h4>
                                    {items.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleSelectSimulation(item)}
                                            className={`
                                                w-full text-left p-4 rounded-2xl transition-all border group shrink-0
                                                ${currentSimulationId === item.id
                                                    ? "bg-purple-600/20 border-purple-500/50 text-white shadow-2xl"
                                                    : "bg-transparent border-transparent hover:bg-white/[0.04] text-white/30 hover:text-white/60"}
                                            `}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={`w-2.5 h-2.5 transition-all duration-500 rounded-full border ${currentSimulationId === item.id ? "bg-purple-500 border-white/20 animate-pulse" : "bg-white/5 border-transparent"}`} />
                                                <div className={`transition-all duration-500 ${isHovered ? "opacity-100 translate-x-0 overflow-hidden" : "opacity-0 -translate-x-4 lg:hidden"}`}>
                                                    <p className="text-[12px] font-bold truncate max-w-[140px] leading-tight grayscale group-hover:grayscale-0 opacity-40 group-hover:opacity-100">
                                                        {item.ideaData?.idea || "Alpha Exploration"}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )
                        ))}
                    </div>
                </div>

                {/* User Context Area */}
                <div className="p-6 mt-auto">
                    <div className={`bg-white/[0.04] border border-white/10 rounded-[2.5rem] p-4 flex items-center transition-all duration-500 group relative hover:border-white/20 ${isHovered ? "gap-5 px-5" : "gap-0 px-2 justify-center"}`}>
                        <div className="relative shrink-0 group-hover:scale-105 transition-transform duration-500">
                            {user?.photoURL ? (
                                <img src={user.photoURL} alt={user.displayName} className="w-12 h-12 rounded-[1.2rem] border-2 border-white/10 object-cover shadow-2xl transition-all group-hover:border-white/30" />
                            ) : (
                                <div className="w-12 h-12 rounded-[1.2rem] bg-gradient-to-tr from-indigo-500 to-purple-700 border-2 border-white/20 flex items-center justify-center text-white text-lg font-black uppercase shadow-2xl">
                                    {user?.displayName?.[0] || "U"}
                                </div>
                            )}
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-[3px] border-[#050505] rounded-full shadow-2xl animate-pulse" />
                        </div>
                        <div className={`flex-1 min-w-0 transition-all duration-500 ${isHovered ? "opacity-100 translate-x-0 w-auto" : "opacity-0 w-0 pointer-events-none lg:hidden"}`}>
                            <p className="text-[13px] font-black text-white/90 truncate uppercase tracking-tighter leading-none mb-2">{user?.displayName || "Alpha Specialist"}</p>
                            <button 
                                onClick={(e) => { e.stopPropagation(); logOut(); }}
                                className="text-[11px] text-red-500 font-black uppercase tracking-[0.2em] transition-all hover:text-red-400 hover:tracking-[0.3em] active:scale-90"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>

            </aside>
        </>
    );
}
