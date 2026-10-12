// Encadrement fictif représenté dans la 3D (pseudonymes, aucune donnée réelle).
// L'affectation des personnes aux sites est une configuration de démonstration.
import type { RoomKind, SiteId } from '../types';

export type PersonRole = 'responsable-helpdesk' | 'manager-helpdesk' | 'manager-mco' | 'manager-exploitation' | 'pdg';

export interface OrgPerson {
  id: string;
  /** Pseudonyme fonctionnel. */
  name: string;
  role: PersonRole;
  title: string;
  site: SiteId;
  roomKind: RoomKind;
  /** Périmètre managé (sites pour les managers Helpdesk). */
  scopeSites: SiteId[];
}

export const orgPeople: OrgPerson[] = [
  { id: 'resp-helpdesk', name: 'Resp. Helpdesk', role: 'responsable-helpdesk', title: 'Responsable du département Helpdesk', site: 'laciotat', roomKind: 'helpdesk', scopeSites: ['laciotat', 'montpellier', 'paris'] },
  { id: 'mgr-hd-lc', name: 'Manager HD La Ciotat', role: 'manager-helpdesk', title: 'Manager Helpdesk N1 — La Ciotat', site: 'laciotat', roomKind: 'helpdesk', scopeSites: ['laciotat'] },
  { id: 'mgr-hd-mtp', name: 'Manager HD Montpellier', role: 'manager-helpdesk', title: 'Manager Helpdesk N1 — Montpellier', site: 'montpellier', roomKind: 'helpdesk', scopeSites: ['montpellier'] },
  { id: 'mgr-hd-par', name: 'Manager HD Paris', role: 'manager-helpdesk', title: 'Manager Helpdesk N1 — Paris', site: 'paris', roomKind: 'helpdesk', scopeSites: ['paris'] },
  { id: 'mgr-mco', name: 'Manager MCO', role: 'manager-mco', title: 'Manager MCO / Support N2 (équipes chez les clients)', site: 'laciotat', roomKind: 'mco', scopeSites: ['laciotat', 'montpellier', 'paris'] },
  { id: 'mgr-exp', name: 'Manager Exploitation', role: 'manager-exploitation', title: 'Manager Exploitation', site: 'laciotat', roomKind: 'exploitation', scopeSites: ['laciotat', 'montpellier', 'paris'] },
  { id: 'pdg', name: 'PDG', role: 'pdg', title: 'Président-directeur général', site: 'laciotat', roomKind: 'direction', scopeSites: ['laciotat', 'montpellier', 'paris'] },
];

export const personById = (id: string) => orgPeople.find((p) => p.id === id);
export const peopleIn = (site: SiteId, kind: RoomKind) => orgPeople.filter((p) => p.site === site && p.roomKind === kind);
