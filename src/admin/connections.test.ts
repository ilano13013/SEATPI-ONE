import { describe, expect, it } from 'vitest';
import { configStatus, DEMO_TEST_MESSAGE, initialConnectors, looksLikeSecret, validateSecretRef, validateUrl } from './connections';

describe('Connexions & API', () => {
  it('connecteurs attendus, aucune URL pré-remplie', () => {
    const list = initialConnectors();
    expect(list.map((c) => c.name)).toEqual(['EasyVista', 'Jira', 'GLPI', 'ISILOG', 'Zendesk', 'ServiceNow', 'QlikView', 'Genesys Cloud']);
    for (const c of list) {
      expect(c.docUrl).toBe('');
      expect(c.instances.every((i) => !i.instanceUrl && !i.apiUrl)).toBe(true);
      expect(configStatus(c)).toBe('Non configuré');
    }
    expect(list.find((c) => c.id === 'servicenow')!.instances[0].clients).toEqual(['primagaz', 'sodiaal', 'ird']);
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
