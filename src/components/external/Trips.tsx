import { useEffect, useState } from 'react';
import { tripStatus, type Trip, type TripPhase } from '../../external/trips';
import { csmTeam } from '../../external/services';
import { clientById } from '../../external/config';
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

export const PHASE_TONE: Record<TripPhase, string> = { 'En route': 'info', 'Chez le client': 'violet', Retour: 'warn', Terminé: 'muted' };

const hm = (t: number) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** Résumé court d'un déplacement : « arrivée 14:20 », « jusqu'à 16:30 », « retour 17:10 ». */
export function tripTiming(trip: Trip, now: number): string {
  const s = tripStatus(trip, now);
  if (s.phase === 'En route') return `arrivée ${hm(s.arriveAt)}`;
  if (s.phase === 'Chez le client') return `jusqu’à ${hm(s.leaveSiteAt)}`;
  if (s.phase === 'Retour') return `retour ${hm(s.backAt)}`;
  return `rentré à ${hm(s.backAt)}`;
}

export const memberName = (id: string, individual: boolean) => (individual ? (csmTeam.find((m) => m.id === id)?.name ?? id) : 'Manager CSM');

export function CsmTripsTable({ trips, individual, onOpenClient }: { trips: Trip[]; individual: boolean; onOpenClient: (clientId: Trip['clientId']) => void }) {
  const now = useNow();
  const rows = trips
    .map((trip) => ({ trip, s: tripStatus(trip, now) }))
    .sort((a, b) => Number(a.s.phase === 'Terminé') - Number(b.s.phase === 'Terminé') || b.trip.departAt - a.trip.departAt);
  const active = rows.filter((r) => r.s.phase !== 'Terminé').length;
  return (
    <>
      <p className="hint">
        {active} déplacement(s) en cours · {rows.length - active} terminé(s) récemment. Déplacements des managers CSM du siège SEATPI vers les clients (comités, revues de service, points d’escalade).
      </p>
      <div className="xc-tablewrap">
        <table className="xc-table">
          <thead>
            <tr>
              <th>Manager CSM</th>
              <th>Client</th>
              <th>Motif</th>
              <th>Trajet</th>
              <th>Moyen</th>
              <th>Départ</th>
              <th>Arrivée</th>
              <th>Fin de visite</th>
              <th>Retour</th>
              <th>Statut</th>
              <th>Progression</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ trip, s }) => {
              const pct = Math.min(100, Math.max(0, Math.round(((now - trip.departAt) / (s.backAt - trip.departAt)) * 100)));
              return (
                <tr key={trip.id} onClick={() => onOpenClient(trip.clientId)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpenClient(trip.clientId)}>
                  <td>
                    <b>{memberName(trip.memberId, individual)}</b>
                  </td>
                  <td>{clientById(trip.clientId).name}</td>
                  <td>{trip.purpose}</td>
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
                        <i className="ok" style={{ width: `${pct}%` }} />
                      </span>
                      <b>{pct} %</b>
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="empty">
                  Aucun déplacement CSM en cours.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** Encart lisible affiché par-dessus la carte des sites clients. */
export function CsmTripsOverlay({ trips, individual, onSelect }: { trips: Trip[]; individual: boolean; onSelect: (trip: Trip) => void }) {
  const now = useNow(5_000);
  const active = trips.filter((t) => tripStatus(t, now).phase !== 'Terminé');
  return (
    <div className="csm-overlay" aria-label="Déplacements CSM en cours">
      <b>Déplacements CSM en cours ({active.length})</b>
      {active.length === 0 && <small>Aucun manager CSM en déplacement.</small>}
      {active.map((t) => {
        const s = tripStatus(t, now);
        return (
          <button key={t.id} onClick={() => onSelect(t)}>
            <i style={{ background: clientById(t.clientId).accent }} />
            <span>
              <strong>
                {memberName(t.memberId, individual)} → {clientById(t.clientId).name}
              </strong>
              <small>
                {t.purpose} · {t.transport}
              </small>
            </span>
            <span className={`badge ${PHASE_TONE[s.phase]}`}>
              {s.phase}
              <br />
              {tripTiming(t, now)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
