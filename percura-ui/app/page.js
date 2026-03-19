"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { getSimulationHistory } from "../lib/simulationHistory";

const Hero = dynamic(() => import("../components/ui/neural-network-hero"), {
  ssr: false,
});

const PROOF_POINTS = [
  {
    stat: "1M+",
    label: "Indian Personas",
    description: "Test your idea against real demographic profiles spanning every Indian state, occupation, and age group.",
  },
  {
    stat: "12wk",
    label: "Simulation Depth",
    description:
      "Watch your product survive (or die) across a 12-week simulated market with evolving economics and social dynamics.",
  },
  {
    stat: "1:1",
    label: "Persona Interviews",
    description:
      "After the simulation, interrogate any persona. Ask them why they rejected you. They remember everything.",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Define Your Market",
    description:
      "Describe your target users, industry, and region. The engine builds a realistic economic environment around your idea.",
    icon: "🌍",
    color: "from-blue-500/20 to-cyan-500/20",
  },
  {
    step: "02",
    title: "Watch Personas Decide",
    description:
      "50+ AI personas — each with unique psychology — encounter your product week by week. Social influence, pricing friction, trust barriers — all simulated.",
    icon: "🧬",
    color: "from-purple-500/20 to-pink-500/20",
  },
  {
    step: "03",
    title: "Interrogate the Market",
    description:
      "Interview the personas who rejected you. Run panel discussions. Understand the real reasons your idea fails or succeeds — from the inside.",
    icon: "💬",
    color: "from-emerald-500/20 to-teal-500/20",
  },
];

function getTimeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export default function LandingPage() {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setHistory(getSimulationHistory());
  }, []);

  return (
    <div className="w-full min-h-screen overflow-x-hidden bg-black text-white selection:bg-white/20">
      {/* ── Hero Section ── */}
      <div className="w-screen h-screen flex flex-col relative">
        <Hero
          title="Watch AI Personas Encounter Your Idea"
          description="50+ autonomous personas. 12-week simulation. Then interrogate the ones who said no."
          badgeText="Simulation Lab"
          badgeLabel="Percura"
          ctaButtons={[
            { text: "Start Simulation", href: "/validate", primary: true },
          ]}
          microDetails={[
            "Persona-Based Modeling",
            "Market Simulation",
            "1:1 Interviews",
          ]}
        />
      </div>

      {/* ── Social Proof Bar ── */}
      <div className="border-t border-b border-white/[0.04] bg-white/[0.01]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-center gap-8 text-[10px] uppercase tracking-[0.3em] text-white/30 font-bold">
          <span>Not Surveys</span>
          <span className="w-1 h-1 rounded-full bg-white/15" />
          <span>Not Personas</span>
          <span className="w-1 h-1 rounded-full bg-white/15" />
          <span>Simulated Humans</span>
        </div>
      </div>

      {/* ── Proof Points ── */}
      <section className="relative py-24 px-6 md:px-10 lg:px-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 md:grid-cols-3">
            {PROOF_POINTS.map((item, i) => (
              <div key={i} className="text-center md:text-left group">
                <p className="text-5xl md:text-6xl font-light text-white/90 mb-2 tracking-tight">
                  {item.stat}
                </p>
                <p className="text-[10px] uppercase tracking-[0.25em] text-purple-400/70 font-bold mb-4">
                  {item.label}
                </p>
                <p className="text-sm text-white/50 font-normal leading-relaxed max-w-xs">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Pitch ── */}
      <section className="relative py-32 px-6 md:px-10 lg:px-20 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-purple-600/[0.03] blur-[120px] pointer-events-none rounded-full" />

        <div className="mx-auto max-w-4xl relative z-10 text-center">
          <p className="text-[10px] uppercase tracking-[0.4em] text-purple-400/60 font-bold mb-6">
            The Problem
          </p>
          <h2 className="text-3xl md:text-5xl font-light tracking-tight mb-8 leading-tight">
            You can&apos;t ask real users about a product
            <br />
            <span className="text-white/40">that doesn&apos;t exist yet.</span>
          </h2>
          <p className="text-lg text-white/40 font-normal leading-relaxed max-w-2xl mx-auto mb-12">
            Surveys lie. Focus groups perform. Your friends are too nice.
            Percura builds a society of AI personas — each with their own
            psychology, budget, and biases — and lets your idea loose inside it.
          </p>
          <Link
            href="/validate"
            className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-white text-black text-sm font-bold hover:bg-white/90 transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-white/5"
          >
            Run Your First Simulation
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </Link>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="relative py-32 px-6 md:px-10 lg:px-20 border-t border-white/[0.04]">
        <div className="mx-auto max-w-7xl relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-light tracking-tight mb-6">
              How It <span className="font-normal italic">Works</span>
            </h2>
            <p className="max-w-2xl mx-auto text-white/50 font-normal text-base">
              From idea to market intelligence in three steps.
            </p>
          </div>

          <div className="grid gap-8 lg:grid-cols-3">
            {HOW_IT_WORKS.map((item, i) => (
              <div
                key={i}
                className="group relative rounded-3xl border border-white/[0.08] bg-white/[0.03] p-10 transition-all duration-500 hover:bg-white/[0.06] hover:border-white/15"
              >
                {/* Gradient glow on hover */}
                <div
                  className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none`}
                />

                <div className="relative z-10">
                  {/* Step Number */}
                  <div className="flex items-center gap-4 mb-8">
                    <span className="text-3xl">{item.icon}</span>
                    <span className="text-[10px] uppercase tracking-[0.3em] text-white/25 font-bold">
                      Step {item.step}
                    </span>
                  </div>

                  <h3 className="text-xl font-normal text-white mb-4 tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-sm text-white/50 font-normal leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Past Simulations (only if history exists) ── */}
      {history.length > 0 && (
        <section className="relative py-20 px-6 md:px-10 lg:px-20 border-t border-white/[0.04]">
          <div className="mx-auto max-w-7xl">
            <div className="flex items-center justify-between mb-10">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/30 font-bold mb-2">Your Lab</p>
                <h2 className="text-2xl font-light tracking-tight">Past Simulations</h2>
              </div>
              <Link href="/validate" className="text-xs text-purple-400 hover:text-purple-300 transition-colors uppercase tracking-widest font-bold">
                + New Run
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {history.slice(0, 6).map((entry) => {
                const adoptionRate = entry.metrics.totalAgents > 0
                  ? Math.round((entry.metrics.adopted / entry.metrics.totalAgents) * 100)
                  : 0;
                const timeAgo = getTimeAgo(entry.timestamp);

                return (
                  <div key={entry.id} className="p-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all duration-300 group">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] uppercase tracking-widest text-white/25 font-bold">{timeAgo}</span>
                      <span className={`text-[11px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full
                        ${adoptionRate >= 50 ? 'text-emerald-400/80 bg-emerald-500/10' : adoptionRate >= 25 ? 'text-amber-400/80 bg-amber-500/10' : 'text-rose-400/80 bg-rose-500/10'}`}>
                        {adoptionRate}% adopted
                      </span>
                    </div>
                    <h3 className="text-sm font-medium text-white/80 mb-1 group-hover:text-white transition-colors">
                      {entry.config.industry} · {entry.config.stage}
                    </h3>
                    <p className="text-xs text-white/35 mb-3 line-clamp-1">
                      {entry.config.targetUser}
                    </p>
                    <div className="flex items-center gap-4 text-[10px] text-white/30">
                      <span>{entry.config.agentCount} personas</span>
                      <span>·</span>
                      <span>{entry.config.simulationLength}wk</span>
                      <span>·</span>
                      <span className="text-white/40 font-medium">{entry.metrics.survivalProbability}% survival</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Final CTA ── */}
      <section className="relative py-32 px-6">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-8">
            <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-2xl mx-auto mb-6">
              🧪
            </div>
            <h2 className="text-3xl md:text-4xl font-light tracking-tight mb-4">
              Your idea has a survival probability.
              <br />
              <span className="text-gradient">Do you want to know it?</span>
            </h2>
          </div>
          <Link
            href="/validate"
            className="inline-flex items-center gap-3 px-10 py-5 rounded-full bg-white text-black text-base font-bold hover:bg-white/90 transition-all hover:scale-[1.02] active:scale-95 shadow-[0_20px_60px_-15px_rgba(255,255,255,0.1)]"
          >
            Start Simulation
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </Link>
          <p className="text-white/25 text-xs mt-6 font-normal">
            No sign-up required. Free to run.
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.04] py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/20 font-bold">
            Percura · Persona Simulation Lab
          </span>
          <span className="text-[10px] text-white/15 font-normal">
            Built for founders who want the truth.
          </span>
        </div>
      </footer>
    </div>
  );
}
