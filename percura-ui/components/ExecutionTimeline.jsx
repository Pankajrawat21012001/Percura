"use client";

import { useState } from "react";

/**
 * ExecutionTimeline — Renders a chronological audit log of the simulation pipeline.
 * Accepts an array of trace events: { step, label, timestamp, latencyMs, details, status }
 */
export default function ExecutionTimeline({ trace = [], idea = {}, stats = {} }) {
    const [expandedStep, setExpandedStep] = useState(null);

    const totalLatency = trace.reduce((acc, t) => acc + (t.latencyMs || 0), 0);
    const totalSeconds = Math.round(totalLatency / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    const statusIcon = {
        done: '●',
        running: '◌',
        error: '✕',
        complete: '✓',
    };

    const statusColor = {
        done: 'text-emerald-400',
        running: 'text-blue-400 animate-pulse',
        error: 'text-red-400',
        complete: 'text-emerald-400',
    };

    return (
        <div className="bg-white border border-black/[0.08] rounded-3xl p-8 md:p-10 shadow-lg shadow-black/[0.04]">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-[11px] uppercase tracking-[0.4em] text-blue-500 font-black mb-1">● Execution Timeline</h2>
                    <p className="text-[11px] text-black/40 uppercase tracking-widest">
                        Segments {stats.segmentCount || '—'}/{stats.segmentCount || '—'} &nbsp;&middot;&nbsp;
                        Elapsed {minutes}m {seconds}s &nbsp;&middot;&nbsp;
                        API Calls {trace.length} &nbsp;&middot;&nbsp;
                        Personas {stats.personaCount || '—'}
                    </p>
                </div>
                <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-500 font-bold uppercase tracking-widest">
                    Completed
                </span>
            </div>

            {/* Collapsed Step Summary */}
            <div className="space-y-2 mb-8">
                {trace.map((t, i) => (
                    <div 
                        key={i}
                        className="flex items-center gap-4 px-4 py-3 rounded-xl bg-[#FAFAFA] border border-black/[0.06] hover:border-black/15 transition-all cursor-pointer"
                        onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                    >
                        <span className={`text-[11px] font-bold ${statusColor[t.status] || 'text-black/30'}`}>
                            {statusIcon[t.status] || '●'}
                        </span>
                        <span className="text-[11px] text-black/30 font-bold w-6">{String(i + 1).padStart(2, '0')}</span>
                        <span className="flex-1 text-[11px] text-black/70 font-medium">{t.label}</span>
                        {t.status === 'done' || t.status === 'complete' ? (
                            <span className="text-[11px] text-black/30 uppercase tracking-widest font-bold">
                                {t.status === 'complete' ? 'Complete' : 'Done'}
                            </span>
                        ) : null}
                    </div>
                ))}
            </div>

            {/* Expanded Detail View */}
            {expandedStep !== null && trace[expandedStep] && (
                <div className="bg-[#FAFAFA] border border-black/[0.08] rounded-2xl p-6 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold text-black/80 uppercase tracking-wider">{trace[expandedStep].label}</h4>
                        <span className="text-[11px] text-black/30 font-mono">
                            {trace[expandedStep].timestamp || '—'}
                        </span>
                    </div>

                    {/* Tool Call Badge */}
                    {trace[expandedStep].toolName && (
                        <div className="mb-4">
                            <span className="px-2.5 py-1 rounded-lg bg-[#E85D3A]/10 border border-[#E85D3A]/20 text-[11px] text-[#E85D3A] font-bold">
                                ⚡ {trace[expandedStep].toolName}
                            </span>
                        </div>
                    )}

                    {/* Details */}
                    {trace[expandedStep].details && (
                        <div className="space-y-2 mb-4">
                            {Object.entries(trace[expandedStep].details).map(([key, val]) => (
                                <div key={key} className="flex items-start gap-4">
                                    <span className="text-[11px] text-black/30 uppercase tracking-widest font-bold w-28 shrink-0 pt-0.5">{key}</span>
                                    <span className="text-[11px] text-black/70 font-normal leading-relaxed">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Latency */}
                    <div className="flex items-center gap-2 pt-3 border-t border-black/[0.06]">
                        <span className="text-[11px] text-black/30 uppercase tracking-widest font-bold">Latency</span>
                        <span className="text-[11px] text-black/50 font-mono">
                            {trace[expandedStep].latencyMs ? `${(trace[expandedStep].latencyMs / 1000).toFixed(1)}s` : '—'}
                        </span>
                    </div>
                </div>
            )}

            {/* Simulation Start Context */}
            {idea?.idea && (
                <div className="mt-8 pt-6 border-t border-black/[0.06]">
                    <h4 className="text-[11px] uppercase tracking-[0.3em] text-black/30 font-bold mb-3">Simulation Input</h4>
                    <div className="space-y-2">
                        <div className="flex gap-4">
                            <span className="text-[11px] text-black/30 uppercase tracking-widest font-bold w-20 shrink-0">Idea</span>
                            <span className="text-[11px] text-black/70">{idea.idea}</span>
                        </div>
                        <div className="flex gap-4">
                            <span className="text-[11px] text-black/30 uppercase tracking-widest font-bold w-20 shrink-0">Industry</span>
                            <span className="text-[11px] text-black/70">{idea.industry || 'General'}</span>
                        </div>
                        <div className="flex gap-4">
                            <span className="text-[11px] text-black/30 uppercase tracking-widest font-bold w-20 shrink-0">Target</span>
                            <span className="text-[11px] text-black/70">{idea.targetAudience || 'General public'}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
