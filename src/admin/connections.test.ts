import { describe, expect, it } from 'vitest';
import { configStatus, DEMO_TEST_MESSAGE, initialConnectors, looksLikeSecret, readinessLinksOf, toolOfConnector, validateSecretRef, validateUrl } from './connections';
import { clientRegistry } from '../config/itsm';

describe('Connexions & API', () => {
  it('un connecteur ITSM par client (domaine propre) et un QlikView commun à tous les clients', () => {
    const list = initialConnectors();
    const perClient = list.filter((c) => c.scope === 'client');
    expect(perClient.map((c) => c.clientId).sort()).toEqual(clientRegistry.map((c) => c.id).sort());
    for (const c of perClient) expect(c.instances[0].clients).toEqual([c.clientId]);
    expect(toolOfConnector(perClient.find((c) => c.clientId === 'primagaz')!)).toBe('ServiceNow');
    expect(toolOfConnector(perClient.find((c) => c.clientId === 'sodiaal')!)).toBe('ServiceNow');
    expect(toolOfConnector(perClient.find((c) => c.clientId === 'g2s')!)).toBeNull();
    expect(readinessLinksOf(perClient.find((c) => c.clientId === 'g2s')!)).toEqual(['ITSM-05']);
    const qlik = list.filter((c) => c.name === 'QlikView');
    expect(qlik).toHaveLength(1);
    expect(qlik[0].scope).toBe('général');
    expect(qlik[0].instances[0].clients).toHaveLength(clientRegistry.length);
  });

  it('aucune URL pré-remplie', () => {
    const list = initialConnectors();
    for (const c of list) {
      expect(c.docUrl).toBe('');
      expect(c.instances.every((i) => !i.instanceUrl && !i.apiUrl)).toBe(true);
      expect(configStatus(c)).toBe('Non configuré');
    }
  });
  it('statuts : incomplet puis prêt à tester ; jamais « Connecté » sans backend', () => {
    const c = initialConnectors()[0];
    const partial = { ...c, authType: 'OAuth 2.0' as const };
    expect(configStatus(partial)).toBe('Configuration incomplète');
    const ready = { ...partial, secretRef: 'vault/easyvista', instances: [{ ...c.instances[0], instanceUrl: 'https://a.invalid', apiUrl: 'https://a.invalid/api' }] };
    expect(configStatus(ready)).toBe('Prêt à tester');
    expect(DEMO_TEST_MESSAGE).toBe('Test réel indisponible en démonstration');
  });
  it('URL : https uniquement, ni identifiants ni jetons', () => {
    expect(validateUrl('https://exemple.invalid/api')).toBeNull();
    expect(validateUrl('http://exemple.invalid')).toMatch(/https/);
    expect(validateUrl('https://user:pass@exemple.invalid')).toMatch(/identifiants/);
    expect(validateUrl('https://exemple.invalid/api?token=abc')).toMatch(/jeton/);
  });
  it('détection des secrets : refusés comme paramètres ou références', () => {
    expect(looksLikeSecret('api_key', 'x')).toBe(true);
    expect(looksLikeSecret('pageSize', '100')).toBe(false);
    expect(looksLikeSecret('header', 'Bearer abcdefghijklmnopqrstuvwxyz0123')).toBe(true);
    expect(validateSecretRef('vault/servicenow/compte-service')).toBeNull();
    expect(validateSecretRef('a8F3kLm09QzX7vB2nR5tY1uW4eD6gH0jK9lP')).toMatch(/NOM du secret/);
  });
});
