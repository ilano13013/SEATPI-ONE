// Équipes de traitement des tickets : équipes N2 chez les clients externes et
// équipes N1 des pôles des plateaux internes (une équipe par client traité).
import type { ExternalClient, ExternalTeam } from '../external/types';
import { externalTeams } from '../external/config';
import { n1Clients, itsmOf } from '../config/itsm';
import { helpdeskPoles } from '../data/layout';

/** Clients traités en N1 disposant d'un outil ITSM, avec les pôles qui les prennent en charge. */
export const internalTicketClients: { clientId: string; poleIds: string[] }[] = n1Clients.filter((c) => itsmOf(c.clientId));

export const internalTeams: ExternalTeam[] = internalTicketClients.map(({ clientId, poleIds }) => ({
  id: `int-${clientId}`,
  clientId: clientId as ExternalTeam['clientId'],
  name: helpdeskPoles.find((p) => p.clientId === poleIds[0])?.label ?? poleIds[0],
  service: 'Helpdesk N1',
  contractId: `CTR-INT-${clientId.toUpperCase()}`,
  sourceGroup: `N1_${clientId.toUpperCase()}`,
}));

/** Toutes les équipes connues du référentiel de tickets. */
export const ticketTeams: ExternalTeam[] = [...externalTeams, ...internalTeams];

/** Équipes d'un client pour le niveau traité (INVIVO : N1 Pôle Multi et N2 chez le client sont distincts). */
export const teamsForClient = (client: Pick<ExternalClient, 'id' | 'level'>) =>
  ticketTeams.filter((t) => t.clientId === client.id && (client.level === 'N1') === (t.service === 'Helpdesk N1'));
