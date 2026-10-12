import { describe, expect, it } from 'vitest';
import { createInitialState } from '../data/demoData';
import { ConnectorNotConfiguredError, DemoConnector, genesysConnector, glpiConnector, qlikConnector } from './connectors';

describe('connecteurs', () => {
  it('le connecteur de démo renvoie les données avec leur fraîcheur', async () => {
    const state = createInitialState(1234);
    const connector = new DemoConnector(() => state);
    const queues = await connector.listQueues();
    expect(queues.data).toHaveLength(state.queues.length);
    expect(queues.freshness).toEqual({ asOf: 1234, source: 'demo' });
    const tickets = await connector.listTickets({ clientId: 'ortec' });
    expect(tickets.data.every((t) => t.clientId === 'ortec')).toBe(true);
  });

  it('les connecteurs réels refusent tout appel tant qu’ils ne sont pas validés', async () => {
    await expect(genesysConnector.listQueues()).rejects.toBeInstanceOf(ConnectorNotConfiguredError);
    await expect(glpiConnector.listTickets()).rejects.toBeInstanceOf(ConnectorNotConfiguredError);
    await expect(qlikConnector.getIndicator('sla')).rejects.toBeInstanceOf(ConnectorNotConfiguredError);
  });
});
