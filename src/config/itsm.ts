// Cartographie ITSM de référence — SOURCE UNIQUE pour toute l'application.
//
// Configuration fournie (Pôle Multi, Pôle Dédié et clients déjà référencés) :
//   EasyVista  : INVIVO, DMB, TERACT
//   Jira       : LBR FR, EURAPHARMA, ORTEC
//   GLPI       : ANGE, HSTV, NOCIBE
//   ISILOG     : THELEM, TRANSGOURMET, MONEXT
//   Zendesk    : SNR
//   ServiceNow : PRIMAGAZ, SODIAAL, IRD
// G2S : outil « à confirmer » → ITSM NON RENSEIGNÉ. Aucun outil n'est attribué par défaut,
// et le rattachement à un pôle ne se déduit jamais de l'outil ITSM.
import type { ItsmTool } from '../external/types';

export type MappedTool = Extract<ItsmTool, 'EasyVista' | 'Jira' | 'GLPI' | 'ISILOG' | 'Zendesk' | 'ServiceNow'>;

export const ITSM_MAPPING: Record<MappedTool, string[]> = {
  EasyVista: ['INVIVO', 'DMB', 'TERACT'],
  Jira: ['LBR FR', 'EURAPHARMA', 'ORTEC'],
  GLPI: ['ANGE', 'HSTV', 'NOCIBE'],
  ISILOG: ['THELEM', 'TRANSGOURMET', 'MONEXT'],
  Zendesk: ['SNR'],
  ServiceNow: ['PRIMAGAZ', 'SODIAAL', 'IRD'],
};

export const ITSM_NOT_SET = 'ITSM NON RENSEIGNÉ — CONFIGURATION REQUISE';

export type ClientKind = 'interne' | 'externe';

/** Pôles du plateau Helpdesk : chaque client est rattaché explicitement (jamais d'après son outil). */
export type PoleGroup = 'multi' | 'dedie';
export const POLE_GROUP_LABEL: Record<PoleGroup, string> = { multi: 'Pôle Multi', dedie: 'Pôle Dédié' };

/** Client : entité contractante. À ne pas confondre avec le site, le contrat ou l'équipe. */
export interface ClientRecord {
  id: string;
  /** Nom de référence (utilisé pour la correspondance ITSM). */
  name: string;
  /** externe = équipe MCO N2 SEATPI chez le client ; interne = traité uniquement sur les plateaux. */
  kind: ClientKind;
  /** Équipe(s) qui traitent les demandes. */
  teamLabel: string;
  /** Pôle du plateau Helpdesk qui traite le client en N1 (null = pas de N1 interne). */
  pole: PoleGroup | null;
  /** Rattachement de démonstration à confirmer (pôle, site). */
  allocationToConfirm: boolean;
}

const MULTI = 'Pôle Multi — La Ciotat et Montpellier';
const DEDIE = (n: string) => `Pôle Dédié — équipe ${n} (La Ciotat)`;

export const clientRegistry: ClientRecord[] = [
  { id: 'invivo', name: 'INVIVO', kind: 'externe', teamLabel: `${MULTI} (N1) · MCO N2 INVIVO chez le client`, pole: 'multi', allocationToConfirm: false },
  { id: 'primagaz', name: 'PRIMAGAZ', kind: 'externe', teamLabel: `${DEDIE('PRIMAGAZ')} (N1) · MCO N2 PRIMAGAZ chez le client`, pole: 'dedie', allocationToConfirm: false },
  { id: 'monext', name: 'MONEXT', kind: 'externe', teamLabel: 'MCO N2 MONEXT (chez le client)', pole: null, allocationToConfirm: false },
  { id: 'thelem', name: 'THELEM', kind: 'interne', teamLabel: DEDIE('THELEM'), pole: 'dedie', allocationToConfirm: false },
  { id: 'ird', name: 'IRD', kind: 'interne', teamLabel: DEDIE('IRD'), pole: 'dedie', allocationToConfirm: false },
  { id: 'ortec', name: 'ORTEC', kind: 'interne', teamLabel: DEDIE('ORTEC'), pole: 'dedie', allocationToConfirm: false },
  { id: 'sodiaal', name: 'SODIAAL', kind: 'interne', teamLabel: DEDIE('SODIAAL'), pole: 'dedie', allocationToConfirm: false },
  ...(
    [
      ['ange', 'ANGE'],
      ['hstv', 'HSTV'],
      ['lbrfr', 'LBR FR'],
      ['transgourmet', 'TRANSGOURMET'],
      ['snr', 'SNR'],
      ['dmb', 'DMB'],
      ['nocibe', 'NOCIBE'],
      ['teract', 'TERACT'],
      ['g2s', 'G2S'],
      ['eurapharma', 'EURAPHARMA'],
    ] as const
  ).map(([id, name]) => ({ id, name, kind: 'interne' as const, teamLabel: MULTI, pole: 'multi' as const, allocationToConfirm: id === 'eurapharma' })),
];

const norm = (s: string) => s.trim().toUpperCase();

/** Outil ITSM d'un client (par identifiant ou nom), ou null s'il n'est pas renseigné. */
/**
 * Modifications du référentiel faites par l'administrateur depuis l'application (CRM).
 * Elles priment sur la configuration fournie, sans modification du code source.
 */
export interface ClientOverride {
  name?: string;
  pole?: PoleGroup | null;
  tool?: MappedTool | null;
}

let overrides: Record<string, ClientOverride> = {};

export function setClientOverrides(next: Record<string, ClientOverride>) {
  overrides = next;
}

export function itsmOf(idOrName: string): MappedTool | null {
  const rec = clientRegistry.find((c) => c.id === idOrName) ?? clientRegistry.find((c) => norm(c.name) === norm(idOrName));
  if (rec && overrides[rec.id] && 'tool' in overrides[rec.id]) return overrides[rec.id].tool ?? null;
  const name = norm(rec?.name ?? idOrName);
  for (const [tool, clients] of Object.entries(ITSM_MAPPING) as [MappedTool, string[]][]) {
    if (clients.map(norm).includes(name)) return tool;
  }
  return null;
}

export const clientRecord = (id: string): ClientRecord | undefined => {
  const rec = clientRegistry.find((c) => c.id === id);
  if (!rec || !overrides[id]) return rec;
  const o = overrides[id];
  return { ...rec, ...(o.name ? { name: o.name } : {}), ...('pole' in o ? { pole: o.pole ?? null } : {}) };
};

/** Clients d'un groupe de pôles N1 (ordre de la liste fournie pour le Pôle Multi). */
// EURAPHARMA : affectation existante au Pôle Multi conservée.
const MULTI_CLIENTS = ['ange', 'hstv', 'lbrfr', 'transgourmet', 'invivo', 'snr', 'dmb', 'nocibe', 'teract', 'g2s', 'eurapharma'];

/**
 * Clients traités par chaque pôle du plateau (clé = identifiant du pôle).
 * Pôle Dédié : une équipe par client (THELEM, IRD, ORTEC, SODIAAL, PRIMAGAZ) à La Ciotat.
 * Pôle Multi : La Ciotat (`multi`) et Montpellier (`multi-mtp`), avec les mêmes clients.
 */
export const POLE_CLIENTS: Record<string, string[]> = {
  thelem: ['thelem'],
  ird: ['ird'],
  ortec: ['ortec'],
  sodiaal: ['sodiaal'],
  primagaz: ['primagaz'],
  multi: MULTI_CLIENTS,
  'multi-mtp': MULTI_CLIENTS,
};

/** Zones de pôle (identifiants) de chaque pôle du plateau. */
export const POLE_ZONES: Record<PoleGroup, string[]> = { dedie: ['thelem', 'ird', 'ortec', 'primagaz', 'sodiaal'], multi: ['multi', 'multi-mtp'] };
export const poleGroupOfZone = (zone: string): PoleGroup | null => (Object.keys(POLE_ZONES) as PoleGroup[]).find((g) => POLE_ZONES[g].includes(zone)) ?? null;

/** Clients distincts traités en N1 sur les plateaux, avec les pôles qui les prennent en charge. */
export const n1Clients: { clientId: string; poleIds: string[] }[] = [...new Set(Object.values(POLE_CLIENTS).flat())].map((clientId) => ({
  clientId,
  poleIds: Object.entries(POLE_CLIENTS)
    .filter(([, list]) => list.includes(clientId))
    .map(([pole]) => pole),
}));

// --- Registre des connecteurs ------------------------------------------------

export type ConnectorStatus = 'Non connecté' | 'Flux de démonstration' | 'Connecté' | 'Erreur';

export interface ConnectorEntry {
  id: string;
  tool: MappedTool;
  clientId: string;
  /** Valeurs jamais inventées : null = non renseigné. */
  instance: string | null;
  apiUrl: string | null;
  authMode: string | null;
  status: ConnectorStatus;
  /** Lecture / écriture : à obtenir auprès du client ou de l'éditeur. */
  readPermission: 'À obtenir' | 'Accordée';
  writePermission: 'À obtenir' | 'Accordée' | 'Refusée';
  slaRules: string | null;
}

/** Une entrée par couple outil / client de la cartographie. */
export const connectorRegistry: ConnectorEntry[] = (Object.entries(ITSM_MAPPING) as [MappedTool, string[]][]).flatMap(([tool, names]) =>
  names.map((name) => {
    const rec = clientRegistry.find((c) => norm(c.name) === norm(name));
    return {
      id: `${tool}-${rec?.id ?? norm(name)}`,
      tool,
      clientId: rec?.id ?? norm(name).toLowerCase(),
      instance: null,
      apiUrl: null,
      authMode: null,
      status: 'Non connecté' as ConnectorStatus,
      readPermission: 'À obtenir' as const,
      writePermission: 'À obtenir' as const,
      slaRules: null,
    };
  }),
);
