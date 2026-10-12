# SEATPI ONE — Audit avant V3.0

Audit du code existant (V0.3 / extension V2.3) avant les évolutions V3.0.
Constat effectué sur la branche `claude/new-session-jpz47b`, commit `c28152b`.

## État général

- Stack : React 18, TypeScript strict, Vite 6, React Three Fiber / drei, Vitest + Testing Library. 91 tests au vert, build OK.
- Déploiement : GitHub Pages via GitHub Actions (tests + build avant publication).
- Données : 100 % fictives, aucun appel réseau métier, aucun secret dans le dépôt.
- Volume : ~9 300 lignes TypeScript ; la scène 3D est chargée à la demande (chunk séparé ~870 ko, 234 ko gzip).

## Incohérences et défauts relevés

| # | Domaine | Constat | Gravité | Traitement V3.0 |
|---|---------|---------|---------|-----------------|
| A1 | ITSM | Associations inventées : INVIVO → GLPI, PRIMAGAZ → EasyVista, MONEXT → Jira. Contredit la cartographie de référence (INVIVO → EasyVista, MONEXT → ISILOG, PRIMAGAZ non renseigné). | Bloquant | Registre ITSM unique ; correction des associations ; PRIMAGAZ « ITSM NON RENSEIGNÉ — CONFIGURATION REQUISE ». |
| A2 | ITSM | Les clients du plateau interne (Thelem, IRD, Ortec, Sodiaal, pôle « Multi dédié ») n'ont aucun outil ITSM associé ; DMB, LBR FR, EURAPHARMA, ANGE, HSTV, TRANSGOURMET absents. | Majeur | Clients ajoutés au registre avec leur outil de référence ; outil non renseigné pour IRD, Ortec, Sodiaal. |
| A3 | ITSM | Capacités d'écriture des connecteurs présentées comme des faits (EasyVista en lecture seule…), alors qu'aucun accès n'a été accordé. | Majeur | Capacités marquées « hypothèse de démonstration — à confirmer ». |
| A4 | ITSM | Le statut et la priorité d'origine de l'outil source ne sont pas conservés dans le ticket normalisé. | Majeur | Ajout `sourceStatus` / `sourcePriority`. |
| A5 | Finance | Le chiffre d'affaires client est calculé comme heures planifiées × tarif horaire : le temps de présence (assimilable à un CRA) génère automatiquement du CA. | Bloquant | Remplacé par un registre des prestations (contrats) ; les heures ne servent qu'à la ventilation des coûts. |
| A6 | Finance | Budget rattaché aux clients et à des « centres de coûts » génériques ; aucune vue département Helpdesk ; aucune enveloppe déplacements / recrutement. | Bloquant | Module Budget & Rentabilité du département Helpdesk, enveloppes séparées. |
| A7 | Organisation | Un seul bâtiment (« Siège SEATPI ») ; les sites La Ciotat, Montpellier et Paris n'existent pas. | Bloquant (priorité utilisateur) | Trois sites internes dans la 3D, implantation configurable. |
| A8 | Organisation | Départements manquants : MCO/Support N2 interne, Formation, Finance/Comptabilité, Commercial, Recrutement, Moyens généraux, Déplacements professionnels. | Majeur | Espaces fonctionnels ajoutés. |
| A9 | Management | CRA et congés uniquement affichés (statut figé) ; aucun circuit de validation. | Majeur | Workflows interactifs (soumission, validation, refus, correction, historique, délégation). |
| A10 | Démonstration | « Réinitialiser » ne réinitialise que la simulation du plateau ; les tickets externes et objectifs restent modifiés. | Mineur | Réinitialisation globale de la démonstration. |
| A11 | Démonstration | Création de ticket impossible. | Mineur | Création de ticket simulée. |
| A12 | Production | Aucune séparation explicite démo / production des sources de données ; aucune liste des prérequis. | Majeur | `DemoDataProvider` / `ProductionDataProvider`, centre de préparation, `PRODUCTION_READINESS.md`. |
| A13 | Libellés | Mentions obsolètes (« Prototype interactif V0.2 », « Siège SEATPI »). | Mineur | Corrigées. |

## Points conservés

- Simulation du plateau Helpdesk et pôles clients, scène 3D, mode 2D accessible, droits simulés par rôle.
- Pipeline ITSM : adaptateurs, normalisation, déduplication, identifiant interne unique, calcul SLA en temps ouvré, objectifs, rapports.
- Services Exploitation / CSM et déplacements CSM.
