// État du management (démonstration) : congés, CRA, délégations et objectifs N1.
// Les décisions sont réellement appliquées dans l'environnement simulé et
// répercutées dans les autres modules (présence, CRA en attente, ventilation des coûts).
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Agent } from '../types';
import type { Technician } from '../external/types';
import { addDays, dateKey, isBusinessDay, startOfWeek } from '../external/calendar';
import { createRng, type Rng } from '../services/random';
import { can, type Role } from '../auth/roles';
import { buildCollaborators, type Collaborator } from '../org/collaborators';
import { personById } from '../org/people';
import type { ObjectiveConfig } from '../external/config';
import { clientRecord, POLE_CLIENTS } from '../config/itsm';
import {
  canDecide,
  checkSubmission,
  CRA_TRANSITIONS,
  DEMO_LEAVE_RULES,
  leaveConflicts,
  leaveDays,
  weekKey,
  type CraLine,
  type CraSheet,
  type Delegation,
  type LeaveRequest,
  type LeaveRules,
  type LeaveType,
  WORK_CALENDAR,
} from './rules';

export interface ManagementState {
  collaborators: Collaborator[];
  leaves: LeaveRequest[];
  cra: CraSheet[];
  delegations: Delegation[];
  rules: LeaveRules;
  internalObjectives: Record<string, ObjectiveConfig>;
}

export interface MgmtResult {
  ok: boolean;
  message: string;
  warnings?: string[];
}

/** Objectifs hebdomadaires de démonstration des équipes N1 (par client). */
export const DEFAULT_N1_OBJECTIVES: ObjectiveConfig = { ticketsToResolve: 28, backlogMax: 16, priorityOpenMax: 2, slaMin: 90, takeChargeMaxMin: 60, resolutionMaxH: 12, reopenRateMax: 5 };

const actorName = (id: string) => personById(id)?.name ?? id;

/** Activités CRA possibles : clients traités et activités internes. */
export function craActivities(c: Collaborator): string[] {
  const clients = c.clientId
    ? [clientRecord(c.clientId)?.name ?? c.clientId.toUpperCase()]
    : c.teamId.startsWith('pole-')
      ? (POLE_CLIENTS[c.teamId.slice(5)] ?? []).map((id) => clientRecord(id)?.name ?? id)
      : [];
  return [...clients, 'Formation', 'Réunion interne', 'Projet interne'];
}

function seedLeaves(collabs: Collaborator[], techs: Technician[], now: number, rng: Rng): LeaveRequest[] {
  const leaves: LeaveRequest[] = [];
  let n = 1;
  const add = (personId: string, type: LeaveType, start: number, end: number, status: LeaveRequest['status'], submittedDaysAgo: number) => {
    const submittedAt = now - submittedDaysAgo * 86_400_000;
    leaves.push({
      id: `CG-${String(n++).padStart(4, '0')}`,
      personId,
      type,
      start: dateKey(start),
      end: dateKey(end),
      status,
      submittedAt,
      comments: [],
      history: [
        { at: submittedAt, by: collabs.find((c) => c.id === personId)?.name ?? personId, action: 'Soumission' },
        ...(status !== 'Soumise' ? [{ at: submittedAt + 86_400_000, by: actorName(collabs.find((c) => c.id === personId)?.managerId ?? 'resp-helpdesk'), action: status === 'Validée' ? 'Validation' : 'Refus', note: status === 'Refusée' ? 'Période de forte activité' : undefined }] : []),
      ],
    });
  };
  // Congés déjà posés des techniciens N2 (configuration des sites clients).
  for (const t of techs) {
    if (t.leaveDates.length) {
      const sorted = [...t.leaveDates].sort();
      const [y, m, d] = sorted[0].split('-').map(Number);
      const [y2, m2, d2] = sorted[sorted.length - 1].split('-').map(Number);
      add(t.id, 'Congés payés', new Date(y, m - 1, d).getTime(), new Date(y2, m2 - 1, d2).getTime(), 'Validée', 20);
    }
  }
  const agents = collabs.filter((c) => c.population === 'Agent N1');
  const day = (offset: number) => addDays(now, offset);
  // Conflit volontaire : deux agents du pôle Thelem demandent les mêmes jours.
  const thelem = agents.filter((a) => a.teamId === 'pole-thelem');
  add(thelem[0].id, 'Congés payés', day(9), day(11), 'Validée', 12);
  add(thelem[1].id, 'Congés payés', day(10), day(11), 'Soumise', 2);
  // Autres demandes en attente, validées ou refusées.
  const picks = agents.filter((a) => !a.teamId.startsWith('pole-thelem'));
  for (let i = 0; i < 7; i++) {
    const a = picks[Math.floor(rng() * picks.length)];
    const start = day(5 + Math.floor(rng() * 25));
    const status = i < 4 ? 'Soumise' : i < 6 ? 'Validée' : 'Refusée';
    add(a.id, i % 3 === 0 ? 'RTT' : 'Congés payés', start, addDays(start, Math.floor(rng() * 4)), status, 1 + Math.floor(rng() * 6));
  }
  const n2 = collabs.filter((c) => c.population === 'Technicien N2');
  add(n2[2].id, 'Formation', day(14), day(15), 'Soumise', 3);
  return leaves;
}

function seedCra(collabs: Collaborator[], leaves: LeaveRequest[], now: number, rng: Rng): CraSheet[] {
  const sheets: CraSheet[] = [];
  // CRA hebdomadaires remis en fin de semaine : les deux dernières semaines échues.
  const weeks = [dateKey(addDays(startOfWeek(now), -14)), dateKey(addDays(startOfWeek(now), -7))];
  const people = collabs.filter((c) => c.population === 'Agent N1' || c.population === 'Technicien N2');
  for (const [wi, week] of weeks.entries()) {
    for (const c of people) {
      const acts = craActivities(c);
      const [y, m, d] = week.split('-').map(Number);
      const start = new Date(y, m - 1, d).getTime();
      const off = new Set(leaves.filter((l) => l.personId === c.id && l.status === 'Validée').flatMap((l) => leaveDays(l.start, l.end)));
      const r = rng();
      const status: CraSheet['status'] = wi === 0 ? (r < 0.8 ? 'Validé' : r < 0.9 ? 'Soumis' : 'À corriger') : r < 0.38 ? 'Soumis' : r < 0.58 ? 'Validé' : r < 0.72 ? 'Brouillon' : r < 0.88 ? 'À saisir' : 'À corriger';
      // Un brouillon n'est saisi que sur les premiers jours.
      const daysFilled = status === 'Brouillon' ? 3 : 5;
      const perDay = c.contractHoursWeek / 5;
      const hoursFor = (i: number) => (i < daysFilled && isBusinessDay(addDays(start, i), WORK_CALENDAR) && !off.has(dateKey(addDays(start, i))) ? perDay : 0);
      const main = Array.from({ length: 5 }, (_, i) => hoursFor(i));
      // Écart volontaire (heures manquantes) sur les CRA à corriger et quelques autres.
      if (status === 'À corriger' || rng() < 0.08) main[1] = Math.max(0, main[1] - 2);
      const lines: CraLine[] = acts.length > 3 && rng() < 0.35
        ? [{ activity: acts[0], hours: main.map((h) => Math.max(0, h - 1)) }, { activity: acts[1] === 'Formation' ? 'Formation' : acts[1], hours: main.map((h) => (h ? 1 : 0)) }]
        : [{ activity: acts[0], hours: main }];
      const at = start + 4 * 86_400_000 + 17 * 3_600_000;
      sheets.push({
        id: `CRA-${week}-${c.id}`,
        personId: c.id,
        weekStart: week,
        lines: status === 'À saisir' ? acts.slice(0, 1).map((a) => ({ activity: a, hours: [0, 0, 0, 0, 0] })) : lines,
        status,
        comment: status === 'À corriger' ? 'Heures du mardi à compléter' : undefined,
        history:
          status === 'À saisir' || status === 'Brouillon'
            ? []
            : [
                { at, by: c.name, action: 'Soumission' },
                ...(status === 'Validé' ? [{ at: at + 86_400_000, by: actorName(c.managerId ?? ''), action: 'Validation' }] : []),
                ...(status === 'À corriger' ? [{ at: at + 86_400_000, by: actorName(c.managerId ?? ''), action: 'Rejet', note: 'Heures du mardi à compléter' }] : []),
              ],
      });
    }
  }
  return sheets;
}

export function initialManagement(agents: Agent[], techs: Technician[], now: number, seed = 77): ManagementState {
  const rng = createRng(seed);
  const collaborators = buildCollaborators(agents, techs);
  const leaves = seedLeaves(collaborators, techs, now, rng);
  return {
    collaborators,
    leaves,
    cra: seedCra(collaborators, leaves, now, rng),
    delegations: [{ id: 'DLG-1', fromManagerId: 'mgr-hd-mtp', toManagerId: 'mgr-hd-lc', start: dateKey(now), end: dateKey(addDays(now, 6)) }],
    rules: DEMO_LEAVE_RULES,
    internalObjectives: {},
  };
}

const canManage = (role: Role) => can(role, 'supervision', 'edit');

export function useManagement(agents: Agent[], techs: Technician[]) {
  const init = useRef<ManagementState>();
  if (!init.current) init.current = initialManagement(agents, techs, Date.now());
  const [state, setState] = useState(init.current);
  const ref = useRef(state);
  ref.current = state;
  const apply = (next: ManagementState) => {
    ref.current = next;
    setState(next);
  };

  const submitLeave = useCallback((personId: string, type: LeaveType, start: string, end: string, by: string): MgmtResult => {
    const s = ref.current;
    const check = checkSubmission({ personId, type, start, end }, s.leaves, s.rules, Date.now());
    if (!check.ok) return { ok: false, message: check.errors.join(' '), warnings: check.warnings };
    const now = Date.now();
    const req: LeaveRequest = { id: `CG-${String(s.leaves.length + 1).padStart(4, '0')}`, personId, type, start, end, status: 'Soumise', submittedAt: now, comments: [], history: [{ at: now, by, action: 'Soumission (démonstration)' }] };
    apply({ ...s, leaves: [...s.leaves, req] });
    return { ok: true, message: `Demande ${req.id} soumise (${leaveDays(start, end).length} jour(s) ouvré(s)).`, warnings: check.warnings };
  }, []);

  const decideLeave = useCallback((id: string, decision: 'Validée' | 'Refusée', actorId: string, role: Role, comment: string, force = false): MgmtResult => {
    const s = ref.current;
    const req = s.leaves.find((l) => l.id === id);
    if (!req) return { ok: false, message: 'Demande introuvable.' };
    if (req.status !== 'Soumise') return { ok: false, message: 'Demande déjà traitée.' };
    if (!canManage(role)) return { ok: false, message: 'Votre rôle ne permet pas de valider des congés (maquette).' };
    const right = canDecide(actorId, req.personId, s.collaborators, s.delegations, Date.now());
    if (!right.ok) return { ok: false, message: right.reason! };
    if (decision === 'Refusée' && !comment.trim()) return { ok: false, message: 'Un commentaire est obligatoire pour un refus.' };
    if (decision === 'Validée') {
      const conflicts = leaveConflicts(req, s.collaborators, s.leaves, s.rules);
      if (conflicts.length && !force) return { ok: false, message: `Conflit d’effectif : présence de l’équipe sous ${Math.round(s.rules.minTeamPresence * 100)} % le(s) ${conflicts.join(', ')}.` };
      if (conflicts.length && !comment.trim()) return { ok: false, message: 'Une validation malgré conflit exige un commentaire.' };
    }
    const now = Date.now();
    const by = actorName(actorId) + (right.via ? ` (délégation de ${actorName(right.via)})` : '');
    const updated: LeaveRequest = {
      ...req,
      status: decision,
      comments: comment.trim() ? [...req.comments, { at: now, by, text: comment.trim() }] : req.comments,
      history: [...req.history, { at: now, by, action: decision === 'Validée' ? (force ? 'Validation malgré conflit' : 'Validation') : 'Refus', note: comment.trim() || undefined }],
    };
    apply({ ...s, leaves: s.leaves.map((l) => (l.id === id ? updated : l)) });
    return { ok: true, message: `Demande ${id} ${decision === 'Validée' ? 'validée' : 'refusée'} par ${by}.` };
  }, []);

  const addDelegation = useCallback((fromManagerId: string, toManagerId: string, start: string, end: string, role: Role): MgmtResult => {
    if (!canManage(role)) return { ok: false, message: 'Votre rôle ne permet pas de déléguer (maquette).' };
    if (fromManagerId === toManagerId) return { ok: false, message: 'Délégation vers soi-même impossible.' };
    if (end < start) return { ok: false, message: 'La date de fin précède la date de début.' };
    const s = ref.current;
    apply({ ...s, delegations: [...s.delegations, { id: `DLG-${s.delegations.length + 1}`, fromManagerId, toManagerId, start, end }] });
    return { ok: true, message: `Délégation de ${actorName(fromManagerId)} à ${actorName(toManagerId)} enregistrée.` };
  }, []);

  const removeDelegation = useCallback((id: string) => {
    const s = ref.current;
    apply({ ...s, delegations: s.delegations.filter((d) => d.id !== id) });
  }, []);

  const updateCra = useCallback((id: string, lines: CraLine[], next: 'Brouillon' | 'Soumis' | 'Validé' | 'À corriger', actor: string, role: Role, comment = ''): MgmtResult => {
    const s = ref.current;
    const sheet = s.cra.find((c) => c.id === id);
    if (!sheet) return { ok: false, message: 'CRA introuvable.' };
    if (next !== 'Brouillon' && !CRA_TRANSITIONS[sheet.status].includes(next)) return { ok: false, message: `Transition ${sheet.status} → ${next} impossible.` };
    if (next === 'Brouillon' && (sheet.status === 'Soumis' || sheet.status === 'Validé')) return { ok: false, message: 'CRA déjà soumis : modification impossible.' };
    if ((next === 'Validé' || next === 'À corriger') && !canManage(role)) return { ok: false, message: 'Votre rôle ne permet pas de valider des CRA (maquette).' };
    if (next === 'Validé' || next === 'À corriger') {
      const right = canDecide(actor, sheet.personId, s.collaborators, s.delegations, Date.now());
      if (!right.ok) return { ok: false, message: right.reason! };
    }
    if (next === 'À corriger' && !comment.trim()) return { ok: false, message: 'Un motif de rejet est obligatoire.' };
    if (lines.some((l) => l.hours.some((h) => h < 0 || h > 12))) return { ok: false, message: 'Heures journalières hors limites (0 à 12 h).' };
    const now = Date.now();
    const action = { Brouillon: 'Enregistrement', Soumis: sheet.status === 'À corriger' ? 'Correction et nouvelle soumission' : 'Soumission', Validé: 'Validation', 'À corriger': 'Rejet' }[next];
    const updated: CraSheet = { ...sheet, lines, status: next, comment: next === 'À corriger' ? comment.trim() : sheet.comment, history: [...sheet.history, { at: now, by: actorName(actor), action, note: comment.trim() || undefined }] };
    apply({ ...s, cra: s.cra.map((c) => (c.id === id ? updated : c)) });
    return { ok: true, message: `CRA ${action.toLowerCase()} (démonstration).` };
  }, []);

  const setInternalObjective = useCallback((clientId: string, key: keyof ObjectiveConfig, value: number) => {
    const s = ref.current;
    apply({ ...s, internalObjectives: { ...s.internalObjectives, [clientId]: { ...(s.internalObjectives[clientId] ?? DEFAULT_N1_OBJECTIVES), [key]: value } } });
  }, []);

  const reset = useCallback(() => apply(initialManagement(agents, techs, Date.now())), [agents, techs]);

  /** Congés validés par collaborateur (dates), pour la présence dans les autres modules. */
  const leaveDatesOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const l of state.leaves) if (l.status === 'Validée') map.set(l.personId, [...(map.get(l.personId) ?? []), ...leaveDays(l.start, l.end)]);
    return map;
  }, [state.leaves]);

  return { state, submitLeave, decideLeave, addDelegation, removeDelegation, updateCra, setInternalObjective, reset, leaveDatesOf };
}

export type ManagementStore = ReturnType<typeof useManagement>;
