// Fronteiras do codigo que a Poki e o projeto cobram (ver CLAUDE.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
/** @param {string} dir @returns {string[]} */
const arquivos = (dir) => (existsSync(dir) ? readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  if (n === 'node_modules') return [];
  return statSync(p).isDirectory() ? arquivos(p) : [p];
}) : []);
const src = arquivos(join(raiz, 'src')).filter((p) => /\.(js|css)$/.test(p));
const servidor = arquivos(join(raiz, 'servidor')).filter((p) => /\.js$/.test(p) && !/\/test\//.test(p));
const ler = (p) => readFileSync(p, 'utf8');
const rel = (p) => relative(raiz, p).split('\\').join('/');
const SDK = 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js';
const URL_RE = /\b(?:https?|wss?):\/\/[^\s"'`)<>]+/g;

test('sem console.log/info/debug no jogo nem no servidor (fora de registro.js)', () => {
  for (const p of src) assert.ok(!/console\.(log|info|debug)\s*\(/.test(ler(p)), rel(p));
  for (const p of servidor) {
    if (rel(p) === 'servidor/registro.js') continue;
    assert.ok(!/console\./.test(ler(p)), rel(p));
  }
});

test('so src/main.js importa o SDK da Poki e a rede', () => {
  for (const p of src) {
    const r = rel(p);
    if (r === 'src/main.js' || r === 'src/core/poki.js') continue;
    assert.ok(!/from\s+['"][^'"]*poki\.js['"]/.test(ler(p)), r);
    if (r === 'src/core/rede.js') continue;
    assert.ok(!/from\s+['"][^'"]*rede\.js['"]/.test(ler(p)), r);
  }
});

test('so o armazenamento toca o localStorage', () => {
  for (const p of src) {
    if (rel(p) === 'src/core/armazenamento.js') continue;
    assert.ok(!/localStorage/.test(ler(p)), rel(p));
  }
});

test('so a depuracao le a URL', () => {
  for (const p of src) {
    if (rel(p) === 'src/core/depuracao.js') continue;
    assert.ok(!/location\.(search|hash)|URLSearchParams/.test(ler(p)), rel(p));
  }
});

test('src/jogo/ e puro: sem Math.random, DOM, relogio nem imports de fora de src/jogo', () => {
  for (const p of src.filter((x) => /src\/jogo\//.test(x))) {
    const t = ler(p);
    assert.ok(!/Math\.random|document\.|window\.|navigator\.|Date\.now|performance\.now|setTimeout|setInterval/.test(t), rel(p));
    for (const m of t.matchAll(/from\s+['"]([^'"]+)['"]/g)) assert.ok(/^\.\/[^/]+\.js$/.test(m[1]), `${rel(p)} importa ${m[1]}`);
  }
});

test('src/ nao importa modelos/, tools/ nem servidor/', () => {
  for (const p of src) assert.ok(!/from\s+['"][^'"]*(modelos|tools|servidor)\//.test(ler(p)), rel(p));
});

test('servidor/ so importa de src/jogo e src/core/motor-sala.js', () => {
  for (const p of servidor) {
    for (const m of ler(p).matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const alvo = m[1];
      if (!/src\//.test(alvo)) continue;
      assert.ok(/src\/jogo\/[^/]+\.js$|src\/core\/motor-sala\.js$|src\/core\/rng\.js$/.test(alvo), `${rel(p)} importa ${alvo}`);
    }
  }
});

test('unicas URLs externas: SDK da Poki (qualquer arquivo), servidor e politica (so config.js), loopback (so depuracao.js)', () => {
  const permitidasConfig = ['wss://barberbattle.io/ws', 'https://barberbattle.io/privacidade'];
  for (const p of [...src, join(raiz, 'index.html')]) {
    const r = rel(p);
    for (const u of ler(p).match(URL_RE) || []) {
      if (u === SDK) continue;
      if (r === 'src/core/config.js' && permitidasConfig.includes(u)) continue;
      if (r === 'src/core/depuracao.js' && /^ws:\/\/127\.0\.0\.1:\d+\/ws$/.test(u)) continue;
      assert.fail(`${r}: ${u}`);
    }
    if (r !== 'src/core/config.js') assert.ok(!/barberbattle\.io/.test(ler(p)) || r === 'src/core/depuracao.js', `${r} conhece o dominio`);
  }
  assert.ok(ler(join(raiz, 'index.html')).includes(SDK));
});

test('so src/core/transporte.js cria WebSocket', () => {
  for (const p of src) {
    if (rel(p) === 'src/core/transporte.js') continue;
    assert.ok(!/new\s+WebSocket\s*\(/.test(ler(p)), rel(p));
  }
});

test('index.html pede viewport-fit=cover', () => {
  assert.ok(/viewport-fit=cover/.test(ler(join(raiz, 'index.html'))));
});
