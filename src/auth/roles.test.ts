import { afterEach, describe, expect, it } from 'vitest';
import { can, clientScope, DEFAULT_RULES, roleLabels, setPermissionRules, type Role } from './roles';

afterEach(() => setPermissionRules(DEFAULT_RULES));
const roles = Object.keys(roleLabels) as Role[];

describe('rôles et permissions (démonstration)', () => {
  it('l’administrateur a les droits complets sur les données et paramètres métier', () => {
    for (const m of ['clients', 'collaborateurs', 'finance', 'objectifs', 'sla', 'dashboard', 'integrations', 'permissions'] as const)
      for (const a of ['view', 'create', 'edit', 'delete', 'validate', 'configure'] as const) expect(can('admin', m, a), `${m} ${a}`).toBe(true);
  });

  it('la visibilité ne donne pas le droit de modifier', () => {
    expect(can('teamLeader', 'clients')).toBe(true);
    expect(can('teamLeader', 'clients', 'edit')).toBe(false);
    expect(can('direction', 'finance')).toBe(true);
    expect(can('direction', 'finance', 'edit')).toBe(false);
  });

  it('responsable : budgets, prévisions, coûts et revenus autorisés, objectifs de son périmètre', () => {
    expect(can('responsable', 'finance', 'edit')).toBe(true);
    expect(can('responsable', 'objectifs', 'edit')).toBe(true);
    expect(can('responsable', 'finance', 'delete')).toBe(false);
  });

  it('manager : objectifs et suivi des checklists ; technicien : lecture', () => {
    expect(can('teamLeader', 'objectifs', 'edit')).toBe(true);
    expect(can('teamLeader', 'management', 'edit')).toBe(true);
    expect(can('agent', 'management')).toBe(false);
    expect(can('agent', 'clients', 'edit')).toBe(false);
  });

  it('révision du plafond : permission spécifique (direction, administrateur)', () => {
    expect(roles.filter((r) => can(r, 'budget-revision', 'edit')).sort()).toEqual(['admin', 'direction']);
    expect(can('finance', 'budget-revision', 'edit')).toBe(false);
  });

  it('règles configurables, y compris par périmètre (pôle)', () => {
    setPermissionRules([...DEFAULT_RULES.filter((r) => !(r.role === 'teamLeader' && r.module === 'objectifs')), { id: 'x', role: 'teamLeader', module: 'objectifs', actions: ['view', 'edit'], scope: { pole: 'multi' } }]);
    expect(can('teamLeader', 'objectifs', 'edit', { pole: 'multi' })).toBe(true);
    expect(can('teamLeader', 'objectifs', 'edit', { pole: 'dedie' })).toBe(false);
  });

  it('limite l’agent au périmètre de son équipe ; pas de supervision externe', () => {
    expect(clientScope('agent')).toBe('thelem');
    expect(clientScope('teamLeader')).toBeNull();
    expect(can('agent', 'externes')).toBe(false);
  });

  it('la direction voit des données agrégées', () => {
    expect(can('direction', 'supervision')).toBe(true);
    expect(can('direction', 'supervision', 'individual')).toBe(false);
  });
});
