"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';

const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((type, title, message) => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts((prev) => [...prev, { id, type, title, message }]);

        // Auto-dismiss after 5 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, 5000);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
};

const ToastContainer = ({ toasts, removeToast }) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!mounted) return null;

    return createPortal(
        <div className="fixed bottom-8 right-8 z-[100] flex flex-col gap-4 pointer-events-none w-full max-w-sm">
            {toasts.map((toast) => (
                <ToastItem key={toast.id} {...toast} onRemove={() => removeToast(toast.id)} />
            ))}
        </div>,
        document.body
    );
};

const ToastItem = ({ type, title, message, onRemove }) => {
    const colors = {
        success: {
            bg: 'bg-[#0D0D0D]/90',
            border: 'border-emerald-500/20',
            dot: 'bg-emerald-500',
            icon: 'text-emerald-500',
            shadow: 'shadow-emerald-500/5'
        },
        error: {
            bg: 'bg-[#0D0D0D]/90',
            border: 'border-red-500/20',
            dot: 'bg-red-500',
            icon: 'text-red-500',
            shadow: 'shadow-red-500/5'
        },
        info: {
            bg: 'bg-[#0D0D0D]/90',
            border: 'border-indigo-500/20',
            dot: 'bg-indigo-500',
            icon: 'text-indigo-500',
            shadow: 'shadow-indigo-500/5'
        }
    };

    const config = colors[type] || colors.info;

    return (
        <div 
            className={`
                pointer-events-auto flex items-start gap-4 p-5 rounded-2xl border ${config.border} ${config.bg} backdrop-blur-xl ${config.shadow} shadow-2xl animate-in slide-in-from-right-10 duration-500
            `}
        >
            {/* Type Indicator Dot */}
            <div className={`w-2.5 h-2.5 rounded-full ${config.dot} mt-1.5 shrink-0 shadow-[0_0_10px_currentColor]`} />
            
            <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1">
                    {title}
                </h4>
                {message && (
                    <p className="text-xs text-white/50 font-medium leading-relaxed">
                        {message}
                    </p>
                )}
            </div>

            <button 
                onClick={onRemove}
                className="text-white/20 hover:text-white transition-colors p-1"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
        </div>
    );
};
