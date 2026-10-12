// Modèle métier de démonstration (sous-ensemble du §5 du cahier des charges).

export type FloorId = 'rdc' | 'etage1' | 'sites';

export type RoomId =
  | 'accueil'
  | 'pause'
  | 'stock'
  | 'parking'
  | 'helpdesk'
  | 'rh'
  | 'direction'
  | 'ext-invivo'
  | 'ext-primagaz'
  | 'ext-monext';

export type ModuleId = 'supervision' | 'pause' | 'rh' | 'stock' | 'finance' | 'vehicules' | 'accueil' | 'externes' | 'integrations';

export interface Floor {
  id: FloorId;
  label: string;
  short: string;
}

export interface Room {
  id: RoomId;
  floor: FloorId;
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
  clientId: string;
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
