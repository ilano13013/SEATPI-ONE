// Équipes de traitement des tickets : équipes N2 chez les clients externes et
// équipes N1 des pôles des plateaux internes (une équipe par client du pôle).
import type { ExternalTeam } from '../external/types';
import { externalTeams } from '../external/config';
import { POLE_CLIENTS, itsmOf } from '../config/itsm';
import { helpdeskPoles } from '../data/layout';

/** Clients internes disposant d'un outil ITSM, avec leur pôle. */
export const internalTicketClients: { clientId: string; poleId: string }[] = Object.entries(POLE_CLIENTS).flatMap(([poleId, clients]) =>
  clients.filter((c) => itsmOf(c)).map((clientId) => ({ clientId, poleId })),
);

export const internalTeams: ExternalTeam[] = internalTicketClients.map(({ clientId, poleId }) => ({
  id: `int-${clientId}`,
  clientId: clientId as ExternalTeam['clientId'],
  name: helpdeskPoles.find((p) => p.clientId === poleId)?.label ?? poleId,
  service: 'Helpdesk N1',
  contractId: `CTR-INT-${clientId.toUpperCase()}`,
  sourceGroup: `N1_${clientId.toUpperCase()}`,
}));

/** Toutes les équipes connues du référentiel de tickets. */
export const ticketTeams: ExternalTeam[] = [...externalTeams, ...internalTeams];
