// Checklists de suivi managérial des CRA et des congés (fonctions pures).
//
// Une coche « Traité » dans SEATPI ONE est un suivi interne : ce n'est PAS une validation
// officielle dans l'outil RH ou CRA tant qu'aucune intégration réelle n'existe.
import type { Collaborator } from '../org/collaborators';
import { leaveConflicts, leaveDays, type CraSheet, type LeaveRequest, type LeaveRules } from './rules';

export type FollowStatus = 'À traiter' | 'Relancé' | 'Traité';
export const FOLLOW_STATUSES: FollowStatus[] = ['À traiter', 'Relancé', 'Traité'];

export interface FollowUp {
  status: FollowStatus;
  history: { at: number; by: string; from: FollowStatus; to: FollowStatus; note?: string }[];
}

export type FollowUps = Record<string, FollowUp>;

export const followOf = (f: FollowUps, key: string): FollowStatus => f[key]?.status ?? 'À traiter';

export function setFollow(f: FollowUps, key: string, to: FollowStatus, by: string, at: number, note?: string): FollowUps {
  const from = followOf(f, key);
  if (from === to) return f;
  return { ...f, [key]: { status: to, history: [...(f[key]?.history ?? []), { at, by, from, to, note }] } };
}

export interface ChecklistFilters {
  team: string;
  manager: string;
  /** Semaine (AAAA-MM-JJ du lundi) pour les CRA ; '' = toutes. */
  week: string;
}

export const NO_FILTERS: ChecklistFilters = { team: '', manager: '', week: '' };

const inScope = (c: Collaborator | undefined, f: ChecklistFilters, scope: Set<string> | null) => !!c && (!scope || scope.has(c.id)) && (!f.team || c.teamId === f.team) && (!f.manager || c.managerId === f.manager);

export interface CraItem {
  key: string;
  sheet: CraSheet;
  person: Collaborator;
  kind: 'manquant' | 'à valider';
  follow: FollowStatus;
}

export interface CraChecklist {
  expected: number;
  received: number;
  missing: number;
  pendingValidation: number;
  missingItems: CraItem[];
  pendingItems: CraItem[];
  /** Éléments non encore cochés « Traité ». */
  remaining: number;
}

/** Reçu = soumis ou validé dans l'outil CRA ; manquant = non envoyé ou renvoyé pour correction. */
export function craChecklist(sheets: CraSheet[], collaborators: Collaborator[], follow: FollowUps, f: ChecklistFilters, scope: Set<string> | null = null): CraChecklist {
  const byId = new Map(collaborators.map((c) => [c.id, c]));
  const list = sheets.filter((s) => (!f.week || s.weekStart === f.week) && inScope(byId.get(s.personId), f, scope));
  const item = (s: CraSheet, kind: CraItem['kind']): CraItem => ({ key: `cra:${s.id}`, sheet: s, person: byId.get(s.personId)!, kind, follow: followOf(follow, `cra:${s.id}`) });
  const missingItems = list.filter((s) => s.status === 'À saisir' || s.status === 'Brouillon' || s.status === 'À corriger').map((s) => item(s, 'manquant'));
  const pendingItems = list.filter((s) => s.status === 'Soumis').map((s) => item(s, 'à valider'));
  return {
    expected: list.length,
    received: list.filter((s) => s.status === 'Soumis' || s.status === 'Validé').length,
    missing: missingItems.length,
    pendingValidation: pendingItems.length,
    missingItems,
    pendingItems,
    remaining: [...missingItems, ...pendingItems].filter((i) => i.follow !== 'Traité').length,
  };
}

export interface LeaveItem {
  key: string;
  leave: LeaveRequest;
  person: Collaborator;
  managerId: string | null;
  days: number;
  /** Jours où l'équipe passerait sous le seuil de présence (information, pas une règle bloquante). */
  conflicts: string[];
  follow: FollowStatus;
}

export interface LeaveChecklist {
  pending: number;
  items: LeaveItem[];
  remaining: number;
}

/** Demandes en attente dans l'outil RH, à suivre par le manager. */
export function leaveChecklist(leaves: LeaveRequest[], collaborators: Collaborator[], follow: FollowUps, rules: LeaveRules, f: ChecklistFilters, scope: Set<string> | null = null): LeaveChecklist {
  const byId = new Map(collaborators.map((c) => [c.id, c]));
  const items = leaves
    .filter((l) => l.status === 'Soumise' && inScope(byId.get(l.personId), f, scope))
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((l) => {
      const person = byId.get(l.personId)!;
      return { key: `leave:${l.id}`, leave: l, person, managerId: person.managerId, days: leaveDays(l.start, l.end).length, conflicts: leaveConflicts(l, collaborators, leaves, rules), follow: followOf(follow, `leave:${l.id}`) };
    });
  return { pending: items.length, items, remaining: items.filter((i) => i.follow !== 'Traité').length };
}
