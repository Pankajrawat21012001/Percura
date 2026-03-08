"use client";

import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useIdea } from "../context/IdeaContext";
import { useRouter } from "next/navigation";

export default function Sidebar({ isOpen, setIsOpen }) {
    const { user, logOut } = useAuth();
    const { setCurrentSimulationId, currentSimulationId, setIdea, setSimulationResults, setValidation } = useIdea();
    const [history, setHistory] = useState([]);
    const router = useRouter();

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

    const groupHistory = (items) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const last7Days = new Date(today);
        last7Days.setDate(last7Days.getDate() - 7);

        const groups = {
            Today: [],
            Yesterday: [],
            "Last 7 Days": [],
            Older: []
        };

        items.forEach(item => {
            const date = item.timestamp?.toDate() || new Date();
            if (date >= today) groups.Today.push(item);
            else if (date >= yesterday) groups.Yesterday.push(item);
            else if (date >= last7Days) groups["Last 7 Days"].push(item);
            else groups.Older.push(item);
        });

        return groups;
    };

    const groupedHistory = groupHistory(history);

    const handleSelectSimulation = (sim) => {
        setCurrentSimulationId(sim.id);
        setIdea(sim.ideaData);
        setSimulationResults(sim.results?.segmentsWithResults || sim.results?.segments || []);
        setValidation({
            segments: sim.results?.segments || [],
            personas: sim.results?.personas || [],
            totalMatched: sim.results?.totalMatched || 0,
        });

        if (sim.status === "ready") {
            router.push("/segment");
        } else {
            router.push("/simulation-results");
        }

        if (window.innerWidth < 1024) setIsOpen(false);
    };

    return (
        <>
            {/* Mobile Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[65]"
                    onClick={() => setIsOpen(false)}
                />
            )}

            <aside className={`
                fixed top-0 left-0 h-full w-80 bg-[#0A0A0A] border-r border-white/10 z-[70] transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
                ${isOpen ? "translate-x-0" : "-translate-x-full"}
                flex flex-col
            `}>
                {/* Header with Close */}
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                        {user?.photoURL ? (
                            <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full border border-white/10" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-bold border border-purple-500/30">
                                {user?.displayName?.[0] || "U"}
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{user?.displayName || "User"}</p>
                            <p className="text-[9px] text-white/40 truncate">{user?.email}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="p-2 rounded-xl hover:bg-white/5 text-white/20 hover:text-white transition-all"
                        title="Close History"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                {/* History List */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
                    {Object.entries(groupedHistory).map(([group, items]) => (
                        items.length > 0 && (
                            <div key={group} className="space-y-2">
                                <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/20 font-black px-2">{group}</h3>
                                {items.map(item => (
                                    <button
                                        key={item.id}
                                        onClick={() => handleSelectSimulation(item)}
                                        className={`
                                            w-full text-left p-3 rounded-xl transition-all group
                                            ${currentSimulationId === item.id
                                                ? "bg-purple-500/10 border border-purple-500/30 text-purple-300"
                                                : "hover:bg-white/[0.03] border border-transparent text-white/50 hover:text-white"}
                                        `}
                                    >
                                        <p className="text-xs font-medium truncate mb-1">
                                            {item.ideaData?.idea || "Untitled Simulation"}
                                        </p>
                                        <p className="text-[9px] text-white/20">
                                            {item.timestamp?.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        )
                    ))}
                    {history.length === 0 && (
                        <div className="text-center py-10 opacity-20">
                            <p className="text-xs italic">No history yet</p>
                        </div>
                    )}
                </div>

                {/* Footer / Logout */}
                <div className="p-4 border-t border-white/5 space-y-3">
                    <button
                        onClick={() => { router.push("/validate"); if (window.innerWidth < 1024) setIsOpen(false); }}
                        className="w-full py-3 rounded-xl bg-white/[0.05] border border-white/10 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                    >
                        <span>+ New Simulation</span>
                    </button>
                    <button
                        onClick={logOut}
                        className="w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-red-400/60 hover:text-red-400 hover:bg-red-400/5 transition-all flex items-center justify-center gap-2"
                    >
                        <span>Logout</span>
                    </button>
                </div>

            </aside>
        </>
    );
}
