// Servidor do Barber Battle: http (/healthz, estatico, /privacidade) + WebSocket em /ws.
// Unico modulo que importa `ws`.
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { WebSocketServer } from 'ws';
import { lerConfig } from './config.js';
import { criarRegistro } from './registro.js';
import { criarVerificadorDeOrigem } from './origem.js';
import { criarEstatico } from './estatico.js';
import { criarRelogio } from './relogio.js';
import { criarGerente } from './salas.js';
import { criarConexao } from './conexao.js';
import { LIMITES } from '../src/jogo/constantes.js';

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const RAIZ = join(AQUI, '..');

/**
 * Sobe o servidor. Devolve { porta, fechar }.
 * @param {Partial<ReturnType<typeof lerConfig>>} [sobrescrever]
 */
export async function iniciar(sobrescrever = {}) {
  const config = { ...lerConfig(), ...sobrescrever };
  const log = criarRegistro(config.logLevel);
  const relogio = criarRelogio();
  const origemOk = criarVerificadorDeOrigem(config.origens);
  const estatico = criarEstatico({ raiz: RAIZ, politica: join(AQUI, 'privacidade.html') });
  const gerente = criarGerente({ config, relogio, log });
  /** @type {Map<string, number>} */
  const porIp = new Map();
  let sockets = 0;
  const inicioEm = Date.now();

  const http = createServer(async (req, res) => {
    if (req.url === '/healthz' || req.url === '/healthz/') {
      const e = gerente.estatisticas();
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify({ ok: true, ...e, uptime: Math.round((Date.now() - inicioEm) / 1000), shard: config.shard, versao: 1, rssMb: Math.round(process.memoryUsage().rss / 1048576) }));
      return;
    }
    if (config.estatico && await estatico.servir(req, res)) return;
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404');
  });

  const wss = new WebSocketServer({ noServer: true, maxPayload: LIMITES.msgMax, perMessageDeflate: false });
  http.on('upgrade', (req, socket, head) => {
    const url = req.url || '';
    const caminho = url.split('?')[0];
    if (!(caminho === '/ws' || caminho === `/ws/${config.shard}`)) { socket.write('HTTP/1.1 404 Not Found\r\n\r\n'); socket.destroy(); return; }
    const o = origemOk(req.headers.origin);
    if (config.checarOrigem && !o.ok) { log.aviso('origem recusada', { origem: req.headers.origin }); socket.write('HTTP/1.1 403 Forbidden\r\n\r\n'); socket.destroy(); return; }
    if (!req.headers.origin) log.debug('upgrade sem origin', { ip: req.socket.remoteAddress });
    const ip = (config.trustProxy && String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?';
    if (sockets >= config.maxSockets || (porIp.get(ip) || 0) >= config.maxPorIp) { socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n'); socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => {
      sockets += 1;
      porIp.set(ip, (porIp.get(ip) || 0) + 1);
      criarConexao({
        ws, gerente, relogio, log, ip, caminho,
        aoFechar: () => { sockets -= 1; porIp.set(ip, Math.max(0, (porIp.get(ip) || 1) - 1)); },
      });
    });
  });

  await new Promise((ok, falha) => { http.once('error', falha); http.listen(config.porta, config.host, () => ok(null)); });
  const porta = /** @type {any} */ (http.address()).port;
  log.info('servidor no ar', { host: config.host, porta, shard: config.shard, bots: config.bots, origens: config.origens.length, checarOrigem: config.checarOrigem });

  let fechando = false;
  async function fechar() {
    if (fechando) return;
    fechando = true;
    log.info('encerrando', { sockets });
    gerente.pararTudo();
    for (const c of wss.clients) { try { c.close(1012); } catch { /* ignora */ } }
    await new Promise((ok) => { http.close(() => ok(null)); setTimeout(ok, config.encerramentoMs); });
  }
  return { porta, fechar, gerente, config };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const s = await iniciar();
  const sair = async () => { await s.fechar(); process.exit(0); };
  process.on('SIGTERM', sair);
  process.on('SIGINT', sair);
}
