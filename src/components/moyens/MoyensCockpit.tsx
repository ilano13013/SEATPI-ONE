// Moyens généraux → Déplacements professionnels (gestion opérationnelle).
// L'enveloppe déplacements du Helpdesk reste suivie dans Budget & Rentabilité : ici, lecture seule du solde.
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { MoyensStore, OtherRequest } from '../../moyens/useMoyens';
import { DEFAULT_BOOKING } from '../../moyens/useMoyens';
import type { FinanceStore } from '../../finance/useFinance';
import { travelBalance } from '../../finance/budget';
import { can, roleLabels, type Role } from '../../auth/roles';
import { Tabs } from '../ui';
import { Toast, fmtDateTime } from '../external/common';
import { Gauge } from '../finance/Charts';

type Tab = 'demandes' | 'prevus' | 'realises' | 'reservations' | 'depenses' | 'justificatifs' | 'historique';

interface Props {
  moyens: MoyensStore;
  fin: FinanceStore;
  role: Role;
  onOpenBudget: () => void;
  onBack: () => void;
}

const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;

export function MoyensCockpit({ moyens, fin, role, onOpenBudget, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('demandes');
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);
  const [form, setForm] = useState({ department: 'Helpdesk', label: '', estimate: 0, date: new Date().toISOString().slice(0, 10) });
  const travel = fin.state.travel;
  const b = travelBalance(travel);
  const by = `${roleLabels[role]} (démonstration)`;
  const editable = can(role, 'moyens', 'edit');
  const ms = moyens.state;
  const missing = travel.expenses.filter((e) => (ms.receipts[e.id] ?? 'Manquant') === 'Manquant');
  const toBook = travel.commitments.filter((c) => c.status === 'Engagé' && (ms.bookings[c.id] ?? DEFAULT_BOOKING).transport === 'À réserver');

  const submit = () => {
    if (form.department === 'Helpdesk') {
      // Demande imputée au Helpdesk : contrôle du plafond de l'enveloppe (aucune duplication du budget).
      setToast(fin.submitTrip(form.label || 'Déplacement', form.estimate, form.date, role));
    } else setToast(moyens.addOtherRequest({ department: form.department, label: form.label, date: form.date, estimate: form.estimate }, by));
  };

  return (
    <section className="xc" aria-label="Moyens généraux — déplacements">
      <div className="xc-head">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Carte 3D
        </button>
        <div>
          <small className="crumb">Moyens généraux › Déplacements professionnels</small>
          <b>Déplacements professionnels</b>
          <span>Organisation, réservations et justificatifs · données fictives · aucune réservation réelle n’est effectuée</span>
        </div>
      </div>
      <div className="fin-envelope mg-envelope">
        <b>Enveloppe déplacements du département Helpdesk (suivie par la responsable Helpdesk)</b>
        <span>
          Solde <strong>{eur(b.balance)}</strong> sur {eur(b.ceiling)} · lecture seule ici
        </span>
        <Gauge value={b.spent + b.committed} max={b.ceiling} label="Consommé + engagé" />
        <button className="link" onClick={onOpenBudget}>
          Ouvrir l’enveloppe dans Budget & Rentabilité
        </button>
      </div>
      <div className="xc-kpis">
        <div className={`xc-kpi ${toBook.length ? 'warn' : 'ok'}`}>
          <small>Réservations à faire</small>
          <strong>{toBook.length}</strong>
        </div>
        <div className={`xc-kpi ${missing.length ? 'warn' : 'ok'}`}>
          <small>Justificatifs manquants</small>
          <strong>{missing.length}</strong>
        </div>
        <div className="xc-kpi">
          <small>Demandes autres services</small>
          <strong>{ms.otherRequests.filter((r) => r.status === 'Demandée').length}</strong>
        </div>
      </div>
      <div className="xc-tabs">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { id: 'demandes', label: 'Demandes' },
            { id: 'prevus', label: 'Déplacements prévus' },
            { id: 'realises', label: 'Réalisés' },
            { id: 'reservations', label: `Réservations (${toBook.length})` },
            { id: 'depenses', label: 'Dépenses' },
            { id: 'justificatifs', label: `Justificatifs (${missing.length})` },
            { id: 'historique', label: 'Historique' },
          ]}
        />
      </div>

      {tab === 'demandes' && (
        <>
          <div className="mg-form">
            <select aria-label="Service demandeur" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              {['Helpdesk', 'Commercial', 'Exploitation', 'Formation', 'Direction', 'Recrutement'].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <input aria-label="Objet" placeholder="Objet du déplacement" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            <input aria-label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input aria-label="Montant estimé" type="number" min={0} placeholder="Estimation" value={form.estimate || ''} onChange={(e) => setForm({ ...form, estimate: Number(e.target.value) })} />
            <button className="action" disabled={!editable && form.department !== 'Helpdesk'} onClick={submit}>
              Enregistrer la demande
            </button>
          </div>
          <p className="hint">Demandes Helpdesk : contrôlées sur l’enveloppe du département (blocage au-delà du solde, décision journalisée). Autres services : suivi opérationnel uniquement (budgets non modélisés).</p>
          <h3>Décisions sur l’enveloppe Helpdesk</h3>
          <ul className="xc-mini">
            {travel.decisions.length === 0 && <li className="hint">Aucune demande depuis le chargement.</li>}
            {travel.decisions.map((d, i) => (
              <li key={i} className={d.decision === 'Bloquée' ? 'xc-warn' : ''}>
                {fmtDateTime(d.at)} — <b>{d.decision}</b> : {d.label} ({eur(d.amount)}) · {d.reason}
              </li>
            ))}
          </ul>
          <h3>Demandes des autres services</h3>
          <table className="xc-table compact">
            <thead>
              <tr>
                <th>N°</th>
                <th>Service</th>
                <th>Objet</th>
                <th>Date</th>
                <th>Estimation</th>
                <th>Suivi</th>
              </tr>
            </thead>
            <tbody>
              {ms.otherRequests.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.department}</td>
                  <td>{r.label}</td>
                  <td>{r.date}</td>
                  <td>{eur(r.estimate)}</td>
                  <td>
                    <select aria-label={`Suivi ${r.id}`} disabled={!editable} value={r.status} onChange={(e) => moyens.setOtherStatus(r.id, e.target.value as OtherRequest['status'], by)}>
                      {(['Demandée', 'Organisée', 'Réalisée', 'Annulée'] as const).map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {(tab === 'prevus' || tab === 'reservations') && (
        <table className="xc-table compact">
          <thead>
            <tr>
              <th>N°</th>
              <th>Date</th>
              <th>Objet</th>
              <th>Montant engagé (Helpdesk)</th>
              <th>Transport</th>
              <th>Hôtel</th>
            </tr>
          </thead>
          <tbody>
            {travel.commitments
              .filter((c) => c.status === 'Engagé')
              .map((c) => {
                const bk = ms.bookings[c.id] ?? DEFAULT_BOOKING;
                const sel = (field: 'transport' | 'hotel') => (
                  <select aria-label={`${field} ${c.id}`} disabled={!editable || tab === 'prevus'} value={bk[field]} onChange={(e) => moyens.setBooking(c.id, { [field]: e.target.value }, by)}>
                    {(['À réserver', 'Réservé', 'Annulé', 'Sans objet'] as const).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                );
                return (
                  <tr key={c.id}>
                    <td>{c.id}</td>
                    <td>{c.date}</td>
                    <td>
                      {c.label}
                      {c.tripId ? ' · manager CSM' : ''}
                    </td>
                    <td>{eur(c.amount)}</td>
                    <td>{sel('transport')}</td>
                    <td>{sel('hotel')}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      )}

      {(tab === 'realises' || tab === 'depenses' || tab === 'justificatifs') && (
        <table className="xc-table compact">
          <thead>
            <tr>
              <th>N°</th>
              <th>Date</th>
              <th>Objet</th>
              <th>Dépense</th>
              <th>Justificatif</th>
            </tr>
          </thead>
          <tbody>
            {travel.expenses
              .filter((e) => tab !== 'justificatifs' || (ms.receipts[e.id] ?? 'Manquant') === 'Manquant')
              .map((e) => (
                <tr key={e.id}>
                  <td>{e.id}</td>
                  <td>{e.date}</td>
                  <td>{e.label}</td>
                  <td>{eur(e.amount)}</td>
                  <td>
                    <select aria-label={`Justificatif ${e.id}`} disabled={!editable} value={ms.receipts[e.id] ?? 'Manquant'} onChange={(ev) => moyens.setReceipt(e.id, ev.target.value as 'Reçu' | 'Manquant', by)}>
                      <option>Reçu</option>
                      <option>Manquant</option>
                    </select>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      {tab === 'historique' && (
        <ol className="xc-history mg-history">
          {[...ms.log.map((l) => ({ at: l.at, text: `${l.action} — ${l.detail} · ${l.by}` })), ...travel.decisions.map((d) => ({ at: d.at, text: `Enveloppe Helpdesk — ${d.decision} : ${d.label} (${eur(d.amount)})` }))]
            .sort((a, c) => c.at - a.at)
            .map((h, i) => (
              <li key={i}>
                <time>{fmtDateTime(h.at)}</time> {h.text}
              </li>
            ))}
          {ms.log.length + travel.decisions.length === 0 && <li className="hint">Aucun évènement depuis le chargement.</li>}
        </ol>
      )}
      {toast && <Toast message={toast.message} ok={toast.ok} onDone={() => setToast(null)} />}
    </section>
  );
}
