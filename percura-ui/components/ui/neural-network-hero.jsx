"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Suspense } from "react";
import * as THREE from "three";

useGLTF.preload("/models/head.glb");

/** ─── 3D HALF-HUMAN HEAD ─── **/
function HeadHeroObject() {
  const meshRef = useRef();
  const { nodes } = useGLTF("/models/head.glb");

  useFrame((state) => {
    if (meshRef.current) {
      const targetRotationY = (state.mouse.x * 0.8) + Math.sin(state.clock.elapsedTime * 0.1) * 0.05;
      const targetRotationX = -state.mouse.y * 0.4;
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetRotationY, 0.05);
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetRotationX, 0.05);
    }
  });

  // Cyber wireframe texture (red "+" dots)
  const tex = useMemo(() => {
    if (typeof window === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, 512, 512);
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

  // Load the human face texture
  const faceTexture = useLoader(THREE.TextureLoader, "/models/human_face.png");

  useEffect(() => {
    if (faceTexture) {
      faceTexture.colorSpace = THREE.SRGBColorSpace;
    }
  }, [faceTexture]);

  const geometry = Object.values(nodes).find(n => n.geometry)?.geometry;

  const bbox = useMemo(() => {
    if (!geometry) return null;
    geometry.computeBoundingBox();
    return geometry.boundingBox;
  }, [geometry]);

  // Custom split material: human skin on one half, cyber on the other
  const splitMaterial = useMemo(() => {
    if (!bbox || !faceTexture) return null;
    
    const mat = new THREE.MeshPhysicalMaterial({
      color: "#080808",
      roughness: 0.3,
      metalness: 0.9,
      clearcoat: 1,
    });
    
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uFaceTex = { value: faceTexture };
      shader.uniforms.uBBoxMin = { value: bbox.min };
      shader.uniforms.uBBoxMax = { value: bbox.max };
      
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vLocalPos;`
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vLocalPos = position;`
      );
      
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
         uniform sampler2D uFaceTex;
         uniform vec3 uBBoxMin;
         uniform vec3 uBBoxMax;
         varying vec3 vLocalPos;`
      );
      
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         vec2 normPos = vec2(
             (vLocalPos.x - uBBoxMin.x) / (uBBoxMax.x - uBBoxMin.x),
             (vLocalPos.y - uBBoxMin.y) / (uBBoxMax.y - uBBoxMin.y)
         );
         vec2 projectedUV = vec2(
             normPos.x * 0.9 + 0.05, 
             normPos.y * 1.15 - 0.15
         );
         vec4 faceColor = texture2D(uFaceTex, projectedUV);
         float split = smoothstep(-0.01, 0.01, vLocalPos.x);
         vec3 cyberColor = diffuseColor.rgb;
         diffuseColor = vec4(mix(cyberColor, faceColor.rgb, split), diffuseColor.a);
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         float splitMask = smoothstep(-0.01, 0.01, vLocalPos.x);
         roughnessFactor *= mix(0.3, 0.7, splitMask);
        `
      );
      
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
         float splitMaskM = smoothstep(-0.01, 0.01, vLocalPos.x);
         metalnessFactor *= mix(0.9, 0.02, splitMaskM);
        `
      );
    };
    return mat;
  }, [bbox, faceTexture]);

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} position={[0, -0.6, 0]} geometry={geometry} scale={0.52}>
      {splitMaterial && <primitive object={splitMaterial} attach="material" />}
      {tex && (
        <mesh geometry={geometry}>
          <meshBasicMaterial 
            map={tex} 
            transparent 
            opacity={0.65} 
            blending={THREE.AdditiveBlending} 
            depthWrite={false} 
            color="#FF2200"
            onBeforeCompile={(shader) => {
              shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>\nvarying vec3 vLocalPosWire;`
              ).replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>\nvLocalPosWire = position;`
              );
              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `#include <common>\nvarying vec3 vLocalPosWire;`
              ).replace(
                '#include <dithering_fragment>',
                `#include <dithering_fragment>\nif (vLocalPosWire.x > 0.01) discard;`
              );
            }}
          />
        </mesh>
      )}
    </mesh>
  );
}

/** ─── NEURAL NETWORK HERO SECTION ─── **/
export default function NeuralNetworkHero({ 
  title, 
  description, 
  badgeText, 
  badgeLabel, 
  ctaButtons = [], 
  microDetails = [] 
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-black to-purple-950/20" />
      
      {/* Subtle grid overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      {/* 3D Head Canvas */}
      {mounted && (
        <div className="absolute inset-0 z-0">
          <Canvas 
            camera={{ position: [0, 0, 2.8], fov: 45 }} 
            gl={{ antialias: true, alpha: true }}
            style={{ background: 'transparent' }}
          >
            <ambientLight intensity={0.3} />
            <directionalLight position={[5, 5, 5]} intensity={1.2} color="#ffffff" />
            <directionalLight position={[-3, 2, 4]} intensity={0.6} color="#E85D3A" />
            <pointLight position={[0, -2, 3]} intensity={0.4} color="#8B5CF6" />
            <Suspense fallback={null}>
              <HeadHeroObject />
            </Suspense>
          </Canvas>
        </div>
      )}

      {/* Content Overlay */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-4xl mx-auto">
        {/* Badge */}
        {(badgeText || badgeLabel) && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/[0.04] backdrop-blur-md mb-8">
            {badgeLabel && (
              <span className="text-[10px] uppercase font-black text-purple-400 tracking-widest">
                {badgeLabel}
              </span>
            )}
            {badgeText && (
              <span className="text-[11px] font-semibold text-white/50 tracking-wider">
                {badgeText}
              </span>
            )}
          </div>
        )}

        {/* Title */}
        <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95] tracking-tighter font-[900] text-white mb-6">
          {title}
        </h1>

        {/* Description */}
        <p className="text-lg md:text-xl text-white/50 font-normal leading-relaxed max-w-2xl mb-10">
          {description}
        </p>

        {/* CTA Buttons */}
        {ctaButtons.length > 0 && (
          <div className="flex flex-wrap gap-4 justify-center mb-12">
            {ctaButtons.map((btn, i) => (
              <Link
                key={i}
                href={btn.href || "/validate"}
                className={`inline-flex items-center gap-3 px-8 py-4 rounded-full text-sm font-bold transition-all hover:scale-[1.02] active:scale-95 ${
                  btn.primary 
                    ? "bg-white text-black hover:bg-white/90 shadow-xl shadow-white/5" 
                    : "bg-white/10 text-white border border-white/10 hover:bg-white/15"
                }`}
              >
                {btn.text}
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            ))}
          </div>
        )}

        {/* Micro Details */}
        {microDetails.length > 0 && (
          <div className="flex items-center gap-6 text-[10px] uppercase tracking-[0.3em] text-white/25 font-bold">
            {microDetails.map((detail, i) => (
              <span key={i} className="flex items-center gap-3">
                {i > 0 && <span className="w-1 h-1 rounded-full bg-white/15" />}
                {detail}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
