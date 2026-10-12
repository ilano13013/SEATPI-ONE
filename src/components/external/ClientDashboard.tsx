import { useMemo, useState } from 'react';
import type { ClientView } from '../../external/derive';
import { agingBuckets, computeKpis, periods, receivedPerDay, resolvedIn, type PeriodKey } from '../../external/metrics';
import { CAPACITY_HORIZON_DAYS, EFFORT_H } from '../../external/workload';
import { HealthDot, LoadBar, healthLabel, fmtDateTime } from './common';

interface Props {
  view: ClientView;
  now: number;
  onFilter: (label: string, ids: string[]) => void;
}

export function ClientDashboard({ view, now, onFilter }: Props) {
  const [periodKey, setPeriodKey] = useState<PeriodKey>('week');
  const p = periods(now)[periodKey];
  const kpis = useMemo(
    () => computeKpis(view.tickets, { now, period: p, clients: { [view.client.id]: view.client }, headcount: view.techs.length }),
    // p dérive de now et periodKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, now, periodKey],
  );
  const days = useMemo(() => receivedPerDay(view.tickets, now, 10), [view.tickets, now]);
  const aging = useMemo(() => agingBuckets(view.tickets, now), [view.tickets, now]);
  const maxDay = Math.max(1, ...days.map((d) => d.ids.length));
  const maxAging = Math.max(1, ...aging.map((a) => a.ids.length));

  const group = (g: 'Tickets' | 'Activité') => (
    <div className="xc-kpis">
      {kpis
        .filter((k) => k.group === g)
        .map((k) => (
          <button key={k.id} className={`xc-kpi ${k.tone ?? ''}`} title={k.definition} onClick={() => onFilter(`${k.label} — ${p.label}`, k.ticketIds)}>
            <small>{k.label}</small>
            <strong>{k.display}</strong>
            <em>{k.ticketIds.length} ticket(s)</em>
          </button>
        ))}
    </div>
  );

  return (
    <div className="xc-dashboard">
      <div className={`xc-health ${view.health}`}>
        <HealthDot health={view.health} />
        <div>
          <b>{healthLabel[view.health]}</b>
          <span>{view.reasons.slice(0, 3).join(' · ')}</span>
        </div>
        <small>
          Données synchronisées le {fmtDateTime(view.connector.lastSuccessAt)} ({view.client.tool})
        </small>
      </div>

      <div className="xc-periodbar">
        <span>Période :</span>
        {(['today', 'week', 'prevWeek'] as PeriodKey[]).map((k) => (
          <button key={k} className={periodKey === k ? 'active' : ''} aria-pressed={periodKey === k} onClick={() => setPeriodKey(k)}>
            {periods(now)[k].label}
          </button>
        ))}
      </div>

      <h3>Tickets</h3>
      {group('Tickets')}
      <h3>Activité</h3>
      {group('Activité')}

      <div className="xc-charts">
        <section>
          <h4>Tickets reçus par jour</h4>
          <div className="xc-bars" role="list">
            {days.map((d) => (
              <button key={d.day} role="listitem" onClick={() => onFilter(`Reçus le ${d.label}`, d.ids)} title={`${d.ids.length} ticket(s) reçus`}>
                <i style={{ height: `${(d.ids.length / maxDay) * 100}%` }} />
                <b>{d.ids.length}</b>
                <small>{d.label}</small>
              </button>
            ))}
          </div>
        </section>
        <section>
          <h4>Ancienneté du backlog</h4>
          <div className="xc-hbars">
            {aging.map((a) => (
              <button key={a.label} onClick={() => onFilter(`Backlog — ancienneté ${a.label}`, a.ids)}>
                <span>{a.label}</span>
                <i style={{ width: `${(a.ids.length / maxAging) * 100}%` }} />
                <b>{a.ids.length}</b>
              </button>
            ))}
          </div>
        </section>
        <section>
          <h4>Charge des équipes</h4>
          {view.loads.map((l) => {
            const resolved = view.tickets.filter((t) => t.teamId === l.team.id && resolvedIn(t, p)).length;
            return (
              <button key={l.team.id} className={`xc-teamload ${l.level}`} onClick={() => onFilter(`${l.team.name} — tickets ouverts`, l.openIds)}>
                <span>
                  <b>{l.team.name}</b>
                  <small>
                    {l.team.service} · {l.presentToday}/{l.techs.length} présents · {resolved} résolus sur la période ({(resolved / Math.max(1, l.techs.length)).toFixed(1).replace('.', ',')} / tech.)
                  </small>
                </span>
                <LoadBar ratio={l.ratio} />
                <small>
                  {l.effortH} h de reste à faire / {l.capacityH} h disponibles
                </small>
              </button>
            );
          })}
          <p className="hint">
            Charge = effort estimé des tickets ouverts actionnables (P1 {EFFORT_H.P1} h, P2 {EFFORT_H.P2} h, P3 {EFFORT_H.P3} h, P4 {EFFORT_H.P4} h) ÷ heures disponibles sur {CAPACITY_HORIZON_DAYS} jours ouvrés (planning, disponibilité déclarée, congés).
          </p>
        </section>
        <section>
          <h4>Alertes</h4>
          {view.alerts.length === 0 && <p className="hint">Aucune alerte.</p>}
          {view.alerts.map((a) => (
            <button key={a.id} className={`xc-alert ${a.severity}`} onClick={() => onFilter(a.message, a.ticketIds)}>
              <b>{a.kind}</b>
              <span>{a.message}</span>
            </button>
          ))}
        </section>
      </div>

      <details className="xc-defs">
        <summary>Définitions des indicateurs</summary>
        <p>Périodes en heure locale : début inclus, fin exclue. Les délais sont exprimés en temps ouvré selon le calendrier contractuel du client ({view.client.calendar.label}).</p>
        <dl>
          {kpis.map((k) => (
            <div key={k.id}>
              <dt>{k.label}</dt>
              <dd>{k.definition}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
