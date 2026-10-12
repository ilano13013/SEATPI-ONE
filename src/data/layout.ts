import type { Floor, FloorId, Location, Room, RoomId, SiteId } from '../types';
import { buildSiteFloorsAndRooms, internalSites, sitePlans } from './sites';

const site = buildSiteFloorsAndRooms();

export const floors: Floor[] = [
  { id: 'carte', location: 'carte', label: 'Carte des sites', short: 'Carte' },
  ...site.floors,
  { id: 'sites', location: 'externes', label: 'Sites clients externes', short: 'Clients' },
];

const EXTERNAL = ['invivo', 'primagaz', 'monext'] as const;

export const rooms: Room[] = [
  // Carte d'ensemble : un bâtiment par site interne, puis les sites clients externes.
  ...internalSites.map((s, i) => ({
    id: `site-${s.id}`,
    floor: 'carte',
    location: 'carte' as Location,
    kind: 'building' as const,
    module: 'carte' as const,
    label: s.main ? `${s.name} · site principal` : s.name,
    description: `Site SEATPI de ${s.name} : ${sitePlans[s.id].length} niveaux. Cliquer pour entrer dans le bâtiment.`,
    x: (i - 1) * 3.9,
    z: -1.9,
    width: 3.5,
    depth: 3.4,
    color: '#e8eef6',
    outdoor: true,
    ground: '#d9e3ee',
    labelAt: [0.6 + sitePlans[s.id].length * 0.55, -0.4] as [number, number],
    targetSite: s.id,
  })),
  ...EXTERNAL.map((c, i) => ({
    id: `carte-ext-${c}`,
    floor: 'carte',
    location: 'carte' as Location,
    kind: 'external' as const,
    module: 'externes' as const,
    label: c.toUpperCase(),
    description: 'Site client externe : prestations assurées par des collaborateurs SEATPI.',
    x: (i - 1) * 3.9,
    z: 2.3,
    width: 3.5,
    depth: 2.6,
    color: '#dfeedd',
    outdoor: true,
    ground: '#cfe3c9',
    labelAt: [1.9, -0.3] as [number, number],
    externalClientId: c,
  })),
  ...site.rooms,
  ...EXTERNAL.map((c, i) => ({
    id: `ext-${c}`,
    floor: 'sites',
    location: 'externes' as Location,
    kind: 'external' as const,
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
];

export const floorById = (id: FloorId) => floors.find((f) => f.id === id)!;
export const floorsOf = (location: Location) => floors.filter((f) => f.location === location);

/** Étage d'arrivée quand on entre dans un site (celui du plateau Helpdesk). */
export function entryFloor(site: SiteId): FloorId {
  return rooms.find((r) => r.location === site && r.kind === 'helpdesk')!.floor;
}

/** Plateau Helpdesk d'un site. */
export function plateauOf(site: SiteId): Room {
  return rooms.find((r) => r.location === site && r.kind === 'helpdesk')!;
}

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
  /** Site du plateau qui héberge le pôle (répartition de démonstration). */
  site: SiteId;
  label: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  color: string;
  /** Colonnes de postes (positions x relatives au pôle). */
  columns: number[];
  /** Rangées de postes (positions z relatives au pôle). */
  rows?: number[];
}

const ROW_DEPTH = 3.6;
const BACK_W = 6.9 / 3;
const FRONT_W = 6.9 / 2;

export const helpdeskPoles: HelpdeskPole[] = [
  { clientId: 'thelem', site: 'laciotat', label: 'Pôle Thelem', x: -BACK_W, z: -ROW_DEPTH / 2, width: BACK_W, depth: ROW_DEPTH, color: '#bcd4fa', columns: [-0.55, 0.55] },
  { clientId: 'ird', site: 'laciotat', label: 'Pôle IRD', x: 0, z: -ROW_DEPTH / 2, width: BACK_W, depth: ROW_DEPTH, color: '#c4ead9', columns: [-0.55, 0.55] },
  { clientId: 'ortec', site: 'laciotat', label: 'Pôle Ortec', x: BACK_W, z: -ROW_DEPTH / 2, width: BACK_W, depth: ROW_DEPTH, color: '#f8d5b8', columns: [-0.55, 0.55] },
  { clientId: 'multi', site: 'laciotat', label: 'Pôle Multi dédié', x: -FRONT_W / 2, z: ROW_DEPTH / 2, width: FRONT_W, depth: ROW_DEPTH, color: '#ddcdf7', columns: [-1.1, 0, 1.1] },
  { clientId: 'sodiaal', site: 'laciotat', label: 'Pôle Sodiaal', x: FRONT_W / 2, z: ROW_DEPTH / 2, width: FRONT_W, depth: ROW_DEPTH, color: '#f3e6a6', columns: [-1.1, 0, 1.1] },
  // Plateaux de Montpellier et Paris : deux pôles chacun (répartition de démonstration).
  ...sidePoles('montpellier', [['lbrfr', 'Pôle LBR FR', '#c7f0ea'], ['eurapharma', 'Pôle Eurapharma', '#d6e4fb']]),
  ...sidePoles('paris', [['ange', 'Pôle ANGE', '#e5d9fb'], ['hstv', 'Pôle HSTV', '#fde0cf']]),
];

function sidePoles(site: SiteId, defs: [string, string, string][]): HelpdeskPole[] {
  return defs.map(([clientId, label, color], i) => ({
    clientId,
    site,
    label,
    x: i === 0 ? -FRONT_W / 2 : FRONT_W / 2,
    z: 0,
    width: FRONT_W,
    depth: 7.2,
    color,
    columns: [-1.1, 0, 1.1],
    rows: [-2.5, -0.7, 1.1],
  }));
}

export const polesOf = (site: SiteId) => helpdeskPoles.filter((p) => p.site === site);

/** Rangées de postes (positions z relatives au pôle). */
const DESK_ROWS = [-0.9, 0.7];

export function poleByClient(clientId: string): HelpdeskPole | undefined {
  return helpdeskPoles.find((p) => p.clientId === clientId);
}

/** Positions des postes d'un pôle, relatives au centre du pôle. */
export function poleDesks(pole: HelpdeskPole): [number, number][] {
  return (pole.rows ?? DESK_ROWS).flatMap((z) => pole.columns.map((x) => [x, z] as [number, number]));
}
