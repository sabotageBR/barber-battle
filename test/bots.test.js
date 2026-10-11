// Bots: determinismo, habilidade, ritmo e voto da plateia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSala, aplicar, aptosAVotar } from '../src/jogo/sala.js';
import { decidirBot, criarMemoriaBot } from '../src/jogo/bots.js';
import { progresso } from '../src/jogo/corte.js';
import { TEMPOS } from '../src/jogo/constantes.js';

/** Sala com dois bots (b1 com a habilidade dada) e um humano espectador, rodada ja comecada. */
function rodadaComBots(habilidade, semente) {
  let s = criarSala({ id: 'a-1', semente, agora: 0 });
  s = aplicar(s, { tipo: 'entrar', id: 'b1', bot: true, habilidade, t: 0 }).estado;
  s = aplicar(s, { tipo: 'entrar', id: 'b2', bot: true, habilidade, t: 1 }).estado;
  s = aplicar(s, { tipo: 'entrar', id: 'h1', t: 2 }).estado;
  for (const id of ['b1', 'b2']) s = aplicar(s, { tipo: 'escolher', id, opcao: 'jogar', t: 10 }).estado;
  s = aplicar(s, { tipo: 'escolher', id: 'h1', opcao: 'assistir', t: 11 }).estado;
  s = aplicar(s, { tipo: 'tique', t: s.fimEm }).estado;
  assert.equal(s.estado, 'rodada');
  return s;
}

/** Deixa os bots jogarem a rodada inteira (tiques de 100 ms). */
function jogarRodada(s, memorias, passo = 100) {
  const tracos = {};
  for (let t = s.inicioEm; t < s.fimEm; t += passo) {
    for (const id of Object.keys(memorias)) {
      const d = decidirBot(s, id, t, memorias[id]);
      memorias[id] = d.memoria;
      if (d.evento) {
        if (d.evento.tipo === 'traco') tracos[id] = (tracos[id] || []).concat(t);
        s = aplicar(s, d.evento).estado;
      }
    }
    s = aplicar(s, { tipo: 'tique', t }).estado;
  }
  return { s, tracos };
}

test('o bot e deterministico para a mesma semente', () => {
  const a = jogarRodada(rodadaComBots(0.8, 3), { b1: criarMemoriaBot(1), b2: criarMemoriaBot(2) });
  const b = jogarRodada(rodadaComBots(0.8, 3), { b1: criarMemoriaBot(1), b2: criarMemoriaBot(2) });
  assert.deepEqual(JSON.stringify(a.s.cliente), JSON.stringify(b.s.cliente));
  assert.ok(a.tracos.b1.length > 20);
});

test('barbeiro bot termina entre 55 e 100 de qualidade; habilidade alta rende mais que baixa', () => {
  const medias = {};
  for (const hab of [0.45, 0.9]) {
    let soma = 0;
    for (let semente = 1; semente <= 12; semente++) {
      const s0 = rodadaComBots(hab, semente);
      const { s } = jogarRodada(s0, { b1: criarMemoriaBot(semente * 7), b2: criarMemoriaBot(semente * 11) });
      for (const id of ['b1', 'b2']) {
        const q = progresso(s.cliente[id], s.tema, { punir: false }).qualidade;
        assert.ok(q >= 55 && q <= 100, `hab ${hab} semente ${semente} ${id}: ${q.toFixed(1)} (${s.tema.id})`);
        soma += q;
      }
    }
    medias[hab] = soma / 24;
  }
  assert.ok(medias[0.9] > medias[0.45], `medias ${JSON.stringify(medias)}`);
});

test('o bot respeita o ritmo: nunca mais de 12 tracos por segundo e faz pausas', () => {
  const { tracos } = jogarRodada(rodadaComBots(0.9, 5), { b1: criarMemoriaBot(9), b2: criarMemoriaBot(10) });
  const lista = tracos.b1;
  for (let i = 0; i < lista.length; i++) {
    const janela = lista.filter((x) => x >= lista[i] && x < lista[i] + 1000).length;
    assert.ok(janela <= 12, `${janela} tracos em 1 s`);
  }
  let maiorPausa = 0;
  for (let i = 1; i < lista.length; i++) maiorPausa = Math.max(maiorPausa, lista[i] - lista[i - 1]);
  assert.ok(maiorPausa >= 600, `maior pausa ${maiorPausa}`);
  assert.ok(lista[0] >= TEMPOS.rodada * 0 + 1000, 'pensa antes do primeiro traco');
});

test('no saguao o bot escolhe jogar entre 1 e 4 s; na votacao vota com vies para a melhor qualidade', () => {
  let s = criarSala({ id: 'a-1', semente: 2, agora: 0 });
  s = aplicar(s, { tipo: 'entrar', id: 'h1', t: 0 }).estado;
  s = aplicar(s, { tipo: 'entrar', id: 'b1', bot: true, t: 1 }).estado;
  let m = criarMemoriaBot(4);
  let escolheuEm = -1;
  for (let t = s.inicioEm; t < s.inicioEm + 6000 && escolheuEm < 0; t += 100) {
    const d = decidirBot(s, 'b1', t, m);
    m = d.memoria;
    if (d.evento) { assert.equal(d.evento.opcao, 'jogar'); escolheuEm = t; s = aplicar(s, d.evento).estado; }
  }
  assert.ok(escolheuEm - s.inicioEm >= 1000 && escolheuEm - s.inicioEm <= 4100, `escolheu em ${escolheuEm - s.inicioEm}`);

  // votacao: b1 (bom) contra b2 (ruim), 200 plateias bots
  let acertos = 0;
  for (let semente = 1; semente <= 200; semente++) {
    let v = rodadaComBots(0.9, 3);
    v = aplicar(v, { tipo: 'entrar', id: 'b3', bot: true, t: v.inicioEm + 1 }).estado;
    const { s: fim } = jogarRodada(v, { b1: criarMemoriaBot(100) }, 500); // b2 nao mexe no cliente
    let x = aplicar(fim, { tipo: 'tique', t: fim.fimEm }).estado;
    assert.equal(x.estado, 'votacao');
    assert.ok(aptosAVotar(x).includes('b3'));
    let mb = criarMemoriaBot(semente);
    let voto = null;
    for (let t = x.inicioEm; t < x.fimEm && !voto; t += 250) {
      const d = decidirBot(x, 'b3', t, mb);
      mb = d.memoria;
      if (d.evento) voto = d.evento;
    }
    assert.ok(voto, 'o bot votou');
    assert.ok(voto.t - x.inicioEm >= 2000 && voto.t - x.inicioEm <= 9250, 'vota entre 2 e 9 s');
    if (voto.alvo === 'b1') acertos++;
  }
  assert.ok(acertos >= 150, `acertos ${acertos}/200`);
});
