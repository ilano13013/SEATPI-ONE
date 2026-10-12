// Synchronisation planifiée : lecture brute → normalisation → déduplication →
// rattachement au référentiel interne (identifiant unique SPI-xxxxxx).
import type { ExternalClient, ExternalClientId, ItsmTool, NormalizedRecord, Technician, Ticket } from './types';
import type { Rng } from '../services/random';
import { adapters, MappingError, type ItsmAdapter } from './itsm/adapters';
import { ticketTeams as externalTeams, teamsForClient } from '../helpdesk/teams';
import { computeSla, firstTakenAt } from './sla';

export interface SyncStats {
  received: number;
  duplicates: number;
  rejected: number;
  created: number;
  updated: number;
  unchanged: number;
}

export interface SyncLogEntry {
  at: number;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export type ConnectionStatus = 'connecté' | 'dégradé' | 'erreur' | 'non configuré';

export interface ConnectorState {
  clientId: ExternalClientId;
  tool: ItsmTool | null;
  status: ConnectionStatus;
  intervalMin: number;
  lastAttemptAt: number;
  lastSuccessAt: number | null;
  nextSyncAt: number;
  lastStats: SyncStats | null;
  log: SyncLogEntry[];
}

/**
 * Référentiel des identifiants : `outil:client:idSource` → identifiant interne.
 * Le client fait partie de la clé : deux clients sur le même outil ont des instances distinctes.
 */
export interface IdRegistry {
  next: number;
  map: Record<string, string>;
}

/** Référentiel vide ; `start` permet de réserver une plage d'identifiants (plateaux internes : 100001+). */
export const emptyRegistry = (start = 1): IdRegistry => ({ next: start, map: {} });

export function registerId(registry: IdRegistry, tool: ItsmTool, sourceId: string, clientId = ''): [IdRegistry, string] {
  const key = `${tool}:${clientId}:${sourceId}`;
  const existing = registry.map[key];
  if (existing) return [registry, existing];
  const id = `SPI-${String(registry.next).padStart(6, '0')}`;
  return [{ next: registry.next + 1, map: { ...registry.map, [key]: id } }, id];
}

/** Conserve un seul enregistrement par identifiant source : le plus récemment modifié. */
export function dedupeRaw<R>(records: R[], adapter: ItsmAdapter<R>): { unique: R[]; duplicates: number } {
  const byId = new Map<string, R>();
  for (const r of records) {
    const id = adapter.sourceIdOf(r);
    const prev = byId.get(id);
    if (!prev || adapter.updatedAtOf(r) > adapter.updatedAtOf(prev)) byId.set(id, r);
  }
  return { unique: [...byId.values()], duplicates: records.length - byId.size };
}

/** Lecture simulée de l'API source : flux brut avec ses imperfections réelles. */
export function readSource(client: ExternalClient, records: NormalizedRecord[], rng: Rng): unknown[] {
  if (!client.tool) return [];
  const adapter = adapters[client.tool];
  const raw: unknown[] = records.map((r) => adapter.exportRaw(r));
  if ((client.tool === 'ISILOG' || client.tool === 'Jira') && raw.length > 3) {
    // Recouvrement de pagination : les derniers éléments reviennent deux fois.
    raw.push(...raw.slice(-3).map((r) => structuredClone(r)));
    // Statut personnalisé ajouté côté client et pas encore mappé.
    const odd = adapter.exportRaw({ ...records[0], sourceId: `${records[0].sourceId}-X` }) as Record<string, unknown>;
    if (client.tool === 'ISILOG') odd.state = 'En attente fournisseur';
    else (odd as { fields: { status: { name: string } } }).fields.status.name = 'Pending vendor';
    raw.push(odd);
  }
  if ((client.tool === 'EasyVista' || client.tool === 'GLPI') && records.length) {
    // Ancienne version d'un ticket renvoyée par l'API (date de modification antérieure).
    const target = records[Math.floor(rng() * records.length)];
    raw.push(adapter.exportRaw({ ...target, updatedAt: target.updatedAt - 3_600_000, status: 'Nouveau' }));
  }
  return raw;
}

export function toTicket(
  rec: NormalizedRecord,
  id: string,
  client: ExternalClient,
  techs: Technician[],
  now: number,
  warn: (m: string) => void,
  original?: { status: string; priority: string },
): Ticket {
  const tool = client.tool!;
  const team = teamsForClient(client).find((t) => t.sourceGroup === rec.group);
  if (!team) warn(`${rec.sourceId} : groupe source « ${rec.group} » non mappé, rattaché à l'équipe par défaut`);
  const teamId = team?.id ?? teamsForClient(client)[0].id;
  const tech = rec.assigneeLogin ? techs.find((t) => t.clientId === client.id && t.sourceLogin === rec.assigneeLogin) : undefined;
  if (rec.assigneeLogin && !tech) warn(`${rec.sourceId} : utilisateur source « ${rec.assigneeLogin} » inconnu`);
  const statusEvents = rec.history.filter((e) => e.kind === 'statut');
  const lastTo = (s: string) => [...statusEvents].reverse().find((e) => e.to === s)?.at ?? null;
  const takenAt = firstTakenAt(rec.history);
  const resolved = rec.status === 'Résolu' || rec.status === 'Clôturé';
  const contractId = team ? team.contractId : externalTeams.find((t) => t.id === teamId)!.contractId;
  return {
    id,
    source: { tool, id: rec.sourceId },
    sourceStatus: original?.status ?? adapters[tool].statusToRaw[rec.status],
    sourcePriority: original?.priority ?? adapters[tool].priorityToRaw[rec.priority],
    clientId: client.id,
    site: rec.site,
    contractId,
    title: rec.title,
    description: rec.description,
    category: rec.category,
    priority: rec.priority,
    status: rec.status,
    assigneeId: tech?.id ?? null,
    teamId,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    takenAt,
    resolvedAt: resolved ? lastTo('Résolu') : null,
    closedAt: rec.status === 'Clôturé' ? lastTo('Clôturé') : null,
    timeSpentMin: rec.timeSpentMin,
    reopenCount: statusEvents.filter((e) => e.to === 'Réouvert').length,
    sla: computeSla({ createdAt: rec.createdAt, history: rec.history, status: rec.status, priority: rec.priority, takenAt }, client, now),
    escalations: rec.escalations,
    history: rec.history,
  };
}

export interface SyncResult {
  tickets: Ticket[];
  registry: IdRegistry;
  stats: SyncStats;
  log: SyncLogEntry[];
}

/** Synchronise un client : fonction pure, rejouable et testable. */
export function syncClient(client: ExternalClient, raw: unknown[], previous: Ticket[], registry: IdRegistry, techs: Technician[], now: number): SyncResult {
  if (!client.tool) {
    return { tickets: [], registry, stats: { received: 0, duplicates: 0, rejected: 0, created: 0, updated: 0, unchanged: 0 }, log: [{ at: now, level: 'warn', message: `${client.name} : ITSM NON RENSEIGNÉ — CONFIGURATION REQUISE. Aucune synchronisation.` }] };
  }
  const adapter = adapters[client.tool];
  const log: SyncLogEntry[] = [];
  const { unique, duplicates } = dedupeRaw(raw, adapter);
  if (duplicates) log.push({ at: now, level: 'info', message: `${duplicates} doublon(s) écarté(s) (même identifiant source)` });
  const prevById = new Map(previous.map((t) => [t.id, t]));
  const tickets: Ticket[] = [];
  const stats: SyncStats = { received: raw.length, duplicates, rejected: 0, created: 0, updated: 0, unchanged: 0 };
  let reg = registry;
  for (const r of unique) {
    let rec: NormalizedRecord;
    try {
      rec = adapter.normalize(r);
    } catch (e) {
      if (!(e instanceof MappingError)) throw e;
      stats.rejected++;
      log.push({ at: now, level: 'warn', message: `${e.sourceId} ignoré : ${e.message} (à ajouter à la table de correspondance)` });
      continue;
    }
    let id: string;
    [reg, id] = registerId(reg, client.tool, rec.sourceId, client.id);
    const ticket = toTicket(rec, id, client, techs, now, (m) => log.push({ at: now, level: 'warn', message: m }), {
      status: adapter.sourceStatusOf(r),
      priority: adapter.sourcePriorityOf(r),
    });
    const prev = prevById.get(id);
    if (!prev) stats.created++;
    else if (prev.updatedAt !== ticket.updatedAt || prev.status !== ticket.status) stats.updated++;
    else stats.unchanged++;
    tickets.push(ticket);
  }
  log.push({ at: now, level: 'info', message: `Synchronisation ${client.tool} : ${stats.created} créé(s), ${stats.updated} mis à jour, ${stats.rejected} rejeté(s)` });
  return { tickets, registry: reg, stats, log };
}
