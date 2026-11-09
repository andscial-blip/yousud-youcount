// Stampa l'insieme dei dati dimostrativi (JSON) per l'anno indicato: lo usano i test e l'anteprima locale.
// Uso: node --experimental-strip-types --no-warnings scripts/demo-payload.mjs 2026
import { buildDemo } from '../src/lib/demo/build.ts';
process.stdout.write(JSON.stringify(buildDemo(Number(process.argv[2]) || new Date().getFullYear())));
