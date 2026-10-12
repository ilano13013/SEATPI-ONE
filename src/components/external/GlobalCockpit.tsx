import type { ExternalClientId } from '../../external/types';
import { realConnectionLabel, simulationLabel, simulationState, useConnectionInfo } from '../../admin/connectionStates';
import type { ClientView, GlobalRow } from '../../external/derive';
import { HealthDot, LoadBar, eur, fmtDateTime, healthLabel } from './common';

interface Props {
  rows: GlobalRow[];
  total: GlobalRow;
  views: ClientView[];
  showFinance: boolean;
  onOpenClient: (id: ExternalClientId) => void;
  onOpenInternal: () => void;
  onAlert: (clientId: ExternalClientId, label: string, ids: string[]) => void;
}

const n = (v: number | null) => (v === null ? '—' : v.toLocaleString('fr-FR'));

export function GlobalCockpit({ rows, total, views, showFinance, onOpenClient, onOpenInternal, onAlert }: Props) {
  const { running, realOf } = useConnectionInfo();
  const line = (r: GlobalRow, clickable: boolean) => (
    <tr
      key={r.id}
      className={r.id === 'total' ? 'total' : r.internal ? 'internal' : ''}
      onClick={clickable ? () => (r.internal ? onOpenInternal() : onOpenClient(r.id as ExternalClientId)) : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => e.key === 'Enter' && (r.internal ? onOpenInternal() : onOpenClient(r.id as ExternalClientId)) : undefined}
    >
      <td className="clientcell">
        {r.health && <HealthDot health={r.health} />}
        <b>{r.label}</b>
      </td>
      <td>{r.headcount}</td>
      <td>{n(r.open)}</td>
      <td>{n(r.inProgress)}</td>
      <td>{n(r.resolved)}</td>
      <td>{n(r.backlog)}</td>
      <td>{r.sla === null ? '—' : `${r.sla.toLocaleString('fr-FR')} %`}</td>
      <td>{n(r.weeklyTarget)}</td>
      <td>{n(r.done)}</td>
      <td>{n(r.remaining)}</td>
      <td>{r.loadRatio === null ? '—' : <LoadBar ratio={r.loadRatio} />}</td>
      <td>{n(r.craPending)}</td>
      <td>{n(r.leavePending)}</td>
      {showFinance && (
        <>
          <td>{r.finance ? eur(r.finance.budget) : '—'}</td>
          <td>{r.finance ? eur(r.finance.cost) : '—'}</td>
          <td>{r.finance?.marginRate == null ? '—' : `${r.finance.marginRate.toLocaleString('fr-FR')} %`}</td>
        </>
      )}
    </tr>
  );

  const priority = views.flatMap((v) => v.alerts.filter((a) => a.severity === 'critical').map((a) => ({ v, a })));
  return (
    <div className="xc-global">
      <h3>À traiter en priorité ({priority.length})</h3>
      {priority.length === 0 ? (
        <p className="hint">Aucune alerte critique sur les sites clients.</p>
      ) : (
        <ul className="pdg-risks">
          {priority.map(({ v, a }) => (
            <li key={a.id}>
              <button className="xc-alert critical" onClick={() => onAlert(v.client.id, a.message, a.ticketIds)}>
                <span aria-hidden>✗ </span>
                {v.client.name} — {a.message} · voir les {a.ticketIds.length} ticket(s)
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="xc-sites">
        {views.map((v) => (
          <div key={v.client.id} className={`xc-site ${v.health}`}>
            <button className="xc-site-head" onClick={() => onOpenClient(v.client.id)}>
              <HealthDot health={v.health} />
              <b>{v.client.name}</b>
              <span className="badge muted">{healthLabel[v.health]}</span>
              <small>
                {v.client.tool ? `${v.client.tool} · ${realConnectionLabel(realOf(v.client.id))} · ${simulationLabel(simulationState(v.connector.status, running), v.connector.status)} · synchro simulée ${fmtDateTime(v.connector.lastSuccessAt)}` : 'ITSM NON RENSEIGNÉ — CONFIGURATION REQUISE'}
              </small>
            </button>
            <ul>
              {v.alerts.slice(0, 4).map((a) => (
                <li key={a.id}>
                  <button className={`xc-alert ${a.severity}`} onClick={() => onAlert(v.client.id, a.message, a.ticketIds)}>
                    {a.message}
                  </button>
                </li>
              ))}
              {v.alerts.length === 0 && <li className="hint">Aucune alerte</li>}
            </ul>
          </div>
        ))}
      </div>
      <h3>Vue consolidée — semaine en cours</h3>
      <p className="hint">Cliquez sur une ligne pour ouvrir le cockpit détaillé. SLA = résolutions de la semaine dans le délai ; charge = reste à faire estimé ÷ capacité sur 2 jours ouvrés.</p>
      <div className="xc-tablewrap">
        <table className="xc-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Effectif</th>
              <th>Ouverts</th>
              <th>En cours</th>
              <th>Résolus</th>
              <th>Backlog</th>
              <th>SLA</th>
              <th>Objectif hebdo</th>
              <th>Réalisé</th>
              <th>Reste à faire</th>
              <th>Charge</th>
              <th>CRA en attente</th>
              <th>Congés en attente</th>
              {showFinance && (
                <>
                  <th>Budget (sem.)</th>
                  <th>Coût (sem.)</th>
                  <th>Rentabilité</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => line(r, true))}
            {line(total, false)}
          </tbody>
        </table>
      </div>
      {!showFinance && <p className="hint">Les colonnes budget, coût et rentabilité sont réservées aux rôles disposant d’un accès finance.</p>}
    </div>
  );
}
