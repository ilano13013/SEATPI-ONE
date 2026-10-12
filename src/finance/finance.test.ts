import { setClientOverrides } from '../config/itsm';
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../data/demoData';
import { buildTechnicians } from '../external/config';
import { buildCollaborators } from '../org/collaborators';
import { initialFinance } from './useFinance';
import {
  addRecruitment,
  clientBreakdown,
  forEntity,
  addTravelExpense,
  changeCeiling,
  closedTotals,
  convertCommitment,
  entryCost,
  landingTotals,
  monthResult,
  monthsOf,
  presenceRatio,
  prestationAmount,
  recruitmentBalance,
  recruitmentImputed,
  requestTravel,
  travelBalance,
  type TravelBudget,
} from './budget';

const NOW = new Date(2026, 9, 12, 10).getTime();
const agents = createInitialState().agents;
const collabs = buildCollaborators(agents, buildTechnicians(NOW));
const f = initialFinance(collabs, agents, [], NOW);
const rows = monthsOf(f.year).map((m) => monthResult(m, f.currentMonth, f.costs, f.adjustments, f.prestations));

describe('rentabilité Helpdesk', () => {
  it('résultat = revenus − coûts ; marge = résultat ÷ revenus × 100', () => {
    for (const r of rows) {
      expect(r.result).toBe(r.revenue.validated - r.cost);
      if (r.revenue.validated) expect(r.margin).toBeCloseTo(Math.round(((r.revenue.validated - r.cost) / r.revenue.validated) * 1000) / 10, 5);
      else expect(r.margin).toBeNull();
    }
    const t = closedTotals(rows);
    expect(t.result).toBe(t.revenue - t.cost);
  });
  it('seules les prestations validées comptent dans le réalisé ; refusées jamais', () => {
    const sep = rows.find((r) => r.month === '2026-09')!;
    const validated = f.prestations.filter((p) => p.month === '2026-09' && p.status === 'Validée').reduce((n, p) => n + prestationAmount(p), 0);
    expect(sep.revenue.validated).toBe(validated);
    const mar = rows.find((r) => r.month === '2026-03')!;
    expect(mar.revenue.refused).toBe(2800);
    expect(mar.projectedRevenue).toBe(mar.revenue.validated);
    // Mois en cours : rien de validé, tout est « à valider ».
    const oct = rows.find((r) => r.current)!;
    expect(oct.revenue.validated).toBe(0);
    expect(oct.revenue.pending).toBeGreaterThan(0);
  });
  it('les coûts suivent ETP, affectation partielle, entrée et sortie', () => {
    const p32 = f.costs.find((c) => c.personId === 'ag-25')!;
    expect(entryCost(p32, '2026-05')).toBeCloseTo(p32.monthlyCost * 0.5, 5);
    const p26 = f.costs.find((c) => c.personId === 'ag-26')!;
    expect(entryCost(p26, '2026-03')).toBe(0);
    expect(entryCost(p26, '2026-05')).toBe(p26.monthlyCost);
    const p11 = f.costs.find((c) => c.personId === 'ag-11')!;
    expect(entryCost(p11, '2026-12')).toBe(0);
    expect(presenceRatio({ entryDate: '2026-04-16' }, '2026-04')).toBeCloseTo(0.5, 2);
    // Aucun collaborateur hors Helpdesk (Exploitation, CSM, PDG) dans le registre des coûts.
    expect(f.costs.some((c) => c.population === 'Exploitation' || c.population === 'CSM' || c.personId === 'pdg')).toBe(false);
  });
  it('les enveloppes déplacements et recrutement ne modifient pas la rentabilité', () => {
    const without = landingTotals(rows);
    const travelHeavy = initialFinance(collabs, agents, [], NOW);
    travelHeavy.travel.expenses.push({ id: 'X', date: '2026-09-01', label: 'X', amount: 5000 });
    const again = landingTotals(monthsOf(2026).map((m) => monthResult(m, travelHeavy.currentMonth, travelHeavy.costs, travelHeavy.adjustments, travelHeavy.prestations)));
    expect(again).toEqual(without);
  });
});

describe('enveloppe déplacements', () => {
  const base: TravelBudget = { year: 2026, ceiling: 1000, expenses: [{ id: 'D1', date: '2026-01-10', label: 'a', amount: 300 }], commitments: [], decisions: [], ceilingHistory: [] };
  it('SOLDE = enveloppe − dépenses − engagements non réalisés, sans double comptage', () => {
    const r = requestTravel(base, { label: 'Comité', amount: 200, date: '2026-10-20' }, 'test', NOW);
    expect(r.ok).toBe(true);
    expect(travelBalance(r.budget).balance).toBe(500);
    const c = convertCommitment(r.budget, r.budget.commitments[0].id, 180, '2026-10-21', 'test', NOW);
    expect(c.ok).toBe(true);
    const b = travelBalance(c.budget);
    expect(b.spent).toBe(480);
    expect(b.committed).toBe(0);
    expect(b.balance).toBe(520);
  });
  it('bloque tout dépassement du plafond, motive et journalise la décision', () => {
    const r = requestTravel(base, { label: 'Séminaire', amount: 800, date: '2026-10-20' }, 'test', NOW);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Plafond/);
    expect(r.budget.decisions[0]).toMatchObject({ decision: 'Bloquée', amount: 800 });
    expect(travelBalance(r.budget).balance).toBe(700);
    expect(addTravelExpense(base, { label: 'x', amount: 701, date: '2026-10-01' }, 't', NOW).ok).toBe(false);
    const eng = requestTravel(base, { label: 'y', amount: 650, date: '2026-10-01' }, 't', NOW).budget;
    expect(convertCommitment(eng, eng.commitments[0].id, 760, '2026-10-02', 't', NOW).ok).toBe(false);
  });
  it('plafond modifiable uniquement par une personne habilitée, motif obligatoire, historisé', () => {
    expect(changeCeiling(base, 2000, 'Hausse', false, 'x', NOW).ok).toBe(false);
    expect(changeCeiling(base, 2000, '', true, 'x', NOW).ok).toBe(false);
    expect(changeCeiling(base, 200, 'Baisse', true, 'x', NOW).ok).toBe(false);
    const r = changeCeiling(base, 2000, 'Nouveaux clients', true, 'Direction', NOW);
    expect(r.ok).toBe(true);
    expect(r.budget.ceilingHistory[0]).toMatchObject({ from: 1000, to: 2000, by: 'Direction' });
  });
  it('les données de démonstration respectent le plafond', () => {
    expect(travelBalance(f.travel).balance).toBeGreaterThanOrEqual(0);
  });
});

describe('budget recrutement', () => {
  it('règle à confirmer par défaut : rien n’est imputé au résultat', () => {
    expect(f.recruitment.rule).toBe('À confirmer');
    expect(recruitmentImputed(f.recruitment, '2026-03')).toBe(0);
    expect(recruitmentImputed({ ...f.recruitment, rule: 'Imputé au résultat Helpdesk' }, '2026-03')).toBe(6500);
  });
  it('refuse la saisie de salaires (pas de double comptage avec le registre des coûts)', () => {
    expect(addRecruitment(f.recruitment, { date: '2026-10-01', label: 'Salaire recrue octobre', kind: 'Autre', amount: 2900, status: 'Réalisée' }).ok).toBe(false);
    const ok = addRecruitment(f.recruitment, { date: '2026-10-01', label: 'Annonce', kind: 'Annonce', amount: 400, status: 'Réalisée' });
    expect(recruitmentBalance(ok.budget).spent).toBe(recruitmentBalance(f.recruitment).spent + 400);
  });

});

describe('contribution par client', () => {
  it('contributions − coûts non ventilés = résultat analytique des mois clos', () => {
    const closed = rows.filter((r) => r.closed);
    const { rows: clients, unallocated } = clientBreakdown(f.costs, f.prestations, closed.map((r) => r.month));
    const adjustments = closed.reduce((n, r) => n + r.costs.Primes + r.costs['Heures supplémentaires'] + r.costs.Remplacements + r.costs.Autres, 0);
    const sum = clients.reduce((n, c) => n + c.contribution, 0) - unallocated - adjustments;
    expect(Math.abs(sum - closedTotals(rows).result)).toBeLessThanOrEqual(clients.length + 2); // arrondis
  });

});

describe('budgets distincts Helpdesk N1 / MCO N2', () => {
  it('chaque coût, ajustement et prestation appartient à un seul budget ; aucune perte ni double compte', () => {
    const hd = forEntity(f, 'helpdesk');
    const mco = forEntity(f, 'mco');
    expect(hd.costs.length + mco.costs.length).toBe(f.costs.length);
    expect(hd.prestations.length + mco.prestations.length).toBe(f.prestations.length);
    expect(hd.adjustments.length + mco.adjustments.length).toBe(f.adjustments.length);
    expect(mco.costs.every((c) => c.population === 'Technicien N2' || c.personId === 'mgr-mco')).toBe(true);
    expect(hd.costs.some((c) => c.population === 'Technicien N2')).toBe(false);
    // Pour le moment, tous les clients (y compris les contrats N2) relèvent du budget Helpdesk N1.
    expect(mco.prestations).toHaveLength(0);
    expect(hd.prestations.length).toBe(f.prestations.length);
    expect(hd.prestations.some((p) => p.contractId === 'CTR-PRI-01')).toBe(true);
    expect(hd.costs.some((c) => c.personId === 'resp-helpdesk')).toBe(true);
  });

  it('le rattachement d’un client au budget MCO déplace ses revenus (modifiable sans code)', () => {
    setClientOverrides({ primagaz: { budget: 'mco' } });
    try {
      const mco = forEntity(f, 'mco');
      expect(new Set(mco.prestations.map((p) => p.clientId))).toEqual(new Set(['primagaz']));
      expect(forEntity(f, 'helpdesk').prestations.some((p) => p.clientId === 'primagaz')).toBe(false);
    } finally {
      setClientOverrides({});
    }
  });
});
