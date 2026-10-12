// Référentiel des collaborateurs (pseudonymes) : base commune du management
// (congés, CRA) et du budget. Coûts employeur = VALEURS FICTIVES de démonstration.
import type { Agent, SiteId } from '../types';
import type { Technician } from '../external/types';
import { exploitationTeam, csmTeam } from '../external/services';
import { helpdeskPoles } from '../data/layout';
import { externalTeams } from '../external/config';
import { orgPeople } from './people';

export type Population = 'Agent N1' | 'Technicien N2' | 'Exploitation' | 'CSM' | 'Encadrement';

export interface Collaborator {
  id: string;
  name: string;
  population: Population;
  /** Site SEATPI de rattachement ; null pour un collaborateur affecté chez un client. */
  site: SiteId | null;
  /** Client d'affectation (sites clients externes). */
  clientId: string | null;
  teamId: string;
  teamLabel: string;
  /** Manager direct (référentiel d'encadrement) ; null = direction générale. */
  managerId: string | null;
  /** Rattaché au département Helpdesk (périmètre financier et management). */
  helpdesk: boolean;
  /** Équivalent temps plein (0–1). */
  etp: number;
  /** Coût employeur mensuel chargé — valeur fictive. */
  monthlyCost: number;
  contractHoursWeek: number;
  /** Date d'entrée / de sortie (AAAA-MM-JJ) si mouvement dans l'année. */
  entryDate?: string;
  exitDate?: string;
}

/** Barème fictif de coût employeur mensuel par population. */
export const DEMO_MONTHLY_COST: Record<Population, number> = {
  'Agent N1': 2900,
  'Technicien N2': 3700,
  Exploitation: 4000,
  CSM: 4800,
  Encadrement: 5600,
};

const MANAGER_OF_SITE: Record<SiteId, string> = { laciotat: 'mgr-hd-lc', montpellier: 'mgr-hd-mtp', paris: 'mgr-hd-par' };

/** Petite variation déterministe pour éviter des coûts strictement identiques. */
const vary = (id: string, base: number) => base + ((id.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % 7) - 3) * 50;

export function buildCollaborators(agents: Agent[], techs: Technician[]): Collaborator[] {
  const list: Collaborator[] = [];
  for (const a of agents) {
    const pole = helpdeskPoles.find((p) => p.clientId === a.clientId);
    list.push({
      id: a.id,
      name: a.name,
      population: 'Agent N1',
      site: a.site,
      clientId: null,
      teamId: `pole-${a.clientId}`,
      teamLabel: pole?.label ?? a.clientId,
      managerId: MANAGER_OF_SITE[a.site],
      helpdesk: true,
      etp: 1,
      monthlyCost: vary(a.id, DEMO_MONTHLY_COST['Agent N1']),
      contractHoursWeek: 35,
    });
  }
  for (const t of techs) {
    const team = externalTeams.find((x) => x.id === t.teamId);
    list.push({
      id: t.id,
      name: t.name,
      population: 'Technicien N2',
      site: null,
      clientId: t.clientId,
      teamId: t.teamId,
      teamLabel: team?.name ?? t.teamId,
      managerId: 'mgr-mco',
      helpdesk: true,
      etp: t.availability,
      monthlyCost: Math.round(vary(t.id, DEMO_MONTHLY_COST['Technicien N2']) * t.availability),
      contractHoursWeek: Math.round(35 * t.availability),
    });
  }
  for (const m of exploitationTeam) {
    list.push({ id: m.id, name: m.name, population: 'Exploitation', site: m.site, clientId: null, teamId: 'exploitation', teamLabel: 'Exploitation', managerId: 'mgr-exp', helpdesk: false, etp: 1, monthlyCost: vary(m.id, DEMO_MONTHLY_COST.Exploitation), contractHoursWeek: 35 });
  }
  for (const m of csmTeam) {
    list.push({ id: m.id, name: m.name, population: 'CSM', site: m.site, clientId: m.clientId ?? null, teamId: 'csm', teamLabel: 'CSM', managerId: 'pdg', helpdesk: false, etp: 1, monthlyCost: vary(m.id, DEMO_MONTHLY_COST.CSM), contractHoursWeek: 35 });
  }
  for (const p of orgPeople) {
    const helpdesk = p.role === 'responsable-helpdesk' || p.role === 'manager-helpdesk' || p.role === 'manager-mco';
    list.push({
      id: p.id,
      name: p.name,
      population: 'Encadrement',
      site: p.site,
      clientId: null,
      teamId: 'encadrement',
      teamLabel: p.title,
      managerId: p.role === 'pdg' ? null : p.role === 'responsable-helpdesk' || p.role === 'manager-exploitation' ? 'pdg' : 'resp-helpdesk',
      helpdesk,
      etp: 1,
      monthlyCost: p.role === 'pdg' ? 0 : vary(p.id, DEMO_MONTHLY_COST.Encadrement + (p.role === 'responsable-helpdesk' ? 1200 : 0)),
      contractHoursWeek: 35,
    });
  }
  return list;
}

/** Collaborateurs placés sous la responsabilité d'un manager (directs et indirects). */
export function teamOf(managerId: string, all: Collaborator[]): Collaborator[] {
  const direct = all.filter((c) => c.managerId === managerId);
  return direct.flatMap((c) => [c, ...(c.population === 'Encadrement' ? teamOf(c.id, all) : [])]);
}
