# SEATPI ONE V3.0 — rapport de correction, limites et reprise

L'application reste en **mode démonstration** : données fictives générées dans le navigateur, aucune connexion réelle, aucune action envoyée à un système externe.

## 1. Corrections par rapport à l'audit (`docs/AUDIT_V3.md`)

| # | Constat | Correction V3.0 | Où |
|---|---------|-----------------|----|
| A1 | Associations ITSM inventées | Cartographie unique : EasyVista → INVIVO, DMB, TERACT ; Jira → LBR FR, EURAPHARMA ; GLPI → ANGE, HSTV, NOCIBE ; ISILOG → THELEM, TRANSGOURMET, MONEXT ; Zendesk → SNR. PRIMAGAZ, G2S : « ITSM NON RENSEIGNÉ — CONFIGURATION REQUISE », aucun ticket généré. | `src/config/itsm.ts`, test `itsm.test.ts` |
| A2 | Clients internes sans outil ITSM | Registre des clients ; Pôle Multi (La Ciotat et Montpellier) : ANGE, HSTV, LBR FR, TRANSGOURMET, INVIVO (N1), SNR, DMB, NOCIBE, TERACT, G2S, EURAPHARMA ; tickets N1 pour tous les clients dotés d'un outil ; IRD, ORTEC, SODIAAL, G2S non renseignés. Aucun pôle client à Paris. | `src/helpdesk/` |
| A3 | Capacités des connecteurs présentées comme des faits | Capacités marquées « hypothèse de démonstration » ; registre des connecteurs : instance, URL d'API, authentification « Non renseigné », statut « Non connecté ». | `src/external/itsm/adapters.ts`, module Connecteurs ITSM |
| A4 | Statut / priorité d'origine perdus | `sourceStatus`, `sourcePriority`, identifiant source conservés ; clé de référentiel `outil:client:id` (pas de collision entre clients d'un même outil). | `src/external/sync.ts` |
| A5 | Revenus = heures × tarif | Revenus issus du registre des prestations (forfait contractuel pour les clients N2) ; les heures ne servent qu'à la ventilation des coûts ; un ticket résolu ou un CRA n'est jamais un revenu. | `src/external/report.ts`, `src/finance/` |
| A6 | Pas de budget département ni d'enveloppes | Module Budget & Rentabilité du département Helpdesk, enveloppes déplacements et recrutement séparées, hors rentabilité. | `src/finance/`, `components/finance/` |
| A7 | Un seul bâtiment | Trois sites internes (La Ciotat, Montpellier, Paris), mêmes services sauf RH et Stock (La Ciotat). | `src/data/sites.ts`, `layout.ts` |
| A8 | Départements manquants | MCO N2, Formation, Finance, Commercial, Recrutement, Moyens généraux, Déplacements, Réunion ajoutés par site. | `src/data/sites.ts` |
| A9 | CRA et congés figés | Workflows complets (soumission, contrôles, conflits, validation, refus, correction, délégation, historique). | `src/management/` |
| A10 | Réinitialisation partielle | « RÉINITIALISER LA DÉMONSTRATION » : simulation, tickets internes et externes, management, finance, préparation production. | `App.tsx`, `Header.tsx` |
| A11 | Création de ticket impossible | Création simulée dans la source fictive de l'outil du client (refusée sans ITSM). | Cockpit Helpdesk, cockpits clients |
| A12 | Pas de séparation démo / production | `DemoDataProvider` / fournisseur de production conditionné à des prérequis validés ; centre de préparation ; `PRODUCTION_READINESS.md`. | `src/data/provider.ts`, `src/production/` |
| A13 | Libellés obsolètes | Corrigés (« V3.0 — démonstration »). | — |

## 2. Propagation entre modules (démonstration)

- Congé validé → retiré des effectifs prévus du cockpit Helpdesk ; techniciens N2 en congé dans les cockpits clients (charge, capacité).
- CRA validé / rejeté → statut CRA des techniciens N2 dans les cockpits clients ; aucun effet sur les revenus.
- Objectif modifié (Management) → objectifs du cockpit Helpdesk et du cockpit client recalculés.
- Ticket créé, déplacé ou affecté → compteurs, tableau, Kanban et PDG recalculés.
- Déplacement CSM planifié → soumis automatiquement à l'enveloppe déplacements ; bloqué et journalisé si le solde est insuffisant.
- Coût, affectation, prestation ou règle d'imputation modifiés → résultat, marge, prévisions et cockpit PDG recalculés immédiatement.

## 3. Limites de la démonstration

- **Aucune donnée réelle** : collaborateurs (pseudonymes), tickets, coûts employeur, prestations, enveloppes et implantations sont fictifs ; les montants ne doivent pas être interprétés.
- **Aucune persistance** : les actions sont perdues au rechargement (seuls les objectifs des clients externes sont mémorisés dans le navigateur).
- **Droits simulés** : le rôle est choisi dans une liste ; la matrice de droits côté navigateur n'est pas une sécurité. L'« habilitation direction » du plafond déplacements est simulée par le rôle Direction.
- **Connecteurs simulés** : sources ITSM fictives, quirks (doublons, statuts inconnus, versions périmées) volontairement injectés ; transitions et droits d'écriture = hypothèses à confirmer par outil.
- **Règles RH de démonstration** : préavis 7 jours, 15 jours ouvrés maximum, 60 % de présence d'équipe, calendrier unique.
- **Finance** : barème de coût par population, prix de référence N1 et modes de facturation fictifs ; résultat analytique de département, distinct du résultat comptable. Les autres départements ne sont pas modélisés : aucun total entreprise n'est calculé.
- **Téléphonie** : « en communication » ne concerne que le N1 simulé.
- **Préparation à la production** : les changements de statut sont simulés et non enregistrés ; le taux de préparation n'est pas une certification de sécurité.

## 4. Tests

`npm test` couvre notamment : cartographie ITSM et registre, pipeline multi-outils (déduplication, identifiants uniques, statuts source), tickets internes et escalades N1 → N2, consolidation et compteurs, filtres partagés tableau / Kanban, effectifs, congés (jours ouvrés, chevauchements, conflits, délégation), CRA (heures attendues, écarts, transitions, compteurs), rentabilité (formules, statuts de prestation, ETP, affectation partielle, entrées / sorties, contribution par client), enveloppe déplacements (solde, conversion sans double comptage, blocage, plafond), recrutement (règle à confirmer, refus des salaires), synchronisation simulée, préparation à la production (Go / No-Go, preuve obligatoire, rapport), fournisseurs de données (pas de bascule silencieuse), absence de secrets dans le code, parcours d'interface (réinitialisation, propagation congé → effectifs).

## 5. Reprise — instructions pour la suite

1. **Lire** `PRODUCTION_READINESS.md` : les éléments bloquants (backend, SSO, droits serveur, outils ITSM non renseignés) conditionnent tout le reste.
2. **Backend** : exposer une API qui reprend les contrats des fonctions pures existantes (`src/finance/budget.ts`, `src/management/rules.ts`, `src/helpdesk/consolidation.ts`, `src/external/sync.ts`) ; elles sont indépendantes de React et testées, donc transposables côté serveur.
3. **Fournisseur de production** : implémenter les lectures via le backend derrière `src/data/provider.ts` ; ne jamais lire de secret dans le frontend ; garder la démonstration comme valeur par défaut.
4. **Connecteurs ITSM** : pour chaque outil, renseigner le registre (`connectorRegistry`) uniquement avec des valeurs fournies par les clients, faire valider les tables de statuts / priorités, puis remplacer la source fictive par le connecteur serveur.
5. **Organisation** : faire confirmer l'implantation des départements et la répartition des pôles par site (`src/data/sites.ts`, `src/data/layout.ts`), puis l'organigramme (`src/org/`).
6. **RH / Finance** : remplacer le barème fictif par les coûts employeur réels, charger les contrats et la facturation, arbitrer la règle d'imputation du recrutement, fixer l'enveloppe déplacements et les habilitations.
7. **Mettre à jour la liste de contrôle** (`src/production/readiness.ts`) au fil des vérifications réelles — « Validé » uniquement avec une preuve — puis `npm run readiness` pour régénérer `PRODUCTION_READINESS.md`.
8. **Publication** : GitHub Pages reste réservé à la démonstration publique ; la version de production devra être servie derrière l'authentification de l'entreprise.
