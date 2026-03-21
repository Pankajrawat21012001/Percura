"use client";

import React, { useState } from "react";
import Sidebar from "./Sidebar";

export default function DashboardLayout({ children, currentStep }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    return (
        <div className="flex min-h-screen bg-white text-[#1a1a1a] font-sans selection:bg-[#E85D3A]/15">
            {/* Left Sidebar - Fixed on desktop, slide-out on mobile */}
            <Sidebar 
                isOpen={isSidebarOpen} 
                setIsOpen={setIsSidebarOpen} 
                currentStep={currentStep} 
            />

            {/* Main Content Area */}
            <main className="flex-1 w-full relative lg:pl-[72px] transition-all duration-500">
                {/* Header for small screens */}
                <header className="lg:hidden flex items-center justify-between p-4 border-b border-black/[0.06] bg-white/95 backdrop-blur-md z-30">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-black/60 hover:text-[#1a1a1a] transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <span className="text-sm font-bold tracking-tight" style={{ fontFamily: "var(--font-serif)" }}>Percura</span>
                    <div className="w-10" />
                </header>

                <div className="py-8">
                    {children}
                </div>

            </main>
        </div>
    );
}
