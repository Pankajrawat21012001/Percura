"use client";

import { createContext, useContext, useState } from "react";

const IdeaContext = createContext(null);

export function IdeaProvider({ children }) {
    const [idea, setIdea] = useState(null);          // Form data (idea, industry, state, etc.)
    const [validation, setValidation] = useState(null); // Segments + personas from retrieval
    const [personas, setPersonas] = useState(null);     // Raw persona list
    const [simulationResults, setSimulationResults] = useState(null); // Results from simulation runs
    const [selectedSegment, setSelectedSegment] = useState(null); // Currently selected segment
    const [currentSimulationId, setCurrentSimulationId] = useState(null);

    const reset = () => {
        setIdea(null);
        setValidation(null);
        setPersonas(null);
        setSimulationResults(null);
        setSelectedSegment(null);
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
