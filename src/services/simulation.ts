import type { Agent, AgentStatus, DemoState, Metrics, Queue, TicketSummary } from '../types';
import type { Rng } from './random';

export const BREAK_STATUSES: AgentStatus[] = ['Pause', 'Repas'];
export const OFF_FLOOR_STATUSES: AgentStatus[] = [...BREAK_STATUSES, 'Formation', 'Hors ligne'];

/** Transitions plausibles entre états de travail, avec leur poids relatif. */
const TRANSITIONS: Record<AgentStatus, [AgentStatus, number][]> = {
  Disponible: [['En appel', 6], ['Pause', 1]],
  'En appel': [['Post-appel', 1]],
  'Post-appel': [['Disponible', 1]],
  Pause: [['Disponible', 1]],
  Repas: [['Disponible', 1]],
  Formation: [['Disponible', 1]],
  'Hors ligne': [],
};

/** Durée minimale (s) avant qu'un état puisse changer. */
const MIN_DURATION: Record<AgentStatus, number> = {
  Disponible: 20,
  'En appel': 120,
  'Post-appel': 30,
  Pause: 300,
  Repas: 1800,
  Formation: 3600,
  'Hors ligne': Infinity,
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function pickWeighted<T>(options: [T, number][], rng: Rng): T | null {
  const total = options.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const [value, w] of options) {
    r -= w;
    if (r < 0) return value;
  }
  return options[options.length - 1][0];
}

function stepAgent(agent: Agent, dt: number, rng: Rng): Agent {
  const since = agent.statusSinceSec + dt;
  if (since >= MIN_DURATION[agent.status] && rng() < 0.35) {
    const next = pickWeighted(TRANSITIONS[agent.status], rng);
    if (next) return { ...agent, status: next, statusSinceSec: 0 };
  }
  return { ...agent, statusSinceSec: since };
}

function stepQueue(queue: Queue, dt: number, rng: Rng): Queue {
  const delta = Math.round((rng() - 0.5) * 2.4);
  const waiting = clamp(queue.waiting + delta, 0, 12);
  const handled = queue.handledToday + (rng() < 0.6 ? 1 : 0);
  const abandoned = queue.abandonedToday + (waiting > 4 && rng() < 0.15 ? 1 : 0);
  const longestWaitSec = waiting === 0 ? 0 : queue.waiting === 0 ? Math.round(rng() * 30) : queue.longestWaitSec + dt;
  const sla = clamp(Math.round((queue.sla + (rng() - 0.5) * 1.2 - (waiting > 4 ? 0.4 : 0)) * 10) / 10, 70, 100);
  return { ...queue, waiting, handledToday: handled, abandonedToday: abandoned, longestWaitSec, sla };
}

function stepTicket(ticket: TicketSummary, dt: number, rng: Rng): TicketSummary {
  if (ticket.status === 'Résolu') return ticket;
  const ageMin = ticket.ageMin + dt / 60;
  if (ticket.status === 'En cours' && rng() < 0.03) return { ...ticket, ageMin, status: 'Résolu' };
  if (ticket.status === 'Nouveau' && rng() < 0.05) return { ...ticket, ageMin, status: 'En cours' };
  return { ...ticket, ageMin };
}

/**
 * Avance la simulation de `dt` secondes. Fonction pure : renvoie un nouvel état
 * sans modifier l'état d'entrée.
 */
export function simulateTick(state: DemoState, dt: number, rng: Rng, now = state.updatedAt + dt * 1000): DemoState {
  return {
    ...state,
    tick: state.tick + 1,
    updatedAt: now,
    agents: state.agents.map((a) => stepAgent(a, dt, rng)),
    queues: state.queues.map((q) => stepQueue(q, dt, rng)),
    tickets: state.tickets.map((t) => stepTicket(t, dt, rng)),
  };
}

export function computeMetrics(state: DemoState): Metrics {
  const handled = state.queues.reduce((s, q) => s + q.handledToday, 0);
  const weighted = (key: 'sla' | 'slaTarget') =>
    handled === 0 ? 0 : Math.round((state.queues.reduce((s, q) => s + q[key] * q.handledToday, 0) / handled) * 10) / 10;
  return {
    agentsConnected: state.agents.filter((a) => a.status !== 'Hors ligne').length,
    waitingTotal: state.queues.reduce((s, q) => s + q.waiting, 0),
    slaGlobal: weighted('sla'),
    slaTarget: weighted('slaTarget'),
    onBreak: state.agents.filter((a) => BREAK_STATUSES.includes(a.status)).length,
    openTickets: state.tickets.filter((t) => t.status !== 'Résolu').length,
  };
}

export interface ClientSummary {
  waiting: number;
  sla: number;
  slaTarget: number;
  agentsConnected: number;
  onBreak: number;
  openTickets: number;
}

/** Indicateurs d'un pôle client (SLA pondéré par le volume traité). */
export function clientSummary(state: DemoState, clientId: string): ClientSummary {
  const queues = state.queues.filter((q) => q.clientId === clientId);
  const agents = state.agents.filter((a) => a.clientId === clientId);
  const handled = queues.reduce((s, q) => s + q.handledToday, 0);
  const weighted = (key: 'sla' | 'slaTarget') =>
    handled === 0 ? 0 : Math.round((queues.reduce((s, q) => s + q[key] * q.handledToday, 0) / handled) * 10) / 10;
  return {
    waiting: queues.reduce((s, q) => s + q.waiting, 0),
    sla: weighted('sla'),
    slaTarget: weighted('slaTarget'),
    agentsConnected: agents.filter((a) => a.status !== 'Hors ligne').length,
    onBreak: agents.filter((a) => BREAK_STATUSES.includes(a.status)).length,
    openTickets: state.tickets.filter((t) => t.clientId === clientId && t.status !== 'Résolu').length,
  };
}
