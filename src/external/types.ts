// Modèle normalisé des tickets et prestations des clients externes.
// Toutes les données sont fictives tant que les accès réels ne sont pas autorisés.

export type ExternalClientId = 'invivo' | 'primagaz' | 'monext';

export type ItsmTool = 'GLPI' | 'EasyVista' | 'ISILOG' | 'Service Manager' | 'Jira' | 'Zendesk' | 'Autre';

export type Service = 'Helpdesk N1' | 'MCO N2' | 'Exploitation' | 'CSM' | 'Équipe externe';

export type TicketStatus =
  | 'Nouveau'
  | 'Affecté'
  | 'En cours'
  | 'En attente'
  | 'Bloqué'
  | 'Escaladé'
  | 'Résolu'
  | 'Clôturé'
  | 'Réouvert';

export type Priority = 'P1' | 'P2' | 'P3' | 'P4';

/** Calendrier contractuel : jours (0 = dimanche … 6 = samedi), plage horaire et jours fériés. */
export interface BusinessCalendar {
  label: string;
  days: number[];
  startHour: number;
  endHour: number;
  holidays: string[];
}

/** Délais contractuels en minutes ouvrées. */
export interface SlaTarget {
  takeChargeMin: number;
  resolutionMin: number;
}

export interface Contract {
  id: string;
  clientId: ExternalClientId;
  label: string;
  /** Tarif facturé (€ / h). */
  hourlyRate: number;
  /** Coût interne chargé (€ / h). */
  costRate: number;
  monthlyBudget: number;
}

export interface ExternalTeam {
  id: string;
  clientId: ExternalClientId;
  name: string;
  service: Service;
  contractId: string;
  /** Identifiant du groupe de traitement dans l'outil source. */
  sourceGroup: string;
}

export type CraStatus = 'Validé' | 'Soumis' | 'À saisir';

export interface Technician {
  id: string;
  /** Pseudonyme fictif, jamais un nom réel. */
  name: string;
  clientId: ExternalClientId;
  teamId: string;
  contractId: string;
  /** Identifiant de l'utilisateur dans l'outil source. */
  sourceLogin: string;
  skills: string[];
  hoursPerDay: number;
  /** Disponibilité déclarée (0–1). */
  availability: number;
  /** Jours de congé posés (AAAA-MM-JJ). */
  leaveDates: string[];
  pendingLeaveRequests: number;
  cra: { status: CraStatus; hours: number };
}

export interface ExternalClient {
  id: ExternalClientId;
  name: string;
  /** Outil ITSM issu de la cartographie de référence ; null = non renseigné. */
  tool: ItsmTool | null;
  accent: string;
  sites: string[];
  categories: string[];
  calendar: BusinessCalendar;
  sla: Record<Priority, SlaTarget>;
  /** Statuts suspendant le décompte du SLA de résolution (en plus de Résolu / Clôturé). */
  slaPauseStatuses: TicketStatus[];
  /** Niveau traité : N1 sur les plateaux internes, N2 chez le client (défaut). Un même client peut avoir les deux (INVIVO). */
  level?: 'N1' | 'N2';
  /** Volume fictif de tickets par jour ouvré (démonstration). */
  ratePerDay?: number;
}

export type EventKind = 'création' | 'statut' | 'affectation' | 'escalade' | 'commentaire';

export interface TicketEvent {
  at: number;
  kind: EventKind;
  from?: string | null;
  to?: string | null;
  by: string;
  note?: string;
}

export type EscalationStatus = 'En cours' | 'Traitée' | 'Rejetée';

export interface Escalation {
  id: string;
  at: number;
  from: Service;
  to: Service;
  reason: string;
  owner: string;
  status: EscalationStatus;
  history: { at: number; label: string }[];
}

/** Ticket tel que décrit par la source, dans le vocabulaire normalisé (sortie d'un adaptateur). */
export interface NormalizedRecord {
  sourceId: string;
  site: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: TicketStatus;
  assigneeLogin: string | null;
  group: string;
  createdAt: number;
  updatedAt: number;
  timeSpentMin: number;
  history: TicketEvent[];
  escalations: Escalation[];
}

export type SlaState = 'respecté' | 'à risque' | 'dépassé';

export interface SlaInfo {
  budgetMin: number;
  consumedMin: number;
  /** Échéance de résolution ; null si le décompte est suspendu. */
  dueAt: number | null;
  takeChargeDueAt: number;
  takeChargeMet: boolean | null;
  state: SlaState;
  paused: boolean;
}

/** Ticket consolidé dans le référentiel interne SEATPI ONE. */
export interface Ticket {
  /** Identifiant interne unique et stable (SPI-000001). */
  id: string;
  source: { tool: ItsmTool; id: string };
  /** Statut et priorité d'origine, tels que fournis par l'outil source. */
  sourceStatus: string;
  sourcePriority: string;
  clientId: ExternalClientId;
  site: string;
  contractId: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: TicketStatus;
  assigneeId: string | null;
  teamId: string;
  createdAt: number;
  updatedAt: number;
  takenAt: number | null;
  resolvedAt: number | null;
  closedAt: number | null;
  timeSpentMin: number;
  reopenCount: number;
  sla: SlaInfo;
  escalations: Escalation[];
  history: TicketEvent[];
}
