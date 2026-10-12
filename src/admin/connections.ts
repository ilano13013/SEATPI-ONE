// Administration → Connexions & API : registre des futures intégrations.
//
// Règles :
// - aucune URL propre à l'entreprise n'est inventée : tous les champs démarrent vides ;
// - aucun secret (clé API, mot de passe, jeton) n'est saisi ni stocké dans le navigateur :
//   seule une RÉFÉRENCE au secret conservé côté serveur (coffre) est renseignée ;
// - sans backend sécurisé, aucun test réel n'est possible : « Test réel indisponible en
//   démonstration » — jamais de faux succès ;
// - la configuration n'est pas persistée (mémoire de la page) et sera, en production,
//   enregistrée et appliquée par le backend.
import { clientRegistry, itsmOf, type MappedTool } from '../config/itsm';

export type ConnectorKind = 'ITSM' | 'Statistiques' | 'Téléphonie' | 'Autre';
export type AuthType = 'OAuth 2.0' | 'Jeton API' | 'Authentification basique' | 'Compte de service' | 'SAML / SSO' | 'Autre';
export const AUTH_TYPES: AuthType[] = ['OAuth 2.0', 'Jeton API', 'Authentification basique', 'Compte de service', 'SAML / SSO', 'Autre'];

export type ConfigStatus = 'Non configuré' | 'Configuration incomplète' | 'Prêt à tester' | 'Connecté' | 'Erreur de connexion';
export const CONFIG_STATUSES: ConfigStatus[] = ['Non configuré', 'Configuration incomplète', 'Prêt à tester', 'Connecté', 'Erreur de connexion'];

export const DEMO_TEST_MESSAGE = 'Test réel indisponible en démonstration';

export interface Endpoint {
  name: string;
  path: string;
}

export interface Instance {
  id: string;
  label: string;
  /** Clients servis par cette instance (plusieurs instances possibles pour un ITSM). */
  clients: string[];
  instanceUrl: string;
  apiUrl: string;
  endpoints: Endpoint[];
}

export interface Connector {
  id: string;
  name: string;
  kind: ConnectorKind;
  /**
   * « client » : connecteur propre à un client (chaque client a son propre domaine / instance ITSM) ;
   * « général » : connecteur commun à tous les clients (QlikView, Genesys Cloud).
   */
  scope: 'client' | 'général';
  /** Client du connecteur (portée « client »). */
  clientId: string | null;
  docUrl: string;
  authType: AuthType | null;
  /** Nom du secret dans le coffre côté serveur (jamais la valeur du secret). */
  secretRef: string;
  params: { key: string; value: string }[];
  instances: Instance[];
  lastTest: { at: number; result: string } | null;
  lastSync: number | null;
}

const blankInstance = (id: string, clients: string[] = []): Instance => ({ id, label: 'Instance principale', clients, instanceUrl: '', apiUrl: '', endpoints: [] });

const connector = (id: string, name: string, kind: ConnectorKind, clients: string[], clientId: string | null = null): Connector => ({
  id,
  name,
  kind,
  scope: clientId ? 'client' : 'général',
  clientId,
  docUrl: '',
  authType: null,
  secretRef: '',
  params: [],
  instances: [blankInstance(`${id}-1`, clients)],
  lastTest: null,
  lastSync: null,
});

/** Ordre d'affichage des outils ITSM. */
export const ITSM_TOOLS: MappedTool[] = ['EasyVista', 'Jira', 'GLPI', 'ISILOG', 'Zendesk', 'ServiceNow'];

/**
 * Un connecteur ITSM par client (domaine / instance propre à chaque client), y compris pour un
 * client dont l'outil reste à confirmer (G2S) ; QlikView et Genesys Cloud sont communs à tous les clients.
 */
export function initialConnectors(): Connector[] {
  const all = clientRegistry.map((c) => c.id);
  return [
    ...clientRegistry.map((c) => {
      const conn = connector(`itsm-${c.id}`, c.name, 'ITSM', [c.id], c.id);
      return { ...conn, instances: [{ ...conn.instances[0], label: `Domaine ${c.name}` }] };
    }),
    connector('qlikview', 'QlikView', 'Statistiques', all),
    connector('genesys', 'Genesys Cloud', 'Téléphonie', all),
  ];
}

/** Outil ITSM d'un connecteur client (référentiel courant, modifiable dans le CRM). */
export const toolOfConnector = (c: Connector): MappedTool | null => (c.scope === 'client' && c.clientId ? itsmOf(c.clientId) : null);

// --- Validation ----------------------------------------------------------------------

/** Détection prudente de valeurs ressemblant à un secret (refusées dans le navigateur). */
export function looksLikeSecret(key: string, value: string): boolean {
  if (!value.trim()) return false;
  if (/(secret|password|mot.?de.?passe|token|jeton|api.?key|cl[ée].?api|client.?secret)/i.test(key)) return true;
  if (/^bearer\s+/i.test(value) || /^basic\s+[a-z0-9+/=]{8,}/i.test(value)) return true;
  // Longue chaîne aléatoire sans espace (clé, jeton).
  return /^[A-Za-z0-9_\-+/=.]{32,}$/.test(value) && /[0-9]/.test(value) && /[A-Za-z]/.test(value);
}

export function validateUrl(value: string): string | null {
  if (!value.trim()) return null;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return 'URL invalide (format attendu : https://…).';
  }
  if (u.protocol !== 'https:') return 'Seules les URL https:// sont acceptées.';
  if (u.username || u.password) return 'Les identifiants ne doivent jamais figurer dans une URL.';
  if ([...u.searchParams.keys()].some((k) => /(token|key|secret|password|signature)/i.test(k))) return 'Aucun jeton ni clé ne doit figurer dans l’URL.';
  return null;
}

export function validateSecretRef(value: string): string | null {
  if (!value.trim()) return null;
  if (looksLikeSecret('ref', value)) return 'Saisissez uniquement le NOM du secret dans le coffre côté serveur, jamais sa valeur.';
  if (!/^[A-Za-z0-9_\-./:]{3,80}$/.test(value)) return 'Référence attendue : nom court (lettres, chiffres, _ - . / :).';
  return null;
}

// --- Statut --------------------------------------------------------------------------

/**
 * Statut de configuration. En démonstration, le statut « Connecté » n'est jamais atteint :
 * il ne pourra l'être qu'après un test réel exécuté par le backend.
 */
export function configStatus(c: Connector): ConfigStatus {
  const fields = [c.authType, c.secretRef, ...c.instances.flatMap((i) => [i.instanceUrl, i.apiUrl])];
  const filled = fields.filter((f) => !!f && String(f).trim()).length;
  if (filled === 0) return 'Non configuré';
  if (filled < fields.length) return 'Configuration incomplète';
  return 'Prêt à tester';
}

export const missingFields = (c: Connector): string[] => [
  ...(!c.authType ? ['Type d’authentification'] : []),
  ...(!c.secretRef.trim() ? ['Référence du secret (coffre serveur)'] : []),
  ...c.instances.flatMap((i) => [...(!i.instanceUrl.trim() ? [`URL de l’instance (${i.label})`] : []), ...(!i.apiUrl.trim() ? [`URL de l’API (${i.label})`] : [])]),
];

/** Éléments de « Préparation à la production » liés à chaque connecteur. */
const READINESS_BY_TOOL: Record<MappedTool, string> = { EasyVista: 'ITSM-01', Jira: 'ITSM-02', GLPI: 'ITSM-03', ISILOG: 'ITSM-04', Zendesk: 'ITSM-09', ServiceNow: 'ITSM-10' };
const READINESS_GENERAL: Record<string, string[]> = { qlikview: ['TEL-01', 'TEL-02'], genesys: ['TEL-05'] };

export function readinessLinksOf(c: Connector): string[] {
  if (c.scope === 'général') return READINESS_GENERAL[c.id] ?? [];
  const tool = toolOfConnector(c);
  return tool ? [READINESS_BY_TOOL[tool]] : ['ITSM-05'];
}
