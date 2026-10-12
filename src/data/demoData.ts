// Données 100 % fictives. Aucun nom, matricule ou identifiant réel de salarié.
import type { Agent, AgentStatus, DemoState, Queue } from '../types';

// Chaque client correspond à un pôle du plateau Helpdesk.
const clients = [
  { id: 'thelem', name: 'Thelem' },
  { id: 'ird', name: 'IRD' },
  { id: 'ortec', name: 'Ortec' },
  { id: 'multi', name: 'Multi dédié' },
  { id: 'sodiaal', name: 'Sodiaal' },
];

const queues: Queue[] = [
  { id: 'q-thelem-sin', clientId: 'thelem', name: 'Sinistres', waiting: 3, longestWaitSec: 142, handledToday: 186, abandonedToday: 7, sla: 92, slaTarget: 95 },
  { id: 'q-thelem-ass', clientId: 'thelem', name: 'Assistance', waiting: 1, longestWaitSec: 48, handledToday: 64, abandonedToday: 2, sla: 95, slaTarget: 95 },
  { id: 'q-ird-n1', clientId: 'ird', name: 'Support N1', waiting: 1, longestWaitSec: 35, handledToday: 121, abandonedToday: 3, sla: 96, slaTarget: 95 },
  { id: 'q-ortec-n1', clientId: 'ortec', name: 'Support N1', waiting: 2, longestWaitSec: 210, handledToday: 98, abandonedToday: 6, sla: 89, slaTarget: 92 },
  { id: 'q-ortec-n2', clientId: 'ortec', name: 'Support N2', waiting: 0, longestWaitSec: 0, handledToday: 23, abandonedToday: 0, sla: 97, slaTarget: 90 },
  { id: 'q-multi-hl', clientId: 'multi', name: 'Hotline multi-clients', waiting: 1, longestWaitSec: 67, handledToday: 54, abandonedToday: 2, sla: 94, slaTarget: 95 },
  { id: 'q-sodiaal-n1', clientId: 'sodiaal', name: 'Support utilisateurs', waiting: 0, longestWaitSec: 0, handledToday: 77, abandonedToday: 1, sla: 98, slaTarget: 90 },
];

const agentSeed: [string, string, AgentStatus, number][] = [
  ['Agent A01', 'thelem', 'En appel', 372],
  ['Agent A02', 'thelem', 'Disponible', 64],
  ['Agent A03', 'thelem', 'Post-appel', 41],
  ['Agent A04', 'thelem', 'Repas', 1450],
  ['Agent B01', 'ird', 'En appel', 188],
  ['Agent B02', 'ird', 'Pause', 522],
  ['Agent B03', 'ird', 'Disponible', 12],
  ['Agent C01', 'ortec', 'En appel', 95],
  ['Agent C02', 'ortec', 'Formation', 2400],
  ['Agent C03', 'ortec', 'En appel', 233],
  ['Agent C04', 'ortec', 'Disponible', 150],
  ['Agent D01', 'multi', 'En appel', 610],
  ['Agent D02', 'multi', 'Pause', 300],
  ['Agent D03', 'multi', 'Disponible', 45],
  ['Agent D04', 'multi', 'En appel', 410],
  ['Agent D05', 'multi', 'Hors ligne', 0],
  ['Agent E01', 'sodiaal', 'En appel', 77],
  ['Agent E02', 'sodiaal', 'Disponible', 230],
  ['Agent E03', 'sodiaal', 'Post-appel', 20],
  ['Agent E04', 'sodiaal', 'En appel', 140],
];

const desksUsed = new Map<string, number>();
const agents: Agent[] = agentSeed.map(([name, clientId, status, statusSinceSec], i) => {
  // Poste attribué dans l'ordre au sein du pôle.
  const desk = desksUsed.get(clientId) ?? 0;
  desksUsed.set(clientId, desk + 1);
  return { id: `ag-${String(i + 1).padStart(2, '0')}`, name, clientId, status, statusSinceSec, desk };
});

export function createInitialState(now = Date.now()): DemoState {
  // Copies profondes : la simulation ne doit jamais muter le jeu de référence.
  return structuredClone({
    updatedAt: now,
    tick: 0,
    clients,
    queues,
    agents,
    tickets: [
      { id: 'TCK-1042', clientId: 'thelem', title: 'Poste bloqué après mise à jour', priority: 'P2', status: 'En cours', ageMin: 38, assigneeId: 'ag-01' },
      { id: 'TCK-1043', clientId: 'thelem', title: 'Déclaration de sinistre incomplète', priority: 'P3', status: 'Nouveau', ageMin: 12, assigneeId: null },
      { id: 'TCK-1044', clientId: 'ird', title: 'Accès portail impossible', priority: 'P2', status: 'En attente', ageMin: 95, assigneeId: 'ag-05' },
      { id: 'TCK-1045', clientId: 'sodiaal', title: 'Demande de rappel planifié', priority: 'P4', status: 'Nouveau', ageMin: 5, assigneeId: null },
      { id: 'TCK-1046', clientId: 'ortec', title: 'Incident messagerie multi-sites', priority: 'P1', status: 'En cours', ageMin: 22, assigneeId: 'ag-08' },
      { id: 'TCK-1047', clientId: 'ortec', title: 'Réinitialisation mot de passe', priority: 'P4', status: 'Résolu', ageMin: 61, assigneeId: 'ag-10' },
      { id: 'TCK-1048', clientId: 'multi', title: 'Erreur de synchronisation agenda', priority: 'P3', status: 'En cours', ageMin: 44, assigneeId: 'ag-12' },
      { id: 'TCK-1049', clientId: 'ird', title: 'Mise à jour coordonnées bancaires', priority: 'P3', status: 'Nouveau', ageMin: 3, assigneeId: null },
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
    hr: { pendingLeaves: 7, upcomingTrainings: 3, certificationsToRenew: 2, plannedHeadcount: 20 },
    reception: [
      { id: 'rc-1', time: '09:30', label: 'Visite fournisseur (fictif)', kind: 'Visite' },
      { id: 'rc-2', time: '11:00', label: 'Livraison matériel IT', kind: 'Livraison' },
      { id: 'rc-3', time: '14:00', label: 'Comité de pilotage — salle Atlas', kind: 'Réunion' },
      { id: 'rc-4', time: '16:30', label: 'Réunion qualité — salle Hermès', kind: 'Réunion' },
    ],
  } satisfies DemoState);
}
