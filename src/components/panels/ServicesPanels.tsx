import type { ExternalClientId } from '../../external/types';
import type { ClientView } from '../../external/derive';
import { csmCards, exploitationTeam, serviceSummary, supervisionChecks, csmTeam } from '../../external/services';
import { periods, slaRate } from '../../external/metrics';
import { can, type Role } from '../../auth/roles';
import { HealthDot, fmtDateTime } from '../external/common';
import { activeTripOf, tripStatus, type Trip } from '../../external/trips';
import { PHASE_TONE, tripTiming } from '../external/Trips';
import { Badge } from '../ui';

interface Props {
  views: ClientView[];
  trips: Trip[];
  role: Role;
  now: number;
  onOpenTicket: (clientId: ExternalClientId, ticketId: string) => void;
  onOpenClient: (clientId: ExternalClientId) => void;
}

export function ExploitationPanel({ views, role, now, onOpenTicket }: Props) {
  const s = serviceSummary(views, 'Exploitation', now);
  const individual = can(role, 'exploitation', 'individual');
  const name = (id: string) => exploitationTeam.find((m) => m.id === id)?.name ?? id;
  return (
    <>
      <p className="hint">Service interne SEATPI : il n’est pas affecté chez les clients. Il reçoit les escalades du MCO N2 (incidents d’infrastructure, serveurs, réseau, sauvegardes).</p>
      <div className="kpis">
        <div>
          <small>Escalades en cours</small>
          <strong className={s.open.length ? 'tone-warn' : ''}>{s.open.length}</strong>
        </div>
        <div>
          <small>Reçues cette semaine</small>
          <strong>{s.week.length}</strong>
        </div>
        <div>
          <small>Présents</small>
          <strong>
            {exploitationTeam.filter((m) => m.present).length}/{exploitationTeam.length}
          </strong>
        </div>
        <div>
          <small>Occupés sur escalade</small>
          <strong>{s.busy.size}</strong>
        </div>
      </div>
      <h3>Escalades en cours</h3>
      {s.open.length === 0 && <p className="hint">Aucune escalade en cours.</p>}
      <div className="list">
        {s.open.map((r) => (
          <button key={r.escalation.id + r.ticket.id} className="kv as-button" onClick={() => onOpenTicket(r.clientId, r.ticket.id)}>
            <span>
              <b>{r.ticket.id}</b> {r.clientName} · {r.escalation.reason}
            </span>
            <small>
              depuis {fmtDateTime(r.escalation.at)}
              {individual ? ` · ${name(r.ownerId)}` : ''}
            </small>
          </button>
        ))}
      </div>
      <h3>Reçues cette semaine par client</h3>
      <div className="list">
        {views.map((v) => (
          <div className="kv" key={v.client.id}>
            <span>{v.client.name}</span>
            <b>{s.week.filter((r) => r.clientId === v.client.id).length}</b>
          </div>
        ))}
      </div>
      <h3>Contrôles du jour</h3>
      <div className="list">
        {supervisionChecks.map((c) => (
          <div className="kv" key={c.label}>
            <span>{c.label}</span>
            <Badge tone={c.ok === c.total ? 'ok' : 'warn'}>
              {c.ok}/{c.total}
            </Badge>
          </div>
        ))}
      </div>
      {individual && (
        <>
          <h3>Équipe</h3>
          <div className="list">
            {exploitationTeam.map((m) => (
              <div className="kv" key={m.id}>
                <span>
                  <b>{m.name}</b> <small>{m.skills.join(', ')}</small>
                </span>
                <Badge tone={!m.present ? 'muted' : s.busy.has(m.id) ? 'info' : 'ok'}>
                  {!m.present ? 'Absent' : s.busy.has(m.id) ? 'Sur escalade' : 'Disponible'}
                  {m.onCall ? ' · astreinte' : ''}
                </Badge>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function CsmPanel({ views, trips, role, now, onOpenTicket, onOpenClient }: Props) {
  const individual = can(role, 'csm', 'individual');
  const week = periods(now).week;
  return (
    <>
      <p className="hint">Service interne SEATPI : relation client et gouvernance des contrats. Il reçoit les escalades contractuelles (dérogations, insatisfactions, demandes hors périmètre).</p>
      {csmCards(views, now).map((c) => {
        const sla = slaRate(c.view.tickets, week).rate;
        const atRisk = c.view.objectives.filter((o) => o.status === 'à risque' || o.status === 'non atteint').length;
        return (
          <div className="csm-card" key={c.view.client.id}>
            <button className="csm-head" onClick={() => onOpenClient(c.view.client.id)}>
              <HealthDot health={c.view.health} />
              <b>{c.view.client.name}</b>
              <small>{individual ? c.csm.name : 'CSM du compte'} · comité {fmtDateTime(c.committee)}</small>
            </button>
            {(() => {
              const trip = activeTripOf(trips, c.csm.id, Date.now());
              if (!trip) return null;
              const st = tripStatus(trip, Date.now());
              return (
                <div className="kv">
                  <span>
                    Déplacement : {trip.purpose} ({trip.transport})
                  </span>
                  <span className={`badge ${PHASE_TONE[st.phase]}`}>
                    {st.phase} · {tripTiming(trip, Date.now())}
                  </span>
                </div>
              );
            })()}
            <div className="kv">
              <span>SLA de la semaine</span>
              <b>{sla === null ? '—' : `${sla.toLocaleString('fr-FR')} %`}</b>
            </div>
            <div className="kv">
              <span>Tickets hors SLA en cours</span>
              <b>{c.breachedOpen}</b>
            </div>
            <div className="kv">
              <span>Objectifs à risque</span>
              <b>{atRisk}</b>
            </div>
            {c.openEscalations.map((r) => (
              <button key={r.escalation.id + r.ticket.id} className="kv as-button" onClick={() => onOpenTicket(c.view.client.id, r.ticket.id)}>
                <span>
                  <b>{r.ticket.id}</b> {r.escalation.reason}
                </span>
                <small>depuis {fmtDateTime(r.escalation.at)}</small>
              </button>
            ))}
            {c.openEscalations.length === 0 && <p className="hint">Aucune escalade contractuelle en cours.</p>}
          </div>
        );
      })}
      <p className="hint">{csmTeam.length} CSM, un par compte client.</p>
    </>
  );
}
