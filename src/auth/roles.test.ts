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
