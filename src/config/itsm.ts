// Cartographie ITSM de référence — SOURCE UNIQUE pour toute l'application.
//
// Configuration fournie (mise à jour : clients du Pôle Multi) :
//   EasyVista : INVIVO, DMB, TERACT
//   Jira      : LBR FR, EURAPHARMA
//   GLPI      : ANGE, HSTV, NOCIBE
//   ISILOG    : THELEM, TRANSGOURMET, MONEXT
//   Zendesk   : SNR
// Tout client absent de ce tableau (PRIMAGAZ, IRD, ORTEC, SODIAAL, G2S) est
// « ITSM NON RENSEIGNÉ — CONFIGURATION REQUISE ». Aucun outil n'est attribué par défaut.
import type { ItsmTool } from '../external/types';

export type MappedTool = Extract<ItsmTool, 'EasyVista' | 'Jira' | 'GLPI' | 'ISILOG' | 'Zendesk'>;

export const ITSM_MAPPING: Record<MappedTool, string[]> = {
  EasyVista: ['INVIVO', 'DMB', 'TERACT'],
  Jira: ['LBR FR', 'EURAPHARMA'],
  GLPI: ['ANGE', 'HSTV', 'NOCIBE'],
  ISILOG: ['THELEM', 'TRANSGOURMET', 'MONEXT'],
  Zendesk: ['SNR'],
};

export const ITSM_NOT_SET = 'ITSM NON RENSEIGNÉ — CONFIGURATION REQUISE';

export type ClientKind = 'interne' | 'externe';

/** Client : entité contractante. À ne pas confondre avec le site, le contrat ou l'équipe. */
export interface ClientRecord {
  id: string;
  /** Nom de référence (utilisé pour la correspondance ITSM). */
  name: string;
  /** externe = équipe MCO N2 SEATPI chez le client ; interne = traité uniquement sur les plateaux. */
  kind: ClientKind;
  /** Équipe(s) qui traitent les demandes. */
  teamLabel: string;
  /** Groupe de pôles N1 qui traite le client sur les plateaux internes (null = aucun N1 interne). */
  n1Pole: string | null;
  /** Rattachement de démonstration à confirmer (pôle, site). */
  allocationToConfirm: boolean;
}

const MULTI = 'Pôle Multi — La Ciotat et Montpellier';

export const clientRegistry: ClientRecord[] = [
  { id: 'invivo', name: 'INVIVO', kind: 'externe', teamLabel: `${MULTI} (N1) · MCO N2 INVIVO chez le client`, n1Pole: 'multi', allocationToConfirm: false },
  { id: 'primagaz', name: 'PRIMAGAZ', kind: 'externe', teamLabel: 'MCO N2 PRIMAGAZ (chez le client)', n1Pole: null, allocationToConfirm: false },
  { id: 'monext', name: 'MONEXT', kind: 'externe', teamLabel: 'MCO N2 MONEXT (chez le client)', n1Pole: null, allocationToConfirm: false },
  { id: 'thelem', name: 'THELEM', kind: 'interne', teamLabel: 'Pôle Thelem — La Ciotat', n1Pole: 'thelem', allocationToConfirm: true },
  { id: 'ird', name: 'IRD', kind: 'interne', teamLabel: 'Pôle IRD — La Ciotat', n1Pole: 'ird', allocationToConfirm: true },
  { id: 'ortec', name: 'ORTEC', kind: 'interne', teamLabel: 'Pôle Ortec — La Ciotat', n1Pole: 'ortec', allocationToConfirm: true },
  { id: 'sodiaal', name: 'SODIAAL', kind: 'interne', teamLabel: 'Pôle Sodiaal — La Ciotat', n1Pole: 'sodiaal', allocationToConfirm: true },
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
  ).map(([id, name]) => ({ id, name, kind: 'interne' as const, teamLabel: MULTI, n1Pole: 'multi', allocationToConfirm: true })),
];

const norm = (s: string) => s.trim().toUpperCase();

/** Outil ITSM d'un client (par identifiant ou nom), ou null s'il n'est pas renseigné. */
export function itsmOf(idOrName: string): MappedTool | null {
  const rec = clientRegistry.find((c) => c.id === idOrName) ?? clientRegistry.find((c) => norm(c.name) === norm(idOrName));
  const name = norm(rec?.name ?? idOrName);
  for (const [tool, clients] of Object.entries(ITSM_MAPPING) as [MappedTool, string[]][]) {
    if (clients.map(norm).includes(name)) return tool;
  }
  return null;
}

export const clientRecord = (id: string) => clientRegistry.find((c) => c.id === id);

/** Clients d'un groupe de pôles N1 (ordre de la liste fournie pour le Pôle Multi). */
const MULTI_CLIENTS = ['ange', 'hstv', 'lbrfr', 'transgourmet', 'invivo', 'snr', 'dmb', 'nocibe', 'teract', 'g2s', 'eurapharma'];

/**
 * Clients traités par chaque pôle du plateau (clé = identifiant du pôle).
 * Le Pôle Multi existe à La Ciotat (`multi`) et à Montpellier (`multi-mtp`) avec les mêmes clients.
 */
export const POLE_CLIENTS: Record<string, string[]> = {
  thelem: ['thelem'],
  ird: ['ird'],
  ortec: ['ortec'],
  sodiaal: ['sodiaal'],
  multi: MULTI_CLIENTS,
  'multi-mtp': MULTI_CLIENTS,
};

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
