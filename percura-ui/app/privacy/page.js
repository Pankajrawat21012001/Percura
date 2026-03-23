"use client";

import Link from "next/link";
import Image from "next/image";

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-white text-[#1A1A1A] font-sans selection:bg-[#E85D3A]/20">
            {/* Header Navigation consistent with Landing Page */}
            <nav className="fixed top-0 left-0 right-0 z-50 bg-[#FFFFFF]/90 backdrop-blur-md border-b border-[rgba(0,0,0,0.06)]">
                <div className="max-w-[1400px] mx-auto px-6 h-16 md:h-20 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <Image src="/percura-icon.png" alt="Percura" width={28} height={28} className="object-contain" />
                        <span className="font-bold text-xl tracking-tight text-[#1A1A1A]">Percura</span>
                    </Link>
                    
                    <div className="flex items-center gap-6">
                        <Link href="/" className="hidden sm:block text-[13px] font-semibold text-black/60 hover:text-black transition-colors">Home</Link>
                        <Link href="/#solutions" className="hidden md:block text-[13px] font-semibold text-black/60 hover:text-black transition-colors">Simulation</Link>
                        <Link href="/#how" className="hidden md:block text-[13px] font-semibold text-black/60 hover:text-black transition-colors">How it works</Link>
                        <Link href="/validate" className="bg-[#1A1A1A] text-white px-6 py-2.5 rounded-full text-[13px] font-bold tracking-wide hover:scale-[1.02] active:scale-[0.98] transition-transform inline-block">
                            START VALIDATING
                        </Link>
                    </div>
                </div>
            </nav>

            <main className="max-w-[800px] mx-auto px-6 pt-32 pb-24">
                <div className="mb-12">
                    <span className="text-[10px] font-black uppercase text-[#E85D3A] tracking-widest bg-[#E85D3A]/5 px-3 py-1 rounded-full mb-6 inline-block">
                        Security First
                    </span>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Privacy Policy</h1>
                    <p className="text-black/40 text-sm font-medium italic">Last updated: March 23, 2026</p>
                </div>

                <div className="space-y-10 text-[15px] leading-relaxed text-black/70">
                    <section>
                        <h2 className="text-xl font-black text-black mb-4">1. Data Philosophy</h2>
                        <p>
                            At Percura, we understand that your startup ideas are your most valuable assets. Our entire infrastructure is built to ensure that these concepts remain private, secure, and under your absolute control. We do not sell your data, and we do not use your proprietary ideas to train global models.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-black mb-4">2. Information We Collect</h2>
                        <p className="mb-4">
                            To provide our validation services, we collect:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 mb-4">
                            <li><strong>Account Information:</strong> Name, email address, and authentication data.</li>
                            <li><strong>Simulation Input:</strong> Startup descriptions, target audience parameters, and market context provided by you.</li>
                            <li><strong>Usage Data:</strong> Anonymous analytics on how you interact with the platform to improve our engine.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-black mb-4">3. How Your Data is Used</h2>
                        <p>
                            We use your data strictly to perform the AI simulations you request. This involves processing your idea through our secure LLM pipelines (via Groq and OpenAI) and internal market knowledge graphs. Your data is isolated at the session level.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-black mb-4">4. Security Measures</h2>
                        <p>
                            All data is encrypted in transit and at rest using industry-standard protocols. We conduct regular security audits and maintain strict access controls to ensure your "secret sauce" remains secret.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-black mb-4">5. Third-Party Services</h2>
                        <p>
                            We partner with high-reliability AI infrastructure providers (Groq, Zep Cloud, OpenAI). We ensure these partners have strict non-disclosure policies and do not use our users' data for their own model training.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-black mb-4">6. Your Rights</h2>
                        <p>
                            You have the right to access, export, or delete your entire simulation history at any time. When you request a deletion, all associated idea vectors and chat logs are scrubbed from our systems permanently.
                        </p>
                    </section>

                    <section className="pt-10 border-t border-black/[0.06]">
                        <p>
                            Questions about your privacy? Contact us at <a href="mailto:security@percura.ai" className="text-[#E85D3A] font-bold">security@percura.ai</a>
                        </p>
                    </section>
                </div>
            </main>

            <footer className="bg-[#FAFAFA] py-12 px-6 border-t border-black/[0.04]">
                <div className="max-w-[800px] mx-auto text-[11px] font-black text-black/30 uppercase tracking-[0.2em] flex flex-wrap gap-8 items-center">
                    <Link href="/" className="hover:text-black transition-colors">Home</Link>
                    <Link href="/terms" className="hover:text-black transition-colors">Terms of Service</Link>
                    <a href="https://x.com/Percura_ai" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">X</a>
                    <a href="https://www.instagram.com/percura.in/" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">Instagram</a>
                    <a href="https://linkedin.com/company/percura" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">LinkedIn</a>
                    <a href="https://youtube.com/@percura_ai" target="_blank" rel="noopener noreferrer" className="hover:text-black transition-colors">YouTube</a>
                    <span>© 2026 Percura Inc.</span>
                </div>
            </footer>
        </div>
    );
}
