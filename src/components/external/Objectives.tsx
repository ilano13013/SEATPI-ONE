import type { ClientView } from '../../external/derive';
import type { ObjectiveConfig } from '../../external/config';
import { OBJECTIVE_META, weekProgress, type ObjectiveRow } from '../../external/objectives';
import { periods } from '../../external/metrics';

interface Props {
  view: ClientView;
  now: number;
  configurable: boolean;
  onChange: (key: keyof ObjectiveConfig, value: number) => void;
  onReset: () => void;
  onFilter: (label: string, ids: string[]) => void;
}

const fmt = (v: number | null, unit: string) => (v === null ? '—' : `${v.toLocaleString('fr-FR')}${unit === '%' ? ' %' : unit === 'h' ? ' h' : unit === 'min' ? ' min' : ''}`);
const statusTone = { atteint: 'ok', 'en bonne voie': 'info', 'à risque': 'warn', 'non atteint': 'bad' } as const;

export function Objectives({ view, now, configurable, onChange, onReset, onFilter }: Props) {
  const progress = Math.round(weekProgress(now, view.client) * 100);
  const table = (kind: 'volume' | 'qualité', title: string) => (
    <section>
      <h3>{title}</h3>
      <div className="xc-tablewrap">
        <table className="xc-table objectives">
          <thead>
            <tr>
              <th>Objectif</th>
              <th>Cible</th>
              <th>Réalisé</th>
              <th>Reste à faire</th>
              <th>Écart</th>
              <th>Tendance (vs sem. préc.)</th>
              <th>Projection fin de semaine</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {view.objectives
              .filter((o) => o.kind === kind)
              .map((o: ObjectiveRow) => (
                <tr key={o.key} onClick={() => onFilter(`Objectif « ${o.label} »`, o.ticketIds)}>
                  <td>
                    <b>{o.label}</b>
                    <small>
                      {o.direction === 'min' ? 'minimum' : 'maximum'} · {OBJECTIVE_META[o.key].help}
                    </small>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {configurable ? (
                      <input
                        type="number"
                        min={0}
                        step={o.unit === '%' || o.unit === 'h' ? 0.5 : 1}
                        value={o.target}
                        onChange={(e) => onChange(o.key, Math.max(0, Number(e.target.value) || 0))}
                        aria-label={`Cible ${o.label}`}
                      />
                    ) : (
                      fmt(o.target, o.unit)
                    )}
                  </td>
                  <td>{fmt(o.actual, o.unit)}</td>
                  <td>{fmt(o.remaining, o.unit)}</td>
                  <td className={o.gap === null ? '' : (o.direction === 'min' ? o.gap >= 0 : o.gap <= 0) ? 'tone-ok' : 'tone-bad'}>
                    {o.gap === null ? '—' : `${o.gap > 0 ? '+' : ''}${fmt(o.gap, o.unit)}`}
                  </td>
                  <td className={o.trendGood === null ? '' : o.trendGood ? 'tone-ok' : 'tone-bad'}>
                    {o.trend === null ? '—' : `${o.trend === 'hausse' ? '↗' : o.trend === 'baisse' ? '↘' : '→'} ${o.trend}`} <small>({fmt(o.previous, o.unit)})</small>
                  </td>
                  <td>{fmt(o.projection, o.unit)}</td>
                  <td>
                    <span className={`badge ${statusTone[o.status]}`}>{o.status}</span>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
  return (
    <div className="xc-objectives">
      <p className="hint">
        {periods(now).week.label} · {progress} % du temps ouvré de la semaine écoulé. Un ticket résolu plusieurs fois dans la semaine n’est compté qu’une fois. Cliquez sur une ligne pour voir les tickets concernés.
        {configurable ? ' Les cibles sont modifiables et enregistrées dans ce navigateur.' : ' Seule la responsable Helpdesk peut modifier les cibles.'}
      </p>
      {table('volume', 'Objectifs de volume')}
      {table('qualité', 'Objectifs de qualité')}
      {configurable && (
        <button className="ghost" onClick={onReset}>
          Revenir aux cibles par défaut
        </button>
      )}
    </div>
  );
}
