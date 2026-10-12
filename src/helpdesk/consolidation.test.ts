import { describe, expect, it } from 'vitest';
import { createInitialState } from '../data/demoData';
import { initialInternalState } from './useInternalTickets';
import { initialExternalState } from '../external/useExternal';
import { buildCollaborators } from '../org/collaborators';
import { applyFilters, consolidate, counters, EMPTY_FILTERS, staffing, teamObjectives, weeklyEvolution } from './consolidation';
import { isOpen } from '../external/metrics';

const NOW = new Date(2026, 9, 14, 11).getTime();
const agents = createInitialState().agents;
const internal = initialInternalState(4242, agents, NOW).state;
const external = initialExternalState(7, NOW).state;
const collabs = buildCollaborators(agents, external.techs);
const all = consolidate(Object.values(internal.tickets).flat(), Object.values(external.tickets).flat(), collabs, [...internal.techs, ...external.techs]);

describe('consolidation Helpdesk', () => {
  it('réunit tickets internes et externes sans doublon d’identifiant', () => {
    expect(all.some((t) => t.scope === 'interne')).toBe(true);
    expect(all.some((t) => t.scope === 'externe')).toBe(true);
    expect(new Set(all.map((t) => t.id)).size).toBe(all.length);
  });
  it('couvre les cinq outils ITSM et conserve identifiants et statuts source', () => {
    expect(new Set(all.map((t) => t.source.tool))).toEqual(new Set(['EasyVista', 'Jira', 'GLPI', 'ISILOG', 'Zendesk']));
    for (const t of all) {
      expect(t.source.id).toBeTruthy();
      expect(t.sourceStatus).toBeTruthy();
    }
    expect(all.some((t) => t.clientId === 'primagaz')).toBe(false); // ITSM non renseigné
  });
  it('attribue un manager à chaque ticket', () => {
    for (const t of all.filter((x) => x.scope === 'externe')) expect(t.managerId).toBe('mgr-mco');
    for (const t of all.filter((x) => x.scope === 'interne')) expect(['mgr-hd-lc', 'mgr-hd-mtp']).toContain(t.managerId);
  });
  it('les compteurs sont des sous-ensembles cohérents des tickets ouverts', () => {
    const k = counters(all, NOW);
    const open = new Set(all.filter(isOpen).map((t) => t.id));
    for (const key of ['enCours', 'enAttente', 'bloques', 'horsSla', 'procheSla', 'sansAffectation', 'critiques', 'backlog'] as const) for (const id of k[key]) expect(open.has(id)).toBe(true);
    expect(k.ouverts.length).toBe(open.size);
  });
  it('les filtres combinés produisent le même jeu pour tableau et Kanban', () => {
    const f = { ...EMPTY_FILTERS, tool: 'ISILOG' as const, priority: 'P3' as const };
    const res = applyFilters(all, f, NOW);
    expect(res.every((t) => t.source.tool === 'ISILOG' && t.priority === 'P3')).toBe(true);
    expect(applyFilters(all, { ...EMPTY_FILTERS, client: 'thelem' }, NOW).every((t) => t.clientName === 'THELEM')).toBe(true);
    expect(applyFilters(all, EMPTY_FILTERS, NOW).length).toBe(all.length);
  });
  it('effectifs : présents ⊂ prévus, disponibles et en communication ⊂ présents ; congés exclus', () => {
    const leave = new Map([[agents[0].id, ['2026-10-14']]]);
    const s = staffing(agents, external.techs, leave, '2026-10-14', new Set());
    expect(s.planned).not.toContain(agents[0].id);
    for (const id of s.present) expect(s.planned).toContain(id);
    for (const id of [...s.available, ...s.onCall]) expect(s.present).toContain(id);
  });
  it('objectifs : reste = max(0, objectif − réalisé) ; évolution sur 6 semaines', () => {
    const rows = teamObjectives(all, { 'int-thelem': 30, 'inv-n2': 10 }, NOW);
    expect(rows).toHaveLength(2);
    for (const r of rows) expect(r.remaining).toBe(Math.max(0, r.target - r.done));
    expect(weeklyEvolution(all, NOW)).toHaveLength(6);
  });
});
