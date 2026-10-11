// Arquivos estaticos com lista branca: o jogo (index.html, LICENCAS.txt, src/**)
// e a politica de privacidade. Nunca serve o proprio servidor nem nada fora da raiz.
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
};
const PERMITIDAS_SRC = new Set(['.js', '.css', '.woff2', '.png', '.svg', '.json']);

/**
 * @param {{ raiz: string, politica: string }} p   raiz do jogo e caminho da politica (html)
 */
export function criarEstatico({ raiz, politica }) {
  const base = resolve(raiz);
  /**
   * @param {string} caminhoUrl
   * @returns {{ arquivo: string, tipo: string, cache: string } | null}
   */
  function resolver(caminhoUrl) {
    let c;
    try { c = decodeURIComponent((caminhoUrl || '/').split('?')[0]); } catch { return null; }
    if (c === '/' || c === '/index.html') return { arquivo: join(base, 'index.html'), tipo: TIPOS['.html'], cache: 'no-cache' };
    if (c === '/privacidade' || c === '/privacy' || c === '/privacidade.html') return { arquivo: politica, tipo: TIPOS['.html'], cache: 'public, max-age=300' };
    if (c === '/LICENCAS.txt') return { arquivo: join(base, 'LICENCAS.txt'), tipo: TIPOS['.txt'], cache: 'public, max-age=300' };
    if (c.startsWith('/src/')) {
      const ext = extname(c);
      if (!PERMITIDAS_SRC.has(ext)) return null;
      const arquivo = normalize(join(base, c));
      if (!arquivo.startsWith(base + sep) || c.includes('..')) return null;
      return { arquivo, tipo: TIPOS[ext] || 'application/octet-stream', cache: 'public, max-age=300' };
    }
    return null;
  }

  /**
   * Responde se o caminho estiver na lista; devolve false se nao for estatico.
   * @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res
   */
  async function servir(req, res) {
    const alvo = resolver(req.url || '/');
    if (!alvo) return false;
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return true; }
    try {
      const info = await stat(alvo.arquivo);
      if (!info.isFile()) throw new Error('nao e arquivo');
      const corpo = await readFile(alvo.arquivo);
      res.writeHead(200, { 'content-type': alvo.tipo, 'cache-control': alvo.cache, 'x-content-type-options': 'nosniff', 'content-length': corpo.length });
      res.end(req.method === 'HEAD' ? undefined : corpo);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('404');
    }
    return true;
  }
  return { resolver, servir };
}
