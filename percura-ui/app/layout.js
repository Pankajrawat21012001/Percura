import "./globals.css";
import { IdeaProvider } from "../context/IdeaContext";
import { AuthProvider } from "../context/AuthContext";

export const metadata = {
  title: "Percura — Persona Testing Engine",
  description:
    "Test your idea against 1M+ real personas across India. AI-powered demographic matching and smart segmentation for startup validation.",
  manifest: "/site.webmanifest",
};

import { ToastProvider } from "../context/ToastContext";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@200;300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#F5F0EB] text-[#1A1A1A] min-h-screen antialiased">
        <AuthProvider>
          <IdeaProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </IdeaProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
