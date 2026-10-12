// ADMINISTRATION → PRÉPARATION À LA PRODUCTION.
// Liste de contrôle dynamique : ce qui manque pour passer de la démonstration à la production.
// Règle : un élément n'est « Validé » qu'après une vérification réelle, documentée (preuve).
// Le taux de préparation est un indicateur d'avancement, PAS une certification de sécurité.

export type Domain = 'Infrastructure' | 'Sécurité' | 'ITSM' | 'Téléphonie & statistiques' | 'RH' | 'Finance' | 'Organisation';
export type ReadinessStatus = 'Non renseigné' | 'À configurer' | 'En cours' | 'À tester' | 'Validé' | 'Bloquant';
export type Priority = 'Critique' | 'Haute' | 'Moyenne';

export const DOMAINS: Domain[] = ['Infrastructure', 'Sécurité', 'ITSM', 'Téléphonie & statistiques', 'RH', 'Finance', 'Organisation'];
export const STATUSES: ReadinessStatus[] = ['Non renseigné', 'À configurer', 'En cours', 'À tester', 'Validé', 'Bloquant'];

export interface ReadinessItem {
  id: string;
  domain: Domain;
  title: string;
  /** Ce qui manque. */
  missing: string;
  /** Pourquoi c'est nécessaire. */
  why: string;
  /** Fonction responsable (pas une personne nommée). */
  owner: string;
  action: string;
  priority: Priority;
  dependencies: string[];
  status: ReadinessStatus;
  /** Date de dernière vérification (AAAA-MM-JJ) ou null. */
  lastCheck: string | null;
  /** Preuve de vérification, obligatoire pour « Validé ». */
  evidence?: string;
  /** Échéance (AAAA-MM-JJ) fixée par le responsable ; absente = « À renseigner » (jamais inventée). */
  dueDate?: string;
}

/** Fonctions responsables suivies par chaque profil simulé (« Mes actions »). */
export const ROLE_OWNERS: Record<string, string[]> = {
  admin: ['DSI', 'RSSI'],
  responsable: ['Responsable Helpdesk', 'Formation'],
  teamLeader: ['Responsable Helpdesk'],
  finance: ['DAF'],
  rh: ['DRH', 'DPO'],
  direction: ['Direction'],
  agent: [],
};

export function setDueDate(items: ReadinessItem[], id: string, due: string): { ok: boolean; message: string; items: ReadinessItem[] } {
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) return { ok: false, message: 'Date attendue au format AAAA-MM-JJ.', items };
  return { ok: true, message: `${id} : échéance ${due || 'retirée'}.`, items: items.map((i) => (i.id === id ? { ...i, dueDate: due || undefined } : i)) };
}

export const READINESS_ITEMS: ReadinessItem[] = [
  // Infrastructure
  { id: 'INF-01', domain: 'Infrastructure', title: 'Backend SEATPI ONE (API et base de données)', missing: 'Aucun backend : la démonstration fonctionne entièrement dans le navigateur.', why: 'Les secrets, les droits, la persistance et les connecteurs doivent être côté serveur.', owner: 'DSI', action: 'Choisir l’hébergement, déployer l’API et la base de données.', priority: 'Critique', dependencies: [], status: 'Bloquant', lastCheck: null },
  { id: 'INF-02', domain: 'Infrastructure', title: 'Environnements recette et production séparés', missing: 'Seul l’environnement de démonstration GitHub Pages existe.', why: 'Tester sans risque pour les données réelles.', owner: 'DSI', action: 'Créer les environnements et le circuit de déploiement.', priority: 'Haute', dependencies: ['INF-01'], status: 'Non renseigné', lastCheck: null },
  { id: 'INF-03', domain: 'Infrastructure', title: 'Sauvegardes et plan de reprise', missing: 'Aucune donnée persistée, donc aucune sauvegarde.', why: 'Congés, CRA et validations financières doivent être conservés et restaurables.', owner: 'DSI', action: 'Définir la politique de sauvegarde, tester une restauration.', priority: 'Haute', dependencies: ['INF-01'], status: 'Non renseigné', lastCheck: null },
  { id: 'INF-04', domain: 'Infrastructure', title: 'Supervision et journaux applicatifs', missing: 'Pas de collecte de journaux ni d’alerte technique.', why: 'Détecter les pannes de connecteurs et d’API.', owner: 'Exploitation', action: 'Raccorder l’API à l’outil de supervision existant.', priority: 'Moyenne', dependencies: ['INF-01'], status: 'À configurer', lastCheck: null },
  { id: 'INF-05', domain: 'Infrastructure', title: 'Nom de domaine et certificats', missing: 'Domaine de production non défini.', why: 'Accès sécurisé (HTTPS) et identifiable par les utilisateurs.', owner: 'DSI', action: 'Réserver le domaine, émettre les certificats.', priority: 'Moyenne', dependencies: ['INF-01'], status: 'Non renseigné', lastCheck: null },
  { id: 'INF-06', domain: 'Infrastructure', title: 'Publication de l’interface', missing: 'GitHub Pages publie la démonstration publique ; aucune publication interne.', why: 'Les données réelles ne doivent jamais être exposées sur une page publique.', owner: 'DSI', action: 'Publier la version production derrière l’authentification de l’entreprise.', priority: 'Haute', dependencies: ['INF-01', 'SEC-01'], status: 'En cours', lastCheck: null },
  // Sécurité
  { id: 'SEC-01', domain: 'Sécurité', title: 'Authentification unique (SSO)', missing: 'Rôle choisi librement dans une liste : aucune authentification.', why: 'Identifier chaque utilisateur et lui appliquer ses droits.', owner: 'RSSI', action: 'Raccorder l’annuaire de l’entreprise (SSO) au backend.', priority: 'Critique', dependencies: ['INF-01'], status: 'Bloquant', lastCheck: null },
  { id: 'SEC-02', domain: 'Sécurité', title: 'Contrôle des droits côté serveur', missing: 'La matrice des rôles est appliquée dans le navigateur (illustration uniquement).', why: 'Un contrôle côté navigateur n’est pas une mesure de sécurité.', owner: 'RSSI', action: 'Implémenter la matrice de droits dans l’API, avec tests.', priority: 'Critique', dependencies: ['SEC-01'], status: 'Bloquant', lastCheck: null },
  { id: 'SEC-03', domain: 'Sécurité', title: 'Coffre de secrets côté serveur', missing: 'Aucun coffre : aucun secret n’existe encore (et aucun ne doit être dans le frontend).', why: 'Les comptes de service ITSM et SIRH doivent rester côté serveur.', owner: 'RSSI', action: 'Mettre en place un coffre de secrets accessible au seul backend.', priority: 'Critique', dependencies: ['INF-01'], status: 'À configurer', lastCheck: null },
  { id: 'SEC-04', domain: 'Sécurité', title: 'Journal d’audit des actions', missing: 'Historiques locaux à la démonstration, perdus au rechargement.', why: 'Tracer validations, refus, changements de plafond et écritures ITSM.', owner: 'RSSI', action: 'Journaliser côté serveur, horodaté et non modifiable.', priority: 'Haute', dependencies: ['INF-01', 'SEC-01'], status: 'À configurer', lastCheck: null },
  { id: 'SEC-05', domain: 'Sécurité', title: 'Analyse RGPD des données RH et individuelles', missing: 'Aucune analyse d’impact réalisée.', why: 'Congés, CRA et indicateurs individuels sont des données personnelles.', owner: 'DPO', action: 'Conduire l’analyse d’impact, définir durées de conservation et accès.', priority: 'Critique', dependencies: [], status: 'Non renseigné', lastCheck: null },
  { id: 'SEC-06', domain: 'Sécurité', title: 'Test d’intrusion', missing: 'Non réalisé.', why: 'Vérifier la résistance de l’API et de l’authentification.', owner: 'RSSI', action: 'Commander un test d’intrusion avant ouverture.', priority: 'Haute', dependencies: ['SEC-02'], status: 'Non renseigné', lastCheck: null },
  { id: 'SEC-07', domain: 'Sécurité', title: 'Absence de secrets dans le dépôt et la page publique', missing: 'Contrôle à réaliser par l’équipe sécurité (un test automatisé du dépôt existe).', why: 'La page GitHub Pages est publique.', owner: 'RSSI', action: 'Activer l’analyse de secrets du dépôt et faire relire la configuration.', priority: 'Haute', dependencies: [], status: 'À tester', lastCheck: null },
  // ITSM
  { id: 'ITSM-01', domain: 'ITSM', title: 'EasyVista — INVIVO, DMB, TERACT', missing: 'Domaine propre à chaque client (instance), URL d’API, mode d’authentification et compte de service non fournis — un connecteur par client.', why: 'Lire les tickets réels de ces clients.', owner: 'Responsable Helpdesk', action: 'Obtenir les accès en lecture auprès des clients.', priority: 'Critique', dependencies: ['SEC-03'], status: 'Non renseigné', lastCheck: null },
  { id: 'ITSM-02', domain: 'ITSM', title: 'Jira — LBR FR, EURAPHARMA, ORTEC', missing: 'Domaine propre à chaque client (instance), URL d’API, mode d’authentification et compte de service non fournis — un connecteur par client.', why: 'Lire les tickets réels de ces clients.', owner: 'Responsable Helpdesk', action: 'Obtenir les accès en lecture.', priority: 'Critique', dependencies: ['SEC-03'], status: 'Non renseigné', lastCheck: null },
  { id: 'ITSM-03', domain: 'ITSM', title: 'GLPI — ANGE, HSTV, NOCIBE', missing: 'Domaine propre à chaque client (instance), URL d’API et jetons applicatifs non fournis — un connecteur par client.', why: 'Lire les tickets réels de ces clients.', owner: 'Responsable Helpdesk', action: 'Obtenir les accès en lecture.', priority: 'Critique', dependencies: ['SEC-03'], status: 'Non renseigné', lastCheck: null },
  { id: 'ITSM-04', domain: 'ITSM', title: 'ISILOG — THELEM, TRANSGOURMET, MONEXT', missing: 'Domaine propre à chaque client (instance), URL d’API et mode d’authentification non fournis — un connecteur par client.', why: 'Lire les tickets réels de ces clients.', owner: 'Responsable Helpdesk', action: 'Obtenir les accès en lecture.', priority: 'Critique', dependencies: ['SEC-03'], status: 'Non renseigné', lastCheck: null },
  { id: 'ITSM-09', domain: 'ITSM', title: 'Zendesk — SNR', missing: 'Domaine Zendesk propre à SNR, mode d’authentification (jeton API / OAuth) et compte de service non fournis ; statuts personnalisés à confirmer.', why: 'Lire les tickets réels de SNR (Pôle Multi).', owner: 'Responsable Helpdesk', action: 'Obtenir les accès en lecture et la liste des statuts utilisés.', priority: 'Critique', dependencies: ['SEC-03'], status: 'À configurer', lastCheck: null },
  { id: 'ITSM-05', domain: 'ITSM', title: 'ITSM utilisé par G2S', missing: 'Outil « à confirmer » : ITSM NON RENSEIGNÉ — CONFIGURATION REQUISE.', why: 'Sans outil identifié, aucun ticket ni SLA ne peut être mesuré pour G2S (Pôle Multi).', owner: 'Responsable Helpdesk', action: 'Identifier l’outil de G2S et le renseigner dans Administration → Clients (CRM).', priority: 'Haute', dependencies: [], status: 'À configurer', lastCheck: null },
  { id: 'ITSM-06', domain: 'ITSM', title: 'Correspondance des statuts et priorités', missing: 'Tables de correspondance établies sur des hypothèses de démonstration.', why: 'Des statuts mal traduits faussent SLA, backlog et Kanban.', owner: 'Responsable Helpdesk', action: 'Faire valider chaque table par le référent de l’outil.', priority: 'Haute', dependencies: ['ITSM-01', 'ITSM-02', 'ITSM-03', 'ITSM-04', 'ITSM-09', 'ITSM-10'], status: 'À tester', lastCheck: null },
  { id: 'ITSM-10', domain: 'ITSM', title: 'Accès aux API ServiceNow — PRIMAGAZ, SODIAAL, IRD', missing: 'Domaine propre à chaque client (PRIMAGAZ, SODIAAL, IRD), URL d’API, mode d’authentification et compte de service non fournis ; états « On Hold » à confirmer.', why: 'Lire les tickets N1 (Pôle Dédié) et N2 (PRIMAGAZ) de ces clients.', owner: 'Responsable Helpdesk', action: 'Obtenir les accès en lecture et renseigner Administration → Connexions & API.', priority: 'Critique', dependencies: ['SEC-03'], status: 'À configurer', lastCheck: null },
  { id: 'ITSM-11', domain: 'ITSM', title: 'Calendriers et règles SLA N2', missing: 'Matrices de délais (prise en charge, résolution) et calendriers contractuels de démonstration.', why: 'Les SLA de prise en charge et de résolution N2 dépendent des contrats et des calendriers réels.', owner: 'Responsable Helpdesk', action: 'Fournir, par client N2, les délais par priorité, calendriers, jours fériés, suspensions et objectifs.', priority: 'Haute', dependencies: [], status: 'À configurer', lastCheck: null },
  {
    id: 'ITSM-07',
    domain: 'ITSM',
    title: 'Cartographie client → outil ITSM',
    missing: 'Rien : la cartographie fournie est appliquée depuis une source unique.',
    why: 'Chaque ticket doit provenir du bon outil.',
    owner: 'Responsable Helpdesk',
    action: 'Maintenir le registre à jour lors de l’arrivée d’un client.',
    priority: 'Haute',
    dependencies: [],
    status: 'Validé',
    lastCheck: '2026-10-12',
    evidence: 'Test automatisé src/config/itsm.test.ts (correspondance exacte avec la cartographie fournie), exécuté à chaque publication.',
  },
  { id: 'ITSM-08', domain: 'ITSM', title: 'Droits d’écriture (transitions, affectations)', missing: 'Écritures simulées uniquement ; droits d’écriture non demandés.', why: 'Agir depuis SEATPI ONE suppose des droits explicites dans chaque outil.', owner: 'Responsable Helpdesk', action: 'Décider client par client : lecture seule ou écriture.', priority: 'Moyenne', dependencies: ['ITSM-06'], status: 'À configurer', lastCheck: null },
  // Téléphonie & statistiques
  { id: 'TEL-01', domain: 'Téléphonie & statistiques', title: 'Accès aux instances QlikView', missing: 'Serveur(s), documents et droits d’accès non fournis — un connecteur QlikView unique, commun à tous les clients.', why: 'Les statistiques SLA officielles sont produites dans QlikView.', owner: 'DSI', action: 'Identifier les instances et ouvrir un accès en lecture pour le backend.', priority: 'Critique', dependencies: ['INF-01', 'SEC-03'], status: 'À configurer', lastCheck: null },
  { id: 'TEL-02', domain: 'Téléphonie & statistiques', title: 'Méthode d’extraction des statistiques', missing: 'Export, API ou base intermédiaire non définis pour les feuilles « Qlik SLA décrocher » et « CC pilot SLA mensuel ».', why: 'Récupérer les volumes sources, et non des pourcentages déjà agrégés.', owner: 'DSI', action: 'Choisir la méthode d’extraction et sa fréquence.', priority: 'Haute', dependencies: ['TEL-01'], status: 'À configurer', lastCheck: null },
  { id: 'TEL-03', domain: 'Téléphonie & statistiques', title: 'Définition officielle du SLA décroché', missing: 'Délai de décroché, numérateur, dénominateur et exclusions (abandons courts, débordements) non confirmés.', why: 'Respecter exactement les règles de calcul du reporting QlikView.', owner: 'Responsable Helpdesk', action: 'Faire valider la définition et les règles d’agrégation.', priority: 'Critique', dependencies: [], status: 'À configurer', lastCheck: null },
  { id: 'TEL-04', domain: 'Téléphonie & statistiques', title: 'Objectifs SLA par client', missing: 'Objectifs contractuels de SLA décroché (et SLA N2) non renseignés.', why: 'Sans objectif, aucun écart ni alerte n’est calculé (aucun seuil inventé).', owner: 'Responsable Helpdesk', action: 'Saisir les objectifs contractuels dans Administration → Paramètres SLA.', priority: 'Haute', dependencies: [], status: 'À configurer', lastCheck: null },
  { id: 'TEL-05', domain: 'Téléphonie & statistiques', title: 'Accès API Genesys Cloud', missing: 'Organisation, région, client OAuth et périmètres non fournis.', why: 'États des agents et files en temps réel (aujourd’hui simulés).', owner: 'DSI', action: 'Créer un client OAuth côté serveur avec des droits minimaux.', priority: 'Moyenne', dependencies: ['SEC-03'], status: 'À configurer', lastCheck: null },
  // RH
  { id: 'RH-01', domain: 'RH', title: 'Source des effectifs et organigramme', missing: 'Collaborateurs et managers fictifs (pseudonymes).', why: 'Les périmètres de validation dépendent de l’organigramme réel.', owner: 'DRH', action: 'Raccorder le SIRH au backend (lecture).', priority: 'Critique', dependencies: ['INF-01', 'SEC-05'], status: 'Non renseigné', lastCheck: null },
  { id: 'RH-02', domain: 'RH', title: 'Source des demandes de congés (outil RH)', missing: 'Demandes de congés fictives ; SEATPI ONE n’en fait que le suivi (checklist).', why: 'La checklist doit refléter les demandes réelles ; aucune validation ni solde dans SEATPI ONE.', owner: 'DRH', action: 'Ouvrir un accès en lecture au statut des demandes dans l’outil RH.', priority: 'Haute', dependencies: [], status: 'À configurer', lastCheck: null },
  { id: 'RH-03', domain: 'RH', title: 'Source des CRA (outil CRA)', missing: 'États des CRA fictifs ; SEATPI ONE n’en fait que le suivi (checklist), sans saisie d’heures ni validation.', why: 'Une coche dans SEATPI ONE n’est pas une validation officielle tant qu’aucune intégration n’existe.', owner: 'Responsable Helpdesk', action: 'Ouvrir un accès en lecture au statut des CRA (attendus, reçus, validés).', priority: 'Haute', dependencies: ['RH-01'], status: 'À tester', lastCheck: null },
  { id: 'RH-04', domain: 'RH', title: 'Calendriers de travail et jours fériés', missing: 'Calendrier unique de démonstration.', why: 'Heures attendues et SLA dépendent des calendriers réels.', owner: 'DRH', action: 'Fournir les calendriers par site et par contrat.', priority: 'Moyenne', dependencies: [], status: 'À configurer', lastCheck: null },
  { id: 'RH-05', domain: 'RH', title: 'Information des représentants du personnel', missing: 'Non réalisée.', why: 'Outil de suivi d’activité : information préalable requise ; aucun classement disciplinaire automatique.', owner: 'DRH', action: 'Présenter l’outil et ses indicateurs.', priority: 'Critique', dependencies: ['SEC-05'], status: 'Non renseigné', lastCheck: null },
  // Finance
  { id: 'FIN-01', domain: 'Finance', title: 'Coûts employeur réels', missing: 'Barème fictif par population.', why: 'Le résultat analytique repose sur le coût employeur chargé (pas le salaire net).', owner: 'DAF', action: 'Fournir un export mensuel des coûts chargés par collaborateur.', priority: 'Critique', dependencies: ['RH-01', 'SEC-05'], status: 'Non renseigné', lastCheck: null },
  { id: 'FIN-02', domain: 'Finance', title: 'Registre des contrats et prestations', missing: 'Montants et modes de facturation fictifs ; références de contrats internes à renseigner.', why: 'Seules les prestations validées constituent des revenus.', owner: 'DAF', action: 'Charger les contrats, tarifs et la facturation mensuelle.', priority: 'Critique', dependencies: ['INF-01'], status: 'Non renseigné', lastCheck: null },
  { id: 'FIN-03', domain: 'Finance', title: 'Règle d’imputation du recrutement', missing: 'RÈGLE D’IMPUTATION À CONFIRMER.', why: 'Décider si les frais de recrutement entrent dans le résultat du Helpdesk.', owner: 'Direction', action: 'Arbitrer la règle et la paramétrer.', priority: 'Haute', dependencies: [], status: 'À configurer', lastCheck: null },
  { id: 'FIN-04', domain: 'Finance', title: 'Enveloppe déplacements et habilitations', missing: 'Plafond fictif ; personne habilitée simulée par le rôle Direction.', why: 'Le plafond ne doit jamais être dépassé et sa modification doit être tracée.', owner: 'Direction', action: 'Fixer l’enveloppe annuelle et désigner les personnes habilitées.', priority: 'Haute', dependencies: ['SEC-01'], status: 'À configurer', lastCheck: null },
  { id: 'FIN-05', domain: 'Finance', title: 'Rapprochement avec la comptabilité', missing: 'Non réalisé.', why: 'Vérifier la cohérence du résultat analytique avec la comptabilité générale.', owner: 'DAF', action: 'Définir le rapprochement mensuel.', priority: 'Moyenne', dependencies: ['FIN-01', 'FIN-02'], status: 'Non renseigné', lastCheck: null },
  // Organisation
  { id: 'ORG-01', domain: 'Organisation', title: 'Implantation des départements par site', missing: 'Configuration de démonstration (RH et Stock à La Ciotat uniquement).', why: 'La carte des sites doit refléter l’organisation réelle.', owner: 'Direction', action: 'Valider l’implantation des départements par site.', priority: 'Moyenne', dependencies: [], status: 'À tester', lastCheck: null },
  { id: 'ORG-02', domain: 'Organisation', title: 'Affectation des pôles et clients aux sites', missing: 'Pôle Multi (11 clients) à La Ciotat et Montpellier ; répartition des agents entre les deux sites et absence de pôle client à Paris à confirmer.', why: 'Les managers de site valident les demandes de leur périmètre.', owner: 'Responsable Helpdesk', action: 'Confirmer la répartition.', priority: 'Moyenne', dependencies: [], status: 'À tester', lastCheck: null },
  { id: 'ORG-03', domain: 'Organisation', title: 'Référents par domaine', missing: 'Fonctions identifiées, personnes non désignées.', why: 'Chaque élément de cette liste doit avoir un responsable.', owner: 'Direction', action: 'Désigner un référent par domaine.', priority: 'Haute', dependencies: [], status: 'En cours', lastCheck: null },
  { id: 'ORG-04', domain: 'Organisation', title: 'Recette utilisateurs', missing: 'Non planifiée.', why: 'Valider les parcours avec managers, finance et direction.', owner: 'Responsable Helpdesk', action: 'Planifier la recette sur l’environnement de recette.', priority: 'Haute', dependencies: ['INF-02'], status: 'Non renseigné', lastCheck: null },
  { id: 'ORG-05', domain: 'Organisation', title: 'Formation des utilisateurs', missing: 'Non planifiée.', why: 'Adoption et bon usage des indicateurs.', owner: 'Formation', action: 'Préparer des sessions par profil.', priority: 'Moyenne', dependencies: ['ORG-04'], status: 'Non renseigné', lastCheck: null },
];

export interface Summary {
  total: number;
  validated: number;
  blocking: number;
  inProgress: number;
  byStatus: Record<ReadinessStatus, number>;
  /** Éléments validés ÷ total, en % — indicateur d'avancement, pas une certification. */
  rate: number;
  criticalMissing: ReadinessItem[];
  go: boolean;
  goReasons: string[];
}

export function summarize(items: ReadinessItem[]): Summary {
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, items.filter((i) => i.status === s).length])) as Record<ReadinessStatus, number>;
  const criticalMissing = items.filter((i) => i.priority === 'Critique' && i.status !== 'Validé');
  const blocking = byStatus['Bloquant'];
  const goReasons = [
    ...(blocking ? [`${blocking} élément(s) bloquant(s)`] : []),
    ...(criticalMissing.length ? [`${criticalMissing.length} élément(s) critique(s) non validé(s)`] : []),
  ];
  return {
    total: items.length,
    validated: byStatus['Validé'],
    blocking,
    inProgress: byStatus['En cours'] + byStatus['À tester'],
    byStatus,
    rate: items.length ? Math.round((byStatus['Validé'] / items.length) * 1000) / 10 : 0,
    criticalMissing,
    go: goReasons.length === 0,
    goReasons,
  };
}

/** Passage à « Validé » : uniquement avec une preuve de vérification. */
export function setStatus(items: ReadinessItem[], id: string, status: ReadinessStatus, today: string, evidence = ''): { ok: boolean; message: string; items: ReadinessItem[] } {
  const item = items.find((i) => i.id === id);
  if (!item) return { ok: false, message: 'Élément introuvable.', items };
  if (status === 'Validé' && !evidence.trim()) return { ok: false, message: 'Un élément ne peut être marqué Validé qu’après vérification réelle : décrivez la preuve.', items };
  const unmet = status === 'Validé' ? item.dependencies.filter((d) => items.find((i) => i.id === d)?.status !== 'Validé') : [];
  if (unmet.length) return { ok: false, message: `Dépendances non validées : ${unmet.join(', ')}.`, items };
  return {
    ok: true,
    message: `${id} : ${item.status} → ${status}.`,
    items: items.map((i) => (i.id === id ? { ...i, status, lastCheck: today, evidence: status === 'Validé' ? evidence.trim() : i.evidence } : i)),
  };
}

export function reportMarkdown(items: ReadinessItem[], generatedAt: string): string {
  const s = summarize(items);
  const lines: string[] = [
    '# SEATPI ONE — Rapport de préparation à la production',
    '',
    `Généré le ${generatedAt} depuis ADMINISTRATION → PRÉPARATION À LA PRODUCTION.`,
    '',
    '> L’application est en **mode démonstration** : toutes les données sont fictives et aucune connexion réelle n’est établie.',
    '> Le taux de préparation mesure l’avancement de cette liste ; ce n’est **pas** une certification de sécurité.',
    '',
    `## Décision : ${s.go ? 'GO' : 'NO-GO'}`,
    '',
    s.go ? 'Aucun élément bloquant et tous les éléments critiques sont validés.' : `Motifs : ${s.goReasons.join(' ; ')}.`,
    '',
    '## Synthèse',
    '',
    '| Indicateur | Valeur |',
    '|---|---|',
    `| Éléments | ${s.total} |`,
    `| Validés | ${s.validated} |`,
    `| Bloquants | ${s.blocking} |`,
    `| En cours / à tester | ${s.inProgress} |`,
    `| Taux de préparation (avancement, pas une certification) | ${s.rate.toLocaleString('fr-FR')} % |`,
    '',
    '## Éléments critiques manquants',
    '',
    ...(s.criticalMissing.length ? s.criticalMissing.map((i) => `- **${i.id} — ${i.title}** (${i.status}) : ${i.missing} → ${i.action} (${i.owner})`) : ['- Aucun.']),
    '',
  ];
  for (const d of DOMAINS) {
    lines.push(`## ${d}`, '', '| Réf. | Élément | Statut | Priorité | Ce qui manque | Pourquoi | Responsable | Action | Dépendances | Dernière vérification |', '|---|---|---|---|---|---|---|---|---|---|');
    for (const i of items.filter((x) => x.domain === d)) {
      const cell = (t: string) => t.replace(/\|/g, '\\|');
      lines.push(`| ${i.id} | ${cell(i.title)} | ${i.status} | ${i.priority} | ${cell(i.missing)} | ${cell(i.why)} | ${i.owner} | ${cell(i.action)} | ${i.dependencies.join(', ') || '—'} | ${i.lastCheck ?? '—'}${i.evidence ? ` (preuve : ${cell(i.evidence)})` : ''} |`);
    }
    lines.push('');
  }
  return lines.join('\n');
}
