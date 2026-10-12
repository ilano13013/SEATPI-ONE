// Services internes SEATPI en interaction avec les clients externes :
// l'Exploitation (infrastructure, supervision) et le CSM (relation client).
// Ils reçoivent les escalades du MCO N2 des clients. Données fictives.
import type { Escalation, ExternalClientId, Ticket } from './types';
import type { ClientView } from './derive';
import { addDays, startOfDay } from './calendar';
import { externalClients } from './config';
import { isOpen, periods } from './metrics';

export interface ServiceMember {
  id: string;
  /** Pseudonyme fictif. */
  name: string;
  skills: string[];
  /** Présent sur site aujourd'hui (sinon télétravail / absent). */
  present: boolean;
  onCall?: boolean;
  clientId?: ExternalClientId;
}

export const exploitationTeam: ServiceMember[] = [
  { id: 'exp-01', name: 'Exploit. 01', skills: ['Serveurs Windows', 'Sauvegardes'], present: true },
  { id: 'exp-02', name: 'Exploit. 02', skills: ['Linux', 'Ordonnancement'], present: true, onCall: true },
  { id: 'exp-03', name: 'Exploit. 03', skills: ['Réseau', 'Pare-feu'], present: true },
  { id: 'exp-04', name: 'Exploit. 04', skills: ['Virtualisation', 'Stockage'], present: true },
  { id: 'exp-05', name: 'Exploit. 05', skills: ['Supervision', 'Bases de données'], present: false },
];

export const csmTeam: ServiceMember[] = [
  { id: 'csm-01', name: 'CSM 01', skills: ['Gouvernance', 'Comités'], present: true, clientId: 'invivo' },
  { id: 'csm-02', name: 'CSM 02', skills: ['Gouvernance', 'Avenants'], present: true, clientId: 'primagaz' },
  { id: 'csm-03', name: 'CSM 03', skills: ['Gouvernance', 'Monétique'], present: true, clientId: 'monext' },
];

/** Contrôles quotidiens fictifs suivis par l'Exploitation. */
export const supervisionChecks = [
  { label: 'Traitements de nuit', ok: 42, total: 43 },
  { label: 'Sauvegardes', ok: 118, total: 118 },
  { label: 'Sondes de supervision au vert', ok: 311, total: 316 },
  { label: 'Changements planifiés cette semaine', ok: 6, total: 6 },
];

export interface ReceivedEscalation {
  escalation: Escalation;
  ticket: Ticket;
  clientId: ExternalClientId;
  clientName: string;
  /** Membre du service en charge (répartition équilibrée). */
  ownerId: string;
}

/** Escalades reçues par un service, de la plus récente à la plus ancienne. */
export function receivedEscalations(views: ClientView[], service: 'Exploitation' | 'CSM'): ReceivedEscalation[] {
  const members = service === 'Exploitation' ? exploitationTeam.filter((m) => m.present) : csmTeam;
  const list = views.flatMap((v) =>
    v.tickets.flatMap((t) => t.escalations.filter((e) => e.to === service).map((e) => ({ escalation: e, ticket: t, clientId: v.client.id, clientName: v.client.name }))),
  );
  list.sort((a, b) => b.escalation.at - a.escalation.at);
  let i = 0;
  return list.map((r) => {
    const owner = service === 'CSM' ? csmTeam.find((m) => m.clientId === r.clientId)! : members[i++ % members.length];
    return { ...r, ownerId: owner.id };
  });
}

export interface ServiceSummary {
  open: ReceivedEscalation[];
  week: ReceivedEscalation[];
  /** Membres occupés par au moins une escalade en cours. */
  busy: Set<string>;
}

export function serviceSummary(views: ClientView[], service: 'Exploitation' | 'CSM', now: number): ServiceSummary {
  const all = receivedEscalations(views, service);
  const week = periods(now).week;
  const open = all.filter((r) => r.escalation.status === 'En cours');
  return { open, week: all.filter((r) => r.escalation.at >= week.start), busy: new Set(open.map((r) => r.ownerId)) };
}

/** Jour du comité de pilotage hebdomadaire de chaque client (fictif) : 2 = mardi, 4 = jeudi, 5 = vendredi. */
const COMMITTEE_DAY: Record<ExternalClientId, number> = { invivo: 2, primagaz: 4, monext: 5 };

/** Prochain comité de pilotage (à partir de demain, 10:00). */
export function nextCommittee(clientId: ExternalClientId, now: number): number {
  let day = startOfDay(addDays(now, 1));
  while (new Date(day).getDay() !== COMMITTEE_DAY[clientId]) day = startOfDay(addDays(day, 1));
  return new Date(day).setHours(10);
}

export interface CsmClientCard {
  view: ClientView;
  csm: ServiceMember;
  openEscalations: ReceivedEscalation[];
  breachedOpen: number;
  committee: number;
}

export function csmCards(views: ClientView[], now: number): CsmClientCard[] {
  const received = serviceSummary(views, 'CSM', now).open;
  return views.map((v) => ({
    view: v,
    csm: csmTeam.find((m) => m.clientId === v.client.id)!,
    openEscalations: received.filter((r) => r.clientId === v.client.id),
    breachedOpen: v.tickets.filter((t) => isOpen(t) && t.sla.state === 'dépassé').length,
    committee: nextCommittee(v.client.id, now),
  }));
}
