"use client";

import ReactMarkdown from 'react-markdown';

export default function SimulationReport({ report, reportData }) {
    const content = report || reportData;
    if (!content) {
        return (
            <div className="bg-white border border-black/[0.08] rounded-3xl p-12 text-center shadow-lg mt-8">
                <div className="w-16 h-16 rounded-[2rem] bg-[#FAFAFA] border border-black/[0.06] flex items-center justify-center text-2xl mx-auto mb-4 animate-pulse">
                    📄
                </div>
                <h3 className="text-lg font-bold text-[#1a1a1a] mb-2">Report Not Available</h3>
                <p className="text-sm text-black/40 font-medium">The deep synthesis report was not generated for this simulation run.</p>
            </div>
        );
    }

    return (
        <div className="bg-white border border-black/[0.08] rounded-3xl p-8 lg:p-12 shadow-xl shadow-black/[0.04] mt-8 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#E85D3A]/5 blur-[100px] rounded-full pointer-events-none transform translate-x-1/2 -translate-y-1/2" />

            <div className="flex items-center gap-4 mb-10 relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-[#E85D3A]/10 border border-[#E85D3A]/20 flex items-center justify-center text-2xl">
                    📊
                </div>
                <div>
                    <h2 className="text-2xl font-black text-[#1a1a1a] tracking-tight uppercase">AI Synthesis Report</h2>
                    <p className="text-[10px] text-black/40 font-bold uppercase tracking-[0.3em] mt-1.5">Deep Contextual Market Analysis</p>
                </div>
            </div>

            <div className="relative z-10">
                <ReactMarkdown
                    components={{
                        h1: ({node, ...props}) => <h1 className="text-3xl font-black text-[#1a1a1a] mb-10 border-b border-black/[0.06] pb-6 tracking-tighter" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-xl font-black text-[#E85D3A] mt-16 mb-8 uppercase tracking-widest flex items-center gap-3 before:content-[''] before:block before:w-1.5 before:h-8 before:bg-[#E85D3A] before:rounded-full" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-lg font-bold text-[#1a1a1a] mb-4 mt-8" {...props} />,
                        p: ({node, ...props}) => <p className="text-base text-black/70 leading-[1.8] mb-8 font-medium last:mb-0" {...props} />,
                        ul: ({node, ...props}) => <ul className="space-y-4 mb-8 list-none" {...props} />,
                        ol: ({node, ...props}) => <ol className="space-y-4 mb-8 list-decimal list-inside" {...props} />,
                        li: ({node, ...props}) => (
                            <li className="text-base text-black/70 leading-relaxed pl-6 relative before:content-[''] before:absolute before:left-0 before:top-2.5 before:w-2 before:h-2 before:bg-[#E85D3A] before:rounded-full" {...props} />
                        ),
                        strong: ({node, ...props}) => <strong className="text-[#1a1a1a] font-black" {...props} />,
                        blockquote: ({node, ...props}) => (
                            <blockquote className="border-l-4 border-[#E85D3A] bg-[#FAFAFA] p-8 rounded-r-3xl my-10 italic text-black/80" {...props} />
                        ),
                        hr: () => <hr className="my-12 border-black/[0.06]" />,
                    }}
                >
                    {content}
                </ReactMarkdown>
            </div>
        </div>
    );
}
