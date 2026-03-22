"use client";

import { createContext, useContext, useState, useEffect } from "react";

const IdeaContext = createContext(null);

const SESSION_KEY = "percura_session_state";
const STORAGE_KEY = "percura_last_simulation_id";

export function IdeaProvider({ children }) {
    const [idea, setIdea] = useState(null);
    const [validation, setValidation] = useState(null);
    const [personas, setPersonas] = useState(null);
    const [simulationResults, setSimulationResults] = useState(null);
    const [selectedSegment, setSelectedSegment] = useState(null);
    const [fullSelectedSegments, setFullSelectedSegments] = useState(null);
    const [marketContext, setMarketContext] = useState(null);
    const [currentSimulationIdRaw, setCurrentSimulationIdRaw] = useState(null);

    // Rehydrate on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            try {
                const stored = sessionStorage.getItem(SESSION_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (parsed.idea) setIdea(parsed.idea);
                    if (parsed.validation) setValidation(parsed.validation);
                    if (parsed.simulationResults) setSimulationResults(parsed.simulationResults);
                    if (parsed.currentSimulationId) setCurrentSimulationIdRaw(parsed.currentSimulationId);
                    if (parsed.marketContext) setMarketContext(parsed.marketContext);
                }
                
                // Fallback for currentSimulationId from older localStorage
                const localId = localStorage.getItem(STORAGE_KEY);
                if (localId && !stored) {
                    setCurrentSimulationIdRaw(localId);
                }
            } catch (e) {
                console.error("Failed to rehydrate session state", e);
            }
        }
    }, []);

    // Serialize on change
    useEffect(() => {
        if (typeof window !== "undefined") {
            const stateToSave = {
                idea,
                validation,
                simulationResults,
                marketContext,
                currentSimulationId: currentSimulationIdRaw
            };
            sessionStorage.setItem(SESSION_KEY, JSON.stringify(stateToSave));
            
            // Also keep localStorage id in sync
            if (currentSimulationIdRaw) {
                localStorage.setItem(STORAGE_KEY, currentSimulationIdRaw);
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
    }, [idea, validation, simulationResults, marketContext, currentSimulationIdRaw]);

    const setCurrentSimulationId = (id) => {
        setCurrentSimulationIdRaw(id);
    };

    const reset = () => {
        setIdea(null);
        setValidation(null);
        setPersonas(null);
        setSimulationResults(null);
        setSelectedSegment(null);
        setMarketContext(null);
        setFullSelectedSegments(null);
        setCurrentSimulationIdRaw(null);
        if (typeof window !== "undefined") {
            sessionStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(STORAGE_KEY);
        }
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
                fullSelectedSegments, setFullSelectedSegments,
                currentSimulationId: currentSimulationIdRaw, setCurrentSimulationId,
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