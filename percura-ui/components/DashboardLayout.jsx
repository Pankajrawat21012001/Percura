"use client";

import React, { useState } from "react";
import Sidebar from "./Sidebar";
import FlowDescriptionStrip from "./FlowDescriptionStrip";

export default function DashboardLayout({ children, rightPanel, currentStep }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);

    return (
        <div className="flex min-h-screen bg-black font-sans selection:bg-purple-500/30">
            {/* Left Sidebar - Fixed on desktop, slide-out on mobile */}
            <Sidebar 
                isOpen={isSidebarOpen} 
                setIsOpen={setIsSidebarOpen} 
                currentStep={currentStep} 
            />

            {/* Main Content Area */}
            <main className="flex-1 w-full relative lg:pl-[72px] transition-all duration-500">
                {/* Header for small screens */}
                <header className="lg:hidden flex items-center justify-between p-4 border-b border-white/10 bg-black/50 backdrop-blur-md z-30">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-white/60">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <span className="text-sm font-bold tracking-tighter">PERCURA</span>
                    <div className="w-10" />
                </header>

                <div className="py-12">
                    <FlowDescriptionStrip currentStep={currentStep || 1} />
                    {children}
                </div>

            </main>

            {/* Right Panel (Chat) */}
            {isRightPanelOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55]"
                    onClick={() => setIsRightPanelOpen(false)}
                />
            )}
            <aside className={`
                fixed top-0 right-0 h-full w-full sm:w-[450px] bg-[#0D0D0D] border-l border-white/10 z-[60] transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]
                ${isRightPanelOpen ? "translate-x-0" : "translate-x-full"}
            `}>
                {rightPanel && React.cloneElement(rightPanel, { onClose: () => setIsRightPanelOpen(false) })}
            </aside>
        </div>
    );
}
