// Interfaces des futurs connecteurs (cahier des charges §6).
//
// Les connecteurs réels (Genesys Cloud, GLPI, Qlik Sense) devront être appelés
// depuis un backend : OAuth côté serveur, scopes minimaux, aucun secret dans le
// navigateur. Le frontend ne consommera que l'API SEATPI ONE. Aucun appel réseau
// n'est effectué dans ce prototype.
import type { Agent, DemoState, Queue, TicketSummary } from '../types';

export interface Freshness {
  /** Horodatage UTC (ms) de la donnée source. */
  asOf: number;
  source: 'demo' | 'genesys' | 'glpi' | 'qlik';
}

export interface ConnectorResult<T> {
  data: T;
  freshness: Freshness;
}

export interface QueueConnector {
  listQueues(): Promise<ConnectorResult<Queue[]>>;
  listAgents(): Promise<ConnectorResult<Agent[]>>;
}

export interface TicketConnector {
  listTickets(filter?: { clientId?: string }): Promise<ConnectorResult<TicketSummary[]>>;
}

export interface ReportingConnector {
  getIndicator(id: string): Promise<ConnectorResult<number>>;
}

export class ConnectorNotConfiguredError extends Error {
  constructor(name: string) {
    super(`Connecteur ${name} non configuré : intégration soumise à validation préalable.`);
    this.name = 'ConnectorNotConfiguredError';
  }
}

/** Implémentation de démonstration qui lit l'état simulé courant. */
export class DemoConnector implements QueueConnector, TicketConnector {
  constructor(private readonly getState: () => DemoState) {}

  private wrap<T>(data: T): Promise<ConnectorResult<T>> {
    return Promise.resolve({ data, freshness: { asOf: this.getState().updatedAt, source: 'demo' } });
  }

  listQueues() {
    return this.wrap(this.getState().queues);
  }

  listAgents() {
    return this.wrap(this.getState().agents);
  }

  listTickets(filter?: { clientId?: string }) {
    const tickets = this.getState().tickets.filter((t) => !filter?.clientId || t.clientId === filter.clientId);
    return this.wrap(tickets);
  }
}

/** Emplacements réservés : refusent explicitement tout appel tant que non validés. */
export const genesysConnector: QueueConnector = {
  listQueues: () => Promise.reject(new ConnectorNotConfiguredError('Genesys Cloud')),
  listAgents: () => Promise.reject(new ConnectorNotConfiguredError('Genesys Cloud')),
};

export const glpiConnector: TicketConnector = {
  listTickets: () => Promise.reject(new ConnectorNotConfiguredError('GLPI')),
};

export const qlikConnector: ReportingConnector = {
  getIndicator: () => Promise.reject(new ConnectorNotConfiguredError('Qlik Sense')),
};
