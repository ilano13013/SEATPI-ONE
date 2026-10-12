import { describe, expect, it } from 'vitest';
import { clientHealth, type Alert } from './alerts';

const alert = (kind: Alert['kind'], severity: Alert['severity'], n = 1): Alert => ({ id: kind, kind, severity, clientId: 'monext', message: `${n} ticket(s) ${kind}`, ticketIds: Array.from({ length: n }, (_, i) => `T${i}`) });

describe('état d’un site client par dimensions', () => {
  it('un seul ticket hors SLA suffit à sortir de « dans les seuils », avec la raison visible', () => {
    const h = clientHealth([alert('hors SLA', 'warn', 1)]);
    expect(h.health).toBe('orange');
    expect(h.dimensions.find((d) => d.key === 'sla')?.state).toBe('attention');
    expect(h.reasons.join(' ')).toMatch(/SLA : 1 ticket\(s\) hors SLA/);
  });
  it('un objectif qualité à risque est signalé dans la dimension SLA ; un objectif volume dans la charge', () => {
    const h = clientHealth([], [
      { label: 'SLA minimum', kind: 'qualité', status: 'à risque' },
      { label: 'Backlog maximum', kind: 'volume', status: 'non atteint' },
    ]);
    expect(h.dimensions.find((d) => d.key === 'sla')?.reason).toMatch(/SLA minimum/);
    expect(h.dimensions.find((d) => d.key === 'charge')?.reason).toMatch(/Backlog maximum/);
  });
  it('incident critique distinct ; synchronisation dégradée = qualité des données', () => {
    expect(clientHealth([alert('prioritaire non pris en charge', 'critical')]).health).toBe('rouge');
    const d = clientHealth([], [], 'dégradé');
    expect(d.health).toBe('orange');
    expect(d.dimensions.find((x) => x.key === 'donnees')?.state).toBe('attention');
    expect(clientHealth([], [], 'connecté').health).toBe('vert');
  });
});
