"use client";

import React from "react";

const STEPS_INFO = [
    {
        number: 1,
        title: "Define your idea",
        description: "Define your idea — fill in product, industry, target audience.",
    },
    {
        number: 2,
        title: "Market Context",
        description: "Market Context — AI extracts competitors, risks, and builds a Zep knowledge graph.",
    },
    {
        number: 3,
        title: "Pick Segments",
        description: "Pick Segments — choose which audience clusters to test against.",
    },
    {
        number: 4,
        title: "Simulation Results",
        description: "Simulation Results — view resonance scores, insights, and interrogate personas.",
    },
];

export default function FlowDescriptionStrip({ currentStep = 1 }) {
    return (
        <div className="w-full max-w-6xl mx-auto px-6 mb-8 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {STEPS_INFO.map((step) => {
                    const isActive = currentStep === step.number;
                    const isCompleted = currentStep > step.number;
                    
                    return (
                        <div
                            key={step.number}
                            className={`
                                h-[60px] px-4 py-2 rounded-xl border flex flex-col justify-center transition-all duration-500
                                ${isActive 
                                    ? "bg-white/[0.05] border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.05)]" 
                                    : "bg-white/[0.02] border-white/5 opacity-40"}
                            `}
                        >
                            <div className="flex items-baseline gap-2 overflow-hidden">
                                <span className={`text-[11px] font-black uppercase tracking-widest ${isActive ? "text-purple-400" : "text-white/20"}`}>
                                    {step.number}
                                </span>
                                <h4 className={`text-[12px] font-bold truncate ${isActive ? "text-white" : "text-white/40"}`}>
                                    {step.title}
                                </h4>
                            </div>
                            <p className={`text-[11px] leading-snug line-clamp-2 ${isActive ? "text-white/60" : "text-white/20"}`}>
                                {step.description}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
