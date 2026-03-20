"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getSimulationHistory } from "../lib/simulationHistory";

/* ─── Persona cards for phone mockup ─── */
const PERSONA_CARDS = [
  { name: "Priya Sharma", age: 28, city: "Mumbai", occupation: "UX Designer", verdict: "Adopted", image: "/personas/priya.png" },
  { name: "Rajesh Kumar", age: 42, city: "Jaipur", occupation: "Small Business Owner", verdict: "Rejected", image: "/personas/rajesh.png" },
  { name: "Ananya Iyer", age: 24, city: "Bangalore", occupation: "Graduate Student", verdict: "Adopted", image: "/personas/ananya.png" },
  { name: "Vikram Patel", age: 35, city: "Ahmedabad", occupation: "Chartered Accountant", verdict: "Considering", image: "/personas/vikram.png" },
  { name: "Meera Nair", age: 31, city: "Kochi", occupation: "Freelance Writer", verdict: "Adopted", image: "/personas/meera.png" },
];

const SERVICES = [
  {
    title: "Persona Simulation",
    description: "50+ AI personas with unique psychology, economics, and biases encounter your product week by week.",
    emoji: "🧬",
  },
  {
    title: "Market Intelligence",
    description: "12-week simulated market with evolving social dynamics, pricing friction, and trust barriers.",
    emoji: "📊",
  },
  {
    title: "Interrogation Lab",
    description: "Interview the personas who rejected you. Run panel discussions. Understand the real reasons.",
    emoji: "💬",
  },
];

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Define Your Market",
    description: "Describe your target users, industry, and region. The engine builds a realistic economic environment around your idea.",
  },
  {
    step: "02",
    title: "Watch Personas Decide",
    description: "50+ AI personas — each with unique psychology — encounter your product week by week. Social influence, pricing friction, trust barriers — all simulated.",
  },
  {
    step: "03",
    title: "Interrogate the Market",
    description: "Interview the personas who rejected you. Run panel discussions. Understand the real reasons your idea fails or succeeds.",
  },
];

const COMPARISON = [
  { feature: "Real demographic simulation", percura: true, traditional: false },
  { feature: "Results in under 10 minutes", percura: true, traditional: false },
  { feature: "1:1 persona interviews", percura: true, traditional: false },
  { feature: "No recruitment needed", percura: true, traditional: false },
  { feature: "Indian market specificity", percura: true, traditional: false },
  { feature: "Costs under ₹500", percura: true, traditional: false },
];

const FAQS = [
  {
    q: "How realistic are the AI personas?",
    a: "Each persona has a unique psychological profile, income level, spending habits, and social influence patterns — calibrated from real Indian demographic data.",
  },
  {
    q: "How long does a simulation take?",
    a: "A full 12-week simulation with 50+ personas typically completes in under 10 minutes. You get results immediately.",
  },
  {
    q: "Can I interview specific personas after the simulation?",
    a: "Yes! The Interrogation Lab lets you have 1:1 conversations with any persona. They remember every decision they made during the simulation.",
  },
  {
    q: "What kind of products can I test?",
    a: "Anything from D2C consumer products to SaaS tools to local services. The engine adapts its persona pool and market dynamics to your specific industry.",
  },
  {
    q: "Is this better than traditional surveys or focus groups?",
    a: "Surveys measure what people say. Focus groups measure performance. Percura measures what people would actually do — with no social desirability bias.",
  },
];

function getTimeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export default function LandingPage() {
  const [history, setHistory] = useState([]);
  const [openFaq, setOpenFaq] = useState(null);
  const [activePersona, setActivePersona] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setHistory(getSimulationHistory());
  }, []);

  /* Auto-cycle through persona portraits */
  useEffect(() => {
    const timer = setInterval(() => {
      setActivePersona((prev) => (prev + 1) % PERSONA_CARDS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  /* Sticky navbar scroll detection */
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="w-full min-h-screen overflow-x-hidden" style={{ background: "#F5F0EB", color: "#1A1A1A" }}>

      {/* ══════════════════════════════════════════════════════
          STICKY NAVBAR
      ══════════════════════════════════════════════════════ */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? "rgba(245,240,235,0.92)" : "transparent",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(0,0,0,0.06)" : "1px solid transparent",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <span style={{ fontFamily: "var(--font-serif)", fontSize: "1.5rem", fontWeight: 400 }}>
            Percura
          </span>
          <div className="hidden md:flex items-center gap-8 text-sm" style={{ color: "#6B6B6B" }}>
            <a href="#how-it-works" className="hover:text-[#1A1A1A] transition-colors">How It Works</a>
            <a href="#case-study" className="hover:text-[#1A1A1A] transition-colors">Case Study</a>
            <a href="#faq" className="hover:text-[#1A1A1A] transition-colors">FAQ</a>
          </div>
          <Link
            href="/validate"
            className="px-5 py-2.5 rounded-full text-sm font-medium transition-all hover:scale-105 active:scale-95"
            style={{ background: "#1A1A1A", color: "#fff" }}
          >
            Start Simulation
          </Link>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════
          HERO SECTION — split layout with phone mockup
      ══════════════════════════════════════════════════════ */}
      <section className="pt-32 pb-20 px-6 md:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center min-h-[70vh]">
          {/* Left: Headline */}
          <div>
            <p className="text-xs uppercase tracking-[0.3em] mb-6 font-semibold" style={{ color: "#9A9A9A" }}>
              Persona Simulation Lab
            </p>
            <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(2.5rem, 5vw, 4rem)", lineHeight: 1.1, fontWeight: 400 }}>
              Idea validation{" "}
              <br />
              done <em style={{ fontStyle: "italic" }}>right.</em>
            </h1>
            <p className="mt-6 text-lg leading-relaxed max-w-lg" style={{ color: "#6B6B6B" }}>
              50+ autonomous AI personas encounter your idea in a simulated market.
              Watch them adopt, reject, or hesitate — then interrogate the ones who said no.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/validate"
                className="px-8 py-4 rounded-full text-base font-semibold transition-all hover:scale-[1.03] active:scale-95"
                style={{ background: "#1A1A1A", color: "#fff" }}
              >
                Start Simulation →
              </Link>
              <a
                href="#how-it-works"
                className="px-8 py-4 rounded-full text-base font-medium transition-all hover:bg-black/5"
                style={{ border: "1px solid rgba(0,0,0,0.15)", color: "#1A1A1A" }}
              >
                See How It Works
              </a>
            </div>
          </div>

          {/* Right: Phone Mockup with Portrait Carousel */}
          <div className="flex justify-center lg:justify-end">
            <div
              className="relative"
              style={{
                width: 300,
                height: 600,
                borderRadius: 40,
                background: "#1A1A1A",
                padding: "12px",
                boxShadow: "0 40px 80px rgba(0,0,0,0.18), 0 10px 30px rgba(0,0,0,0.1)",
              }}
            >
              {/* Phone notch */}
              <div style={{
                position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
                width: 100, height: 24, borderRadius: 12, background: "#1A1A1A", zIndex: 10,
              }} />
              {/* Phone screen */}
              <div
                style={{
                  width: "100%", height: "100%", borderRadius: 30,
                  overflow: "hidden", position: "relative", background: "#E8E0D8",
                }}
              >
                {/* Portrait images carousel */}
                {PERSONA_CARDS.map((p, i) => (
                  <div
                    key={p.name}
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: i === activePersona ? 1 : 0,
                      transition: "opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  >
                    {/* Portrait image */}
                    <img
                      src={p.image}
                      alt={p.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        objectPosition: "center top",
                      }}
                    />
                    {/* Gradient overlay for text readability */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: "50%",
                        background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)",
                        pointerEvents: "none",
                      }}
                    />
                    {/* Intro card at bottom */}
                    <div
                      style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        padding: "20px",
                      }}
                    >
                      <p style={{
                        fontFamily: "var(--font-serif)",
                        fontSize: 22,
                        fontWeight: 400,
                        color: "#fff",
                        marginBottom: 4,
                      }}>
                        {p.name}
                      </p>
                      <p style={{ fontSize: 13, color: "rgba(255,255,255,0.7)", marginBottom: 10 }}>
                        {p.age} · {p.city} · {p.occupation}
                      </p>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "4px 12px",
                          borderRadius: 20,
                          background:
                            p.verdict === "Adopted" ? "rgba(34,197,94,0.25)" :
                            p.verdict === "Rejected" ? "rgba(239,68,68,0.25)" :
                            "rgba(245,158,11,0.25)",
                          color:
                            p.verdict === "Adopted" ? "#4ade80" :
                            p.verdict === "Rejected" ? "#f87171" :
                            "#fbbf24",
                          backdropFilter: "blur(8px)",
                        }}
                      >
                        {p.verdict}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Dot indicators */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 8,
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    gap: 6,
                    zIndex: 5,
                  }}
                >
                  {PERSONA_CARDS.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        width: i === activePersona ? 16 : 6,
                        height: 6,
                        borderRadius: 3,
                        background: i === activePersona ? "#fff" : "rgba(255,255,255,0.4)",
                        transition: "all 0.3s ease",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          SOCIAL PROOF BAR
      ══════════════════════════════════════════════════════ */}
      <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-center gap-8 text-xs uppercase tracking-[0.25em] font-semibold" style={{ color: "#9A9A9A" }}>
          <span>Not Surveys</span>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#ccc", display: "inline-block" }} />
          <span>Not Focus Groups</span>
          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#ccc", display: "inline-block" }} />
          <span>Simulated Humans</span>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          SERVICES — 3 card grid
      ══════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 md:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.8rem, 3vw, 2.8rem)", fontWeight: 400 }}>
              Everything you need to{" "}
              <em style={{ fontStyle: "italic" }}>validate</em>
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {SERVICES.map((s) => (
              <div
                key={s.title}
                className="p-8 rounded-3xl transition-all duration-300 hover:scale-[1.02]"
                style={{
                  background: "rgba(255,255,255,0.55)",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <span className="text-4xl block mb-6">{s.emoji}</span>
                <h3 className="text-xl font-semibold mb-3">{s.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#6B6B6B" }}>
                  {s.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          MISSION CARD
      ══════════════════════════════════════════════════════ */}
      <section className="py-20 px-6 md:px-10 lg:px-20">
        <div className="max-w-4xl mx-auto text-center">
          <div
            className="p-12 md:p-16 rounded-3xl"
            style={{
              background: "rgba(255,255,255,0.6)",
              border: "1px solid rgba(0,0,0,0.06)",
            }}
          >
            <p className="text-xs uppercase tracking-[0.3em] font-semibold mb-6" style={{ color: "#9A9A9A" }}>
              Our Mission
            </p>
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.6rem, 3vw, 2.5rem)", fontWeight: 400, lineHeight: 1.3 }}>
              Turning market uncertainty
              <br />
              into <em style={{ fontStyle: "italic" }}>validated insight.</em>
            </h2>
            <p className="mt-6 text-base max-w-2xl mx-auto leading-relaxed" style={{ color: "#6B6B6B" }}>
              Percura builds a society of AI personas — each with their own psychology, budget, and biases —
              and lets your idea loose inside it. No surveys. No guessing. Just simulated truth.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          CASE STUDY
      ══════════════════════════════════════════════════════ */}
      <section id="case-study" className="py-24 px-6 md:px-10 lg:px-20">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs uppercase tracking-[0.3em] font-semibold mb-4" style={{ color: "#9A9A9A" }}>
            Case Study
          </p>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.6rem, 3vw, 2.5rem)", fontWeight: 400, marginBottom: "2rem" }}>
            Testing a D2C Health Snack in Tier-2 India
          </h2>
          <div className="grid gap-6 md:grid-cols-3 mb-8">
            {[
              { label: "Adoption Rate", value: "34%", color: "#22c55e" },
              { label: "Survival Probability", value: "62%", color: "#3b82f6" },
              { label: "Avg. Decision Time", value: "Week 4", color: "#f59e0b" },
            ].map((m) => (
              <div
                key={m.label}
                className="p-6 rounded-2xl text-center"
                style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.06)" }}
              >
                <p className="text-3xl font-bold mb-1" style={{ color: m.color }}>{m.value}</p>
                <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#9A9A9A" }}>
                  {m.label}
                </p>
              </div>
            ))}
          </div>
          <div
            className="p-8 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.5)", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            <p className="text-sm font-semibold mb-3">Top Rejection Reasons</p>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                "Price too high for perceived value (₹299/box)",
                "Unfamiliar brand — no social proof yet",
                "Preference for local alternatives",
                "Packaging didn't communicate health benefits clearly",
              ].map((r, i) => (
                <div key={i} className="flex items-start gap-3 text-sm" style={{ color: "#6B6B6B" }}>
                  <span style={{ color: "#ef4444", fontWeight: 700, flexShrink: 0 }}>✕</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════════════════════════ */}
      <section id="how-it-works" className="py-24 px-6 md:px-10 lg:px-20" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.8rem, 3vw, 2.8rem)", fontWeight: 400 }}>
              How it <em style={{ fontStyle: "italic" }}>works</em>
            </h2>
            <p className="mt-4 max-w-xl mx-auto" style={{ color: "#6B6B6B" }}>
              From idea to market intelligence in three steps.
            </p>
          </div>
          <div className="grid gap-8 lg:grid-cols-3">
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.step}
                className="p-8 rounded-3xl transition-all duration-300 hover:scale-[1.02]"
                style={{
                  background: "rgba(255,255,255,0.55)",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <span className="text-xs uppercase tracking-[0.3em] font-bold block mb-4" style={{ color: "#9A9A9A" }}>
                  Step {item.step}
                </span>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#6B6B6B" }}>
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          TESTIMONIAL
      ══════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 md:px-10 lg:px-20">
        <div className="max-w-4xl mx-auto text-center">
          <div
            className="p-12 md:p-16 rounded-3xl"
            style={{ background: "#1A1A1A", color: "#fff" }}
          >
            <p className="text-xs uppercase tracking-[0.3em] font-semibold mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>
              What Founders Say
            </p>
            <blockquote style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.3rem, 2.5vw, 1.8rem)", lineHeight: 1.5, fontWeight: 400 }}>
              &ldquo;We spent ₹2L on focus groups and got polite answers. Percura gave us the{" "}
              <em style={{ fontStyle: "italic", color: "rgba(255,255,255,0.6)" }}>brutal truth</em>{" "}
              in 10 minutes — and it turned out to be exactly right.&rdquo;
            </blockquote>
            <p className="mt-8 text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              — Hypothetical D2C Founder, Bangalore
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          COMPARISON TABLE
      ══════════════════════════════════════════════════════ */}
      <section className="py-24 px-6 md:px-10 lg:px-20" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.6rem, 3vw, 2.5rem)", fontWeight: 400 }}>
              Why Percura over{" "}
              <em style={{ fontStyle: "italic" }}>traditional research?</em>
            </h2>
          </div>
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(0,0,0,0.06)" }}
          >
            {/* Header */}
            <div className="grid grid-cols-3 p-4 text-xs uppercase tracking-widest font-semibold" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", color: "#9A9A9A" }}>
              <span>Feature</span>
              <span className="text-center">Percura</span>
              <span className="text-center">Traditional</span>
            </div>
            {/* Rows */}
            {COMPARISON.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-3 p-4 text-sm items-center"
                style={{ borderBottom: i < COMPARISON.length - 1 ? "1px solid rgba(0,0,0,0.04)" : "none" }}
              >
                <span>{row.feature}</span>
                <span className="text-center text-lg">{row.percura ? "✓" : "✕"}</span>
                <span className="text-center text-lg" style={{ color: "#ccc" }}>{row.traditional ? "✓" : "✕"}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          PAST SIMULATIONS (conditional)
      ══════════════════════════════════════════════════════ */}
      {history.length > 0 && (
        <section className="py-20 px-6 md:px-10 lg:px-20" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-10">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] font-semibold mb-2" style={{ color: "#9A9A9A" }}>
                  Your Lab
                </p>
                <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.5rem", fontWeight: 400 }}>
                  Past Simulations
                </h2>
              </div>
              <Link
                href="/validate"
                className="text-xs uppercase tracking-widest font-bold hover:opacity-70 transition-opacity"
                style={{ color: "#1A1A1A" }}
              >
                + New Run
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {history.slice(0, 6).map((entry) => {
                const adoptionRate =
                  entry.metrics.totalAgents > 0
                    ? Math.round((entry.metrics.adopted / entry.metrics.totalAgents) * 100)
                    : 0;
                const timeAgo = getTimeAgo(entry.timestamp);
                return (
                  <div
                    key={entry.id}
                    className="p-5 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
                    style={{
                      background: "rgba(255,255,255,0.55)",
                      border: "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#9A9A9A" }}>
                        {timeAgo}
                      </span>
                      <span
                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{
                          background:
                            adoptionRate >= 50
                              ? "rgba(34,197,94,0.12)"
                              : adoptionRate >= 25
                              ? "rgba(245,158,11,0.12)"
                              : "rgba(239,68,68,0.12)",
                          color:
                            adoptionRate >= 50
                              ? "#16a34a"
                              : adoptionRate >= 25
                              ? "#d97706"
                              : "#dc2626",
                        }}
                      >
                        {adoptionRate}% adopted
                      </span>
                    </div>
                    <h3 className="text-sm font-semibold mb-1">
                      {entry.config.industry} · {entry.config.stage}
                    </h3>
                    <p className="text-xs mb-3 line-clamp-1" style={{ color: "#9A9A9A" }}>
                      {entry.config.targetUser}
                    </p>
                    <div className="flex items-center gap-3 text-xs" style={{ color: "#9A9A9A" }}>
                      <span>{entry.config.agentCount} personas</span>
                      <span>·</span>
                      <span>{entry.config.simulationLength}wk</span>
                      <span>·</span>
                      <span style={{ fontWeight: 600 }}>{entry.metrics.survivalProbability}% survival</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════
          FAQ ACCORDION
      ══════════════════════════════════════════════════════ */}
      <section id="faq" className="py-24 px-6 md:px-10 lg:px-20" style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.6rem, 3vw, 2.5rem)", fontWeight: 400 }}>
              Frequently asked{" "}
              <em style={{ fontStyle: "italic" }}>questions</em>
            </h2>
          </div>
          <div className="flex flex-col gap-3">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className="rounded-2xl overflow-hidden transition-all duration-300"
                style={{
                  background: "rgba(255,255,255,0.55)",
                  border: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <button
                  className="w-full text-left p-5 flex items-center justify-between text-sm font-semibold cursor-pointer"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span>{faq.q}</span>
                  <span
                    className="text-lg transition-transform duration-300 flex-shrink-0 ml-4"
                    style={{ transform: openFaq === i ? "rotate(45deg)" : "rotate(0)" }}
                  >
                    +
                  </span>
                </button>
                <div
                  style={{
                    maxHeight: openFaq === i ? 200 : 0,
                    overflow: "hidden",
                    transition: "max-height 0.3s ease",
                  }}
                >
                  <p className="px-5 pb-5 text-sm leading-relaxed" style={{ color: "#6B6B6B" }}>
                    {faq.a}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════════════ */}
      <section className="py-32 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.8rem, 3vw, 2.8rem)", fontWeight: 400, lineHeight: 1.2 }}>
            Your validation journey
            <br />
            starts <em style={{ fontStyle: "italic" }}>right here.</em>
          </h2>
          <p className="mt-6 text-base" style={{ color: "#6B6B6B" }}>
            No sign-up required. Free to run. Results in under 10 minutes.
          </p>
          <Link
            href="/validate"
            className="mt-10 inline-flex items-center gap-3 px-10 py-5 rounded-full text-base font-semibold transition-all hover:scale-[1.03] active:scale-95"
            style={{ background: "#1A1A1A", color: "#fff" }}
          >
            Start Simulation
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          FOOTER
      ══════════════════════════════════════════════════════ */}
      <footer style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }} className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid gap-12 md:grid-cols-4 mb-12">
            <div>
              <span style={{ fontFamily: "var(--font-serif)", fontSize: "1.3rem", fontWeight: 400 }}>
                Percura
              </span>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: "#6B6B6B" }}>
                AI-powered persona simulation for startup idea validation.
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest font-semibold mb-4" style={{ color: "#9A9A9A" }}>
                Product
              </p>
              <div className="flex flex-col gap-2 text-sm" style={{ color: "#6B6B6B" }}>
                <Link href="/validate" className="hover:text-[#1A1A1A] transition-colors">Start Simulation</Link>
                <a href="#how-it-works" className="hover:text-[#1A1A1A] transition-colors">How It Works</a>
                <a href="#case-study" className="hover:text-[#1A1A1A] transition-colors">Case Study</a>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest font-semibold mb-4" style={{ color: "#9A9A9A" }}>
                Resources
              </p>
              <div className="flex flex-col gap-2 text-sm" style={{ color: "#6B6B6B" }}>
                <a href="#faq" className="hover:text-[#1A1A1A] transition-colors">FAQ</a>
                <span>Documentation</span>
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest font-semibold mb-4" style={{ color: "#9A9A9A" }}>
                Legal
              </p>
              <div className="flex flex-col gap-2 text-sm" style={{ color: "#6B6B6B" }}>
                <span>Privacy Policy</span>
                <span>Terms of Service</span>
              </div>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: "1.5rem" }} className="flex flex-col md:flex-row items-center justify-between gap-4">
            <span className="text-xs" style={{ color: "#9A9A9A" }}>
              © 2026 Percura · Persona Simulation Lab
            </span>
            <span className="text-xs" style={{ color: "#9A9A9A" }}>
              Built for founders who want the truth.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
