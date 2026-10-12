import type { Floor, FloorId, Room, RoomId } from '../types';

export const floors: Floor[] = [
  { id: 'rdc', label: 'Rez-de-chaussée', short: 'RDC' },
  { id: 'etage1', label: 'Étage 1', short: 'É1' },
  { id: 'sites', label: 'Sites clients', short: 'Sites' },
];

export const rooms: Room[] = [
  { id: 'accueil', floor: 'rdc', module: 'accueil', label: 'Accueil', description: 'Visites, livraisons et salles de réunion', x: -3.6, z: -1.85, width: 3.4, depth: 3.5, color: '#e4ecf7' },
  { id: 'pause', floor: 'rdc', module: 'pause', label: 'Salle de pause', description: 'États de pause et de repas (métaphore, pas une localisation)', x: 0, z: -1.85, width: 3.4, depth: 3.5, color: '#dcf6e6' },
  { id: 'stock', floor: 'rdc', module: 'stock', label: 'Stock informatique', description: 'Équipements, casques et affectations', x: 3.6, z: -1.85, width: 3.4, depth: 3.5, color: '#ffe9d5' },
  { id: 'parking', floor: 'rdc', module: 'vehicules', label: 'Parc automobile', description: 'Véhicules disponibles et réservations', x: 0, z: 2.2, width: 10.6, depth: 3.4, color: '#dfe4ea', outdoor: true },
  { id: 'helpdesk', floor: 'etage1', module: 'supervision', label: 'Plateau Helpdesk', description: 'Files clients, agents, SLA et tickets', x: -1.85, z: 0, width: 6.9, depth: 7.2, color: '#d9e9ff' },
  { id: 'rh', floor: 'etage1', module: 'rh', label: 'Ressources humaines', description: 'Congés, planning et formations (données agrégées)', x: 3.6, z: -1.85, width: 3.4, depth: 3.5, color: '#f4e3ff' },
  ...(['invivo', 'primagaz', 'monext'] as const).map((c, i) => ({
    id: `ext-${c}` as RoomId,
    floor: 'sites' as FloorId,
    module: 'externes' as const,
    label: c.toUpperCase(),
    description: 'Site client externe : tickets, techniciens et prestations',
    x: (i - 1) * 3.75,
    z: 0,
    width: 3.5,
    depth: 7.6,
    color: '#dfeedd',
    outdoor: true,
    ground: '#cfe3c9',
    labelAt: [3.05, -2.1] as [number, number],
    externalClientId: c,
  })),
  { id: 'direction', floor: 'etage1', module: 'finance', label: 'Direction & budgets', description: 'Budgets, finance et reporting', x: 3.6, z: 1.85, width: 3.4, depth: 3.5, color: '#fff0be' },
];

export function roomById(id: RoomId): Room {
  const room = rooms.find((r) => r.id === id);
  if (!room) throw new Error(`Pièce inconnue : ${id}`);
  return room;
}

export function roomsOnFloor(floor: FloorId): Room[] {
  return rooms.filter((r) => r.floor === floor);
}

/**
 * Pôles clients du plateau Helpdesk. Coordonnées relatives au centre du plateau
 * (6,9 × 7,2) : trois pôles au fond, deux pôles devant.
 */
export interface HelpdeskPole {
  clientId: string;
  label: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  color: string;
  /** Colonnes de postes (positions x relatives au pôle). */
  columns: number[];
}

const ROW_DEPTH = 3.6;
const BACK_W = 6.9 / 3;
const FRONT_W = 6.9 / 2;

export const helpdeskPoles: HelpdeskPole[] = [
  { clientId: 'thelem', label: 'Pôle Thelem', x: -BACK_W, z: -ROW_DEPTH / 2, width: BACK_W, depth: ROW_DEPTH, color: '#bcd4fa', columns: [-0.55, 0.55] },
  { clientId: 'ird', label: 'Pôle IRD', x: 0, z: -ROW_DEPTH / 2, width: BACK_W, depth: ROW_DEPTH, color: '#c4ead9', columns: [-0.55, 0.55] },
  { clientId: 'ortec', label: 'Pôle Ortec', x: BACK_W, z: -ROW_DEPTH / 2, width: BACK_W, depth: ROW_DEPTH, color: '#f8d5b8', columns: [-0.55, 0.55] },
  { clientId: 'multi', label: 'Pôle Multi dédié', x: -FRONT_W / 2, z: ROW_DEPTH / 2, width: FRONT_W, depth: ROW_DEPTH, color: '#ddcdf7', columns: [-1.1, 0, 1.1] },
  { clientId: 'sodiaal', label: 'Pôle Sodiaal', x: FRONT_W / 2, z: ROW_DEPTH / 2, width: FRONT_W, depth: ROW_DEPTH, color: '#f3e6a6', columns: [-1.1, 0, 1.1] },
];

/** Rangées de postes (positions z relatives au pôle). */
const DESK_ROWS = [-0.9, 0.7];

export function poleByClient(clientId: string): HelpdeskPole | undefined {
  return helpdeskPoles.find((p) => p.clientId === clientId);
}

/** Positions des postes d'un pôle, relatives au centre du pôle. */
export function poleDesks(pole: HelpdeskPole): [number, number][] {
  return DESK_ROWS.flatMap((z) => pole.columns.map((x) => [x, z] as [number, number]));
}
