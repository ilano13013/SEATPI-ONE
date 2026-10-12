import { useMemo } from 'react';
import type { Technician } from '../../external/types';
import type { ClientView } from '../../external/derive';
import { contractById } from '../../external/config';
import { periods } from '../../external/metrics';
import { planning, techStats, type TechStats } from '../../external/workload';
import { Detail } from '../ui';
import { LoadBar, Modal, fmtDateTime, fmtDay, fmtHours, PriorityBadge, StatusBadge, SlaBadge } from './common';

interface Props {
  view: ClientView;
  now: number;
  individual: boolean;
  onOpenTech: (techId: string) => void;
  onFilter: (label: string, ids: string[]) => void;
}

export function Technicians({ view, now, individual, onOpenTech, onFilter }: Props) {
  const week = periods(now).week;
  const stats = useMemo(
    () => [...view.techs].sort((a, b) => a.name.localeCompare(b.name, 'fr')).map((t) => techStats(t, view.tickets, view.client, now, week)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, now],
  );
  const teamName = (id: string) => view.teams.find((t) => t.id === id)?.name ?? id;

  return (
    <div className="xc-techs">
      <h3>Répartition du travail par équipe</h3>
      <div className="xc-teamcards">
        {view.loads.map((l) => (
          <button key={l.team.id} className={`xc-teamload ${l.level}`} onClick={() => onFilter(`${l.team.name} — tickets ouverts`, l.openIds)}>
            <span>
              <b>{l.team.name}</b>
              <small>
                {l.team.service} · contrat {l.team.contractId} · {l.presentToday}/{l.techs.length} présents aujourd’hui · {l.unassignedIds.length} non affecté(s)
              </small>
            </span>
            <LoadBar ratio={l.ratio} />
            <small>
              {l.effortH} h de reste à faire / {l.capacityH} h de capacité planifiée
              {l.level !== 'ok' && <b className="xc-warn"> · {l.level === 'surcharge' ? 'Charge supérieure à la capacité planifiée' : 'Charge proche de la capacité'}</b>}
            </small>
          </button>
        ))}
      </div>

      {individual ? (
        <>
          <h3>Supervision par technicien</h3>
          <p className="hint">Ordre alphabétique. Ces indicateurs servent au pilotage de la charge ; ils ne produisent aucun classement ni évaluation individuelle.</p>
          <div className="xc-tablewrap">
            <table className="xc-table">
              <thead>
                <tr>
                  <th>Technicien</th>
                  <th>Équipe</th>
                  <th>Disponibilité</th>
                  <th>Aujourd’hui</th>
                  <th>Affectés</th>
                  <th>En cours</th>
                  <th>Résolus (sem.)</th>
                  <th>En retard</th>
                  <th>Temps passé (sem.)</th>
                  <th>Charge</th>
                  <th>CRA</th>
                  <th>Congés</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.tech.id} onClick={() => onOpenTech(s.tech.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onOpenTech(s.tech.id)}>
                    <td>
                      <b>{s.tech.name}</b>
                    </td>
                    <td>{teamName(s.tech.teamId)}</td>
                    <td>{Math.round(s.tech.availability * 100)} %</td>
                    <td>{s.onLeaveToday ? <span className="badge muted">Congé</span> : <span className="badge ok">Présent</span>}</td>
                    <td>{s.assigned.length}</td>
                    <td>{s.inProgress.length}</td>
                    <td>{s.resolved.length}</td>
                    <td>{s.late.length ? <span className="badge bad">{s.late.length}</span> : 0}</td>
                    <td>{fmtHours(s.timeSpentMin)}</td>
                    <td>
                      <LoadBar ratio={s.ratio} />
                    </td>
                    <td>
                      <span className={`badge ${s.tech.cra.status === 'Validé' ? 'ok' : s.tech.cra.status === 'Soumis' ? 'info' : 'warn'}`}>{s.tech.cra.status}</span>
                    </td>
                    <td>{s.tech.pendingLeaveRequests ? `${s.tech.pendingLeaveRequests} demande(s)` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="hint">Vue agrégée : le détail par technicien est réservé aux Team Leaders et à la responsable Helpdesk.</p>
      )}
    </div>
  );
}

export function TechnicianSheet({ tech, view, now, onClose, onOpenTicket }: { tech: Technician; view: ClientView; now: number; onClose: () => void; onOpenTicket: (id: string) => void }) {
  const s: TechStats = techStats(tech, view.tickets, view.client, now, periods(now).week);
  const team = view.teams.find((t) => t.id === tech.teamId);
  const list = (title: string, items: typeof s.assigned) => (
    <section>
      <h4>
        {title} ({items.length})
      </h4>
      {items.length === 0 && <p className="hint">Aucun.</p>}
      <ul className="xc-mini">
        {items.slice(0, 12).map((t) => (
          <li key={t.id}>
            <button onClick={() => onOpenTicket(t.id)}>
              <b>{t.id}</b> {t.title} <PriorityBadge p={t.priority} /> <StatusBadge status={t.status} /> <SlaBadge state={t.sla.state} />
            </button>
          </li>
        ))}
        {items.length > 12 && <li className="hint">… et {items.length - 12} autre(s)</li>}
      </ul>
    </section>
  );
  return (
    <Modal wide title={`Fiche opérationnelle — ${tech.name}`} onClose={onClose}>
      <p className="hint">Pseudonyme fictif. Fiche de pilotage de la charge, sans évaluation individuelle.</p>
      <div className="xc-detail-grid">
        <section>
          <h4>Affectation</h4>
          <Detail
            items={[
              ['Client', view.client.name],
              ['Équipe', team?.name ?? tech.teamId],
              ['Contrat', `${tech.contractId} — ${contractById(tech.contractId).label}`],
              ['Disponibilité déclarée', `${Math.round(tech.availability * 100)} %`],
              ['Compétences', tech.skills.join(', ')],
              ['Identifiant source', `${view.client.tool} · ${tech.sourceLogin}`],
            ]}
          />
          <h4>Planning</h4>
          <div className="xc-planning">
            {planning(tech, now, view.client).map((d) => (
              <span key={d.day} className={d.state === 'Congé' ? 'off' : d.state === 'Temps partiel' ? 'part' : 'on'}>
                <b>{fmtDay(d.day)}</b>
                {d.state}
              </span>
            ))}
          </div>
        </section>
        <section>
          <h4>Charge et activité (semaine)</h4>
          <Detail
            items={[
              ['Charge', <LoadBar key="l" ratio={s.ratio} />],
              ['Reste à faire estimé', `${s.effortH} h`],
              ['Capacité (2 jours ouvrés)', `${s.capacityH} h`],
              ['Tickets affectés', s.assigned.length],
              ['En cours', s.inProgress.length],
              ['Résolus', s.resolved.length],
              ['En retard', s.late.length],
              ['Temps de traitement', fmtHours(s.timeSpentMin)],
            ]}
          />
          <h4>Congés et CRA</h4>
          <Detail
            items={[
              ['Congés posés', tech.leaveDates.length ? tech.leaveDates.map((d) => new Date(d).toLocaleDateString('fr-FR')).join(', ') : 'Aucun'],
              ['Demandes en attente', tech.pendingLeaveRequests],
              ['CRA de la semaine', tech.cra.status],
              ['Heures déclarées', `${tech.cra.hours} h`],
              ['Dernière synchronisation', fmtDateTime(view.connector.lastSuccessAt)],
            ]}
          />
        </section>
      </div>
      {list('Activités restantes', s.remaining)}
      {list('En retard (hors SLA)', s.late)}
      {list('Résolus cette semaine', s.resolved)}
    </Modal>
  );
}
