export function getSimulationHistory() {
  if (typeof window === 'undefined') return [];
  try {
    const history = localStorage.getItem('percura_simulations');
    return history ? JSON.parse(history) : [];
  } catch (e) {
    console.error('Failed to load simulation history', e);
    return [];
  }
}

export function saveSimulationToHistory(simulation) {
  if (typeof window === 'undefined') return;
  try {
    const history = getSimulationHistory();
    const newHistory = [simulation, ...history].slice(0, 10);
    localStorage.setItem('percura_simulations', JSON.stringify(newHistory));
  } catch (e) {
    console.error('Failed to save simulation to history', e);
  }
}
