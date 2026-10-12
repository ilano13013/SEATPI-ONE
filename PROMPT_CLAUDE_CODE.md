# Prompt pour Claude Code

Tu es l'architecte principal de SEATPI ONE. Lis README.md et CAHIER_DES_CHARGES.md avant toute modification. Le dépôt contient un prototype React / React Three Fiber à conserver et améliorer.

OBJECTIF IMMÉDIAT : produire une V0.2 soignée, utilisable en démonstration, dont la navigation principale est une entreprise virtuelle 3D isométrique.

1. Exécute npm install et npm run build ; corrige toutes les erreurs sans supprimer de fonctionnalités.
2. Refactorise le code en composants et modules TypeScript (Scene, Room, Workspace, SidePanel, DemoData, types).
3. Améliore la scène 3D : bureaux, cloisons vitrées, avatars stylisés, salle de pause, accueil, stock, parking, éclairage, ombres, légendes et feedback au survol.
4. Ajoute sélection d'étage et caméra fluide, avec animation douce de focus sur une salle sélectionnée.
5. Conserve une vraie interface métier : tableau des files par client, agents, statuts, SLA, tickets fictifs, filtres et détails au clic.
6. Ajoute des données fictives structurées dans un service dédié et une simulation contrôlée de rafraîchissement.
7. Prépare des interfaces de service pour les futurs connecteurs, mais n'appelle aucune API réelle.
8. Respecte les droits par rôle dans les maquettes, sans prétendre que les contrôles frontend constituent une sécurité effective.
9. Ajoute tests de base et instructions de démarrage.
10. À chaque étape, vérifie que le build fonctionne. Fournis le bilan des fichiers modifiés et des fonctions opérationnelles.

IMPORTANT : aucune donnée réelle de salarié, aucun secret et aucune connexion Genesys/GLPI/Qlik sans validation préalable. Les avatars en pause sont une métaphore d'état, pas une localisation réelle.

COMMENCE PAR : auditer le code existant, lancer le build et proposer un plan court ; puis implémenter directement la V0.2.
