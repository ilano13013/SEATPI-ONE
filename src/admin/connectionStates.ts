import { createContext, useContext } from 'react';
// Deux états distincts, jamais confondus :
//  - « Connexion réelle » : configuration d'un connecteur vers l'outil du client. En
//    démonstration, aucune connexion réelle n'est jamais établie (pas de backend sécurisé) ;
//  - « Simulation » : flux de tickets fictifs générés dans le navigateur.
import type { ConnectionStatus } from '../external/sync';
import type { ConfigStatus } from './connections';

export type SimulationState = 'active' | 'suspendue' | 'en erreur' | 'non disponible';

export function simulationState(status: ConnectionStatus | undefined, running: boolean): SimulationState {
  if (!status || status === 'non configuré') return 'non disponible';
  if (status === 'erreur') return 'en erreur';
  if (!running) return 'suspendue';
  return 'active';
}

export const simulationLabel = (s: SimulationState, status?: ConnectionStatus) => `Simulation : ${s}${s === 'active' && status === 'dégradé' ? ' (dégradée)' : ''}`;

/** Libellé de la connexion réelle ; jamais « connectée » en démonstration. */
export function realConnectionLabel(config?: ConfigStatus): string {
  if (!config || config === 'Non configuré') return 'Connexion réelle : non configurée';
  if (config === 'Configuration incomplète') return 'Connexion réelle : configuration incomplète';
  if (config === 'Prêt à tester') return 'Connexion réelle : prête à tester — test réel indisponible en démonstration';
  return `Connexion réelle : ${config.toLowerCase()}`;
}

export const SIMULATED_SYNC_PREFIX = 'Simulation';

/** Contexte partagé : état de la simulation et configuration réelle par client. */
export interface ConnectionInfo {
  running: boolean;
  realOf: (clientId: string) => ConfigStatus | undefined;
}

export const ConnectionContext = createContext<ConnectionInfo>({ running: true, realOf: () => undefined });
export const useConnectionInfo = () => useContext(ConnectionContext);
