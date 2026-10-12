// Calcul des SLA selon le calendrier contractuel de chaque client.
//
// Règles :
// - le délai de prise en charge court du création à la première prise en charge
//   (passage à En cours ou au-delà), sans suspension ;
// - le délai de résolution est décompté en minutes ouvrées, suspendu pendant les
//   statuts de suspension du contrat (ex. En attente client) et lorsque le ticket
//   est Résolu / Clôturé ; une réouverture reprend le décompte là où il s'était arrêté.
import type { ExternalClient, SlaInfo, TicketEvent, TicketStatus } from './types';
import { addBusinessMinutes, businessMinutesBetween } from './calendar';

export interface StatusInterval {
  status: TicketStatus;
  from: number;
  to: number;
}

const ALWAYS_PAUSED: TicketStatus[] = ['Résolu', 'Clôturé'];
export const TAKEN_STATUSES: TicketStatus[] = ['En cours', 'En attente', 'Bloqué', 'Escaladé', 'Résolu', 'Clôturé'];

/** Découpe la vie du ticket en intervalles de statut jusqu'à `until`. */
export function statusIntervals(createdAt: number, history: TicketEvent[], until: number): StatusInterval[] {
  const changes = history.filter((e) => e.kind === 'statut' && e.at <= until).sort((a, b) => a.at - b.at);
  const intervals: StatusInterval[] = [];
  let status: TicketStatus = 'Nouveau';
  let from = createdAt;
  for (const e of changes) {
    if (e.at > from) intervals.push({ status, from, to: e.at });
    status = e.to as TicketStatus;
    from = Math.max(from, e.at);
  }
  if (until > from) intervals.push({ status, from, to: until });
  else intervals.push({ status, from, to: from });
  return intervals;
}

export function firstTakenAt(history: TicketEvent[]): number | null {
  const e = history.filter((h) => h.kind === 'statut' && TAKEN_STATUSES.includes(h.to as TicketStatus)).sort((a, b) => a.at - b.at)[0];
  return e ? e.at : null;
}

export function computeSla(
  ticket: { createdAt: number; history: TicketEvent[]; status: TicketStatus; priority: keyof ExternalClient['sla']; takenAt: number | null },
  client: ExternalClient,
  now: number,
): SlaInfo {
  const target = client.sla[ticket.priority];
  const paused = new Set<TicketStatus>([...ALWAYS_PAUSED, ...client.slaPauseStatuses]);
  const intervals = statusIntervals(ticket.createdAt, ticket.history, now);

  let consumed = 0;
  let reachedAt: number | null = null;
  for (const iv of intervals) {
    if (paused.has(iv.status)) continue;
    const minutes = businessMinutesBetween(iv.from, iv.to, client.calendar);
    if (reachedAt === null && consumed + minutes >= target.resolutionMin) {
      reachedAt = addBusinessMinutes(iv.from, target.resolutionMin - consumed, client.calendar);
    }
    consumed += minutes;
  }

  const current = intervals[intervals.length - 1].status;
  const isPaused = paused.has(current);
  let dueAt = reachedAt;
  if (dueAt === null && !isPaused) dueAt = addBusinessMinutes(now, target.resolutionMin - consumed, client.calendar);

  const takeChargeDueAt = addBusinessMinutes(ticket.createdAt, target.takeChargeMin, client.calendar);
  const takeChargeMet = ticket.takenAt !== null ? ticket.takenAt <= takeChargeDueAt : now > takeChargeDueAt ? false : null;

  const remaining = target.resolutionMin - consumed;
  const state = remaining < 0 || (remaining === 0 && !ALWAYS_PAUSED.includes(current))
    ? 'dépassé'
    : !ALWAYS_PAUSED.includes(current) && remaining <= target.resolutionMin * 0.25
      ? 'à risque'
      : 'respecté';

  return { budgetMin: target.resolutionMin, consumedMin: Math.round(consumed), dueAt, takeChargeDueAt, takeChargeMet, state, paused: isPaused };
}
