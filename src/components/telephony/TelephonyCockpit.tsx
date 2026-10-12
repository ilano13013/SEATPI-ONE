// Tableau de bord téléphonique : SLA décroché (QlikView, feuille « Qlik SLA décrocher »).
import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ANSWER_DEFINITION, aggregate, clientSla, compare, filterRows, lastMonths, poleOfQueue, QLIK_OTHER_SHEET, QLIK_QUEUES, QLIK_SOURCE_SHEET, SLA_STATE_DEFINITIONS, SLA_STATE_LABEL, slaState, type QlikFilters, type QlikRow } from '../../telephony/qlik';
import { SlaStateBadge as StateBadge } from '../SlaStateBadge';
import { clientRecord, clientRegistry, POLE_GROUP_LABEL, type PoleGroup } from '../../config/itsm';
import { monthLabel } from '../../finance/budget';

interface Props {
  rows: QlikRow[];
  now: number;
  /** Objectifs contractuels par client (Administration → Paramètres SLA) ; absent = non renseigné. */
  objectives: Record<string, number | null>;
  demoObjectives: boolean;
  onOpenSettings?: () => void;
  onBack: () => void;
}

type PeriodChoice = 'mois' | 'dernier' | '3m' | '12m';

const pct = (n: number | null) => (n === null ? '—' : `${n.toLocaleString('fr-FR')} %`);

export function TelephonyCockpit({ rows, now, objectives, demoObjectives, onOpenSettings, onBack }: Props) {
  const months = lastMonths(now);
  const [pole, setPole] = useState<PoleGroup | ''>('');
  const [client, setClient] = useState('');
  const [queue, setQueue] = useState('');
  const [period, setPeriod] = useState<PeriodChoice>('dernier');
  const periodMonths = period === 'mois' ? months.slice(-1) : period === 'dernier' ? months.slice(-2, -1) : period === '3m' ? months.slice(-4, -1) : months;
  const f: QlikFilters = { pole, client, queue, months: periodMonths };
  const filtered = useMemo(() => filterRows(rows, f), [rows, pole, client, queue, period]); // eslint-disable-line react-hooks/exhaustive-deps
  const global = aggregate(filtered);
  const telClients = clientRegistry.filter((c) => clientRecord(c.id)?.pole && (!pole || clientRecord(c.id)?.pole === pole));
  const perClient = telClients.map((c) => ({ c, s: clientSla(rows, c.id, periodMonths), obj: objectives[c.id] ?? null }));
  const history = months.map((m) => ({ m, agg: aggregate(filterRows(rows, { ...f, months: [m] })) }));
  const lastClosed = months[months.length - 2];
  // Évaluation du dernier mois clos : clients évaluables (objectif renseigné et SLA calculable) séparés des autres.
  const evaluation = telClients.map((c) => {
    const rate = clientSla(rows, c.id, [lastClosed]).agg.rate;
    return { c, cmp: compare(rate, objectives[c.id]), state: slaState(rate, objectives[c.id]) };
  });
  const alerts = evaluation.filter((a) => a.state === 'non conforme');
  const evaluable = evaluation.filter((a) => a.state === 'conforme' || a.state === 'non conforme');
  const noObjective = evaluation.filter((a) => a.state === 'non évalué');
  const noData = evaluation.filter((a) => a.state === 'données indisponibles');
  const max = 100;
  const min = Math.min(80, ...history.map((h) => h.agg.rate ?? 100)) - 2;

  return (
    <section className="xc tel" aria-label="SLA décroché">
      <div className="xc-head">
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={14} /> Carte des sites
        </button>
        <div>
          <small className="crumb">Téléphonie › Statistiques QlikView</small>
          <b>SLA décroché</b>
          <span>
            Source : extraction FICTIVE de la feuille « {QLIK_SOURCE_SHEET} » (démonstration, aucune connexion à QlikView) · « {QLIK_OTHER_SHEET} » identifiée, non exploitée pour l’instant
          </span>
        </div>
      </div>
      <details className="defs">
        <summary>Définitions des états SLA</summary>
        <ul>
          {SLA_STATE_DEFINITIONS.map(([k, d]) => (
            <li key={k}>
              <b>{SLA_STATE_LABEL[k]}</b> : {d}
            </li>
          ))}
        </ul>
      </details>
      <p className="fin-warning">{ANSWER_DEFINITION} Agrégation par les volumes (jamais par moyenne des pourcentages). Indicateur téléphonique distinct des SLA de tickets N2.</p>

      <div className="xc-toolbar">
        <select aria-label="Pôle" value={pole} onChange={(e) => (setPole(e.target.value as PoleGroup | ''), setClient(''), setQueue(''))}>
          <option value="">Tous les pôles</option>
          <option value="multi">Pôle Multi</option>
          <option value="dedie">Pôle Dédié</option>
        </select>
        <select aria-label="Client" value={client} onChange={(e) => setClient(e.target.value)}>
          <option value="">Tous les clients</option>
          {telClients.map((c) => (
            <option key={c.id} value={c.id}>
              {clientRecord(c.id)?.name}
            </option>
          ))}
        </select>
        <select aria-label="File d’attente" value={queue} onChange={(e) => setQueue(e.target.value)}>
          <option value="">Toutes les files</option>
          {QLIK_QUEUES.filter((q) => !pole || poleOfQueue(q) === pole).map((q) => (
            <option key={q.id} value={q.id}>
              {q.name}
            </option>
          ))}
        </select>
        <select aria-label="Période" value={period} onChange={(e) => setPeriod(e.target.value as PeriodChoice)}>
          <option value="dernier">Dernier mois clos ({monthLabel(lastClosed)})</option>
          <option value="mois">Mois en cours (partiel)</option>
          <option value="3m">3 derniers mois clos</option>
          <option value="12m">12 derniers mois</option>
        </select>
      </div>

      <div className="xc-kpis">
        <div className="xc-kpi" aria-label="SLA décroché global">
          <small>SLA décroché global (périmètre filtré)</small>
          <strong>{global.rate === null ? 'Indisponible' : pct(global.rate)}</strong>
          <em>{global.unavailable ?? `${global.answeredInTarget.toLocaleString('fr-FR')} décrochés dans le délai / ${global.offered.toLocaleString('fr-FR')} présentés`}</em>
        </div>
        <div className="xc-kpi">
          <small>Objectif contractuel global</small>
          <strong>Non défini</strong>
          <em>les objectifs sont fixés par client</em>
        </div>
        <div className={`xc-kpi ${alerts.length ? 'bad' : evaluable.length ? 'ok' : ''}`} aria-label="Évaluation du dernier mois clos">
          <small>Évaluation ({monthLabel(lastClosed)})</small>
          {evaluable.length === 0 ? (
            <>
              <strong>Non évalué</strong>
              <em>Évaluation indisponible — objectif contractuel à renseigner</em>
            </>
          ) : (
            <>
              <strong>
                {alerts.length} non conforme{alerts.length > 1 ? 's' : ''} / {evaluable.length} évalué{evaluable.length > 1 ? 's' : ''}
              </strong>
              <em>clients avec objectif renseigné et SLA calculable</em>
            </>
          )}
        </div>
        <div className="xc-kpi">
          <small>Non évaluables</small>
          <strong>{noObjective.length + noData.length}</strong>
          <em>
            {noObjective.length} sans objectif · {noData.length} données indisponibles
          </em>
        </div>
      </div>
      {alerts.length > 0 && (
        <ul className="pdg-risks">
          {alerts.map((a) => (
            <li key={a.c.id}>
              <span className="xc-alert critical">
                {clientRecord(a.c.id)?.name} : SLA décroché {monthLabel(lastClosed)} sous l’objectif ({a.cmp.gap?.toLocaleString('fr-FR')} pt)
              </span>
            </li>
          ))}
        </ul>
      )}
      {demoObjectives && <p className="hint">Objectifs actuellement chargés : valeurs de DÉMONSTRATION (fictives).</p>}

      <h3>SLA décroché par client</h3>
      <div className="xc-tablewrap">
        <table className="xc-table compact">
          <thead>
            <tr>
              <th>Client</th>
              <th>Pôle</th>
              <th>Appels présentés</th>
              <th>Décrochés dans le délai</th>
              <th>SLA décroché</th>
              <th>Objectif contractuel</th>
              <th>Écart</th>
              <th>État</th>
            </tr>
          </thead>
          <tbody>
            {perClient.map(({ c, s, obj }) => {
              const cmp = compare(s.agg.rate, obj);
              return (
                <tr key={c.id}>
                  <td>{clientRecord(c.id)?.name}</td>
                  <td>{POLE_GROUP_LABEL[clientRecord(c.id)!.pole!]}</td>
                  <td>{s.agg.rate === null && s.agg.offered === 0 ? '—' : s.agg.offered.toLocaleString('fr-FR')}</td>
                  <td>{s.agg.rate === null && s.agg.offered === 0 ? '—' : s.agg.answeredInTarget.toLocaleString('fr-FR')}</td>
                  <td>{s.agg.rate === null ? <em className="nr" title={s.agg.unavailable ?? ''}>Calcul indisponible</em> : pct(s.agg.rate)}</td>
                  <td>
                    {obj === null ? (
                      <button className="link" onClick={onOpenSettings}>
                        Non renseigné
                      </button>
                    ) : (
                      pct(obj)
                    )}
                  </td>
                  <td className={cmp.breach ? 'xc-warn' : ''}>{cmp.gap === null ? '—' : `${cmp.gap > 0 ? '+' : ''}${cmp.gap.toLocaleString('fr-FR')} pt`}</td>
                  <td>
                    <StateBadge state={slaState(s.agg.rate, obj)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">Clients du Pôle Multi : la hotline est partagée entre plusieurs clients ; l’extraction ne permet pas de calculer un SLA par client (calcul indisponible plutôt qu’estimé).</p>

      <h3>Historique mensuel et évolution (périmètre filtré)</h3>
      <div className="hd-evo" role="img" aria-label="Évolution mensuelle du SLA décroché">
        {history.map((h) => (
          <div key={h.m}>
            <div className="bars">
              {h.agg.rate === null ? <i className="na" style={{ height: '8%' }} title="Calcul indisponible" /> : <i className="r" style={{ height: `${((h.agg.rate - min) / (max - min)) * 100}%` }} title={pct(h.agg.rate)} />}
            </div>
            <small>{monthLabel(h.m)}</small>
            <small>{h.agg.rate === null ? 'n.d.' : pct(h.agg.rate)}</small>
          </div>
        ))}
      </div>
      <div className="xc-tablewrap">
        <table className="xc-table compact">
          <thead>
            <tr>
              <th>Mois</th>
              <th>Appels présentés</th>
              <th>Décrochés dans le délai</th>
              <th>SLA décroché</th>
              <th>Évolution</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h, i) => {
              const prev = history[i - 1]?.agg.rate ?? null;
              const delta = h.agg.rate !== null && prev !== null ? Math.round((h.agg.rate - prev) * 10) / 10 : null;
              return (
                <tr key={h.m}>
                  <td>
                    {monthLabel(h.m)}
                    {i === history.length - 1 ? ' (partiel)' : ''}
                  </td>
                  <td>
                    {h.agg.offered.toLocaleString('fr-FR')}
                    {h.agg.missing.length > 0 && <small className="nr"> (files complètes uniquement)</small>}
                  </td>
                  <td>
                    {h.agg.answeredInTarget.toLocaleString('fr-FR')}
                    {h.agg.missing.length > 0 && <small className="nr"> (files complètes uniquement)</small>}
                  </td>
                  <td>{h.agg.rate === null ? <em className="nr">{h.agg.unavailable}</em> : pct(h.agg.rate)}</td>
                  <td>{delta === null ? '—' : `${delta > 0 ? '+' : ''}${delta.toLocaleString('fr-FR')} pt`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

