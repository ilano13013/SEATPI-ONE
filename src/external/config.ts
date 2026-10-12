// Configuration fictive des clients externes. Aucun nom réel de collaborateur :
// les techniciens sont désignés par un pseudonyme (Tech. INV-01…).
import type { BusinessCalendar, Contract, ExternalClient, ExternalClientId, ExternalTeam, Technician } from './types';
import { addDays, dateKey, nextBusinessDays } from './calendar';

const HOLIDAYS_FR = [
  '2026-01-01', '2026-04-06', '2026-05-01', '2026-05-08', '2026-05-14', '2026-05-25', '2026-07-14', '2026-08-15',
  '2026-11-01', '2026-11-11', '2026-12-25', '2027-01-01', '2027-03-29', '2027-05-01', '2027-05-06', '2027-05-08',
  '2027-05-17', '2027-07-14', '2027-08-15', '2027-11-01', '2027-11-11', '2027-12-25',
];

const cal = (label: string, days: number[], startHour: number, endHour: number): BusinessCalendar => ({ label, days, startHour, endHour, holidays: HOLIDAYS_FR });

export const externalClients: ExternalClient[] = [
  {
    id: 'invivo',
    name: 'INVIVO',
    tool: 'GLPI',
    accent: '#2f855a',
    sites: ['Siège', 'Site régional Ouest'],
    categories: ['Poste de travail', 'Messagerie', 'Comptes & accès', 'Impression', 'Réseau', 'Applicatif métier'],
    calendar: cal('Lun–Ven 8h–18h, jours fériés France', [1, 2, 3, 4, 5], 8, 18),
    sla: { P1: { takeChargeMin: 15, resolutionMin: 240 }, P2: { takeChargeMin: 30, resolutionMin: 480 }, P3: { takeChargeMin: 120, resolutionMin: 1500 }, P4: { takeChargeMin: 240, resolutionMin: 3000 } },
    slaPauseStatuses: ['En attente'],
  },
  {
    id: 'primagaz',
    name: 'PRIMAGAZ',
    tool: 'EasyVista',
    accent: '#c05621',
    sites: ['Siège', 'Centre logistique'],
    categories: ['Poste de travail', 'Messagerie', 'Téléphonie', 'Comptes & accès', 'Applicatif métier', 'Exploitation'],
    calendar: cal('Lun–Sam 7h–19h, jours fériés France', [1, 2, 3, 4, 5, 6], 7, 19),
    sla: { P1: { takeChargeMin: 15, resolutionMin: 240 }, P2: { takeChargeMin: 60, resolutionMin: 720 }, P3: { takeChargeMin: 240, resolutionMin: 2160 }, P4: { takeChargeMin: 480, resolutionMin: 3600 } },
    slaPauseStatuses: ['En attente'],
  },
  {
    id: 'monext',
    name: 'MONEXT',
    tool: 'Jira',
    accent: '#2b6cb0',
    sites: ['Siège', 'Centre de services'],
    categories: ['Monétique', 'Applicatif métier', 'Comptes & accès', 'Réseau', 'Poste de travail'],
    calendar: cal('Lun–Ven 8h–20h, jours fériés France', [1, 2, 3, 4, 5], 8, 20),
    sla: { P1: { takeChargeMin: 10, resolutionMin: 120 }, P2: { takeChargeMin: 30, resolutionMin: 360 }, P3: { takeChargeMin: 120, resolutionMin: 1440 }, P4: { takeChargeMin: 240, resolutionMin: 2880 } },
    slaPauseStatuses: ['En attente'],
  },
];

export const contracts: Contract[] = [
  { id: 'CTR-INV-01', clientId: 'invivo', label: 'Infogérance support utilisateurs', hourlyRate: 52, costRate: 38, monthlyBudget: 42000 },
  { id: 'CTR-PRI-01', clientId: 'primagaz', label: 'Support & exploitation', hourlyRate: 55, costRate: 39, monthlyBudget: 36000 },
  { id: 'CTR-MNX-01', clientId: 'monext', label: 'Support monétique N1', hourlyRate: 58, costRate: 40, monthlyBudget: 26000 },
  { id: 'CTR-MNX-02', clientId: 'monext', label: 'MCO applicatif N2', hourlyRate: 68, costRate: 47, monthlyBudget: 21000 },
];

export const externalTeams: ExternalTeam[] = [
  { id: 'inv-n1', clientId: 'invivo', name: 'Helpdesk N1 INVIVO', service: 'Helpdesk N1', contractId: 'CTR-INV-01', sourceGroup: 'GRP_SUPPORT_N1' },
  { id: 'inv-n2', clientId: 'invivo', name: 'Proximité MCO N2', service: 'MCO N2', contractId: 'CTR-INV-01', sourceGroup: 'GRP_PROXI_N2' },
  { id: 'pri-n1', clientId: 'primagaz', name: 'Support utilisateurs', service: 'Helpdesk N1', contractId: 'CTR-PRI-01', sourceGroup: 'Support_Utilisateurs' },
  { id: 'pri-exp', clientId: 'primagaz', name: 'Exploitation', service: 'Exploitation', contractId: 'CTR-PRI-01', sourceGroup: 'Exploitation_Prod' },
  { id: 'mnx-n1', clientId: 'monext', name: 'Support monétique N1', service: 'Helpdesk N1', contractId: 'CTR-MNX-01', sourceGroup: 'support-n1' },
  { id: 'mnx-n2', clientId: 'monext', name: 'MCO applicatif N2', service: 'MCO N2', contractId: 'CTR-MNX-02', sourceGroup: 'mco-n2' },
];

type TechSeed = [code: string, teamId: string, login: string, skills: string[], availability: number, leave: number[], pendingLeave: number, cra: Technician['cra']['status']];

const techSeeds: TechSeed[] = [
  ['INV-01', 'inv-n1', 'tech.inv01', ['Poste de travail', 'Messagerie'], 1, [], 0, 'Validé'],
  ['INV-02', 'inv-n1', 'tech.inv02', ['Comptes & accès', 'Messagerie'], 1, [], 1, 'Soumis'],
  ['INV-03', 'inv-n1', 'tech.inv03', ['Poste de travail', 'Impression'], 1, [], 0, 'Validé'],
  ['INV-04', 'inv-n1', 'tech.inv04', ['Applicatif métier'], 0.8, [], 0, 'À saisir'],
  ['INV-05', 'inv-n2', 'tech.inv05', ['Réseau', 'Poste de travail'], 1, [], 0, 'Validé'],
  ['INV-06', 'inv-n2', 'tech.inv06', ['Réseau', 'Applicatif métier'], 1, [3, 4], 1, 'Soumis'],
  ['PRI-01', 'pri-n1', 'PRI01', ['Poste de travail', 'Téléphonie'], 1, [], 0, 'Validé'],
  ['PRI-02', 'pri-n1', 'PRI02', ['Messagerie', 'Comptes & accès'], 1, [0, 1], 0, 'Validé'],
  ['PRI-03', 'pri-n1', 'PRI03', ['Applicatif métier'], 0.8, [], 2, 'À saisir'],
  ['PRI-04', 'pri-exp', 'PRI04', ['Exploitation', 'Réseau'], 1, [], 0, 'Soumis'],
  ['PRI-05', 'pri-exp', 'PRI05', ['Exploitation'], 1, [], 0, 'Validé'],
  ['MNX-01', 'mnx-n1', 'mnx01', ['Monétique', 'Comptes & accès'], 1, [], 0, 'Validé'],
  ['MNX-02', 'mnx-n1', 'mnx02', ['Monétique', 'Poste de travail'], 1, [], 1, 'Validé'],
  ['MNX-03', 'mnx-n1', 'mnx03', ['Monétique', 'Réseau'], 1, [], 0, 'Soumis'],
  ['MNX-04', 'mnx-n2', 'mnx04', ['Applicatif métier', 'Monétique'], 1, [], 0, 'À saisir'],
  ['MNX-05', 'mnx-n2', 'mnx05', ['Applicatif métier', 'Réseau'], 1, [], 0, 'Validé'],
];

/** Techniciens fictifs ; les congés sont positionnés relativement à `now` (n-ième jour ouvré). */
export function buildTechnicians(now: number): Technician[] {
  return techSeeds.map(([code, teamId, login, skills, availability, leave, pendingLeave, craStatus]) => {
    const team = externalTeams.find((t) => t.id === teamId)!;
    const client = externalClients.find((c) => c.id === team.clientId)!;
    const days = nextBusinessDays(now, 6, client.calendar);
    const hoursPerDay = 7;
    return {
      id: `tech-${code.toLowerCase()}`,
      name: `Tech. ${code}`,
      clientId: team.clientId,
      teamId,
      contractId: team.contractId,
      sourceLogin: login,
      skills,
      hoursPerDay,
      availability,
      leaveDates: leave.map((i) => dateKey(days[i] ?? addDays(now, i))),
      pendingLeaveRequests: pendingLeave,
      cra: { status: craStatus, hours: craStatus === 'À saisir' ? 0 : Math.round(hoursPerDay * availability * 4) },
    };
  });
}

export interface ObjectiveConfig {
  /** Volume : tickets à résoudre sur la semaine. */
  ticketsToResolve: number;
  /** Volume : backlog maximum. */
  backlogMax: number;
  /** Volume : tickets prioritaires (P1/P2) ouverts au maximum. */
  priorityOpenMax: number;
  /** Qualité : taux de respect SLA minimum (%). */
  slaMin: number;
  /** Qualité : délai moyen de prise en charge maximum (minutes ouvrées). */
  takeChargeMaxMin: number;
  /** Qualité : temps moyen de résolution maximum (heures ouvrées). */
  resolutionMaxH: number;
  /** Qualité : taux de réouverture maximum (%). */
  reopenRateMax: number;
}

export const defaultObjectives: Record<ExternalClientId, ObjectiveConfig> = {
  invivo: { ticketsToResolve: 95, backlogMax: 36, priorityOpenMax: 3, slaMin: 90, takeChargeMaxMin: 150, resolutionMaxH: 18, reopenRateMax: 5 },
  primagaz: { ticketsToResolve: 75, backlogMax: 34, priorityOpenMax: 3, slaMin: 90, takeChargeMaxMin: 210, resolutionMaxH: 26, reopenRateMax: 5 },
  monext: { ticketsToResolve: 80, backlogMax: 26, priorityOpenMax: 2, slaMin: 92, takeChargeMaxMin: 120, resolutionMaxH: 16, reopenRateMax: 4 },
};

export function clientById(id: string): ExternalClient {
  const c = externalClients.find((x) => x.id === id);
  if (!c) throw new Error(`Client externe inconnu : ${id}`);
  return c;
}

export const teamsOf = (clientId: string) => externalTeams.filter((t) => t.clientId === clientId);
export const contractById = (id: string) => contracts.find((c) => c.id === id)!;
