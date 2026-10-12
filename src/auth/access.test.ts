import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_RULES, roleLabels, setPermissionRules, type Role } from './roles';
import { comingFeature, MODULE_VIEW, moduleLinksFor, roomDataAccess, VIEW_LABEL, viewAccess, type ModuleView } from './access';
import { rooms } from '../data/layout';

afterEach(() => setPermissionRules(DEFAULT_RULES));
const roles = Object.keys(roleLabels) as Role[];
const views = Object.keys(VIEW_LABEL) as ModuleView[];

describe('accès centralisés (carte, menu, raccourcis, liens directs)', () => {
  it('l’administrateur ouvre tous les modules développés et le contenu de tous les espaces', () => {
    for (const v of views) expect(viewAccess('admin', v).ok, v).toBe(true);
    for (const r of rooms) {
      const a = roomDataAccess('admin', r);
      expect(a === null || a.ok, r.id).toBe(true);
      for (const l of moduleLinksFor(r.kind)) expect(viewAccess('admin', MODULE_VIEW[l.module]).ok).toBe(true);
    }
  });

  it('la direction accède aux espaces de direction, MCO et connecteurs (plus de faux « accès restreint »)', () => {
    for (const v of ['pdg', 'mco', 'finance', 'itsm', 'helpdesk'] as const) expect(viewAccess('direction', v).ok, v).toBe(true);
    const dg = rooms.find((r) => r.id === 'direction')!;
    expect(roomDataAccess('direction', dg)?.ok).toBe(true);
  });

  it('un module non développé est « à venir », jamais un refus d’accès', () => {
    for (const kind of ['formation', 'commercial', 'reunion', 'recrutement'] as const) {
      const room = rooms.find((r) => r.kind === kind)!;
      const c = comingFeature(room);
      expect(c && !c.ok && c.kind, kind).toBe('a-venir');
      expect(roomDataAccess('agent', room)).toBeNull();
    }
  });

  it('un refus légitime nomme le droit manquant et le profil', () => {
    const a = viewAccess('agent', 'finance');
    expect(a.ok).toBe(false);
    if (!a.ok) {
      expect(a.kind).toBe('refus');
      expect(a.message).toMatch(/Lecture sur « Budget & Rentabilité/);
      expect(a.message).toMatch(/Technicien/);
    }
  });

  it('les droits restent pilotés par les règles configurables', () => {
    setPermissionRules(DEFAULT_RULES.filter((r) => !(r.role === 'teamLeader' && r.module === 'supervision')));
    expect(viewAccess('teamLeader', 'helpdesk').ok).toBe(false);
    expect(roles.length).toBeGreaterThan(0);
  });
});
