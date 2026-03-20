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

export default function LoadingScreen({ message = "Finding matching personas...", customSteps }) {
    const [stepIndex, setStepIndex] = useState(0);
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

    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#FAF9F6]">
            {/* Neural background mesh */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-amber-600/[0.12] blur-[180px]" />
                <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-rose-600/[0.08] blur-[150px]" />
            </div>

            {/* Science Beaker Laboratory Visual */}
            <div className="relative mb-16 z-10 w-48 h-48 flex items-center justify-center">
                {/* Concentric Decorative Rings */}
                <div className="absolute inset-0 border border-black/[0.04] rounded-full" />
                <div className="absolute inset-4 border border-black/[0.08] rounded-full animate-[spin_20s_linear_infinite]" />
                <div className="absolute inset-8 border border-black/[0.04] rounded-full animate-[spin_15s_linear_infinite_reverse]" />

                {/* Glowing Ping */}
                <div className="w-32 h-32 rounded-full bg-amber-500/10 animate-pulse absolute" />

                {/* The Beaker SVG */}
                <div className="relative w-24 h-24">
                    <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                        <defs>
                            <linearGradient id="beakerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#f59e0b" />
                                <stop offset="100%" stopColor="#f43f5e" />
                            </linearGradient>

                            <clipPath id="beakerClip">
                                <path d="M35 15 H65 V25 H62 V50 L85 85 V92 H15 V85 L38 50 V25 H35 V15 Z" />
                            </clipPath>
                        </defs>

                        {/* Beaker Outline */}
                        <path
                            d="M35 15 H65 V25 H62 V50 L85 85 V92 H15 V85 L38 50 V25 H35 V15 Z"
                            fill="none"
                            stroke="#1a1a1a"
                            strokeWidth="1.5"
                            strokeOpacity="0.8"
                            strokeLinejoin="round"
                        />

                        {/* Filling Liquid Content */}
                        <g clipPath="url(#beakerClip)">
                            <rect x="0" y="0" width="100" height="100" fill="url(#beakerGradient)">
                                <animate
                                    attributeName="y"
                                    values="90; 25; 90"
                                    dur="4s"
                                    repeatCount="indefinite"
                                    calcMode="spline"
                                    keySplines="0.4 0 0.2 1; 0.4 0 0.2 1"
                                />
                            </rect>

                            {/* Mini Rising Bubbles */}
                            <circle cx="45" cy="90" r="1" fill="white" fillOpacity="0.6">
                                <animate attributeName="cy" values="90; 30" dur="2s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0; 0.6; 0" dur="2s" repeatCount="indefinite" />
                            </circle>
                            <circle cx="55" cy="85" r="1.5" fill="white" fillOpacity="0.4">
                                <animate attributeName="cy" values="90; 40" dur="3s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0; 0.4; 0" dur="3s" repeatCount="indefinite" />
                            </circle>
                            <circle cx="50" cy="80" r="0.8" fill="white" fillOpacity="0.5">
                                <animate attributeName="cy" values="90; 35" dur="2.5s" repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0; 0.5; 0" dur="2.5s" repeatCount="indefinite" />
                            </circle>
                        </g>

                        {/* Beaker Shine Effect */}
                        <path d="M42 30 Q45 28 50 30" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.6" />
                    </svg>
                </div>
            </div>

            {/* Main Progress Message */}
            <div className="text-center z-10 max-w-md px-6">
                <h2 className="text-3xl font-normal text-[#1a1a1a] mb-4 tracking-tight animate-in fade-in slide-in-from-bottom-4 duration-1000">
                    {message}
                </h2>

                <div className="h-6 overflow-hidden relative mb-12">
                    <p key={stepIndex} className="text-sm text-amber-600 font-bold tracking-[0.2em] uppercase transition-all duration-500 transform translate-y-0 opacity-100">
                        {stepsToUse[stepIndex]}
                    </p>
                </div>
            </div>



            {/* Diagnostic Data Stream */}
            <div className="flex gap-1.5 z-10 opacity-60">
                {[...Array(5)].map((_, i) => (
                    <div
                        key={i}
                        className="w-1 h-4 bg-amber-500/70 rounded-full animate-bounce"
                        style={{ animationDelay: `${i * 0.1}s`, animationDuration: '0.8s' }}
                    />
                ))}
            </div>
        </div>
    );
}
