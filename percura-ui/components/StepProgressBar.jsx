"use client";

import React from "react";
import { useRouter } from "next/navigation";

const STEPS = [
    { number: 1, label: "Validate", path: "/validate" },
    { number: 2, label: "Context", path: "/context" },
    { number: 3, label: "Segments", path: "/segment" },
    { number: 4, label: "Results", path: "/simulation-results" },
];

export default function StepProgressBar({ currentStep = 1 }) {
    const router = useRouter();

    return (
        <div className="w-full max-w-5xl mx-auto px-6 mb-8">
            <div className="relative flex items-center justify-between">
                {/* Connection Lines (Background) */}
                <div className="absolute top-1/2 left-0 w-full h-[1px] -translate-y-1/2 flex px-4">
                    {STEPS.slice(0, -1).map((step, i) => {
                        const isCompleted = currentStep > step.number;
                        return (
                            <div 
                                key={i} 
                                className={`flex-1 h-full transition-all duration-700 ${isCompleted ? "bg-emerald-500/50" : "border-t border-dashed border-white/10"}`} 
                            />
                        );
                    })}
                </div>

                {/* Steps */}
                {STEPS.map((step) => {
                    const isCompleted = currentStep > step.number;
                    const isActive = currentStep === step.number;
                    const isFuture = currentStep < step.number;

                    return (
                        <div key={step.number} className="relative z-10 flex flex-col items-center group">
                            <button
                                onClick={() => isCompleted && router.push(step.path)}
                                disabled={!isCompleted}
                                className={`
                                    w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500
                                    ${isCompleted 
                                        ? "bg-emerald-500 border-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:scale-110 cursor-pointer" 
                                        : isActive 
                                            ? "bg-black border-white text-white shadow-[0_0_20px_rgba(255,255,255,0.1)] scale-110" 
                                            : "bg-black border-white/10 text-white/20"}
                                `}
                            >
                                {isCompleted ? (
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                ) : (
                                    <span className="text-sm font-black">{step.number}</span>
                                )}
                            </button>
                            <span 
                                className={`
                                    absolute -bottom-7 text-[10px] font-black uppercase tracking-[0.2em] whitespace-nowrap transition-all duration-500
                                    ${isActive ? "text-white opacity-100" : isCompleted ? "text-emerald-400 opacity-60" : "text-white/20 opacity-40"}
                                `}
                            >
                                {step.label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
