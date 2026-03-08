"use client";

export default function Card({
    children,
    className = "",
    glow = false,
    hover = true,
    ...props
}) {
    return (
        <div
            className={`bg-white/[0.07] border border-white/[0.18] rounded-2xl p-6 backdrop-blur-sm transition-all duration-300 ease-out ${hover ? "hover:bg-white/[0.10] hover:border-white/[0.25]" : ""
                } ${glow ? "glow-sm" : ""
                } ${className}`}
            {...props}
        >
            {children}
        </div>
    );
}
