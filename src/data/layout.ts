import type { Floor, FloorId, Location, Room, RoomId, SiteId } from '../types';
import type { PoleGroup } from '../config/itsm';
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
  /** Identifiant unique de l'implantation (pôle @ site). */
  id: string;
  /** Pôle d'appartenance : équipe dédiée ou « multi » (un seul Pôle Multi, commun aux trois sites). */
  clientId: string;
  /** Pôle du plateau : Pôle Dédié (une équipe par client) ou Pôle Multi. */
  group: PoleGroup;
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
const BACK_W = 6.9 / 4;
const FRONT_W = 6.9 / 2;

export const helpdeskPoles: HelpdeskPole[] = ([
  // Rangée du fond : équipes du Pôle Dédié.
  { clientId: 'thelem', group: 'dedie', site: 'laciotat', label: 'Dédié · Thelem', x: -1.5 * BACK_W, z: -ROW_DEPTH / 2, width: BACK_W, depth: ROW_DEPTH, color: '#bcd4fa', columns: [-0.42, 0.42] },
  { clientId: 'ird', group: 'dedie', site: 'laciotat', label: 'Dédié · IRD', x: -0.5 * BACK_W, z: -ROW_DEPTH / 2, width: BACK_W, depth: ROW_DEPTH, color: '#c4ead9', columns: [-0.42, 0.42] },
  { clientId: 'ortec', group: 'dedie', site: 'laciotat', label: 'Dédié · Ortec', x: 0.5 * BACK_W, z: -ROW_DEPTH / 2, width: BACK_W, depth: ROW_DEPTH, color: '#f8d5b8', columns: [-0.42, 0.42] },
  { clientId: 'primagaz', group: 'dedie', site: 'laciotat', label: 'Dédié · PRIMAGAZ', x: 1.5 * BACK_W, z: -ROW_DEPTH / 2, width: BACK_W, depth: ROW_DEPTH, color: '#fbd0d9', columns: [-0.42, 0.42] },
  // Rangée de devant : Pôle Multi et équipe SODIAAL du Pôle Dédié.
  { clientId: 'multi', group: 'multi', site: 'laciotat', label: 'Pôle Multi', x: -FRONT_W / 2, z: ROW_DEPTH / 2, width: FRONT_W, depth: ROW_DEPTH, color: '#ddcdf7', columns: [-1.1, 0, 1.1] },
  { clientId: 'sodiaal', group: 'dedie', site: 'laciotat', label: 'Dédié · Sodiaal', x: FRONT_W / 2, z: ROW_DEPTH / 2, width: FRONT_W, depth: ROW_DEPTH, color: '#f3e6a6', columns: [-1.1, 0, 1.1] },
  // Le même Pôle Multi est implanté à Montpellier et à Paris (aucun agent affecté à Paris pour le moment).
  { clientId: 'multi', group: 'multi', site: 'montpellier', label: 'Pôle Multi', x: 0, z: 0, width: 2 * FRONT_W, depth: 7.2, color: '#ddcdf7', columns: [-1.1, 0, 1.1], rows: [-2.5, -0.7, 1.1] },
  { clientId: 'multi', group: 'multi', site: 'paris', label: 'Pôle Multi', x: 0, z: 0, width: 2 * FRONT_W, depth: 7.2, color: '#ddcdf7', columns: [-1.1, 0, 1.1], rows: [-2.5, -0.7, 1.1] },
] as Omit<HelpdeskPole, 'id'>[]).map((p) => ({ ...p, id: `${p.clientId}@${p.site}` }));

export const polesOf = (site: SiteId) => helpdeskPoles.filter((p) => p.site === site);

/** Rangées de postes (positions z relatives au pôle). */
const DESK_ROWS = [-0.9, 0.7];

/** Implantation d'un pôle ; avec un site, celle de ce site (le Pôle Multi est présent sur les trois sites). */
export function poleByClient(clientId: string, site?: SiteId | null): HelpdeskPole | undefined {
  return helpdeskPoles.find((p) => p.clientId === clientId && (!site || p.site === site)) ?? helpdeskPoles.find((p) => p.clientId === clientId);
}

/** Positions des postes d'un pôle, relatives au centre du pôle. */
export function poleDesks(pole: HelpdeskPole): [number, number][] {
  return (pole.rows ?? DESK_ROWS).flatMap((z) => pole.columns.map((x) => [x, z] as [number, number]));
}
