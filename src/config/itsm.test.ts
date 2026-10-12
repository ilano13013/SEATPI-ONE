import { describe, expect, it } from 'vitest';
import { clientRegistry, connectorRegistry, ITSM_MAPPING, itsmOf, n1Clients, POLE_CLIENTS } from './itsm';
import { externalClients } from '../external/config';
import { adapters } from '../external/itsm/adapters';

describe('cartographie ITSM de référence', () => {
  it('reprend exactement la configuration fournie', () => {
    expect(ITSM_MAPPING).toEqual({
      EasyVista: ['INVIVO', 'DMB', 'TERACT'],
      Jira: ['LBR FR', 'EURAPHARMA'],
      GLPI: ['ANGE', 'HSTV', 'NOCIBE'],
      ISILOG: ['THELEM', 'TRANSGOURMET', 'MONEXT'],
      Zendesk: ['SNR'],
    });
  });

  it('associe chaque client à son outil, sans attribution arbitraire', () => {
    expect(itsmOf('invivo')).toBe('EasyVista');
    expect(itsmOf('dmb')).toBe('EasyVista');
    expect(itsmOf('lbrfr')).toBe('Jira');
    expect(itsmOf('eurapharma')).toBe('Jira');
    expect(itsmOf('ange')).toBe('GLPI');
    expect(itsmOf('hstv')).toBe('GLPI');
    expect(itsmOf('thelem')).toBe('ISILOG');
    expect(itsmOf('transgourmet')).toBe('ISILOG');
    expect(itsmOf('monext')).toBe('ISILOG');
    expect(itsmOf('teract')).toBe('EasyVista');
    expect(itsmOf('nocibe')).toBe('GLPI');
    expect(itsmOf('snr')).toBe('Zendesk');
    for (const id of ['primagaz', 'ird', 'ortec', 'sodiaal', 'g2s']) expect(itsmOf(id)).toBeNull();
  });

  it('le Pôle Multi (La Ciotat et Montpellier) traite les 11 clients fournis', () => {
    const expected = ['ange', 'hstv', 'lbrfr', 'transgourmet', 'invivo', 'snr', 'dmb', 'nocibe', 'teract', 'g2s', 'eurapharma'];
    expect(POLE_CLIENTS.multi).toEqual(expected);
    expect(POLE_CLIENTS['multi-mtp']).toEqual(expected);
    expect(n1Clients.find((c) => c.clientId === 'invivo')!.poleIds).toEqual(['multi', 'multi-mtp']);
  });

  it('un client n’apparaît qu’une fois dans la cartographie', () => {
    const all = Object.values(ITSM_MAPPING).flat();
    expect(new Set(all).size).toBe(all.length);
    for (const name of all) expect(clientRegistry.some((c) => c.name === name)).toBe(true);
  });

  it('les sites clients externes utilisent la cartographie unique', () => {
    expect(Object.fromEntries(externalClients.map((c) => [c.id, c.tool]))).toEqual({ invivo: 'EasyVista', primagaz: null, monext: 'ISILOG' });
  });

  it('registre des connecteurs : une entrée par couple outil / client, sans valeur inventée', () => {
    expect(connectorRegistry).toHaveLength(Object.values(ITSM_MAPPING).flat().length);
    for (const c of connectorRegistry) {
      expect(c.instance).toBeNull();
      expect(c.apiUrl).toBeNull();
      expect(c.authMode).toBeNull();
      expect(c.status).toBe('Non connecté');
      expect(c.writePermission).toBe('À obtenir');
      expect(adapters[c.tool]).toBeDefined();
    }
  });
});
