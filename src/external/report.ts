// Rapport hebdomadaire par client et consolidation département.
// Le rapport s'appuie exclusivement sur les mêmes fonctions de calcul que le cockpit.
import type { ExternalClient, Technician, Ticket } from './types';
import type { ObjectiveConfig } from './config';
import { contractById, teamsOf } from './config';
import { businessMinutesBetween, dateKey, nextBusinessDays, startOfDay } from './calendar';
import { backlogAt, createdIn, resolvedIn, slaRate, type Period } from './metrics';
import { computeObjectives, type ObjectiveRow } from './objectives';

/** Heures réalisées d'un technicien sur la période (planning × disponibilité, hors congés). */
export function workedHours(tech: Technician, p: Period, client: ExternalClient): number {
  const days = nextBusinessDays(p.start, 10, client.calendar).filter((d) => d < p.end);
  return days.reduce((sum, day) => {
    if (tech.leaveDates.includes(dateKey(day))) return sum;
    const open = new Date(day).setHours(client.calendar.startHour);
    const close = new Date(day).setHours(client.calendar.endHour);
    const share = Math.min(1, businessMinutesBetween(open, Math.min(close, p.end), client.calendar) / ((close - open) / 60_000));
    return sum + tech.hoursPerDay * tech.availability * share;
  }, 0);
}

export interface Finance {
  hours: number;
  revenue: number;
  cost: number;
  margin: number;
  marginRate: number | null;
  budget: number;
}

/** Finances de la période : heures × tarif contractuel / coût interne ; budget mensuel proratisé. */
export function finance(techs: Technician[], p: Period, client: ExternalClient): Finance {
  let hours = 0;
  let revenue = 0;
  let cost = 0;
  for (const t of techs) {
    const h = workedHours(t, p, client);
    const c = contractById(t.contractId);
    hours += h;
    revenue += h * c.hourlyRate;
    cost += h * c.costRate;
  }
  const contractIds = [...new Set(teamsOf(client.id).map((t) => t.contractId))];
  const weekDays = Math.max(1, (startOfDay(p.end) - startOfDay(p.start)) / 86_400_000) || 1;
  const budget = contractIds.reduce((s, id) => s + contractById(id).monthlyBudget, 0) * (12 / 365) * Math.min(7, weekDays);
  return {
    hours: Math.round(hours * 10) / 10,
    revenue: Math.round(revenue),
    cost: Math.round(cost),
    margin: Math.round(revenue - cost),
    marginRate: revenue ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : null,
    budget: Math.round(budget),
  };
}

export interface WeeklyReport {
  scope: string;
  label: string;
  period: Period;
  received: number;
  resolved: number;
  backlogStart: number;
  backlogEnd: number;
  slaRate: number | null;
  slaResolved: number;
  slaMet: number;
  majorIncidents: { id: string; client: string; title: string; status: string }[];
  activities: { category: string; count: number }[];
  objectivesMet: (ObjectiveRow & { client: string })[];
  objectivesMissed: (ObjectiveRow & { client: string })[];
  headcount: number;
  finance: Finance;
  correctiveActions: string[];
}

const CORRECTIVE: Partial<Record<keyof ObjectiveConfig, string>> = {
  ticketsToResolve: 'Renforcer la capacité de résolution (répartition entre équipes, traitement des tickets anciens en priorité).',
  backlogMax: 'Organiser une session de résorption du backlog et revoir les tickets en attente prolongée.',
  priorityOpenMax: 'Revue quotidienne des tickets P1/P2 avec le client et le N2.',
  slaMin: 'Analyser les dépassements SLA par catégorie et ajuster le dispatch des tickets proches de l’échéance.',
  takeChargeMaxMin: 'Mettre en place une veille de prise en charge sur les plages de forte arrivée.',
  resolutionMaxH: 'Identifier les catégories à résolution longue et formaliser des procédures de résolution.',
  reopenRateMax: 'Contrôler la qualité des résolutions (validation utilisateur avant clôture).',
};

export function buildClientReport(client: ExternalClient, tickets: Ticket[], techs: Technician[], cfg: ObjectiveConfig, p: Period, now: number): WeeklyReport {
  const sla = slaRate(tickets, p);
  const resolved = tickets.filter((t) => resolvedIn(t, p));
  const categories = new Map<string, number>();
  for (const t of resolved) categories.set(t.category, (categories.get(t.category) ?? 0) + 1);
  // Les objectifs sont évalués à la fin de la période étudiée.
  const objectives = computeObjectives(tickets, client, cfg, Math.min(now, p.end - 1)).map((o) => ({ ...o, client: client.name }));
  const met = objectives.filter((o) => o.status === 'atteint' || o.status === 'en bonne voie');
  const missed = objectives.filter((o) => o.status === 'à risque' || o.status === 'non atteint');
  return {
    scope: client.id,
    label: client.name,
    period: p,
    received: tickets.filter((t) => createdIn(t, p)).length,
    resolved: resolved.length,
    backlogStart: backlogAt(tickets, p.start).length,
    backlogEnd: backlogAt(tickets, p.end).length,
    slaRate: sla.rate,
    slaResolved: sla.resolved.length,
    slaMet: sla.met.length,
    majorIncidents: tickets
      .filter((t) => t.priority === 'P1' && t.createdAt < p.end && (createdIn(t, p) || resolvedIn(t, p)))
      .map((t) => ({ id: t.id, client: client.name, title: t.title, status: t.status })),
    activities: [...categories.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    objectivesMet: met,
    objectivesMissed: missed,
    headcount: techs.length,
    finance: finance(techs, p, client),
    correctiveActions: missed.map((o) => `${client.name} — ${o.label} : ${CORRECTIVE[o.key]}`),
  };
}

/** Consolidation département : sommes, SLA recalculé sur l'ensemble des résolutions. */
export function consolidateReports(reports: WeeklyReport[], label = 'Département Helpdesk — clients externes'): WeeklyReport {
  const sum = (f: (r: WeeklyReport) => number) => reports.reduce((s, r) => s + f(r), 0);
  const slaResolved = sum((r) => r.slaResolved);
  const slaMet = sum((r) => r.slaMet);
  const activities = new Map<string, number>();
  for (const r of reports) for (const a of r.activities) activities.set(a.category, (activities.get(a.category) ?? 0) + a.count);
  const revenue = sum((r) => r.finance.revenue);
  const cost = sum((r) => r.finance.cost);
  return {
    scope: 'department',
    label,
    period: reports[0].period,
    received: sum((r) => r.received),
    resolved: sum((r) => r.resolved),
    backlogStart: sum((r) => r.backlogStart),
    backlogEnd: sum((r) => r.backlogEnd),
    slaRate: slaResolved ? Math.round((slaMet / slaResolved) * 1000) / 10 : null,
    slaResolved,
    slaMet,
    majorIncidents: reports.flatMap((r) => r.majorIncidents),
    activities: [...activities.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    objectivesMet: reports.flatMap((r) => r.objectivesMet),
    objectivesMissed: reports.flatMap((r) => r.objectivesMissed),
    headcount: sum((r) => r.headcount),
    finance: {
      hours: Math.round(sum((r) => r.finance.hours) * 10) / 10,
      revenue,
      cost,
      margin: revenue - cost,
      marginRate: revenue ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : null,
      budget: sum((r) => r.finance.budget),
    },
    correctiveActions: reports.flatMap((r) => r.correctiveActions),
  };
}

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;

export function reportToMarkdown(r: WeeklyReport, showFinance: boolean, extraActions = ''): string {
  const fmt = (t: number) => new Date(t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  const lines = [
    `# Rapport hebdomadaire — ${r.label}`,
    '',
    `Période : ${fmt(r.period.start)} → ${fmt(r.period.end)} · Données fictives (démonstration SEATPI ONE)`,
    '',
    '## Activité',
    `- Tickets reçus : ${r.received}`,
    `- Tickets résolus : ${r.resolved}`,
    `- Backlog début / fin de période : ${r.backlogStart} → ${r.backlogEnd}`,
    `- Respect des SLA : ${r.slaRate === null ? '—' : `${r.slaRate} %`} (${r.slaMet}/${r.slaResolved})`,
    `- Effectif mobilisé : ${r.headcount} · Heures réalisées : ${r.finance.hours} h`,
    '',
    '## Incidents majeurs (P1)',
    ...(r.majorIncidents.length ? r.majorIncidents.map((i) => `- ${i.id} (${i.client}) ${i.title} — ${i.status}`) : ['- Aucun']),
    '',
    '## Activités réalisées (résolutions par catégorie)',
    ...r.activities.map((a) => `- ${a.category} : ${a.count}`),
    '',
    '## Objectifs atteints ou en bonne voie',
    ...(r.objectivesMet.length ? r.objectivesMet.map((o) => `- ${o.client} — ${o.label} : ${o.actual ?? '—'} ${o.unit} (objectif ${o.target})`) : ['- Aucun']),
    '',
    '## Objectifs non atteints ou à risque',
    ...(r.objectivesMissed.length ? r.objectivesMissed.map((o) => `- ${o.client} — ${o.label} : ${o.actual ?? '—'} ${o.unit} (objectif ${o.target})`) : ['- Aucun']),
  ];
  if (showFinance) {
    lines.push('', '## Finances', `- Budget de la période : ${eur(r.finance.budget)}`, `- Chiffre d’affaires : ${eur(r.finance.revenue)}`, `- Coûts : ${eur(r.finance.cost)}`, `- Rentabilité : ${r.finance.marginRate ?? '—'} %`);
  }
  lines.push('', '## Actions correctives', ...(r.correctiveActions.length ? r.correctiveActions.map((a) => `- ${a}`) : ['- Aucune action requise']));
  if (extraActions.trim()) lines.push(...extraActions.trim().split('\n').map((l) => `- ${l.replace(/^- /, '')}`));
  return lines.join('\n');
}
