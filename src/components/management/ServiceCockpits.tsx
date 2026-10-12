// Cockpits MCO N2 et Exploitation : indicateurs propres à chaque service,
// jamais additionnés à ceux du Helpdesk N1.
import { ArrowLeft } from 'lucide-react';
import { SlaStateBadge } from '../SlaStateBadge';
import { slaState } from '../../telephony/qlik';
import type { ClientView } from '../../external/derive';
import type { ExternalClientId } from '../../external/types';
import type { ExternalNav } from '../external/common';
import { HealthDot, LoadBar, fmtDateTime } from '../external/common';
import { formatMinutesOuvrees, isOpen, periods, slaRate } from '../../external/metrics';
import { n2SlaSplit } from '../../external/n2sla';
import { useState } from 'react';
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

export function McoCockpit({ views, now, onBack, onOpen, objectives, onOpenBudget }: Common & { onOpen: (nav: ExternalNav) => void; onOpenBudget?: () => void; objectives: { takeCharge: Record<string, number | null>; resolution: Record<string, number | null> } }) {
  const week = periods(now).week;
  const [periodKey, setPeriodKey] = useState<'week' | 'prevWeek'>('week');
  const period = periods(now)[periodKey];
  return (
    <section className="xc" aria-label="Cockpit MCO N2">
      <div className="xc-head">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Carte des sites
        </button>
        <div>
          <b>MCO / Support N2 — équipes chez les clients</b>
          <span>INVIVO, PRIMAGAZ, MONEXT · indicateurs N2 distincts du Helpdesk N1 · données de démonstration</span>
        </div>
        {onOpenBudget && (
          <button className="ghost" onClick={onOpenBudget}>
            Budget & Rentabilité MCO N2
          </button>
        )}
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
              <th>SLA résolution (semaine)</th>
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
      <p className="hint">Cliquez sur un compteur pour ouvrir la liste des tickets du client.</p>

      <h3>SLA des tickets N2 — deux indicateurs distincts</h3>
      <p className="hint">
        Calculés à partir des délais contractuels de chaque client (matrice par priorité, temps ouvré) et des horodatages de l’ITSM. Objectifs contractuels saisis dans Administration → Paramètres SLA (non renseignés = aucun écart calculé). Sans rapport avec le SLA décroché téléphonique.
      </p>
      <div className="xc-periodbar">
        Période :
        <button className={periodKey === 'week' ? 'active' : ''} onClick={() => setPeriodKey('week')}>
          Semaine en cours
        </button>
        <button className={periodKey === 'prevWeek' ? 'active' : ''} onClick={() => setPeriodKey('prevWeek')}>
          Semaine précédente
        </button>
      </div>
      {(['takeCharge', 'resolution'] as const).map((kind) => (
        <div key={kind} className="xc-tablewrap n2-sla" aria-label={kind === 'takeCharge' ? 'SLA de prise en charge' : 'SLA de résolution'} role="region">
          <table className="xc-table compact">
            <caption>{kind === 'takeCharge' ? 'SLA de prise en charge' : 'SLA de résolution'}</caption>
            <thead>
              <tr>
                <th>Client</th>
                <th>Objectif contractuel</th>
                <th>Résultat</th>
                <th>Écart</th>
                <th>Prochaine échéance</th>
                <th>Conformes</th>
                <th>Hors SLA</th>
                <th>Risques de dépassement</th>
                <th>État</th>
              </tr>
            </thead>
            <tbody>
              {views.map((v) => {
                if (!v.client.tool)
                  return (
                    <tr key={v.client.id}>
                      <td>{v.client.name}</td>
                      <td colSpan={8}>
                        <em className="nr">{ITSM_NOT_SET}</em>
                      </td>
                    </tr>
                  );
                const part = n2SlaSplit(v.tickets, period, now)[kind];
                const obj = (kind === 'takeCharge' ? objectives.takeCharge : objectives.resolution)[v.client.id] ?? null;
                const gap = obj !== null && part.rate !== null ? Math.round((part.rate - obj) * 10) / 10 : null;
                const go = (label: string, ids: string[]) => onOpen({ scope: v.client.id as ExternalClientId, tab: 'tickets', filter: { label: `${kind === 'takeCharge' ? 'Prise en charge' : 'Résolution'} — ${label}`, ids } });
                return (
                  <tr key={v.client.id}>
                    <td>{v.client.name}</td>
                    <td>{obj === null ? <em className="nr">Non renseigné</em> : `${obj} %`}</td>
                    <td>{part.rate === null ? '—' : `${part.rate.toLocaleString('fr-FR')} %`}</td>
                    <td className={gap !== null && gap < 0 ? 'xc-warn' : ''}>{gap === null ? '—' : `${gap > 0 ? '+' : ''}${gap.toLocaleString('fr-FR')} pt`}</td>
                    <td>{part.nextDue ? fmtDateTime(part.nextDue) : '—'}</td>
                    <td>
                      <button className="link" onClick={() => go('conformes', part.compliant)}>
                        {part.compliant.length}
                      </button>
                    </td>
                    <td>
                      <button className="link" onClick={() => go('hors SLA', part.breached)}>
                        {part.breached.length}
                      </button>
                    </td>
                    <td>
                      <button className="link" onClick={() => go('risques de dépassement', part.atRisk)}>
                        {part.atRisk.length}
                      </button>
                    </td>
                    <td>
                      <SlaStateBadge state={slaState(part.rate, obj)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      <h4>Délais contractuels par priorité (démonstration, à confirmer par contrat)</h4>
      <table className="xc-table compact">
        <thead>
          <tr>
            <th>Client</th>
            {(['P1', 'P2', 'P3', 'P4'] as const).map((p) => (
              <th key={p}>{p} : prise en charge / résolution</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {views.map((v) => (
            <tr key={v.client.id}>
              <td>
                {v.client.name} <small className="hint">({v.client.calendar.label})</small>
              </td>
              {(['P1', 'P2', 'P3', 'P4'] as const).map((p) => (
                <td key={p}>
                  {formatMinutesOuvrees(v.client.sla[p].takeChargeMin)} / {formatMinutesOuvrees(v.client.sla[p].resolutionMin)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

    </section>
  );
}

export const CHECKS_DETAIL_NOTE = 'Détail des contrôles en échec : indisponible dans cette démonstration (outil de supervision non connecté) — compteurs fictifs.';

export function ExploitationCockpit({ views, role, now, onBack, onOpenTicket }: Common & { onOpenTicket: (clientId: ExternalClientId, ticketId: string) => void }) {
  const s = serviceSummary(views, 'Exploitation', now);
  return (
    <section className="xc" aria-label="Cockpit Exploitation">
      <div className="xc-head">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Carte des sites
        </button>
        <div>
          <b>Exploitation — service interne</b>
          <span>
            {exploitationTeam.length} collaborateurs sur 3 sites · {s.open.length} escalade(s) en cours · actualisé {fmtDateTime(now)} · indicateurs non fusionnés avec le Helpdesk
          </span>
        </div>
      </div>
      <h3>Contrôles du jour (démonstration)</h3>
      <div className="xc-kpis">
        {supervisionChecks.map((c) => (
          <div key={c.label} className={`xc-kpi ${c.ok === c.total ? 'ok' : 'warn'}`}>
            <small>{c.label}</small>
            <strong>
              {c.ok}/{c.total}
            </strong>
            <em>{c.ok === c.total ? 'tous conformes' : `${c.total - c.ok} en échec`}</em>
          </div>
        ))}
      </div>
      <p className="hint">{CHECKS_DETAIL_NOTE}</p>
      <ExploitationPanel views={views} trips={[]} role={role} now={now} onOpenTicket={onOpenTicket} onOpenClient={() => undefined} showChecks={false} />
    </section>
  );
}
