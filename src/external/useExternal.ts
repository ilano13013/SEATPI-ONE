import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExternalClientId, NormalizedRecord, Service, Technician, Ticket, TicketStatus } from './types';
import { buildTechnicians, defaultObjectives, externalClients, type ObjectiveConfig, clientById } from './config';
import { generateSource, evolveSource, applyTransition, applyAssignment } from './source';
import { emptyRegistry, readSource, syncClient, type ConnectorState, type IdRegistry, type SyncLogEntry } from './sync';
import { adapters, checkTransition } from './itsm/adapters';
import { defaultAlertSettings, type AlertSettings } from './alerts';
import { createRng, type Rng } from '../services/random';
import { can, type Role } from '../auth/roles';
import { evolveTrips, initialTrips, type Trip } from './trips';

/** Intervalle contractuel de synchronisation (minutes) — accéléré en démo. */
export const SYNC_INTERVAL_MIN = 15;
export const DEMO_SYNC_SECONDS = 45;
// v2 : organisation N2 uniquement (cibles recalibrées).
const OBJECTIVES_KEY = 'seatpi.externes.objectifs.v2';

export interface ExternalState {
  now: number;
  techs: Technician[];
  sources: Record<ExternalClientId, NormalizedRecord[]>;
  tickets: Record<ExternalClientId, Ticket[]>;
  registry: IdRegistry;
  connectors: Record<ExternalClientId, ConnectorState>;
  objectives: Record<ExternalClientId, ObjectiveConfig>;
  alertSettings: AlertSettings;
  writes: SyncLogEntry[];
  /** Déplacements des managers CSM (en cours et terminés récemment). */
  trips: Trip[];
}

export interface ActionResult {
  ok: boolean;
  message: string;
}

function loadObjectives(): Record<ExternalClientId, ObjectiveConfig> {
  try {
    const raw = localStorage.getItem(OBJECTIVES_KEY);
    if (raw) return { ...defaultObjectives, ...JSON.parse(raw) };
  } catch {
    /* stockage indisponible : valeurs par défaut */
  }
  return structuredClone(defaultObjectives);
}

function saveObjectives(o: Record<ExternalClientId, ObjectiveConfig>) {
  try {
    localStorage.setItem(OBJECTIVES_KEY, JSON.stringify(o));
  } catch {
    /* ignoré */
  }
}

type SyncMode = { evolve: boolean; mayFail: boolean };

function runSync(state: ExternalState, ids: ExternalClientId[], now: number, rngs: Record<string, Rng>, mode: SyncMode): ExternalState {
  let next: ExternalState = { ...state, now, sources: { ...state.sources }, tickets: { ...state.tickets }, connectors: { ...state.connectors } };
  for (const id of ids) {
    const client = clientById(id);
    const rng = rngs[id];
    const prev = next.connectors[id];
    let source = next.sources[id];
    if (mode.evolve) source = evolveSource(source, client, next.techs, now, rng);
    next.sources[id] = source;
    // Panne simulée du connecteur Jira (limite d'API) : les données précédentes sont conservées.
    if (mode.mayFail && client.tool === 'Jira' && rng() < 0.2) {
      next.connectors[id] = {
        ...prev,
        status: 'erreur',
        lastAttemptAt: now,
        nextSyncAt: now + SYNC_INTERVAL_MIN * 60_000,
        log: [{ at: now, level: 'error' as const, message: 'HTTP 429 : limite d’API atteinte. Données précédentes conservées, nouvelle tentative planifiée.' }, ...prev.log].slice(0, 30),
      };
      continue;
    }
    const res = syncClient(client, readSource(client, source, rng), next.tickets[id] ?? [], next.registry, next.techs, now);
    next = { ...next, registry: res.registry };
    next.tickets[id] = res.tickets;
    next.connectors[id] = {
      clientId: id,
      tool: client.tool,
      status: res.stats.rejected ? 'dégradé' : 'connecté',
      intervalMin: SYNC_INTERVAL_MIN,
      lastAttemptAt: now,
      lastSuccessAt: now,
      nextSyncAt: now + SYNC_INTERVAL_MIN * 60_000,
      lastStats: res.stats,
      log: [...res.log.reverse(), ...(prev?.log ?? [])].slice(0, 30),
    };
  }
  if (mode.evolve) next.trips = evolveTrips(next.trips, now, rngs.trips, openCsmEscalations(next));
  return next;
}

/** Clients ayant une escalade contractuelle (vers le CSM) en cours. */
function openCsmEscalations(s: ExternalState): Set<string> {
  return new Set(
    externalClients.filter((c) => (s.tickets[c.id] ?? []).some((t) => t.escalations.some((e) => e.to === 'CSM' && e.status === 'En cours'))).map((c) => c.id),
  );
}

function initialState(seed: number): { state: ExternalState; rngs: Record<string, Rng> } {
  const now = Date.now();
  const techs = buildTechnicians(now);
  const rngs: Record<string, Rng> = { ...Object.fromEntries(externalClients.map((c, i) => [c.id, createRng(seed + i * 101)])), trips: createRng(seed + 7) };
  const sources = Object.fromEntries(externalClients.map((c) => [c.id, generateSource(c, techs, now, rngs[c.id])])) as ExternalState['sources'];
  const base: ExternalState = {
    now,
    techs,
    sources,
    tickets: {} as ExternalState['tickets'],
    registry: emptyRegistry(),
    connectors: {} as ExternalState['connectors'],
    objectives: loadObjectives(),
    alertSettings: defaultAlertSettings,
    writes: [],
    trips: [],
  };
  const synced = runSync(base, externalClients.map((c) => c.id), now, rngs, { evolve: false, mayFail: false });
  const trips = initialTrips(now, rngs.trips, openCsmEscalations(synced));
  return { state: { ...synced, trips }, rngs };
}

export function useExternal(running: boolean, seed = 2026) {
  const init = useRef<ReturnType<typeof initialState>>();
  if (!init.current) init.current = initialState(seed);
  const rngs = useRef(init.current.rngs);
  const [state, setState] = useState<ExternalState>(init.current.state);
  // Référence synchrone : les écritures doivent renvoyer leur résultat immédiatement.
  const stateRef = useRef(state);
  stateRef.current = state;

  const syncNow = useCallback((ids: ExternalClientId[] = externalClients.map((c) => c.id)) => {
    setState((s) => runSync(s, ids, Date.now(), rngs.current, { evolve: true, mayFail: true }));
  }, []);

  // Synchronisation planifiée (accélérée en démo), suspendue si l'onglet est masqué.
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') syncNow();
    }, DEMO_SYNC_SECONDS * 1000);
    return () => window.clearInterval(id);
  }, [running, syncNow]);

  const findTicket = (s: ExternalState, ticketId: string) => {
    for (const c of externalClients) {
      const t = s.tickets[c.id]?.find((x) => x.id === ticketId);
      if (t) return t;
    }
    return undefined;
  };

  const write = useCallback((ticketId: string, role: Role, op: (t: Ticket, s: ExternalState) => ActionResult & { records?: NormalizedRecord[] }): ActionResult => {
    const s = stateRef.current;
    const t = findTicket(s, ticketId);
    if (!t) return { ok: false, message: 'Ticket introuvable.' };
    if (!can(role, 'externes', 'edit')) return { ok: false, message: 'Votre rôle ne permet pas de modifier les tickets (maquette).' };
    const r = op(t, s);
    if (!r.ok || !r.records) return { ok: r.ok, message: r.message };
    const now = Date.now();
    const client = clientById(t.clientId);
    const synced = runSync({ ...s, sources: { ...s.sources, [t.clientId]: r.records } }, [t.clientId], now, rngs.current, { evolve: false, mayFail: false });
    const entry: SyncLogEntry = { at: now, level: 'info', message: `Écriture simulée vers ${client.tool} (${t.source.id}) : ${r.message}` };
    const next = { ...synced, writes: [entry, ...s.writes].slice(0, 50) };
    stateRef.current = next;
    setState(next);
    return { ok: true, message: r.message };
  }, []);

  const moveTicket = useCallback(
    (ticketId: string, to: TicketStatus, role: Role, escalateTo?: Service) =>
      write(ticketId, role, (t, s) => {
        const check = checkTransition(adapters[t.source.tool], t.status, to);
        if (!check.ok) return { ok: false, message: check.reason! };
        const res = applyTransition(s.sources[t.clientId], t.source.id, to, 'Responsable (SEATPI ONE)', Date.now(), clientById(t.clientId), escalateTo);
        return { ok: res.ok, message: res.ok ? `${t.id} : ${res.message}` : res.message, records: res.records };
      }),
    [write],
  );

  const assignTicket = useCallback(
    (ticketId: string, techId: string, role: Role) =>
      write(ticketId, role, (t, s) => {
        if (!adapters[t.source.tool].capabilities.canAssign) return { ok: false, message: `${t.source.tool} : l’affectation se fait dans l’outil source (connecteur en lecture seule).` };
        const tech = s.techs.find((x) => x.id === techId);
        if (!tech) return { ok: false, message: 'Technicien inconnu.' };
        const res = applyAssignment(s.sources[t.clientId], t.source.id, tech.sourceLogin, 'Responsable (SEATPI ONE)', Date.now());
        return { ok: res.ok, message: res.ok ? `${t.id} affecté à ${tech.name}` : res.message, records: res.records };
      }),
    [write],
  );

  const setObjective = useCallback((clientId: ExternalClientId, key: keyof ObjectiveConfig, value: number) => {
    setState((s) => {
      const objectives = { ...s.objectives, [clientId]: { ...s.objectives[clientId], [key]: value } };
      saveObjectives(objectives);
      return { ...s, objectives };
    });
  }, []);

  const resetObjectives = useCallback((clientId: ExternalClientId) => {
    setState((s) => {
      const objectives = { ...s.objectives, [clientId]: { ...defaultObjectives[clientId] } };
      saveObjectives(objectives);
      return { ...s, objectives };
    });
  }, []);

  const setStaleHours = useCallback((staleHours: number) => {
    setState((s) => ({ ...s, alertSettings: { ...s.alertSettings, staleHours } }));
  }, []);

  return { state, syncNow, moveTicket, assignTicket, setObjective, resetObjectives, setStaleHours };
}

export type ExternalStore = ReturnType<typeof useExternal>;
