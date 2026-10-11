// Fumaca de ponta a ponta em tempo real: um Chrome headless (CDP) com N paginas do jogo
// contra um servidor de verdade. Cada pagina entra, escolhe Jogar, corta (eventos de ponteiro
// reais no canvas) e espera o resultado. Imprime o estado de cada uma e sai 0 se todas
// viram a mesma rodada terminar.
// Uso: node tools/dois-clientes.mjs [url=http://barberbattle.io/] [paginas=2] [segundos=240]
//   HOSTS="MAP barberbattle.io 192.168.12.50"  mapeia o dominio sem depender do DNS do Chrome
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2] || 'http://barberbattle.io/';
const N = Number(process.argv[3]) || 2;
const LIMITE = (Number(process.argv[4]) || 240) * 1000;
const porta = 9300 + Math.floor(Math.random() * 300);
const perfil = mkdtempSync(join(tmpdir(), 'bb-cdp-'));
const args = ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  `--remote-debugging-port=${porta}`, `--user-data-dir=${perfil}`, '--window-size=844,560', '--autoplay-policy=no-user-gesture-required'];
if (process.env.HOSTS) args.push(`--host-resolver-rules=${process.env.HOSTS}`);
args.push('about:blank');
const chrome = spawn('google-chrome', args, { stdio: 'ignore' });
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const sair = async (codigo) => {
  try { chrome.kill('SIGKILL'); } catch { /* ignora */ }
  // o Chrome ainda escreve no perfil por um instante
  for (let i = 0; i < 10; i++) { try { await espera(300); rmSync(perfil, { recursive: true, force: true }); break; } catch { /* tenta de novo */ } }
  process.exit(codigo);
};

async function versao() {
  for (let i = 0; i < 50; i++) {
    try { return await (await fetch(`http://127.0.0.1:${porta}/json/version`)).json(); } catch { await espera(200); }
  }
  throw new Error('Chrome nao abriu a porta de depuracao');
}

/** Pagina controlada por CDP: avaliar(expr) devolve o valor JSON. */
async function abrirPagina(alvo) {
  const info = await (await fetch(`http://127.0.0.1:${porta}/json/new?${encodeURIComponent(alvo)}`, { method: 'PUT' })).json();
  const ws = new WebSocket(info.webSocketDebuggerUrl);
  await new Promise((ok, falha) => { ws.onopen = ok; ws.onerror = () => falha(new Error('cdp')); });
  let id = 0;
  const pendentes = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pendentes.has(m.id)) { pendentes.get(m.id)(m); pendentes.delete(m.id); } };
  const chamar = (method, params = {}) => new Promise((ok) => { id += 1; pendentes.set(id, ok); ws.send(JSON.stringify({ id, method, params })); });
  await chamar('Runtime.enable');
  const avaliar = async (expressao) => {
    const r = await chamar('Runtime.evaluate', { expression: expressao, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text + ' ' + (r.result.exceptionDetails.exception || {}).description);
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  return { id: info.id, avaliar, fechar: () => ws.close() };
}

const ESTADO = "JSON.parse(document.body.dataset.estado || '{}')";
const CORTAR = `(() => {
  const p = document.getElementById('podioA').getBoundingClientRect();
  const cv = document.getElementById('cena');
  const cx = p.left + p.width * 0.27, cy = p.top + p.height * 0.5;
  const ev = (t, x, y) => cv.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', bubbles: true }));
  for (const dy of [-0.12, 0.05, 0.18]) {
    const y = cy + p.height * dy;
    ev('pointerdown', cx - 14, y);
    for (let i = 1; i <= 8; i++) ev('pointermove', cx - 14 + i * 4, y + (i % 2 ? 1 : -1));
    ev('pointerup', cx + 18, y);
  }
  return true;
})()`;

async function ate(pag, cond, ms, rotulo) {
  const fim = Date.now() + ms;
  let e = {};
  while (Date.now() < fim) {
    e = (await pag.avaliar(ESTADO)) || {};
    if (cond(e)) return e;
    await espera(250);
  }
  const titulo = await pag.avaliar('document.title');
  throw new Error(`${rotulo}: esperava ${cond.toString().slice(0, 60)}... titulo=${titulo} estado=${JSON.stringify(e)}`);
}

try {
  const v = await versao();
  process.stdout.write(`chrome ${v.Browser} em ${porta}; ${N} paginas em ${url}\n`);
  const paginas = [];
  for (let i = 0; i < N; i++) { paginas.push(await abrirPagina(url)); await espera(300); }
  const t0 = Date.now();
  // todas online e no saguao
  for (const [i, pag] of paginas.entries()) {
    const e = await ate(pag, (x) => x.rede === 'remota' && x.estado && x.estado !== '', 15000, `pagina ${i} conectar`);
    process.stdout.write(`pagina ${i}: ${e.rede} estado=${e.estado} jogadores=${e.jogadores}\n`);
  }
  for (const pag of paginas) if ((await pag.avaliar(ESTADO)).estado === 'saguao') await pag.avaliar("document.getElementById('bJogar').click(); true");
  // rodada: quem esta na cadeira corta ate o fim
  for (const [i, pag] of paginas.entries()) await ate(pag, (x) => x.estado === 'rodada', 45000, `pagina ${i} rodada`);
  let cortes = 0;
  for (;;) {
    let alguem = false;
    for (const pag of paginas) {
      const e = await pag.avaliar(ESTADO);
      if (e.estado === 'rodada') { alguem = true; if (e.papel === 'barbeiro') { await pag.avaliar(CORTAR); cortes++; } else if (!pag.avisou) { pag.avisou = true; process.stdout.write(`  (pagina espectadora na rodada: cadeiras=${JSON.stringify(e.cadeiras)} tracos=${e.tracos} cabelo=${e.cabelo} ${((Date.now() - t0) / 1000).toFixed(1)} s)\n`); } }
    }
    if (!alguem || Date.now() - t0 > LIMITE) break;
    await espera(600);
  }
  const finais = [];
  for (const [i, pag] of paginas.entries()) {
    const e = await ate(pag, (x) => x.estado === 'resultado' || x.estado === 'transicao' || x.estado === 'saguao', 60000, `pagina ${i} resultado`);
    finais.push(e);
    process.stdout.write(`pagina ${i}: papel=${e.papel} estado=${e.estado} rodada=${e.rodada} pontos=${e.pontos} cabelo=${e.cabelo} barba=${e.barba} tracos=${e.tracos} cadeiras=${JSON.stringify(e.cadeiras)} conexao=${e.conexao}\n`);
  }
  process.stdout.write(`${cortes} rajadas de corte; ${((Date.now() - t0) / 1000).toFixed(0)} s\n`);
  const ok = finais.every((e) => e.rodada >= 1) && finais.some((e) => e.pontos > 0) && new Set(finais.map((e) => e.rodada)).size === 1;
  for (const pag of paginas) pag.fechar();
  process.stdout.write(ok ? 'OK: a rodada terminou para todos e alguem pontuou\n' : 'FALHOU: ver estados acima\n');
  await sair(ok ? 0 : 1);
} catch (e) {
  process.stdout.write(`erro: ${e.message}\n`);
  await sair(1);
}
