"use client";

import { useState, useEffect } from "react";

const SIMULATION_STEPS = [
    "Analyzing your idea",
    "Building search vector",
    "Searching 1M+ personas",
    "Applying demographic filters",
    "Clustering look-alike segments",
    "Ranking by relevance",
    "Preparing results"
];

export default function LoadingScreen({ message = "Finding matching personas...", customSteps, progress }) {
    const [stepIndex, setStepIndex] = useState(0);
    const [simulatedProgress, setSimulatedProgress] = useState(15);
    const stepsToUse = customSteps || SIMULATION_STEPS;

    useEffect(() => {
        const interval = setInterval(() => {
            setStepIndex((prev) => (prev + 1) % stepsToUse.length);
        }, 1200);
        
        // Prevent body scroll during loading overlay
        document.body.style.overflow = "hidden";
        
        return () => { 
            clearInterval(interval);
            document.body.style.overflow = "unset";
        };
    }, [stepsToUse.length]);

    useEffect(() => {
        if (progress !== undefined) return;
        
        const simInterval = setInterval(() => {
            setSimulatedProgress(prev => {
                if (prev >= 85) return prev;
                return prev + 1;
            });
        }, 800);
        return () => clearInterval(simInterval);
    }, [progress]);

    const displayProgress = progress !== undefined ? progress : simulatedProgress;

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white">
            {/* Thin Progress Bar at top */}
            <div className="absolute top-0 left-0 w-full h-1 bg-black/[0.04]">
                <div 
                    className="h-full bg-[#E85D3A] transition-all duration-700 ease-out"
                    style={{ width: `${displayProgress}%` }}
                />
            </div>

            {/* Subtle background pattern */}
            <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />

            {/* Percura Logo Mark — animated */}
            <div className="relative mb-16 z-10 w-40 h-40 flex items-center justify-center">
                {/* Concentric rings */}
                <div className="absolute inset-0 border border-black/[0.06] rounded-full" />
                <div className="absolute inset-4 border border-black/[0.08] rounded-full animate-[spin_20s_linear_infinite]" />
                <div className="absolute inset-8 border border-black/[0.04] rounded-full animate-[spin_15s_linear_infinite_reverse]" />

                {/* Inner glow */}
                <div className="w-28 h-28 rounded-full bg-[#E85D3A]/5 animate-pulse absolute" />

                {/* Asterisk/flower icon — Casely-style */}
                <div className="relative z-10">
                    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="drop-shadow-sm">
                        {/* Center dot */}
                        <circle cx="24" cy="24" r="4" fill="#E85D3A" />
                        {/* Petals */}
                        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
                            const rad = (angle * Math.PI) / 180;
                            const x1 = 24 + Math.cos(rad) * 8;
                            const y1 = 24 + Math.sin(rad) * 8;
                            const x2 = 24 + Math.cos(rad) * 18;
                            const y2 = 24 + Math.sin(rad) * 18;
                            return (
                                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#E85D3A" strokeWidth="2.5" strokeLinecap="round" opacity={0.7 + (i % 2) * 0.3}>
                                    <animate attributeName="opacity" values={`${0.4 + (i % 3) * 0.2};1;${0.4 + (i % 3) * 0.2}`} dur={`${1.5 + i * 0.2}s`} repeatCount="indefinite" />
                                </line>
                            );
                        })}
                        {/* Outer dots */}
                        {[0, 90, 180, 270].map((angle, i) => {
                            const rad = (angle * Math.PI) / 180;
                            const cx = 24 + Math.cos(rad) * 20;
                            const cy = 24 + Math.sin(rad) * 20;
                            return <circle key={`dot-${i}`} cx={cx} cy={cy} r="2" fill="#E85D3A" opacity="0.5" />;
                        })}
                    </svg>
                </div>
            </div>

            {/* Main Progress Message */}
            <div className="text-center z-10 max-w-md px-6">
                <h2 className="text-3xl font-normal text-[#1a1a1a] mb-4 tracking-tight animate-in fade-in slide-in-from-bottom-4 duration-1000" style={{ fontFamily: "var(--font-serif)" }}>
                    {message}
                </h2>

                <div className="h-6 overflow-hidden relative mb-12">
                    <p key={stepIndex} className="text-sm text-[#E85D3A] font-bold tracking-[0.15em] uppercase transition-all duration-500 transform translate-y-0 opacity-100">
                        {stepsToUse[stepIndex]}
                    </p>
                </div>
            </div>

            {/* Minimal progress dots */}
            <div className="flex gap-2 z-10">
                {[...Array(5)].map((_, i) => (
                    <div
                        key={i}
                        className="w-1.5 h-1.5 bg-[#E85D3A]/50 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.12}s`, animationDuration: '0.8s' }}
                    />
                ))}
            </div>
        </div>
    );
}
