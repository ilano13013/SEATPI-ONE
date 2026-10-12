// Données 100 % fictives. Aucun nom, matricule ou identifiant réel de salarié.
import type { Agent, AgentStatus, DemoState, Queue } from '../types';

const clients = [
  { id: 'hstv', name: 'HSTV' },
  { id: 'invivo', name: 'INVIVO' },
  { id: 'ange', name: 'ANGE' },
  { id: 'dmb', name: 'DMB' },
  { id: 'orbis', name: 'ORBIS' },
];

const queues: Queue[] = [
  { id: 'q-hstv-n1', clientId: 'hstv', name: 'Support N1', waiting: 3, longestWaitSec: 142, handledToday: 186, abandonedToday: 7, sla: 92, slaTarget: 95 },
  { id: 'q-hstv-fact', clientId: 'hstv', name: 'Facturation', waiting: 1, longestWaitSec: 48, handledToday: 64, abandonedToday: 2, sla: 95, slaTarget: 95 },
  { id: 'q-invivo-n1', clientId: 'invivo', name: 'Support N1', waiting: 1, longestWaitSec: 35, handledToday: 121, abandonedToday: 3, sla: 96, slaTarget: 95 },
  { id: 'q-ange-n1', clientId: 'ange', name: 'Assistance', waiting: 0, longestWaitSec: 0, handledToday: 77, abandonedToday: 1, sla: 98, slaTarget: 90 },
  { id: 'q-dmb-n1', clientId: 'dmb', name: 'Support N1', waiting: 2, longestWaitSec: 210, handledToday: 98, abandonedToday: 6, sla: 89, slaTarget: 92 },
  { id: 'q-dmb-n2', clientId: 'dmb', name: 'Support N2', waiting: 0, longestWaitSec: 0, handledToday: 23, abandonedToday: 0, sla: 97, slaTarget: 90 },
  { id: 'q-orbis-n1', clientId: 'orbis', name: 'Hotline', waiting: 1, longestWaitSec: 67, handledToday: 54, abandonedToday: 2, sla: 94, slaTarget: 95 },
];

const agentSeed: [string, string, AgentStatus, number][] = [
  ['Agent A01', 'hstv', 'En appel', 372],
  ['Agent A02', 'hstv', 'Disponible', 64],
  ['Agent A03', 'hstv', 'Post-appel', 41],
  ['Agent A04', 'hstv', 'Repas', 1450],
  ['Agent B01', 'invivo', 'En appel', 188],
  ['Agent B02', 'invivo', 'Pause', 522],
  ['Agent B03', 'invivo', 'Disponible', 12],
  ['Agent C01', 'ange', 'En appel', 95],
  ['Agent C02', 'ange', 'Formation', 2400],
  ['Agent D01', 'dmb', 'En appel', 610],
  ['Agent D02', 'dmb', 'En appel', 233],
  ['Agent D03', 'dmb', 'Pause', 300],
  ['Agent D04', 'dmb', 'Disponible', 150],
  ['Agent E01', 'orbis', 'En appel', 77],
  ['Agent E02', 'orbis', 'Hors ligne', 0],
  ['Agent E03', 'orbis', 'Disponible', 230],
];

const agents: Agent[] = agentSeed.map(([name, clientId, status, statusSinceSec], desk) => ({
  id: `ag-${String(desk + 1).padStart(2, '0')}`,
  name,
  clientId,
  status,
  statusSinceSec,
  desk,
}));

export function createInitialState(now = Date.now()): DemoState {
  // Copies profondes : la simulation ne doit jamais muter le jeu de référence.
  return structuredClone({
    updatedAt: now,
    tick: 0,
    clients,
    queues,
    agents,
    tickets: [
      { id: 'TCK-1042', clientId: 'hstv', title: 'Box TV sans signal après mise à jour', priority: 'P2', status: 'En cours', ageMin: 38, assigneeId: 'ag-01' },
      { id: 'TCK-1043', clientId: 'hstv', title: 'Contestation de facture', priority: 'P3', status: 'Nouveau', ageMin: 12, assigneeId: null },
      { id: 'TCK-1044', clientId: 'invivo', title: 'Accès portail adhérent impossible', priority: 'P2', status: 'En attente', ageMin: 95, assigneeId: 'ag-05' },
      { id: 'TCK-1045', clientId: 'ange', title: 'Demande de rappel planifié', priority: 'P4', status: 'Nouveau', ageMin: 5, assigneeId: null },
      { id: 'TCK-1046', clientId: 'dmb', title: 'Incident messagerie multi-sites', priority: 'P1', status: 'En cours', ageMin: 22, assigneeId: 'ag-10' },
      { id: 'TCK-1047', clientId: 'dmb', title: 'Réinitialisation mot de passe', priority: 'P4', status: 'Résolu', ageMin: 61, assigneeId: 'ag-11' },
      { id: 'TCK-1048', clientId: 'orbis', title: 'Erreur de synchronisation agenda', priority: 'P3', status: 'En cours', ageMin: 44, assigneeId: 'ag-14' },
      { id: 'TCK-1049', clientId: 'invivo', title: 'Mise à jour coordonnées bancaires', priority: 'P3', status: 'Nouveau', ageMin: 3, assigneeId: null },
    ],
    inventory: [
      { id: 'inv-casque', label: 'Casque binaural USB', category: 'Casques', inStock: 14, assigned: 46, alertThreshold: 10 },
      { id: 'inv-casque-bt', label: 'Casque sans fil', category: 'Casques', inStock: 3, assigned: 12, alertThreshold: 5 },
      { id: 'inv-portable', label: 'PC portable 14"', category: 'Postes', inStock: 6, assigned: 38, alertThreshold: 4 },
      { id: 'inv-fixe', label: 'Poste fixe', category: 'Postes', inStock: 2, assigned: 20, alertThreshold: 3 },
      { id: 'inv-ecran', label: 'Écran 24"', category: 'Écrans', inStock: 11, assigned: 70, alertThreshold: 6 },
      { id: 'inv-dock', label: "Station d'accueil", category: 'Accessoires', inStock: 8, assigned: 30, alertThreshold: 5 },
    ],
    vehicles: [
      { id: 'veh-1', label: 'Citadine électrique', plate: 'AA-001-AA', status: 'Disponible', nextBooking: 'Demain 09:00', km: 18420 },
      { id: 'veh-2', label: 'Berline', plate: 'AA-002-AA', status: 'Réservé', nextBooking: "Aujourd'hui 14:00", km: 52310 },
      { id: 'veh-3', label: 'Utilitaire', plate: 'AA-003-AA', status: 'Entretien', nextBooking: null, km: 87005 },
      { id: 'veh-4', label: 'Citadine', plate: 'AA-004-AA', status: 'Disponible', nextBooking: null, km: 30120 },
    ],
    budgets: [
      { id: 'b-it', costCenter: 'Informatique', allocated: 120000, spent: 81500 },
      { id: 'b-rh', costCenter: 'Formation', allocated: 45000, spent: 19800 },
      { id: 'b-mg', costCenter: 'Moyens généraux', allocated: 60000, spent: 57200 },
      { id: 'b-flotte', costCenter: 'Flotte automobile', allocated: 38000, spent: 21400 },
    ],
    hr: { pendingLeaves: 7, upcomingTrainings: 3, certificationsToRenew: 2, plannedHeadcount: 16 },
    reception: [
      { id: 'rc-1', time: '09:30', label: 'Visite fournisseur (fictif)', kind: 'Visite' },
      { id: 'rc-2', time: '11:00', label: 'Livraison matériel IT', kind: 'Livraison' },
      { id: 'rc-3', time: '14:00', label: 'Comité de pilotage — salle Atlas', kind: 'Réunion' },
      { id: 'rc-4', time: '16:30', label: 'Réunion qualité — salle Hermès', kind: 'Réunion' },
    ],
  } satisfies DemoState);
}
