// Modèle métier de démonstration (sous-ensemble du §5 du cahier des charges).

/** Sites internes SEATPI. La Ciotat est le site principal de référence. */
export type SiteId = 'laciotat' | 'montpellier' | 'paris';

/** Zones navigables : carte d'ensemble, sites internes, sites clients externes. */
export type Location = 'carte' | SiteId | 'externes';

/** Identifiant d'étage (ex. « rdc », « mtp-e1 », « carte », « sites »). */
export type FloorId = string;

/** Identifiant d'espace. Les espaces de La Ciotat gardent leurs identifiants historiques. */
export type RoomId = string;

/** Nature fonctionnelle d'un espace : détermine son aménagement 3D et son panneau. */
export type RoomKind =
  | 'accueil'
  | 'pause'
  | 'stock'
  | 'parking'
  | 'helpdesk'
  | 'mco'
  | 'exploitation'
  | 'formation'
  | 'csm'
  | 'rh'
  | 'finance'
  | 'commercial'
  | 'direction'
  | 'recrutement'
  | 'moyens'
  | 'reunion'
  | 'external'
  | 'building';

export type ModuleId =
  | 'supervision'
  | 'pause'
  | 'rh'
  | 'stock'
  | 'finance'
  | 'vehicules'
  | 'accueil'
  | 'externes'
  | 'integrations'
  | 'exploitation'
  | 'csm'
  | 'mco'
  | 'formation'
  | 'commercial'
  | 'direction'
  | 'recrutement'
  | 'moyens'
  | 'reunion'
  | 'carte'
  | 'management'
  | 'objectifs'
  | 'clients'
  | 'collaborateurs'
  | 'budget-revision'
  | 'sla'
  | 'telephonie'
  | 'dashboard'
  | 'pdg'
  | 'permissions';

export interface Floor {
  id: FloorId;
  location: Location;
  label: string;
  short: string;
}

export interface Room {
  id: RoomId;
  floor: FloorId;
  location: Location;
  kind: RoomKind;
  label: string;
  module: ModuleId;
  description: string;
  /** Centre de la pièce dans le plan de l'étage. */
  x: number;
  z: number;
  width: number;
  depth: number;
  color: string;
  /** Pièce extérieure : pas de cloisons vitrées. */
  outdoor?: boolean;
  /** Couleur du sol pour les zones extérieures. */
  ground?: string;
  /** Position de l'étiquette [hauteur, profondeur] si différente du défaut. */
  labelAt?: [number, number];
  /** Site d'un client externe. */
  externalClientId?: 'invivo' | 'primagaz' | 'monext';
  /** Bâtiment de la carte d'ensemble : site interne ciblé. */
  targetSite?: SiteId;
}

export type AgentStatus =
  | 'Disponible'
  | 'En appel'
  | 'Post-appel'
  | 'Pause'
  | 'Repas'
  | 'Formation'
  | 'Hors ligne';

export interface Client {
  id: string;
  name: string;
}

export interface Queue {
  id: string;
  clientId: string;
  name: string;
  waiting: number;
  longestWaitSec: number;
  handledToday: number;
  abandonedToday: number;
  /** Taux de service actuel, 0–100. */
  sla: number;
  slaTarget: number;
}

export interface Agent {
  id: string;
  /** Pseudonyme fictif, jamais un nom réel. */
  name: string;
  /** Pôle client du plateau Helpdesk. */
  clientId: string;
  /** Site de rattachement (répartition de démonstration). */
  site: SiteId;
  status: AgentStatus;
  statusSinceSec: number;
  /** Indice du poste sur le plateau Helpdesk. */
  desk: number;
}

export type TicketPriority = 'P1' | 'P2' | 'P3' | 'P4';
export type TicketStatus = 'Nouveau' | 'En cours' | 'En attente' | 'Résolu';

export interface TicketSummary {
  id: string;
  clientId: string;
  title: string;
  priority: TicketPriority;
  status: TicketStatus;
  ageMin: number;
  assigneeId: string | null;
}

export interface InventoryItem {
  id: string;
  label: string;
  category: 'Casques' | 'Postes' | 'Écrans' | 'Accessoires';
  inStock: number;
  assigned: number;
  alertThreshold: number;
}

export interface Vehicle {
  id: string;
  label: string;
  plate: string;
  status: 'Disponible' | 'Réservé' | 'Entretien';
  nextBooking: string | null;
  km: number;
}

export interface Budget {
  id: string;
  costCenter: string;
  allocated: number;
  spent: number;
}

export interface HrSummary {
  pendingLeaves: number;
  upcomingTrainings: number;
  certificationsToRenew: number;
  plannedHeadcount: number;
}

export interface ReceptionEvent {
  id: string;
  time: string;
  label: string;
  kind: 'Visite' | 'Livraison' | 'Réunion';
}

export interface DemoState {
  /** Horodatage (ms) de la dernière mise à jour simulée. */
  updatedAt: number;
  tick: number;
  clients: Client[];
  queues: Queue[];
  agents: Agent[];
  tickets: TicketSummary[];
  inventory: InventoryItem[];
  vehicles: Vehicle[];
  budgets: Budget[];
  hr: HrSummary;
  reception: ReceptionEvent[];
}

export interface Metrics {
  agentsConnected: number;
  waitingTotal: number;
  slaGlobal: number;
  slaTarget: number;
  onBreak: number;
  openTickets: number;
}
