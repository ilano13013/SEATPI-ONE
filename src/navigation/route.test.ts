import { describe, expect, it } from 'vitest';
import { parseHash, toHash, type RouteState } from './route';
import { EMPTY_FILTERS } from '../helpdesk/consolidation';

const base: RouteState = {
  view: 'jumeau',
  room: 'helpdesk',
  ext: { scope: 'global', tab: 'dashboard' },
  hd: { tab: 'synthese', filters: EMPTY_FILTERS, ticketId: null },
  finEntity: 'helpdesk',
  finTab: 'global',
  mgmtTab: 'cra',
  adminTab: 'connexions',
};

describe('URL dédiées', () => {
  it('aller-retour : module, onglet, filtres et fiche ticket', () => {
    const r: RouteState = { ...base, view: 'helpdesk', hd: { tab: 'tickets', filters: { ...EMPTY_FILTERS, client: 'thelem', q: 'imprimante' }, ticketId: 'SPI-100012' } };
    const h = toHash(r);
    expect(h).toBe('#/helpdesk/tickets?client=thelem&q=imprimante&ticket=SPI-100012');
    expect(parseHash(h, base)).toEqual(r);
  });
  it('client externe, budget, management et administration', () => {
    for (const r of [
      { ...base, view: 'externes' as const, ext: { scope: 'monext' as const, tab: 'integration' as const } },
      { ...base, view: 'finance' as const, finEntity: 'mco' as const, finTab: 'historique' as const },
      { ...base, view: 'management' as const, mgmtTab: 'conges' as const },
      { ...base, view: 'admin' as const, adminTab: 'roles' as const },
      { ...base, view: 'crm' as const },
    ]) {
      const parsed = parseHash(toHash(r), base);
      expect(toHash(parsed)).toBe(toHash(r));
      expect(parsed.view).toBe(r.view);
    }
  });
  it('une URL inconnue ramène à la carte des sites, sans erreur', () => {
    expect(parseHash('#/inconnu/x', base).view).toBe('jumeau');
    expect(parseHash('', base).view).toBe('jumeau');
    expect(parseHash('#/externes/pirate/xx', base).ext).toEqual({ scope: 'global', tab: 'dashboard', ticketId: undefined });
  });
});
