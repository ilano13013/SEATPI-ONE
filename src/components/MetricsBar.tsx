import type { Metrics } from '../types';
import { slaTone } from '../lib/format';

export function MetricsBar({ metrics, clientsCount }: { metrics: Metrics; clientsCount: number }) {
  const tone = slaTone(metrics.slaGlobal, metrics.slaTarget);
  return (
    <div className="metrics">
      <div>
        <small>Agents connectés</small>
        <strong>{metrics.agentsConnected}</strong>
        <em>Simulation</em>
      </div>
      <div>
        <small>Appels en attente</small>
        <strong>{metrics.waitingTotal}</strong>
        <em>{clientsCount} clients suivis</em>
      </div>
      <div>
        <small>SLA global</small>
        <strong className={`tone-${tone}`}>{metrics.slaGlobal.toLocaleString('fr-FR')} %</strong>
        <em>Objectif pondéré : {metrics.slaTarget.toLocaleString('fr-FR')} %</em>
      </div>
      <div>
        <small>Agents en pause / repas</small>
        <strong>{metrics.onBreak}</strong>
        <em>États simulés</em>
      </div>
      <div>
        <small>Tickets ouverts</small>
        <strong>{metrics.openTickets}</strong>
        <em>Données fictives</em>
      </div>
    </div>
  );
}
