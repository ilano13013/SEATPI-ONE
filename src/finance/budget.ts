// Budget & Rentabilité du département Helpdesk — fonctions pures.
//
// TOUTES LES VALEURS SONT FICTIVES (démonstration). Règles :
// - coûts = coût employeur chargé (jamais le salaire net), au prorata de l'ETP, de l'affectation et de la présence ;
// - revenus = prestations du registre ; un ticket résolu ou un CRA ne produit jamais de revenu ;
// - résultat analytique = revenus − coûts opérationnels ; marge = résultat ÷ revenus × 100 ;
//   ce n'est PAS le résultat comptable de l'entreprise ;
// - enveloppes déplacements et recrutement : suivies à part, hors rentabilité (sauf règle de recrutement confirmée).
import type { Collaborator, Population } from '../org/collaborators';
import { POLE_CLIENTS, clientBudget } from '../config/itsm';

export type Month = string; // AAAA-MM

export const monthsOf = (year: number): Month[] => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
export const monthOf = (t: number): Month => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const monthLabel = (m: Month) => new Date(`${m}-15T12:00:00`).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
const round = (n: number) => Math.round(n);
const pct = (num: number, den: number) => (den ? Math.round((num / den) * 1000) / 10 : null);

// --- Budgets distincts : Helpdesk N1 et MCO N2 -------------------------------------

/**
 * Deux entités budgétaires séparées, jamais additionnées :
 * - Helpdesk N1 : pour le moment, TOUS les coûts (plateaux, techniciens N2, encadrement) et les revenus de TOUS les clients ;
 * - MCO N2 : budget distinct, VIDE pour le moment (à construire après le Helpdesk N1).
 * Le rattachement des revenus d'un client se règle dans Administration → Clients (CRM).
 */
export type Entity = 'helpdesk' | 'mco';
export const ENTITIES: Entity[] = ['helpdesk', 'mco'];
export const ENTITY_LABEL: Record<Entity, string> = { helpdesk: 'Helpdesk N1', mco: 'MCO N2' };

/**
 * Budget MCO N2 vide pour le moment : tous les coûts (y compris techniciens N2 et manager MCO)
 * sont portés par le Helpdesk N1. Passer à `true` pour affecter les coûts N2 au budget MCO.
 */
export const MCO_BUDGET_ACTIVE = false;

export const entityOfCost = (e: Pick<CostEntry, 'population' | 'personId'>): Entity =>
  MCO_BUDGET_ACTIVE && (e.population === 'Technicien N2' || e.personId === 'mgr-mco') ? 'mco' : 'helpdesk';
/** Les revenus suivent le budget de rattachement du client (pour le moment : tous au Helpdesk N1). */
export const entityOfPrestation = (p: Pick<Prestation, 'clientId'>): Entity => clientBudget(p.clientId);

export interface EntityData {
  costs: CostEntry[];
  adjustments: CostAdjustment[];
  prestations: Prestation[];
}

/** Données d'une seule entité budgétaire. */
export function forEntity(d: EntityData, entity: Entity): EntityData {
  return {
    costs: d.costs.filter((c) => entityOfCost(c) === entity),
    adjustments: d.adjustments.filter((a) => a.entity === entity),
    prestations: d.prestations.filter((p) => entityOfPrestation(p) === entity),
  };
}

// --- Coûts --------------------------------------------------------------------------

export interface CostEntry {
  personId: string;
  name: string;
  population: Population;
  teamLabel: string;
  etp: number;
  /** Coût employeur mensuel chargé (fictif), déjà au prorata de l'ETP. */
  monthlyCost: number;
  /** Part affectée au Helpdesk (affectation partielle). */
  allocation: number;
  entryDate?: string;
  exitDate?: string;
  note?: string;
  /** Clients servis (ventilation du coût à parts égales) ; vide = coût non ventilé (management). */
  clientIds: string[];
}

export type AdjustmentKind = 'Prime' | 'Heures supplémentaires' | 'Remplacement' | 'Autre';

export interface CostAdjustment {
  /** Budget concerné : Helpdesk N1 ou MCO N2 (budgets distincts). */
  entity: Entity;
  id: string;
  month: Month;
  kind: AdjustmentKind;
  label: string;
  amount: number;
  personId?: string;
}

/** Part du mois couverte par la présence (entrée / sortie). */
export function presenceRatio(e: Pick<CostEntry, 'entryDate' | 'exitDate'>, month: Month): number {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1).getTime();
  const days = new Date(y, m, 0).getDate();
  const last = new Date(y, m - 1, days).getTime();
  const parse = (d: string) => {
    const [a, b, c] = d.split('-').map(Number);
    return new Date(a, b - 1, c).getTime();
  };
  const start = e.entryDate ? Math.max(first, parse(e.entryDate)) : first;
  const end = e.exitDate ? Math.min(last, parse(e.exitDate)) : last;
  if (end < start) return 0;
  return Math.round(((end - start) / 86_400_000 + 1) / days * 1000) / 1000;
}

export const entryCost = (e: CostEntry, month: Month) => e.monthlyCost * e.allocation * presenceRatio(e, month);

/** Registre des coûts : collaborateurs rattachés au département Helpdesk. */
export function buildCostEntries(collaborators: Collaborator[]): CostEntry[] {
  return collaborators
    .filter((c) => c.helpdesk)
    .map((c) => ({ personId: c.id, name: c.name, population: c.population, teamLabel: c.teamLabel, etp: c.etp, monthlyCost: c.monthlyCost, allocation: 1, entryDate: c.entryDate, exitDate: c.exitDate, clientIds: c.clientId ? [c.clientId] : c.teamId.startsWith('pole-') ? (POLE_CLIENTS[c.teamId.slice(5)] ?? []) : [] }));
}

export type CostCategory = 'Agents N1' | 'Techniciens N2' | 'Management' | 'Primes' | 'Heures supplémentaires' | 'Remplacements' | 'Autres' | 'Recrutement (imputé)';

const POP_CAT: Partial<Record<Population, CostCategory>> = { 'Agent N1': 'Agents N1', 'Technicien N2': 'Techniciens N2', Encadrement: 'Management' };
const ADJ_CAT: Record<AdjustmentKind, CostCategory> = { Prime: 'Primes', 'Heures supplémentaires': 'Heures supplémentaires', Remplacement: 'Remplacements', Autre: 'Autres' };

export function monthCosts(costs: CostEntry[], adjustments: CostAdjustment[], month: Month, recruitmentImputed = 0): Record<CostCategory, number> {
  const out: Record<CostCategory, number> = { 'Agents N1': 0, 'Techniciens N2': 0, Management: 0, Primes: 0, 'Heures supplémentaires': 0, Remplacements: 0, Autres: 0, 'Recrutement (imputé)': recruitmentImputed };
  for (const e of costs) out[POP_CAT[e.population] ?? 'Autres'] += entryCost(e, month);
  for (const a of adjustments) if (a.month === month) out[ADJ_CAT[a.kind]] += a.amount;
  for (const k of Object.keys(out) as CostCategory[]) out[k] = round(out[k]);
  return out;
}

// --- Revenus ------------------------------------------------------------------------

export type PrestationType = 'Forfait' | 'ETP' | 'Horaire' | 'Acte' | 'Supplémentaire';
export type PrestationStatus = 'Validée' | 'À valider' | 'Prévisionnelle' | 'Refusée';

export interface Prestation {
  id: string;
  clientId: string;
  clientName: string;
  contractId: string;
  type: PrestationType;
  month: Month;
  quantity: number;
  unitPrice: number;
  status: PrestationStatus;
  label: string;
}

export const prestationAmount = (p: Prestation) => round(p.quantity * p.unitPrice);

export interface RevenueSplit {
  validated: number;
  pending: number;
  forecast: number;
  refused: number;
}

export function monthRevenue(prestations: Prestation[], month: Month): RevenueSplit {
  const sum = (s: PrestationStatus) => prestations.filter((p) => p.month === month && p.status === s).reduce((n, p) => n + prestationAmount(p), 0);
  return { validated: sum('Validée'), pending: sum('À valider'), forecast: sum('Prévisionnelle'), refused: sum('Refusée') };
}

// --- Rentabilité --------------------------------------------------------------------

export interface MonthResult {
  month: Month;
  /** Mois clos (antérieur au mois en cours). */
  closed: boolean;
  current: boolean;
  revenue: RevenueSplit;
  costs: Record<CostCategory, number>;
  cost: number;
  /** Résultat analytique sur revenus validés. */
  result: number;
  margin: number | null;
  /** Projection : validé + à valider + prévisionnel. */
  projectedRevenue: number;
  projectedResult: number;
  projectedMargin: number | null;
}

export function monthResult(month: Month, currentMonth: Month, costs: CostEntry[], adjustments: CostAdjustment[], prestations: Prestation[], recruitmentImputed = 0): MonthResult {
  const revenue = monthRevenue(prestations, month);
  const c = monthCosts(costs, adjustments, month, recruitmentImputed);
  const cost = Object.values(c).reduce((a, b) => a + b, 0);
  const projectedRevenue = revenue.validated + revenue.pending + revenue.forecast;
  return {
    month,
    closed: month < currentMonth,
    current: month === currentMonth,
    revenue,
    costs: c,
    cost,
    result: revenue.validated - cost,
    margin: pct(revenue.validated - cost, revenue.validated),
    projectedRevenue,
    projectedResult: projectedRevenue - cost,
    projectedMargin: pct(projectedRevenue - cost, projectedRevenue),
  };
}

export interface Totals {
  revenue: number;
  cost: number;
  result: number;
  margin: number | null;
}

const totalOf = (rows: MonthResult[], projected: boolean): Totals => {
  const revenue = rows.reduce((n, r) => n + (projected ? r.projectedRevenue : r.revenue.validated), 0);
  const cost = rows.reduce((n, r) => n + r.cost, 0);
  return { revenue, cost, result: revenue - cost, margin: pct(revenue - cost, revenue) };
};

/** Cumul des mois clos (même périmètre de mois pour revenus et coûts). */
export const closedTotals = (rows: MonthResult[]) => totalOf(rows.filter((r) => r.closed), false);
/** Atterrissage de l'année : réalisé + à valider + prévisionnel, coûts de l'année. */
export const landingTotals = (rows: MonthResult[]) => totalOf(rows, true);

export interface ClientProfit {
  clientId: string;
  clientName: string;
  revenue: number;
  directCost: number;
  contribution: number;
  rate: number | null;
}

/**
 * Contribution par client sur un ensemble de mois : revenus validés − coûts directs des personnes affectées.
 * Management et ajustements restent « non ventilés » : la somme des contributions moins ces coûts
 * redonne exactement le résultat analytique du département.
 */
export function clientBreakdown(costs: CostEntry[], prestations: Prestation[], months: Month[]): { rows: ClientProfit[]; unallocated: number } {
  const map = new Map<string, ClientProfit>();
  const row = (id: string, name: string) => map.get(id) ?? map.set(id, { clientId: id, clientName: name, revenue: 0, directCost: 0, contribution: 0, rate: null }).get(id)!;
  let unallocated = 0;
  for (const p of prestations) if (p.status === 'Validée' && months.includes(p.month)) row(p.clientId, p.clientName).revenue += prestationAmount(p);
  for (const e of costs)
    for (const m of months) {
      const c = entryCost(e, m);
      if (!e.clientIds.length) unallocated += c;
      else for (const id of e.clientIds) row(id, prestations.find((p) => p.clientId === id)?.clientName ?? id.toUpperCase()).directCost += c / e.clientIds.length;
    }
  const rows = [...map.values()].map((r) => ({ ...r, revenue: round(r.revenue), directCost: round(r.directCost), contribution: round(r.revenue - r.directCost), rate: pct(r.revenue - r.directCost, r.revenue) }));
  return { rows: rows.sort((a, b) => b.revenue - a.revenue), unallocated: round(unallocated) };
}

// --- Enveloppe déplacements ---------------------------------------------------------

export interface TravelExpense {
  id: string;
  date: string;
  label: string;
  amount: number;
  commitmentId?: string;
}

export type CommitmentStatus = 'Engagé' | 'Converti' | 'Annulé';

export interface TravelCommitment {
  id: string;
  date: string;
  label: string;
  amount: number;
  status: CommitmentStatus;
  tripId?: string;
}

export interface BudgetDecision {
  at: number;
  by: string;
  label: string;
  amount: number;
  decision: 'Acceptée' | 'Bloquée';
  reason: string;
}

export interface CeilingChange {
  at: number;
  by: string;
  from: number;
  to: number;
  reason: string;
}

export interface TravelBudget {
  year: number;
  ceiling: number;
  expenses: TravelExpense[];
  commitments: TravelCommitment[];
  decisions: BudgetDecision[];
  ceilingHistory: CeilingChange[];
}

export interface TravelBalance {
  ceiling: number;
  spent: number;
  committed: number;
  /** SOLDE = enveloppe − dépenses réalisées − engagements non réalisés. */
  balance: number;
  consumedRate: number;
}

export function travelBalance(b: TravelBudget): TravelBalance {
  const spent = b.expenses.reduce((n, e) => n + e.amount, 0);
  // Un engagement converti en dépense n'est plus compté : pas de double comptage.
  const committed = b.commitments.filter((c) => c.status === 'Engagé').reduce((n, c) => n + c.amount, 0);
  return { ceiling: b.ceiling, spent, committed, balance: b.ceiling - spent - committed, consumedRate: pct(spent + committed, b.ceiling) ?? 0 };
}

export interface BudgetOutcome<T> {
  ok: boolean;
  message: string;
  budget: T;
}

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;

function decide(b: TravelBudget, label: string, amount: number, by: string, at: number): { ok: boolean; reason: string; budget: TravelBudget } {
  const { balance } = travelBalance(b);
  if (!(amount > 0)) return { ok: false, reason: 'Montant invalide.', budget: b };
  const ok = amount <= balance;
  const reason = ok ? `Solde suffisant (${eur(balance)} avant, ${eur(balance - amount)} après).` : `Plafond de l’enveloppe atteint : montant ${eur(amount)} supérieur au solde disponible ${eur(balance)}.`;
  return { ok, reason, budget: { ...b, decisions: [{ at, by, label, amount, decision: ok ? 'Acceptée' : 'Bloquée', reason }, ...b.decisions] } };
}

/** Demande de déplacement : crée un engagement si le solde le permet ; sinon blocage motivé et journalisé. */
export function requestTravel(b: TravelBudget, req: { label: string; amount: number; date: string; tripId?: string }, by: string, at: number): BudgetOutcome<TravelBudget> {
  const d = decide(b, req.label, req.amount, by, at);
  if (!d.ok) return { ok: false, message: d.reason, budget: d.budget };
  const id = `ENG-${String(b.commitments.length + 1).padStart(3, '0')}`;
  return { ok: true, message: `Engagement ${id} enregistré. ${d.reason}`, budget: { ...d.budget, commitments: [...d.budget.commitments, { id, date: req.date, label: req.label, amount: req.amount, status: 'Engagé', tripId: req.tripId }] } };
}

/** Dépense directe (sans engagement préalable). */
export function addTravelExpense(b: TravelBudget, e: { label: string; amount: number; date: string }, by: string, at: number): BudgetOutcome<TravelBudget> {
  const d = decide(b, e.label, e.amount, by, at);
  if (!d.ok) return { ok: false, message: d.reason, budget: d.budget };
  const id = `DEP-${String(b.expenses.length + 1).padStart(3, '0')}`;
  return { ok: true, message: `Dépense ${id} enregistrée. ${d.reason}`, budget: { ...d.budget, expenses: [...d.budget.expenses, { id, ...e }] } };
}

/** Conversion d'un engagement en dépense réalisée (montant réel). Le surcoût éventuel doit tenir dans le solde. */
export function convertCommitment(b: TravelBudget, commitmentId: string, actual: number, date: string, by: string, at: number): BudgetOutcome<TravelBudget> {
  const c = b.commitments.find((x) => x.id === commitmentId);
  if (!c || c.status !== 'Engagé') return { ok: false, message: 'Engagement introuvable ou déjà traité.', budget: b };
  const extra = actual - c.amount;
  const { balance } = travelBalance(b);
  if (!(actual > 0)) return { ok: false, message: 'Montant invalide.', budget: b };
  if (extra > balance) {
    const reason = `Plafond de l’enveloppe atteint : surcoût ${eur(extra)} supérieur au solde ${eur(balance)}.`;
    return { ok: false, message: reason, budget: { ...b, decisions: [{ at, by, label: `Conversion ${c.id}`, amount: actual, decision: 'Bloquée', reason }, ...b.decisions] } };
  }
  const id = `DEP-${String(b.expenses.length + 1).padStart(3, '0')}`;
  return {
    ok: true,
    message: `${c.id} converti en dépense ${id} (${eur(actual)}).`,
    budget: {
      ...b,
      commitments: b.commitments.map((x) => (x.id === commitmentId ? { ...x, status: 'Converti' } : x)),
      expenses: [...b.expenses, { id, date, label: c.label, amount: actual, commitmentId }],
      decisions: [{ at, by, label: `Conversion ${c.id}`, amount: actual, decision: 'Acceptée', reason: 'Engagement converti en dépense réalisée.' }, ...b.decisions],
    },
  };
}

export function cancelCommitment(b: TravelBudget, commitmentId: string): TravelBudget {
  return { ...b, commitments: b.commitments.map((x) => (x.id === commitmentId && x.status === 'Engagé' ? { ...x, status: 'Annulé' } : x)) };
}

/** Modification du plafond : réservée à une personne habilitée par la direction ; historisée. */
export function changeCeiling(b: TravelBudget, to: number, reason: string, authorized: boolean, by: string, at: number): BudgetOutcome<TravelBudget> {
  if (!authorized) return { ok: false, message: 'Modification du plafond réservée à une personne habilitée par la direction.', budget: b };
  if (!reason.trim()) return { ok: false, message: 'Un motif est obligatoire.', budget: b };
  const { spent, committed } = travelBalance(b);
  if (!(to >= 0) || to < spent + committed) return { ok: false, message: `Le plafond ne peut pas être inférieur aux montants déjà consommés et engagés (${eur(spent + committed)}).`, budget: b };
  return { ok: true, message: `Plafond porté de ${eur(b.ceiling)} à ${eur(to)}.`, budget: { ...b, ceiling: to, ceilingHistory: [{ at, by, from: b.ceiling, to, reason: reason.trim() }, ...b.ceilingHistory] } };
}

// --- Budget recrutement -------------------------------------------------------------

export type ImputationRule = 'À confirmer' | 'Imputé au résultat Helpdesk' | 'Hors résultat Helpdesk (coût de structure)';
export const RULE_TO_CONFIRM = 'RÈGLE D’IMPUTATION À CONFIRMER';

export type RecruitmentKind = 'Cabinet' | 'Annonce' | 'Salon / école' | 'Intégration / formation' | 'Autre';

export interface RecruitmentLine {
  id: string;
  date: string;
  label: string;
  kind: RecruitmentKind;
  amount: number;
  status: 'Réalisée' | 'Engagée';
}

export interface RecruitmentBudget {
  year: number;
  envelope: number;
  rule: ImputationRule;
  lines: RecruitmentLine[];
  ruleHistory: { at: number; by: string; from: ImputationRule; to: ImputationRule }[];
}

export function recruitmentBalance(b: RecruitmentBudget) {
  const spent = b.lines.filter((l) => l.status === 'Réalisée').reduce((n, l) => n + l.amount, 0);
  const committed = b.lines.filter((l) => l.status === 'Engagée').reduce((n, l) => n + l.amount, 0);
  return { envelope: b.envelope, spent, committed, balance: b.envelope - spent - committed, consumedRate: pct(spent + committed, b.envelope) ?? 0 };
}

/**
 * Montant de recrutement imputé au résultat Helpdesk pour un mois.
 * Seuls les frais de recrutement sont concernés : les salaires des recrues entrent dans le registre
 * des coûts à leur date d'entrée, une seule fois (pas de double comptage).
 */
export function recruitmentImputed(b: RecruitmentBudget, month: Month): number {
  if (b.rule !== 'Imputé au résultat Helpdesk') return 0;
  return b.lines.filter((l) => l.status === 'Réalisée' && l.date.startsWith(month)).reduce((n, l) => n + l.amount, 0);
}

const SALARY_WORDS = /salaire|rémunération|paie/i;

export function addRecruitment(b: RecruitmentBudget, line: Omit<RecruitmentLine, 'id'>): BudgetOutcome<RecruitmentBudget> {
  if (!(line.amount > 0)) return { ok: false, message: 'Montant invalide.', budget: b };
  if (SALARY_WORDS.test(line.label)) return { ok: false, message: 'Les salaires des recrues relèvent du registre des coûts (date d’entrée) : ils ne sont pas saisis dans le budget recrutement.', budget: b };
  const id = `REC-${String(b.lines.length + 1).padStart(3, '0')}`;
  const next = { ...b, lines: [...b.lines, { id, ...line }] };
  const { balance } = recruitmentBalance(next);
  return { ok: true, message: `Ligne ${id} enregistrée.${balance < 0 ? ` Attention : enveloppe dépassée de ${eur(-balance)}.` : ''}`, budget: next };
}
