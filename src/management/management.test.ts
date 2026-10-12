import { describe, expect, it } from 'vitest';
import { createInitialState } from '../data/demoData';
import { buildTechnicians } from '../external/config';
import { initialManagement } from './useManagement';
import { canDecide, checkSubmission, craCounters, craGap, CRA_TRANSITIONS, DEMO_LEAVE_RULES, expectedHours, leaveConflicts, leaveDays, teamPresence, type LeaveRequest } from './rules';
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

describe('congés', () => {
  it('compte uniquement les jours ouvrés (week-end et fériés exclus)', () => {
    expect(leaveDays('2026-10-16', '2026-10-19')).toEqual(['2026-10-16', '2026-10-19']);
    expect(leaveDays('2026-11-10', '2026-11-12')).toEqual(['2026-11-10', '2026-11-12']);
  });
  it('bloque chevauchement, période vide et durée excessive ; avertit sur le préavis', () => {
    const existing: LeaveRequest[] = [{ id: 'X', personId: 'A01', type: 'RTT', start: '2026-10-20', end: '2026-10-21', status: 'Validée', submittedAt: 0, comments: [], history: [] }];
    expect(checkSubmission({ personId: 'A01', type: 'RTT', start: '2026-10-21', end: '2026-10-22' }, existing, DEMO_LEAVE_RULES, NOW).ok).toBe(false);
    expect(checkSubmission({ personId: 'A01', type: 'RTT', start: '2026-10-17', end: '2026-10-18' }, [], DEMO_LEAVE_RULES, NOW).errors[0]).toMatch(/aucun jour ouvré/);
    expect(checkSubmission({ personId: 'A01', type: 'Congés payés', start: '2026-11-02', end: '2026-12-04' }, [], DEMO_LEAVE_RULES, NOW).ok).toBe(false);
    const short = checkSubmission({ personId: 'A01', type: 'Congés payés', start: '2026-10-14', end: '2026-10-14' }, [], DEMO_LEAVE_RULES, NOW);
    expect(short.ok).toBe(true);
    expect(short.warnings[0]).toMatch(/Préavis/);
  });
  it('détecte le conflit de présence volontaire du pôle Thelem', () => {
    const m = initialManagement(agents, techs, NOW);
    const pending = m.leaves.find((l) => l.status === 'Soumise' && m.collaborators.find((c) => c.id === l.personId)?.teamId === 'pole-thelem')!;
    expect(pending).toBeDefined();
    const team = m.collaborators.filter((c) => c.teamId === 'pole-thelem');
    // Le seuil n'est franchi que si l'équipe est petite : on vérifie la cohérence du calcul.
    const day = leaveDays(pending.start, pending.end)[0];
    const presence = teamPresence('pole-thelem', day, m.collaborators, m.leaves, pending);
    expect(presence.size).toBe(team.length);
    expect(presence.present).toBe(team.length - 2);
    const strict = { ...DEMO_LEAVE_RULES, minTeamPresence: (team.length - 1) / team.length };
    expect(leaveConflicts(pending, m.collaborators, m.leaves, strict).length).toBeGreaterThan(0);
  });
  it('seul un manager de la chaîne ou un délégué actif peut décider', () => {
    const lc = collabs.find((c) => c.managerId === 'mgr-hd-lc')!;
    const mtp = collabs.find((c) => c.managerId === 'mgr-hd-mtp')!;
    expect(canDecide('mgr-hd-lc', lc.id, collabs, [], NOW).ok).toBe(true);
    expect(canDecide('resp-helpdesk', lc.id, collabs, [], NOW).ok).toBe(true);
    expect(canDecide('mgr-hd-lc', mtp.id, collabs, [], NOW).ok).toBe(false);
    const deleg = [{ id: 'D', fromManagerId: 'mgr-hd-mtp', toManagerId: 'mgr-hd-lc', start: '2026-10-12', end: '2026-10-18' }];
    expect(canDecide('mgr-hd-lc', mtp.id, collabs, deleg, NOW)).toEqual({ ok: true, via: 'mgr-hd-mtp' });
    expect(canDecide('mgr-hd-lc', mtp.id, collabs, deleg, NOW + 10 * 86_400_000).ok).toBe(false);
    expect(canDecide('mgr-hd-lc', 'mgr-hd-lc', collabs, [], NOW).ok).toBe(false);
  });
});

describe('CRA', () => {
  const c = collabs.find((x) => x.population === 'Agent N1')!;
  it('heures attendues = contrat moins les congés validés', () => {
    expect(expectedHours(c, '2026-10-12', [])).toBe(35);
    const leave: LeaveRequest = { id: 'L', personId: c.id, type: 'RTT', start: '2026-10-13', end: '2026-10-13', status: 'Validée', submittedAt: 0, comments: [], history: [] };
    expect(expectedHours(c, '2026-10-12', [leave])).toBe(28);
    expect(expectedHours(c, '2026-11-09', [])).toBe(28); // 11 novembre férié
  });
  it('calcule l’écart et respecte les transitions', () => {
    const sheet = { id: 'S', personId: c.id, weekStart: '2026-10-12', lines: [{ activity: 'THELEM', hours: [7, 7, 5, 7, 7] }], status: 'Soumis' as const, history: [] };
    expect(craGap(sheet, c, [])).toBe(-2);
    expect(CRA_TRANSITIONS['Soumis']).toEqual(['Validé', 'À corriger']);
    expect(CRA_TRANSITIONS['Validé']).toEqual([]);
  });
  it('compteurs cohérents : attendus = soumis + validés + manquants + à corriger', () => {
    const m = initialManagement(agents, techs, NOW);
    const k = craCounters(m.cra);
    expect(k.expected).toBe(k.submitted + k.validated + k.missing + k.toFix);
    expect(k.validatedHours).toBeLessThanOrEqual(k.declaredHours);
  });
});
