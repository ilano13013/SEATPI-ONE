// État du module Budget & Rentabilité (démonstration) : registres des coûts et des
// prestations, enveloppes déplacements et recrutement, journal des modifications.
// Toutes les valeurs sont FICTIVES et clairement identifiées comme telles.
import { useCallback, useRef, useState } from 'react';
import type { Agent } from '../types';
import type { Collaborator } from '../org/collaborators';
import type { Trip } from '../external/trips';
import { contracts } from '../external/config';
import { POLE_CLIENTS, clientRecord, n1Clients } from '../config/itsm';
import { helpdeskPoles } from '../data/layout';
import { can, roleLabels, type Role } from '../auth/roles';
import {
  addRecruitment,
  addTravelExpense,
  buildCostEntries,
  cancelCommitment,
  changeCeiling,
  convertCommitment,
  monthOf,
  monthsOf,
  requestTravel,
  type AdjustmentKind,
  type CostAdjustment,
  type CostEntry,
  type ImputationRule,
  type Prestation,
  type PrestationStatus,
  type PrestationType,
  type RecruitmentBudget,
  type RecruitmentLine,
  type TravelBudget,
  type TravelCommitment,
  type Entity,
} from './budget';

export interface FinanceLogEntry {
  at: number;
  by: string;
  action: string;
  detail: string;
}

export interface FinanceState {
  year: number;
  currentMonth: string;
  costs: CostEntry[];
  adjustments: CostAdjustment[];
  prestations: Prestation[];
  travel: TravelBudget;
  recruitment: RecruitmentBudget;
  log: FinanceLogEntry[];
}

export interface FinanceResult {
  ok: boolean;
  message: string;
}

/** Coût fictif d'un déplacement CSM selon le moyen de transport. */
export const TRIP_COST: Record<string, number> = { Train: 240, 'Véhicule de service SEATPI': 95, 'Transport en commun': 35 };
export const tripCost = (t: Trip) => TRIP_COST[t.transport] ?? 120;

/** Prix fictif de référence d'un ETP N1 facturé (démonstration). */
const N1_REFERENCE = 3300;

/** Mode de facturation de démonstration des clients internes (à remplacer par les contrats réels). */
const INTERNAL_BILLING: Record<string, PrestationType> = { thelem: 'ETP', ird: 'Forfait', ortec: 'Forfait', sodiaal: 'Forfait', invivo: 'Acte', dmb: 'Acte', transgourmet: 'Acte', lbrfr: 'Horaire', eurapharma: 'Forfait', ange: 'ETP', hstv: 'Acte', snr: 'Acte', nocibe: 'Horaire', teract: 'Acte', g2s: 'Forfait' };

function seedPrestations(agents: Agent[], year: number, current: string): Prestation[] {
  const list: Prestation[] = [];
  const status = (m: string): PrestationStatus => (m < current ? 'Validée' : m === current ? 'À valider' : 'Prévisionnelle');
  let n = 1;
  const push = (p: Omit<Prestation, 'id'>) => list.push({ id: `PRS-${String(n++).padStart(4, '0')}`, ...p });
  for (const m of monthsOf(year)) {
    for (const c of contracts) {
      const name = clientRecord(c.clientId)?.name ?? c.clientId;
      push({ clientId: c.clientId, clientName: name, contractId: c.id, type: 'Forfait', month: m, quantity: 1, unitPrice: c.monthlyBudget, status: status(m), label: `Forfait mensuel ${c.label}` });
    }
    // Une prestation N1 par client, même s'il est traité par plusieurs pôles (Pôle Multi La Ciotat + Montpellier).
    for (const { clientId, poleIds } of n1Clients) {
      const share = poleIds.filter((id) => helpdeskPoles.some((p) => p.clientId === id)).reduce((n, id) => n + agents.filter((a) => a.clientId === id).length / POLE_CLIENTS[id].length, 0);
      if (!share) continue;
      const value = share * N1_REFERENCE;
      const type = INTERNAL_BILLING[clientId] ?? 'Forfait';
      const [quantity, unitPrice] = type === 'ETP' ? [Math.round(share * 100) / 100, N1_REFERENCE] : type === 'Acte' ? [Math.round(value / 14), 14] : type === 'Horaire' ? [Math.round(share * 140), 26] : [1, Math.round(value)];
      push({ clientId, clientName: clientRecord(clientId)?.name ?? clientId.toUpperCase(), contractId: `CTR-INT-${clientId.toUpperCase()}`, type, month: m, quantity, unitPrice, status: status(m), label: `Prestation Helpdesk N1 (${type.toLowerCase()})` });
    }
  }
  // Prestations supplémentaires (hors forfait).
  push({ clientId: 'invivo', clientName: 'INVIVO', contractId: 'CTR-INV-01', type: 'Supplémentaire', month: `${year}-06`, quantity: 1, unitPrice: 6500, status: `${year}-06` < current ? 'Validée' : 'Prévisionnelle', label: 'Renfort déploiement postes (avenant)' });
  push({ clientId: 'monext', clientName: 'MONEXT', contractId: 'CTR-MNX-01', type: 'Supplémentaire', month: current, quantity: 8, unitPrice: 450, status: 'À valider', label: 'Astreintes week-end supplémentaires' });
  push({ clientId: 'thelem', clientName: 'THELEM', contractId: 'CTR-INT-THELEM', type: 'Supplémentaire', month: `${year}-03`, quantity: 1, unitPrice: 2800, status: 'Refusée', label: 'Heures de débordement contestées par le client' });
  return list;
}

function seedAdjustments(year: number, current: string): CostAdjustment[] {
  const list: CostAdjustment[] = [];
  let n = 1;
  const add = (entity: Entity, month: string, kind: AdjustmentKind, label: string, amount: number) => list.push({ id: `AJ-${String(n++).padStart(3, '0')}`, entity, month, kind, label, amount });
  for (const [i, m] of monthsOf(year).entries()) {
    if ((i + 1) % 3 === 0) {
      add('helpdesk', m, 'Prime', 'Primes trimestrielles sur objectifs N1 (fictif)', 2000);
      add('helpdesk', m, 'Prime', 'Primes trimestrielles sur objectifs N2 (fictif)', 1200);
    }
    const hs = m <= current ? 600 + ((i * 337) % 900) : 800;
    add('helpdesk', m, 'Heures supplémentaires', m <= current ? 'Heures supplémentaires N1 réalisées (fictif)' : 'Heures supplémentaires N1 prévues (fictif)', Math.round(hs * 0.6));
    add('helpdesk', m, 'Heures supplémentaires', m <= current ? 'Astreintes et heures supplémentaires N2 réalisées (fictif)' : 'Astreintes et heures supplémentaires N2 prévues (fictif)', Math.round(hs * 0.4));
  }
  add('helpdesk', `${year}-08`, 'Remplacement', 'Intérim — remplacement congés d’été plateau (fictif)', 3000);
  add('helpdesk', `${year}-08`, 'Remplacement', 'Renfort N2 — congés d’été chez les clients (fictif)', 1800);
  return list;
}

function seedTravel(year: number, now: number, trips: Trip[]): TravelBudget {
  const current = monthOf(now);
  const expenses = monthsOf(year)
    .filter((m) => m < current)
    .map((m, i) => ({ id: `DEP-${String(i + 1).padStart(3, '0')}`, date: `${m}-20`, label: `Déplacements CSM ${m} (réalisé, fictif)`, amount: 1050 + ((i * 211) % 500) }));
  const commitments: TravelCommitment[] = trips.map((t, i) => ({ id: `ENG-${String(i + 1).padStart(3, '0')}`, date: new Date(t.departAt).toISOString().slice(0, 10), label: `${t.purpose} — ${t.to}`, amount: tripCost(t), status: 'Engagé', tripId: t.id }));
  commitments.push({ id: `ENG-${String(commitments.length + 1).padStart(3, '0')}`, date: `${year}-11-17`, label: 'Comité de pilotage INVIVO (planifié)', amount: 260, status: 'Engagé' });
  return {
    year,
    ceiling: 14000,
    expenses,
    commitments,
    decisions: [],
    ceilingHistory: [{ at: new Date(year, 0, 6, 10).getTime(), by: 'Direction générale (démonstration)', from: 0, to: 14000, reason: 'Enveloppe annuelle déplacements du département Helpdesk' }],
  };
}

function seedRecruitment(year: number): RecruitmentBudget {
  const lines: RecruitmentLine[] = [
    { id: 'REC-001', date: `${year}-02-10`, label: 'Annonces emploi — agents N1', kind: 'Annonce', amount: 900, status: 'Réalisée' },
    { id: 'REC-002', date: `${year}-03-18`, label: 'Cabinet — recrutement agent N1 Montpellier', kind: 'Cabinet', amount: 6500, status: 'Réalisée' },
    { id: 'REC-003', date: `${year}-04-02`, label: 'Parcours d’intégration agent N1 Montpellier', kind: 'Intégration / formation', amount: 1800, status: 'Réalisée' },
    { id: 'REC-004', date: `${year}-05-21`, label: 'Forum école — alternants support', kind: 'Salon / école', amount: 1200, status: 'Réalisée' },
    { id: 'REC-005', date: `${year}-11-05`, label: 'Cabinet — remplacement départ agent N1 La Ciotat', kind: 'Cabinet', amount: 5000, status: 'Engagée' },
  ];
  return { year, envelope: 22000, rule: 'À confirmer', lines, ruleHistory: [] };
}

/** Mouvements de démonstration : une entrée (avril), une sortie prévue (novembre), une affectation partielle. */
export function applyDemoMovements(costs: CostEntry[], year: number): CostEntry[] {
  return costs.map((c) =>
    c.personId === 'ag-26'
      ? { ...c, entryDate: `${year}-04-01`, note: 'Entrée en cours d’année (avril)' }
      : c.personId === 'ag-11'
        ? { ...c, exitDate: `${year}-11-30`, note: 'Sortie prévue fin novembre' }
        : c.personId === 'ag-25'
          ? { ...c, allocation: 0.5, note: 'Affectation partielle : 50 % Formation' }
          : c,
  );
}

export function initialFinance(collaborators: Collaborator[], agents: Agent[], trips: Trip[], now: number): FinanceState {
  const year = new Date(now).getFullYear();
  const currentMonth = monthOf(now);
  return {
    year,
    currentMonth,
    costs: applyDemoMovements(buildCostEntries(collaborators), year),
    adjustments: seedAdjustments(year, currentMonth),
    prestations: seedPrestations(agents, year, currentMonth),
    travel: seedTravel(year, now, trips),
    recruitment: seedRecruitment(year),
    log: [],
  };
}

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;

export function useFinance(collaborators: Collaborator[], agents: Agent[], trips: Trip[]) {
  const init = useRef<FinanceState>();
  if (!init.current) init.current = initialFinance(collaborators, agents, trips, Date.now());
  const [state, setState] = useState(init.current);
  const ref = useRef(state);
  ref.current = state;
  const apply = (next: FinanceState) => {
    ref.current = next;
    setState(next);
  };
  const who = (role: Role) => `${roleLabels[role]} (démonstration)`;
  const logged = (s: FinanceState, role: Role, action: string, detail: string): FinanceState => ({ ...s, log: [{ at: Date.now(), by: who(role), action, detail }, ...s.log].slice(0, 300) });
  const denied: FinanceResult = { ok: false, message: 'Votre rôle ne permet pas de modifier les données financières (maquette).' };

  const setCost = useCallback((personId: string, patch: Partial<Pick<CostEntry, 'monthlyCost' | 'allocation'>>, role: Role): FinanceResult => {
    if (!can(role, 'finance', 'edit')) return denied;
    const s = ref.current;
    const e = s.costs.find((c) => c.personId === personId);
    if (!e) return { ok: false, message: 'Collaborateur introuvable.' };
    if (patch.allocation !== undefined && (patch.allocation < 0 || patch.allocation > 1)) return { ok: false, message: 'Affectation entre 0 et 100 %.' };
    if (patch.monthlyCost !== undefined && patch.monthlyCost < 0) return { ok: false, message: 'Coût invalide.' };
    const detail = patch.monthlyCost !== undefined ? `${e.name} : coût employeur ${eur(e.monthlyCost)} → ${eur(patch.monthlyCost)}` : `${e.name} : affectation ${Math.round(e.allocation * 100)} % → ${Math.round((patch.allocation ?? 0) * 100)} %`;
    apply(logged({ ...s, costs: s.costs.map((c) => (c.personId === personId ? { ...c, ...patch } : c)) }, role, 'Coût agent modifié', detail));
    return { ok: true, message: detail };
  }, []);

  const addAdjustment = useCallback((adj: Omit<CostAdjustment, 'id'>, role: Role): FinanceResult => {
    if (!can(role, 'finance', 'edit')) return denied;
    if (!(adj.amount > 0) || !adj.label.trim()) return { ok: false, message: 'Libellé et montant positif obligatoires.' };
    const s = ref.current;
    const id = `AJ-${String(s.adjustments.length + 1).padStart(3, '0')}`;
    apply(logged({ ...s, adjustments: [...s.adjustments, { ...adj, id }] }, role, 'Ajustement de coût', `${adj.kind} ${adj.month} : ${adj.label} (${eur(adj.amount)})`));
    return { ok: true, message: `${adj.kind} ajouté(e) : ${eur(adj.amount)}.` };
  }, []);

  const updatePrestation = useCallback((id: string, patch: Partial<Pick<Prestation, 'quantity' | 'unitPrice' | 'status'>>, role: Role): FinanceResult => {
    if (!can(role, 'finance', 'edit')) return denied;
    const s = ref.current;
    const p = s.prestations.find((x) => x.id === id);
    if (!p) return { ok: false, message: 'Prestation introuvable.' };
    if ((patch.quantity ?? 0) < 0 || (patch.unitPrice ?? 0) < 0) return { ok: false, message: 'Valeurs négatives interdites.' };
    if (patch.status === 'Validée' && p.month > s.currentMonth) return { ok: false, message: 'Une prestation future ne peut pas être validée.' };
    const detail = patch.status ? `${p.id} ${p.clientName} ${p.month} : ${p.status} → ${patch.status}` : `${p.id} ${p.clientName} ${p.month} : montant modifié`;
    apply(logged({ ...s, prestations: s.prestations.map((x) => (x.id === id ? { ...x, ...patch } : x)) }, role, patch.status ? 'Validation de prestation' : 'Prestation modifiée', detail));
    return { ok: true, message: detail };
  }, []);

  const updateAdjustment = useCallback((id: string, amount: number, role: Role): FinanceResult => {
    if (!can(role, 'finance', 'edit')) return denied;
    if (!(amount >= 0)) return { ok: false, message: 'Montant invalide.' };
    const s = ref.current;
    const a = s.adjustments.find((x) => x.id === id);
    if (!a) return { ok: false, message: 'Ajustement introuvable.' };
    apply(logged({ ...s, adjustments: s.adjustments.map((x) => (x.id === id ? { ...x, amount } : x)) }, role, 'Ajustement de coût modifié', `${a.kind} ${a.month} : ${eur(a.amount)} → ${eur(amount)}`));
    return { ok: true, message: 'Ajustement mis à jour.' };
  }, []);

  const setRecruitmentEnvelope = useCallback((amount: number, role: Role): FinanceResult => {
    if (!can(role, 'finance', 'edit')) return denied;
    if (!(amount >= 0)) return { ok: false, message: 'Montant invalide.' };
    const s = ref.current;
    apply(logged({ ...s, recruitment: { ...s.recruitment, envelope: amount } }, role, 'Enveloppe recrutement', `${eur(s.recruitment.envelope)} → ${eur(amount)}`));
    return { ok: true, message: 'Enveloppe recrutement mise à jour.' };
  }, []);

  /** Paramètre contractuel : forfait mensuel d'un contrat, appliqué aux prestations à venir (non validées). */
  const setContractForfait = useCallback((contractId: string, amount: number, role: Role): FinanceResult => {
    // Valeur budgétaire du référentiel clients : modifiable par les profils habilités au CRM.
    if (!can(role, 'finance', 'edit') && !can(role, 'clients', 'edit')) return denied;
    if (!(amount >= 0)) return { ok: false, message: 'Montant invalide.' };
    const s = ref.current;
    const touched = s.prestations.filter((p) => p.contractId === contractId && p.type === 'Forfait' && (p.status === 'Prévisionnelle' || p.status === 'À valider'));
    if (!touched.length) return { ok: false, message: 'Aucune prestation à venir pour ce contrat.' };
    apply(logged({ ...s, prestations: s.prestations.map((p) => (touched.includes(p) ? { ...p, unitPrice: amount } : p)) }, role, 'Forfait contractuel modifié', `${contractId} : ${eur(amount)} / mois sur ${touched.length} mois à venir`));
    return { ok: true, message: `Forfait appliqué à ${touched.length} mois à venir.` };
  }, []);

  const addPrestation = useCallback((p: Omit<Prestation, 'id' | 'status'>, role: Role): FinanceResult => {
    if (!can(role, 'finance', 'edit')) return denied;
    if (!(p.quantity > 0 && p.unitPrice > 0)) return { ok: false, message: 'Quantité et prix unitaire positifs obligatoires.' };
    const s = ref.current;
    const id = `PRS-${String(s.prestations.length + 1).padStart(4, '0')}`;
    const status: PrestationStatus = p.month > s.currentMonth ? 'Prévisionnelle' : 'À valider';
    apply(logged({ ...s, prestations: [...s.prestations, { ...p, id, status }] }, role, 'Prestation ajoutée', `${id} ${p.clientName} ${p.month} (${p.type})`));
    return { ok: true, message: `Prestation ${id} ajoutée (${status}).` };
  }, []);

  const travelAction = (role: Role, action: string, fn: (b: TravelBudget, by: string) => { ok: boolean; message: string; budget: TravelBudget }): FinanceResult => {
    const s = ref.current;
    const r = fn(s.travel, who(role));
    apply(logged({ ...s, travel: r.budget }, role, action, r.message));
    return { ok: r.ok, message: r.message };
  };

  const submitTrip = useCallback((label: string, amount: number, date: string, role: Role, tripId?: string): FinanceResult => {
    if (!can(role, 'finance', 'view') && !can(role, 'csm', 'view')) return denied;
    return travelAction(role, 'Demande de déplacement', (b, by) => requestTravel(b, { label, amount, date, tripId }, by, Date.now()));
  }, []);

  const addExpense = useCallback((label: string, amount: number, date: string, role: Role): FinanceResult => {
    if (!can(role, 'finance', 'edit')) return denied;
    return travelAction(role, 'Dépense de déplacement', (b, by) => addTravelExpense(b, { label, amount, date }, by, Date.now()));
  }, []);

  const convert = useCallback((id: string, actual: number, role: Role): FinanceResult => {
    if (!can(role, 'finance', 'edit')) return denied;
    return travelAction(role, 'Conversion d’engagement', (b, by) => convertCommitment(b, id, actual, new Date().toISOString().slice(0, 10), by, Date.now()));
  }, []);

  const cancel = useCallback((id: string, role: Role): FinanceResult => {
    if (!can(role, 'finance', 'edit')) return denied;
    return travelAction(role, 'Annulation d’engagement', (b) => ({ ok: true, message: `Engagement ${id} annulé.`, budget: cancelCommitment(b, id) }));
  }, []);

  const setCeiling = useCallback((to: number, reason: string, role: Role): FinanceResult => {
    // Procédure distincte de révision budgétaire : permission spécifique, justification, historique.
    return travelAction(role, 'Modification du plafond', (b, by) => changeCeiling(b, to, reason, can(role, 'budget-revision', 'edit'), by, Date.now()));
  }, []);

  /** Déplacements CSM nouvellement planifiés : demandés automatiquement sur l'enveloppe (blocage possible). */
  const syncTrips = useCallback((list: Trip[]) => {
    let s = ref.current;
    const known = new Set(s.travel.commitments.map((c) => c.tripId).concat(s.travel.decisions.map((d) => d.label)));
    let changed = false;
    for (const t of list) {
      if (known.has(t.id) || known.has(`${t.purpose} — ${t.to} [${t.id}]`)) continue;
      const r = requestTravel(s.travel, { label: `${t.purpose} — ${t.to}`, amount: tripCost(t), date: new Date(t.departAt).toISOString().slice(0, 10), tripId: t.id }, 'Planification CSM (simulation)', Date.now());
      // En cas de blocage, la décision garde la trace du déplacement concerné.
      const budget = r.ok ? r.budget : { ...r.budget, decisions: r.budget.decisions.map((d, i) => (i === 0 ? { ...d, label: `${t.purpose} — ${t.to} [${t.id}]` } : d)) };
      s = { ...s, travel: budget, log: [{ at: Date.now(), by: 'Planification CSM (simulation)', action: 'Demande de déplacement', detail: r.message }, ...s.log] };
      changed = true;
    }
    if (changed) apply(s);
  }, []);

  const addRecruitmentLine = useCallback((line: Omit<RecruitmentLine, 'id'>, role: Role): FinanceResult => {
    if (!can(role, 'finance', 'edit')) return denied;
    const s = ref.current;
    const r = addRecruitment(s.recruitment, line);
    if (!r.ok) return r;
    apply(logged({ ...s, recruitment: r.budget }, role, 'Budget recrutement', r.message));
    return r;
  }, []);

  const setRule = useCallback((rule: ImputationRule, role: Role): FinanceResult => {
    if (!can(role, 'budget-revision', 'edit') && !can(role, 'finance', 'edit')) return denied;
    const s = ref.current;
    const from = s.recruitment.rule;
    apply(logged({ ...s, recruitment: { ...s.recruitment, rule, ruleHistory: [{ at: Date.now(), by: who(role), from, to: rule }, ...s.recruitment.ruleHistory] } }, role, 'Règle d’imputation recrutement', `${from} → ${rule}`));
    return { ok: true, message: `Règle d’imputation : ${rule}.` };
  }, []);

  const reset = useCallback((list: Collaborator[], ags: Agent[], tr: Trip[]) => {
    const fresh = initialFinance(list, ags, tr, Date.now());
    apply(fresh);
    return fresh;
  }, []);

  return { state, setCost, addAdjustment, updatePrestation, addPrestation, setContractForfait, updateAdjustment, setRecruitmentEnvelope, submitTrip, addExpense, convert, cancel, setCeiling, syncTrips, addRecruitmentLine, setRule, reset };
}

export type FinanceStore = ReturnType<typeof useFinance>;
