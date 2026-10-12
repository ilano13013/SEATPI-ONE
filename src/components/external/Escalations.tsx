import { useMemo, useState } from 'react';
import type { EscalationStatus, Service } from '../../external/types';
import type { ClientView } from '../../external/derive';
import { fmtDateTime, StatusBadge } from './common';

const SERVICES: Service[] = ['Helpdesk N1', 'MCO N2', 'Exploitation', 'CSM', 'Équipe externe'];

export function Escalations({ view, onOpen }: { view: ClientView; onOpen: (ticketId: string) => void }) {
  const [state, setState] = useState<'toutes' | EscalationStatus>('toutes');
  const [service, setService] = useState<'tous' | Service>('tous');
  const rows = useMemo(
    () =>
      view.tickets
        .flatMap((t) => t.escalations.map((e) => ({ t, e })))
        .filter(({ e }) => (state === 'toutes' || e.status === state) && (service === 'tous' || e.from === service || e.to === service))
        .sort((a, b) => b.e.at - a.e.at),
    [view.tickets, state, service],
  );
  const flows = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of view.tickets) for (const e of t.escalations) m.set(`${e.from} → ${e.to}`, (m.get(`${e.from} → ${e.to}`) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [view.tickets]);

  return (
    <div className="xc-escalations">
      <p className="hint">
        Coordination entre Helpdesk N1, MCO N2, Exploitation, CSM et équipes externes. Chaque ticket garde son identifiant interne unique (SPI-…) et sa correspondance avec l’identifiant de l’outil source ({view.client.tool}).
      </p>
      <div className="xc-flows">
        {flows.map(([flow, n]) => (
          <span key={flow} className="badge info">
            {flow} : {n}
          </span>
        ))}
      </div>
      <div className="xc-toolbar">
        <select aria-label="Statut de traitement" value={state} onChange={(e) => setState(e.target.value as typeof state)}>
          <option value="toutes">Toutes les escalades</option>
          <option>En cours</option>
          <option>Traitée</option>
          <option>Rejetée</option>
        </select>
        <select aria-label="Service" value={service} onChange={(e) => setService(e.target.value as typeof service)}>
          <option value="tous">Tous services</option>
          {SERVICES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="xc-tablewrap">
        <table className="xc-table">
          <thead>
            <tr>
              <th>Ticket (interne / source)</th>
              <th>Service d’origine</th>
              <th>Service destinataire</th>
              <th>Date d’escalade</th>
              <th>Motif</th>
              <th>Responsable</th>
              <th>Statut de traitement</th>
              <th>Statut du ticket</th>
              <th>Dernier événement</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ t, e }) => (
              <tr key={e.id + t.id} onClick={() => onOpen(t.id)} tabIndex={0} onKeyDown={(k) => k.key === 'Enter' && onOpen(t.id)}>
                <td>
                  <b>{t.id}</b>
                  <small>
                    {t.source.tool} {t.source.id}
                  </small>
                </td>
                <td>{e.from}</td>
                <td>{e.to}</td>
                <td>{fmtDateTime(e.at)}</td>
                <td>{e.reason}</td>
                <td>{e.owner}</td>
                <td>
                  <span className={`badge ${e.status === 'En cours' ? 'warn' : e.status === 'Traitée' ? 'ok' : 'bad'}`}>{e.status}</span>
                </td>
                <td>
                  <StatusBadge status={t.status} />
                </td>
                <td>{e.history[e.history.length - 1]?.label}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="empty">
                  Aucune escalade pour ces filtres.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
