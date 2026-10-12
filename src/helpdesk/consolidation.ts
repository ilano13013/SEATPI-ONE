// Consolidation Helpdesk : tickets des plateaux internes (N1) et des sites clients
// externes INVIVO, PRIMAGAZ, MONEXT (N2) dans un référentiel unique.
// Fonctions pures : la vue tableau et la vue Kanban s'appuient sur le même jeu filtré.
import type { Agent } from '../types';
import type { ItsmTool, Priority, Technician, Ticket, TicketStatus } from '../external/types';
import { isOpen, periods, reopenedIn, resolvedIn, createdIn, type Period } from '../external/metrics';
import { clientRecord } from '../config/itsm';
import { internalTicketClients, ticketTeams } from './teams';
import type { Collaborator } from '../org/collaborators';
import { personById } from '../org/people';
import { addDays, startOfWeek } from '../external/calendar';

export type Scope = 'interne' | 'externe';

export interface HdTicket extends Ticket {
  scope: Scope;
  clientName: string;
  teamLabel: string;
  /** Manager responsable de l'équipe qui traite le ticket. */
  managerId: string | null;
  assigneeName: string | null;
}

export function consolidate(internal: Ticket[], external: Ticket[], collaborators: Collaborator[], techs: Technician[]): HdTicket[] {
  const byId = new Map(collaborators.map((c) => [c.id, c]));
  const name = (id: string | null) => (id ? (byId.get(id)?.name ?? techs.find((t) => t.id === id)?.name ?? id) : null);
  const tag = (t: Ticket, scope: Scope): HdTicket => {
    const team = ticketTeams.find((x) => x.id === t.teamId);
    const assignee = t.assigneeId ? byId.get(t.assigneeId) : undefined;
    // Manager : celui de l'agent affecté ; à défaut celui de l'équipe (N1 : manager du site du pôle, N2 : manager MCO).
    const teamManager = scope === 'externe' ? 'mgr-mco' : (collaborators.find((c) => c.teamId === `pole-${poleOfTeam(t.teamId)}`)?.managerId ?? null);
    return {
      ...t,
      scope,
      clientName: clientRecord(t.clientId)?.name ?? t.clientId.toUpperCase(),
      teamLabel: team ? `${team.name} · ${team.service}` : t.teamId,
      managerId: assignee?.managerId ?? teamManager,
      assigneeName: name(t.assigneeId),
    };
  };
  return [...internal.map((t) => tag(t, 'interne')), ...external.map((t) => tag(t, 'externe'))];
}

/** Pôle du plateau d'une équipe N1 interne. */
const poleOfTeam = (teamId: string) => internalTicketClients.find((c) => `int-${c.clientId}` === teamId)?.poleIds[0] ?? '';

// --- Filtres ----------------------------------------------------------------------

export type PeriodFilter = 'tout' | 'today' | 'week' | 'prevWeek';

export interface HdFilters {
  client: string;
  team: string;
  manager: string;
  tech: string;
  priority: Priority | '';
  status: TicketStatus | '';
  period: PeriodFilter;
  tool: ItsmTool | '';
}

export const EMPTY_FILTERS: HdFilters = { client: '', team: '', manager: '', tech: '', priority: '', status: '', period: 'tout', tool: '' };

/** Ticket actif sur la période : créé, mis à jour ou encore ouvert pendant la période. */
const inPeriod = (t: Ticket, p: Period) => t.createdAt < p.end && (isOpen(t) || t.updatedAt >= p.start);

export function applyFilters(list: HdTicket[], f: HdFilters, now: number): HdTicket[] {
  const p = f.period === 'tout' ? null : periods(now)[f.period];
  return list.filter(
    (t) =>
      (!f.client || t.clientId === f.client) &&
      (!f.team || t.teamId === f.team) &&
      (!f.manager || t.managerId === f.manager) &&
      (!f.tech || t.assigneeId === f.tech) &&
      (!f.priority || t.priority === f.priority) &&
      (!f.status || t.status === f.status) &&
      (!f.tool || t.source.tool === f.tool) &&
      (!p || inPeriod(t, p)),
  );
}

// --- Compteurs (chaque compteur porte la liste des tickets qui le composent) ---------

export type CounterKey = 'ouverts' | 'enCours' | 'enAttente' | 'bloques' | 'resolus' | 'reouverts' | 'backlog' | 'horsSla' | 'procheSla' | 'sansAffectation' | 'critiques';

export const COUNTER_LABELS: Record<CounterKey, string> = {
  ouverts: 'Tickets ouverts',
  enCours: 'En cours',
  enAttente: 'En attente',
  bloques: 'Bloqués',
  resolus: 'Résolus (semaine)',
  reouverts: 'Réouverts (semaine)',
  backlog: 'Backlog (> 2 j ouvrés)',
  horsSla: 'Hors SLA',
  procheSla: 'Proches SLA',
  sansAffectation: 'Sans affectation',
  critiques: 'Critiques (P1)',
};

/** Ancienneté au-delà de laquelle un ticket ouvert compte dans le backlog (heures calendaires). */
export const BACKLOG_AGE_H = 48;

export function counters(list: HdTicket[], now: number): Record<CounterKey, string[]> {
  const week = periods(now).week;
  const open = list.filter(isOpen);
  const ids = (l: Ticket[]) => l.map((t) => t.id);
  return {
    ouverts: ids(open),
    enCours: ids(open.filter((t) => t.status === 'En cours')),
    enAttente: ids(open.filter((t) => t.status === 'En attente')),
    bloques: ids(open.filter((t) => t.status === 'Bloqué')),
    resolus: ids(list.filter((t) => resolvedIn(t, week))),
    reouverts: ids(list.filter((t) => reopenedIn(t, week))),
    backlog: ids(open.filter((t) => now - t.createdAt > BACKLOG_AGE_H * 3_600_000)),
    horsSla: ids(open.filter((t) => t.sla.state === 'dépassé')),
    procheSla: ids(open.filter((t) => t.sla.state === 'à risque')),
    sansAffectation: ids(open.filter((t) => !t.assigneeId)),
    critiques: ids(open.filter((t) => t.priority === 'P1')),
  };
}

// --- Effectifs -----------------------------------------------------------------------

export interface Staffing {
  planned: string[];
  present: string[];
  available: string[];
  onCall: string[];
}

/**
 * Agents N1 (simulation du plateau) et techniciens N2 (sites clients).
 * Prévus : affectés et non en congé validé ; présents : connectés ; disponibles : prêts à traiter ;
 * en communication : en appel (N1 uniquement, la téléphonie N2 n'est pas raccordée).
 */
export function staffing(agents: Agent[], techs: Technician[], leaveDates: Map<string, string[]>, today: string, busyTechs: Set<string>): Staffing {
  const onLeave = (id: string) => (leaveDates.get(id) ?? []).includes(today);
  const n1 = agents.filter((a) => !onLeave(a.id));
  const n2 = techs.filter((t) => !onLeave(t.id));
  const presentN1 = n1.filter((a) => a.status !== 'Hors ligne');
  return {
    planned: [...n1.map((a) => a.id), ...n2.map((t) => t.id)],
    present: [...presentN1.map((a) => a.id), ...n2.map((t) => t.id)],
    available: [...presentN1.filter((a) => a.status === 'Disponible').map((a) => a.id), ...n2.filter((t) => !busyTechs.has(t.id)).map((t) => t.id)],
    onCall: presentN1.filter((a) => a.status === 'En appel').map((a) => a.id),
  };
}

// --- Objectifs et évolution ---------------------------------------------------------

export interface TeamObjective {
  teamId: string;
  label: string;
  scope: Scope;
  target: number;
  done: number;
  remaining: number;
}

export function teamObjectives(list: HdTicket[], targets: Record<string, number>, now: number): TeamObjective[] {
  const week = periods(now).week;
  return ticketTeams
    .filter((t) => targets[t.id] !== undefined)
    .map((team) => {
      const done = list.filter((t) => t.teamId === team.id && resolvedIn(t, week)).length;
      const target = targets[team.id];
      return { teamId: team.id, label: `${team.name} — ${clientRecord(team.clientId)?.name ?? team.clientId}`, scope: team.service === 'Helpdesk N1' ? 'interne' : 'externe', target, done, remaining: Math.max(0, target - done) };
    });
}

export interface WeekPoint {
  label: string;
  created: number;
  resolved: number;
  reopened: number;
}

export function weeklyEvolution(list: HdTicket[], now: number, weeks = 6): WeekPoint[] {
  const start0 = startOfWeek(now);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(start0, -7 * (weeks - 1 - i));
    const p: Period = { key: 'week', label: '', start, end: addDays(start, 7) } as Period;
    return {
      label: new Date(start).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
      created: list.filter((t) => createdIn(t, p)).length,
      resolved: list.filter((t) => resolvedIn(t, p)).length,
      reopened: list.filter((t) => reopenedIn(t, p)).length,
    };
  });
}

export const managerLabel = (id: string | null) => (id ? (personById(id)?.name ?? id) : '—');
