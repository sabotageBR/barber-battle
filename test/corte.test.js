// Formulas do corte: efeito das ferramentas, combo, precisao, pomada, qualidade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarCliente, aplicarTraco, progresso, proximidade, ligarTurbo, resumirCliente } from '../src/jogo/corte.js';
import { temaPorId, TEMAS, sortearTema } from '../src/jogo/temas.js';
import { FERRAMENTAS, ferramentaPorId } from '../src/jogo/ferramentas.js';
import { ZONAS, COMBO } from '../src/jogo/constantes.js';
import { criarRng } from '../src/core/rng.js';

const lenhador = temaPorId('lenhador');
const executivo = temaPorId('executivo');
const festa = temaPorId('festa');
const militar = temaPorId('militar');

/**
 * Aplica tracos espacados (300 ms) na zona ate o comprimento chegar ao alvo, como um
 * barbeiro cuidadoso: intensidade proporcional ao que falta e, no fim, a ferramenta
 * mais fina do dominio (tesoura ou navalha) para nao passar do alvo.
 */
function cortarAte(c, zona, ferramenta, alvo, tema, t0 = 0, punir = false) {
  let t = t0;
  const barba = ['bochechas', 'queixo', 'bigode'].includes(zona);
  const fina = barba ? 'navalha' : 'tesoura';
  const delta = (f) => Math.abs(ferramentaPorId(f).comp) * (ferramentaPorId(f).bonusZona[zona] || 1);
  const eventos = [];
  for (let i = 0; i < 80 && c.zonas[zona].comp > alvo + 0.005; i++) {
    const falta = c.zonas[zona].comp - alvo;
    const f = falta < 0.15 * delta(ferramenta) ? fina : ferramenta;
    if (falta < 0.15 * delta(f)) break;
    const intensidade = Math.min(1, Math.max(0.15, falta / delta(f)));
    const r = aplicarTraco(c, { zona, ferramenta: f, intensidade, precisao: 1, t }, tema, { punir });
    c = r.cliente;
    eventos.push(...r.eventos);
    t += 300;
  }
  return { c, t, eventos };
}

function congelado(obj) {
  return JSON.parse(JSON.stringify(obj));
}

test('cliente novo chega com todas as zonas compridas e sem forma', () => {
  const c = criarCliente('tonhao');
  for (const z of ZONAS) assert.deepEqual(c.zonas[z], { comp: 1, forma: 0 });
  assert.equal(c.brilho, 0);
  const r = criarRng(7);
  const d = criarCliente('ze', r);
  for (const z of ZONAS) assert.ok(d.zonas[z].comp >= 0.85 && d.zonas[z].comp <= 1);
});

test('temas e ferramentas tem ids unicos e tabelas completas', () => {
  assert.equal(new Set(TEMAS.map((t) => t.id)).size, TEMAS.length);
  for (const t of TEMAS) {
    for (const z of ZONAS) assert.ok(typeof t.alvo[z] === 'number', `${t.id} sem alvo para ${z}`);
    assert.ok(Math.abs(t.foco.cabelo + t.foco.barba - 1) < 1e-9, `${t.id} foco nao soma 1`);
  }
  assert.equal(new Set(FERRAMENTAS.map((f) => f.id)).size, FERRAMENTAS.length);
  const r = criarRng(1);
  for (let i = 0; i < 20; i++) assert.notEqual(sortearTema(r, 'festa').id, 'festa');
});

test('aplicarTraco nunca muda o cliente de entrada', () => {
  const c = criarCliente('tonhao');
  const antes = congelado(c);
  aplicarTraco(c, { zona: 'topo', ferramenta: 'tesoura', intensidade: 1, t: 100 }, lenhador);
  aplicarTraco(c, { zona: 'queixo', ferramenta: 'maquina', intensidade: 1, t: 200 }, lenhador);
  assert.deepEqual(congelado(c), antes);
});

test('tesoura corta o cabelo e da um pouco de forma; maquina rende mais nos lados', () => {
  const c = criarCliente('tonhao');
  const a = aplicarTraco(c, { zona: 'topo', ferramenta: 'tesoura', intensidade: 1, t: 0 }, lenhador);
  assert.ok(Math.abs(a.cliente.zonas.topo.comp - 0.9) < 1e-9);
  assert.ok(Math.abs(a.cliente.zonas.topo.forma - 0.04) < 1e-9);
  assert.equal(a.eventos[0].tipo, 'traco');
  const b = aplicarTraco(c, { zona: 'lados', ferramenta: 'maquina', intensidade: 1, t: 0 }, lenhador);
  assert.ok(Math.abs(b.cliente.zonas.lados.comp - (1 - 0.18 * 1.3)) < 1e-9);
  const d = aplicarTraco(c, { zona: 'topo', ferramenta: 'maquina', intensidade: 1, t: 0 }, lenhador);
  assert.ok(Math.abs(d.cliente.zonas.topo.comp - 0.82) < 1e-9);
});

test('ferramenta errada na zona e so um ops: nada muda, e so pune depois das primeiras rodadas', () => {
  const c = criarCliente('tonhao');
  const a = aplicarTraco(c, { zona: 'queixo', ferramenta: 'maquina', intensidade: 1, t: 0 }, lenhador);
  assert.deepEqual(a.cliente.zonas.queixo, { comp: 1, forma: 0 });
  assert.equal(a.eventos[0].tipo, 'oops');
  assert.equal(a.cliente.oops, 1);
  assert.equal(a.cliente.erros, 0);
  const b = aplicarTraco(c, { zona: 'queixo', ferramenta: 'maquina', intensidade: 1, t: 0 }, lenhador, { punir: true });
  assert.equal(b.cliente.erros, 1);
  assert.ok(progresso(b.cliente, lenhador).qualidade < progresso(c, lenhador).qualidade);
});

test('navalha: precisao alta e perfeito, baixa da curativo (so punindo, no maximo 3)', () => {
  let c = criarCliente('tonhao');
  const a = aplicarTraco(c, { zona: 'bochechas', ferramenta: 'navalha', intensidade: 1, precisao: 0.9, t: 0 }, lenhador);
  assert.ok(a.eventos.some((e) => e.tipo === 'perfeito'));
  assert.ok(Math.abs(a.cliente.zonas.bochechas.forma - 0.1 * 0.9) < 1e-9);
  const semPunir = aplicarTraco(c, { zona: 'bochechas', ferramenta: 'navalha', intensidade: 1, precisao: 0.1, t: 0 }, lenhador);
  assert.equal(semPunir.cliente.curativos, 0);
  for (let i = 0; i < 5; i++) c = aplicarTraco(c, { zona: 'bochechas', ferramenta: 'navalha', intensidade: 0.3, precisao: 0.1, t: i * 400 }, lenhador, { punir: true }).cliente;
  assert.equal(c.curativos, 3);
});

test('esfregar nao compensa: segundo traco na mesma zona em menos de 250 ms rende metade', () => {
  const c = criarCliente('tonhao');
  const a = aplicarTraco(c, { zona: 'topo', ferramenta: 'tesoura', intensidade: 1, t: 0 }, lenhador).cliente;
  const rapido = aplicarTraco(a, { zona: 'topo', ferramenta: 'tesoura', intensidade: 1, t: 100 }, lenhador).cliente;
  const lento = aplicarTraco(a, { zona: 'topo', ferramenta: 'tesoura', intensidade: 1, t: 400 }, lenhador).cliente;
  assert.ok(Math.abs((a.zonas.topo.comp - rapido.zonas.topo.comp) * 2 - (a.zonas.topo.comp - lento.zonas.topo.comp)) < 1e-9);
});

test('combo: 5 tracos certos seguidos ligam o bonus; errar zera', () => {
  let c = criarCliente('tonhao');
  let comboEvento = null;
  for (let i = 0; i < 5; i++) {
    const r = aplicarTraco(c, { zona: ['topo', 'lados', 'franja'][i % 3], ferramenta: 'tesoura', intensidade: 0.3, t: i * 500 }, festa);
    c = r.cliente;
    comboEvento = r.eventos.find((e) => e.tipo === 'combo') || comboEvento;
  }
  assert.equal(c.combo, COMBO.limiar);
  assert.ok(comboEvento && comboEvento.n === COMBO.limiar);
  const semBonus = aplicarTraco({ ...c, combo: 0 }, { zona: 'topo', ferramenta: 'tesoura', intensidade: 0.5, t: 2600 }, festa).cliente;
  const comBonus = aplicarTraco(c, { zona: 'topo', ferramenta: 'tesoura', intensidade: 0.5, t: 2600 }, festa).cliente;
  assert.ok(c.zonas.topo.comp - comBonus.zonas.topo.comp > c.zonas.topo.comp - semBonus.zonas.topo.comp);
  // perto do alvo o bonus nao empurra alem dele
  const perto = { ...c, zonas: { ...c.zonas, topo: { comp: festa.alvo.topo + 0.03, forma: 0 } } };
  const r = aplicarTraco(perto, { zona: 'topo', ferramenta: 'tesoura', intensidade: 0.3, t: 2600 }, festa).cliente;
  assert.ok(r.zonas.topo.comp >= festa.alvo.topo - 1e-9, `passou do alvo: ${r.zonas.topo.comp}`);
  const errou = aplicarTraco(c, { zona: 'queixo', ferramenta: 'maquina', intensidade: 1, t: 2600 }, festa).cliente;
  assert.equal(errou.combo, 0);
  const tardio = aplicarTraco(c, { zona: 'topo', ferramenta: 'tesoura', intensidade: 0.3, t: 2000 + COMBO.janelaMs + 1000 }, festa).cliente;
  assert.equal(tardio.combo, 1);
});

test('passar do alvo e excesso: avisa, zera o combo e custa mais na qualidade', () => {
  let c = criarCliente('tonhao');
  ({ c } = cortarAte(c, 'lados', 'maquina', lenhador.alvo.lados, lenhador));
  const r = cortarAte({ ...c, combo: 4 }, 'lados', 'maquina', 0, lenhador, 10000);
  assert.equal(r.c.combo, 0);
  assert.ok(r.eventos.some((e) => e.tipo === 'excesso'));
  const acima = { ...criarCliente('tonhao') };
  acima.zonas = { ...acima.zonas, topo: { comp: 0.65, forma: 0.5 } };
  const abaixo = { ...criarCliente('tonhao') };
  abaixo.zonas = { ...abaixo.zonas, topo: { comp: 0.45, forma: 0.5 } };
  // lenhador topo = 0,55: 0,10 acima custa menos que 0,10 abaixo
  assert.ok(proximidade(acima.zonas.topo, 0.55, 1) > proximidade(abaixo.zonas.topo, 0.55, 1));
});

test('zonaPronta dispara uma vez ao cruzar proximidade e forma', () => {
  let c = criarCliente('tonhao');
  let t = 0;
  const corte = cortarAte(c, 'topo', 'tesoura', executivo.alvo.topo, executivo);
  c = corte.c;
  t = corte.t;
  let prontas = corte.eventos.filter((e) => e.tipo === 'zonaPronta').length;
  for (let i = 0; i < 8; i++) {
    const r = aplicarTraco(c, { zona: 'topo', ferramenta: 'pente', intensidade: 1, t }, executivo);
    c = r.cliente;
    prontas += r.eventos.filter((e) => e.tipo === 'zonaPronta').length;
    t += 300;
  }
  assert.equal(prontas, 1);
});

test('pomada so pega com o cabelo pronto e da brilho; deslizar para cima arruma o topete', () => {
  let c = criarCliente('kaique');
  const cedo = aplicarTraco(c, { zona: 'topo', ferramenta: 'pomada', intensidade: 1, t: 0 }, festa);
  assert.equal(cedo.eventos[0].tipo, 'pomadaCedo');
  assert.equal(cedo.cliente.brilho, 0);
  let t = 0;
  for (const z of ['topo', 'lados', 'franja']) {
    ({ c, t } = cortarAte(c, z, z === 'lados' ? 'maquina' : 'tesoura', festa.alvo[z], festa, t));
    for (let i = 0; i < 4; i++) { c = aplicarTraco(c, { zona: z, ferramenta: 'pente', intensidade: 1, t }, festa).cliente; t += 300; }
  }
  assert.ok(progresso(c, festa).cabelo >= 60, `cabelo ${progresso(c, festa).cabelo}`);
  const formaAntes = c.zonas.topo.forma;
  const ok = aplicarTraco(c, { zona: 'topo', ferramenta: 'pomada', intensidade: 1, direcao: 'cima', t }, festa);
  assert.equal(ok.eventos[0].tipo, 'pomada');
  assert.ok(Math.abs(ok.cliente.brilho - 0.25) < 1e-9);
  assert.ok(ok.cliente.zonas.topo.forma > formaAntes);
  assert.ok(progresso(ok.cliente, festa).qualidade > progresso(c, festa).qualidade);
});

test('qualidade: lenhador sem tocar a barba fica em 25..40; maquina em tudo fica abaixo de 40', () => {
  const c = criarCliente('tonhao');
  const p = progresso(c, lenhador);
  assert.ok(p.barba >= 25 && p.barba <= 40, `barba ${p.barba}`);
  let d = c;
  let t = 0;
  for (const z of ZONAS) ({ c: d, t } = cortarAte(d, z, 'maquina', 0, lenhador, t));
  assert.ok(progresso(d, lenhador).qualidade < 40, `qualidade ${progresso(d, lenhador).qualidade}`);
});

test('uma sequencia certa chega a 80 ou mais em todos os temas', () => {
  for (const tema of TEMAS) {
    let c = criarCliente('tonhao');
    let t = 0;
    for (const z of ZONAS) {
      const barba = ['bochechas', 'queixo', 'bigode'].includes(z);
      ({ c, t } = cortarAte(c, z, barba ? 'navalha' : z === 'lados' ? 'maquina' : 'tesoura', tema.alvo[z], tema, t));
      for (let i = 0; i < 6; i++) {
        c = aplicarTraco(c, { zona: z, ferramenta: 'pente', intensidade: 1, t }, tema).cliente;
        t += 300;
      }
    }
    const p = progresso(c, tema);
    assert.ok(p.qualidade >= 80 && p.qualidade <= 100, `${tema.id}: ${p.qualidade}`);
  }
});

test('militar e mais rigoroso que festa com o mesmo erro', () => {
  const zona = { comp: 0.3, forma: 1 };
  assert.ok(proximidade(zona, 0.15, militar.rigor) < proximidade(zona, 0.15, festa.rigor));
});

test('turbo da torcida vale por 5 s e aumenta o corte', () => {
  const c = ligarTurbo(criarCliente('tonhao'), 1000);
  const dentro = aplicarTraco(c, { zona: 'topo', ferramenta: 'tesoura', intensidade: 1, t: 2000 }, lenhador).cliente;
  const fora = aplicarTraco(c, { zona: 'topo', ferramenta: 'tesoura', intensidade: 1, t: 7000 }, lenhador).cliente;
  assert.ok(Math.abs(1 - dentro.zonas.topo.comp - 0.15) < 1e-9, `dentro ${dentro.zonas.topo.comp}`);
  assert.ok(Math.abs(1 - fora.zonas.topo.comp - 0.10) < 1e-9);
});

test('resumo do cliente e compacto e serializavel', () => {
  const r = resumirCliente(criarCliente('ravi'));
  assert.equal(r.arquetipo, 'ravi');
  assert.deepEqual(r.zonas.topo, [1, 0]);
  assert.equal(JSON.stringify(r).length < 400, true);
});
