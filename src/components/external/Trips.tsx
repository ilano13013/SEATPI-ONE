import { useEffect, useState } from 'react';
import type { Technician, Ticket } from '../../external/types';
import { tripStatus, type Trip, type TripPhase } from '../../external/trips';
import { fmtDateTime } from './common';

/** Horloge locale : la progression des trajets avance entre deux synchronisations. */
export function useNow(intervalMs = 10_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

const PHASE_TONE: Record<TripPhase, string> = { 'En route': 'info', 'Sur site': 'violet', Retour: 'warn', Terminé: 'muted' };

interface Props {
  trips: Trip[];
  tickets: Ticket[];
  techs: Technician[];
  individual: boolean;
  clientNames?: Record<string, string>;
  onOpenTicket: (ticket: Ticket) => void;
  onOpenTech?: (techId: string) => void;
}

export function TripsTable({ trips, tickets, techs, individual, clientNames, onOpenTicket, onOpenTech }: Props) {
  const now = useNow();
  const rows = trips
    .map((trip) => ({ trip, s: tripStatus(trip, now), ticket: tickets.find((t) => t.id === trip.ticketId) }))
    .sort((a, b) => Number(a.s.phase === 'Terminé') - Number(b.s.phase === 'Terminé') || b.trip.departAt - a.trip.departAt);
  const active = rows.filter((r) => r.s.phase !== 'Terminé');
  return (
    <>
      <p className="hint">
        {active.length} déplacement(s) en cours · {rows.length - active.length} terminé(s) récemment. Interventions du MCO N2 sur le site secondaire du client ; la progression est mise à jour en continu.
      </p>
      <div className="xc-tablewrap">
        <table className="xc-table">
          <thead>
            <tr>
              <th>Technicien</th>
              {clientNames && <th>Client</th>}
              <th>Ticket</th>
              <th>Trajet</th>
              <th>Moyen</th>
              <th>Départ</th>
              <th>Arrivée</th>
              <th>Fin d’intervention</th>
              <th>Retour</th>
              <th>Statut</th>
              <th>Progression</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ trip, s, ticket }) => (
              <tr key={trip.id} onClick={() => ticket && onOpenTicket(ticket)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && ticket && onOpenTicket(ticket)}>
                <td>
                  {individual ? (
                    <button
                      className="link"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTech?.(trip.techId);
                      }}
                    >
                      {techs.find((t) => t.id === trip.techId)?.name ?? trip.techId}
                    </button>
                  ) : (
                    'Technicien'
                  )}
                </td>
                {clientNames && <td>{clientNames[trip.clientId]}</td>}
                <td>
                  <b>{trip.ticketId}</b>
                  <small>{ticket?.title}</small>
                </td>
                <td>
                  {trip.from} → {trip.to}
                </td>
                <td>{trip.transport}</td>
                <td>{fmtDateTime(trip.departAt)}</td>
                <td>{fmtDateTime(s.arriveAt)}</td>
                <td>{fmtDateTime(s.leaveSiteAt)}</td>
                <td>{fmtDateTime(s.backAt)}</td>
                <td>
                  <span className={`badge ${PHASE_TONE[s.phase]}`}>{s.phase}</span>
                </td>
                <td>
                  <span className="loadbar">
                    <span className="track">
                      <i className="ok" style={{ width: `${Math.round(((now - trip.departAt) / (s.backAt - trip.departAt)) * 100)}%`, maxWidth: '100%' }} />
                    </span>
                    <b>{Math.min(100, Math.max(0, Math.round(((now - trip.departAt) / (s.backAt - trip.departAt)) * 100)))} %</b>
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={clientNames ? 11 : 10} className="empty">
                  Aucun déplacement en cours.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
