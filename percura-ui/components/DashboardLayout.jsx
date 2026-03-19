"use client";

import React, { useState } from "react";
import Sidebar from "./Sidebar";

export default function DashboardLayout({ children, rightPanel }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isRightPanelOpen, setIsRightPanelOpen] = useState(false);

    return (
        <div className="flex min-h-screen bg-black font-sans selection:bg-purple-500/30">
            {/* Left Sidebar */}
            <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

            {/* Main Content Area */}
            <main className="flex-1 w-full relative">
                {/* Header for small screens */}
                <header className="lg:hidden flex items-center justify-between p-4 border-b border-white/10 bg-black/50 backdrop-blur-md z-30">
                    <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-white/60">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                    </button>
                    <span className="text-sm font-bold tracking-tighter">PERCURA</span>
                    <div className="w-10" /> {/* Spacer to keep title centered */}
                </header>

                {children}

                {/* Floating Sidebar Toggle — Top Left */}
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className={`
                        fixed top-6 left-6 z-[80] p-4 rounded-2xl bg-white text-black shadow-2xl transition-all duration-500 hover:scale-110 active:scale-95
                        ${isSidebarOpen ? "-translate-x-32 pointer-events-none" : "translate-x-0 pointer-events-auto"}
                    `}
                    title="Menu"
                >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>


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
