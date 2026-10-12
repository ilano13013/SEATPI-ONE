import { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import type { ExternalClientId } from '../../external/types';
import type { ClientView } from '../../external/derive';
import type { ExternalState } from '../../external/useExternal';
import { periods, type PeriodKey } from '../../external/metrics';
import { buildClientReport, consolidateReports, reportToMarkdown, type WeeklyReport as Report } from '../../external/report';
import { downloadText, eur } from './common';

interface Props {
  views: ClientView[];
  state: ExternalState;
  showFinance: boolean;
  /** Un seul client, ou consolidation département si absent. */
  clientId?: ExternalClientId;
}

export function WeeklyReport({ views, state, showFinance, clientId }: Props) {
  const [periodKey, setPeriodKey] = useState<Extract<PeriodKey, 'week' | 'prevWeek'>>('prevWeek');
  const [extra, setExtra] = useState('');
  const p = periods(state.now)[periodKey];
  const { report, parts } = useMemo(() => {
    const parts = views.map((v) => buildClientReport(v.client, v.tickets, v.techs, state.objectives[v.client.id], p, state.now));
    const report = clientId ? parts.find((r) => r.scope === clientId)! : consolidateReports(parts);
    return { report, parts };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [views, state.objectives, state.now, periodKey, clientId]);

  const md = () => reportToMarkdown(report, showFinance, extra);

  return (
    <div className="xc-report">
      <div className="xc-toolbar noprint">
        <div className="segmented" role="radiogroup" aria-label="Période du rapport">
          {(['prevWeek', 'week'] as const).map((k) => (
            <button key={k} role="radio" aria-checked={periodKey === k} className={periodKey === k ? 'active' : ''} onClick={() => setPeriodKey(k)}>
              {k === 'prevWeek' ? 'Semaine précédente' : 'Semaine en cours'}
            </button>
          ))}
        </div>
        <button className="ghost" onClick={() => downloadText(`rapport-${report.scope}-${new Date(p.start).toISOString().slice(0, 10)}.md`, md())}>
          <Download size={13} /> Télécharger (.md)
        </button>
        <button className="ghost" onClick={() => window.print()}>
          <Printer size={13} /> Imprimer / PDF
        </button>
      </div>
      <article className="xc-report-doc">
        <h2>Rapport hebdomadaire — {report.label}</h2>
        <p className="hint">
          {p.label} · données fictives · calculs identiques au cockpit (mêmes définitions et mêmes données).
        </p>
        <div className="kpis xc-report-kpis">
          <div>
            <small>Tickets reçus</small>
            <strong>{report.received}</strong>
          </div>
          <div>
            <small>Tickets résolus</small>
            <strong>{report.resolved}</strong>
          </div>
          <div>
            <small>Backlog début → fin</small>
            <strong>
              {report.backlogStart} → {report.backlogEnd}
            </strong>
          </div>
          <div>
            <small>Respect des SLA</small>
            <strong>{report.slaRate === null ? '—' : `${report.slaRate.toLocaleString('fr-FR')} %`}</strong>
          </div>
          <div>
            <small>Effectif mobilisé</small>
            <strong>{report.headcount}</strong>
          </div>
          <div>
            <small>Heures réalisées</small>
            <strong>{report.finance.hours.toLocaleString('fr-FR')} h</strong>
          </div>
          {showFinance && (
            <>
              <div>
                <small>Coûts / budget</small>
                <strong>
                  {eur(report.finance.cost)} / {eur(report.finance.budget)}
                </strong>
              </div>
              <div>
                <small>Rentabilité</small>
                <strong>{report.finance.marginRate === null ? '—' : `${report.finance.marginRate.toLocaleString('fr-FR')} %`}</strong>
              </div>
            </>
          )}
        </div>

        {!clientId && (
          <section>
            <h3>Synthèse par client</h3>
            <table className="xc-table compact">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Reçus</th>
                  <th>Résolus</th>
                  <th>Backlog début → fin</th>
                  <th>SLA</th>
                  <th>Objectifs non atteints</th>
                  {showFinance && <th>Rentabilité</th>}
                </tr>
              </thead>
              <tbody>
                {parts.map((r: Report) => (
                  <tr key={r.scope}>
                    <td>{r.label}</td>
                    <td>{r.received}</td>
                    <td>{r.resolved}</td>
                    <td>
                      {r.backlogStart} → {r.backlogEnd}
                    </td>
                    <td>{r.slaRate === null ? '—' : `${r.slaRate.toLocaleString('fr-FR')} %`}</td>
                    <td>{r.objectivesMissed.length}</td>
                    {showFinance && <td>{r.finance.marginRate === null ? '—' : `${r.finance.marginRate.toLocaleString('fr-FR')} %`}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section>
          <h3>Incidents majeurs (P1)</h3>
          {report.majorIncidents.length === 0 ? (
            <p className="hint">Aucun incident majeur sur la période.</p>
          ) : (
            <ul className="xc-mini">
              {report.majorIncidents.map((i) => (
                <li key={i.id}>
                  <b>{i.id}</b> ({i.client}) {i.title} — {i.status}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3>Activités réalisées</h3>
          <div className="xc-flows">
            {report.activities.map((a) => (
              <span key={a.category} className="badge muted">
                {a.category} : {a.count}
              </span>
            ))}
          </div>
        </section>
        <div className="xc-detail-grid">
          <section>
            <h3>Objectifs atteints ou en bonne voie</h3>
            <ul className="xc-mini">
              {report.objectivesMet.map((o) => (
                <li key={o.client + o.key}>
                  {!clientId && <b>{o.client} — </b>}
                  {o.label} : {o.actual ?? '—'} (cible {o.target})
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3>Objectifs non atteints ou à risque</h3>
            <ul className="xc-mini">
              {report.objectivesMissed.length === 0 && <li className="hint">Aucun.</li>}
              {report.objectivesMissed.map((o) => (
                <li key={o.client + o.key}>
                  {!clientId && <b>{o.client} — </b>}
                  {o.label} : {o.actual ?? '—'} (cible {o.target})
                </li>
              ))}
            </ul>
          </section>
        </div>
        <section>
          <h3>Actions correctives</h3>
          <ul className="xc-mini">
            {report.correctiveActions.length === 0 && <li className="hint">Aucune action requise par les objectifs.</li>}
            {report.correctiveActions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <label className="field block noprint">
            <span>Actions complémentaires (une par ligne)</span>
            <textarea rows={3} value={extra} onChange={(e) => setExtra(e.target.value)} />
          </label>
          {extra.trim() && (
            <ul className="xc-mini printonly">
              {extra.split('\n').filter(Boolean).map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
        </section>
      </article>
    </div>
  );
}
