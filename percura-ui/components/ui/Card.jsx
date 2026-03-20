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
            className={`bg-white border border-black/[0.08] rounded-2xl p-6 transition-all duration-300 ease-out ${hover ? "hover:border-black/[0.14] hover:shadow-lg hover:shadow-black/[0.03]" : ""
                } ${glow ? "glow-sm" : ""
                } ${className}`}
            {...props}
        >
            {children}
        </div>
    );
}
