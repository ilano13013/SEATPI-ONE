// Cockpits MCO N2 et Exploitation : indicateurs propres à chaque service,
// jamais additionnés à ceux du Helpdesk N1.
import { ArrowLeft } from 'lucide-react';
import type { ClientView } from '../../external/derive';
import type { ExternalClientId } from '../../external/types';
import type { ExternalNav } from '../external/common';
import { HealthDot, LoadBar, fmtDateTime } from '../external/common';
import { isOpen, periods, slaRate } from '../../external/metrics';
import { isOnLeave } from '../../external/workload';
import { exploitationTeam, serviceSummary, supervisionChecks } from '../../external/services';
import { ExploitationPanel } from '../panels/ServicesPanels';
import { ITSM_NOT_SET } from '../../config/itsm';
import type { Role } from '../../auth/roles';

interface Common {
  views: ClientView[];
  role: Role;
  now: number;
  onBack: () => void;
}

export function McoCockpit({ views, now, onBack, onOpen }: Common & { onOpen: (nav: ExternalNav) => void }) {
  const week = periods(now).week;
  return (
    <section className="xc" aria-label="Cockpit MCO N2">
      <div className="xc-head">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Carte 3D
        </button>
        <div>
          <b>MCO / Support N2 — équipes chez les clients</b>
          <span>INVIVO, PRIMAGAZ, MONEXT · indicateurs N2 distincts du Helpdesk N1 · données de démonstration</span>
        </div>
      </div>
      <div className="xc-tablewrap">
        <table className="xc-table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Outil ITSM</th>
              <th>Techniciens présents</th>
              <th>Tickets ouverts</th>
              <th>Hors SLA</th>
              <th>SLA semaine</th>
              <th>Escalades Exploitation / CSM en cours</th>
              <th>Charge</th>
            </tr>
          </thead>
          <tbody>
            {views.map((v) => {
              const open = v.tickets.filter(isOpen);
              const breached = open.filter((t) => t.sla.state === 'dépassé');
              const esc = (to: string) => v.tickets.filter((t) => t.escalations.some((e) => e.to === to && e.status === 'En cours'));
              const load = v.loads.length ? Math.max(...v.loads.map((l) => l.ratio)) : null;
              const go = (label: string, ids: string[]) => onOpen({ scope: v.client.id as ExternalClientId, tab: 'tickets', filter: { label, ids } });
              return (
                <tr key={v.client.id}>
                  <td className="clientcell">
                    <HealthDot health={v.health} /> <b>{v.client.name}</b>
                  </td>
                  <td>{v.client.tool ?? <em className="nr">{ITSM_NOT_SET}</em>}</td>
                  <td>
                    {v.techs.filter((t) => !isOnLeave(t, now)).length}/{v.techs.length}
                  </td>
                  <td>
                    <button className="link" onClick={() => go('Tickets ouverts', open.map((t) => t.id))}>
                      {open.length}
                    </button>
                  </td>
                  <td>
                    <button className="link" onClick={() => go('Hors SLA', breached.map((t) => t.id))}>
                      {breached.length}
                    </button>
                  </td>
                  <td>{v.client.tool ? `${slaRate(v.tickets, week).rate ?? '—'} %` : '—'}</td>
                  <td>
                    {esc('Exploitation').length} / {esc('CSM').length}
                  </td>
                  <td>{load === null ? '—' : <LoadBar ratio={load} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">Cliquez sur un compteur pour ouvrir la liste des tickets du client. Pour PRIMAGAZ, aucun indicateur n’est calculé tant que l’outil ITSM n’est pas renseigné.</p>
    </section>
  );
}

export function ExploitationCockpit({ views, role, now, onBack, onOpenTicket }: Common & { onOpenTicket: (clientId: ExternalClientId, ticketId: string) => void }) {
  const s = serviceSummary(views, 'Exploitation', now);
  return (
    <section className="xc" aria-label="Cockpit Exploitation">
      <div className="xc-head">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Carte 3D
        </button>
        <div>
          <b>Exploitation — service interne</b>
          <span>
            {exploitationTeam.length} collaborateurs sur 3 sites · {s.open.length} escalade(s) en cours · actualisé {fmtDateTime(now)} · indicateurs non fusionnés avec le Helpdesk
          </span>
        </div>
      </div>
      <h3>Contrôles quotidiens (démonstration)</h3>
      <div className="xc-kpis">
        {supervisionChecks.map((c) => (
          <div key={c.label} className={`xc-kpi ${c.ok === c.total ? 'ok' : 'warn'}`}>
            <small>{c.label}</small>
            <strong>
              {c.ok}/{c.total}
            </strong>
          </div>
        ))}
      </div>
      <ExploitationPanel views={views} trips={[]} role={role} now={now} onOpenTicket={onOpenTicket} onOpenClient={() => undefined} />
    </section>
  );
}
