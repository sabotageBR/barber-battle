import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ADJETIVOS, SUBSTANTIVOS, LINGUAS, nomeValido, sortearNome, textoNome, avatarValido, avatarPermitido, sortearAvatar } from '../src/jogo/nomes.js';
import { CHAPEUS } from '../src/jogo/constantes.js';
import { criarRng } from '../src/core/rng.js';

test('listas alinhadas nas tres linguas, com pelo menos 24 entradas e sem repeticao', () => {
  assert.deepEqual(LINGUAS, ['en', 'pt', 'es']);
  for (const l of LINGUAS) {
    assert.equal(ADJETIVOS[l].length, ADJETIVOS.en.length);
    assert.equal(SUBSTANTIVOS[l].length, SUBSTANTIVOS.en.length);
    assert.equal(new Set(SUBSTANTIVOS[l]).size, SUBSTANTIVOS[l].length, l);
  }
  assert.ok(ADJETIVOS.en.length >= 24 && SUBSTANTIVOS.en.length >= 24);
});

test('sorteio deterministico e valido; texto na ordem de cada lingua', () => {
  const r = criarRng(42);
  const n = sortearNome(r);
  assert.ok(nomeValido(n));
  assert.deepEqual(sortearNome(criarRng(42)), n);
  assert.equal(textoNome([0, 0], 'en'), 'Swift Comb');
  assert.equal(textoNome([0, 0], 'pt'), 'Pente Veloz');
  assert.equal(textoNome([0, 0], 'es'), 'Peine Veloz');
  assert.equal(textoNome([0, 0], 'fr'), 'Swift Comb');
  assert.equal(textoNome([99, 0], 'en'), '');
  assert.ok(!nomeValido([0]));
  assert.ok(!nomeValido('Swift Comb'));
});

test('avatar: chapeu so com as vitorias; invalido cai no padrao', () => {
  assert.ok(avatarValido({ cor: 0, chapeu: 0 }));
  assert.ok(!avatarValido({ cor: 99, chapeu: 0 }));
  const coroa = CHAPEUS.findIndex((c) => c.id === 'coroa');
  assert.deepEqual(avatarPermitido({ cor: 3, chapeu: coroa }, 2), { cor: 3, chapeu: 0 });
  assert.deepEqual(avatarPermitido({ cor: 3, chapeu: coroa }, 5), { cor: 3, chapeu: coroa });
  assert.deepEqual(avatarPermitido(null, 5), { cor: 0, chapeu: 0 });
  assert.ok(avatarValido(sortearAvatar(criarRng(3))));
});
