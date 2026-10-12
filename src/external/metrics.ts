// Indicateurs du cockpit client. Chaque indicateur a une définition explicite
// et renvoie la liste des tickets concernés (indicateurs cliquables).
import type { ExternalClient, Priority, Ticket, TicketStatus } from './types';
import { addDays, businessMinutesBetween, startOfDay, startOfWeek } from './calendar';

export type PeriodKey = 'today' | 'week' | 'prevWeek';

export interface Period {
  key: PeriodKey;
  label: string;
  start: number;
  end: number;
}

const fmtDay = (t: number) => new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

/** Périodes de référence : [début, fin[ en heure locale. */
export function periods(now: number): Record<PeriodKey, Period> {
  const week = startOfWeek(now);
  const prev = addDays(week, -7);
  return {
    today: { key: 'today', label: `Aujourd'hui (${fmtDay(now)})`, start: startOfDay(now), end: now },
    week: { key: 'week', label: `Semaine en cours (depuis le lundi ${fmtDay(week)})`, start: week, end: now },
    prevWeek: { key: 'prevWeek', label: `Semaine précédente (${fmtDay(prev)} → ${fmtDay(addDays(week, -1))})`, start: prev, end: week },
  };
}

export const CLOSED_STATUSES: TicketStatus[] = ['Résolu', 'Clôturé'];
export const isOpen = (t: Ticket) => !CLOSED_STATUSES.includes(t.status);
export const isPriority = (p: Priority) => p === 'P1' || p === 'P2';
const inP = (at: number | null | undefined, p: Period) => at != null && at >= p.start && at < p.end;

/** Statut du ticket à l'instant `at` (null s'il n'existait pas encore). */
export function statusAt(t: Ticket, at: number): TicketStatus | null {
  if (t.createdAt > at) return null;
  let status: TicketStatus = 'Nouveau';
  for (const e of t.history) if (e.kind === 'statut' && e.at <= at) status = e.to as TicketStatus;
  return status;
}

export const isOpenAt = (t: Ticket, at: number) => {
  const s = statusAt(t, at);
  return s !== null && !CLOSED_STATUSES.includes(s);
};

const transitionsTo = (t: Ticket, status: TicketStatus, p: Period) => t.history.filter((e) => e.kind === 'statut' && e.to === status && inP(e.at, p));

/** Résolu sur la période : au moins une résolution dans la période — un ticket n'est compté qu'une fois. */
export const resolvedIn = (t: Ticket, p: Period) => transitionsTo(t, 'Résolu', p).length > 0;
export const closedIn = (t: Ticket, p: Period) => transitionsTo(t, 'Clôturé', p).length > 0;
export const reopenedIn = (t: Ticket, p: Period) => transitionsTo(t, 'Réouvert', p).length > 0;
export const escalatedIn = (t: Ticket, p: Period) => t.escalations.some((e) => inP(e.at, p));
export const createdIn = (t: Ticket, p: Period) => inP(t.createdAt, p);
export const takenIn = (t: Ticket, p: Period) => inP(t.takenAt, p);

/** Dernière résolution comprise dans la période (pour les délais). */
function resolutionIn(t: Ticket, p: Period): number | null {
  const e = transitionsTo(t, 'Résolu', p);
  return e.length ? e[e.length - 1].at : null;
}

/** Une résolution est conforme si le SLA n'était pas dépassé au moment de la résolution. */
export const resolvedWithinSla = (t: Ticket) => t.sla.consumedMin <= t.sla.budgetMin;

export interface KpiResult {
  id: string;
  label: string;
  group: 'Tickets' | 'Activité';
  value: number | null;
  display: string;
  ticketIds: string[];
  definition: string;
  tone?: 'ok' | 'warn' | 'bad';
}

export interface MetricsContext {
  now: number;
  period: Period;
  clients: Record<string, ExternalClient>;
  /** Nombre de techniciens actifs (pour la productivité). */
  headcount: number;
}

const ids = (list: Ticket[]) => list.map((t) => t.id);
const pct = (n: number, d: number) => (d === 0 ? null : Math.round((n / d) * 1000) / 10);
const avg = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);

export function formatMinutesOuvrees(min: number | null): string {
  if (min === null) return '—';
  if (min < 60) return `${Math.round(min)} min`;
  const h = min / 60;
  return h < 10 ? `${h.toFixed(1).replace('.', ',')} h` : `${Math.round(h)} h`;
}

/** Délai moyen de prise en charge (minutes ouvrées) des tickets pris en charge sur la période. */
export function avgTakeChargeMin(tickets: Ticket[], p: Period, clients: Record<string, ExternalClient>): number | null {
  return avg(tickets.filter((t) => takenIn(t, p)).map((t) => businessMinutesBetween(t.createdAt, t.takenAt!, clients[t.clientId].calendar)));
}

/** Temps moyen de résolution (minutes ouvrées, création → résolution) des tickets résolus sur la période. */
export function avgResolutionMin(tickets: Ticket[], p: Period, clients: Record<string, ExternalClient>): number | null {
  return avg(
    tickets
      .filter((t) => resolvedIn(t, p))
      .map((t) => businessMinutesBetween(t.createdAt, resolutionIn(t, p)!, clients[t.clientId].calendar)),
  );
}

export function slaRate(tickets: Ticket[], p: Period): { rate: number | null; resolved: Ticket[]; met: Ticket[] } {
  const resolved = tickets.filter((t) => resolvedIn(t, p));
  const met = resolved.filter(resolvedWithinSla);
  return { rate: pct(met.length, resolved.length), resolved, met };
}

export function backlogAt(tickets: Ticket[], at: number): Ticket[] {
  return tickets.filter((t) => isOpenAt(t, at));
}

export function computeKpis(tickets: Ticket[], ctx: MetricsContext): KpiResult[] {
  const { now, period: p } = ctx;
  const open = tickets.filter(isOpen);
  const today = periods(now).today;
  const resolved = tickets.filter((t) => resolvedIn(t, p));
  const received = tickets.filter((t) => createdIn(t, p));
  const backlogStart = backlogAt(tickets, p.start);
  const sla = slaRate(tickets, p);
  const take = avgTakeChargeMin(tickets, p, ctx.clients);
  const res = avgResolutionMin(tickets, p, ctx.clients);
  const resolutionRate = pct(resolved.length, backlogStart.length + received.length);
  const days = Math.max(1, Math.ceil((p.end - p.start) / 86_400_000));
  const k = (id: string, group: KpiResult['group'], label: string, list: Ticket[], definition: string, tone?: KpiResult['tone']): KpiResult => ({
    id,
    group,
    label,
    value: list.length,
    display: String(list.length),
    ticketIds: ids(list),
    definition,
    tone,
  });
  const breached = open.filter((t) => t.sla.state === 'dépassé');
  const atRisk = open.filter((t) => t.sla.state === 'à risque');
  const unassigned = open.filter((t) => !t.assigneeId);
  return [
    k('open', 'Tickets', 'Tickets ouverts', open, 'Statut actuel différent de Résolu et Clôturé.'),
    k('createdToday', 'Tickets', 'Créés aujourd’hui', tickets.filter((t) => createdIn(t, today)), 'Date de création depuis 00:00 aujourd’hui.'),
    k('inProgress', 'Tickets', 'En cours', open.filter((t) => t.status === 'En cours'), 'Statut actuel En cours.'),
    k('waiting', 'Tickets', 'En attente', open.filter((t) => t.status === 'En attente'), 'Statut actuel En attente (SLA suspendu).'),
    k('blocked', 'Tickets', 'Bloqués', open.filter((t) => t.status === 'Bloqué'), 'Statut actuel Bloqué (SLA non suspendu).', open.some((t) => t.status === 'Bloqué') ? 'warn' : undefined),
    k('resolved', 'Tickets', 'Résolus (période)', resolved, 'Tickets ayant au moins une résolution sur la période ; un ticket résolu plusieurs fois n’est compté qu’une fois.'),
    k('closed', 'Tickets', 'Clôturés (période)', tickets.filter((t) => closedIn(t, p)), 'Tickets clôturés sur la période (comptés une fois).'),
    k('reopened', 'Tickets', 'Réouverts (période)', tickets.filter((t) => reopenedIn(t, p)), 'Tickets réouverts au moins une fois sur la période.'),
    k('unassigned', 'Tickets', 'Non affectés', unassigned, 'Tickets ouverts sans technicien affecté.', unassigned.length ? 'warn' : 'ok'),
    k('priority', 'Tickets', 'Prioritaires (P1/P2)', open.filter((t) => isPriority(t.priority)), 'Tickets ouverts de priorité P1 ou P2.'),
    k('breached', 'Tickets', 'Hors SLA', breached, 'Tickets ouverts dont le délai de résolution contractuel est dépassé.', breached.length ? 'bad' : 'ok'),
    k('atRisk', 'Tickets', 'Proches du SLA', atRisk, 'Tickets ouverts ayant consommé plus de 75 % de leur délai de résolution.', atRisk.length ? 'warn' : 'ok'),
    k('backlog', 'Tickets', 'Backlog total', open, 'Stock de tickets ouverts à l’instant de la synchronisation (= tickets ouverts).'),
    {
      id: 'aging',
      group: 'Tickets',
      label: 'Ancienneté moyenne (backlog)',
      value: avg(open.map((t) => now - t.createdAt)),
      display: open.length ? `${(avg(open.map((t) => now - t.createdAt))! / 86_400_000).toFixed(1).replace('.', ',')} j` : '—',
      ticketIds: ids(open),
      definition: 'Âge calendaire moyen des tickets ouverts (voir la répartition par tranche).',
    },
    {
      id: 'receivedPerDay',
      group: 'Activité',
      label: 'Reçus par jour',
      value: received.length / days,
      display: (received.length / days).toFixed(1).replace('.', ','),
      ticketIds: ids(received),
      definition: 'Tickets créés sur la période divisés par le nombre de jours calendaires de la période.',
    },
    k('taken', 'Activité', 'Pris en charge', tickets.filter((t) => takenIn(t, p)), 'Première prise en charge (passage à En cours ou au-delà) sur la période.'),
    k('resolvedAct', 'Activité', 'Résolus', resolved, 'Identique à « Résolus (période) ».'),
    k('escalated', 'Activité', 'Escaladés', tickets.filter((t) => escalatedIn(t, p)), 'Tickets ayant fait l’objet d’au moins une escalade sur la période.'),
    {
      id: 'takeCharge',
      group: 'Activité',
      label: 'Délai moyen de prise en charge',
      value: take,
      display: formatMinutesOuvrees(take),
      ticketIds: ids(tickets.filter((t) => takenIn(t, p))),
      definition: 'Moyenne, en temps ouvré du calendrier client, entre création et première prise en charge, pour les tickets pris en charge sur la période.',
    },
    {
      id: 'resolutionTime',
      group: 'Activité',
      label: 'Temps moyen de résolution',
      value: res,
      display: formatMinutesOuvrees(res),
      ticketIds: ids(resolved),
      definition: 'Moyenne, en temps ouvré, entre création et dernière résolution de la période.',
    },
    {
      id: 'resolutionRate',
      group: 'Activité',
      label: 'Taux de résolution',
      value: resolutionRate,
      display: resolutionRate === null ? '—' : `${resolutionRate.toLocaleString('fr-FR')} %`,
      ticketIds: ids(resolved),
      definition: 'Résolus sur la période ÷ (backlog en début de période + tickets reçus sur la période).',
    },
    {
      id: 'slaRate',
      group: 'Activité',
      label: 'Respect des SLA',
      value: sla.rate,
      display: sla.rate === null ? '—' : `${sla.rate.toLocaleString('fr-FR')} %`,
      ticketIds: ids(sla.resolved.filter((t) => !resolvedWithinSla(t))),
      definition: 'Tickets résolus sur la période dans leur délai contractuel ÷ tickets résolus sur la période. La liste montre les résolutions hors délai.',
      tone: sla.rate === null ? undefined : sla.rate >= 95 ? 'ok' : sla.rate >= 90 ? 'warn' : 'bad',
    },
    {
      id: 'productivity',
      group: 'Activité',
      label: 'Résolus par technicien',
      value: ctx.headcount ? resolved.length / ctx.headcount : null,
      display: ctx.headcount ? (resolved.length / ctx.headcount).toFixed(1).replace('.', ',') : '—',
      ticketIds: ids(resolved),
      definition: 'Résolus sur la période ÷ effectif affecté. Indicateur d’équipe : il ne sert pas à classer les personnes.',
    },
    k('remaining', 'Activité', 'Volume restant à traiter', open.filter((t) => t.status !== 'En attente'), 'Tickets ouverts actionnables (hors En attente client).'),
  ];
}

/** Tickets reçus par jour calendaire sur les `days` derniers jours. */
export function receivedPerDay(tickets: Ticket[], now: number, days = 10): { day: number; label: string; ids: string[] }[] {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = startOfDay(addDays(now, -i));
    const end = startOfDay(addDays(day, 1));
    const list = tickets.filter((t) => t.createdAt >= day && t.createdAt < end);
    out.push({ day, label: new Date(day).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' }), ids: ids(list) });
  }
  return out;
}

export const AGING_BUCKETS: [string, number, number][] = [
  ['< 1 j', 0, 1],
  ['1 – 3 j', 1, 3],
  ['3 – 7 j', 3, 7],
  ['> 7 j', 7, Infinity],
];

export function agingBuckets(tickets: Ticket[], now: number): { label: string; ids: string[] }[] {
  const open = tickets.filter(isOpen);
  return AGING_BUCKETS.map(([label, min, max]) => ({
    label,
    ids: ids(open.filter((t) => {
      const d = (now - t.createdAt) / 86_400_000;
      return d >= min && d < max;
    })),
  }));
}
