import { describe, expect, it } from 'vitest';
import readinessFile from '../../PRODUCTION_READINESS.md?raw';
import { DOMAINS, READINESS_ITEMS, reportMarkdown, setStatus, summarize } from './readiness';
import { DemoDataProvider, PAGES_CONFIG, PRODUCTION_PREREQUISITES, resolveProvider } from '../data/provider';

describe('préparation à la production', () => {
  it('couvre les six domaines, références uniques, dépendances existantes', () => {
    expect(new Set(READINESS_ITEMS.map((i) => i.domain))).toEqual(new Set(DOMAINS));
    const ids = READINESS_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of READINESS_ITEMS) for (const d of i.dependencies) expect(ids).toContain(d);
  });
  it('tout élément Validé porte une preuve et une date de vérification', () => {
    for (const i of READINESS_ITEMS.filter((x) => x.status === 'Validé')) {
      expect(i.evidence).toBeTruthy();
      expect(i.lastCheck).toBeTruthy();
    }
  });
  it('NO-GO tant qu’il reste des bloquants ou des critiques non validés ; taux = validés ÷ total', () => {
    const s = summarize(READINESS_ITEMS);
    expect(s.go).toBe(false);
    expect(s.blocking).toBeGreaterThan(0);
    expect(s.rate).toBe(Math.round((s.validated / s.total) * 1000) / 10);
    const allOk = READINESS_ITEMS.map((i) => ({ ...i, status: 'Validé' as const, evidence: 'x' }));
    expect(summarize(allOk).go).toBe(true);
  });
  it('refuse Validé sans preuve ou avec des dépendances non validées', () => {
    expect(setStatus(READINESS_ITEMS, 'INF-04', 'Validé', '2026-10-12').ok).toBe(false);
    expect(setStatus(READINESS_ITEMS, 'INF-04', 'Validé', '2026-10-12', 'Vérifié').message).toMatch(/INF-01/);
    const r = setStatus(READINESS_ITEMS, 'SEC-05', 'Validé', '2026-10-12', 'AIPD signée');
    expect(r.ok).toBe(true);
    expect(r.items.find((i) => i.id === 'SEC-05')).toMatchObject({ status: 'Validé', lastCheck: '2026-10-12' });
  });
  it('le rapport Markdown contient la décision et chaque élément', () => {
    const md = reportMarkdown(READINESS_ITEMS, '12/10/2026');
    expect(md).toContain('NO-GO');
    expect(md).toContain('pas** une certification');
    for (const i of READINESS_ITEMS) expect(md).toContain(i.id);
  });
  it('PRODUCTION_READINESS.md à la racine reprend tous les éléments', () => {
    for (const i of READINESS_ITEMS) expect(readinessFile).toContain(`| ${i.id} |`);
  });
});

describe('prérequis ajoutés (QlikView, SLA, ServiceNow, Zendesk, G2S)', () => {
  it('présents et au statut « À configurer » tant qu’ils ne sont pas vérifiés', () => {
    for (const id of ['TEL-01', 'TEL-02', 'TEL-03', 'TEL-04', 'ITSM-11', 'ITSM-10', 'ITSM-09', 'ITSM-05']) {
      const item = READINESS_ITEMS.find((i) => i.id === id)!;
      expect(item, id).toBeDefined();
      expect(item.status, id).toBe('À configurer');
    }
  });
});

describe('fournisseurs de données', () => {
  it('démonstration par défaut ; production refusée sans prérequis, avec avertissement visible', () => {
    expect(resolveProvider('demo', PAGES_CONFIG).provider).toBe(DemoDataProvider);
    const r = resolveProvider('production', PAGES_CONFIG);
    expect(r.provider).toBe(DemoDataProvider);
    expect(r.warning).toMatch(/FICTIVES/);
    const partial = resolveProvider('production', { backendUrl: 'https://exemple.invalid', validated: [PRODUCTION_PREREQUISITES[0]] });
    expect(partial.provider.mode).toBe('demo');
    const full = resolveProvider('production', { backendUrl: 'https://exemple.invalid', validated: [...PRODUCTION_PREREQUISITES] });
    expect(full.provider.mode).toBe('production');
  });
  it('aucun secret apparent dans le code source publié', () => {
    const sources = import.meta.glob(['../**/*.ts', '../**/*.tsx', '!../**/*.test.*'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    expect(Object.keys(sources).length).toBeGreaterThan(50);
    const pattern = /(api[_-]?key|secret|password|token)\s*[:=]\s*['"][A-Za-z0-9_\-]{12,}['"]|Bearer\s+[A-Za-z0-9._\-]{20,}|https?:\/\/[^'"\s]+\/api\/[^'"\s]*\?(?:[^'"\s]*)(?:key|token)=/i;
    for (const [f, src] of Object.entries(sources)) expect(pattern.test(src), f).toBe(false);
  });
});
