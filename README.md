# SEATPI ONE — prototype 3D V0.1

Prototype local avec données **100 % fictives**. Ne pas déployer avec des données réelles ni connecter les API internes sans validation de l'entreprise.

## Démarrer

Prérequis : Node.js 20+ et npm.

```bash
npm install
npm run dev
```

Ouvrir l'URL indiquée par Vite. Cliquer sur les salles du bâtiment 3D, utiliser le zoom et la rotation, ouvrir les modules, filtrer les files clients. Un mode 2D est prévu.

## Fonctionnel aujourd'hui
- Bâtiment 3D isométrique navigable avec six zones cliquables.
- Tableau de bord fictif, fiches Helpdesk et salle de pause.
- Filtre des files clients, navigation latérale, mode 2D.
- Autres modules : panneaux de démonstration (pas de CRUD réel).

## À réaliser ensuite
- Authentification et RBAC côté serveur.
- Base PostgreSQL et API backend.
- Modèle métier : clients, plateaux, files, agents, états, équipements, véhicules, budgets, demandes, audit.
- Connecteur Genesys Cloud sécurisé (OAuth côté serveur, scopes minimaux, gestion limites API et rafraîchissement).
- Connecteurs tickets et reporting sous réserve d'accès autorisé.
- Validation RGPD, DPIA si nécessaire, politique de conservation, concertation interne et droits d'accès.
- Tests, performances et accessibilité.

## Commande Claude Code
Dans ce dossier, lancer `claude` puis demander de lire `CAHIER_DES_CHARGES.md` et `PROMPT_CLAUDE_CODE.md`.
