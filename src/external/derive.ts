// Vues dérivées partagées par le cockpit, la vue globale, la 3D et les rapports.
import type { ExternalClient, ExternalClientId, ExternalTeam, Technician, Ticket } from './types';
import { externalClients, teamsOf } from './config';
import type { ExternalState } from './useExternal';
import { computeAlerts, clientHealth, type Alert, type Health } from './alerts';
import { teamLoads, type TeamLoad } from './workload';
import { computeObjectives, type ObjectiveRow } from './objectives';
import { isOpen, periods, resolvedIn, slaRate } from './metrics';
import { finance, type Finance } from './report';
import type { ConnectorState } from './sync';

export interface ClientView {
  client: ExternalClient;
  tickets: Ticket[];
  techs: Technician[];
  teams: ExternalTeam[];
  loads: TeamLoad[];
  alerts: Alert[];
  health: Health;
  reasons: string[];
  objectives: ObjectiveRow[];
  connector: ConnectorState;
}

export function deriveClient(state: ExternalState, id: ExternalClientId): ClientView {
  const client = externalClients.find((c) => c.id === id)!;
  const tickets = state.tickets[id] ?? [];
  const techs = state.techs.filter((t) => t.clientId === id);
  const teams = teamsOf(id);
  const loads = teamLoads(tickets, teams, techs, client, state.now);
  const alerts = computeAlerts(tickets, client, state.objectives[id], state.alertSettings, loads, state.now);
  const { health, reasons } = clientHealth(alerts);
  return { client, tickets, techs, teams, loads, alerts, health, reasons, objectives: computeObjectives(tickets, client, state.objectives[id], state.now), connector: state.connectors[id] };
}

export function deriveAll(state: ExternalState): Record<ExternalClientId, ClientView> {
  return Object.fromEntries(externalClients.map((c) => [c.id, deriveClient(state, c.id)])) as Record<ExternalClientId, ClientView>;
}

export interface GlobalRow {
  id: string;
  label: string;
  internal: boolean;
  health: Health | null;
  headcount: number;
  open: number | null;
  inProgress: number | null;
  resolved: number | null;
  backlog: number | null;
  sla: number | null;
  weeklyTarget: number | null;
  done: number | null;
  remaining: number | null;
  loadRatio: number | null;
  craPending: number | null;
  leavePending: number | null;
  finance: Finance | null;
}

/** Ligne de la vue consolidée pour un client externe (semaine en cours). */
export function globalRow(view: ClientView, now: number): GlobalRow {
  const week = periods(now).week;
  const open = view.tickets.filter(isOpen);
  const resolved = view.tickets.filter((t) => resolvedIn(t, week)).length;
  const target = view.objectives.find((o) => o.key === 'ticketsToResolve')!.target;
  const effort = view.loads.reduce((s, l) => s + l.effortH, 0);
  const capacity = view.loads.reduce((s, l) => s + l.capacityH, 0);
  return {
    id: view.client.id,
    label: view.client.name,
    internal: false,
    health: view.health,
    headcount: view.techs.length,
    open: open.length,
    inProgress: open.filter((t) => t.status === 'En cours').length,
    resolved,
    backlog: open.length,
    sla: slaRate(view.tickets, week).rate,
    weeklyTarget: target,
    done: resolved,
    remaining: Math.max(0, target - resolved),
    loadRatio: capacity ? effort / capacity : null,
    craPending: view.techs.filter((t) => t.cra.status !== 'Validé').length,
    leavePending: view.techs.reduce((s, t) => s + t.pendingLeaveRequests, 0),
    finance: finance(view.techs, week, view.client),
  };
}

/** Total consolidé : sommes et SLA recalculé sur l'ensemble des résolutions. */
export function totalRow(rows: GlobalRow[], views: ClientView[], now: number): GlobalRow {
  const week = periods(now).week;
  const sum = (f: (r: GlobalRow) => number | null) => rows.reduce((s, r) => s + (f(r) ?? 0), 0);
  const allTickets = views.flatMap((v) => v.tickets);
  const effort = views.reduce((s, v) => s + v.loads.reduce((a, l) => a + l.effortH, 0), 0);
  const capacity = views.reduce((s, v) => s + v.loads.reduce((a, l) => a + l.capacityH, 0), 0);
  const ext = rows.filter((r) => !r.internal && r.finance);
  const revenue = ext.reduce((s, r) => s + r.finance!.revenue, 0);
  const cost = ext.reduce((s, r) => s + r.finance!.cost, 0);
  return {
    id: 'total',
    label: 'Total clients externes',
    internal: false,
    health: null,
    headcount: sum((r) => (r.internal ? 0 : r.headcount)),
    open: sum((r) => (r.internal ? 0 : r.open)),
    inProgress: sum((r) => (r.internal ? 0 : r.inProgress)),
    resolved: sum((r) => (r.internal ? 0 : r.resolved)),
    backlog: sum((r) => (r.internal ? 0 : r.backlog)),
    sla: slaRate(allTickets, week).rate,
    weeklyTarget: sum((r) => (r.internal ? 0 : r.weeklyTarget)),
    done: sum((r) => (r.internal ? 0 : r.done)),
    remaining: sum((r) => (r.internal ? 0 : r.remaining)),
    loadRatio: capacity ? effort / capacity : null,
    craPending: sum((r) => (r.internal ? 0 : r.craPending)),
    leavePending: sum((r) => (r.internal ? 0 : r.leavePending)),
    finance: {
      hours: Math.round(ext.reduce((s, r) => s + r.finance!.hours, 0) * 10) / 10,
      revenue,
      cost,
      margin: revenue - cost,
      marginRate: revenue ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : null,
      budget: ext.reduce((s, r) => s + r.finance!.budget, 0),
    },
  };
}
