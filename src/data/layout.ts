import type { Floor, FloorId, Room, RoomId } from '../types';

export const floors: Floor[] = [
  { id: 'rdc', label: 'Rez-de-chaussée', short: 'RDC' },
  { id: 'etage1', label: 'Étage 1', short: 'É1' },
];

export const rooms: Room[] = [
  { id: 'accueil', floor: 'rdc', module: 'accueil', label: 'Accueil', description: 'Visites, livraisons et salles de réunion', x: -3.6, z: -1.85, width: 3.4, depth: 3.5, color: '#e4ecf7' },
  { id: 'pause', floor: 'rdc', module: 'pause', label: 'Salle de pause', description: 'États de pause et de repas (métaphore, pas une localisation)', x: 0, z: -1.85, width: 3.4, depth: 3.5, color: '#dcf6e6' },
  { id: 'stock', floor: 'rdc', module: 'stock', label: 'Stock informatique', description: 'Équipements, casques et affectations', x: 3.6, z: -1.85, width: 3.4, depth: 3.5, color: '#ffe9d5' },
  { id: 'parking', floor: 'rdc', module: 'vehicules', label: 'Parc automobile', description: 'Véhicules disponibles et réservations', x: 0, z: 2.2, width: 10.6, depth: 3.4, color: '#dfe4ea', outdoor: true },
  { id: 'helpdesk', floor: 'etage1', module: 'supervision', label: 'Plateau Helpdesk', description: 'Files clients, agents, SLA et tickets', x: -1.85, z: 0, width: 6.9, depth: 7.2, color: '#d9e9ff' },
  { id: 'rh', floor: 'etage1', module: 'rh', label: 'Ressources humaines', description: 'Congés, planning et formations (données agrégées)', x: 3.6, z: -1.85, width: 3.4, depth: 3.5, color: '#f4e3ff' },
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

/** Positions des postes du plateau Helpdesk, relatives au centre de la pièce. */
export const helpdeskDesks: [number, number][] = [-2.6, -1.0, 0.6, 2.2].flatMap((z) =>
  [-2.4, -0.8, 0.8, 2.4].map((x) => [x, z] as [number, number]),
);
