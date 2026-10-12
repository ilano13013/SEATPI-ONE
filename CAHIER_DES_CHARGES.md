# SEATPI ONE — Cahier des charges V1.0

## 1. Objectif
Créer un centre de pilotage SEATPI avec navigation principale dans un bâtiment 3D isométrique. La scène est une métaphore visuelle de l'organisation, non un système de géolocalisation des salariés.

## 2. Utilisateurs et droits
- Agent : vues autorisées de son équipe, demandes personnelles.
- Team Leader : supervision de son périmètre, qualité et backlog.
- Responsable : KPI, budgets et validation sur son service.
- RH : accès aux données RH strictement nécessaires.
- Finance : devis, dépenses et comptabilité selon habilitations.
- Direction : vision consolidée, données agrégées par défaut.
- Admin : configuration technique sans accès automatique aux données RH confidentielles.
Implémenter permissions backend par ressource, service et action, et journaliser les accès sensibles.

## 3. Modules
1. Supervision : clients, plateaux, files Genesys, appels, agents, SLA, backlog.
2. Pilotage : objectifs, qualité, reporting, répartition de charge.
3. CRM : contacts, comptes, contrats, historique, engagements.
4. Stocks : catalogue, inventaire, affectations, mouvements, alertes.
5. RH : planning, congés, formations, habilitations, documents.
6. Commercial : opportunités, devis, appels d'offres, échéances.
7. Finance : centres de coûts, budgets, factures, approbations.
8. Véhicules : calendrier, disponibilité, réservation, entretien.
9. Moyens généraux : salles, maintenance, demandes et fournisseurs.
10. Bâtiment 3D : étages, zones, objets cliquables, panneaux contextuels.

## 4. Interaction 3D
Caméra orbitale isométrique, zoom limité, zones sélectionnables, indicateurs contextuels, animations discrètes, mode 2D accessible. Les statuts des avatars représentent des états de travail et ne prétendent pas refléter une position physique.

## 5. Modèle de données initial
Tenant, Site, Floor, Room, Service, Plateau, Client, Queue, Agent, AgentStatusEvent, QueueMetric, TicketSummary, InventoryItem, AssetAssignment, Vehicle, VehicleBooking, Budget, Expense, Opportunity, Tender, LeaveRequest, AuditEvent. Clés UUID, timestamps UTC, séparation multi-périmètre et contraintes d'intégrité.

## 6. Intégrations futures
Genesys Cloud pour files/présence si autorisé ; GLPI ou autres outils ITSM pour tickets ; Qlik Sense pour indicateurs agrégés. Architecture adaptateurs, OAuth serveur, pas de secret navigateur, rafraîchissement contrôlé, gestion des erreurs et horodatage de fraîcheur.

## 7. Sécurité et conformité
Données fictives jusqu'à validation. Auth SSO si possible, RBAC/ABAC, TLS, chiffrement au repos, audit, minimisation, rétention et information des salariés. Examiner la base légale et la proportionnalité des indicateurs individuels ; consulter DPO et instances représentatives compétentes avant mise en production. Pas de classement disciplinaire automatique ni de localisation physique supposée.

## 8. Exigences non fonctionnelles
Desktop prioritaire, écran 1366×768 minimum, interface responsive, chargement progressif 3D, fallback 2D, objectifs de fluidité à mesurer sur matériel cible, accessibilité clavier des modules, supervision des erreurs, sauvegardes, tests automatisés.

## 9. Livrables par phase
P0 : démonstration 3D avec données fictives, 6 zones, Helpdesk et pauses.
P1 : architecture backend, authentification, schéma métier, tests et audit.
P2 : connecteur Genesys autorisé, files, agents et fraîcheur des données.
P3 : CRM, stock, véhicules et moyens généraux.
P4 : RH, finances, budgets, appels d'offres et reporting.

## 10. Critères de recette P0
- La page s'ouvre sans compte avec la mention explicite « mode démo ».
- La caméra peut pivoter et zoomer ; six salles sont sélectionnables.
- Cliquer une salle affiche le bon panneau sans recharger la page.
- Le plateau Helpdesk présente au moins quatre clients et un filtre fonctionnel.
- La salle de pause présente les statuts fictifs et durées.
- Le mode 2D permet d'accéder aux mêmes panneaux.
- Aucun secret, donnée personnelle réelle ou appel réseau métier n'est présent.
