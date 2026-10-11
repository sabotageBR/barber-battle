import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEXTOS, LINGUAS, escolherIdioma } from '../src/i18n/textos.js';
import { REACOES, CHAPEUS } from '../src/jogo/constantes.js';
import { TEMAS } from '../src/jogo/temas.js';
import { IDS_FERRAMENTAS } from '../src/jogo/ferramentas.js';

const chaves = (o, prefixo = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? chaves(v, `${prefixo}${k}.`) : [`${prefixo}${k}`]));

test('as tres linguas tem as mesmas chaves, temas, ferramentas, reacoes e chapeus', () => {
  const base = chaves(TEXTOS.en).sort();
  for (const l of LINGUAS) {
    assert.deepEqual(chaves(TEXTOS[l]).sort(), base, l);
    for (const t of TEMAS) assert.ok(TEXTOS[l].temas[t.id], `${l}: tema ${t.id}`);
    for (const f of IDS_FERRAMENTAS) assert.ok(TEXTOS[l].ferramentas[f], `${l}: ferramenta ${f}`);
    assert.equal(TEXTOS[l].reacoes.length, REACOES.length, l);
    assert.equal(TEXTOS[l].chapeus.length, CHAPEUS.length, l);
    assert.equal(typeof TEXTOS[l].vitoriasPara(3), 'string');
  }
});

test('escolha de idioma: parametro, perfil, Poki, navegador, e ingles no fim', () => {
  assert.equal(escolherIdioma({ lang: 'pt' }, 'es', 'en', ['fr']), 'pt');
  assert.equal(escolherIdioma({}, 'es', 'en', ['fr']), 'es');
  assert.equal(escolherIdioma({}, '', 'pt', ['fr']), 'pt');
  assert.equal(escolherIdioma({}, '', '', ['fr-FR', 'pt-BR']), 'pt');
  assert.equal(escolherIdioma({}, '', '', ['fr']), 'en');
  assert.equal(escolherIdioma({ lang: 'xx' }, '', '', []), 'en');
});
