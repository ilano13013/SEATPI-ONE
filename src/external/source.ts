// Simulation des outils sources (GLPI, EasyVista, Jira…) avec des tickets fictifs.
// Les enregistrements sont exprimés dans le vocabulaire normalisé ; l'adaptateur de
// chaque outil les convertit dans son format brut lors de la « lecture » de l'API.
import type { Escalation, ExternalClient, ExternalTeam, NormalizedRecord, Priority, Service, Technician, TicketEvent, TicketStatus } from './types';
import type { Rng } from '../services/random';
import { addBusinessMinutes, businessMinutesBetween, dateKey, isBusinessDay, nextBusinessDays, startOfDay, addDays } from './calendar';
import { externalTeams } from './config';
import { statusIntervals } from './sla';

const MIN = 60_000;
const ROUND = (t: number) => Math.floor(t / MIN) * MIN;

// Volume N2 : tickets transmis par le Helpdesk N1 SEATPI ou détectés par la supervision.
const RATE_PER_DAY: Record<string, number> = { invivo: 13, primagaz: 11, monext: 11 };
const CREATION_SOURCES = ['Escalade Helpdesk N1 (SEATPI)', 'Escalade Helpdesk N1 (SEATPI)', 'Portail utilisateur', 'Supervision'];
const HISTORY_BUSINESS_DAYS = 15;

const TITLES: Record<string, string[]> = {
  'Poste de travail': ['PC lent au démarrage', 'Écran noir après mise à jour', 'Installation logiciel demandée', 'Remplacement clavier défectueux', 'Poste ne démarre plus'],
  Messagerie: ['Boîte aux lettres pleine', 'Accès boîte partagée', 'Messages bloqués en boîte d’envoi', 'Synchronisation mobile impossible'],
  'Comptes & accès': ['Réinitialisation mot de passe', 'Compte verrouillé', 'Création de compte nouvel arrivant', 'Droits dossier partagé'],
  Impression: ['Imprimante hors ligne', 'Bourrage récurrent', 'Ajout imprimante réseau'],
  Réseau: ['Wi-Fi instable en salle de réunion', 'VPN ne se connecte pas', 'Prise réseau inactive', 'Lenteurs réseau site'],
  'Applicatif métier': ['Erreur à la validation de commande', 'Export indisponible', 'Lenteurs de l’application métier', 'Habilitation applicative'],
  Téléphonie: ['Softphone sans tonalité', 'Renvoi d’appel à configurer', 'Casque non reconnu'],
  Monétique: ['Terminal de paiement hors ligne', 'Rejets de transactions', 'Erreur de télécollecte', 'Paramétrage TPE à mettre à jour'],
};

/** Destinataires possibles d'une escalade depuis le MCO N2 client, avec leurs motifs. */
export const ESCALATIONS: { to: Service; reasons: string[]; weight: number }[] = [
  { to: 'Exploitation', reasons: ['Incident infrastructure suspecté', 'Intervention serveur ou réseau requise', 'Restauration de sauvegarde nécessaire'], weight: 5 },
  { to: 'Équipe externe', reasons: ['Correctif éditeur nécessaire', 'Matériel sous garantie constructeur', 'Intervention opérateur télécom'], weight: 3 },
  { to: 'CSM', reasons: ['Demande de dérogation contractuelle', 'Insatisfaction client à traiter', 'Demande hors périmètre du contrat'], weight: 2 },
];
const OWNER: Record<Service, string> = {
  'Helpdesk N1': 'Superviseur Helpdesk N1',
  'MCO N2': 'Responsable MCO N2',
  Exploitation: 'Pilote exploitation',
  CSM: 'CSM du compte',
  'Équipe externe': 'Support éditeur (externe)',
};

function pick<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

function pickPriority(rng: Rng): Priority {
  const r = rng();
  return r < 0.04 ? 'P1' : r < 0.2 ? 'P2' : r < 0.75 ? 'P3' : 'P4';
}

function sourceIdFor(client: ExternalClient, seq: number): string {
  if (client.tool === 'GLPI') return String(48200 + seq);
  if (client.tool === 'EasyVista') return `I26_${String(10400 + seq).padStart(6, '0')}`;
  return `MNX-${3100 + seq}`;
}

function availableTechs(teamId: string, techs: Technician[], at: number): Technician[] {
  const team = techs.filter((t) => t.teamId === teamId);
  const present = team.filter((t) => !t.leaveDates.includes(dateKey(at)));
  return present.length ? present : team;
}

interface Draft {
  events: TicketEvent[];
  escalations: Escalation[];
}

function status(d: Draft, at: number, from: TicketStatus, to: TicketStatus, by: string) {
  d.events.push({ at: ROUND(at), kind: 'statut', from, to, by });
}

/** Construit l'historique complet (y compris futur), tronqué ensuite à `now`. */
function lifecycle(client: ExternalClient, team: ExternalTeam, tech: Technician, priority: Priority, createdAt: number, rng: Rng): Draft {
  const cal = client.calendar;
  const sla = client.sla[priority];
  const add = (t: number, m: number) => addBusinessMinutes(t, Math.max(1, Math.round(m)), cal);
  const d: Draft = { events: [{ at: createdAt, kind: 'création', by: pick(CREATION_SOURCES, rng) }], escalations: [] };
  const who = tech.name;

  let t = add(createdAt, sla.takeChargeMin * (0.1 + rng() * 0.6));
  d.events.push({ at: ROUND(t), kind: 'affectation', from: null, to: tech.sourceLogin, by: 'Dispatch' });
  status(d, t, 'Nouveau', 'Affecté', 'Dispatch');
  const lateTake = rng() < 0.1 ? 1 + rng() * 2 : 0.1 + rng() * 0.9;
  t = add(t, sla.takeChargeMin * lateTake);
  status(d, t, 'Affecté', 'En cours', who);

  const work = sla.resolutionMin * (rng() < 0.07 ? 1 + rng() * 0.6 : 0.15 + rng() * 0.7);
  t = add(t, work * 0.5);
  const r = rng();
  if (r < 0.18) {
    status(d, t, 'En cours', 'En attente', who);
    d.events.push({ at: ROUND(t), kind: 'commentaire', by: who, note: 'Relance utilisateur : informations complémentaires demandées' });
    t = add(t, 30 + rng() * 450);
    status(d, t, 'En attente', 'En cours', who);
  } else if (r < 0.22) {
    status(d, t, 'En cours', 'Bloqué', who);
    d.events.push({ at: ROUND(t), kind: 'commentaire', by: who, note: 'Blocage : dépendance matérielle ou fournisseur' });
    t = add(t, 60 + rng() * 540);
    status(d, t, 'Bloqué', 'En cours', who);
  } else if (r < 0.3) {
    const target = weighted(ESCALATIONS.map((e) => [e, e.weight] as [typeof e, number]), rng);
    const to = target.to;
    const at = ROUND(t);
    status(d, at, 'En cours', 'Escaladé', who);
    const back = add(t, 60 + rng() * 420);
    d.escalations.push({
      id: `ESC-${Math.floor(rng() * 1e6)}`,
      at,
      from: team.service,
      to,
      reason: pick(target.reasons, rng),
      owner: OWNER[to],
      status: 'Traitée',
      history: [
        { at, label: `Escalade ${team.service} → ${to}` },
        { at: ROUND(add(at, 20 + rng() * 40)), label: `Prise en compte par ${OWNER[to]}` },
        { at: ROUND(back), label: 'Retour au service d’origine' },
      ],
    });
    d.events.push({ at, kind: 'escalade', from: team.service, to, by: who });
    t = back;
    status(d, t, 'Escaladé', 'En cours', OWNER[to]);
  }
  t = add(t, work * 0.5);
  status(d, t, 'En cours', 'Résolu', who);

  if (rng() < 0.05) {
    t = add(t, 60 + rng() * 660);
    status(d, t, 'Résolu', 'Réouvert', 'Utilisateur');
    d.events.push({ at: ROUND(t), kind: 'commentaire', by: 'Utilisateur', note: 'Le problème est réapparu' });
    t = add(t, 10 + rng() * 50);
    status(d, t, 'Réouvert', 'En cours', who);
    t = add(t, 60 + rng() * 420);
    status(d, t, 'En cours', 'Résolu', who);
  }
  t = add(t, (cal.endHour - cal.startHour) * 60 * 2);
  status(d, t, 'Résolu', 'Clôturé', 'Clôture automatique');
  return d;
}

/** Fige un brouillon à la date `now` et produit l'enregistrement source. */
function finalize(base: Omit<NormalizedRecord, 'status' | 'assigneeLogin' | 'updatedAt' | 'timeSpentMin' | 'history' | 'escalations'>, draft: Draft, now: number, cal: ExternalClient['calendar']): NormalizedRecord {
  const history = draft.events.filter((e) => e.at <= now).sort((a, b) => a.at - b.at);
  const escalations = draft.escalations
    .filter((e) => e.at <= now)
    .map((e) => {
      const trail = e.history.filter((h) => h.at <= now);
      const done = trail.length === e.history.length;
      return { ...e, status: done ? e.status : ('En cours' as const), history: trail };
    });
  const lastStatus = [...history].reverse().find((e) => e.kind === 'statut');
  const lastAssign = [...history].reverse().find((e) => e.kind === 'affectation');
  const record: NormalizedRecord = {
    ...base,
    status: (lastStatus?.to as TicketStatus) ?? 'Nouveau',
    assigneeLogin: lastAssign?.to ?? null,
    updatedAt: history[history.length - 1].at,
    timeSpentMin: 0,
    history,
    escalations,
  };
  record.timeSpentMin = workedMinutes(record, now, cal);
  return record;
}

/** Plafond de temps de travail effectif par ticket (minutes), selon la priorité. */
const WORK_CAP_MIN: Record<Priority, number> = { P1: 240, P2: 150, P3: 90, P4: 45 };

/**
 * Temps passé estimé : 30 % du temps ouvré en statut En cours (les tickets sont
 * traités en parallèle), plafonné par priorité, arrondi à 5 min.
 */
function workedMinutes(r: NormalizedRecord, now: number, cal: ExternalClient['calendar']): number {
  const minutes = statusIntervals(r.createdAt, r.history, now)
    .filter((iv) => iv.status === 'En cours')
    .reduce((s, iv) => s + businessMinutesBetween(iv.from, iv.to, cal), 0);
  return Math.max(5, Math.round(Math.min(minutes * 0.3, WORK_CAP_MIN[r.priority]) / 5) * 5);
}

function newTicketBase(client: ExternalClient, seq: number, createdAt: number, rng: Rng) {
  const teams = externalTeams.filter((t) => t.clientId === client.id);
  const team = teams[Math.floor(rng() * teams.length)];
  const categories = client.categories;
  const category = client.id === 'monext' && rng() < 0.4 ? 'Monétique' : pick(categories, rng);
  const title = pick(TITLES[category] ?? ['Demande d’assistance'], rng);
  const site = pick(client.sites, rng);
  return {
    team,
    priority: pickPriority(rng),
    base: {
      sourceId: sourceIdFor(client, seq),
      site,
      title,
      description: `${title}. Demande fictive générée pour la démonstration (${site}).`,
      category,
      priority: 'P3' as Priority,
      group: team.sourceGroup,
      createdAt: ROUND(createdAt),
    },
  };
}

/** Génère l'historique fictif d'un client sur les 15 derniers jours ouvrés. */
export function generateSource(client: ExternalClient, techs: Technician[], now: number, rng: Rng): NormalizedRecord[] {
  const cal = client.calendar;
  const first = startOfDay(addDays(now, -HISTORY_BUSINESS_DAYS * 1.6));
  const days = nextBusinessDays(first, 60, cal).filter((d) => d <= now).slice(-HISTORY_BUSINESS_DAYS);
  const records: NormalizedRecord[] = [];
  let seq = 0;
  for (const day of days) {
    const count = Math.round(RATE_PER_DAY[client.id] * (0.7 + rng() * 0.6));
    const open = new Date(day).setHours(cal.startHour);
    const length = (cal.endHour - cal.startHour) * 60 * MIN;
    const times = Array.from({ length: count }, () => open + rng() * length).sort((a, b) => a - b);
    for (const createdAt of times) {
      if (createdAt > now) continue;
      const { team, priority, base } = newTicketBase(client, ++seq, createdAt, rng);
      base.priority = priority;
      const tech = pick(availableTechs(team.id, techs, createdAt), rng);
      const draft = lifecycle(client, team, tech, priority, base.createdAt, rng);
      records.push(finalize(base, draft, now, cal));
    }
  }
  return records;
}

// --- Évolution et écritures (simulées) ---------------------------------------

const NEXT_STEP: Partial<Record<TicketStatus, [TicketStatus, number][]>> = {
  Nouveau: [['Affecté', 1]],
  Affecté: [['En cours', 1]],
  'En cours': [['Résolu', 6], ['En attente', 2], ['Escaladé', 1]],
  'En attente': [['En cours', 1]],
  Bloqué: [['En cours', 1]],
  Escaladé: [['En cours', 1]],
  Réouvert: [['En cours', 1]],
  Résolu: [['Clôturé', 1]],
};

function weighted<T>(options: [T, number][], rng: Rng): T {
  const total = options.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of options) {
    r -= w;
    if (r < 0) return v;
  }
  return options[0][0];
}

export interface WriteResult {
  records: NormalizedRecord[];
  ok: boolean;
  message: string;
}

const teamOfGroup = (group: string) => externalTeams.find((t) => t.sourceGroup === group);

/** Applique un changement de statut dans la source (écriture simulée). */
export function applyTransition(
  records: NormalizedRecord[],
  sourceId: string,
  to: TicketStatus,
  by: string,
  now: number,
  client: ExternalClient,
  escalateTo: Service = 'Exploitation',
): WriteResult {
  const r = records.find((x) => x.sourceId === sourceId);
  if (!r) return { records, ok: false, message: 'Ticket introuvable dans la source.' };
  if ((to === 'Affecté' || to === 'En cours') && !r.assigneeLogin) {
    return { records, ok: false, message: 'Affectez d’abord un technicien au ticket.' };
  }
  const at = ROUND(now);
  const team = teamOfGroup(r.group);
  const history: TicketEvent[] = [...r.history, { at, kind: 'statut', from: r.status, to, by }];
  let escalations = r.escalations;
  if (to === 'Escaladé' && team) {
    const dest = escalateTo;
    escalations = [
      ...escalations,
      { id: `ESC-${sourceId}-${escalations.length + 1}`, at, from: team.service, to: dest, reason: 'Escalade demandée depuis SEATPI ONE', owner: OWNER[dest], status: 'En cours', history: [{ at, label: `Escalade ${team.service} → ${dest}` }] },
    ];
    history.push({ at, kind: 'escalade', from: team.service, to: dest, by });
  }
  if (r.status === 'Escaladé' && to !== 'Escaladé') {
    escalations = escalations.map((e) => (e.status === 'En cours' ? { ...e, status: 'Traitée' as const, history: [...e.history, { at, label: 'Retour au service d’origine' }] } : e));
  }
  const updated: NormalizedRecord = { ...r, status: to, updatedAt: at, history, escalations };
  updated.timeSpentMin = Math.max(r.timeSpentMin, workedMinutes(updated, now, client.calendar));
  return { records: records.map((x) => (x === r ? updated : x)), ok: true, message: `${r.status} → ${to}` };
}

/** Affecte un technicien dans la source (écriture simulée). */
export function applyAssignment(records: NormalizedRecord[], sourceId: string, login: string, by: string, now: number): WriteResult {
  const r = records.find((x) => x.sourceId === sourceId);
  if (!r) return { records, ok: false, message: 'Ticket introuvable dans la source.' };
  if (r.assigneeLogin === login) return { records, ok: false, message: 'Ce technicien est déjà affecté.' };
  const at = ROUND(now);
  const history: TicketEvent[] = [...r.history, { at, kind: 'affectation', from: r.assigneeLogin, to: login, by }];
  return { records: records.map((x) => (x === r ? { ...r, assigneeLogin: login, updatedAt: at, history } : x)), ok: true, message: 'Affectation enregistrée' };
}

/** Fait vivre la source entre deux synchronisations : arrivées et avancement des tickets. */
export function evolveSource(records: NormalizedRecord[], client: ExternalClient, techs: Technician[], now: number, rng: Rng): NormalizedRecord[] {
  let next = records;
  if (isBusinessDay(now, client.calendar)) {
    const arrivals = rng() < 0.55 ? 1 : rng() < 0.4 ? 2 : 0;
    for (let i = 0; i < arrivals; i++) {
      // Numérotation croissante : jamais de collision avec les tickets existants.
      const { priority, base } = newTicketBase(client, next.length + 1001, now, rng);
      base.priority = priority;
      next = [...next, { ...base, status: 'Nouveau', assigneeLogin: null, updatedAt: base.createdAt, timeSpentMin: 0, history: [{ at: base.createdAt, kind: 'création', by: 'Portail utilisateur' }], escalations: [] }];
    }
  }
  const open = next.filter((r) => r.status !== 'Clôturé');
  for (let i = 0; i < 4 && open.length; i++) {
    const r = open.splice(Math.floor(rng() * open.length), 1)[0];
    const options = NEXT_STEP[r.status];
    if (!options) continue;
    const to = weighted(options, rng);
    if (!r.assigneeLogin) {
      const team = teamOfGroup(r.group);
      const tech = team ? pick(availableTechs(team.id, techs, now), rng) : undefined;
      if (!tech) continue;
      next = applyAssignment(next, r.sourceId, tech.sourceLogin, 'Dispatch', now).records;
    }
    next = applyTransition(next, r.sourceId, to, to === 'Clôturé' ? 'Clôture automatique' : 'Technicien (source)', now, client).records;
  }
  return next;
}
