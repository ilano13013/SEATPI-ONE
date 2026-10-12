import type { ExternalClientId, NormalizedRecord, Ticket, TicketEvent } from '../types';
import { buildTechnicians, clientById, externalClients } from '../config';
import { generateSource } from '../source';
import { emptyRegistry, readSource, syncClient, toTicket, type IdRegistry } from '../sync';
import { createRng } from '../../services/random';

/** Mercredi 14 octobre 2026, 15:30 (heure locale). */
export const NOW = new Date(2026, 9, 14, 15, 30).getTime();
export const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();

export const techs = buildTechnicians(NOW);

export function dataset(seed = 11) {
  let registry: IdRegistry = emptyRegistry();
  const sources = {} as Record<ExternalClientId, NormalizedRecord[]>;
  const tickets = {} as Record<ExternalClientId, Ticket[]>;
  const stats = {} as Record<ExternalClientId, ReturnType<typeof syncClient>['stats']>;
  for (const c of externalClients) {
    const rng = createRng(seed);
    sources[c.id] = generateSource(c, techs, NOW, rng);
    const res = syncClient(c, readSource(c, sources[c.id], rng), [], registry, techs, NOW);
    registry = res.registry;
    tickets[c.id] = res.tickets;
    stats[c.id] = res.stats;
  }
  return { sources, tickets, registry, stats };
}

/** Construit un ticket INVIVO à partir d'une suite de statuts [jour, heure, minute, statut]. */
export function ticketFrom(createdAt: number, steps: [number, string][], priority: 'P1' | 'P2' | 'P3' | 'P4' = 'P2', now = NOW): Ticket {
  const history: TicketEvent[] = [{ at: createdAt, kind: 'création', by: 'test' }];
  let prev = 'Nouveau';
  for (const [t, s] of steps) {
    history.push({ at: t, kind: 'statut', from: prev, to: s, by: 'test' });
    prev = s;
  }
  const rec: NormalizedRecord = {
    sourceId: `T-${createdAt}-${steps.length}`,
    site: 'Siège',
    title: 'Test',
    description: 'Test',
    category: 'Poste de travail',
    priority,
    status: prev as NormalizedRecord['status'],
    assigneeLogin: 'tech.inv01',
    group: 'GRP_MCO_N2',
    createdAt,
    updatedAt: history[history.length - 1].at,
    timeSpentMin: 30,
    history,
    escalations: [],
  };
  return toTicket(rec, rec.sourceId, clientById('invivo'), techs, now, () => {});
}
