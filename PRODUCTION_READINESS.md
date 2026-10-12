# SEATPI ONE — Rapport de préparation à la production

Généré le 12/10/2026 depuis ADMINISTRATION → PRÉPARATION À LA PRODUCTION.

> L’application est en **mode démonstration** : toutes les données sont fictives et aucune connexion réelle n’est établie.
> Le taux de préparation mesure l’avancement de cette liste ; ce n’est **pas** une certification de sécurité.

## Décision : NO-GO

Motifs : 4 élément(s) bloquant(s) ; 15 élément(s) critique(s) non validé(s).

## Synthèse

| Indicateur | Valeur |
|---|---|
| Éléments | 37 |
| Validés | 1 |
| Bloquants | 4 |
| En cours / à tester | 7 |
| Taux de préparation (avancement, pas une certification) | 2,7 % |

## Éléments critiques manquants

- **INF-01 — Backend SEATPI ONE (API et base de données)** (Bloquant) : Aucun backend : la démonstration fonctionne entièrement dans le navigateur. → Choisir l’hébergement, déployer l’API et la base de données. (DSI)
- **SEC-01 — Authentification unique (SSO)** (Bloquant) : Rôle choisi librement dans une liste : aucune authentification. → Raccorder l’annuaire de l’entreprise (SSO) au backend. (RSSI)
- **SEC-02 — Contrôle des droits côté serveur** (Bloquant) : La matrice des rôles est appliquée dans le navigateur (illustration uniquement). → Implémenter la matrice de droits dans l’API, avec tests. (RSSI)
- **SEC-03 — Coffre de secrets côté serveur** (À configurer) : Aucun coffre : aucun secret n’existe encore (et aucun ne doit être dans le frontend). → Mettre en place un coffre de secrets accessible au seul backend. (RSSI)
- **SEC-05 — Analyse RGPD des données RH et individuelles** (Non renseigné) : Aucune analyse d’impact réalisée. → Conduire l’analyse d’impact, définir durées de conservation et accès. (DPO)
- **ITSM-01 — EasyVista — INVIVO, DMB, TERACT** (Non renseigné) : Instance, URL d’API, mode d’authentification et compte de service non fournis. → Obtenir les accès en lecture auprès des clients. (Responsable Helpdesk)
- **ITSM-02 — Jira — LBR FR, EURAPHARMA** (Non renseigné) : Instance, URL d’API, mode d’authentification et compte de service non fournis. → Obtenir les accès en lecture. (Responsable Helpdesk)
- **ITSM-03 — GLPI — ANGE, HSTV, NOCIBE** (Non renseigné) : Instance, URL d’API, jetons applicatifs non fournis. → Obtenir les accès en lecture. (Responsable Helpdesk)
- **ITSM-04 — ISILOG — THELEM, TRANSGOURMET, MONEXT** (Non renseigné) : Instance, URL d’API, mode d’authentification non fournis. → Obtenir les accès en lecture. (Responsable Helpdesk)
- **ITSM-09 — Zendesk — SNR** (Non renseigné) : Sous-domaine Zendesk, mode d’authentification (jeton API / OAuth) et compte de service non fournis ; statuts personnalisés à confirmer. → Obtenir les accès en lecture et la liste des statuts utilisés. (Responsable Helpdesk)
- **ITSM-05 — Outil ITSM de PRIMAGAZ, IRD, ORTEC, SODIAAL, G2S** (Bloquant) : ITSM NON RENSEIGNÉ — CONFIGURATION REQUISE. → Identifier l’outil de chaque client et l’ajouter au registre. (Responsable Helpdesk)
- **RH-01 — Source des effectifs et organigramme** (Non renseigné) : Collaborateurs et managers fictifs (pseudonymes). → Raccorder le SIRH au backend (lecture). (DRH)
- **RH-05 — Information des représentants du personnel** (Non renseigné) : Non réalisée. → Présenter l’outil et ses indicateurs. (DRH)
- **FIN-01 — Coûts employeur réels** (Non renseigné) : Barème fictif par population. → Fournir un export mensuel des coûts chargés par collaborateur. (DAF)
- **FIN-02 — Registre des contrats et prestations** (Non renseigné) : Montants et modes de facturation fictifs ; références de contrats internes à renseigner. → Charger les contrats, tarifs et la facturation mensuelle. (DAF)

## Infrastructure

| Réf. | Élément | Statut | Priorité | Ce qui manque | Pourquoi | Responsable | Action | Dépendances | Dernière vérification |
|---|---|---|---|---|---|---|---|---|---|
| INF-01 | Backend SEATPI ONE (API et base de données) | Bloquant | Critique | Aucun backend : la démonstration fonctionne entièrement dans le navigateur. | Les secrets, les droits, la persistance et les connecteurs doivent être côté serveur. | DSI | Choisir l’hébergement, déployer l’API et la base de données. | — | — |
| INF-02 | Environnements recette et production séparés | Non renseigné | Haute | Seul l’environnement de démonstration GitHub Pages existe. | Tester sans risque pour les données réelles. | DSI | Créer les environnements et le circuit de déploiement. | INF-01 | — |
| INF-03 | Sauvegardes et plan de reprise | Non renseigné | Haute | Aucune donnée persistée, donc aucune sauvegarde. | Congés, CRA et validations financières doivent être conservés et restaurables. | DSI | Définir la politique de sauvegarde, tester une restauration. | INF-01 | — |
| INF-04 | Supervision et journaux applicatifs | À configurer | Moyenne | Pas de collecte de journaux ni d’alerte technique. | Détecter les pannes de connecteurs et d’API. | Exploitation | Raccorder l’API à l’outil de supervision existant. | INF-01 | — |
| INF-05 | Nom de domaine et certificats | Non renseigné | Moyenne | Domaine de production non défini. | Accès sécurisé (HTTPS) et identifiable par les utilisateurs. | DSI | Réserver le domaine, émettre les certificats. | INF-01 | — |
| INF-06 | Publication de l’interface | En cours | Haute | GitHub Pages publie la démonstration publique ; aucune publication interne. | Les données réelles ne doivent jamais être exposées sur une page publique. | DSI | Publier la version production derrière l’authentification de l’entreprise. | INF-01, SEC-01 | — |

## Sécurité

| Réf. | Élément | Statut | Priorité | Ce qui manque | Pourquoi | Responsable | Action | Dépendances | Dernière vérification |
|---|---|---|---|---|---|---|---|---|---|
| SEC-01 | Authentification unique (SSO) | Bloquant | Critique | Rôle choisi librement dans une liste : aucune authentification. | Identifier chaque utilisateur et lui appliquer ses droits. | RSSI | Raccorder l’annuaire de l’entreprise (SSO) au backend. | INF-01 | — |
| SEC-02 | Contrôle des droits côté serveur | Bloquant | Critique | La matrice des rôles est appliquée dans le navigateur (illustration uniquement). | Un contrôle côté navigateur n’est pas une mesure de sécurité. | RSSI | Implémenter la matrice de droits dans l’API, avec tests. | SEC-01 | — |
| SEC-03 | Coffre de secrets côté serveur | À configurer | Critique | Aucun coffre : aucun secret n’existe encore (et aucun ne doit être dans le frontend). | Les comptes de service ITSM et SIRH doivent rester côté serveur. | RSSI | Mettre en place un coffre de secrets accessible au seul backend. | INF-01 | — |
| SEC-04 | Journal d’audit des actions | À configurer | Haute | Historiques locaux à la démonstration, perdus au rechargement. | Tracer validations, refus, changements de plafond et écritures ITSM. | RSSI | Journaliser côté serveur, horodaté et non modifiable. | INF-01, SEC-01 | — |
| SEC-05 | Analyse RGPD des données RH et individuelles | Non renseigné | Critique | Aucune analyse d’impact réalisée. | Congés, CRA et indicateurs individuels sont des données personnelles. | DPO | Conduire l’analyse d’impact, définir durées de conservation et accès. | — | — |
| SEC-06 | Test d’intrusion | Non renseigné | Haute | Non réalisé. | Vérifier la résistance de l’API et de l’authentification. | RSSI | Commander un test d’intrusion avant ouverture. | SEC-02 | — |
| SEC-07 | Absence de secrets dans le dépôt et la page publique | À tester | Haute | Contrôle à réaliser par l’équipe sécurité (un test automatisé du dépôt existe). | La page GitHub Pages est publique. | RSSI | Activer l’analyse de secrets du dépôt et faire relire la configuration. | — | — |

## ITSM

| Réf. | Élément | Statut | Priorité | Ce qui manque | Pourquoi | Responsable | Action | Dépendances | Dernière vérification |
|---|---|---|---|---|---|---|---|---|---|
| ITSM-01 | EasyVista — INVIVO, DMB, TERACT | Non renseigné | Critique | Instance, URL d’API, mode d’authentification et compte de service non fournis. | Lire les tickets réels de ces clients. | Responsable Helpdesk | Obtenir les accès en lecture auprès des clients. | SEC-03 | — |
| ITSM-02 | Jira — LBR FR, EURAPHARMA | Non renseigné | Critique | Instance, URL d’API, mode d’authentification et compte de service non fournis. | Lire les tickets réels de ces clients. | Responsable Helpdesk | Obtenir les accès en lecture. | SEC-03 | — |
| ITSM-03 | GLPI — ANGE, HSTV, NOCIBE | Non renseigné | Critique | Instance, URL d’API, jetons applicatifs non fournis. | Lire les tickets réels de ces clients. | Responsable Helpdesk | Obtenir les accès en lecture. | SEC-03 | — |
| ITSM-04 | ISILOG — THELEM, TRANSGOURMET, MONEXT | Non renseigné | Critique | Instance, URL d’API, mode d’authentification non fournis. | Lire les tickets réels de ces clients. | Responsable Helpdesk | Obtenir les accès en lecture. | SEC-03 | — |
| ITSM-09 | Zendesk — SNR | Non renseigné | Critique | Sous-domaine Zendesk, mode d’authentification (jeton API / OAuth) et compte de service non fournis ; statuts personnalisés à confirmer. | Lire les tickets réels de SNR (Pôle Multi). | Responsable Helpdesk | Obtenir les accès en lecture et la liste des statuts utilisés. | SEC-03 | — |
| ITSM-05 | Outil ITSM de PRIMAGAZ, IRD, ORTEC, SODIAAL, G2S | Bloquant | Critique | ITSM NON RENSEIGNÉ — CONFIGURATION REQUISE. | Sans outil identifié, aucun ticket ni SLA ne peut être mesuré pour ces clients. | Responsable Helpdesk | Identifier l’outil de chaque client et l’ajouter au registre. | — | — |
| ITSM-06 | Correspondance des statuts et priorités | À tester | Haute | Tables de correspondance établies sur des hypothèses de démonstration. | Des statuts mal traduits faussent SLA, backlog et Kanban. | Responsable Helpdesk | Faire valider chaque table par le référent de l’outil. | ITSM-01, ITSM-02, ITSM-03, ITSM-04, ITSM-09 | — |
| ITSM-07 | Cartographie client → outil ITSM | Validé | Haute | Rien : la cartographie fournie est appliquée depuis une source unique. | Chaque ticket doit provenir du bon outil. | Responsable Helpdesk | Maintenir le registre à jour lors de l’arrivée d’un client. | — | 2026-10-12 (preuve : Test automatisé src/config/itsm.test.ts (correspondance exacte avec la cartographie fournie), exécuté à chaque publication.) |
| ITSM-08 | Droits d’écriture (transitions, affectations) | À configurer | Moyenne | Écritures simulées uniquement ; droits d’écriture non demandés. | Agir depuis SEATPI ONE suppose des droits explicites dans chaque outil. | Responsable Helpdesk | Décider client par client : lecture seule ou écriture. | ITSM-06 | — |

## RH

| Réf. | Élément | Statut | Priorité | Ce qui manque | Pourquoi | Responsable | Action | Dépendances | Dernière vérification |
|---|---|---|---|---|---|---|---|---|---|
| RH-01 | Source des effectifs et organigramme | Non renseigné | Critique | Collaborateurs et managers fictifs (pseudonymes). | Les périmètres de validation dépendent de l’organigramme réel. | DRH | Raccorder le SIRH au backend (lecture). | INF-01, SEC-05 | — |
| RH-02 | Règles de congés | À configurer | Haute | Préavis 7 jours, 15 jours maximum, 60 % de présence : valeurs de démonstration. | Les contrôles doivent refléter l’accord d’entreprise. | DRH | Fournir les règles et seuils par équipe. | — | — |
| RH-03 | Circuit de validation des CRA et délégations | À tester | Haute | Circuit illustré en démonstration, non validé par les managers. | Qui valide, dans quel délai, avec quelle tolérance d’écart. | Responsable Helpdesk | Valider le circuit en atelier, puis recette. | RH-01 | — |
| RH-04 | Calendriers de travail et jours fériés | À configurer | Moyenne | Calendrier unique de démonstration. | Heures attendues et SLA dépendent des calendriers réels. | DRH | Fournir les calendriers par site et par contrat. | — | — |
| RH-05 | Information des représentants du personnel | Non renseigné | Critique | Non réalisée. | Outil de suivi d’activité : information préalable requise ; aucun classement disciplinaire automatique. | DRH | Présenter l’outil et ses indicateurs. | SEC-05 | — |

## Finance

| Réf. | Élément | Statut | Priorité | Ce qui manque | Pourquoi | Responsable | Action | Dépendances | Dernière vérification |
|---|---|---|---|---|---|---|---|---|---|
| FIN-01 | Coûts employeur réels | Non renseigné | Critique | Barème fictif par population. | Le résultat analytique repose sur le coût employeur chargé (pas le salaire net). | DAF | Fournir un export mensuel des coûts chargés par collaborateur. | RH-01, SEC-05 | — |
| FIN-02 | Registre des contrats et prestations | Non renseigné | Critique | Montants et modes de facturation fictifs ; références de contrats internes à renseigner. | Seules les prestations validées constituent des revenus. | DAF | Charger les contrats, tarifs et la facturation mensuelle. | INF-01 | — |
| FIN-03 | Règle d’imputation du recrutement | À configurer | Haute | RÈGLE D’IMPUTATION À CONFIRMER. | Décider si les frais de recrutement entrent dans le résultat du Helpdesk. | Direction | Arbitrer la règle et la paramétrer. | — | — |
| FIN-04 | Enveloppe déplacements et habilitations | À configurer | Haute | Plafond fictif ; personne habilitée simulée par le rôle Direction. | Le plafond ne doit jamais être dépassé et sa modification doit être tracée. | Direction | Fixer l’enveloppe annuelle et désigner les personnes habilitées. | SEC-01 | — |
| FIN-05 | Rapprochement avec la comptabilité | Non renseigné | Moyenne | Non réalisé. | Vérifier la cohérence du résultat analytique avec la comptabilité générale. | DAF | Définir le rapprochement mensuel. | FIN-01, FIN-02 | — |

## Organisation

| Réf. | Élément | Statut | Priorité | Ce qui manque | Pourquoi | Responsable | Action | Dépendances | Dernière vérification |
|---|---|---|---|---|---|---|---|---|---|
| ORG-01 | Implantation des départements par site | À tester | Moyenne | Configuration de démonstration (RH et Stock à La Ciotat uniquement). | La carte des sites doit refléter l’organisation réelle. | Direction | Valider l’implantation des départements par site. | — | — |
| ORG-02 | Affectation des pôles et clients aux sites | À tester | Moyenne | Pôle Multi (11 clients) à La Ciotat et Montpellier ; répartition des agents entre les deux sites et absence de pôle client à Paris à confirmer. | Les managers de site valident les demandes de leur périmètre. | Responsable Helpdesk | Confirmer la répartition. | — | — |
| ORG-03 | Référents par domaine | En cours | Haute | Fonctions identifiées, personnes non désignées. | Chaque élément de cette liste doit avoir un responsable. | Direction | Désigner un référent par domaine. | — | — |
| ORG-04 | Recette utilisateurs | Non renseigné | Haute | Non planifiée. | Valider les parcours avec managers, finance et direction. | Responsable Helpdesk | Planifier la recette sur l’environnement de recette. | INF-02 | — |
| ORG-05 | Formation des utilisateurs | Non renseigné | Moyenne | Non planifiée. | Adoption et bon usage des indicateurs. | Formation | Préparer des sessions par profil. | ORG-04 | — |

## Comment utiliser ce document

- La même liste est consultable et modifiable (en simulation) dans l’application : rail de gauche → **Préparation à la production**.
- Un élément ne passe à **Validé** qu’après une vérification réelle, décrite dans la colonne « Dernière vérification » (preuve).
- Après mise à jour de `src/production/readiness.ts`, régénérer ce fichier avec `npm run readiness` ; un test vérifie que chaque élément y figure.
