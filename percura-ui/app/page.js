"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Suspense } from "react";
import * as THREE from "three";

useGLTF.preload("/models/head.glb");

/** ─── 3D HERO COMPONENT ─── **/
function HeadHeroObject() {
  const meshRef = useRef();
  const { nodes } = useGLTF("/models/head.glb");

  useFrame((state) => {
    if (meshRef.current) {
      // Mouse interaction: smoothly rotate toward cursor
      const targetRotationY = (state.mouse.x * 0.8) + Math.sin(state.clock.elapsedTime * 0.1) * 0.05;
      const targetRotationX = -state.mouse.y * 0.4;
      
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotationY, 0.05);
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRotationX, 0.05);
    }
  });

  const tex = useMemo(() => {
    if (typeof window === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "black";
      ctx.fillRect(0,0,512,512);
      ctx.fillStyle = "#E85D3A";
      ctx.font = "bold 20px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let x = 16; x <= 512; x += 32) {
        for (let y = 16; y <= 512; y += 32) {
          ctx.fillText("+", x, y);
        }
      }
    }
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(12, 12);
    return t;
  }, []);

  // The glb has a Mesh named "mesh_0" or we just find the first geometry
  const geometry = Object.values(nodes).find(n => n.geometry)?.geometry;

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} position={[0, -0.6, 0]} geometry={geometry} scale={0.52}>
      <meshPhysicalMaterial 
        color="#080808" 
        roughness={0.3} 
        metalness={0.9} 
        clearcoat={1}
      />
      {tex && (
        <mesh geometry={geometry}>
          <meshBasicMaterial map={tex} transparent opacity={0.65} blending={THREE.AdditiveBlending} depthWrite={false} color="#FF2200" />
        </mesh>
      )}
    </mesh>
  );
}

const NavBar = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FFFFFF]/90 backdrop-blur-md border-b border-[rgba(0,0,0,0.06)]">
      <div className="max-w-[1400px] mx-auto px-6 h-16 md:h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <Image
            src="/percura-icon.png"
            alt="Percura"
            width={28}
            height={28}
            className="object-contain"
          />
          <span className="font-bold text-xl tracking-tight text-[#1A1A1A]">Percura</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-8 text-[13px] font-semibold text-black/60">
          <a href="#solutions" className="hover:text-black transition-colors">Simulation</a>
          <a href="#how" className="hover:text-black transition-colors">How it works</a>
        </div>

        <div>
          <Link href="/validate" className="bg-[#1A1A1A] text-white px-6 py-2.5 rounded-full text-[13px] font-bold tracking-wide hover:scale-[1.02] active:scale-[0.98] transition-transform inline-block">
            START VALIDATING
          </Link>
        </div>
      </div>
    </nav>
  );
};

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen bg-white text-[#1A1A1A] font-sans selection:bg-[#E85D3A]/20 relative overflow-x-hidden">
      {/* GLOBAL GRID LINES BACKGROUND */}
      <div className="fixed inset-0 pointer-events-none z-[0] flex justify-center opacity-[0.03]">
        <div className="w-full max-w-[1400px] h-full border-x border-black grid grid-cols-4">
          <div className="border-r border-black" />
          <div className="border-r border-black" />
          <div className="border-r border-black" />
          <div className="" />
        </div>
      </div>

      <NavBar />

      <main className="relative z-10 pt-20">
        {/* ─── 1. HERO SECTION ─── */}
        <section className="relative w-full max-w-[1400px] mx-auto min-h-[85vh] flex px-6 pt-10 pb-20">
          <div className="w-full grid lg:grid-cols-3 gap-10 lg:gap-0 justify-items-center">
            
            {/* Left Column Text */}
            <div className="flex flex-col items-start w-full lg:col-span-1 justify-self-start relative z-10 pt-4 self-start">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[rgba(0,0,0,0.06)] bg-white mb-6 shadow-sm">
                <span className="text-[9px] uppercase font-black text-[#E85D3A] bg-[#E85D3A]/10 px-2 py-0.5 rounded-full tracking-widest">
                  BETA
                </span>
                <span className="text-[11px] font-semibold text-black/60 tracking-wider">Validation Engine </span>
                <svg className="w-3 h-3 text-black/40" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </div>
              <h1 className="text-[clamp(3.2rem,6vw,5rem)] leading-[0.95] tracking-tighter font-[900]">
                Validate startup<br />
                ideas properly
              </h1>
              <p className="mt-6 text-black/50 text-[15px] max-w-[360px] leading-relaxed font-medium">
                Percura pairs powerful AI with rich demographic data so founders can validate product/market fit securely without losing time or resources.
              </p>
            </div>

            {/* Center 3D Component */}
            <div className="w-full lg:col-span-1 h-[400px] lg:h-[600px] relative flex justify-center items-center -mx-10 mix-blend-multiply z-0 self-center">
              {mounted && (
                <div className="absolute inset-[-100px] md:inset-[-200px] z-[5]">
                  <Canvas camera={{ position: [0, 0, 7.5], fov: 40 }}>
                    <ambientLight intensity={0.4} color="#FFF" />
                    <directionalLight position={[10, 10, 10]} intensity={1.5} color="#FFFFFF" />
                    <pointLight position={[-10, 0, -10]} intensity={1.5} color="#E85D3A" />
                    <pointLight position={[0, -10, 10]} intensity={0.5} color="#FFF" />
                    <Suspense fallback={null}>
                      <HeadHeroObject />
                    </Suspense>
                  </Canvas>
                </div>
              )}
            </div>

            {/* Right Column Text */}
            <div className="flex flex-col items-start lg:items-end w-full lg:col-span-1 justify-self-end text-left lg:text-right relative z-10 self-end pb-10">
              <h2 className="text-[clamp(2.5rem,4vw,3.5rem)] leading-[0.95] tracking-tighter font-[900] mb-8">
                with trusted<br />
                AI Personas.
              </h2>
              <div className="flex flex-wrap gap-4 justify-start lg:justify-end">
                <Link href="/validate" className="bg-[#1A1A1A] text-white px-8 py-3.5 rounded-full text-sm font-bold tracking-wide hover:scale-[1.02] active:scale-[0.98] transition-transform">
                  START VALIDATING
                </Link>
                <a href="#solutions" className="bg-white border text-black px-8 py-3.5 rounded-full text-sm font-bold tracking-wide hover:bg-black/[0.02] transition-colors border-[rgba(0,0,0,0.15)] flex items-center">
                  TEST YOUR IDEA
                </a>
              </div>
            </div>
          </div>
        </section>
        {/* ─── 3. SOLUTIONS SECTION ─── */}
        <section id="solutions" className="w-full max-w-[1400px] mx-auto pt-32 pb-0 relative">
          
          {/* Subtle Halftone Pattern Top Left */}
          <div className="absolute top-0 left-0 w-80 h-80 opacity-20 pointer-events-none" style={{ backgroundImage: "radial-gradient(circle, #000 1px, transparent 1.5px)", backgroundSize: "16px 16px" }} />

          {/* Section Divider & Header */}
          <div className="flex items-center justify-center mb-24 relative">
            <div className="absolute w-full h-[1px] bg-[rgba(0,0,0,0.06)]" />
            <div className="bg-white px-6 py-2 relative text-xs font-black tracking-[0.2em] text-black/30">
              [ <span className="text-[#E85D3A]">01</span> / 04 ] &nbsp;&nbsp;.&nbsp;&nbsp; SOLUTIONS
            </div>
          </div>

          <div className="flex flex-col items-center text-center mb-20 relative z-10 px-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(0,0,0,0.06)] bg-white mb-6">
              <span className="text-[10px] uppercase font-bold text-[#E85D3A] px-2 tracking-widest border-r border-[rgba(0,0,0,0.06)]">OUR</span>
              <span className="text-[11px] font-semibold text-black/60 tracking-wide px-2 uppercase">Validation Studio</span>
            </div>
            <h2 className="text-[clamp(2.2rem,4vw,3.5rem)] leading-[1.05] tracking-tighter font-black mb-6">
              A complete AI validation platform
            </h2>
            <p className="text-black/50 text-sm max-w-[500px] leading-relaxed font-semibold">
              Simulate entire market segments, test positioning in real time, and ensure every product decision is data-backed and deeply understood.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-0 border-t border-[rgba(0,0,0,0.06)] divide-y md:divide-y-0 md:divide-x divide-[rgba(0,0,0,0.06)]">
            {/* Card 1: Active/Elevated */}
            <div className="p-10 md:p-14 lg:p-20 flex flex-col items-center text-center bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.1)] relative z-10 md:scale-[1.02] border md:border-x border-[rgba(0,0,0,0.04)] sm:rounded-[2.5rem] md:rounded-[2rem] mx-4 md:mx-0 mb-4 md:mb-0">
              <div className="w-[72px] h-[72px] rounded-[1.25rem] border border-[#E85D3A]/10 bg-[#E85D3A]/5 flex items-center justify-center mb-8">
                <svg className="w-8 h-8 text-[#E85D3A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-2xl font-black mb-4 tracking-tight">Market Simulation</h3>
              <p className="text-sm text-black/50 leading-relaxed font-semibold">
                Test products securely with AI personas that act as real human segments.
              </p>
            </div>

            {/* Card 2: Flat */}
            <div className="p-10 md:p-14 lg:p-20 flex flex-col items-center text-center bg-transparent group hover:bg-[#FAFAFA] transition-colors">
              <div className="w-[72px] h-[72px] flex items-center justify-center mb-8 opacity-40 group-hover:opacity-60 transition-opacity">
                <svg className="w-8 h-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-4 tracking-tight">Interrogation Lab</h3>
              <p className="text-[13px] text-black/50 leading-relaxed font-medium">
                Interview personas exactly where they drop off in the conversion funnel.
              </p>
            </div>

            {/* Card 3: Flat */}
            <div className="p-10 md:p-14 lg:p-20 flex flex-col items-center text-center bg-transparent group hover:bg-[#FAFAFA] transition-colors relative">
              <div className="w-[72px] h-[72px] flex items-center justify-center mb-8 opacity-40 group-hover:opacity-60 transition-opacity">
                <svg className="w-8 h-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-4 tracking-tight flex-col sm:flex-row flex items-center gap-2">
                Knowledge Core
                <span className="text-[9px] uppercase font-black text-[#E85D3A] bg-[#E85D3A]/10 border border-[#E85D3A]/20 px-2 py-0.5 rounded-full tracking-widest">NEW</span>
              </h3>
              <p className="text-[13px] text-black/50 leading-relaxed font-medium">
                Guardrails, custom context, and analytics so your simulations remain grounded.
              </p>
            </div>
          </div>
        </section>



        {/* ─── 4. HOW IT WORKS (THE PROCESS) ─── */}
        <section id="how" className="w-full bg-white py-24 lg:py-36 relative overflow-hidden">
          {/* Background Decor */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#E85D3A]/[0.02] rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="max-w-[1400px] mx-auto px-6 relative z-10">
            <div className="grid lg:grid-cols-2 gap-16 xl:gap-24 items-end mb-24">
              <div className="max-w-[600px]">
                <div className="bg-white px-6 py-2 relative text-xs font-black tracking-[0.2em] text-black/30 mb-12">
                  [ <span className="text-[#E85D3A]">02</span> / 04 ] &nbsp;&nbsp;.&nbsp;&nbsp; PROCESS
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[rgba(0,0,0,0.06)] bg-[#FAFAFA] mb-6">
                  <span className="text-[10px] uppercase font-black text-[#E85D3A] tracking-widest">PROCESS</span>
                </div>
                <h2 className="text-[clamp(2.5rem,5vw,4rem)] leading-[0.95] tracking-tighter font-black mb-8">
                  How it works:<br />
                  The Percura Process
                </h2>
                <p className="text-black/50 text-base font-semibold leading-relaxed">
                  We've broken down startup validation into a science. No more surveys that take weeks—get deep psychological insights from your market in minutes.
                </p>
              </div>
              <div className="hidden lg:block pb-2 text-right">
                <span className="text-[120px] font-black text-black/[0.03] leading-none select-none">METHOD</span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                {
                  step: "01",
                  title: "Idea Context",
                  desc: "Input your concept and guardrails. Our engine builds a deep context around your problem space."
                },
                {
                  step: "02",
                  title: "Persona Synthesis",
                  desc: "We synthesize 50+ high-fidelity personas representing your exact target demographic."
                },
                {
                  step: "03",
                  title: "Live Simulation",
                  desc: "Watch as personas interact with your value prop, surfacing objections and resonances."
                },
                {
                  step: "04",
                  title: "Final Verdict",
                  desc: "Get a data-backed 'Go/No-Go' report with suggested pivots and market fit scores."
                }
              ].map((item, idx) => (
                <div key={idx} className="group p-8 rounded-3xl border border-black/[0.04] bg-[#FAFAFA] hover:bg-white hover:border-[#E85D3A]/20 transition-all duration-500 shadow-sm hover:shadow-xl">
                  <div className="text-[40px] font-black text-[#E85D3A]/10 group-hover:text-[#E85D3A]/20 transition-colors mb-4 italic">
                    {item.step}
                  </div>
                  <h4 className="text-xl font-black mb-3 tracking-tight">{item.title}</h4>
                  <p className="text-[14px] text-black/50 font-medium leading-relaxed italic">
                    "{item.desc}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── 5. FEATURES VISUAL SECTION (Changing ID to feature-visual) ─── */}
        <section id="feature-visual" className="w-full bg-[#FAFAFA] border-y border-[rgba(0,0,0,0.06)] py-20 lg:py-32 relative">
          <div className="max-w-[1400px] mx-auto px-6 grid xl:grid-cols-2 gap-16 xl:gap-24 items-start">
            
            {/* Visual Diagram Left Side (Real Knowledge Graph) */}
            <div className="w-full bg-white border border-[rgba(0,0,0,0.08)] rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.05)] flex flex-col p-8 sm:p-12 h-full min-h-[500px] justify-between relative group overflow-hidden">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-[#E85D3A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span className="text-[11px] font-black tracking-widest text-[#E85D3A] uppercase">Market Mapping</span>
                </div>
                <div className="text-[9px] font-black tracking-widest text-black/20 uppercase border border-black/[0.06] px-2 py-0.5 rounded-full">
                  Powered by Zep Cloud
                </div>
              </div>

              {/* Real Knowledge Graph Mockup */}
              <div className="relative w-full flex-1 flex items-center justify-center my-6 bg-[#FAFAFA] rounded-2xl border border-black/[0.03] overflow-hidden group-hover:border-[#E85D3A]/20 transition-all duration-500">
                <div className="absolute inset-0 opacity-40 mix-blend-multiply group-hover:scale-110 transition-transform duration-1000 grayscale group-hover:grayscale-0">
                   <Image 
                    src="/knowledge-graph-preview.png"
                    alt="Market Knowledge Graph"
                    fill
                    className="object-cover"
                   />
                </div>
                
                {/* Overlay Text for context */}
                <div className="z-10 bg-white/90 backdrop-blur-sm border border-black/[0.06] rounded-xl p-4 shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-all duration-500">
                  <p className="text-[10px] font-black text-black/30 uppercase tracking-[0.2em] mb-1">Entity Extraction</p>
                  <p className="text-sm font-bold text-[#1A1A1A]">Neural Segment Mapping</p>
                </div>
              </div>

              <div className="pt-6">
                <h3 className="text-2xl font-black mb-3 tracking-tight">Market Knowledge Graph</h3>
                <p className="text-[15px] text-black/50 font-medium mb-6 max-w-[320px]">
                  Map competitors, risks, and trends onto your idea using real-time market data extraction.
                </p>
                <div className="text-[13px] font-black flex items-center gap-2 hover:text-[#E85D3A] cursor-pointer w-fit group">
                  Scan Market Context <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </div>

            {/* Right Side Text / Code Preview */}
            <div className="flex flex-col gap-12 w-full pt-4">
              {/* Code Snippet Replacement: Real Simulation Preview */}
              <div className="bg-white border border-[rgba(0,0,0,0.08)] rounded-xl shadow-sm relative overflow-hidden flex flex-col group min-h-[460px]">
                <div className="absolute top-6 right-6 z-10 border border-[#E85D3A]/20 text-[#E85D3A] text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-[0.2em] bg-white translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-500">
                  REAL DASHBOARD
                </div>
                
                {/* Visual Content */}
                <div className="relative flex-1 flex flex-col">
                  {/* Persona Verdict Mockup - Matching Utkarsh Dubey from real screenshots */}
                  <div className="p-8 sm:p-10 flex-1 flex flex-col justify-center animate-in fade-in duration-700">
                    <div className="flex items-start gap-5 mb-8">
                      <div className="w-14 h-14 rounded-2xl bg-[#E85D3A]/5 border border-[#E85D3A]/10 flex items-center justify-center text-[1.5rem] shadow-sm transform transition-transform group-hover:scale-105 duration-500">
                        👨🏾‍💼
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h4 className="text-base font-black text-[#1A1A1A]">Utkarsh Dubey</h4>
                          <span className="text-[10px] font-black uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full tracking-widest border border-emerald-500/20">
                            ADOPTED
                          </span>
                        </div>
                        <p className="text-[11px] text-black/40 font-bold uppercase tracking-wider">Advertising Sales Agent · 21 · Maharashtra</p>
                      </div>
                    </div>

                    <div className="bg-[#FAFAFA] border-l-2 border-[#E85D3A] p-6 rounded-r-2xl mb-8 relative overflow-hidden group/quote">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-[#E85D3A]/[0.02] rounded-full translate-x-12 -translate-y-12" />
                      <div className="absolute top-1 right-2 text-3xl text-black/[0.03] font-serif">"</div>
                      <p className="text-[14px] leading-relaxed text-black/70 font-semibold italic">
                        "The resonance is clear. This isn't just an experimental tool; it directly targets our core inefficiency. My concern was privacy, but the guardrails shown solve for that."
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-8 border-t border-black/[0.04] pt-8">
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-widest text-black/30 font-bold block mb-1">Market Fit Score</span>
                        <div className="text-3xl font-black italic text-[#E85D3A]">85%</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase tracking-widest text-black/30 font-bold block mb-1">Decision Confidence</span>
                        <div className="text-3xl font-black italic text-black">8/10</div>
                      </div>
                    </div>
                  </div>

                  {/* Absolute Image Mockup Overlay on Hover - Using Real Screenshots */}
                  <div className="absolute inset-0 bg-white/95 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none flex flex-col items-center justify-center p-6 border-t border-black/[0.04] gap-4">
                    <div className="relative w-full h-[180px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] rounded-lg overflow-hidden border border-black/[0.08] translate-y-4 group-hover:translate-y-0 transition-transform duration-700">
                      <Image 
                        src="/interrogation-lab-preview.png"
                        alt="Interrogation Lab Dashboard"
                        fill
                        className="object-cover object-top"
                      />
                    </div>
                    <div className="relative w-full h-[180px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] rounded-lg overflow-hidden border border-black/[0.08] translate-y-4 group-hover:translate-y-0 transition-transform duration-1000">
                      <Image 
                        src="/validation-report-preview.png"
                        alt="Validation Report Dashboard"
                        fill
                        className="object-cover object-top"
                      />
                    </div>
                  </div>
                </div>

                {/* Bottom Bar Info */}
                <div className="p-6 border-t border-[rgba(0,0,0,0.06)] bg-[#FAFAFA] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#E85D3A] animate-pulse" />
                    <span className="text-[10px] font-black text-black/30 tracking-widest uppercase">Live Simulation</span>
                  </div>
                  <div className="text-[10px] font-black text-[#E85D3A] hover:opacity-80 transition-opacity cursor-pointer tracking-wider">
                    EXPLORE INTERROGATION LAB →
                  </div>
                </div>
              </div>

              {/* Lower Text Block */}
              <div className="px-4">
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-[#E85D3A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-[11px] font-black tracking-widest text-[#E85D3A] uppercase">Actionable Insights</span>
                </div>
                <h3 className="text-3xl font-black mb-4 tracking-tight">Data-backed Decisions</h3>
                <p className="text-[15px] text-black/50 font-medium mb-8 leading-relaxed max-w-[450px]">
                  Uncover what truly drives your customers. From pricing sensitivity to feature prioritization, get clear answers before you write a single line of code.
                </p>
                <div className="text-[14px] font-black flex items-center gap-2 hover:text-[#E85D3A] cursor-pointer w-fit group">
                  Start Validating <span className="group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </div>
            </div>
          </div>
        </section>

      </main>

      <footer className="w-full bg-white pt-24 pb-12 px-6 border-t border-[rgba(0,0,0,0.06)] relative z-10">
        <div className="max-w-[1400px] mx-auto flex flex-col items-center text-center">
          <Image
            src="/percura-icon.png"
            alt="Percura"
            width={32}
            height={32}
            className="mb-8 object-contain"
          />
          <h2 className="text-[clamp(1.8rem,3vw,3rem)] font-black tracking-tight mb-8">
            Stop Guessing. Start Validating.
          </h2>
          <Link href="/validate" className="bg-[#1A1A1A] text-white px-8 py-4 rounded-full text-[13px] font-bold tracking-wide hover:scale-[1.02] active:scale-[0.98] transition-transform">
            START FOR FREE
          </Link>
          <p className="mt-4 text-[11px] font-semibold text-black/40 tracking-wide uppercase">
            Free tier · 3 simulations/month · No credit card required
          </p>
          
          <div className="w-full flex flex-col md:flex-row justify-between items-center mt-32 pt-8 border-t border-[rgba(0,0,0,0.06)] text-xs font-bold text-black/40">
            <span>© 2026 Percura Inc.</span>
            <div className="flex flex-wrap justify-center gap-8 mt-6 md:mt-0">
               <a href="https://x.com/Percura_ai" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">X</a>
               <a href="https://www.instagram.com/percura.in/" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">Instagram</a>
               <a href="https://linkedin.com/company/percura" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">LinkedIn</a>
               <a href="https://youtube.com/@percura_ai" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">YouTube</a>
               <Link href="/terms" className="hover:text-black transition-colors">Terms</Link>
               <Link href="/privacy" className="hover:text-black transition-colors">Privacy</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
