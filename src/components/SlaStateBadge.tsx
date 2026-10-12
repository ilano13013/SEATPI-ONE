import { SLA_STATE_LABEL, type SlaState } from '../telephony/qlik';

const STATE_TONE: Record<SlaState, string> = { conforme: 'ok', 'non conforme': 'bad', 'non évalué': 'muted', 'données indisponibles': 'warn' };
const STATE_MARK: Record<SlaState, string> = { conforme: '✓', 'non conforme': '✗', 'non évalué': '○', 'données indisponibles': '?' };

/** État textuel (jamais transmis par la seule couleur). */
export function SlaStateBadge({ state }: { state: SlaState }) {
  return (
    <span className={`badge ${STATE_TONE[state]}`}>
      <span aria-hidden>{STATE_MARK[state]} </span>
      {SLA_STATE_LABEL[state]}
    </span>
  );
}
