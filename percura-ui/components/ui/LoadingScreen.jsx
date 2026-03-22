"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

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

                {/* Percura Logo Mark — replaced with image */}
                <div className="relative z-10 animate-pulse">
                    <Image
                        src="/percura-icon.png"
                        alt="Percura"
                        width={48}
                        height={48}
                        className="drop-shadow-sm object-contain"
                    />
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
