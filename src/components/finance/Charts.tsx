// Graphiques SVG légers (sans dépendance) : barres revenus / coûts et courbe du résultat.
import type { MonthResult } from '../../finance/budget';
import { monthLabel } from '../../finance/budget';

const k = (n: number) => `${Math.round(n / 1000).toLocaleString('fr-FR')} k€`;

export function ProfitChart({ rows, projected }: { rows: MonthResult[]; projected: boolean }) {
  const W = 760;
  const H = 230;
  const pad = { l: 52, r: 10, t: 12, b: 34 };
  const rev = (r: MonthResult) => (projected ? r.projectedRevenue : r.revenue.validated);
  const max = Math.max(1, ...rows.flatMap((r) => [rev(r), r.cost]));
  const min = Math.min(0, ...rows.filter((r) => projected || r.closed).map((r) => (projected ? r.projectedResult : r.result)));
  const y = (v: number) => pad.t + ((max - v) / (max - min)) * (H - pad.t - pad.b);
  const step = (W - pad.l - pad.r) / rows.length;
  const bw = Math.min(18, step / 3);
  // Vue « validé » : la courbe du résultat s'arrête au dernier mois clos (les mois non clos ne sont pas des pertes).
  const shown = rows.map((r, i) => ({ r, i })).filter(({ r }) => projected || r.closed);
  const res = shown.map(({ r, i }) => `${pad.l + step * i + step / 2},${y(projected ? r.projectedResult : r.result)}`).join(' ');
  const ticks = [min, (max + min) / 2, max];
  return (
    <svg className="fin-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenus, coûts et résultat analytique par mois">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e3e9f1" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#6c7f98">
            {k(t)}
          </text>
        </g>
      ))}
      <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="#9fb0c6" />
      {rows.map((r, i) => {
        const x = pad.l + step * i + step / 2;
        const future = !r.closed && !r.current;
        return (
          <g key={r.month}>
            <rect x={x - bw - 1} y={y(rev(r))} width={bw} height={Math.max(0, y(0) - y(rev(r)))} fill={future || (r.current && projected) ? '#b9d0f3' : '#3176e9'}>
              <title>{`${monthLabel(r.month)} — revenus ${k(rev(r))}`}</title>
            </rect>
            <rect x={x + 1} y={y(r.cost)} width={bw} height={Math.max(0, y(0) - y(r.cost))} fill={future ? '#f6c9a8' : '#ea7a2f'}>
              <title>{`${monthLabel(r.month)} — coûts ${k(r.cost)}`}</title>
            </rect>
            <text x={x} y={H - 14} textAnchor="middle" fontSize="10" fill="#546a84">
              {monthLabel(r.month)}
            </text>
            <text x={x} y={H - 3} textAnchor="middle" fontSize="8.5" fill="#7b8ca3">
              {r.closed ? 'clos' : r.current ? 'en cours' : 'prévision'}
            </text>
          </g>
        );
      })}
      <polyline points={res} fill="none" stroke="#16a34a" strokeWidth="2.5" />
      {shown.map(({ r, i }) => (
        <circle key={r.month} cx={pad.l + step * i + step / 2} cy={y(projected ? r.projectedResult : r.result)} r="3" fill={r.closed ? '#16a34a' : '#fff'} stroke="#16a34a" strokeWidth="1.5">
          <title>{`${monthLabel(r.month)} — résultat ${r.closed ? '' : 'projeté (non arrêté) '}${k(projected ? r.projectedResult : r.result)}`}</title>
        </circle>
      ))}
    </svg>
  );
}

export function Gauge({ value, max, label }: { value: number; max: number; label: string }) {
  const ratio = max ? Math.min(1, value / max) : 0;
  const tone = ratio >= 0.95 ? 'bad' : ratio >= 0.8 ? 'warn' : 'ok';
  return (
    <div className={`fin-gauge ${tone}`} role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <i style={{ width: `${ratio * 100}%` }} />
      <span>
        {label} : {Math.round(ratio * 100)} %
      </span>
    </div>
  );
}
