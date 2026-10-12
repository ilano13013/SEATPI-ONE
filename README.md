# SEATPI ONE — V3.0 (mode démonstration)

Prototype local avec données **100 % fictives**. Ne pas déployer avec des données réelles ni connecter les API internes sans validation de l'entreprise.

## Démarrer

Prérequis : Node.js 20+ et npm.

```bash
npm install
npm run dev      # serveur de développement Vite
npm test         # tests unitaires et d'interface (Vitest + Testing Library)
npm run build    # vérification TypeScript + build de production
npm run preview  # sert le build de production
```

Ouvrir l'URL indiquée par Vite.

## Version en ligne (GitHub Pages)

Le workflow `.github/workflows/deploy-pages.yml` lance les tests, construit le site et le publie sur
**https://ilano13013.github.io/SEATPI-ONE/** à chaque push sur la branche principale (ou manuellement via
l'onglet *Actions* → *Publication GitHub Pages* → *Run workflow*).

Activation (une seule fois) : *Settings* → *Pages* → *Build and deployment* → *Source* : **GitHub Actions**.

⚠️ Le dépôt et le site sont publics : n'y mettre que des données fictives.

## V3.0 — ce qui est disponible

Toutes les données sont **fictives** et générées dans le navigateur ; aucune action n'est envoyée à un système réel. Détails : [`docs/RAPPORT_V3.md`](docs/RAPPORT_V3.md) (corrections, limites de la démonstration, reprise) et [`PRODUCTION_READINESS.md`](PRODUCTION_READINESS.md).

- **Trois sites internes en 3D** — La Ciotat (site principal), Montpellier, Paris — avec les mêmes services, sauf RH et Stock (La Ciotat uniquement). Carte des sites, étages par site, sites clients externes. Les managers sont visibles et cliquables (ouverture de leur cockpit).
- **Deux pôles distincts sur le plateau Helpdesk** : **Pôle Multi** (La Ciotat et Montpellier) — ANGE, HSTV, LBR FR, TRANSGOURMET, INVIVO, SNR, DMB, NOCIBE, TERACT, G2S, EURAPHARMA ; **Pôle Dédié** (une équipe par client, La Ciotat) — PRIMAGAZ, SODIAAL, IRD, THELEM, ORTEC. Aucun pôle client à Paris. Le pôle n'est jamais déduit de l'outil ITSM. INVIVO et PRIMAGAZ sont traités en N1 sur le plateau et en N2 chez le client ; MONEXT en N2 uniquement.
- **Cartographie ITSM unique** (`src/config/itsm.ts`) : EasyVista → INVIVO, DMB, TERACT ; Jira → LBR FR, EURAPHARMA, ORTEC ; GLPI → ANGE, HSTV, NOCIBE ; ISILOG → THELEM, TRANSGOURMET, MONEXT ; Zendesk → SNR ; ServiceNow → PRIMAGAZ, SODIAAL, IRD. G2S : à confirmer (« ITSM NON RENSEIGNÉ »).
- **Cockpit Helpdesk consolidé** : équipes internes N1 + INVIVO, PRIMAGAZ, MONEXT ; effectifs (prévus, présents, disponibles, en communication), tickets (ouverts, en cours, en attente, bloqués, résolus, réouverts, backlog, hors SLA, proches SLA, sans affectation, critiques), objectifs / réalisé / reste, évolution hebdomadaire ; tous les compteurs sont cliquables ; filtres client, équipe, manager, technicien, priorité, statut, période, outil ITSM ; vues Tableau et Kanban sur le même jeu filtré (Kanban : travail actif par défaut, archives à la demande) ; recherche par numéro ou titre, filtres actifs affichés et « Réinitialiser les filtres », plein écran, colonnes personnalisables. Pas de création de ticket dans ce cockpit de pilotage.
- **Management** (« Agir en tant que » un manager) : **checklists de suivi** CRA (attendus, reçus, manquants, à valider) et congés (demandes en attente, dates, manager, statut de suivi), avec un contrôle de suivi unique « À traiter / Relancé / Traité » et historique — un suivi interne qui ne modifie ni l'état RH officiel ni les effectifs prévus ; liens vers les outils CRA / RH seulement si leur adresse est renseignée dans l'administration ; effectifs prévisionnels, collaborateurs, objectifs volume / qualité. Accessibles aussi depuis le bureau 3D du manager et le cockpit Helpdesk.
- **Cockpits MCO N2 et Exploitation**, sans fusion de leurs indicateurs avec le Helpdesk.
- **Budget & Rentabilité — deux budgets distincts, jamais additionnés** : **Helpdesk N1** (pour le moment : tous les coûts, y compris techniciens N2, et les revenus de tous les clients) et **MCO N2** (budget distinct, vide pour le moment — à construire après le N1 ; rattachement des revenus d'un client modifiable dans le CRM), sélectionnables dans le module ; chacun avec registre des coûts (coût employeur fictif, ETP, affectations partielles, entrées / sorties, primes, heures supplémentaires, remplacements), registre des prestations (forfait, ETP, horaire, acte, supplémentaire ; statut de validation), résultat analytique = revenus − coûts, marge, contribution par client, prévisions, historique. **Enveloppe déplacements** à plafond infranchissable (blocage motivé et journalisé, solde sans double comptage, plafond modifiable par la direction avec historique) et **budget recrutement** séparé (« RÈGLE D'IMPUTATION À CONFIRMER »).
- **Cockpit PDG** : risques, entité financière Helpdesk, enveloppes séparées, performances par périmètre, sites, effectifs, clients et contrats — sans additionner des résultats de périmètres différents.
- **SLA décroché (QlikView)** : feuille « Qlik SLA décrocher » (extraction fictive), agrégation par volumes, objectifs contractuels non renseignés par défaut, écarts / alertes, historique, filtres pôle / client / file / période. **Cockpit MCO** : SLA de prise en charge et SLA de résolution distincts.
- **Moyens généraux → déplacements professionnels** (plus de faux service « Déplacements ») : demandes, prévus, réservations (déplacements dont au moins une réservation reste à faire — badge, indicateur et liste identiques), réalisés et dépenses, justificatifs, historique ; l'enveloppe déplacements reste celle du Helpdesk (non dupliquée, plafonnée).
- **⚙️ Administration** (rouage en haut à droite) : Connexions & API (un connecteur ITSM par client, chaque client ayant son propre domaine, regroupés par outil ; un connecteur QlikView unique commun à tous les clients ; Genesys Cloud ; ajout possible ; aucune URL inventée, aucun secret, « Test réel indisponible en démonstration »), rôles & permissions configurables, clients (CRM), paramètres SLA / tableaux de bord, historique des modifications. **Modification en direct** des champs autorisés (budgets, revenus, coûts, prévisions, objectifs, effectifs, CRM) avec recalcul immédiat ; le plafond déplacements ne se modifie que par la procédure de révision budgétaire.
- **Accès centralisés** (`src/auth/access.ts`) : mêmes règles et mêmes destinations depuis la carte des sites, le menu latéral et les raccourcis ; un refus nomme le droit manquant ; une fonctionnalité non développée affiche « Module à venir » (jamais « Accès restreint »). L'administrateur ouvre tous les modules.
- **Navigation** : menu latéral repliable, groupé (Opérations, Management, Finance, Administration), accès direct au CRM ; **URL dédiées** compatibles GitHub Pages (`#/helpdesk/tickets?client=thelem&ticket=…`, `#/externes/monext/integration`, `#/finance/mco/historique`…) avec Précédent / Suivant et restauration après rafraîchissement.
- **États explicites** : SLA « conforme / non conforme / non évalué / données indisponibles » (jamais de conformité implicite sans objectif) ; état des sites clients par dimension (Incident, SLA, Charge, Qualité des données) avec la raison ; « Connexion réelle : non configurée » distincte de « Simulation : active / suspendue / en erreur ».
- **Profils de démonstration** : Administrateur, Responsable de département, Manager, Finance, Technicien (+ RH, Direction).
- **Préparation à la production** (rail → bouclier) : liste de contrôle par domaine, statuts, Go / No-Go, rapport Markdown / PDF. **RÉINITIALISER LA DÉMONSTRATION** (en-tête) régénère tous les modules.

## Socle (V0.2)

**Entreprise virtuelle 3D**
- Bâtiment isométrique sur deux étages (rez-de-chaussée : accueil, salle de pause, stock informatique, parc automobile ; étage 1 : plateau Helpdesk, RH, direction & budgets), soit 7 pièces cliquables.
- Plateau Helpdesk affiché en entier et découpé en **pôles clients cliquables** : Pôle Thelem, Pôle IRD, Pôle Ortec, Pôle Multi dédié, Pôle Sodiaal (moquette colorée, cloisons basses, postes et avatars par pôle). Un clic sur le plateau ouvre la vue globale ; un clic sur un pôle centre la caméra sur ce pôle et filtre le panneau (files, agents, tickets, synthèse SLA). Les pôles sont aussi accessibles depuis la barre du bas, le sélecteur du panneau et le mode 2D.
- Sélecteur d'étage avec transition, bouton « Vue d'ensemble », caméra orbitale (rotation, zoom borné, panoramique) et animation douce de focus sur la pièce sélectionnée. Toute interaction de l'utilisateur interrompt l'animation.
- Mobilier stylisé, cloisons vitrées, éclairage et ombres, avatars colorés selon l'état de travail, légende des états, surbrillance et indicateur au survol, info-bulle sur les avatars.
- Les avatars de la salle de pause sont une **métaphore d'état**, pas une localisation.
- Scène chargée à la demande (chunk séparé) ; bascule automatique en 2D si WebGL est indisponible ; animations désactivées si l'utilisateur préfère réduire les animations.

**Interface métier**
- Indicateurs globaux : agents connectés, appels en attente, SLA pondéré vs objectif, pauses, tickets ouverts.
- Plateau Helpdesk : sélecteur de pôle client, synthèse du pôle (attente, SLA vs objectif, agents connectés, tickets), files par pôle (attente, plus longue attente, SLA vs objectif), agents (filtre par état, fiche au clic), tickets fictifs (filtre par priorité, détail au clic).
- Salle de pause, RH (agrégé), stock (alertes, filtre par catégorie), parc automobile, budgets, accueil.
- Mode 2D accessible au clavier donnant accès aux mêmes panneaux. `Échap` ferme le panneau.

**Simulation contrôlée**
- Données dans `src/data/demoData.ts`, évolution par une fonction pure et déterministe (`src/services/simulation.ts`).
- Lecture / pause, intervalle 5 / 15 / 30 s, rafraîchissement manuel, réinitialisation, horodatage de fraîcheur. La simulation est suspendue quand l'onglet est masqué.

**Rôles (maquette)**
- Sélecteur « Rôle simulé » : Agent, Team Leader, Responsable, RH, Finance, Direction, Admin (`src/auth/roles.ts`).
- Exemples : la Direction voit des données agrégées, l'Admin n'accède pas aux RH, l'Agent est limité à son équipe, seules certaines actions (simulées) sont permises.
- ⚠️ Ces contrôles côté navigateur **ne constituent pas une sécurité**. Les permissions effectives devront être appliquées et journalisées par le backend.

**Connecteurs**
- Interfaces `QueueConnector`, `TicketConnector`, `ReportingConnector` et implémentation de démo dans `src/services/connectors.ts`.
- Genesys Cloud, GLPI et Qlik Sense sont des emplacements réservés qui rejettent tout appel. **Aucun appel réseau métier** n'est effectué (vérifié par les tests).

## Extension V2.3 — supervision des clients externes

Cockpit opérationnel des collaborateurs SEATPI affectés chez **INVIVO** (EasyVista), **PRIMAGAZ** (ITSM non renseigné) et **MONEXT** (ISILOG) — cartographie corrigée en V3.0. Accès : bouton « Clients externes » du rail, ou étage **Sites clients** de la carte 3D.

Organisation : chez les clients, SEATPI n'intervient qu'en **MCO N2** (une équipe N2 par client). Le **Helpdesk N1**, l'**Exploitation** et le **CSM** sont des services internes SEATPI : les tickets N2 arrivent du Helpdesk N1 (ou de la supervision) et peuvent être escaladés vers l'Exploitation (infrastructure), le CSM (contractuel) ou une équipe externe (éditeur, constructeur, opérateur). Les services **Exploitation** et **CSM** ont leur salle à l'**étage 2** de la carte 3D, avec leurs escalades reçues, leur personnel et, pour le CSM, le suivi de chaque compte.

**Déplacements CSM** : seuls les managers CSM se déplacent du siège SEATPI vers leurs clients (comité de pilotage, revue de service, point d'escalade). Sur la carte des sites : siège SEATPI, trajet surligné, véhicule animé en temps réel (aller, chez le client, retour) avec étiquette, et encart récapitulatif permanent. Également dans la vue globale (tableau détaillé) et dans le panneau du service CSM ; un CSM en déplacement n'apparaît plus à son bureau.

- **Carte des sites** : un bâtiment par client avec voyant d'état (vert : toutes les dimensions dans les seuils · orange : point d'attention SLA, charge ou qualité des données · rouge : incident critique, ex. P1 hors SLA ou P1/P2 non pris en charge) qui pulse discrètement en cas d'alerte. Clic bâtiment → cockpit du client ; clic équipe → ses tickets ouverts ; clic technicien → sa fiche (selon le rôle).
- **Vue globale** (responsable Helpdesk) : par client et pour le plateau interne — effectif, ouverts, en cours, résolus, backlog, SLA, objectif hebdo, réalisé, reste à faire, charge, CRA et congés en attente, budget, coût, rentabilité (colonnes financières selon le rôle). Un clic ouvre le détail.
- **Tableau de bord client** : indicateurs Tickets et Activité par période (aujourd'hui, semaine, semaine précédente), tous cliquables vers la liste des tickets concernés ; reçus par jour, ancienneté, charge des équipes, alertes, définitions explicites.
- **Tickets** : tableau complet (n° interne et source, client, site, contrat, titre, catégorie, priorité, statut, technicien, groupe, dates, échéance SLA, temps passé, résolution), recherche, filtres avancés, tri, regroupements, export CSV ; fiche détaillée avec SLA, escalades et historique des changements.
- **Backlog (Kanban)** : Nouveau → Affecté → En cours → En attente → Résolu → Clôturé, plus Bloqué / Escaladé / Réouvert ; déplacement uniquement si le rôle **et** l'outil source l'autorisent (règles de transition de chaque outil — hypothèses de démonstration à confirmer) ; alertes paramétrables (seuil « sans mise à jour »).
- **Techniciens** : charge par équipe vs capacité planifiée avec alertes, fiche opérationnelle (planning, charge, tickets, retards, temps passé, compétences, congés, CRA). Ordre alphabétique, aucun classement.
- **Objectifs configurables** (volume / qualité) : objectif, réalisé, reste à faire, écart, tendance, projection de fin de semaine.
- **Escalades** : services d'origine et destinataire, date, motif, responsable, statut, historique ; identifiant interne unique `SPI-xxxxxx` ↔ identifiant source.
- **Intégration ITSM** : adaptateurs GLPI, EasyVista, ISILOG, Service Manager, Jira, générique ; synchronisation planifiée (15 min, accélérée à 45 s en démo), état de connexion, journal, déduplication, correspondance des statuts et priorités, calendriers et matrices SLA contractuels (suspension en attente client, jours fériés).
- **Rapport hebdomadaire** par client et **consolidé département**, calculé avec les mêmes fonctions que le cockpit ; export Markdown et impression PDF.

Définitions principales : périodes en heure locale `[début, fin[` ; *ouvert* = statut autre que Résolu/Clôturé ; *résolu sur la période* = au moins une résolution dans la période, compté une seule fois par ticket ; SLA en temps ouvré selon le calendrier du client.

Code : `src/external/` (modèle, calendrier, SLA, adaptateurs, source fictive, synchronisation, indicateurs, objectifs, charge, alertes, rapports) et `src/components/external/`. Tests de cohérence dans `src/external/__tests__/`.

⚠️ Données fictives, aucun appel réseau. Les connecteurs réels devront être exécutés par un backend (aucun jeton dans le navigateur) et les droits appliqués côté serveur.

## Architecture

```
src/
  App.tsx                 état applicatif, navigation entre la 3D et les modules
  config/itsm.ts          cartographie ITSM unique, registre clients et connecteurs
  data/                   sites et plans (sites.ts, layout.ts), données fictives, fournisseurs de données (provider.ts)
  org/                    encadrement (people.ts) et référentiel des collaborateurs (collaborators.ts)
  external/               pipeline ITSM (adaptateurs, source fictive, synchronisation, SLA, indicateurs, rapports)
  helpdesk/               tickets des plateaux internes et consolidation Helpdesk
  management/             règles et état des congés, CRA, délégations, objectifs N1
  finance/                Budget & Rentabilité : fonctions pures (budget.ts) et état (useFinance.ts)
  production/             liste de contrôle de préparation à la production
  auth/roles.ts           matrice de droits de la maquette (illustration, pas une sécurité)
  scene/                  scène React Three Fiber
  components/             interface (cockpits helpdesk, management, finance, pdg, production, external…)
scripts/readiness-report.ts   régénère PRODUCTION_READINESS.md (npm run readiness)
```

Données : l'application démarre toujours sur `DemoDataProvider`. Le fournisseur de production n'est retenu que si `VITE_DATA_MODE=production` **et** tous ses prérequis sont validés ; sinon un avertissement visible indique que les données restent fictives (aucune bascule silencieuse). Aucun secret n'est lu ni stocké dans le frontend.

## À réaliser ensuite

Voir [`PRODUCTION_READINESS.md`](PRODUCTION_READINESS.md) (même contenu que le centre de préparation de l'application) et la section « Reprise » de [`docs/RAPPORT_V3.md`](docs/RAPPORT_V3.md).

## Commande Claude Code
Dans ce dossier, lancer `claude` puis demander de lire `CAHIER_DES_CHARGES.md`, `docs/AUDIT_V3.md` et `docs/RAPPORT_V3.md`.
