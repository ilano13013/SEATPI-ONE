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
 * - `edit` : actions de modification (simulées) ;
 * - `configure` : paramétrage (objectifs, connecteurs).
 */
export type Action = 'view' | 'individual' | 'edit' | 'configure';

export const roleLabels: Record<Role, string> = {
  agent: 'Agent',
  teamLeader: 'Team Leader',
  responsable: 'Responsable Helpdesk',
  rh: 'RH',
  finance: 'Finance',
  direction: 'Direction',
  admin: 'Admin',
};

type Matrix = Record<Role, Partial<Record<ModuleId, Action[]>>>;

const ALL: Action[] = ['view', 'individual', 'edit'];

const matrix: Matrix = {
  agent: { supervision: ['view', 'individual'], pause: ['view'], stock: ['view'], vehicules: ['view'], accueil: ['view'] },
  teamLeader: { supervision: ALL, pause: ['view', 'individual'], stock: ['view'], vehicules: ['view'], accueil: ['view'], externes: ['view', 'individual', 'edit'], integrations: ['view'], exploitation: ['view', 'individual'], csm: ['view', 'individual'] },
  responsable: {
    supervision: ALL,
    pause: ['view', 'individual'],
    rh: ['view'],
    stock: ['view', 'edit'],
    finance: ['view'],
    vehicules: ['view', 'edit'],
    accueil: ['view'],
    externes: ['view', 'individual', 'edit', 'configure'],
    integrations: ['view', 'configure'],
    exploitation: ['view', 'individual'],
    csm: ['view', 'individual'],
    moyens: ['view'],
  },
  rh: { rh: ALL, pause: ['view'], accueil: ['view'] },
  finance: { finance: ALL, stock: ['view'], vehicules: ['view'], accueil: ['view'], externes: ['view'], csm: ['view'] },
  direction: { supervision: ['view'], pause: ['view'], rh: ['view'], stock: ['view'], finance: ['view'], vehicules: ['view'], accueil: ['view'], externes: ['view'], exploitation: ['view'], csm: ['view'] },
  // Configuration technique, sans accès automatique aux données RH confidentielles ni aux données individuelles.
  admin: { supervision: ['view'], stock: ['view', 'edit'], vehicules: ['view', 'edit'], accueil: ['view', 'edit'], pause: ['view'], externes: ['view'], integrations: ['view', 'configure'], exploitation: ['view'] },
};

export function can(role: Role, module: ModuleId, action: Action = 'view'): boolean {
  return matrix[role][module]?.includes(action) ?? false;
}

/** Périmètre client d'un agent dans la démo (son équipe uniquement). */
export const DEMO_AGENT_SCOPE = 'thelem';

export function clientScope(role: Role): string | null {
  return role === 'agent' ? DEMO_AGENT_SCOPE : null;
}
