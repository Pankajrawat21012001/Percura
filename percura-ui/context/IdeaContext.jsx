"use client";

import { createContext, useContext, useState, useEffect } from "react";

const IdeaContext = createContext(null);

const STORAGE_KEY = "percura_last_simulation_id";

export function IdeaProvider({ children }) {
    const [idea, setIdea] = useState(null);
    const [validation, setValidation] = useState(null);
    const [personas, setPersonas] = useState(null);
    const [simulationResults, setSimulationResults] = useState(null);
    const [selectedSegment, setSelectedSegment] = useState(null);
    const [marketContext, setMarketContext] = useState(null);

    // Initialize from localStorage so page refreshes restore the last session
    const [currentSimulationId, setCurrentSimulationIdRaw] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem(STORAGE_KEY) || null;
        }
        return null;
    });

    // Wrapper that also saves to localStorage
    const setCurrentSimulationId = (id) => {
        setCurrentSimulationIdRaw(id);
        if (typeof window !== "undefined") {
            if (id) {
                localStorage.setItem(STORAGE_KEY, id);
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    };

    const reset = () => {
        setIdea(null);
        setValidation(null);
        setPersonas(null);
        setSimulationResults(null);
        setSelectedSegment(null);
        setMarketContext(null);
        setCurrentSimulationId(null);
    };

    return (
        <IdeaContext.Provider
            value={{
                idea, setIdea,
                validation, setValidation,
                personas, setPersonas,
                simulationResults, setSimulationResults,
                selectedSegment, setSelectedSegment,
                marketContext, setMarketContext,
                currentSimulationId, setCurrentSimulationId,
                reset,
            }}
        >
            {children}
        </IdeaContext.Provider>
    );
}

export function useIdea() {
    const ctx = useContext(IdeaContext);
    if (!ctx) throw new Error("useIdea must be used within IdeaProvider");
    return ctx;
}
