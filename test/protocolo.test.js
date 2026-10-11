import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validar, decodificar, criarBalde, tomar, criarBaldes, tomarDo, TAXAS, TIPOS_CLIENTE } from '../src/jogo/protocolo.js';
import { VERSAO_PROTOCOLO, LIMITES } from '../src/jogo/constantes.js';

test('entrar exige a versao e aceita os campos opcionais validos', () => {
  assert.equal(validar({ t: 'entrar', v: VERSAO_PROTOCOLO }).ok, true);
  assert.deepEqual(validar({ t: 'entrar', v: 0 }), { ok: false, erro: 'versao' });
  assert.equal(validar({ t: 'entrar', v: 1, sessao: 'a'.repeat(32) }).ok, true);
  assert.equal(validar({ t: 'entrar', v: 1, sessao: 'xyz' }).ok, false);
  assert.equal(validar({ t: 'entrar', v: 1, nome: [1, 2], avatar: { cor: 1, chapeu: 0 }, idioma: 'pt-BR', sala: 'teste-1', bots: 0 }).ok, true);
  assert.equal(validar({ t: 'entrar', v: 1, nome: 'Joao' }).ok, false);
  assert.equal(validar({ t: 'entrar', v: 1, avatar: { cor: 1 } }).ok, false);
});

test('cada tipo valida seus campos e normaliza o resultado', () => {
  assert.deepEqual(validar({ t: 'escolher', opcao: 'jogar' }), { ok: true, msg: { t: 'escolher', opcao: 'jogar' } });
  assert.equal(validar({ t: 'escolher', opcao: 'x' }).ok, false);
  assert.equal(validar({ t: 'ferramenta', id: 'navalha' }).ok, true);
  assert.equal(validar({ t: 'ferramenta', id: 'serra' }).ok, false);
  const tr = validar({ t: 'traco', zona: 'topo', ferramenta: 'tesoura', intensidade: 0.5, seq: 3, extra: 1 });
  assert.deepEqual(tr, { ok: true, msg: { t: 'traco', zona: 'topo', ferramenta: 'tesoura', intensidade: 0.5, precisao: 1, direcao: '', seq: 3 } });
  assert.equal(validar({ t: 'traco', zona: 'topo', ferramenta: 'tesoura', intensidade: 2, seq: 3 }).ok, false);
  assert.equal(validar({ t: 'traco', zona: 'nuca', ferramenta: 'tesoura', intensidade: 1, seq: 3 }).ok, false);
  assert.equal(validar({ t: 'traco', zona: 'topo', ferramenta: 'tesoura', intensidade: 1, seq: -1 }).ok, false);
  assert.equal(validar({ t: 'traco', zona: 'topo', ferramenta: 'pomada', intensidade: 1, direcao: 'cima', seq: 1 }).ok, true);
  assert.equal(validar({ t: 'votar', alvo: 'a-12' }).ok, true);
  assert.equal(validar({ t: 'votar', alvo: 'A B' }).ok, false);
  assert.equal(validar({ t: 'torcer', alvo: 'bot-3' }).ok, true);
  assert.equal(validar({ t: 'reagir', reacao: 7 }).ok, true);
  assert.equal(validar({ t: 'reagir', reacao: 8 }).ok, false);
  assert.equal(validar({ t: 'caos', acao: 'mosca' }).ok, true);
  assert.equal(validar({ t: 'caos', acao: 'raio' }).ok, false);
  assert.equal(validar({ t: 'recompensa', rodada: 3 }).ok, true);
  assert.equal(validar({ t: 'recompensa', rodada: 0 }).ok, false);
  assert.equal(validar({ t: 'ping', id: 1, tc: 123.4 }).ok, true);
  assert.equal(validar({ t: 'anuncio' }).ok, true);
  assert.equal(validar({ t: 'pronto' }).ok, true);
  assert.equal(validar({ t: 'sala' }).ok, false);
  assert.equal(validar(null).ok, false);
  assert.equal(validar([]).ok, false);
});

test('decodificar recusa texto grande e JSON invalido', () => {
  assert.deepEqual(decodificar('{"t":"pronto"}'), { ok: true, msg: { t: 'pronto' } });
  assert.deepEqual(decodificar('{'), { ok: false, erro: 'json' });
  assert.deepEqual(decodificar('x'.repeat(LIMITES.msgMax + 1)), { ok: false, erro: 'tamanho' });
});

test('balde de fichas: capacidade, recarga e recusa', () => {
  let b = criarBalde(2, 1, 0);
  let r = tomar(b, 0); assert.equal(r.ok, true); b = r.balde;
  r = tomar(b, 0); assert.equal(r.ok, true); b = r.balde;
  r = tomar(b, 0); assert.equal(r.ok, false); b = r.balde;
  r = tomar(b, 500); assert.equal(r.ok, false); b = r.balde;
  r = tomar(b, 1000); assert.equal(r.ok, true); b = r.balde;
  r = tomar(b, 100000); assert.equal(r.ok, true);
  assert.ok(r.balde.fichas <= 2);
});

test('baldes por tipo: traco aceita a rajada e depois limita; tipo sem taxa passa', () => {
  let baldes = criarBaldes(0);
  let aceitos = 0;
  for (let i = 0; i < 40; i++) {
    const r = tomarDo(baldes, 'traco', i * 10);
    baldes = r.baldes;
    if (r.ok) aceitos++;
  }
  assert.ok(aceitos >= TAXAS.traco[0] && aceitos < 40, `aceitos ${aceitos}`);
  assert.equal(tomarDo(baldes, 'inexistente', 0).ok, true);
  for (const t of TIPOS_CLIENTE) assert.ok(TAXAS[t], `sem taxa para ${t}`);
});
