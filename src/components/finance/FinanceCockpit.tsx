// Départements → Helpdesk → Direction du département → Budget & Rentabilité.
// Valeurs FICTIVES de démonstration, modifiables avec recalcul immédiat.
import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { FinanceResult, FinanceStore } from '../../finance/useFinance';
import {
  clientBreakdown,
  closedTotals,
  landingTotals,
  monthLabel,
  monthResult,
  monthsOf,
  prestationAmount,
  recruitmentBalance,
  recruitmentImputed,
  RULE_TO_CONFIRM,
  travelBalance,
  entryCost,
  presenceRatio,
  type AdjustmentKind,
  type CostCategory,
  type ImputationRule,
  type PrestationStatus,
  type PrestationType,
  type RecruitmentKind,
} from '../../finance/budget';
import { can, type Role } from '../../auth/roles';
import { Tabs } from '../ui';
import { Toast, fmtDateTime } from '../external/common';
import { Gauge, ProfitChart } from './Charts';
import { InlineEdit } from '../InlineEdit';

export type FinanceTab = 'global' | 'rentabilite' | 'couts' | 'revenus' | 'deplacements' | 'recrutement' | 'previsions' | 'historique';

interface Props {
  store: FinanceStore;
  role: Role;
  tab: FinanceTab;
  onTab: (t: FinanceTab) => void;
  onBack: () => void;
}

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
const pctTxt = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('fr-FR')} %`);
const tone = (n: number) => (n >= 0 ? 'ok' : 'bad');
const RULES: ImputationRule[] = ['À confirmer', 'Imputé au résultat Helpdesk', 'Hors résultat Helpdesk (coût de structure)'];

export function FinanceCockpit({ store, role, tab, onTab, onBack }: Props) {
  const { state } = store;
  const [toast, setToast] = useState<FinanceResult | null>(null);
  const run = (r: FinanceResult) => (setToast(r), r);
  const editable = can(role, 'finance', 'edit');
  const months = monthsOf(state.year);
  const rows = useMemo(
    () => months.map((m) => monthResult(m, state.currentMonth, state.costs, state.adjustments, state.prestations, recruitmentImputed(state.recruitment, m))),
    [state.costs, state.adjustments, state.prestations, state.recruitment, state.currentMonth], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const closed = closedTotals(rows);
  const landing = landingTotals(rows);
  const travel = travelBalance(state.travel);
  const recruit = recruitmentBalance(state.recruitment);
  const pending = state.prestations.filter((p) => p.status === 'À valider');

  if (!can(role, 'finance')) {
    return (
      <section className="xc" aria-label="Budget et rentabilité">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Carte 3D
        </button>
        <p className="restricted">Accès réservé aux rôles Finance, Direction et Responsable Helpdesk (maquette, pas une mesure de sécurité).</p>
      </section>
    );
  }

  return (
    <section className="xc fin" aria-label="Budget et rentabilité">
      <div className="xc-head">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Carte 3D
        </button>
        <div>
          <small className="crumb">Départements › Helpdesk › Direction du département › Budget & Rentabilité</small>
          <b>Budget & Rentabilité — département Helpdesk {state.year}</b>
          <span>Valeurs FICTIVES de démonstration · {editable ? 'modifiables (recalcul immédiat)' : 'consultation'} · mois en cours : {monthLabel(state.currentMonth)}</span>
        </div>
      </div>
      <p className="fin-warning">
        Résultat analytique du département Helpdesk (revenus des prestations − coûts opérationnels). Il ne constitue pas le résultat comptable de l’entreprise. Les enveloppes déplacements et recrutement sont suivies séparément et ne
        sont pas additionnées au résultat.
      </p>

      <div className="xc-tabs">
        <Tabs
          value={tab}
          onChange={onTab}
          tabs={[
            { id: 'global', label: 'Vue globale' },
            { id: 'rentabilite', label: 'Rentabilité' },
            { id: 'couts', label: 'Coûts agents' },
            { id: 'revenus', label: `Revenus (${pending.length} à valider)` },
            { id: 'deplacements', label: 'Budget déplacements' },
            { id: 'recrutement', label: 'Budget recrutement' },
            { id: 'previsions', label: 'Prévisions' },
            { id: 'historique', label: 'Historique et validations' },
          ]}
        />
      </div>

      {tab === 'global' && (
        <>
          <h3>Résultat analytique — mois clos (janvier à {monthLabel(months[Math.max(0, months.indexOf(state.currentMonth) - 1)])})</h3>
          <div className="xc-kpis">
            <Kpi label="Revenus validés" value={eur(closed.revenue)} onClick={() => onTab('revenus')} />
            <Kpi label="Coûts opérationnels" value={eur(closed.cost)} onClick={() => onTab('couts')} />
            <Kpi label="Résultat analytique" value={eur(closed.result)} cls={tone(closed.result)} onClick={() => onTab('rentabilite')} />
            <Kpi label="Marge" value={pctTxt(closed.margin)} cls={tone(closed.result)} onClick={() => onTab('rentabilite')} />
            <Kpi label="Atterrissage annuel (résultat)" value={eur(landing.result)} hint={`marge ${pctTxt(landing.margin)}`} onClick={() => onTab('previsions')} />
            <Kpi label="Prestations à valider" value={`${pending.length} · ${eur(pending.reduce((n, p) => n + prestationAmount(p), 0))}`} cls={pending.length ? 'warn' : 'ok'} onClick={() => onTab('revenus')} />
          </div>
          <ProfitChart rows={rows} projected />
          <p className="hint">Barres bleues : revenus (clair = à valider / prévisionnels) · orange : coûts (clair = prévision) · courbe verte : résultat analytique projeté.</p>
          <div className="fin-envelopes">
            <button className="fin-envelope" onClick={() => onTab('deplacements')}>
              <b>Enveloppe déplacements {state.year}</b>
              <span>
                Solde <strong className={travel.balance > 0 ? '' : 'xc-warn'}>{eur(travel.balance)}</strong> sur {eur(travel.ceiling)}
              </span>
              <Gauge value={travel.spent + travel.committed} max={travel.ceiling} label="Consommé + engagé" />
              <small>Hors rentabilité · non rattachée aux clients · plafond infranchissable</small>
            </button>
            <button className="fin-envelope" onClick={() => onTab('recrutement')}>
              <b>Budget recrutement {state.year}</b>
              <span>
                Solde <strong>{eur(recruit.balance)}</strong> sur {eur(recruit.envelope)}
              </span>
              <Gauge value={recruit.spent + recruit.committed} max={recruit.envelope} label="Consommé + engagé" />
              <small>{state.recruitment.rule === 'À confirmer' ? RULE_TO_CONFIRM : `Imputation : ${state.recruitment.rule}`}</small>
            </button>
          </div>
        </>
      )}

      {tab === 'rentabilite' && <Profitability store={store} rows={rows} />}
      {tab === 'couts' && <Costs store={store} role={role} run={run} editable={editable} />}
      {tab === 'revenus' && <Revenues store={store} role={role} run={run} editable={editable} />}
      {tab === 'deplacements' && <Travel store={store} role={role} run={run} editable={editable} />}
      {tab === 'recrutement' && <Recruitment store={store} role={role} run={run} editable={editable} />}

      {tab === 'previsions' && (
        <>
          <div className="xc-kpis">
            <Kpi label="Revenus de l’année (projetés)" value={eur(landing.revenue)} />
            <Kpi label="Coûts de l’année (projetés)" value={eur(landing.cost)} />
            <Kpi label="Résultat projeté" value={eur(landing.result)} cls={tone(landing.result)} />
            <Kpi label="Marge projetée" value={pctTxt(landing.margin)} cls={tone(landing.result)} />
          </div>
          <p className="hint">Projection = prestations validées + à valider + prévisionnelles ; coûts = registre actuel (entrées, sorties et affectations datées incluses) + ajustements prévus. Toute modification des registres est recalculée immédiatement.</p>
          <MonthTable rows={rows.filter((r) => !r.closed)} projected />
        </>
      )}

      {tab === 'historique' && (
        <>
          <h3>Validations en attente</h3>
          {pending.length === 0 ? <p className="hint">Aucune prestation à valider.</p> : <p>{pending.length} prestation(s) à valider — onglet Revenus.</p>}
          <h3>Historique du plafond déplacements</h3>
          <ul className="xc-mini">
            {state.travel.ceilingHistory.map((h, i) => (
              <li key={i}>
                {fmtDateTime(h.at)} — {h.by} : {eur(h.from)} → {eur(h.to)} · « {h.reason} »
              </li>
            ))}
          </ul>
          <h3>Journal des modifications</h3>
          <ol className="xc-history mg-history">
            {state.log.length === 0 && <li className="hint">Aucune modification depuis le chargement de la démonstration.</li>}
            {state.log.map((l, i) => (
              <li key={i}>
                <time>{fmtDateTime(l.at)}</time> <b>{l.action}</b> — {l.detail} · {l.by}
              </li>
            ))}
          </ol>
        </>
      )}
      {toast && <Toast message={toast.message} ok={toast.ok} onDone={() => setToast(null)} />}
    </section>
  );
}

function Kpi({ label, value, hint, cls, onClick }: { label: string; value: string; hint?: string; cls?: string; onClick?: () => void }) {
  const body = (
    <>
      <small>{label}</small>
      <strong>{value}</strong>
      {hint && <em>{hint}</em>}
    </>
  );
  return onClick ? (
    <button className={`xc-kpi ${cls ?? ''}`} onClick={onClick}>
      {body}
    </button>
  ) : (
    <div className={`xc-kpi ${cls ?? ''}`}>{body}</div>
  );
}

function MonthTable({ rows, projected }: { rows: ReturnType<typeof monthResult>[]; projected?: boolean }) {
  return (
    <div className="xc-tablewrap">
      <table className="xc-table compact">
        <thead>
          <tr>
            <th>Mois</th>
            <th>Statut</th>
            <th>Revenus validés</th>
            <th>À valider</th>
            <th>Prévisionnels</th>
            <th>Coûts</th>
            <th>Résultat {projected ? 'projeté' : '(validé)'}</th>
            <th>Marge</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month}>
              <td>{monthLabel(r.month)}</td>
              <td>{r.closed ? 'Clos' : r.current ? 'En cours' : 'Prévision'}</td>
              <td>{eur(r.revenue.validated)}</td>
              <td>{r.revenue.pending ? eur(r.revenue.pending) : '—'}</td>
              <td>{r.revenue.forecast ? eur(r.revenue.forecast) : '—'}</td>
              <td>{eur(r.cost)}</td>
              <td className={(projected ? r.projectedResult : r.result) < 0 ? 'xc-warn' : ''}>{eur(projected ? r.projectedResult : r.result)}</td>
              <td>{pctTxt(projected ? r.projectedMargin : r.margin)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Profitability({ store, rows }: { store: FinanceStore; rows: ReturnType<typeof monthResult>[] }) {
  const { state } = store;
  const closedMonths = rows.filter((r) => r.closed).map((r) => r.month);
  const { rows: clients, unallocated } = clientBreakdown(state.costs, state.prestations, closedMonths);
  const adjustments = rows.filter((r) => r.closed).reduce((n, r) => n + r.costs.Primes + r.costs['Heures supplémentaires'] + r.costs.Remplacements + r.costs.Autres + r.costs['Recrutement (imputé)'], 0);
  const totals = closedTotals(rows);
  return (
    <>
      <ProfitChart rows={rows} projected={false} />
      <MonthTable rows={rows} />
      <h3>Contribution par client — mois clos</h3>
      <div className="xc-tablewrap">
        <table className="xc-table compact">
          <thead>
            <tr>
              <th>Client</th>
              <th>Revenus validés</th>
              <th>Coûts directs (personnes affectées)</th>
              <th>Contribution</th>
              <th>Taux</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.clientId}>
                <td>{c.clientName}</td>
                <td>{eur(c.revenue)}</td>
                <td>{eur(c.directCost)}</td>
                <td className={c.contribution < 0 ? 'xc-warn' : ''}>{eur(c.contribution)}</td>
                <td>{pctTxt(c.rate)}</td>
              </tr>
            ))}
            <tr>
              <td>Management (non ventilé)</td>
              <td>—</td>
              <td>{eur(unallocated)}</td>
              <td>{eur(-unallocated)}</td>
              <td>—</td>
            </tr>
            <tr>
              <td>Primes, HS, remplacements (non ventilés)</td>
              <td>—</td>
              <td>{eur(adjustments)}</td>
              <td>{eur(-adjustments)}</td>
              <td>—</td>
            </tr>
            <tr className="total">
              <td>Résultat analytique Helpdesk</td>
              <td>{eur(totals.revenue)}</td>
              <td>{eur(totals.cost)}</td>
              <td>{eur(totals.result)}</td>
              <td>{pctTxt(totals.margin)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="hint">Somme des contributions − coûts non ventilés = résultat analytique (même périmètre de mois). Les déplacements ne sont pas affectés aux clients.</p>
    </>
  );
}

const CATS: CostCategory[] = ['Agents N1', 'Techniciens N2', 'Management', 'Primes', 'Heures supplémentaires', 'Remplacements', 'Autres', 'Recrutement (imputé)'];

function Costs({ store, role, run, editable }: { store: FinanceStore; role: Role; run: (r: FinanceResult) => FinanceResult; editable: boolean }) {
  const { state } = store;
  const [month, setMonth] = useState(state.currentMonth);
  const [adj, setAdj] = useState({ kind: 'Prime' as AdjustmentKind, label: '', amount: 0 });
  const r = monthResult(month, state.currentMonth, state.costs, state.adjustments, state.prestations, recruitmentImputed(state.recruitment, month));
  const etp = state.costs.reduce((n, c) => n + c.etp * c.allocation * presenceRatio(c, month), 0);
  return (
    <>
      <div className="xc-toolbar">
        <label className="xc-inline">
          Mois
          <select value={month} onChange={(e) => setMonth(e.target.value)}>
            {monthsOf(state.year).map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <span className="hint">Coût employeur chargé (fictif) — jamais le salaire net. ETP Helpdesk sur le mois : {etp.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</span>
      </div>
      <div className="xc-kpis">
        {CATS.map((c) => (
          <div key={c} className="xc-kpi">
            <small>{c}</small>
            <strong>{eur(r.costs[c])}</strong>
          </div>
        ))}
        <div className="xc-kpi">
          <small>Total coûts opérationnels</small>
          <strong>{eur(r.cost)}</strong>
        </div>
      </div>
      <h3>Ajustements du mois (primes, heures supplémentaires, remplacements)</h3>
      <ul className="xc-mini">
        {state.adjustments
          .filter((a) => a.month === month)
          .map((a) => (
            <li key={a.id}>
              {a.kind} — {a.label} :{' '}
              <InlineEdit value={a.amount} field={`${a.kind} ${a.month}`} module="Budget & Rentabilité" canEdit={editable} type="number" min={0} format={(v) => eur(v)} onSave={(v) => store.updateAdjustment(a.id, v, role)} />
            </li>
          ))}
      </ul>
      {editable && (
        <div className="mg-form">
          <select aria-label="Type d’ajustement" value={adj.kind} onChange={(e) => setAdj({ ...adj, kind: e.target.value as AdjustmentKind })}>
            {(['Prime', 'Heures supplémentaires', 'Remplacement', 'Autre'] as const).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <input aria-label="Libellé de l’ajustement" placeholder="Libellé" value={adj.label} onChange={(e) => setAdj({ ...adj, label: e.target.value })} />
          <input aria-label="Montant de l’ajustement" type="number" min={0} value={adj.amount || ''} onChange={(e) => setAdj({ ...adj, amount: Number(e.target.value) })} />
          <button className="action" onClick={() => run(store.addAdjustment({ month, ...adj }, role)).ok && setAdj({ ...adj, label: '', amount: 0 })}>
            Ajouter
          </button>
        </div>
      )}
      <h3>Registre des coûts agents ({state.costs.length})</h3>
      <div className="xc-tablewrap">
        <table className="xc-table compact">
          <thead>
            <tr>
              <th>Collaborateur</th>
              <th>Population</th>
              <th>Équipe</th>
              <th>ETP</th>
              <th>Coût employeur mensuel</th>
              <th>Affectation Helpdesk</th>
              <th>Présence {monthLabel(month)}</th>
              <th>Coût du mois</th>
              <th>Mouvement</th>
            </tr>
          </thead>
          <tbody>
            {state.costs.map((c) => (
              <tr key={c.personId}>
                <td>{c.name}</td>
                <td>{c.population}</td>
                <td>{c.teamLabel}</td>
                <td>{c.etp.toLocaleString('fr-FR')}</td>
                <td>
                  <InlineEdit value={c.monthlyCost} field={`Coût employeur mensuel ${c.name}`} module="Budget & Rentabilité" canEdit={editable} type="number" min={0} format={(v) => eur(v)} onSave={(v) => store.setCost(c.personId, { monthlyCost: v }, role)} />
                </td>
                <td>
                  <InlineEdit value={Math.round(c.allocation * 100)} field={`Affectation Helpdesk ${c.name}`} module="Budget & Rentabilité" canEdit={editable} type="number" min={0} max={100} step={5} format={(v) => `${v} %`} onSave={(v) => store.setCost(c.personId, { allocation: v / 100 }, role)} />
                </td>
                <td>{Math.round(presenceRatio(c, month) * 100)} %</td>
                <td>{eur(entryCost(c, month))}</td>
                <td>{c.note ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Revenues({ store, role, run, editable }: { store: FinanceStore; role: Role; run: (r: FinanceResult) => FinanceResult; editable: boolean }) {
  const { state } = store;
  const [month, setMonth] = useState(state.currentMonth);
  const [status, setStatus] = useState<PrestationStatus | ''>('');
  const [client, setClient] = useState('');
  const [form, setForm] = useState({ clientId: 'invivo', type: 'Supplémentaire' as PrestationType, label: '', quantity: 1, unitPrice: 0 });
  const clients = [...new Map(state.prestations.map((p) => [p.clientId, p.clientName])).entries()];
  const list = state.prestations.filter((p) => (!month || p.month === month) && (!status || p.status === status) && (!client || p.clientId === client));
  return (
    <>
      <p className="fin-warning">Registre des prestations contractuelles. Un ticket résolu ou un CRA n’est jamais considéré comme une prestation facturée : seules les prestations validées entrent dans le résultat.</p>
      <div className="xc-toolbar">
        <select aria-label="Mois des prestations" value={month} onChange={(e) => setMonth(e.target.value)}>
          <option value="">Tous les mois</option>
          {monthsOf(state.year).map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </select>
        <select aria-label="Statut de validation" value={status} onChange={(e) => setStatus(e.target.value as PrestationStatus | '')}>
          <option value="">Tous statuts</option>
          {(['Validée', 'À valider', 'Prévisionnelle', 'Refusée'] as const).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select aria-label="Client des prestations" value={client} onChange={(e) => setClient(e.target.value)}>
          <option value="">Tous les clients</option>
          {clients.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <span className="hint">
          {list.length} prestation(s) · {eur(list.reduce((n, p) => n + prestationAmount(p), 0))}
        </span>
      </div>
      <div className="xc-tablewrap">
        <table className="xc-table compact">
          <thead>
            <tr>
              <th>N°</th>
              <th>Client</th>
              <th>Contrat</th>
              <th>Type</th>
              <th>Libellé</th>
              <th>Période</th>
              <th>Quantité</th>
              <th>Prix unitaire</th>
              <th>Montant</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.clientName}</td>
                <td>
                  <code>{p.contractId}</code>
                </td>
                <td>{p.type}</td>
                <td>{p.label}</td>
                <td>{monthLabel(p.month)}</td>
                <td>
                  <InlineEdit value={p.quantity} field={`Quantité ${p.id} ${p.clientName}`} module="Budget & Rentabilité" canEdit={editable && p.status !== 'Validée'} lockedReason={p.status === 'Validée' ? 'Prestation validée : non modifiable' : undefined} type="number" min={0} onSave={(v) => store.updatePrestation(p.id, { quantity: v }, role)} />
                </td>
                <td>
                  <InlineEdit value={p.unitPrice} field={`Prix unitaire ${p.id} ${p.clientName}`} module="Budget & Rentabilité" canEdit={editable && p.status !== 'Validée'} lockedReason={p.status === 'Validée' ? 'Prestation validée : non modifiable' : undefined} type="number" min={0} format={(v) => eur(v)} onSave={(v) => store.updatePrestation(p.id, { unitPrice: v }, role)} />
                </td>
                <td>{eur(prestationAmount(p))}</td>
                <td>
                  <span className={`badge ${p.status === 'Validée' ? 'ok' : p.status === 'Refusée' ? 'bad' : p.status === 'À valider' ? 'warn' : 'muted'}`}>{p.status}</span>
                  {p.status === 'À valider' && editable && (
                    <>
                      <button className="link" onClick={() => run(store.updatePrestation(p.id, { status: 'Validée' }, role))}>
                        Valider
                      </button>
                      <button className="link" onClick={() => run(store.updatePrestation(p.id, { status: 'Refusée' }, role))}>
                        Refuser
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && (
        <>
          <h3>Ajouter une prestation ({month ? monthLabel(month) : monthLabel(state.currentMonth)})</h3>
          <div className="mg-form">
            <select aria-label="Client de la prestation" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              {clients.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <select aria-label="Type de prestation" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PrestationType })}>
              {(['Forfait', 'ETP', 'Horaire', 'Acte', 'Supplémentaire'] as const).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input aria-label="Libellé de la prestation" placeholder="Libellé" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            <input aria-label="Quantité" type="number" min={0} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            <input aria-label="Prix unitaire" type="number" min={0} value={form.unitPrice || ''} onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) })} />
            <button
              className="action"
              onClick={() => {
                const ref = state.prestations.find((p) => p.clientId === form.clientId)!;
                run(store.addPrestation({ clientId: form.clientId, clientName: ref.clientName, contractId: ref.contractId, type: form.type, month: month || state.currentMonth, quantity: form.quantity, unitPrice: form.unitPrice, label: form.label || `Prestation ${form.type.toLowerCase()}` }, role));
              }}
            >
              Ajouter (à valider)
            </button>
          </div>
        </>
      )}
    </>
  );
}

function Travel({ store, role, run, editable }: { store: FinanceStore; role: Role; run: (r: FinanceResult) => FinanceResult; editable: boolean }) {
  const { state } = store;
  const b = travelBalance(state.travel);
  const [req, setReq] = useState({ label: '', amount: 0 });
  const [exp, setExp] = useState({ label: '', amount: 0 });
  const [ceil, setCeil] = useState({ to: state.travel.ceiling, reason: '', confirm: false });
  const [actual, setActual] = useState<Record<string, number>>({});
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <p className="fin-warning">Enveloppe fixe annuelle, non rattachée aux clients et exclue de la rentabilité. SOLDE = enveloppe − dépenses réalisées − engagements non réalisés. Un engagement converti en dépense n’est compté qu’une fois. Toute demande au-delà du solde est bloquée.</p>
      <div className="xc-kpis">
        <Kpi label="Enveloppe (plafond)" value={eur(b.ceiling)} />
        <Kpi label="Dépenses réalisées" value={eur(b.spent)} />
        <Kpi label="Engagements non réalisés" value={eur(b.committed)} />
        <Kpi label="SOLDE" value={eur(b.balance)} cls={b.balance <= 0 ? 'bad' : b.balance < b.ceiling * 0.1 ? 'warn' : 'ok'} />
      </div>
      <Gauge value={b.spent + b.committed} max={b.ceiling} label="Enveloppe consommée ou engagée" />
      <h3>Soumettre une demande de déplacement</h3>
      <div className="mg-form">
        <input aria-label="Objet du déplacement" placeholder="Objet (ex. comité de pilotage)" value={req.label} onChange={(e) => setReq({ ...req, label: e.target.value })} />
        <input aria-label="Montant estimé" type="number" min={0} placeholder="Montant estimé" value={req.amount || ''} onChange={(e) => setReq({ ...req, amount: Number(e.target.value) })} />
        <button className="action" onClick={() => run(store.submitTrip(req.label || 'Déplacement', req.amount, today, role))}>
          Soumettre (contrôle du solde)
        </button>
      </div>
      {editable && (
        <div className="mg-form">
          <input aria-label="Libellé de la dépense" placeholder="Dépense directe (libellé)" value={exp.label} onChange={(e) => setExp({ ...exp, label: e.target.value })} />
          <input aria-label="Montant de la dépense" type="number" min={0} placeholder="Montant" value={exp.amount || ''} onChange={(e) => setExp({ ...exp, amount: Number(e.target.value) })} />
          <button className="action" onClick={() => run(store.addExpense(exp.label || 'Dépense', exp.amount, today, role))}>
            Ajouter la dépense
          </button>
        </div>
      )}
      <h3>Engagements</h3>
      <div className="xc-tablewrap">
        <table className="xc-table compact">
          <thead>
            <tr>
              <th>N°</th>
              <th>Date</th>
              <th>Objet</th>
              <th>Montant engagé</th>
              <th>Statut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {state.travel.commitments.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.date}</td>
                <td>
                  {c.label}
                  {c.tripId ? ' · déplacement CSM' : ''}
                </td>
                <td>{eur(c.amount)}</td>
                <td>{c.status}</td>
                <td>
                  {c.status === 'Engagé' && editable && (
                    <span className="mg-actions">
                      <input className="fin-num" type="number" aria-label={`Montant réel ${c.id}`} value={actual[c.id] ?? c.amount} onChange={(e) => setActual({ ...actual, [c.id]: Number(e.target.value) })} />
                      <button className="link" onClick={() => run(store.convert(c.id, actual[c.id] ?? c.amount, role))}>
                        Convertir en dépense
                      </button>
                      <button className="link" onClick={() => run(store.cancel(c.id, role))}>
                        Annuler
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3>Décisions (journal)</h3>
      <ul className="xc-mini">
        {state.travel.decisions.length === 0 && <li className="hint">Aucune décision depuis le chargement.</li>}
        {state.travel.decisions.map((d, i) => (
          <li key={i} className={d.decision === 'Bloquée' ? 'xc-warn' : ''}>
            {fmtDateTime(d.at)} — <b>{d.decision}</b> : {d.label} ({eur(d.amount)}) · {d.reason} · {d.by}
          </li>
        ))}
      </ul>
      <h3>Révision budgétaire du plafond</h3>
      {can(role, 'budget-revision', 'edit') ? (
        <div className="mg-form">
          <input aria-label="Nouveau plafond" type="number" min={0} value={ceil.to} onChange={(e) => setCeil({ ...ceil, to: Number(e.target.value), confirm: false })} />
          <input aria-label="Motif du changement de plafond" placeholder="Justification (obligatoire)" value={ceil.reason} onChange={(e) => setCeil({ ...ceil, reason: e.target.value })} />
          <label className="xc-inline">
            <input type="checkbox" checked={ceil.confirm} onChange={(e) => setCeil({ ...ceil, confirm: e.target.checked })} /> Je confirme cette révision budgétaire
          </label>
          <button className="action" disabled={!ceil.confirm} onClick={() => run(store.setCeiling(ceil.to, ceil.reason, role)).ok && setCeil({ ...ceil, reason: '', confirm: false })}>
            Réviser le plafond
          </button>
        </div>
      ) : (
        <p className="restricted">Procédure de révision budgétaire réservée aux profils disposant de la permission spécifique « Révision budgétaire » (Direction et Administrateur dans la démonstration). Aucune modification en ligne du plafond n’est possible, même pour un administrateur.</p>
      )}
      <ul className="xc-mini">
        {state.travel.ceilingHistory.map((h, i) => (
          <li key={i}>
            {fmtDateTime(h.at)} — {h.by} : {eur(h.from)} → {eur(h.to)} · « {h.reason} »
          </li>
        ))}
      </ul>
    </>
  );
}

function Recruitment({ store, role, run, editable }: { store: FinanceStore; role: Role; run: (r: FinanceResult) => FinanceResult; editable: boolean }) {
  const { state } = store;
  const b = recruitmentBalance(state.recruitment);
  const [line, setLine] = useState({ label: '', kind: 'Annonce' as RecruitmentKind, amount: 0, status: 'Réalisée' as 'Réalisée' | 'Engagée' });
  return (
    <>
      {state.recruitment.rule === 'À confirmer' && <p className="itsm-missing">{RULE_TO_CONFIRM} — tant que la règle n’est pas confirmée, les frais de recrutement ne sont pas imputés au résultat du Helpdesk.</p>}
      <p className="fin-warning">Budget séparé. Seuls les frais de recrutement y sont saisis ; les salaires des recrues entrent dans le registre des coûts à leur date d’entrée (aucun double comptage).</p>
      <div className="xc-kpis">
        <div className="xc-kpi">
          <small>Enveloppe</small>
          <strong>
            <InlineEdit value={b.envelope} field="Enveloppe recrutement" module="Budget & Rentabilité" canEdit={editable} sensitive type="number" min={0} format={(v) => eur(v)} onSave={(v) => store.setRecruitmentEnvelope(v, role)} />
          </strong>
        </div>
        <Kpi label="Réalisé" value={eur(b.spent)} />
        <Kpi label="Engagé" value={eur(b.committed)} />
        <Kpi label="Solde" value={eur(b.balance)} cls={b.balance < 0 ? 'bad' : 'ok'} />
      </div>
      <label className="xc-inline">
        Règle d’imputation
        <select value={state.recruitment.rule} disabled={!(editable || can(role, 'budget-revision', 'edit'))} onChange={(e) => run(store.setRule(e.target.value as ImputationRule, role))}>
          {RULES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <div className="xc-tablewrap">
        <table className="xc-table compact">
          <thead>
            <tr>
              <th>N°</th>
              <th>Date</th>
              <th>Nature</th>
              <th>Libellé</th>
              <th>Montant</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {state.recruitment.lines.map((l) => (
              <tr key={l.id}>
                <td>{l.id}</td>
                <td>{l.date}</td>
                <td>{l.kind}</td>
                <td>{l.label}</td>
                <td>{eur(l.amount)}</td>
                <td>{l.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editable && (
        <div className="mg-form">
          <select aria-label="Nature" value={line.kind} onChange={(e) => setLine({ ...line, kind: e.target.value as RecruitmentKind })}>
            {(['Cabinet', 'Annonce', 'Salon / école', 'Intégration / formation', 'Autre'] as const).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <input aria-label="Libellé recrutement" placeholder="Libellé" value={line.label} onChange={(e) => setLine({ ...line, label: e.target.value })} />
          <input aria-label="Montant recrutement" type="number" min={0} value={line.amount || ''} onChange={(e) => setLine({ ...line, amount: Number(e.target.value) })} />
          <select aria-label="Statut recrutement" value={line.status} onChange={(e) => setLine({ ...line, status: e.target.value as 'Réalisée' | 'Engagée' })}>
            <option>Réalisée</option>
            <option>Engagée</option>
          </select>
          <button className="action" onClick={() => run(store.addRecruitmentLine({ ...line, date: new Date().toISOString().slice(0, 10) }, role))}>
            Ajouter
          </button>
        </div>
      )}
      <ul className="xc-mini">
        {state.recruitment.ruleHistory.map((h, i) => (
          <li key={i}>
            {fmtDateTime(h.at)} — {h.by} : règle « {h.from} » → « {h.to} »
          </li>
        ))}
      </ul>
    </>
  );
}
