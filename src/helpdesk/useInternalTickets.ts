// Tickets des plateaux internes (Helpdesk N1), issus des outils ITSM de référence.
// Même pipeline que les sites clients externes : source simulée → adaptateur →
// déduplication → référentiel interne. Aucun appel réseau.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Agent } from '../types';
import type { NormalizedRecord, Service, Technician, Ticket, TicketStatus } from '../external/types';
import { generateSource, evolveSource, applyAssignment, applyTransition } from '../external/source';
import { emptyRegistry, readSource, syncClient, type IdRegistry, type SyncLogEntry } from '../external/sync';
import { adapters, checkTransition } from '../external/itsm/adapters';
import { createRng, type Rng } from '../services/random';
import { can, type Role } from '../auth/roles';
import { createInitialState } from '../data/demoData';
import { internalClients, internalClientById, internalTechnicians } from './internalClients';
import { internalTeams } from './teams';
import type { ActionResult, NewTicketInput } from '../external/useExternal';

export interface InternalTicketState {
  now: number;
  techs: Technician[];
  sources: Record<string, NormalizedRecord[]>;
  tickets: Record<string, Ticket[]>;
  registry: IdRegistry;
  lastSync: number;
  writes: SyncLogEntry[];
}

/** Plage d'identifiants internes réservée aux plateaux (SPI-100001…) : unicité dans le référentiel. */
export const INTERNAL_ID_START = 100001;

function syncAll(s: InternalTicketState, ids: string[], now: number, rngs: Record<string, Rng>, evolve: boolean): InternalTicketState {
  let next: InternalTicketState = { ...s, now, lastSync: now, sources: { ...s.sources }, tickets: { ...s.tickets } };
  for (const id of ids) {
    const client = internalClientById(id)!;
    let source = next.sources[id];
    if (evolve) source = evolveSource(source, client, next.techs, now, rngs[id]);
    next.sources[id] = source;
    const res = syncClient(client, readSource(client, source, rngs[id]), next.tickets[id] ?? [], next.registry, next.techs, now);
    next = { ...next, registry: res.registry };
    next.tickets[id] = res.tickets;
  }
  return next;
}

export function initialInternalState(seed: number, agents: Agent[] = createInitialState().agents, now = Date.now()) {
  const techs = internalTechnicians(agents);
  const rngs = Object.fromEntries(internalClients.map((c, i) => [c.id, createRng(seed + 31 * (i + 1))]));
  const sources = Object.fromEntries(internalClients.map((c) => [c.id, generateSource(c, techs, now, rngs[c.id])]));
  const base: InternalTicketState = { now, techs, sources, tickets: {}, registry: emptyRegistry(INTERNAL_ID_START), lastSync: now, writes: [] };
  return { state: syncAll(base, internalClients.map((c) => c.id), now, rngs, false), rngs };
}

export function useInternalTickets(running: boolean, syncSeconds = 45, seed = 4242) {
  const init = useRef<ReturnType<typeof initialInternalState>>();
  if (!init.current) init.current = initialInternalState(seed);
  const rngs = useRef(init.current.rngs);
  const [state, setState] = useState(init.current.state);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setState((s) => syncAll(s, internalClients.map((c) => c.id), Date.now(), rngs.current, true));
    }, syncSeconds * 1000);
    return () => window.clearInterval(id);
  }, [running, syncSeconds]);

  const commit = (clientId: string, records: NormalizedRecord[], message: string): void => {
    const s = stateRef.current;
    const now = Date.now();
    const synced = syncAll({ ...s, sources: { ...s.sources, [clientId]: records } }, [clientId], now, rngs.current, false);
    const next = { ...synced, writes: [{ at: now, level: 'info' as const, message }, ...s.writes].slice(0, 50) };
    stateRef.current = next;
    setState(next);
  };

  const find = (ticketId: string) => Object.values(stateRef.current.tickets).flat().find((t) => t.id === ticketId);

  const moveTicket = useCallback((ticketId: string, to: TicketStatus, role: Role, escalateTo?: Service): ActionResult => {
    const t = find(ticketId);
    if (!t) return { ok: false, message: 'Ticket introuvable.' };
    if (!can(role, 'supervision', 'edit')) return { ok: false, message: 'Votre rôle ne permet pas de modifier les tickets (maquette).' };
    const check = checkTransition(adapters[t.source.tool], t.status, to);
    if (!check.ok) return { ok: false, message: check.reason! };
    const client = internalClientById(t.clientId)!;
    const res = applyTransition(stateRef.current.sources[t.clientId], t.source.id, to, 'Manager (SEATPI ONE)', Date.now(), client, escalateTo ?? 'MCO N2');
    if (!res.ok) return { ok: false, message: res.message };
    commit(t.clientId, res.records, `Écriture simulée vers ${t.source.tool} (${t.source.id}) : ${res.message}`);
    return { ok: true, message: `${t.id} : ${res.message}` };
  }, []);

  const assignTicket = useCallback((ticketId: string, techId: string, role: Role): ActionResult => {
    const t = find(ticketId);
    if (!t) return { ok: false, message: 'Ticket introuvable.' };
    if (!can(role, 'supervision', 'edit')) return { ok: false, message: 'Votre rôle ne permet pas de modifier les tickets (maquette).' };
    const tech = stateRef.current.techs.find((x) => x.id === techId && x.clientId === t.clientId);
    if (!tech) return { ok: false, message: 'Agent non rattaché à ce client.' };
    const res = applyAssignment(stateRef.current.sources[t.clientId], t.source.id, tech.sourceLogin, 'Manager (SEATPI ONE)', Date.now());
    if (!res.ok) return { ok: false, message: res.message };
    commit(t.clientId, res.records, `Affectation simulée dans ${t.source.tool} (${t.source.id}) : ${tech.name}`);
    return { ok: true, message: `${t.id} affecté à ${tech.name}` };
  }, []);

  const createTicket = useCallback((clientId: string, input: NewTicketInput, role: Role): ActionResult => {
    const client = internalClientById(clientId);
    if (!client?.tool) return { ok: false, message: 'ITSM NON RENSEIGNÉ — CONFIGURATION REQUISE. Création impossible.' };
    if (!can(role, 'supervision', 'edit')) return { ok: false, message: 'Votre rôle ne permet pas de créer des tickets (maquette).' };
    if (!input.title.trim()) return { ok: false, message: 'Le titre est obligatoire.' };
    const team = internalTeams.find((t) => t.clientId === clientId)!;
    const records = stateRef.current.sources[clientId];
    const at = Math.floor(Date.now() / 60_000) * 60_000;
    const seq = records.length + 7001;
    const sourceId = client.tool === 'GLPI' ? String(60000 + seq) : client.tool === 'Jira' ? `${client.name.replace(/\W/g, '').slice(0, 3)}-${seq}` : client.tool === 'EasyVista' ? `I26_${String(20000 + seq).padStart(6, '0')}` : client.tool === 'Zendesk' ? String(90000 + seq) : client.tool === 'ServiceNow' ? `INC${String(90000 + seq).padStart(7, '0')}` : `ISL-${50000 + seq}`;
    const record: NormalizedRecord = {
      sourceId,
      site: client.sites[0],
      title: input.title.trim(),
      description: input.description.trim() || input.title.trim(),
      category: input.category || client.categories[0],
      priority: input.priority,
      status: 'Nouveau',
      assigneeLogin: null,
      group: team.sourceGroup,
      createdAt: at,
      updatedAt: at,
      timeSpentMin: 0,
      history: [{ at, kind: 'création', by: 'SEATPI ONE (démonstration)' }],
      escalations: [],
    };
    commit(clientId, [...records, record], `Création simulée dans ${client.tool} (${sourceId}) — démonstration, aucun envoi réel`);
    return { ok: true, message: `Ticket créé dans ${client.tool} (démonstration)` };
  }, []);

  const reset = useCallback(() => {
    const fresh = initialInternalState(seed);
    rngs.current = fresh.rngs;
    stateRef.current = fresh.state;
    setState(fresh.state);
  }, [seed]);

  return { state, moveTicket, assignTicket, createTicket, reset };
}

export type InternalTicketStore = ReturnType<typeof useInternalTickets>;
