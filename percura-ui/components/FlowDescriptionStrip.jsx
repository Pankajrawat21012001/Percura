"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

const STEPS_INFO = [
    {
        number: 1,
        title: "Define Your Idea",
        description: "Fill in product, industry, and target audience details.",
    },
    {
        number: 2,
        title: "Market Context",
        description: "AI extracts competitors, risks, and builds knowledge graph.",
    },
    {
        number: 3,
        title: "Pick Segments",
        description: "Choose which audience clusters to test against.",
    },
    {
        number: 4,
        title: "View Results",
        description: "View resonance scores, insights, and interrogate personas.",
    },
];

export default function FlowDescriptionStrip({ currentStep = 1 }) {
    const pathname = usePathname();

    // Read completed steps from sessionStorage (shared with Sidebar)
    const [completedSteps, setCompletedSteps] = useState([]);

    useEffect(() => {
        if (typeof window !== "undefined") {
            const stored = sessionStorage.getItem("percura_completed_steps");
            if (stored) setCompletedSteps(JSON.parse(stored));
        }
    }, [pathname, currentStep]);

    return (
        <div className="w-full max-w-6xl mx-auto px-6 lg:px-10 mb-6 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                {STEPS_INFO.map((step) => {
                    const isActive = currentStep === step.number;
                    const isCompleted = completedSteps.includes(step.number) && !isActive;
                    
                    return (
                        <div
                            key={step.number}
                            className={`
                                h-[52px] px-4 py-2 rounded-xl border flex flex-col justify-center transition-all duration-500
                                ${isActive 
                                    ? "bg-white/[0.05] border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.03)]" 
                                    : isCompleted 
                                        ? "bg-emerald-500/[0.03] border-emerald-500/15 opacity-70"
                                        : "bg-white/[0.01] border-white/[0.04] opacity-30"}
                            `}
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                {isCompleted ? (
                                    <svg className="w-3.5 h-3.5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <span className={`text-[10px] font-bold tracking-wider ${isActive ? "text-purple-400" : "text-white/20"}`}>
                                        {String(step.number).padStart(2, '0')}
                                    </span>
                                )}
                                <h4 className={`text-[12px] font-semibold truncate ${isActive ? "text-white" : isCompleted ? "text-emerald-400/70" : "text-white/30"}`}>
                                    {step.title}
                                </h4>
                            </div>
                            <p className={`text-[10px] leading-snug line-clamp-1 ml-5 ${isActive ? "text-white/50" : "text-white/15"}`}>
                                {step.description}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
