// Régénère PRODUCTION_READINESS.md à partir de la liste de contrôle de l'application
// (même source que ADMINISTRATION → PRÉPARATION À LA PRODUCTION). Usage : npm run readiness
import { writeFileSync } from 'node:fs';
import { READINESS_ITEMS, reportMarkdown } from '../src/production/readiness';

const date = new Date().toLocaleDateString('fr-FR');
const intro = `${reportMarkdown(READINESS_ITEMS, date)}
## Comment utiliser ce document

- La même liste est consultable et modifiable (en simulation) dans l’application : rail de gauche → **Préparation à la production**.
- Un élément ne passe à **Validé** qu’après une vérification réelle, décrite dans la colonne « Dernière vérification » (preuve).
- Après mise à jour de \`src/production/readiness.ts\`, régénérer ce fichier avec \`npm run readiness\` ; un test vérifie que chaque élément y figure.
`;
writeFileSync(new URL('../PRODUCTION_READINESS.md', import.meta.url), intro);
console.log('PRODUCTION_READINESS.md régénéré');
