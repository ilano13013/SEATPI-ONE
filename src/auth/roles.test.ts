import { describe, expect, it } from 'vitest';
import { can, clientScope, roleLabels, type Role } from './roles';

describe('matrice de droits (maquette)', () => {
  it("l'admin n'accède pas automatiquement aux données RH", () => {
    expect(can('admin', 'rh')).toBe(false);
  });

  it('la RH gère son module mais pas la supervision', () => {
    expect(can('rh', 'rh', 'edit')).toBe(true);
    expect(can('rh', 'supervision')).toBe(false);
  });

  it('la direction voit des données agrégées', () => {
    expect(can('direction', 'supervision')).toBe(true);
    expect(can('direction', 'supervision', 'individual')).toBe(false);
  });

  it('seule la finance approuve les dépenses', () => {
    const approvers = (Object.keys(roleLabels) as Role[]).filter((r) => can(r, 'finance', 'edit'));
    expect(approvers).toEqual(['finance']);
  });

  it("limite l'agent au périmètre de son équipe", () => {
    expect(clientScope('agent')).toBe('thelem');
    expect(clientScope('teamLeader')).toBeNull();
  });
});

describe('droits du module clients externes', () => {
  it('l’agent n’accède pas à la supervision externe', () => {
    expect(can('agent', 'externes')).toBe(false);
  });

  it('seule la responsable Helpdesk configure les objectifs', () => {
    const configurers = (Object.keys(roleLabels) as Role[]).filter((r) => can(r, 'externes', 'configure'));
    expect(configurers).toEqual(['responsable']);
  });

  it('le Team Leader modifie les tickets sans configurer', () => {
    expect(can('teamLeader', 'externes', 'edit')).toBe(true);
    expect(can('teamLeader', 'externes', 'configure')).toBe(false);
  });

  it('direction, finance et admin n’ont que des vues agrégées', () => {
    for (const r of ['direction', 'finance', 'admin'] as Role[]) {
      expect(can(r, 'externes')).toBe(true);
      expect(can(r, 'externes', 'individual')).toBe(false);
      expect(can(r, 'externes', 'edit')).toBe(false);
    }
  });

  it('l’admin pilote les connecteurs, pas les données RH', () => {
    expect(can('admin', 'integrations', 'configure')).toBe(true);
    expect(can('admin', 'rh')).toBe(false);
  });
});
