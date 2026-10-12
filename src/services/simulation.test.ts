import { describe, expect, it } from 'vitest';
import { createInitialState } from '../data/demoData';
import { allStatuses } from '../lib/status';
import { createRng } from './random';
import { clientSummary, computeMetrics, simulateTick } from './simulation';

function run(seed: number, ticks: number) {
  const rng = createRng(seed);
  let state = createInitialState(0);
  for (let i = 0; i < ticks; i++) state = simulateTick(state, 5, rng);
  return state;
}

describe('simulateTick', () => {
  it("ne modifie pas l'état d'entrée", () => {
    const state = createInitialState(0);
    const snapshot = structuredClone(state);
    simulateTick(state, 5, createRng(1));
    expect(state).toEqual(snapshot);
  });

  it('est déterministe pour une même graine', () => {
    expect(run(7, 50)).toEqual(run(7, 50));
    expect(run(7, 50)).not.toEqual(run(8, 50));
  });

  it("fait avancer l'horodatage et le compteur", () => {
    const next = simulateTick(createInitialState(1000), 5, createRng(1));
    expect(next.tick).toBe(1);
    expect(next.updatedAt).toBe(6000);
  });

  it('respecte les invariants sur une longue simulation', () => {
    const state = run(42, 1000);
    for (const q of state.queues) {
      expect(q.waiting).toBeGreaterThanOrEqual(0);
      expect(q.waiting).toBeLessThanOrEqual(12);
      expect(q.sla).toBeGreaterThanOrEqual(70);
      expect(q.sla).toBeLessThanOrEqual(100);
      if (q.waiting === 0) expect(q.longestWaitSec).toBe(0);
    }
    for (const a of state.agents) expect(allStatuses).toContain(a.status);
    // Un agent hors ligne ne se reconnecte pas tout seul dans la démo.
    expect(state.agents.find((a) => a.name === 'Agent D05')?.status).toBe('Hors ligne');
  });

  it('fait évoluer les états des agents', () => {
    const initial = createInitialState(0);
    const later = run(42, 200);
    const changed = later.agents.filter((a, i) => a.status !== initial.agents[i].status);
    expect(changed.length).toBeGreaterThan(0);
  });
});

describe('computeMetrics', () => {
  it('agrège les indicateurs du jeu initial', () => {
    const m = computeMetrics(createInitialState(0));
    // Aucun agent N1 à Paris (pas de pôle client affecté).
    expect(m.agentsConnected).toBe(25); // 26 agents (La Ciotat et Montpellier), dont un hors ligne
    expect(m.waitingTotal).toBe(10);
    expect(m.onBreak).toBe(4);
    expect(m.openTickets).toBe(7);
    expect(m.slaGlobal).toBeGreaterThan(90);
    expect(m.slaGlobal).toBeLessThan(100);
  });
});

describe('clientSummary', () => {
  it('résume un pôle client', () => {
    const s = clientSummary(createInitialState(0), 'thelem');
    expect(s.waiting).toBe(4);
    expect(s.agentsConnected).toBe(4);
    expect(s.onBreak).toBe(1);
    expect(s.openTickets).toBe(2);
    // SLA pondéré : (92 × 186 + 95 × 64) / 250
    expect(s.sla).toBe(92.8);
    expect(s.slaTarget).toBe(95);
  });
});
