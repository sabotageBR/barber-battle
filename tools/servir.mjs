// Servidor estatico minimo (sem dependencias) para as ferramentas de teste.
// Uso direto: node tools/servir.mjs [porta]  (padrao 5360, so 127.0.0.1)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml',
};

/** @param {number} porta @returns {Promise<() => Promise<void>>} fecha o servidor */
export function servir(porta) {
  const srv = createServer(async (req, res) => {
    try {
      const caminho = decodeURIComponent(new URL(req.url || '/', 'http://x').pathname);
      let arq = normalize(join(RAIZ, caminho));
      if (!arq.startsWith(resolve(RAIZ))) throw new Error('fora');
      if ((await stat(arq)).isDirectory()) arq = join(arq, 'index.html');
      const corpo = await readFile(arq);
      res.writeHead(200, { 'content-type': TIPOS[extname(arq)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(corpo);
    } catch {
      res.writeHead(404);
      res.end('404');
    }
  });
  return new Promise((ok, falha) => {
    srv.once('error', falha);
    srv.listen(porta, '127.0.0.1', () => ok(() => new Promise((r) => srv.close(() => r()))));
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const porta = Number(process.argv[2]) || 5360;
  await servir(porta);
  process.stdout.write(`Barber Battle em http://127.0.0.1:${porta}/\n`);
}
