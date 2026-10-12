// Séparation des sources de données : démonstration / production.
//
// Règles :
// - l'application démarre TOUJOURS sur le fournisseur de démonstration ;
// - le fournisseur de production n'est utilisable que lorsque TOUS ses prérequis sont validés
//   (backend, authentification, connecteurs) ; il n'est jamais activé silencieusement ;
// - aucun secret (jeton, mot de passe, URL d'API privée) n'est lu ni stocké dans le frontend :
//   en production, le navigateur ne parle qu'au backend SEATPI ONE, qui détient les secrets.

export type DataMode = 'demo' | 'production';

export interface DataProvider {
  mode: DataMode;
  label: string;
  /** Données fictives générées localement, sans appel réseau. */
  fictitious: boolean;
  /** Prérequis manquants (vide = prêt). */
  missing: string[];
}

export const DemoDataProvider: DataProvider = {
  mode: 'demo',
  label: 'Données de démonstration (fictives, générées dans le navigateur)',
  fictitious: true,
  missing: [],
};

/** Prérequis du fournisseur de production (voir PRODUCTION_READINESS.md). */
export const PRODUCTION_PREREQUISITES = [
  'Backend SEATPI ONE déployé (API, base de données)',
  'Authentification unique et contrôle des droits côté serveur',
  'Connecteurs ITSM configurés côté serveur (secrets hors frontend)',
  'Sources RH et financières raccordées et validées',
] as const;

export interface ProductionConfig {
  /** Adresse publique du backend (jamais une URL d'outil ITSM ni un secret). */
  backendUrl: string | null;
  /** Prérequis vérifiés et validés (liste explicite). */
  validated: string[];
}

export function productionProvider(cfg: ProductionConfig): DataProvider {
  const missing: string[] = PRODUCTION_PREREQUISITES.filter((p) => !cfg.validated.includes(p));
  if (!cfg.backendUrl) missing.unshift('Adresse du backend non renseignée');
  return { mode: 'production', label: 'Données de production (via le backend SEATPI ONE)', fictitious: false, missing };
}

export interface Resolution {
  provider: DataProvider;
  /** Message affiché si la production a été demandée mais n'est pas disponible. */
  warning: string | null;
}

/**
 * Choix du fournisseur. La production n'est retenue que si elle est demandée explicitement
 * ET que tous ses prérequis sont validés ; sinon la démonstration reste active, avec un
 * avertissement visible — jamais de bascule silencieuse.
 */
export function resolveProvider(requested: DataMode, cfg: ProductionConfig): Resolution {
  if (requested !== 'production') return { provider: DemoDataProvider, warning: null };
  const prod = productionProvider(cfg);
  if (prod.missing.length) return { provider: DemoDataProvider, warning: `Mode production demandé mais indisponible : ${prod.missing.join(' ; ')}. Les données affichées restent FICTIVES.` };
  return { provider: prod, warning: null };
}

/** Configuration publiée sur GitHub Pages : démonstration uniquement, aucun backend. */
export const PAGES_CONFIG: ProductionConfig = { backendUrl: null, validated: [] };

/** Mode demandé à la compilation (`VITE_DATA_MODE`), démonstration par défaut. */
export const REQUESTED_MODE: DataMode = (import.meta.env.VITE_DATA_MODE as DataMode | undefined) === 'production' ? 'production' : 'demo';

export const activeData = resolveProvider(REQUESTED_MODE, PAGES_CONFIG);
