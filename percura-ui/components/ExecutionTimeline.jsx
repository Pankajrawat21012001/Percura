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
        <div className="bg-[#0D0D0D]/80 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 md:p-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-[10px] uppercase tracking-[0.4em] text-blue-400 font-black mb-1">● Execution Timeline</h2>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest">
                        Segments {stats.segmentCount || '—'}/{stats.segmentCount || '—'} &nbsp;&middot;&nbsp;
                        Elapsed {minutes}m {seconds}s &nbsp;&middot;&nbsp;
                        API Calls {trace.length} &nbsp;&middot;&nbsp;
                        Personas {stats.personaCount || '—'}
                    </p>
                </div>
                <span className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-bold uppercase tracking-widest">
                    Completed
                </span>
            </div>

            {/* Collapsed Step Summary */}
            <div className="space-y-2 mb-8">
                {trace.map((t, i) => (
                    <div 
                        key={i}
                        className="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:border-white/10 transition-all cursor-pointer"
                        onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                    >
                        <span className={`text-[10px] font-bold ${statusColor[t.status] || 'text-white/30'}`}>
                            {statusIcon[t.status] || '●'}
                        </span>
                        <span className="text-[10px] text-white/25 font-bold w-6">{String(i + 1).padStart(2, '0')}</span>
                        <span className="flex-1 text-[11px] text-white/70 font-medium">{t.label}</span>
                        {t.status === 'done' || t.status === 'complete' ? (
                            <span className="text-[10px] text-white/20 uppercase tracking-widest font-bold">
                                {t.status === 'complete' ? 'Complete' : 'Done'}
                            </span>
                        ) : null}
                    </div>
                ))}
            </div>

            {/* Expanded Detail View */}
            {expandedStep !== null && trace[expandedStep] && (
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold text-white/80 uppercase tracking-wider">{trace[expandedStep].label}</h4>
                        <span className="text-[10px] text-white/25 font-mono">
                            {trace[expandedStep].timestamp || '—'}
                        </span>
                    </div>

                    {/* Tool Call Badge */}
                    {trace[expandedStep].toolName && (
                        <div className="mb-4">
                            <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-400 font-bold">
                                ⚡ {trace[expandedStep].toolName}
                            </span>
                        </div>
                    )}

                    {/* Details */}
                    {trace[expandedStep].details && (
                        <div className="space-y-2 mb-4">
                            {Object.entries(trace[expandedStep].details).map(([key, val]) => (
                                <div key={key} className="flex items-start gap-4">
                                    <span className="text-[9px] text-white/25 uppercase tracking-widest font-bold w-28 shrink-0 pt-0.5">{key}</span>
                                    <span className="text-[11px] text-white/60 font-normal leading-relaxed">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Latency */}
                    <div className="flex items-center gap-2 pt-3 border-t border-white/5">
                        <span className="text-[9px] text-white/20 uppercase tracking-widest font-bold">Latency</span>
                        <span className="text-[10px] text-white/50 font-mono">
                            {trace[expandedStep].latencyMs ? `${(trace[expandedStep].latencyMs / 1000).toFixed(1)}s` : '—'}
                        </span>
                    </div>
                </div>
            )}

            {/* Simulation Start Context */}
            {idea?.idea && (
                <div className="mt-8 pt-6 border-t border-white/5">
                    <h4 className="text-[9px] uppercase tracking-[0.3em] text-white/25 font-bold mb-3">Simulation Input</h4>
                    <div className="space-y-2">
                        <div className="flex gap-4">
                            <span className="text-[9px] text-white/20 uppercase tracking-widest font-bold w-20 shrink-0">Idea</span>
                            <span className="text-[11px] text-white/60">{idea.idea}</span>
                        </div>
                        <div className="flex gap-4">
                            <span className="text-[9px] text-white/20 uppercase tracking-widest font-bold w-20 shrink-0">Industry</span>
                            <span className="text-[11px] text-white/60">{idea.industry || 'General'}</span>
                        </div>
                        <div className="flex gap-4">
                            <span className="text-[9px] text-white/20 uppercase tracking-widest font-bold w-20 shrink-0">Target</span>
                            <span className="text-[11px] text-white/60">{idea.targetAudience || 'General public'}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
