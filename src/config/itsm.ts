// Cartographie ITSM de référence — SOURCE UNIQUE pour toute l'application.
//
// Reprise à l'identique de la configuration initiale fournie :
//   EasyVista : INVIVO, DMB
//   Jira      : LBR FR, EURAPHARMA
//   GLPI      : ANGE, HSTV
//   ISILOG    : THELEM, TRANSGOURMET, MONEXT
// Tout client absent de ce tableau est « ITSM NON RENSEIGNÉ — CONFIGURATION REQUISE ».
// Aucun outil n'est attribué par défaut.
import type { ItsmTool } from '../external/types';

export type MappedTool = Extract<ItsmTool, 'EasyVista' | 'Jira' | 'GLPI' | 'ISILOG'>;

export const ITSM_MAPPING: Record<MappedTool, string[]> = {
  EasyVista: ['INVIVO', 'DMB'],
  Jira: ['LBR FR', 'EURAPHARMA'],
  GLPI: ['ANGE', 'HSTV'],
  ISILOG: ['THELEM', 'TRANSGOURMET', 'MONEXT'],
};

export const ITSM_NOT_SET = 'ITSM NON RENSEIGNÉ — CONFIGURATION REQUISE';

export type ClientKind = 'interne' | 'externe';

/** Client : entité contractante. À ne pas confondre avec le site, le contrat ou l'équipe. */
export interface ClientRecord {
  id: string;
  /** Nom de référence (utilisé pour la correspondance ITSM). */
  name: string;
  kind: ClientKind;
  /** Équipe qui traite les demandes : pôle d'un plateau interne ou équipe N2 chez le client. */
  teamLabel: string;
  /** Rattachement de démonstration à confirmer (pôle, site). */
  allocationToConfirm: boolean;
}

export const clientRegistry: ClientRecord[] = [
  { id: 'invivo', name: 'INVIVO', kind: 'externe', teamLabel: 'MCO N2 INVIVO (chez le client)', allocationToConfirm: false },
  { id: 'primagaz', name: 'PRIMAGAZ', kind: 'externe', teamLabel: 'MCO N2 PRIMAGAZ (chez le client)', allocationToConfirm: false },
  { id: 'monext', name: 'MONEXT', kind: 'externe', teamLabel: 'MCO N2 MONEXT (chez le client)', allocationToConfirm: false },
  { id: 'thelem', name: 'THELEM', kind: 'interne', teamLabel: 'Pôle Thelem — La Ciotat', allocationToConfirm: true },
  { id: 'ird', name: 'IRD', kind: 'interne', teamLabel: 'Pôle IRD — La Ciotat', allocationToConfirm: true },
  { id: 'ortec', name: 'ORTEC', kind: 'interne', teamLabel: 'Pôle Ortec — La Ciotat', allocationToConfirm: true },
  { id: 'sodiaal', name: 'SODIAAL', kind: 'interne', teamLabel: 'Pôle Sodiaal — La Ciotat', allocationToConfirm: true },
  { id: 'dmb', name: 'DMB', kind: 'interne', teamLabel: 'Pôle Multi dédié — La Ciotat', allocationToConfirm: true },
  { id: 'transgourmet', name: 'TRANSGOURMET', kind: 'interne', teamLabel: 'Pôle Multi dédié — La Ciotat', allocationToConfirm: true },
  { id: 'lbrfr', name: 'LBR FR', kind: 'interne', teamLabel: 'Pôle LBR FR — Montpellier', allocationToConfirm: true },
  { id: 'eurapharma', name: 'EURAPHARMA', kind: 'interne', teamLabel: 'Pôle Eurapharma — Montpellier', allocationToConfirm: true },
  { id: 'ange', name: 'ANGE', kind: 'interne', teamLabel: 'Pôle ANGE — Paris', allocationToConfirm: true },
  { id: 'hstv', name: 'HSTV', kind: 'interne', teamLabel: 'Pôle HSTV — Paris', allocationToConfirm: true },
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

/** Clients rattachés à un pôle du plateau interne (le pôle « Multi dédié » en regroupe plusieurs). */
export const POLE_CLIENTS: Record<string, string[]> = {
  thelem: ['thelem'],
  ird: ['ird'],
  ortec: ['ortec'],
  sodiaal: ['sodiaal'],
  multi: ['dmb', 'transgourmet'],
  lbrfr: ['lbrfr'],
  eurapharma: ['eurapharma'],
  ange: ['ange'],
  hstv: ['hstv'],
};

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
