import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createInitialState } from '../data/demoData';
import { createRng } from './random';
import { computeMetrics, simulateTick } from './simulation';

export const REFRESH_OPTIONS = [5, 15, 30] as const;
export type RefreshInterval = (typeof REFRESH_OPTIONS)[number];

/**
 * Simulation contrôlée : rafraîchissement périodique suspendu
 * lorsque l'onglet est masqué, intervalle réglable et rafraîchissement manuel.
 */
export function useDemoSimulation(seed = 42) {
  const [state, setState] = useState(() => createInitialState());
  const [running, setRunning] = useState(true);
  const [interval, setIntervalSec] = useState<RefreshInterval>(5);
  const rng = useRef(createRng(seed));

  const refresh = useCallback(() => {
    setState((s) => simulateTick(s, interval, rng.current, Date.now()));
  }, [interval]);

  const reset = useCallback(() => {
    rng.current = createRng(seed);
    setState(createInitialState());
  }, [seed]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, interval * 1000);
    return () => window.clearInterval(id);
  }, [running, interval, refresh]);

  const metrics = useMemo(() => computeMetrics(state), [state]);

  return { state, metrics, running, setRunning, interval, setInterval: setIntervalSec, refresh, reset };
}

export type DemoSimulation = ReturnType<typeof useDemoSimulation>;
