# SEATPI ONE — prototype 3D V0.2

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

## Fonctionnel aujourd'hui (V0.2)

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

## Architecture

```
src/
  App.tsx                 état applicatif (étage, pièce, rôle, mode 2D/3D)
  types.ts                modèle métier de démonstration
  data/                   plan du bâtiment (layout) et jeu de données fictif
  services/               simulation, hook de rafraîchissement, connecteurs
  auth/roles.ts           matrice de droits de la maquette
  scene/                  scène React Three Fiber (Scene, RoomMesh, mobilier, avatars, caméra)
  components/             Header, MetricsBar, Rail, Workspace, SidePanel, panneaux métier
  lib/                    formatage, couleurs d'état, détection d'environnement
```

## À réaliser ensuite
- Authentification (SSO) et RBAC/ABAC côté serveur, journal d'audit.
- Base PostgreSQL et API backend ; modèle métier complet (§5 du cahier des charges).
- Connecteur Genesys Cloud sécurisé (OAuth côté serveur, scopes minimaux, gestion des limites d'API et de la fraîcheur).
- Connecteurs tickets et reporting sous réserve d'accès autorisé.
- Validation RGPD, DPIA si nécessaire, politique de conservation, concertation interne et droits d'accès.
- Tests de bout en bout, mesures de performance sur le matériel cible, audit d'accessibilité.

## Commande Claude Code
Dans ce dossier, lancer `claude` puis demander de lire `CAHIER_DES_CHARGES.md` et `PROMPT_CLAUDE_CODE.md`.
