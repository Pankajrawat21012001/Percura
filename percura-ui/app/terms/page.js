"use client";

import Link from "next/link";
import Image from "next/image";

export default function TermsPage() {
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
                        User Agreement
                    </span>
                    <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">Terms of Service</h1>
                    <p className="text-black/40 text-sm font-medium italic">Last updated: March 23, 2026</p>
                </div>

                <div className="space-y-10 text-[15px] leading-relaxed text-black/70">
                    <section>
                        <h2 className="text-xl font-black text-black mb-4">1. Acceptance of Terms</h2>
                        <p>
                            By signing up for and using Percura, you agree to these Terms of Service. If you are using Percura on behalf of a company, startup, or other organization, you represent that you have the authority to bind that organization to these terms.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-black mb-4">2. Description of Service</h2>
                        <p>
                            Percura provides an AI-powered validation engine that simulates market responses based on user-provided startup ideas. This service is intended for educational, research, and ideation purposes only. Our simulations reflect potential market outcomes but do not guarantee success or failure in the actual market.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-black mb-4">3. User Ownership</h2>
                        <p>
                            You retain full ownership, intellectual property rights, and copyright to all startup ideas, business concepts, or proprietary data you input into the Percura platform. Percura does not claim any ownership over your concepts and will not compete with you based on your inputs.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-black mb-4">4. Acceptable Use</h2>
                        <p className="mb-4">
                            You agree not to use Percura to:
                        </p>
                        <ul className="list-disc pl-5 space-y-2 mb-4">
                            <li>Process data that is illegal, defamatory, or violates others' IP.</li>
                            <li>Attempt to reverse-engineer our AI models or knowledge graph.</li>
                            <li>Use automated scripts to generate simulations without our consent.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-black mb-4">5. Disclaimer of Warranties</h2>
                        <p>
                            Percura is provided "as is." AI-generated insights are probabilistic in nature and may contain inaccuracies. We do not provide financial, legal, or professional business advice. Users should always complement Percura insights with primary market research.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-xl font-black text-black mb-4">6. Limitation of Liability</h2>
                        <p>
                            To the maximum extent permitted by law, Percura Inc. shall not be liable for any indirect, incidental, special, or consequential damages resulting from the use or inability to use our validation engine.
                        </p>
                    </section>

                    <section className="pt-10 border-t border-black/[0.06]">
                        <p>
                            Need help with our terms? Reach out at <a href="mailto:support@percura.ai" className="text-[#E85D3A] font-bold">support@percura.ai</a>
                        </p>
                    </section>
                </div>
            </main>

            <footer className="bg-[#FAFAFA] py-12 px-6 border-t border-black/[0.04]">
                <div className="max-w-[800px] mx-auto text-[11px] font-black text-black/30 uppercase tracking-[0.2em] flex flex-wrap gap-8 items-center">
                    <Link href="/" className="hover:text-black transition-colors">Home</Link>
                    <Link href="/privacy" className="hover:text-black transition-colors">Privacy Policy</Link>
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
