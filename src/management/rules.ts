// Données de suivi des congés et des CRA (fonctions pures, testables).
// SEATPI ONE n'est ni un logiciel de congés ni un outil de saisie des CRA : ces données
// proviennent (en production) des outils RH réellement utilisés et ne servent qu'au suivi
// managérial. Les paramètres sont des valeurs de DÉMONSTRATION.
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
  /** Taux de présence minimum d'une équipe sur une journée (0–1), pour signaler un conflit d'effectif. */
  minTeamPresence: number;
}

export const DEMO_LEAVE_RULES: LeaveRules = { minTeamPresence: 0.6 };

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

export const declaredHours = (s: CraSheet) => s.lines.reduce((sum, l) => sum + l.hours.reduce((a, b) => a + b, 0), 0);

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
