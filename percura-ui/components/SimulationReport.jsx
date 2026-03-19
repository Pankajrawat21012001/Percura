"use client";

import ReactMarkdown from 'react-markdown';

export default function SimulationReport({ report, reportData }) {
    const content = report || reportData;
    if (!content) {
        return (
            <div className="bg-[#0C0C0E] border border-white/10 rounded-[2rem] p-12 text-center shadow-2xl mt-8">
                <div className="w-16 h-16 rounded-[2rem] bg-white/[0.02] border border-white/5 flex items-center justify-center text-2xl mx-auto mb-4 animate-pulse">
                    📄
                </div>
                <h3 className="text-lg font-bold text-white/60 mb-2">Report Not Available</h3>
                <p className="text-sm text-white/30 font-medium">The deep synthesis report was not generated for this simulation run.</p>
            </div>
        );
    }

    return (
        <div className="bg-[#0C0C0E] border border-white/10 rounded-[2rem] p-8 lg:p-12 shadow-2xl mt-8 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 blur-[100px] rounded-full pointer-events-none transform translate-x-1/2 -translate-y-1/2" />

            <div className="flex items-center gap-4 mb-10 relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/20 border border-white/10 flex items-center justify-center text-2xl shadow-inner">
                    📊
                </div>
                <div>
                    <h2 className="text-2xl font-black text-white tracking-tight uppercase">AI Synthesis Report</h2>
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-[0.3em] mt-1.5">Deep Contextual Market Analysis</p>
                </div>
            </div>

            <div className="prose prose-invert prose-purple max-w-none relative z-10
                prose-headings:font-black prose-headings:tracking-tight 
                prose-h1:text-3xl prose-h1:mb-8
                prose-h2:text-xl prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-4 prose-h2:mt-12 prose-h2:uppercase prose-h2:tracking-widest prose-h2:text-purple-400
                prose-h3:text-lg prose-h3:text-white/90
                prose-p:text-white/70 prose-p:leading-relaxed
                prose-li:text-white/70 prose-li:marker:text-purple-500
                prose-strong:text-white prose-strong:font-bold
                prose-blockquote:border-l-purple-500 prose-blockquote:bg-purple-500/5 prose-blockquote:py-2 prose-blockquote:px-5 prose-blockquote:rounded-r-xl prose-blockquote:not-italic prose-blockquote:shadow-md
                prose-a:text-purple-400 prose-a:no-underline hover:prose-a:text-purple-300 transition-colors">
                <ReactMarkdown>{content}</ReactMarkdown>
            </div>
        </div>
    );
}
