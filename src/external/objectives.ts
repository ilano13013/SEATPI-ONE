// Objectifs hebdomadaires configurables : volume et qualité.
import type { ExternalClient, Ticket } from './types';
import type { ObjectiveConfig } from './config';
import { addDays, businessMinutesBetween, startOfWeek } from './calendar';
import { avgResolutionMin, avgTakeChargeMin, backlogAt, createdIn, isOpen, isPriority, periods, reopenedIn, resolvedIn, slaRate, type Period } from './metrics';

export type ObjectiveKind = 'volume' | 'qualité';
export type ObjectiveStatus = 'atteint' | 'en bonne voie' | 'à risque' | 'non atteint';

export interface ObjectiveRow {
  key: keyof ObjectiveConfig;
  label: string;
  kind: ObjectiveKind;
  unit: string;
  /** Sens de l'objectif : minimum à atteindre ou maximum à ne pas dépasser. */
  direction: 'min' | 'max';
  target: number;
  actual: number | null;
  /** Reste à faire pour atteindre l'objectif (0 si atteint). */
  remaining: number | null;
  /** Écart signé réalisé − objectif. */
  gap: number | null;
  previous: number | null;
  trend: 'hausse' | 'baisse' | 'stable' | null;
  /** La tendance va-t-elle dans le bon sens ? */
  trendGood: boolean | null;
  projection: number | null;
  status: ObjectiveStatus;
  ticketIds: string[];
}

export const OBJECTIVE_META: Record<keyof ObjectiveConfig, { label: string; kind: ObjectiveKind; unit: string; direction: 'min' | 'max'; help: string }> = {
  ticketsToResolve: { label: 'Tickets à résoudre', kind: 'volume', unit: 'tickets', direction: 'min', help: 'Tickets distincts résolus sur la semaine.' },
  backlogMax: { label: 'Backlog maximum', kind: 'volume', unit: 'tickets', direction: 'max', help: 'Tickets ouverts à l’instant de mesure.' },
  priorityOpenMax: { label: 'Tickets prioritaires à traiter', kind: 'volume', unit: 'tickets', direction: 'max', help: 'Tickets P1/P2 encore ouverts.' },
  slaMin: { label: 'SLA minimum', kind: 'qualité', unit: '%', direction: 'min', help: 'Résolutions de la semaine dans le délai contractuel.' },
  takeChargeMaxMin: { label: 'Délai de prise en charge', kind: 'qualité', unit: 'min', direction: 'max', help: 'Moyenne en minutes ouvrées.' },
  resolutionMaxH: { label: 'Délai de résolution', kind: 'qualité', unit: 'h', direction: 'max', help: 'Moyenne en heures ouvrées.' },
  reopenRateMax: { label: 'Taux de réouverture maximum', kind: 'qualité', unit: '%', direction: 'max', help: 'Tickets réouverts ÷ tickets résolus sur la semaine.' },
};

const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

interface Snapshot {
  ticketsToResolve: number;
  backlogMax: number;
  priorityOpenMax: number;
  slaMin: number | null;
  takeChargeMaxMin: number | null;
  resolutionMaxH: number | null;
  reopenRateMax: number | null;
}

function snapshot(tickets: Ticket[], p: Period, client: ExternalClient, at: number): Snapshot {
  const clients = { [client.id]: client };
  const resolved = tickets.filter((t) => resolvedIn(t, p));
  const backlog = backlogAt(tickets, at);
  const reopened = tickets.filter((t) => reopenedIn(t, p));
  const take = avgTakeChargeMin(tickets, p, clients);
  const res = avgResolutionMin(tickets, p, clients);
  return {
    ticketsToResolve: resolved.length,
    backlogMax: backlog.length,
    priorityOpenMax: backlog.filter((t) => isPriority(t.priority)).length,
    slaMin: slaRate(tickets, p).rate,
    takeChargeMaxMin: round1(take),
    resolutionMaxH: res === null ? null : round1(res / 60),
    reopenRateMax: resolved.length ? round1((reopened.length / resolved.length) * 100) : null,
  };
}

/** Part du temps ouvré de la semaine déjà écoulée (0–1). */
export function weekProgress(now: number, client: ExternalClient): number {
  const start = startOfWeek(now);
  const total = businessMinutesBetween(start, addDays(start, 7), client.calendar);
  return total ? Math.min(1, businessMinutesBetween(start, now, client.calendar) / total) : 1;
}

export function computeObjectives(tickets: Ticket[], client: ExternalClient, cfg: ObjectiveConfig, now: number): ObjectiveRow[] {
  const { week, prevWeek } = periods(now);
  const cur = snapshot(tickets, week, client, now);
  const prev = snapshot(tickets, prevWeek, client, prevWeek.end);
  const progress = weekProgress(now, client);
  const weekEnd = addDays(week.start, 7);
  const remainingBusiness = businessMinutesBetween(now, weekEnd, client.calendar);

  const resolvedIds = tickets.filter((t) => resolvedIn(t, week)).map((t) => t.id);
  const openIds = tickets.filter(isOpen).map((t) => t.id);
  const idsFor: Record<keyof ObjectiveConfig, string[]> = {
    ticketsToResolve: resolvedIds,
    backlogMax: openIds,
    priorityOpenMax: tickets.filter((t) => isOpen(t) && isPriority(t.priority)).map((t) => t.id),
    slaMin: tickets.filter((t) => resolvedIn(t, week) && t.sla.consumedMin > t.sla.budgetMin).map((t) => t.id),
    takeChargeMaxMin: tickets.filter((t) => t.takenAt !== null && t.takenAt >= week.start).map((t) => t.id),
    resolutionMaxH: resolvedIds,
    reopenRateMax: tickets.filter((t) => reopenedIn(t, week)).map((t) => t.id),
  };

  // Projection du backlog : flux net (reçus − résolus) mesuré sur les 7 derniers jours glissants,
  // prolongé jusqu'à la fin de semaine (plus stable qu'un flux mesuré depuis lundi).
  const rolling: Period = { key: 'week', label: '7 derniers jours', start: addDays(now, -7), end: now };
  const rollingMinutes = businessMinutesBetween(rolling.start, now, client.calendar);
  const net = tickets.filter((t) => createdIn(t, rolling)).length - tickets.filter((t) => resolvedIn(t, rolling)).length;
  const netRate = rollingMinutes ? net / rollingMinutes : 0;

  return (Object.keys(OBJECTIVE_META) as (keyof ObjectiveConfig)[]).map((key) => {
    const meta = OBJECTIVE_META[key];
    const target = cfg[key];
    const actual = cur[key];
    const previous = prev[key];
    let projection: number | null = actual;
    if (key === 'ticketsToResolve') projection = progress > 0.02 ? Math.round(actual! / progress) : previous;
    if (key === 'backlogMax') projection = Math.max(0, Math.round(actual! + netRate * remainingBusiness));

    const good = (v: number | null) => (v === null ? null : meta.direction === 'min' ? v >= target : v <= target);
    const remaining = actual === null ? null : round1(Math.max(0, meta.direction === 'min' ? target - actual : actual - target));
    const gap = actual === null ? null : round1(actual - target);

    let trend: ObjectiveRow['trend'] = null;
    let trendGood: boolean | null = null;
    const compared = key === 'ticketsToResolve' ? projection : actual;
    if (compared !== null && previous !== null) {
      const delta = compared - previous;
      trend = Math.abs(delta) < Math.max(0.5, Math.abs(previous) * 0.03) ? 'stable' : delta > 0 ? 'hausse' : 'baisse';
      trendGood = trend === 'stable' ? null : (trend === 'hausse') === (meta.direction === 'min');
    }

    let status: ObjectiveStatus;
    const weekOver = progress >= 1;
    if (actual === null) status = 'en bonne voie';
    else if (meta.kind === 'volume' && meta.direction === 'min') {
      status = actual >= target ? 'atteint' : weekOver ? 'non atteint' : (projection ?? 0) >= target ? 'en bonne voie' : 'à risque';
    } else if (good(actual)) {
      status = good(projection) === false ? 'à risque' : weekOver ? 'atteint' : 'en bonne voie';
    } else {
      status = weekOver ? 'non atteint' : 'à risque';
    }

    return { key, label: meta.label, kind: meta.kind, unit: meta.unit, direction: meta.direction, target, actual, remaining, gap, previous, trend, trendGood, projection, status, ticketIds: idsFor[key] };
  });
}
