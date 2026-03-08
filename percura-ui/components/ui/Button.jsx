"use client";

export default function Button({
    children,
    onClick,
    variant = "primary",
    size = "md",
    disabled = false,
    className = "",
    showArrow = false,
    ...props
}) {
    const base =
        "inline-flex items-center justify-center font-bold rounded-full transition-all duration-300 ease-out cursor-pointer select-none tracking-tight active:scale-95";

    const variants = {
        primary:
            "bg-white text-black hover:bg-white/90 shadow-lg shadow-white/5",
        secondary:
            "bg-white/8 backdrop-blur-sm text-white/85 border border-white/15 hover:bg-white/15 hover:text-white",
        ghost:
            "bg-transparent text-white/65 hover:text-white/90 hover:bg-white/[0.08]",
    };

    const sizes = {
        sm: "px-5 py-2.5 text-sm",
        md: "px-7 py-3.5 text-base",
        lg: "px-9 py-4 text-lg",
        xl: "px-12 py-5 text-xl",
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`${base} ${variants[variant]} ${sizes[size]} ${disabled ? "opacity-30 cursor-not-allowed saturate-0" : ""
                } ${className}`}
            {...props}
        >
            <span className="relative z-10 flex items-center gap-2.5">
                {children}
                {showArrow && (
                    <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                )}
            </span>
        </button>
    );
}
