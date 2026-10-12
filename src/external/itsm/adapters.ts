// Couche d'intégration ITSM : chaque outil a son format, ses statuts et ses priorités.
// Les adaptateurs convertissent les enregistrements bruts vers le modèle normalisé.
//
// SÉCURITÉ : en production, les appels aux API (jetons, OAuth) sont faits par le
// backend SEATPI ONE uniquement. Le navigateur ne voit jamais de jeton.
// Dans ce prototype, `exportRaw` simule la réponse de l'API source à partir de
// données fictives : aucun appel réseau n'est effectué.
import type { Escalation, EscalationStatus, ItsmTool, NormalizedRecord, Priority, Service, TicketEvent, TicketStatus } from '../types';

export const ALL_STATUSES: TicketStatus[] = ['Nouveau', 'Affecté', 'En cours', 'En attente', 'Bloqué', 'Escaladé', 'Résolu', 'Clôturé', 'Réouvert'];
export const ALL_PRIORITIES: Priority[] = ['P1', 'P2', 'P3', 'P4'];

export class MappingError extends Error {
  constructor(
    message: string,
    readonly sourceId: string,
  ) {
    super(message);
    this.name = 'MappingError';
  }
}

export type Transitions = 'libre' | 'aucune' | Partial<Record<TicketStatus, TicketStatus[]>>;

export interface Capabilities {
  mode: 'lecture-écriture' | 'lecture seule';
  canAssign: boolean;
  transitions: Transitions;
  /** Règle complémentaire, affichée dans l'interface. */
  note: string;
}

/** Entrées de journal et transferts, communs aux formats bruts (valeurs dans le vocabulaire de l'outil). */
interface RawLog {
  at: string;
  field: 'created' | 'status' | 'assignee' | 'comment' | 'escalation';
  from?: string | null;
  to?: string | null;
  by: string;
  note?: string;
}
interface RawTransfer {
  id: string;
  at: string;
  from: string;
  to: string;
  reason: string;
  owner: string;
  state: string;
  trail: { at: string; label: string }[];
}

export interface ItsmAdapter<R = unknown> {
  tool: ItsmTool;
  description: string;
  statusToRaw: Record<TicketStatus, string>;
  priorityToRaw: Record<Priority, string>;
  /** Valeurs brutes reconnues → statut normalisé (inclut les alias). */
  statusMap: Record<string, TicketStatus>;
  priorityMap: Record<string, Priority>;
  capabilities: Capabilities;
  sourceIdOf(raw: R): string;
  updatedAtOf(raw: R): number;
  /** Statut et priorité d'origine, conservés tels quels dans le référentiel. */
  sourceStatusOf(raw: R): string;
  sourcePriorityOf(raw: R): string;
  /** Champs exposés par le format brut (documentation du connecteur). */
  fields: string[];
  exportRaw(record: NormalizedRecord): R;
  normalize(raw: R): NormalizedRecord;
}

// --- Formats de date propres à chaque outil -------------------------------
const pad = (n: number) => String(n).padStart(2, '0');
const localSql = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const parseLocalSql = (s: string) => {
  const [date, time] = s.split(' ');
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm, ss] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, ss).getTime();
};
const frDate = (t: number) => {
  const d = new Date(t);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
const parseFrDate = (s: string) => {
  const [date, time] = s.split(' ');
  const [d, m, y] = date.split('/').map(Number);
  const [hh, mm, ss] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, ss).getTime();
};
const iso = (t: number) => new Date(t).toISOString();
const parseIso = (s: string) => Date.parse(s);

interface DateCodec {
  fmt: (t: number) => string;
  parse: (s: string) => number;
}

// --- Aides communes --------------------------------------------------------
function invert<K extends string>(map: Record<K, string>, aliases: Record<string, K> = {}): Record<string, K> {
  const out: Record<string, K> = { ...aliases };
  for (const [k, v] of Object.entries(map) as [K, string][]) out[v] = k;
  return out;
}

const FIELD_OF: Record<TicketEvent['kind'], RawLog['field']> = {
  création: 'created',
  statut: 'status',
  affectation: 'assignee',
  commentaire: 'comment',
  escalade: 'escalation',
};
const KIND_OF = Object.fromEntries(Object.entries(FIELD_OF).map(([k, v]) => [v, k])) as Record<RawLog['field'], TicketEvent['kind']>;

function encodeHistory(history: TicketEvent[], statusToRaw: Record<TicketStatus, string>, dates: DateCodec): RawLog[] {
  return history.map((e) => {
    const conv = (v: string | null | undefined) => (v == null ? null : e.kind === 'statut' ? statusToRaw[v as TicketStatus] : v);
    // Les champs absents (création, commentaire) restent absents : conversion sans perte.
    return {
      at: dates.fmt(e.at),
      field: FIELD_OF[e.kind],
      ...(e.from !== undefined ? { from: conv(e.from) } : {}),
      ...(e.to !== undefined ? { to: conv(e.to) } : {}),
      by: e.by,
      ...(e.note ? { note: e.note } : {}),
    };
  });
}

function decodeHistory(logs: RawLog[], mapStatus: (raw: string) => TicketStatus, dates: DateCodec): TicketEvent[] {
  return logs.map((l) => {
    const kind = KIND_OF[l.field];
    const conv = (v: string | null) => (v == null ? null : kind === 'statut' ? mapStatus(v) : v);
    return {
      at: dates.parse(l.at),
      kind,
      ...(l.from !== undefined ? { from: conv(l.from) } : {}),
      ...(l.to !== undefined ? { to: conv(l.to) } : {}),
      by: l.by,
      ...(l.note ? { note: l.note } : {}),
    };
  });
}

function encodeTransfers(escalations: Escalation[], dates: DateCodec): RawTransfer[] {
  return escalations.map((e) => ({
    id: e.id,
    at: dates.fmt(e.at),
    from: e.from,
    to: e.to,
    reason: e.reason,
    owner: e.owner,
    state: e.status,
    trail: e.history.map((h) => ({ at: dates.fmt(h.at), label: h.label })),
  }));
}

function decodeTransfers(transfers: RawTransfer[], dates: DateCodec): Escalation[] {
  return transfers.map((t) => ({
    id: t.id,
    at: dates.parse(t.at),
    from: t.from as Service,
    to: t.to as Service,
    reason: t.reason,
    owner: t.owner,
    status: t.state as EscalationStatus,
    history: t.trail.map((h) => ({ at: dates.parse(h.at), label: h.label })),
  }));
}

function mapper<K>(map: Record<string, K>, label: string, sourceId: string) {
  return (raw: string): K => {
    const v = map[raw];
    if (v === undefined) throw new MappingError(`${label} source inconnu « ${raw} »`, sourceId);
    return v;
  };
}

// --- GLPI --------------------------------------------------------------------
export interface RawGlpi {
  id: number;
  name: string;
  content: string;
  status: number;
  /** Motif d'attente ou marqueur personnalisé (blocage, escalade, réouverture). */
  pendingreason: string | null;
  priority: number;
  date: string;
  date_mod: string;
  itilcategory: string;
  location: string;
  users_id_assign: string | null;
  groups_id_assign: string;
  actiontime: number;
  logs: RawLog[];
  transfers: RawTransfer[];
}

const glpiStatus: Record<TicketStatus, string> = {
  Nouveau: '1',
  Affecté: '2',
  'En cours': '3',
  'En attente': '4',
  Bloqué: '4:blocage',
  Escaladé: '4:escalade',
  Résolu: '5',
  Clôturé: '6',
  Réouvert: '2:reouverture',
};
const glpiPriority: Record<Priority, string> = { P1: '5', P2: '4', P3: '3', P4: '2' };
const glpiDates: DateCodec = { fmt: localSql, parse: parseLocalSql };

export const glpiAdapter: ItsmAdapter<RawGlpi> = {
  tool: 'GLPI',
  description: 'API REST GLPI (statuts numériques + motifs d’attente)',
  statusToRaw: glpiStatus,
  priorityToRaw: glpiPriority,
  statusMap: invert(glpiStatus),
  priorityMap: invert(glpiPriority, { '6': 'P1', '1': 'P4' }),
  capabilities: {
    mode: 'lecture-écriture',
    canAssign: true,
    transitions: 'libre',
    note: 'Hypothèse de démonstration (droits non accordés). Clôture uniquement depuis Résolu ; un ticket clos ne peut qu’être réouvert.',
  },
  sourceIdOf: (r) => String(r.id),
  updatedAtOf: (r) => parseLocalSql(r.date_mod),
  sourceStatusOf: (r) => (r.pendingreason ? `${r.status}:${r.pendingreason}` : String(r.status)),
  sourcePriorityOf: (r) => String(r.priority),
  fields: ['id', 'name', 'content', 'status', 'pendingreason', 'priority', 'date', 'date_mod', 'itilcategory', 'location', 'users_id_assign', 'groups_id_assign', 'actiontime', 'logs', 'transfers'],
  exportRaw(r) {
    const [status, reason] = glpiStatus[r.status].split(':');
    return {
      id: Number(r.sourceId),
      name: r.title,
      content: r.description,
      status: Number(status),
      pendingreason: reason ?? null,
      priority: Number(glpiPriority[r.priority]),
      date: localSql(r.createdAt),
      date_mod: localSql(r.updatedAt),
      itilcategory: r.category,
      location: r.site,
      users_id_assign: r.assigneeLogin,
      groups_id_assign: r.group,
      actiontime: r.timeSpentMin * 60,
      logs: encodeHistory(r.history, glpiStatus, glpiDates),
      transfers: encodeTransfers(r.escalations, glpiDates),
    };
  },
  normalize(raw) {
    const id = String(raw.id);
    const status = mapper(this.statusMap, 'Statut', id);
    return {
      sourceId: id,
      site: raw.location,
      title: raw.name,
      description: raw.content,
      category: raw.itilcategory,
      priority: mapper(this.priorityMap, 'Priorité', id)(String(raw.priority)),
      status: status(raw.pendingreason ? `${raw.status}:${raw.pendingreason}` : String(raw.status)),
      assigneeLogin: raw.users_id_assign,
      group: raw.groups_id_assign,
      createdAt: parseLocalSql(raw.date),
      updatedAt: parseLocalSql(raw.date_mod),
      timeSpentMin: Math.round(raw.actiontime / 60),
      history: decodeHistory(raw.logs, status, glpiDates),
      escalations: decodeTransfers(raw.transfers, glpiDates),
    };
  },
};

// --- EasyVista -----------------------------------------------------------------
export interface RawEasyVista {
  RFC_NUMBER: string;
  TITLE: string;
  COMMENT: string;
  STATUS: string;
  URGENCY: string;
  SUBMIT_DATE: string;
  LAST_UPDATE: string;
  CATALOG: string;
  LOCATION: string;
  TECHNICIAN_LOGIN: string | null;
  GROUP: string;
  TIME_SPENT_MIN: number;
  ACTIONS: RawLog[];
  TRANSFERS: RawTransfer[];
}

const evStatus: Record<TicketStatus, string> = {
  Nouveau: 'Nouvelle demande',
  Affecté: 'Affectée',
  'En cours': 'En cours de traitement',
  'En attente': 'Suspendue',
  Bloqué: 'Bloquée',
  Escaladé: 'Transférée',
  Résolu: 'Résolue',
  Clôturé: 'Clôturée',
  Réouvert: 'Réouverte',
};
const evPriority: Record<Priority, string> = { P1: 'Critique', P2: 'Haute', P3: 'Normale', P4: 'Basse' };
const evDates: DateCodec = { fmt: frDate, parse: parseFrDate };

export const easyVistaAdapter: ItsmAdapter<RawEasyVista> = {
  tool: 'EasyVista',
  description: 'API EasyVista Service Manager (libellés de statuts personnalisés)',
  statusToRaw: evStatus,
  priorityToRaw: evPriority,
  statusMap: invert(evStatus),
  priorityMap: invert(evPriority),
  capabilities: {
    mode: 'lecture-écriture',
    canAssign: true,
    transitions: 'libre',
    note: 'Hypothèse de démonstration : droits d’écriture non accordés à ce jour. Clôture uniquement depuis Résolu.',
  },
  sourceIdOf: (r) => r.RFC_NUMBER,
  updatedAtOf: (r) => parseFrDate(r.LAST_UPDATE),
  sourceStatusOf: (r) => r.STATUS,
  sourcePriorityOf: (r) => r.URGENCY,
  fields: ['RFC_NUMBER', 'TITLE', 'COMMENT', 'STATUS', 'URGENCY', 'SUBMIT_DATE', 'LAST_UPDATE', 'CATALOG', 'LOCATION', 'TECHNICIAN_LOGIN', 'GROUP', 'TIME_SPENT_MIN', 'ACTIONS', 'TRANSFERS'],
  exportRaw(r) {
    return {
      RFC_NUMBER: r.sourceId,
      TITLE: r.title,
      COMMENT: r.description,
      STATUS: evStatus[r.status],
      URGENCY: evPriority[r.priority],
      SUBMIT_DATE: frDate(r.createdAt),
      LAST_UPDATE: frDate(r.updatedAt),
      CATALOG: r.category,
      LOCATION: r.site,
      TECHNICIAN_LOGIN: r.assigneeLogin,
      GROUP: r.group,
      TIME_SPENT_MIN: r.timeSpentMin,
      ACTIONS: encodeHistory(r.history, evStatus, evDates),
      TRANSFERS: encodeTransfers(r.escalations, evDates),
    };
  },
  normalize(raw) {
    const id = raw.RFC_NUMBER;
    const status = mapper(this.statusMap, 'Statut', id);
    return {
      sourceId: id,
      site: raw.LOCATION,
      title: raw.TITLE,
      description: raw.COMMENT,
      category: raw.CATALOG,
      priority: mapper(this.priorityMap, 'Priorité', id)(raw.URGENCY),
      status: status(raw.STATUS),
      assigneeLogin: raw.TECHNICIAN_LOGIN,
      group: raw.GROUP,
      createdAt: parseFrDate(raw.SUBMIT_DATE),
      updatedAt: parseFrDate(raw.LAST_UPDATE),
      timeSpentMin: raw.TIME_SPENT_MIN,
      history: decodeHistory(raw.ACTIONS, status, evDates),
      escalations: decodeTransfers(raw.TRANSFERS, evDates),
    };
  },
};

// --- Jira Service Management ------------------------------------------------------
export interface RawJira {
  key: string;
  fields: {
    summary: string;
    description: string;
    status: { name: string };
    priority: { name: string };
    created: string;
    updated: string;
    components: { name: string }[];
    customfield_site: string;
    assignee: { name: string } | null;
    customfield_team: string;
    timespent: number;
  };
  changelog: RawLog[];
  escalations: RawTransfer[];
}

const jiraStatus: Record<TicketStatus, string> = {
  Nouveau: 'Open',
  Affecté: 'Assigned',
  'En cours': 'In Progress',
  'En attente': 'Waiting for customer',
  Bloqué: 'Blocked',
  Escaladé: 'Escalated',
  Résolu: 'Resolved',
  Clôturé: 'Closed',
  Réouvert: 'Reopened',
};
const jiraPriority: Record<Priority, string> = { P1: 'Highest', P2: 'High', P3: 'Medium', P4: 'Low' };
const jiraDates: DateCodec = { fmt: iso, parse: parseIso };

export const jiraAdapter: ItsmAdapter<RawJira> = {
  tool: 'Jira',
  description: 'API REST Jira Service Management (workflow à transitions contrôlées)',
  statusToRaw: jiraStatus,
  priorityToRaw: jiraPriority,
  statusMap: invert(jiraStatus, { 'To Do': 'Nouveau', Done: 'Clôturé' }),
  priorityMap: invert(jiraPriority, { Lowest: 'P4' }),
  capabilities: {
    mode: 'lecture-écriture',
    canAssign: true,
    transitions: {
      Nouveau: ['Affecté', 'En cours'],
      Affecté: ['En cours', 'En attente'],
      'En cours': ['En attente', 'Bloqué', 'Escaladé', 'Résolu'],
      'En attente': ['En cours'],
      Bloqué: ['En cours'],
      Escaladé: ['En cours'],
      Résolu: ['Clôturé', 'Réouvert'],
      Clôturé: ['Réouvert'],
      Réouvert: ['Affecté', 'En cours'],
    },
    note: 'Hypothèse de démonstration (droits non accordés). Seules les transitions du workflow Jira sont autorisées.',
  },
  sourceIdOf: (r) => r.key,
  updatedAtOf: (r) => parseIso(r.fields.updated),
  sourceStatusOf: (r) => r.fields.status.name,
  sourcePriorityOf: (r) => r.fields.priority.name,
  fields: ['key', 'summary', 'description', 'status', 'priority', 'created', 'updated', 'components', 'customfield_site', 'assignee', 'customfield_team', 'timespent', 'changelog', 'escalations'],
  exportRaw(r) {
    return {
      key: r.sourceId,
      fields: {
        summary: r.title,
        description: r.description,
        status: { name: jiraStatus[r.status] },
        priority: { name: jiraPriority[r.priority] },
        created: iso(r.createdAt),
        updated: iso(r.updatedAt),
        components: [{ name: r.category }],
        customfield_site: r.site,
        assignee: r.assigneeLogin ? { name: r.assigneeLogin } : null,
        customfield_team: r.group,
        timespent: r.timeSpentMin * 60,
      },
      changelog: encodeHistory(r.history, jiraStatus, jiraDates),
      escalations: encodeTransfers(r.escalations, jiraDates),
    };
  },
  normalize(raw) {
    const id = raw.key;
    const status = mapper(this.statusMap, 'Statut', id);
    const f = raw.fields;
    return {
      sourceId: id,
      site: f.customfield_site,
      title: f.summary,
      description: f.description,
      category: f.components[0]?.name ?? 'Non catégorisé',
      priority: mapper(this.priorityMap, 'Priorité', id)(f.priority.name),
      status: status(f.status.name),
      assigneeLogin: f.assignee?.name ?? null,
      group: f.customfield_team,
      createdAt: parseIso(f.created),
      updatedAt: parseIso(f.updated),
      timeSpentMin: Math.round(f.timespent / 60),
      history: decodeHistory(raw.changelog, status, jiraDates),
      escalations: decodeTransfers(raw.escalations, jiraDates),
    };
  },
};

// --- Format générique (ISILOG, Service Manager, autres outils autorisés) ---------
export interface RawFlat {
  ref: string;
  subject: string;
  details: string;
  state: string;
  priority: string;
  opened: string;
  modified: string;
  category: string;
  location: string;
  owner: string | null;
  queue: string;
  effortMin: number;
  journal: RawLog[];
  transfers: RawTransfer[];
}

function flatAdapter(tool: ItsmTool, description: string, statusToRaw: Record<TicketStatus, string>, priorityToRaw: Record<Priority, string>, capabilities: Capabilities): ItsmAdapter<RawFlat> {
  const dates: DateCodec = { fmt: iso, parse: parseIso };
  return {
    tool,
    description,
    statusToRaw,
    priorityToRaw,
    statusMap: invert(statusToRaw),
    priorityMap: invert(priorityToRaw),
    capabilities,
    sourceIdOf: (r) => r.ref,
    updatedAtOf: (r) => parseIso(r.modified),
    sourceStatusOf: (r) => r.state,
    sourcePriorityOf: (r) => r.priority,
    fields: ['ref', 'subject', 'details', 'state', 'priority', 'opened', 'modified', 'category', 'location', 'owner', 'queue', 'effortMin', 'journal', 'transfers'],
    exportRaw: (r) => ({
      ref: r.sourceId,
      subject: r.title,
      details: r.description,
      state: statusToRaw[r.status],
      priority: priorityToRaw[r.priority],
      opened: iso(r.createdAt),
      modified: iso(r.updatedAt),
      category: r.category,
      location: r.site,
      owner: r.assigneeLogin,
      queue: r.group,
      effortMin: r.timeSpentMin,
      journal: encodeHistory(r.history, statusToRaw, dates),
      transfers: encodeTransfers(r.escalations, dates),
    }),
    normalize(raw) {
      const status = mapper(this.statusMap, 'Statut', raw.ref);
      return {
        sourceId: raw.ref,
        site: raw.location,
        title: raw.subject,
        description: raw.details,
        category: raw.category,
        priority: mapper(this.priorityMap, 'Priorité', raw.ref)(raw.priority),
        status: status(raw.state),
        assigneeLogin: raw.owner,
        group: raw.queue,
        createdAt: parseIso(raw.opened),
        updatedAt: parseIso(raw.modified),
        timeSpentMin: raw.effortMin,
        history: decodeHistory(raw.journal, status, dates),
        escalations: decodeTransfers(raw.transfers, dates),
      };
    },
  };
}

export const isilogAdapter = flatAdapter(
  'ISILOG',
  'API ISILOG IWS (format générique)',
  { Nouveau: 'Enregistré', Affecté: 'Attribué', 'En cours': 'En traitement', 'En attente': 'En attente utilisateur', Bloqué: 'Bloqué', Escaladé: 'Transféré', Résolu: 'Résolu', Clôturé: 'Clos', Réouvert: 'Rouvert' },
  { P1: 'Urgente', P2: 'Haute', P3: 'Moyenne', P4: 'Basse' },
  { mode: 'lecture-écriture', canAssign: true, transitions: 'libre', note: 'Hypothèse de démonstration (droits non accordés). Clôture uniquement depuis Résolu.' },
);

export const serviceManagerAdapter = flatAdapter(
  'Service Manager',
  'API Service Manager (format générique)',
  { Nouveau: 'Open', Affecté: 'Assigned', 'En cours': 'Work In Progress', 'En attente': 'Pending Customer', Bloqué: 'Suspended', Escaladé: 'Referred', Résolu: 'Resolved', Clôturé: 'Closed', Réouvert: 'Reopened' },
  { P1: '1 - Critical', P2: '2 - High', P3: '3 - Average', P4: '4 - Low' },
  { mode: 'lecture seule', canAssign: false, transitions: 'aucune', note: 'Connecteur prévu en lecture seule.' },
);

export const zendeskAdapter = flatAdapter(
  'Zendesk',
  'API Zendesk Support (format générique)',
  { Nouveau: 'new', Affecté: 'open:assigned', 'En cours': 'open', 'En attente': 'pending', Bloqué: 'hold', Escaladé: 'open:escalated', Résolu: 'solved', Clôturé: 'closed', Réouvert: 'open:reopened' },
  { P1: 'urgent', P2: 'high', P3: 'normal', P4: 'low' },
  { mode: 'lecture-écriture', canAssign: true, transitions: 'libre', note: 'Hypothèse de démonstration (droits non accordés ; statuts personnalisés Zendesk à confirmer).' },
);

export const genericAdapter = flatAdapter(
  'Autre',
  'Connecteur générique (export CSV / API à valider)',
  Object.fromEntries(ALL_STATUSES.map((s) => [s, s])) as Record<TicketStatus, string>,
  { P1: 'P1', P2: 'P2', P3: 'P3', P4: 'P4' },
  { mode: 'lecture seule', canAssign: false, transitions: 'aucune', note: 'Import en lecture seule.' },
);

export const adapters: Record<ItsmTool, ItsmAdapter<any>> = {
  GLPI: glpiAdapter,
  EasyVista: easyVistaAdapter,
  ISILOG: isilogAdapter,
  'Service Manager': serviceManagerAdapter,
  Jira: jiraAdapter,
  Zendesk: zendeskAdapter,
  Autre: genericAdapter,
};

/** Vérifie qu'une transition est permise par l'outil source. */
export function checkTransition(adapter: ItsmAdapter<any>, from: TicketStatus, to: TicketStatus): { ok: boolean; reason?: string } {
  if (from === to) return { ok: false, reason: 'Le ticket est déjà dans ce statut.' };
  const { transitions, mode } = adapter.capabilities;
  if (mode === 'lecture seule' || transitions === 'aucune') {
    return { ok: false, reason: `${adapter.tool} : connecteur en lecture seule, modification à réaliser dans l'outil source.` };
  }
  if (transitions === 'libre') {
    if (from === 'Clôturé' && to !== 'Réouvert') return { ok: false, reason: `${adapter.tool} : un ticket clôturé ne peut qu'être réouvert.` };
    if (to === 'Clôturé' && from !== 'Résolu') return { ok: false, reason: `${adapter.tool} : la clôture n'est possible que depuis Résolu.` };
    return { ok: true };
  }
  if (transitions[from]?.includes(to)) return { ok: true };
  return { ok: false, reason: `${adapter.tool} : transition ${from} → ${to} non prévue par le workflow source.` };
}
