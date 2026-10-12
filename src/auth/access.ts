// Règles d'accès centralisées : une même vue s'ouvre avec les mêmes droits depuis la carte des
// sites, le menu latéral, les raccourcis et les liens directs (URL).
//
// Trois issues possibles :
//  - accès accordé ;
//  - refus légitime : le droit manquant est nommé (module × action) ;
//  - module à venir : fonctionnalité non développée dans cette démonstration (jamais présentée
//    comme un refus d'accès).
import type { ModuleId, Room } from '../types';
import { actionLabels, can, permissionModules, roleLabels, type Action, type Role } from './roles';

/** Vues principales de l'application. */
export type AppView =
  | 'admin'
  | 'jumeau'
  | 'externes'
  | 'itsm'
  | 'helpdesk'
  | 'management'
  | 'mco'
  | 'exploitation'
  | 'moyens'
  | 'telephonie'
  | 'finance'
  | 'pdg'
  | 'production'
  | 'crm';

export type ModuleView = Exclude<AppView, 'jumeau'>;

export const VIEW_LABEL: Record<ModuleView, string> = {
  helpdesk: 'Cockpit Helpdesk consolidé',
  externes: 'Clients externes',
  telephonie: 'SLA décroché (QlikView)',
  mco: 'Cockpit MCO / Support N2',
  exploitation: 'Cockpit Exploitation',
  itsm: 'Connecteurs ITSM',
  management: 'Management : congés, CRA, objectifs',
  moyens: 'Moyens généraux : déplacements',
  crm: 'Clients (CRM)',
  finance: 'Budget & Rentabilité',
  pdg: 'Cockpit PDG',
  production: 'Préparation à la production',
  admin: 'Administration',
};

/** Droit de lecture requis par vue (l'administration accepte l'un ou l'autre). */
const VIEW_MODULES: Record<ModuleView, ModuleId[]> = {
  helpdesk: ['supervision'],
  externes: ['externes'],
  telephonie: ['telephonie'],
  mco: ['mco'],
  exploitation: ['exploitation'],
  itsm: ['integrations'],
  management: ['management'],
  moyens: ['moyens'],
  crm: ['clients'],
  finance: ['finance'],
  pdg: ['pdg'],
  production: ['integrations'],
  admin: ['integrations', 'permissions'],
};

export const moduleLabel = (m: ModuleId) => permissionModules.find((p) => p.id === m)?.label ?? m;

export type Denied = { ok: false; kind: 'refus' | 'a-venir'; title: string; message: string };
export type Access = { ok: true } | Denied;

/** Message de refus : nomme le droit manquant et l'endroit où il se règle. */
export function missingRight(role: Role, modules: ModuleId[], action: Action = 'view'): Denied {
  const names = modules.map((m) => `« ${moduleLabel(m)} »`).join(' ou ');
  return {
    ok: false,
    kind: 'refus',
    title: 'Accès refusé',
    message: `Droit manquant : ${actionLabels[action]} sur ${names} pour le profil ${roleLabels[role]}. Ce droit se règle dans Administration → Rôles & permissions (contrôle simulé : la sécurité effective sera assurée côté serveur).`,
  };
}

export function viewAccess(role: Role, view: ModuleView): Access {
  const modules = VIEW_MODULES[view];
  return modules.some((m) => can(role, m)) ? { ok: true } : missingRight(role, modules);
}

export const comingSoon = (what: string, detail?: string): Denied => ({
  ok: false,
  kind: 'a-venir',
  title: 'Module à venir',
  message: `${what} : fonctionnalité non disponible dans cette démonstration.${detail ? ` ${detail}` : ''}`,
});

/** Liens d'un espace de la carte vers les modules applicatifs. */
export type ModuleLink = 'helpdesk' | 'management' | 'finance' | 'finance-mco' | 'moyens' | 'deplacements' | 'recrutement' | 'pdg' | 'mco' | 'exploitation' | 'production' | 'externes' | 'crm';

export const MODULE_VIEW: Record<ModuleLink, ModuleView> = {
  helpdesk: 'helpdesk',
  management: 'management',
  mco: 'mco',
  exploitation: 'exploitation',
  finance: 'finance',
  'finance-mco': 'finance',
  moyens: 'moyens',
  deplacements: 'finance',
  recrutement: 'finance',
  pdg: 'pdg',
  production: 'production',
  externes: 'externes',
  crm: 'crm',
};

type Kind = Room['kind'];

const LINKS: Partial<Record<Kind, { module: ModuleLink; label: string }[]>> = {
  helpdesk: [{ module: 'helpdesk', label: 'Cockpit Helpdesk consolidé' }, { module: 'management', label: 'Management : congés, CRA, objectifs' }],
  mco: [{ module: 'mco', label: 'Cockpit MCO / Support N2' }, { module: 'finance-mco', label: 'Budget & Rentabilité MCO N2' }],
  exploitation: [{ module: 'exploitation', label: 'Cockpit Exploitation' }],
  csm: [{ module: 'externes', label: 'Clients externes' }],
  moyens: [{ module: 'moyens', label: 'Moyens généraux : déplacements professionnels' }],
  finance: [{ module: 'finance', label: 'Budget & Rentabilité du Helpdesk' }, { module: 'deplacements', label: 'Enveloppe déplacements Helpdesk' }],
  recrutement: [{ module: 'recrutement', label: 'Budget recrutement' }],
  direction: [{ module: 'pdg', label: 'Cockpit PDG' }],
  rh: [{ module: 'management', label: 'Congés et CRA' }],
  commercial: [{ module: 'crm', label: 'Clients (CRM)' }],
};

export const moduleLinksFor = (kind: Kind) => LINKS[kind] ?? [];

/** Fonctionnalités d'espace non développées dans cette démonstration. */
const COMING: Partial<Record<Kind, string>> = {
  formation: 'Sessions de formation et habilitations',
  commercial: 'Opportunités, propositions et appels d’offres',
  recrutement: 'Postes ouverts et suivi des candidatures',
  reunion: 'Réservation des salles, réunions et visioconférences',
};

export function comingFeature(room: Room): Access | null {
  if (room.kind === 'direction' && room.id !== 'direction') return comingSoon('Cockpit de direction de site', 'Les indicateurs consolidés sont disponibles dans le Cockpit PDG.');
  const what = COMING[room.kind];
  return what ? comingSoon(what) : null;
}

/** Module de données affiché directement dans le panneau d'un espace (hors liens). */
const ROOM_DATA_MODULE: Partial<Record<Kind, ModuleId>> = {
  helpdesk: 'supervision',
  pause: 'pause',
  rh: 'rh',
  stock: 'stock',
  parking: 'vehicules',
  accueil: 'accueil',
  exploitation: 'exploitation',
  csm: 'csm',
};

/** Accès au contenu de données d'un espace ; `null` = pas de contenu de données propre. */
export function roomDataAccess(role: Role, room: Room): Access | null {
  const m = room.kind === 'direction' && room.id === 'direction' ? 'pdg' : ROOM_DATA_MODULE[room.kind];
  if (!m) return null;
  return can(role, m) ? { ok: true } : missingRight(role, [m]);
}
