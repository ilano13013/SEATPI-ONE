// SLA décroché — statistiques téléphoniques issues de QlikView (démonstration).
//
// Feuilles QlikView identifiées :
//   - « Qlik SLA décrocher »   → source de ce module (mise en avant du SLA décroché) ;
//   - « CC pilot SLA mensuel » → identifiée, non exploitée pour l'instant.
//
// Règles :
// - les données sont FICTIVES et clairement identifiées ; aucune connexion à QlikView ;
// - agrégation à partir des volumes sources (Σ décrochés dans le délai ÷ Σ appels présentés),
//   JAMAIS par moyenne simple des pourcentages des clients ou des files ;
// - définition officielle, délai de décroché et exclusions : ceux de QlikView, à confirmer
//   (non reproduits ici) ;
// - aucun seuil contractuel n'est inventé : l'objectif est « non renseigné » tant qu'il n'a
//   pas été saisi dans Administration → Paramètres SLA ;
// - si les volumes nécessaires manquent, le calcul est déclaré indisponible.
import { createRng } from '../services/random';
import { poleGroupOfZone, POLE_CLIENTS, type PoleGroup } from '../config/itsm';
import type { SiteId } from '../types';

export const QLIK_SOURCE_SHEET = 'Qlik SLA décrocher';
export const QLIK_OTHER_SHEET = 'CC pilot SLA mensuel';
export const ANSWER_DEFINITION =
  'SLA décroché = appels décrochés dans le délai ÷ appels présentés (hypothèse de démonstration). Le délai de décroché, les exclusions et la définition officielle sont ceux de la feuille QlikView « Qlik SLA décrocher » — à confirmer.';

export interface QlikQueue {
  id: string;
  name: string;
  /** Zone de pôle du plateau (équipe dédiée ou Pôle Multi). */
  zone: string;
  /** Client unique de la file, ou null pour une file partagée (le SLA par client est alors indisponible). */
  clientId: string | null;
  /** Site d'affectation de la file (le Pôle Multi, commun aux trois sites, a une hotline par site doté d'une équipe). */
  site: SiteId;
}

export interface QlikRow {
  month: string;
  queueId: string;
  /** Appels présentés ; null = valeur absente de l'extraction. */
  offered: number | null;
  /** Appels décrochés dans le délai défini dans QlikView. */
  answeredInTarget: number | null;
}

/** Files suivies (identiques aux files du plateau). */
export const QLIK_QUEUES: QlikQueue[] = [
  { id: 'q-thelem-n1', name: 'Thelem · Helpdesk N1', zone: 'thelem', clientId: 'thelem', site: 'laciotat' },
  { id: 'q-ird-n1', name: 'IRD · Support N1', zone: 'ird', clientId: 'ird', site: 'laciotat' },
  { id: 'q-ortec-n1', name: 'Ortec · Support N1', zone: 'ortec', clientId: 'ortec', site: 'laciotat' },
  { id: 'q-ortec-n2', name: 'Ortec · Support N2', zone: 'ortec', clientId: 'ortec', site: 'laciotat' },
  { id: 'q-primagaz-n1', name: 'PRIMAGAZ · Helpdesk N1', zone: 'primagaz', clientId: 'primagaz', site: 'laciotat' },
  { id: 'q-sodiaal-n1', name: 'Sodiaal · Support utilisateurs', zone: 'sodiaal', clientId: 'sodiaal', site: 'laciotat' },
  // Un seul Pôle Multi : une hotline par site doté d'une équipe (aucune file à Paris pour le moment).
  { id: 'q-multi-hl', name: 'Pôle Multi · Hotline multi-clients — La Ciotat', zone: 'multi', clientId: null, site: 'laciotat' },
  { id: 'q-multi-mtp-hl', name: 'Pôle Multi · Hotline multi-clients — Montpellier', zone: 'multi', clientId: null, site: 'montpellier' },
];

export const poleOfQueue = (q: QlikQueue): PoleGroup | null => poleGroupOfZone(q.zone);

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

export function lastMonths(now: number, n = 12): string[] {
  const d = new Date(now);
  return Array.from({ length: n }, (_, i) => monthKey(new Date(d.getFullYear(), d.getMonth() - (n - 1 - i), 1)));
}

/** Extraction fictive : volumes mensuels par file (un mois manquant volontaire pour illustrer l'indisponibilité). */
export function demoExtraction(now: number, seed = 31): QlikRow[] {
  const rng = createRng(seed);
  const months = lastMonths(now);
  const rows: QlikRow[] = [];
  for (const q of QLIK_QUEUES) {
    const base = q.clientId ? 900 + Math.floor(rng() * 2200) : 3800 + Math.floor(rng() * 1500);
    const level = 0.84 + rng() * 0.1;
    months.forEach((m, i) => {
      const partial = i === months.length - 1 ? 0.4 : 1; // mois en cours : extraction partielle
      const offered = Math.round(base * partial * (0.85 + rng() * 0.3));
      const rate = Math.min(0.99, Math.max(0.6, level + (rng() - 0.5) * 0.08 - (i % 5 === 3 ? 0.04 : 0)));
      // Donnée absente de l'extraction pour une file et un mois (démonstration du « calcul indisponible »).
      const missing = q.id === 'q-ortec-n2' && i === months.length - 5;
      rows.push({ month: m, queueId: q.id, offered: missing ? null : offered, answeredInTarget: missing ? null : Math.round(offered * rate) });
    });
  }
  return rows;
}

export interface Aggregate {
  offered: number;
  answeredInTarget: number;
  /** SLA (%) ou null si le calcul est indisponible. */
  rate: number | null;
  /** Raison de l'indisponibilité. */
  unavailable: string | null;
  /** Lignes exclues du calcul faute de volumes (file, mois, champs absents). */
  missing: { queueId: string; queueName: string; month: string; fields: string[] }[];
}

const queueName = (id: string) => QLIK_QUEUES.find((q) => q.id === id)?.name ?? id;

/** Agrégation compatible avec le reporting : à partir des volumes, jamais des pourcentages. */
export function aggregate(rows: QlikRow[]): Aggregate {
  if (!rows.length) return { offered: 0, answeredInTarget: 0, rate: null, unavailable: 'Aucune donnée pour ce périmètre.', missing: [] };
  const incomplete = rows.filter((r) => r.offered === null || r.answeredInTarget === null);
  const complete = rows.filter((r) => !incomplete.includes(r));
  // Volumes des lignes complètes uniquement (aucune estimation des lignes manquantes).
  const offered = complete.reduce((n, r) => n + r.offered!, 0);
  const answeredInTarget = complete.reduce((n, r) => n + r.answeredInTarget!, 0);
  if (incomplete.length) {
    const missing = incomplete.map((r) => ({
      queueId: r.queueId,
      queueName: queueName(r.queueId),
      month: r.month,
      fields: [...(r.offered === null ? ['appels présentés'] : []), ...(r.answeredInTarget === null ? ['décrochés dans le délai'] : [])],
    }));
    const detail = missing.map((m) => `« ${m.queueName} » (${m.fields.join(', ')})`).join(' ; ');
    return { offered, answeredInTarget, rate: null, unavailable: `Volumes manquants dans l’extraction : ${detail}. Calcul indisponible (aucune estimation).`, missing };
  }
  if (!offered) return { offered, answeredInTarget, rate: null, unavailable: 'Aucun appel présenté.', missing: [] };
  return { offered, answeredInTarget, rate: Math.round((answeredInTarget / offered) * 1000) / 10, unavailable: null, missing: [] };
}

export interface QlikFilters {
  pole: PoleGroup | '';
  /** Site d'affectation des files ('' = tous les sites, vue consolidée). */
  site?: SiteId | '';
  client: string;
  queue: string;
  /** Mois inclus (AAAA-MM). */
  months: string[];
}

export function filterRows(rows: QlikRow[], f: QlikFilters): QlikRow[] {
  const queues = QLIK_QUEUES.filter((q) => (!f.pole || poleOfQueue(q) === f.pole) && (!f.site || q.site === f.site) && (!f.queue || q.id === f.queue) && (!f.client || q.clientId === f.client || (q.clientId === null && (POLE_CLIENTS[q.zone] ?? []).includes(f.client)))).map((q) => q.id);
  return rows.filter((r) => queues.includes(r.queueId) && (!f.months.length || f.months.includes(r.month)));
}

export interface ClientSla {
  clientId: string;
  agg: Aggregate;
}

/** SLA par client, uniquement lorsque toutes les files du client lui sont dédiées. */
export function clientSla(rows: QlikRow[], clientId: string, months: string[], site?: SiteId | ''): ClientSla {
  const shared = QLIK_QUEUES.some((q) => q.clientId === null && (!site || q.site === site) && (POLE_CLIENTS[q.zone] ?? []).includes(clientId));
  const own = QLIK_QUEUES.filter((q) => q.clientId === clientId && (!site || q.site === site)).map((q) => q.id);
  if (shared || !own.length)
    return { clientId, agg: { offered: 0, answeredInTarget: 0, missing: [], rate: null, unavailable: shared ? 'File partagée multi-clients : le SLA par client n’est pas disponible dans l’extraction.' : site ? 'Aucune file de ce client sur ce site.' : 'Aucune file associée.' } };
  return { clientId, agg: aggregate(rows.filter((r) => own.includes(r.queueId) && months.includes(r.month))) };
}

export interface Comparison {
  objective: number | null;
  gap: number | null;
  breach: boolean;
}

/** Écart à l'objectif contractuel — uniquement si l'objectif est renseigné et le SLA calculable. */
export function compare(rate: number | null, objective: number | null | undefined): Comparison {
  if (objective === null || objective === undefined || rate === null) return { objective: objective ?? null, gap: null, breach: false };
  const gap = Math.round((rate - objective) * 10) / 10;
  return { objective, gap, breach: gap < 0 };
}

/** État d'évaluation d'un SLA : jamais de conformité implicite sans objectif renseigné. */
export type SlaState = 'conforme' | 'non conforme' | 'non évalué' | 'données indisponibles';

export const SLA_STATE_LABEL: Record<SlaState, string> = {
  conforme: 'Conforme',
  'non conforme': 'Non conforme',
  'non évalué': 'Non évalué — objectif à renseigner',
  'données indisponibles': 'Données indisponibles',
};

export const SLA_STATE_DEFINITIONS: [SlaState, string][] = [
  ['conforme', 'SLA calculé à partir des volumes et supérieur ou égal à l’objectif contractuel renseigné.'],
  ['non conforme', 'SLA calculé et inférieur à l’objectif contractuel renseigné (écart affiché).'],
  ['non évalué', 'Aucun objectif contractuel renseigné : la conformité ne peut pas être évaluée.'],
  ['données indisponibles', 'Volumes absents ou file partagée : le SLA n’est pas calculable, il n’est jamais estimé.'],
];

export function slaState(rate: number | null, objective: number | null | undefined): SlaState {
  if (rate === null) return 'données indisponibles';
  if (objective === null || objective === undefined) return 'non évalué';
  return rate >= objective ? 'conforme' : 'non conforme';
}
