import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fallback = 'http://127.0.0.1:8001';
const raw = (process.env.API_URL || process.env.NG_APP_API_URL || '').trim();

if (!raw && process.env.VERCEL) {
  console.error(
    'Falta API_URL. En Vercel define la URL pública de Django, por ejemplo https://tu-servicio.onrender.com',
  );
  process.exit(1);
}

const base = (raw || fallback).replace(/\/+$/, '');
const apiUrl = base.endsWith('/api') ? `${base}/` : `${base}/api/`;
const safe = apiUrl.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
const file = join(dirname(fileURLToPath(import.meta.url)), '../src/environments/environment.prod.ts');

writeFileSync(
  file,
  `// Generado por scripts/set-api-url.mjs a partir de API_URL.\nexport const environment = {\n  apiUrl: '${safe}',\n};\n`,
);

console.log(`API de producción: ${apiUrl}`);
