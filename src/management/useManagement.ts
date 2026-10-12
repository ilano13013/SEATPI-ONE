// État du management (démonstration) : suivi des CRA et des congés sous forme de checklists,
// objectifs N1 et effectifs prévisionnels. Les CRA et congés proviennent (en production) des
// outils RH réellement utilisés ; SEATPI ONE n'en fait que le suivi managérial.
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Agent } from '../types';
import type { Technician } from '../external/types';
import { addDays, dateKey, isBusinessDay, startOfWeek } from '../external/calendar';
import { createRng, type Rng } from '../services/random';
import { buildCollaborators, type Collaborator } from '../org/collaborators';
import { personById } from '../org/people';
import type { ObjectiveConfig } from '../external/config';
import { clientRecord, POLE_CLIENTS } from '../config/itsm';
import { DEMO_LEAVE_RULES, leaveDays, weekKey, type CraLine, type CraSheet, type LeaveRequest, type LeaveRules, type LeaveType, WORK_CALENDAR } from './rules';
import { setFollow, type FollowStatus, type FollowUps } from './checklists';

export interface ManagementState {
  collaborators: Collaborator[];
  /** Demandes de congés telles que fournies par l'outil RH (lecture seule dans SEATPI ONE). */
  leaves: LeaveRequest[];
  /** État des CRA tel que fourni par l'outil CRA (lecture seule dans SEATPI ONE). */
  cra: CraSheet[];
  rules: LeaveRules;
  internalObjectives: Record<string, ObjectiveConfig>;
  /** Suivi managérial (checklists) : coches internes, avec historique. */
  followUps: FollowUps;
  /** Effectifs prévisionnels par équipe (saisie managériale). */
  forecastHeadcount: Record<string, number>;
}

export interface MgmtResult {
  ok: boolean;
  message: string;
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
  const forecastHeadcount: Record<string, number> = {};
  for (const c of collaborators) if (c.population === 'Agent N1' || c.population === 'Technicien N2') forecastHeadcount[c.teamId] = (forecastHeadcount[c.teamId] ?? 0) + 1;
  return { collaborators, leaves, cra: seedCra(collaborators, leaves, now, rng), rules: DEMO_LEAVE_RULES, internalObjectives: {}, followUps: {}, forecastHeadcount };
}

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

  /** Coche de suivi (À traiter / Relancé / Traité) : suivi interne, pas une validation officielle. */
  const setFollowUp = useCallback((key: string, to: FollowStatus, by: string, note?: string) => {
    const s = ref.current;
    apply({ ...s, followUps: setFollow(s.followUps, key, to, by, Date.now(), note) });
  }, []);

  const setInternalObjective = useCallback((clientId: string, key: keyof ObjectiveConfig, value: number) => {
    const s = ref.current;
    apply({ ...s, internalObjectives: { ...s.internalObjectives, [clientId]: { ...(s.internalObjectives[clientId] ?? DEFAULT_N1_OBJECTIVES), [key]: value } } });
  }, []);

  const setForecast = useCallback((teamId: string, value: number): MgmtResult => {
    if (!Number.isInteger(value) || value < 0 || value > 500) return { ok: false, message: 'Effectif prévisionnel : nombre entier entre 0 et 500.' };
    const s = ref.current;
    apply({ ...s, forecastHeadcount: { ...s.forecastHeadcount, [teamId]: value } });
    return { ok: true, message: 'Effectif prévisionnel mis à jour.' };
  }, []);

  /** Modification d'un collaborateur (pseudonyme, manager, ETP) — réservée à l'administration. */
  const updateCollaborator = useCallback((id: string, patch: Partial<Pick<Collaborator, 'name' | 'managerId' | 'etp'>>): MgmtResult => {
    const s = ref.current;
    if (patch.etp !== undefined && (patch.etp <= 0 || patch.etp > 1)) return { ok: false, message: 'ETP compris entre 0 et 1.' };
    if (patch.name !== undefined && !patch.name.trim()) return { ok: false, message: 'Le nom ne peut pas être vide.' };
    if (patch.managerId && patch.managerId === id) return { ok: false, message: 'Un collaborateur ne peut pas être son propre manager.' };
    apply({ ...s, collaborators: s.collaborators.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
    return { ok: true, message: 'Collaborateur mis à jour.' };
  }, []);

  const reset = useCallback(() => apply(initialManagement(agents, techs, Date.now())), [agents, techs]);

  /** Congés validés (dans l'outil RH) par collaborateur, pour la présence dans les autres modules. */
  const leaveDatesOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const l of state.leaves) if (l.status === 'Validée') map.set(l.personId, [...(map.get(l.personId) ?? []), ...leaveDays(l.start, l.end)]);
    return map;
  }, [state.leaves]);

  return { state, setFollowUp, setInternalObjective, setForecast, updateCollaborator, reset, leaveDatesOf };
}

export type ManagementStore = ReturnType<typeof useManagement>;
