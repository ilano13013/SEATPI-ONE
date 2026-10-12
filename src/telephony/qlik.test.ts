import { describe, expect, it } from 'vitest';
import { aggregate, clientSla, compare, demoExtraction, filterRows, lastMonths, QLIK_QUEUES, slaState, type QlikRow } from './qlik';
import { n2SlaSplit } from '../external/n2sla';
import { initialExternalState } from '../external/useExternal';
import { periods } from '../external/metrics';

const NOW = new Date(2026, 9, 14, 11).getTime();
const rows = demoExtraction(NOW);
const months = lastMonths(NOW);

describe('SLA décroché (QlikView, démonstration)', () => {
  it('agrège par les volumes, jamais par moyenne simple des pourcentages', () => {
    const r: QlikRow[] = [
      { month: '2026-09', queueId: 'a', offered: 100, answeredInTarget: 50 },
      { month: '2026-09', queueId: 'b', offered: 900, answeredInTarget: 900 },
    ];
    expect(aggregate(r).rate).toBe(95); // (50 + 900) / 1000, et non (50 % + 100 %) / 2 = 75 %
  });
  it('déclare le calcul indisponible si des volumes manquent', () => {
    const a = aggregate(filterRows(rows, { pole: '', client: '', queue: 'q-ortec-n2', months }));
    expect(a.rate).toBeNull();
    expect(a.unavailable).toMatch(/indisponible/);
  });
  it('SLA par client seulement si ses files lui sont dédiées (Pôle Multi : indisponible)', () => {
    expect(clientSla(rows, 'thelem', months.slice(-2, -1)).agg.rate).not.toBeNull();
    expect(clientSla(rows, 'dmb', months.slice(-2, -1)).agg.unavailable).toMatch(/partagée/);
  });
  it('filtres pôle / client / file cohérents', () => {
    const dedie = filterRows(rows, { pole: 'dedie', client: '', queue: '', months: [] });
    expect(new Set(dedie.map((r) => r.queueId))).toEqual(new Set(QLIK_QUEUES.filter((q) => q.clientId).map((q) => q.id)));
    expect(filterRows(rows, { pole: '', client: 'snr', queue: '', months: [] }).every((r) => r.queueId.startsWith('q-multi'))).toBe(true);
  });
  it('aucun seuil inventé : pas d’écart sans objectif renseigné', () => {
    expect(compare(92, null)).toEqual({ objective: null, gap: null, breach: false });
    expect(compare(88, 90)).toEqual({ objective: 90, gap: -2, breach: true });
  });
});

describe('SLA N2 : prise en charge et résolution distincts', () => {
  it('conformes + hors SLA = base du résultat ; deux indicateurs séparés', () => {
    const st = initialExternalState(7, NOW).state;
    const split = n2SlaSplit(st.tickets.invivo, periods(NOW).week, NOW);
    for (const part of [split.takeCharge, split.resolution]) {
      const base = part.compliant.length + (part === split.resolution ? st.tickets.invivo.filter((t) => part.breached.includes(t.id) && t.resolvedAt).length : part.breached.length);
      if (part.rate !== null && base) expect(part.rate).toBe(Math.round((part.compliant.length / base) * 1000) / 10);
    }
    expect(split.takeCharge).not.toEqual(split.resolution);
  });
});

describe('états SLA et données manquantes', () => {
  it('sans objectif : « non évalué », jamais conforme ; sans volumes : « données indisponibles »', () => {
    expect(slaState(97, null)).toBe('non évalué');
    expect(slaState(97, undefined)).toBe('non évalué');
    expect(slaState(null, 90)).toBe('données indisponibles');
    expect(slaState(90, 90)).toBe('conforme');
    expect(slaState(89.9, 90)).toBe('non conforme');
  });
  it('les lignes aux volumes manquants sont identifiées et exclues, sans estimation', () => {
    const rows: QlikRow[] = [
      { month: '2026-01', queueId: 'q-ird-n1', offered: 100, answeredInTarget: 90 },
      { month: '2026-01', queueId: 'q-ortec-n2', offered: null, answeredInTarget: null },
    ];
    const a = aggregate(rows);
    expect(a.rate).toBeNull();
    expect(a.offered).toBe(100);
    expect(a.missing).toEqual([{ queueId: 'q-ortec-n2', queueName: 'Ortec · Support N2', month: '2026-01', fields: ['appels présentés', 'décrochés dans le délai'] }]);
    expect(a.unavailable).toMatch(/Ortec · Support N2/);
  });
});

describe('Pôle Multi commun aux trois sites', () => {
  const rows = demoExtraction(new Date(2026, 9, 12).getTime());
  const months = lastMonths(new Date(2026, 9, 12).getTime()).slice(-4, -1);
  it('vue consolidée = somme des sites, sans double comptage', () => {
    const all = aggregate(filterRows(rows, { pole: 'multi', client: '', queue: '', months }));
    const bySite = (['laciotat', 'montpellier', 'paris'] as const).map((site) => aggregate(filterRows(rows, { pole: 'multi', site, client: '', queue: '', months })));
    expect(bySite.reduce((n, a) => n + a.offered, 0)).toBe(all.offered);
    expect(bySite.reduce((n, a) => n + a.answeredInTarget, 0)).toBe(all.answeredInTarget);
  });
  it('un seul Pôle Multi ; Paris sans file inventée', () => {
    expect(new Set(QLIK_QUEUES.filter((q) => q.zone.startsWith('multi')).map((q) => q.zone))).toEqual(new Set(['multi']));
    expect(filterRows(rows, { pole: '', site: 'paris', client: '', queue: '', months })).toHaveLength(0);
  });
});
