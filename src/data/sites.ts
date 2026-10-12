// Sites internes, départements et implantation (configuration unique).
//
// IMPORTANT : l'implantation des départements par étage est une proposition de
// DÉMONSTRATION, à remplacer par l'implantation réelle. Seule la règle suivante
// provient du cahier des charges : les trois sites disposent des mêmes services,
// sauf les Ressources humaines et le Stock, présents uniquement à La Ciotat.
import type { Floor, ModuleId, Room, RoomKind, SiteId } from '../types';

export interface InternalSite {
  id: SiteId;
  name: string;
  /** Site principal de référence du projet. */
  main: boolean;
  short: string;
  color: string;
}

export const internalSites: InternalSite[] = [
  { id: 'laciotat', name: 'La Ciotat', main: true, short: 'LC', color: '#3176e9' },
  { id: 'montpellier', name: 'Montpellier', main: false, short: 'MTP', color: '#0f9488' },
  { id: 'paris', name: 'Paris', main: false, short: 'PAR', color: '#7c3aed' },
];

export const siteById = (id: SiteId) => internalSites.find((s) => s.id === id)!;

export type DepartmentId =
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
  | 'stock';

export interface Department {
  id: DepartmentId;
  label: string;
  description: string;
  /** Sites où le département dispose d'un espace. */
  sites: SiteId[];
}

const ALL_SITES: SiteId[] = ['laciotat', 'montpellier', 'paris'];

export const departments: Department[] = [
  { id: 'helpdesk', label: 'Helpdesk N1', description: 'Plateaux d’agents, files clients et tickets N1', sites: ALL_SITES },
  { id: 'mco', label: 'MCO / Support N2', description: 'Tickets escaladés, incidents complexes et majeurs, équipes N2 chez les clients', sites: ALL_SITES },
  { id: 'exploitation', label: 'Exploitation', description: 'Couverture opérationnelle, infrastructure, supervision et escalades', sites: ALL_SITES },
  { id: 'formation', label: 'Formation', description: 'Sessions, habilitations et parcours d’intégration', sites: ALL_SITES },
  { id: 'csm', label: 'CSM', description: 'Relation client, gouvernance des contrats et comités', sites: ALL_SITES },
  { id: 'rh', label: 'Ressources humaines', description: 'Congés, planning, formations et données RH agrégées', sites: ['laciotat'] },
  { id: 'finance', label: 'Finance / Comptabilité', description: 'Budget & Rentabilité, facturation et contrôle de gestion', sites: ALL_SITES },
  { id: 'commercial', label: 'Commercial', description: 'Opportunités, propositions et appels d’offres', sites: ALL_SITES },
  { id: 'direction', label: 'Direction générale', description: 'Cockpit de direction : sites, départements, budgets et risques', sites: ALL_SITES },
  { id: 'recrutement', label: 'Recrutement', description: 'Postes ouverts, candidatures et budget recrutement', sites: ALL_SITES },
  { id: 'moyens', label: 'Moyens généraux', description: 'Salles, maintenance, fournisseurs, demandes et déplacements professionnels', sites: ALL_SITES },
  { id: 'stock', label: 'Stocks et matériel', description: 'Équipements, casques et affectations', sites: ['laciotat'] },
];

/** Service présent sur un site (règle RH / Stock uniquement à La Ciotat). */
export const hasDepartment = (site: SiteId, dep: DepartmentId) => departments.find((d) => d.id === dep)!.sites.includes(site);

interface KindMeta {
  label: string;
  module: ModuleId;
  color: string;
  description: string;
}

const KIND: Record<Exclude<RoomKind, 'external' | 'building'>, KindMeta> = {
  accueil: { label: 'Accueil', module: 'accueil', color: '#e4ecf7', description: 'Visites, livraisons et réservations de salles' },
  pause: { label: 'Salle de pause', module: 'pause', color: '#dcf6e6', description: 'États de pause et de repas (métaphore, pas une localisation)' },
  stock: { label: 'Stock informatique', module: 'stock', color: '#ffe9d5', description: 'Équipements, casques et affectations' },
  parking: { label: 'Parc automobile', module: 'vehicules', color: '#dfe4ea', description: 'Véhicules disponibles et réservations' },
  helpdesk: { label: 'Plateau Helpdesk', module: 'supervision', color: '#d9e9ff', description: 'Files clients, agents, SLA et tickets' },
  mco: { label: 'MCO / Support N2', module: 'mco', color: '#dbeafe', description: 'Tickets escaladés, incidents complexes, backlog N2' },
  exploitation: { label: 'Service Exploitation', module: 'exploitation', color: '#dde9f6', description: 'Infrastructure, supervision et escalades reçues du MCO N2 des clients' },
  formation: { label: 'Salle de formation', module: 'formation', color: '#e0f2fe', description: 'Sessions de formation et habilitations' },
  csm: { label: 'Service CSM', module: 'csm', color: '#f9e4ec', description: 'Relation client, gouvernance des contrats et escalades contractuelles' },
  rh: { label: 'Ressources humaines', module: 'rh', color: '#f4e3ff', description: 'Congés, planning et formations (données agrégées)' },
  finance: { label: 'Finance / Comptabilité', module: 'finance', color: '#fef3c7', description: 'Budget & Rentabilité du département Helpdesk, facturation' },
  commercial: { label: 'Commercial', module: 'commercial', color: '#fde2e4', description: 'Opportunités, propositions et appels d’offres' },
  direction: { label: 'Direction générale', module: 'direction', color: '#fff0be', description: 'Cockpit PDG : sites, départements, budgets et risques' },
  recrutement: { label: 'Recrutement', module: 'recrutement', color: '#ede9fe', description: 'Postes ouverts, candidatures, budget recrutement' },
  moyens: { label: 'Moyens généraux', module: 'moyens', color: '#ecfccb', description: 'Salles, maintenance, demandes et déplacements professionnels' },
  reunion: { label: 'Salle de réunion', module: 'reunion', color: '#f1f5f9', description: 'Réunions, comités et visioconférences' },
};

type Slot = { kind: Exclude<RoomKind, 'external' | 'building'>; x: number; z: number; w: number; d: number; id?: string; label?: string; outdoor?: boolean };

// Gabarits de disposition sur un plateau de 11,4 × 7,9.
const grid2x2 = (kinds: Slot['kind'][]): Slot[] =>
  kinds.map((kind, i) => ({ kind, x: i % 2 === 0 ? -2.85 : 2.85, z: i < 2 ? -1.85 : 1.85, w: 5.5, d: 3.5 }));
const grid3x2 = (kinds: Slot['kind'][]): Slot[] =>
  kinds.map((kind, i) => ({ kind, x: ((i % 3) - 1) * 3.75, z: i < 3 ? -1.85 : 1.85, w: 3.6, d: 3.5 }));
const plateau = (right: [Slot['kind'], Slot['kind']]): Slot[] => [
  { kind: 'helpdesk', x: -1.85, z: 0, w: 6.9, d: 7.2 },
  { kind: right[0], x: 3.6, z: -1.85, w: 3.4, d: 3.5 },
  { kind: right[1], x: 3.6, z: 1.85, w: 3.4, d: 3.5 },
];
/** Deux espaces en haut, un espace pleine largeur en bas. */
const twoAndWide = (top: [Slot['kind'], Slot['kind']], wide: Slot['kind']): Slot[] => [
  ...grid2x2(top),
  { kind: wide, x: 0, z: 1.85, w: 11.2, d: 3.5 },
];
const halves = (kinds: [Slot['kind'], Slot['kind']]): Slot[] => [
  { kind: kinds[0], x: -2.8, z: 0, w: 5.4, d: 7.2 },
  { kind: kinds[1], x: 2.8, z: 0, w: 5.4, d: 7.2 },
];

interface FloorPlan {
  id: string;
  label: string;
  short: string;
  slots: Slot[];
}

/** Implantation de démonstration par site (configurable). */
export const sitePlans: Record<SiteId, FloorPlan[]> = {
  laciotat: [
    {
      id: 'rdc',
      label: 'Rez-de-chaussée',
      short: 'RDC',
      slots: [
        { kind: 'accueil', id: 'accueil', x: -3.6, z: -1.85, w: 3.4, d: 3.5 },
        { kind: 'pause', id: 'pause', x: 0, z: -1.85, w: 3.4, d: 3.5 },
        { kind: 'stock', id: 'stock', x: 3.6, z: -1.85, w: 3.4, d: 3.5 },
        { kind: 'parking', id: 'parking', x: 0, z: 2.2, w: 10.6, d: 3.4, outdoor: true },
      ],
    },
    { id: 'etage1', label: 'Étage 1', short: 'É1', slots: [{ ...plateau(['rh', 'direction'])[0], id: 'helpdesk' }, { ...plateau(['rh', 'direction'])[1], id: 'rh' }, { ...plateau(['rh', 'direction'])[2], id: 'direction' }] },
    { id: 'etage2', label: 'Étage 2', short: 'É2', slots: halves(['exploitation', 'csm']).map((s) => ({ ...s, id: s.kind })) },
    { id: 'lc-e3', label: 'Étage 3', short: 'É3', slots: grid2x2(['mco', 'formation', 'finance', 'commercial']) },
    { id: 'lc-e4', label: 'Étage 4', short: 'É4', slots: twoAndWide(['recrutement', 'reunion'], 'moyens') },
  ],
  montpellier: siteTemplate('mtp'),
  paris: siteTemplate('par'),
};

/** Gabarit commun aux sites secondaires : mêmes services, sans RH ni Stock. */
function siteTemplate(p: string): FloorPlan[] {
  return [
    { id: `${p}-rdc`, label: 'Rez-de-chaussée', short: 'RDC', slots: twoAndWide(['accueil', 'pause'], 'moyens') },
    { id: `${p}-e1`, label: 'Étage 1', short: 'É1', slots: plateau(['direction', 'finance']) },
    { id: `${p}-e2`, label: 'Étage 2', short: 'É2', slots: halves(['exploitation', 'csm']) },
    { id: `${p}-e3`, label: 'Étage 3', short: 'É3', slots: grid3x2(['mco', 'formation', 'commercial', 'recrutement', 'reunion']) },
  ];
}

const PREFIX: Record<SiteId, string> = { laciotat: 'lc', montpellier: 'mtp', paris: 'par' };

export function buildSiteFloorsAndRooms(): { floors: Floor[]; rooms: Room[] } {
  const floors: Floor[] = [];
  const rooms: Room[] = [];
  for (const site of internalSites) {
    for (const plan of sitePlans[site.id]) {
      floors.push({ id: plan.id, location: site.id, label: plan.label, short: plan.short });
      for (const slot of plan.slots) {
        const meta = KIND[slot.kind];
        rooms.push({
          id: slot.id ?? `${PREFIX[site.id]}-${slot.kind}`,
          floor: plan.id,
          location: site.id,
          kind: slot.kind,
          module: meta.module,
          label: slot.label ?? (slot.kind === 'direction' && !site.main ? 'Direction de site' : meta.label),
          description: meta.description,
          x: slot.x,
          z: slot.z,
          width: slot.w,
          depth: slot.d,
          color: meta.color,
          ...(slot.outdoor ? { outdoor: true } : {}),
        });
      }
    }
  }
  return { floors, rooms };
}
