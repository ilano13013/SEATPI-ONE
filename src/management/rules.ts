// Règles de gestion des congés et des CRA (fonctions pures, testables).
// Les paramètres RH sont des valeurs de DÉMONSTRATION, à remplacer par les règles
// configurées par la DRH ; en production, ces contrôles seront faits côté serveur.
import type { BusinessCalendar } from '../external/types';
import { addDays, dateKey, isBusinessDay, startOfDay, startOfWeek } from '../external/calendar';
import type { Collaborator } from '../org/collaborators';

export const WORK_CALENDAR: BusinessCalendar = {
  label: 'Lun–Ven, jours fériés France',
  days: [1, 2, 3, 4, 5],
  startHour: 9,
  endHour: 17,
  holidays: ['2026-11-01', '2026-11-11', '2026-12-25', '2027-01-01', '2027-03-29', '2027-05-01', '2027-05-08', '2027-05-17', '2027-07-14', '2027-08-15'],
};

export interface LeaveRules {
  /** Préavis minimum (jours calendaires) avant le début d'un congé payé. */
  minNoticeDays: number;
  /** Nombre maximum de jours ouvrés consécutifs par demande. */
  maxConsecutiveDays: number;
  /** Taux de présence minimum d'une équipe sur une journée (0–1). */
  minTeamPresence: number;
}

export const DEMO_LEAVE_RULES: LeaveRules = { minNoticeDays: 7, maxConsecutiveDays: 15, minTeamPresence: 0.6 };

export type LeaveType = 'Congés payés' | 'RTT' | 'Formation';
export type LeaveStatus = 'Soumise' | 'Validée' | 'Refusée';

export interface HistoryEntry {
  at: number;
  by: string;
  action: string;
  note?: string;
}

export interface LeaveRequest {
  id: string;
  personId: string;
  type: LeaveType;
  start: string;
  end: string;
  status: LeaveStatus;
  submittedAt: number;
  comments: { at: number; by: string; text: string }[];
  history: HistoryEntry[];
}

export interface Delegation {
  id: string;
  fromManagerId: string;
  toManagerId: string;
  start: string;
  end: string;
}

const parse = (d: string) => {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day).getTime();
};

/** Jours ouvrés couverts par une période [start, end] (dates incluses). */
export function leaveDays(start: string, end: string, cal = WORK_CALENDAR): string[] {
  const out: string[] = [];
  for (let t = parse(start); t <= parse(end); t = startOfDay(addDays(t, 1))) if (isBusinessDay(t, cal)) out.push(dateKey(t));
  return out;
}

export interface Check {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

/** Contrôles à la soumission : règles bloquantes et avertissements. */
export function checkSubmission(req: Pick<LeaveRequest, 'personId' | 'type' | 'start' | 'end'>, existing: LeaveRequest[], rules: LeaveRules, today: number): Check {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (parse(req.end) < parse(req.start)) errors.push('La date de fin précède la date de début.');
  const days = leaveDays(req.start, req.end);
  if (days.length === 0) errors.push('La période ne contient aucun jour ouvré.');
  if (days.length > rules.maxConsecutiveDays) errors.push(`Durée supérieure au maximum autorisé (${rules.maxConsecutiveDays} jours ouvrés).`);
  const overlap = existing.some((l) => l.personId === req.personId && l.status !== 'Refusée' && leaveDays(l.start, l.end).some((d) => days.includes(d)));
  if (overlap) errors.push('Une demande existe déjà sur tout ou partie de cette période.');
  if (req.type === 'Congés payés' && parse(req.start) - startOfDay(today) < rules.minNoticeDays * 86_400_000) {
    warnings.push(`Préavis inférieur à ${rules.minNoticeDays} jours.`);
  }
  return { ok: errors.length === 0, errors, warnings };
}

/** Taux de présence d'une équipe un jour donné (congés validés et, si demandé, une demande en cours d'examen). */
export function teamPresence(teamId: string, day: string, collaborators: Collaborator[], leaves: LeaveRequest[], extra?: LeaveRequest): { present: number; size: number; ratio: number } {
  const team = collaborators.filter((c) => c.teamId === teamId);
  const absent = new Set(
    [...leaves.filter((l) => l.status === 'Validée'), ...(extra ? [extra] : [])]
      .filter((l) => leaveDays(l.start, l.end).includes(day))
      .map((l) => l.personId)
      .filter((id) => team.some((c) => c.id === id)),
  );
  const size = team.length;
  return { present: size - absent.size, size, ratio: size ? (size - absent.size) / size : 1 };
}

/** Jours où valider la demande ferait passer l'équipe sous le seuil de présence. */
export function leaveConflicts(req: LeaveRequest, collaborators: Collaborator[], leaves: LeaveRequest[], rules: LeaveRules): string[] {
  const person = collaborators.find((c) => c.id === req.personId);
  if (!person) return [];
  return leaveDays(req.start, req.end).filter((day) => teamPresence(person.teamId, day, collaborators, leaves, req).ratio < rules.minTeamPresence);
}

const inRange = (day: string, start: string, end: string) => parse(day) >= parse(start) && parse(day) <= parse(end);

/** Le manager (ou son délégué) peut-il décider de cette demande ? */
export function canDecide(actorId: string, personId: string, collaborators: Collaborator[], delegations: Delegation[], today: number): { ok: boolean; reason?: string; via?: string } {
  const person = collaborators.find((c) => c.id === personId);
  if (!person) return { ok: false, reason: 'Collaborateur inconnu.' };
  if (person.id === actorId) return { ok: false, reason: 'Un manager ne valide pas ses propres demandes.' };
  const chain: string[] = [];
  for (let m = person.managerId; m; m = collaborators.find((c) => c.id === m)?.managerId ?? null) chain.push(m);
  if (chain.includes(actorId)) return { ok: true };
  const day = dateKey(today);
  const deleg = delegations.find((d) => d.toManagerId === actorId && chain.includes(d.fromManagerId) && inRange(day, d.start, d.end));
  if (deleg) return { ok: true, via: deleg.fromManagerId };
  return { ok: false, reason: 'Hors de votre périmètre de validation (ni manager, ni délégué).' };
}

// --- CRA ------------------------------------------------------------------------

export type CraStatus = 'À saisir' | 'Brouillon' | 'Soumis' | 'Validé' | 'À corriger';

export interface CraLine {
  /** Client ou activité (affectation). */
  activity: string;
  /** Heures du lundi au vendredi. */
  hours: number[];
}

export interface CraSheet {
  id: string;
  personId: string;
  weekStart: string;
  lines: CraLine[];
  status: CraStatus;
  history: HistoryEntry[];
  comment?: string;
}

/** Tolérance d'écart entre heures déclarées et attendues (heures). */
export const CRA_TOLERANCE_H = 1;

export const declaredHours = (s: CraSheet) => s.lines.reduce((sum, l) => sum + l.hours.reduce((a, b) => a + b, 0), 0);

/** Heures attendues : contrat hebdomadaire au prorata des jours ouvrés, moins les congés validés. */
export function expectedHours(c: Collaborator, weekStart: string, leaves: LeaveRequest[]): number {
  const start = parse(weekStart);
  const days = Array.from({ length: 5 }, (_, i) => dateKey(addDays(start, i))).filter((d) => isBusinessDay(parse(d), WORK_CALENDAR));
  const off = new Set(leaves.filter((l) => l.personId === c.id && l.status === 'Validée').flatMap((l) => leaveDays(l.start, l.end)));
  const perDay = c.contractHoursWeek / 5;
  return Math.round(days.filter((d) => !off.has(d)).length * perDay * 10) / 10;
}

export function craGap(s: CraSheet, c: Collaborator, leaves: LeaveRequest[]): number {
  return Math.round((declaredHours(s) - expectedHours(c, s.weekStart, leaves)) * 10) / 10;
}

export const CRA_TRANSITIONS: Record<CraStatus, CraStatus[]> = {
  'À saisir': ['Brouillon', 'Soumis'],
  Brouillon: ['Soumis'],
  Soumis: ['Validé', 'À corriger'],
  'À corriger': ['Soumis'],
  Validé: [],
};

export const weekKey = (t: number) => dateKey(startOfWeek(t));

export interface CraCounters {
  expected: number;
  submitted: number;
  validated: number;
  missing: number;
  toFix: number;
  declaredHours: number;
  validatedHours: number;
}

export function craCounters(sheets: CraSheet[]): CraCounters {
  return {
    expected: sheets.length,
    submitted: sheets.filter((s) => s.status === 'Soumis').length,
    validated: sheets.filter((s) => s.status === 'Validé').length,
    missing: sheets.filter((s) => s.status === 'À saisir' || s.status === 'Brouillon').length,
    toFix: sheets.filter((s) => s.status === 'À corriger').length,
    declaredHours: Math.round(sheets.filter((s) => s.status !== 'À saisir').reduce((n, s) => n + declaredHours(s), 0) * 10) / 10,
    validatedHours: Math.round(sheets.filter((s) => s.status === 'Validé').reduce((n, s) => n + declaredHours(s), 0) * 10) / 10,
  };
}
