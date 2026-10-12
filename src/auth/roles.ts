// Matrice de droits de la maquette (cahier des charges §2).
//
// AVERTISSEMENT : ces contrôles ne servent qu'à illustrer l'expérience par rôle.
// Un contrôle côté navigateur n'est PAS une mesure de sécurité : les permissions
// effectives seront appliquées et journalisées par le backend.
import type { ModuleId } from '../types';

export type Role = 'agent' | 'teamLeader' | 'responsable' | 'rh' | 'finance' | 'direction' | 'admin';

/**
 * - `view` : accès au module ;
 * - `individual` : données nominatives (pseudonymes) plutôt qu'agrégées ;
 * - `edit` : actions de modification (simulées).
 */
export type Action = 'view' | 'individual' | 'edit';

export const roleLabels: Record<Role, string> = {
  agent: 'Agent',
  teamLeader: 'Team Leader',
  responsable: 'Responsable',
  rh: 'RH',
  finance: 'Finance',
  direction: 'Direction',
  admin: 'Admin',
};

type Matrix = Record<Role, Partial<Record<ModuleId, Action[]>>>;

const ALL: Action[] = ['view', 'individual', 'edit'];

const matrix: Matrix = {
  agent: { supervision: ['view', 'individual'], pause: ['view'], stock: ['view'], vehicules: ['view'], accueil: ['view'] },
  teamLeader: { supervision: ALL, pause: ['view', 'individual'], stock: ['view'], vehicules: ['view'], accueil: ['view'] },
  responsable: { supervision: ALL, pause: ['view', 'individual'], rh: ['view'], stock: ['view', 'edit'], finance: ['view'], vehicules: ['view', 'edit'], accueil: ['view'] },
  rh: { rh: ALL, pause: ['view'], accueil: ['view'] },
  finance: { finance: ALL, stock: ['view'], vehicules: ['view'], accueil: ['view'] },
  direction: { supervision: ['view'], pause: ['view'], rh: ['view'], stock: ['view'], finance: ['view'], vehicules: ['view'], accueil: ['view'] },
  // Configuration technique, sans accès automatique aux données RH confidentielles.
  admin: { supervision: ['view'], stock: ['view', 'edit'], vehicules: ['view', 'edit'], accueil: ['view', 'edit'], pause: ['view'] },
};

export function can(role: Role, module: ModuleId, action: Action = 'view'): boolean {
  return matrix[role][module]?.includes(action) ?? false;
}

/** Périmètre client d'un agent dans la démo (son équipe uniquement). */
export const DEMO_AGENT_SCOPE = 'thelem';

export function clientScope(role: Role): string | null {
  return role === 'agent' ? DEMO_AGENT_SCOPE : null;
}
