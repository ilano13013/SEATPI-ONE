// Rôles et permissions de la démonstration.
//
// AVERTISSEMENT : ces contrôles illustrent l'expérience par profil. Un contrôle côté
// navigateur n'est PAS une mesure de sécurité : en production, chaque lecture et chaque
// modification devront être autorisées et journalisées par le backend.
//
// Modèle : des règles « rôle × module × actions », éventuellement limitées à un périmètre
// (département, pôle, équipe). Les règles par défaut ci-dessous sont modifiables par
// l'administrateur dans Administration → Rôles & permissions, sans toucher au code.
import type { ModuleId } from '../types';

export type Role = 'admin' | 'responsable' | 'teamLeader' | 'finance' | 'agent' | 'rh' | 'direction';

/**
 * - `view` : lecture ; `individual` : données nominatives (pseudonymes) plutôt qu'agrégées ;
 * - `create` / `edit` / `delete` : création, modification, suppression ;
 * - `validate` : validation ; `configure` : administration du module.
 * La visibilité ne donne jamais automatiquement le droit de modifier.
 */
export type Action = 'view' | 'individual' | 'create' | 'edit' | 'delete' | 'validate' | 'configure';

export const ACTIONS: Action[] = ['view', 'individual', 'create', 'edit', 'delete', 'validate', 'configure'];

export const actionLabels: Record<Action, string> = {
  view: 'Lecture',
  individual: 'Données nominatives',
  create: 'Création',
  edit: 'Modification',
  delete: 'Suppression',
  validate: 'Validation',
  configure: 'Administration',
};

/** Profils de démonstration. */
export const roleLabels: Record<Role, string> = {
  admin: 'Administrateur',
  responsable: 'Responsable de département (Helpdesk)',
  teamLeader: 'Manager',
  finance: 'Finance',
  agent: 'Technicien / agent',
  rh: 'RH',
  direction: 'Direction',
};

/** Modules soumis à permissions (en plus des modules d'espace 3D). */
export const permissionModules: { id: ModuleId; label: string }[] = [
  { id: 'supervision', label: 'Supervision Helpdesk (plateaux, tickets N1)' },
  { id: 'externes', label: 'Clients externes (tickets N2)' },
  { id: 'management', label: 'Management : checklists CRA / congés, équipes' },
  { id: 'objectifs', label: 'Objectifs' },
  { id: 'clients', label: 'Référentiel clients (CRM)' },
  { id: 'collaborateurs', label: 'Collaborateurs et affectations' },
  { id: 'finance', label: 'Budget & Rentabilité (coûts, revenus, prévisions)' },
  { id: 'budget-revision', label: 'Révision budgétaire (plafond déplacements)' },
  { id: 'sla', label: 'Paramètres SLA' },
  { id: 'telephonie', label: 'SLA décroché (QlikView)' },
  { id: 'dashboard', label: 'Paramètres des tableaux de bord' },
  { id: 'moyens', label: 'Moyens généraux (déplacements)' },
  { id: 'pdg', label: 'Cockpit PDG' },
  { id: 'integrations', label: 'Connexions & API, préparation production' },
  { id: 'permissions', label: 'Rôles et permissions' },
  { id: 'exploitation', label: 'Exploitation' },
  { id: 'csm', label: 'CSM' },
  { id: 'rh', label: 'Ressources humaines' },
  { id: 'pause', label: 'Salle de pause' },
  { id: 'stock', label: 'Stock' },
  { id: 'vehicules', label: 'Parc automobile' },
  { id: 'accueil', label: 'Accueil' },
];

export interface PermissionScope {
  department?: string;
  pole?: string;
  team?: string;
}

export interface PermissionRule {
  id: string;
  role: Role;
  module: ModuleId;
  actions: Action[];
  /** Périmètre : champ absent = tout le périmètre. */
  scope?: PermissionScope;
}

const RW: Action[] = ['view', 'individual', 'create', 'edit', 'delete', 'validate'];
const FULL: Action[] = [...RW, 'configure'];

type Matrix = Partial<Record<ModuleId, Action[]>>;

const DEFAULTS: Record<Role, Matrix> = {
  // Droits complets sur les données et paramètres métier. La révision du plafond déplacements
  // reste une procédure explicite (justification, confirmation, historique), même pour lui.
  admin: Object.fromEntries(permissionModules.map((m) => [m.id, FULL])) as Matrix,
  responsable: {
    supervision: RW,
    externes: [...RW, 'configure'],
    management: RW,
    objectifs: ['view', 'create', 'edit'],
    clients: ['view', 'individual'],
    collaborateurs: ['view', 'individual'],
    finance: ['view', 'create', 'edit'],
    sla: ['view'],
    telephonie: ['view', 'individual'],
    dashboard: ['view'],
    moyens: ['view'],
    pdg: ['view'],
    integrations: ['view', 'configure'],
    exploitation: ['view', 'individual'],
    csm: ['view', 'individual'],
    pause: ['view', 'individual'],
    rh: ['view'],
    stock: ['view', 'edit'],
    vehicules: ['view', 'edit'],
    accueil: ['view'],
  },
  teamLeader: {
    supervision: RW,
    externes: ['view', 'individual', 'edit'],
    management: ['view', 'individual', 'edit'],
    objectifs: ['view', 'edit'],
    clients: ['view'],
    collaborateurs: ['view', 'individual'],
    telephonie: ['view'],
    moyens: ['view'],
    integrations: ['view'],
    exploitation: ['view', 'individual'],
    csm: ['view', 'individual'],
    pause: ['view', 'individual'],
    stock: ['view'],
    vehicules: ['view'],
    accueil: ['view'],
  },
  finance: {
    finance: RW,
    clients: ['view'],
    externes: ['view'],
    pdg: ['view'],
    moyens: ['view'],
    csm: ['view'],
    stock: ['view'],
    vehicules: ['view'],
    accueil: ['view'],
  },
  agent: { supervision: ['view', 'individual'], clients: ['view'], pause: ['view'], stock: ['view'], vehicules: ['view'], accueil: ['view'] },
  rh: { rh: RW, management: ['view', 'individual'], collaborateurs: ['view', 'individual'], pause: ['view'], accueil: ['view'] },
  direction: {
    supervision: ['view'],
    externes: ['view'],
    management: ['view'],
    objectifs: ['view'],
    clients: ['view'],
    finance: ['view'],
    'budget-revision': ['view', 'edit'],
    sla: ['view'],
    telephonie: ['view'],
    moyens: ['view'],
    pdg: ['view'],
    exploitation: ['view'],
    csm: ['view'],
    pause: ['view'],
    rh: ['view'],
    stock: ['view'],
    vehicules: ['view'],
    accueil: ['view'],
  },
};

export const DEFAULT_RULES: PermissionRule[] = (Object.entries(DEFAULTS) as [Role, Matrix][]).flatMap(([role, m]) =>
  (Object.entries(m) as [ModuleId, Action[]][]).map(([module, actions]) => ({ id: `${role}:${module}`, role, module, actions })),
);

let rules: PermissionRule[] = DEFAULT_RULES;

/** Remplace les règles actives (appelé par l'application lorsque l'administrateur les modifie). */
export function setPermissionRules(next: PermissionRule[]) {
  rules = next;
}

export const activeRules = () => rules;

const scopeMatches = (s: PermissionScope | undefined, ctx: PermissionScope | undefined) =>
  !s || !ctx || (Object.keys(s) as (keyof PermissionScope)[]).every((k) => !s[k] || ctx[k] === undefined || s[k] === ctx[k]);

/** Autorisation (simulée) d'une action sur un module, éventuellement dans un périmètre donné. */
export function can(role: Role, module: ModuleId, action: Action = 'view', ctx?: PermissionScope): boolean {
  return rules.some((r) => r.role === role && r.module === module && r.actions.includes(action) && scopeMatches(r.scope, ctx));
}

/** Périmètre client d'un agent dans la démo (son équipe uniquement). */
export const DEMO_AGENT_SCOPE = 'thelem';

export function clientScope(role: Role): string | null {
  return role === 'agent' ? DEMO_AGENT_SCOPE : null;
}
