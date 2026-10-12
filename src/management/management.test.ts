import { describe, expect, it } from 'vitest';
import { createInitialState } from '../data/demoData';
import { buildTechnicians } from '../external/config';
import { initialManagement } from './useManagement';
import { leaveConflicts, leaveDays, teamPresence } from './rules';
import { craChecklist, leaveChecklist, NO_FILTERS, setFollow } from './checklists';
import { buildCollaborators, teamOf } from '../org/collaborators';

const NOW = new Date(2026, 9, 12, 10).getTime(); // lundi 12 octobre 2026
const agents = createInitialState().agents;
const techs = buildTechnicians(NOW);
const collabs = buildCollaborators(agents, techs);

describe('référentiel des collaborateurs', () => {
  it('rattache chaque agent N1 au manager Helpdesk de son site et les N2 au manager MCO', () => {
    for (const a of agents) expect(collabs.find((c) => c.id === a.id)!.managerId).toBe({ laciotat: 'mgr-hd-lc', montpellier: 'mgr-hd-mtp', paris: 'resp-helpdesk' }[a.site]);
    for (const t of techs) expect(collabs.find((c) => c.id === t.id)!.managerId).toBe('mgr-mco');
  });
  it('la responsable Helpdesk couvre tout le Helpdesk (directs et indirects)', () => {
    const scope = teamOf('resp-helpdesk', collabs).map((c) => c.id);
    for (const a of agents) expect(scope).toContain(a.id);
    for (const t of techs) expect(scope).toContain(t.id);
  });
});

describe('données de congés (outil RH)', () => {
  it('compte uniquement les jours ouvrés (week-end et fériés exclus)', () => {
    expect(leaveDays('2026-10-16', '2026-10-19')).toEqual(['2026-10-16', '2026-10-19']);
    expect(leaveDays('2026-11-10', '2026-11-12')).toEqual(['2026-11-10', '2026-11-12']);
  });
  it('signale le conflit de présence du pôle Thelem (information, pas une règle bloquante)', () => {
    const m = initialManagement(agents, techs, NOW);
    const pending = m.leaves.find((l) => l.status === 'Soumise' && m.collaborators.find((c) => c.id === l.personId)?.teamId === 'pole-thelem')!;
    const team = m.collaborators.filter((c) => c.teamId === 'pole-thelem');
    const day = leaveDays(pending.start, pending.end)[0];
    expect(teamPresence('pole-thelem', day, m.collaborators, m.leaves, pending).present).toBe(team.length - 2);
    const strict = { minTeamPresence: (team.length - 1) / team.length };
    expect(leaveConflicts(pending, m.collaborators, m.leaves, strict).length).toBeGreaterThan(0);
  });
});

describe('checklist CRA', () => {
  const m = initialManagement(agents, techs, NOW);
  const week = [...new Set(m.cra.map((s) => s.weekStart))].sort().pop()!;
  it('attendus = reçus + manquants ; en attente de validation ⊂ reçus', () => {
    const k = craChecklist(m.cra, m.collaborators, {}, { ...NO_FILTERS, week });
    expect(k.expected).toBe(k.received + k.missing);
    expect(k.pendingValidation).toBeLessThanOrEqual(k.received);
    expect(k.missingItems.every((i) => ['À saisir', 'Brouillon', 'À corriger'].includes(i.sheet.status))).toBe(true);
    expect(k.remaining).toBe(k.missing + k.pendingValidation);
  });
  it('une coche « Traité » met à jour le reste à traiter sans modifier les données sources', () => {
    const before = craChecklist(m.cra, m.collaborators, {}, { ...NO_FILTERS, week });
    const item = before.missingItems[0];
    const follow = setFollow({}, item.key, 'Traité', 'Manager', NOW);
    const after = craChecklist(m.cra, m.collaborators, follow, { ...NO_FILTERS, week });
    expect(after.remaining).toBe(before.remaining - 1);
    expect(after.missing).toBe(before.missing);
    expect(follow[item.key].history[0]).toMatchObject({ from: 'À traiter', to: 'Traité', by: 'Manager' });
    // Retour arrière : historique conservé.
    const back = setFollow(follow, item.key, 'Relancé', 'Manager', NOW + 1);
    expect(back[item.key].history).toHaveLength(2);
  });
  it('filtres par équipe et par manager', () => {
    const k = craChecklist(m.cra, m.collaborators, {}, { team: 'pole-thelem', manager: '', week });
    expect(k.expected).toBe(m.collaborators.filter((c) => c.teamId === 'pole-thelem').length);
    const mco = craChecklist(m.cra, m.collaborators, {}, { team: '', manager: 'mgr-mco', week });
    expect(mco.expected).toBe(m.collaborators.filter((c) => c.managerId === 'mgr-mco').length);
  });
});

describe('checklist congés', () => {
  it('liste les demandes en attente avec manager responsable et suivi', () => {
    const m = initialManagement(agents, techs, NOW);
    const k = leaveChecklist(m.leaves, m.collaborators, {}, m.rules, NO_FILTERS);
    expect(k.pending).toBe(m.leaves.filter((l) => l.status === 'Soumise').length);
    expect(k.items.every((i) => i.managerId)).toBe(true);
    const f = setFollow({}, k.items[0].key, 'Traité', 'Resp.', NOW);
    expect(leaveChecklist(m.leaves, m.collaborators, f, m.rules, NO_FILTERS).remaining).toBe(k.remaining - 1);
  });
});
