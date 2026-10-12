import { describe, expect, it } from 'vitest';
import { initialInternalState, INTERNAL_ID_START } from './useInternalTickets';
import { internalClients } from './internalClients';
import { itsmOf } from '../config/itsm';
import { createInitialState } from '../data/demoData';
import { dataset } from '../external/__tests__/fixtures';

const NOW = new Date(2026, 9, 14, 15, 30).getTime();
const agents = createInitialState(NOW).agents;
const { state } = initialInternalState(4242, agents, NOW);

describe('tickets multi-ITSM des plateaux internes', () => {
  it('chaque client interne doté d’un outil a des tickets issus de cet outil', () => {
    expect(internalClients.map((c) => c.id).sort()).toEqual(['ange', 'dmb', 'eurapharma', 'hstv', 'lbrfr', 'thelem', 'transgourmet']);
    for (const c of internalClients) {
      const list = state.tickets[c.id];
      expect(list.length, c.id).toBeGreaterThan(20);
      expect(list.every((t) => t.source.tool === itsmOf(c.id))).toBe(true);
    }
    expect(new Set(Object.values(state.tickets).flat().map((t) => t.source.tool))).toEqual(new Set(['ISILOG', 'EasyVista', 'Jira', 'GLPI']));
  });

  it('aucun ticket pour les clients sans ITSM (IRD, ORTEC, SODIAAL)', () => {
    for (const id of ['ird', 'ortec', 'sodiaal']) expect(state.tickets[id]).toBeUndefined();
  });

  it('les tickets sont traités par les agents du pôle et escaladés vers le MCO N2', () => {
    for (const t of Object.values(state.tickets).flat()) {
      if (t.assigneeId) {
        const agent = agents.find((a) => a.id === t.assigneeId)!;
        expect(agent).toBeDefined();
      }
      for (const e of t.escalations) {
        expect(e.from).toBe('Helpdesk N1');
        expect(e.to).toBe('MCO N2');
      }
    }
    // Pôle Multi dédié : DMB (EasyVista) et TRANSGOURMET (ISILOG) traités par les mêmes agents.
    const multi = new Set(agents.filter((a) => a.clientId === 'multi').map((a) => a.id));
    expect([...state.tickets.dmb, ...state.tickets.transgourmet].filter((t) => t.assigneeId).every((t) => multi.has(t.assigneeId!))).toBe(true);
  });

  it('identifiants internes uniques entre plateaux et sites clients externes', () => {
    const internal = Object.values(state.tickets).flat();
    const external = Object.values(dataset().tickets).flat();
    expect(internal.every((t) => Number(t.id.slice(4)) >= INTERNAL_ID_START)).toBe(true);
    const all = [...internal, ...external].map((t) => t.id);
    expect(new Set(all).size).toBe(all.length);
  });
});
