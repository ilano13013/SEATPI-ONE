// Clients des plateaux internes pour lesquels un outil ITSM est renseigné.
// Calendriers, matrices SLA et volumes sont des valeurs de DÉMONSTRATION.
import type { Agent } from '../types';
import type { ExternalClient, ExternalClientId, Technician } from '../external/types';
import { clientRecord, itsmOf } from '../config/itsm';
import { helpdeskPoles } from '../data/layout';
import { siteById } from '../data/sites';
import { internalTeams, internalTicketClients } from './teams';

const HOLIDAYS_FR = ['2026-11-01', '2026-11-11', '2026-12-25', '2027-01-01', '2027-03-29', '2027-05-01', '2027-05-08', '2027-07-14', '2027-08-15'];

export const internalClients: ExternalClient[] = internalTicketClients.map(({ clientId, poleId }) => {
  const pole = helpdeskPoles.find((p) => p.clientId === poleId)!;
  return {
    // Les fonctions du pipeline n'utilisent l'identifiant que comme clé : conversion de type contrôlée.
    id: clientId as ExternalClientId,
    name: clientRecord(clientId)?.name ?? clientId.toUpperCase(),
    tool: itsmOf(clientId),
    accent: pole.color,
    sites: [`Plateau ${siteById(pole.site).name}`],
    categories: ['Poste de travail', 'Messagerie', 'Comptes & accès', 'Applicatif métier', 'Impression', 'Téléphonie'],
    calendar: { label: 'Lun–Ven 8h–18h (démonstration)', days: [1, 2, 3, 4, 5], startHour: 8, endHour: 18, holidays: HOLIDAYS_FR },
    sla: { P1: { takeChargeMin: 15, resolutionMin: 240 }, P2: { takeChargeMin: 30, resolutionMin: 480 }, P3: { takeChargeMin: 60, resolutionMin: 960 }, P4: { takeChargeMin: 240, resolutionMin: 2400 } },
    slaPauseStatuses: ['En attente'],
    ratePerDay: 7,
  };
});

export const internalClientById = (id: string) => internalClients.find((c) => c.id === id);

/** Agents des pôles vus comme techniciens N1 (une entrée par client traité, même identifiant de personne). */
export function internalTechnicians(agents: Agent[]): Technician[] {
  return internalTicketClients.flatMap(({ clientId, poleId }) => {
    const team = internalTeams.find((t) => t.clientId === clientId)!;
    return agents
      .filter((a) => a.clientId === poleId)
      .map((a) => ({
        id: a.id,
        name: a.name,
        clientId: clientId as ExternalClientId,
        teamId: team.id,
        contractId: team.contractId,
        sourceLogin: `n1.${a.id}`,
        skills: ['Support N1'],
        hoursPerDay: 7,
        availability: 1,
        leaveDates: [],
        pendingLeaveRequests: 0,
        cra: { status: 'Soumis' as const, hours: 0 },
      }));
  });
}
