// Partes do servidor que nao precisam de socket: config, origem e estatico.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { lerConfig } from '../servidor/config.js';
import { criarVerificadorDeOrigem } from '../servidor/origem.js';
import { criarEstatico } from '../servidor/estatico.js';

const raiz = fileURLToPath(new URL('..', import.meta.url));

test('config: padroes de desenvolvimento e leitura do ambiente', () => {
  const c = lerConfig({});
  assert.equal(c.porta, 3000);
  assert.equal(c.host, '127.0.0.1');
  assert.equal(c.checarOrigem, false);
  assert.ok(c.origens.some((o) => o.includes('poki')));
  const p = lerConfig({ PORT: '8080', HOST: '0.0.0.0', NODE_ENV: 'production', ALLOWED_ORIGINS: 'https://barberbattle.io,https://*.poki.com', SALA_BOTS: 'off', SHARD: 'B!', LOG_LEVEL: 'debug', WS_ORIGIN_CHECK: 'on' });
  assert.equal(p.porta, 8080);
  assert.equal(p.checarOrigem, true);
  assert.deepEqual(p.origens, ['https://barberbattle.io', 'https://*.poki.com']);
  assert.equal(p.bots, 0);
  assert.equal(p.shard, 'b');
});

test('origem: globs da Poki, dominio proprio, localhost com porta; sem origin passa', () => {
  const ok = criarVerificadorDeOrigem(['https://barberbattle.io', 'https://*.poki.com', 'https://*.poki-gdn.com', 'http://127.0.0.1:*']);
  assert.equal(ok('https://barberbattle.io').ok, true);
  assert.equal(ok('https://poki.com').ok, false, 'sem subdominio nao casa com *.poki.com');
  assert.equal(ok('https://games.poki.com').ok, true);
  assert.equal(ok('https://abc.poki-gdn.com/').ok, true);
  assert.equal(ok('https://evil.com').ok, false);
  assert.equal(ok('https://poki.com.evil.com').ok, false);
  assert.equal(ok('http://127.0.0.1:5360').ok, true);
  assert.equal(ok(undefined).ok, true);
});

test('estatico: so index, LICENCAS, src/** e privacidade; nunca servidor/ nem ..', async () => {
  const e = criarEstatico({ raiz, politica: join(raiz, 'servidor/privacidade.html') });
  assert.ok(e.resolver('/').arquivo.endsWith('index.html'));
  assert.ok(e.resolver('/src/main.js').arquivo.endsWith('src/main.js'));
  assert.ok(e.resolver('/privacidade').arquivo.endsWith('privacidade.html'));
  assert.ok(e.resolver('/privacy'));
  assert.equal(e.resolver('/servidor/index.js'), null);
  assert.equal(e.resolver('/src/../servidor/index.js'), null);
  assert.equal(e.resolver('/src/main.mjs'), null);
  assert.equal(e.resolver('/package.json'), null);
  assert.equal(e.resolver('/healthz'), null);
  // resposta real
  const res = { cabecalhos: null, corpo: null, writeHead(c, h) { this.codigo = c; this.cabecalhos = h; }, end(b) { this.corpo = b; } };
  const tratado = await e.servir({ url: '/privacidade', method: 'GET' }, res);
  assert.equal(tratado, true);
  assert.equal(res.codigo, 200);
  assert.ok(String(res.corpo).includes('Barber Battle'));
  const res2 = { writeHead(c) { this.codigo = c; }, end() {} };
  assert.equal(await e.servir({ url: '/nada', method: 'GET' }, res2), false);
});
