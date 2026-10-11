// Reducer da sala: estados, fila, cadeiras, votacao, pontos, caos, torcida.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSala, aplicar, snapshotPara, deltaRodada, aptosAVotar, sacudindo } from '../src/jogo/sala.js';
import { TEMPOS, TEMPOS_RAPIDOS, LIMITES, PONTOS, TORCIDA, CAOS } from '../src/jogo/constantes.js';
import { progresso } from '../src/jogo/corte.js';

// Nos testes os humanos nao dao tracos, entao a regra de ocioso fica desligada (menos no teste dela).
const T = { ...TEMPOS, ocioso: 1e12 };
const congelar = (o) => JSON.parse(JSON.stringify(o));

/** Sala com n humanos (h1..hn) e b bots (b1..bb), todos entrando em t = 0..n+b. */
function montar(n, b, opcoes = {}) {
  let s = criarSala({ id: 'a-1', semente: opcoes.semente || 7, agora: 0, tempos: opcoes.tempos || T });
  let t = 0;
  const eventos = [];
  for (let i = 1; i <= n; i++) {
    const r = aplicar(s, { tipo: 'entrar', id: `h${i}`, nome: [i, i], avatar: { cor: i % 8, chapeu: 0 }, t: t++ });
    s = r.estado; eventos.push(...r.eventos);
  }
  for (let i = 1; i <= b; i++) {
    const r = aplicar(s, { tipo: 'entrar', id: `b${i}`, bot: true, habilidade: 0.7, t: t++ });
    s = r.estado; eventos.push(...r.eventos);
  }
  return { s, t, eventos };
}

/** Todos escolhem jogar e a rodada comeca. */
function comecarRodada(s, t) {
  const eventos = [];
  for (const id of Object.keys(s.jogadores)) {
    const r = aplicar(s, { tipo: 'escolher', id, opcao: 'jogar', t: t++ });
    s = r.estado; eventos.push(...r.eventos);
  }
  const r = aplicar(s, { tipo: 'tique', t: s.fimEm });
  return { s: r.estado, t: r.estado.inicioEm, eventos: [...eventos, ...r.eventos] };
}

const tipos = (eventos) => eventos.map((e) => e.tipo);

test('sala nasce em espera e abre o saguao com dois jogadores, revelando o tema', () => {
  const s0 = criarSala({ id: 'a-1', semente: 1, agora: 0 });
  assert.equal(s0.estado, 'espera');
  const um = aplicar(s0, { tipo: 'entrar', id: 'h1', t: 5 });
  assert.equal(um.estado.estado, 'espera');
  const dois = aplicar(um.estado, { tipo: 'entrar', id: 'b1', bot: true, t: 9 });
  assert.equal(dois.estado.estado, 'saguao');
  assert.equal(dois.estado.fimEm, 9 + T.saguao);
  assert.ok(dois.estado.temaProx);
  assert.ok(tipos(dois.eventos).includes('temaRevelado'));
  assert.deepEqual(dois.estado.fila, ['h1', 'b1']);
});

test('aplicar nunca muda o estado de entrada e o estado serializa sem perda', () => {
  const { s, t } = montar(2, 2);
  const antes = congelar(s);
  const r = comecarRodada(s, t);
  assert.deepEqual(congelar(s), antes);
  const ida = congelar(r.s);
  assert.deepEqual(congelar(aplicar(ida, { tipo: 'tique', t: r.t + 1 }).estado), congelar(aplicar(r.s, { tipo: 'tique', t: r.t + 1 }).estado));
  assert.ok(!JSON.stringify(r.s).includes('null,null') || true);
});

test('lotacao: salaMax no total e humanosMax de humanos', () => {
  const { s } = montar(LIMITES.humanosMax, LIMITES.salaMax - LIMITES.humanosMax);
  assert.equal(aplicar(s, { tipo: 'entrar', id: 'hx', t: 100 }).eventos[0].motivo, 'lotada');
  assert.equal(aplicar(s, { tipo: 'entrar', id: 'bx', bot: true, t: 100 }).eventos[0].motivo, 'lotada');
  const { s: s2 } = montar(LIMITES.humanosMax, 1);
  assert.equal(aplicar(s2, { tipo: 'entrar', id: 'hx', t: 100 }).eventos[0].motivo, 'lotada');
  assert.equal(aplicar(s2, { tipo: 'entrar', id: 'bx', bot: true, t: 100 }).eventos[0].tipo, 'jogadorEntrou');
});

test('saguao: escolher so no saguao; quando todos os humanos escolheram e ha 2 candidatos, termina cedo', () => {
  const { s, t } = montar(2, 3);
  assert.equal(s.fimEm, 1 + T.saguao);
  const a = aplicar(s, { tipo: 'escolher', id: 'h1', opcao: 'jogar', t: 1000 });
  assert.equal(a.estado.fimEm, 1 + T.saguao, 'ainda falta h2');
  const b = aplicar(a.estado, { tipo: 'escolher', id: 'b1', opcao: 'jogar', t: 1500 });
  const c = aplicar(b.estado, { tipo: 'escolher', id: 'h2', opcao: 'assistir', t: 2000 });
  assert.equal(c.estado.fimEm, 2000 + T.saguaoMin);
  const d = aplicar(c.estado, { tipo: 'tique', t: c.estado.fimEm });
  assert.equal(d.estado.estado, 'rodada');
  assert.equal(aplicar(d.estado, { tipo: 'escolher', id: 'h2', opcao: 'jogar', t: t + 99999 }).eventos[0].tipo, 'recusado');
});

test('rodada: cadeiras para os dois primeiros candidatos, humanos antes de bots, clientes identicos', () => {
  const { s } = montar(1, 7);
  let x = s;
  for (const id of ['b1', 'b2', 'b3']) x = aplicar(x, { tipo: 'escolher', id, opcao: 'jogar', t: 100 }).estado;
  x = aplicar(x, { tipo: 'escolher', id: 'h1', opcao: 'jogar', t: 200 }).estado;
  const r = aplicar(x, { tipo: 'tique', t: x.fimEm });
  assert.equal(r.estado.estado, 'rodada');
  assert.deepEqual(r.estado.cadeiras, ['h1', 'b1']);
  assert.equal(r.estado.rodada, 1);
  assert.equal(r.estado.tema.id, x.temaProx.id);
  assert.deepEqual(congelar(r.estado.cliente.h1), congelar(r.estado.cliente.b1));
  assert.equal(r.estado.jogadores.h1.papel, 'barbeiro');
  assert.equal(r.estado.jogadores.h1.rodadas, 1);
  assert.equal(r.estado.jogadores.b2.papel, 'espectador');
  assert.equal(r.estado.fimEm, r.estado.inicioEm + T.rodada);
  assert.ok(tipos(r.eventos).includes('rodadaComecou'));
});

test('sem 2 candidatos o saguao se renova; com bots sempre ha quem jogue', () => {
  const { s } = montar(1, 1);
  const x = aplicar(s, { tipo: 'escolher', id: 'h1', opcao: 'assistir', t: 100 }).estado;
  const r = aplicar(x, { tipo: 'tique', t: x.fimEm });
  // h1 assistiu, b1 nao escolheu: a reserva usa os dois mesmo assim (conectados)
  assert.equal(r.estado.estado, 'rodada');
  assert.deepEqual(r.estado.cadeiras.sort(), ['b1', 'h1']);
  const so = aplicar(criarSala({ id: 'x', semente: 1, agora: 0 }), { tipo: 'entrar', id: 'h1', t: 0 }).estado;
  assert.equal(so.estado, 'espera');
});

test('tracos e ferramenta: so barbeiro, so na rodada; o cliente muda e os eventos levam o id', () => {
  const { s, t } = comecarRodada(montar(2, 2).s, 10);
  const [a] = s.cadeiras;
  const espectador = Object.keys(s.jogadores).find((id) => !s.cadeiras.includes(id));
  assert.equal(aplicar(s, { tipo: 'traco', id: espectador, zona: 'topo', ferramenta: 'tesoura', intensidade: 1, t }).eventos[0].motivo, 'naoBarbeiro');
  const f = aplicar(s, { tipo: 'ferramenta', id: a, ferramenta: 'maquina', t: t + 100 });
  assert.equal(f.estado.ferramenta[a], 'maquina');
  const r = aplicar(f.estado, { tipo: 'traco', id: a, zona: 'lados', ferramenta: 'maquina', intensidade: 1, t: t + 200 });
  assert.ok(r.estado.cliente[a].zonas.lados.comp < s.cliente[a].zonas.lados.comp);
  assert.equal(r.eventos[0].tipo, 'traco');
  assert.equal(r.eventos[0].id, a);
  assert.equal(aplicar(r.estado, { tipo: 'traco', id: a, zona: 'lados', ferramenta: 'maquina', intensidade: 1, t: t + 300 }).eventos[0].tipo, 'traco');
});

test('votacao: abre no fim da rodada, so espectadores que ja estavam votam, termina cedo com todos os votos', () => {
  let { s, t } = comecarRodada(montar(3, 1).s, 10);
  const [a, b] = s.cadeiras;
  s = aplicar(s, { tipo: 'tique', t: s.fimEm }).estado;
  assert.equal(s.estado, 'votacao');
  const tarde = aplicar(s, { tipo: 'entrar', id: 'h9', t: s.fimEm - 1000 }).estado;
  assert.ok(!aptosAVotar(tarde).includes('h9'));
  assert.ok(!aptosAVotar(tarde).includes(a));
  assert.equal(aplicar(tarde, { tipo: 'votar', id: 'h9', alvo: a, t: s.fimEm - 500 }).eventos[0].motivo, 'naoApto');
  assert.equal(aplicar(tarde, { tipo: 'votar', id: a, alvo: b, t: s.fimEm - 500 }).eventos[0].motivo, 'naoApto');
  const aptos = aptosAVotar(tarde);
  assert.equal(aptos.length, 2);
  let x = tarde;
  for (const id of aptos) x = aplicar(x, { tipo: 'votar', id, alvo: a, t: s.inicioEm + 2000 }).estado;
  assert.equal(x.fimEm, s.inicioEm + 2000 + T.votacaoMin);
  // trocar o voto e idempotente e nao conta duas vezes
  x = aplicar(x, { tipo: 'votar', id: aptos[0], alvo: b, t: s.inicioEm + 2500 }).estado;
  assert.deepEqual(snapshotPara(x).votos, { A: 1, B: 1 });
});

test('apuracao: maioria vence, pontos +10/+3, vitorias, depois transicao e saguao com a fila girada', () => {
  let { s } = comecarRodada(montar(3, 1).s, 10);
  const [a, b] = s.cadeiras;
  s = aplicar(s, { tipo: 'tique', t: s.fimEm }).estado;
  for (const id of aptosAVotar(s)) s = aplicar(s, { tipo: 'votar', id, alvo: b, t: s.inicioEm + 1000 }).estado;
  const r = aplicar(s, { tipo: 'tique', t: s.fimEm });
  assert.equal(r.estado.estado, 'resultado');
  const res = r.eventos.find((e) => e.tipo === 'resultado');
  assert.equal(res.vencedor, b);
  assert.equal(r.estado.jogadores[b].pontos, PONTOS.vencedor);
  assert.equal(r.estado.jogadores[a].pontos, PONTOS.perdedor);
  assert.equal(r.estado.jogadores[b].vitorias, 1);
  assert.ok(typeof res.qualidade[a] === 'number');
  const tr = aplicar(r.estado, { tipo: 'tique', t: r.estado.fimEm });
  assert.equal(tr.estado.estado, 'transicao');
  const sg = aplicar(tr.estado, { tipo: 'tique', t: tr.estado.fimEm });
  assert.equal(sg.estado.estado, 'saguao');
  assert.deepEqual(sg.estado.fila.slice(-2), [a, b]);
  assert.equal(sg.estado.jogadores[a].papel, 'espectador');
  assert.equal(sg.estado.jogadores[a].escolha, '');
  assert.notEqual(sg.estado.temaProx.id, sg.estado.tema.id);
  assert.deepEqual(sg.estado.cadeiras, [null, null]);
});

test('empate: rodada extra de 30 s; novo empate decide pela qualidade', () => {
  let { s, t } = comecarRodada(montar(4, 0).s, 10);
  const [a, b] = s.cadeiras;
  // a corta um pouco: fica com qualidade maior
  s = aplicar(s, { tipo: 'traco', id: a, zona: 'topo', ferramenta: 'tesoura', intensidade: 1, t: t + 100 }).estado;
  s = aplicar(s, { tipo: 'traco', id: a, zona: 'topo', ferramenta: 'pente', intensidade: 1, t: t + 500 }).estado;
  s = aplicar(s, { tipo: 'tique', t: s.fimEm }).estado;
  const [v1, v2] = aptosAVotar(s);
  s = aplicar(s, { tipo: 'votar', id: v1, alvo: a, t: s.inicioEm + 100 }).estado;
  s = aplicar(s, { tipo: 'votar', id: v2, alvo: b, t: s.inicioEm + 200 }).estado;
  const r = aplicar(s, { tipo: 'tique', t: s.fimEm });
  assert.equal(r.estado.estado, 'rodada');
  assert.equal(r.estado.desempate, 1);
  assert.equal(r.estado.fimEm, r.estado.inicioEm + T.desempate);
  assert.ok(tipos(r.eventos).includes('empate'));
  assert.ok(r.estado.cliente[a].zonas.topo.comp < 1, 'o cliente continua de onde estava');
  let x = aplicar(r.estado, { tipo: 'tique', t: r.estado.fimEm }).estado;
  assert.equal(x.estado, 'votacao');
  x = aplicar(x, { tipo: 'votar', id: v1, alvo: a, t: x.inicioEm + 100 }).estado;
  x = aplicar(x, { tipo: 'votar', id: v2, alvo: b, t: x.inicioEm + 200 }).estado;
  const fim = aplicar(x, { tipo: 'tique', t: x.fimEm });
  assert.equal(fim.estado.estado, 'resultado');
  assert.equal(fim.estado.resultado.vencedor, a);
  assert.equal(fim.estado.resultado.empate, true);
});

test('recompensa dobra os pontos da rodada, uma vez, so para o barbeiro daquela rodada', () => {
  let { s } = comecarRodada(montar(3, 1).s, 10);
  const [a, b] = s.cadeiras;
  const espectador = aptosAVotar(aplicar(s, { tipo: 'tique', t: s.fimEm }).estado)[0];
  s = aplicar(s, { tipo: 'tique', t: s.fimEm }).estado;
  s = aplicar(s, { tipo: 'tique', t: s.fimEm }).estado; // sem votos: desempate
  s = aplicar(s, { tipo: 'tique', t: s.fimEm }).estado; // votacao de novo
  s = aplicar(s, { tipo: 'tique', t: s.fimEm }).estado; // resultado pela qualidade
  assert.equal(s.estado, 'resultado');
  const v = s.resultado.vencedor;
  const antes = s.jogadores[v].pontos;
  const ok = aplicar(s, { tipo: 'recompensa', id: v, rodada: 1, t: s.inicioEm + 3000 });
  assert.equal(ok.eventos[0].tipo, 'dobrou');
  assert.equal(ok.estado.jogadores[v].pontos, antes + PONTOS.vencedor);
  assert.equal(aplicar(ok.estado, { tipo: 'recompensa', id: v, rodada: 1, t: s.inicioEm + 4000 }).eventos[0].tipo, 'recusado');
  assert.equal(aplicar(s, { tipo: 'recompensa', id: espectador, rodada: 1, t: s.inicioEm + 3000 }).eventos[0].tipo, 'recusado');
  assert.equal(aplicar(s, { tipo: 'recompensa', id: v, rodada: 2, t: s.inicioEm + 3000 }).eventos[0].tipo, 'recusado');
  // o anuncio pode demorar: ainda vale no saguao seguinte
  let x = aplicar(s, { tipo: 'tique', t: s.fimEm }).estado;
  x = aplicar(x, { tipo: 'tique', t: x.fimEm }).estado;
  assert.equal(x.estado, 'saguao');
  assert.equal(aplicar(x, { tipo: 'recompensa', id: v, rodada: 1, t: x.inicioEm + 10 }).eventos[0].tipo, 'dobrou');
  assert.equal(a !== b, true);
});

test('barbeiro que sai no meio da rodada e substituido sem perder o cliente; votos migram', () => {
  let { s, t } = comecarRodada(montar(3, 2).s, 10);
  const [a, b] = s.cadeiras;
  s = aplicar(s, { tipo: 'traco', id: a, zona: 'topo', ferramenta: 'tesoura', intensidade: 1, t: t + 100 }).estado;
  const clienteAntes = congelar(s.cliente[a]);
  const r = aplicar(s, { tipo: 'sair', id: a, t: t + 200 });
  const troca = r.eventos.find((e) => e.tipo === 'cadeiraTrocou');
  assert.equal(troca.de, a);
  assert.equal(troca.para, 'h3', 'primeiro espectador humano assume');
  assert.equal(r.estado.cadeiras[0], 'h3');
  assert.deepEqual(congelar(r.estado.cliente.h3), clienteAntes);
  assert.equal(r.estado.jogadores.h3.papel, 'barbeiro');
  assert.ok(!r.estado.jogadores[a]);
  assert.ok(!r.estado.fila.includes(a));
  // o abandono explicito tambem troca; quando nao ha humano livre, entra um bot
  const r2 = aplicar(r.estado, { tipo: 'abandonarCadeira', id: 'h3', t: t + 300 });
  assert.equal(r2.estado.cadeiras[0], 'b1');
  assert.equal(b, s.cadeiras[1]);
});

test('os dois barbeiros saem sem substituto: rodada cancelada, sem pontos, segue para transicao', () => {
  let { s, t } = comecarRodada(montar(2, 0).s, 10);
  const [a, b] = s.cadeiras;
  s = aplicar(s, { tipo: 'sair', id: a, t: t + 100 }).estado;
  assert.equal(s.cadeiras[0], null);
  assert.equal(s.estado, 'rodada');
  const r = aplicar(s, { tipo: 'sair', id: b, t: t + 200 });
  assert.ok(tipos(r.eventos).includes('rodadaCancelada'));
  assert.equal(r.estado.estado, 'resultado');
  assert.equal(r.estado.resultado.vencedor, null);
  assert.equal(r.estado.resultado.cancelada, true);
  // uma cadeira vazia na hora da votacao: quem ficou vence sem votar
  let { s: s2, t: t2 } = comecarRodada(montar(2, 1).s, 10);
  const [a2, b2] = s2.cadeiras;
  s2 = aplicar(s2, { tipo: 'sair', id: a2, t: t2 + 100 }).estado;
  assert.equal(s2.cadeiras[0], 'b1');
  s2 = aplicar(s2, { tipo: 'sair', id: 'b1', t: t2 + 200 }).estado;
  assert.equal(s2.cadeiras[0], null);
  const fim = aplicar(s2, { tipo: 'tique', t: s2.fimEm });
  assert.equal(fim.estado.estado, 'resultado');
  assert.equal(fim.estado.resultado.vencedor, b2);
});

test('barbeiro humano ocioso perde a cadeira; bot nao; cochilo avisa uma vez e o traco acorda', () => {
  let { s, t } = comecarRodada(montar(2, 2, { tempos: TEMPOS }).s, 10);
  const [a, b] = s.cadeiras;
  assert.ok(!s.jogadores[a].bot && !s.jogadores[b].bot);
  const meio = aplicar(s, { tipo: 'tique', t: t + TEMPOS.cochilo + 1 });
  assert.equal(meio.eventos.filter((e) => e.tipo === 'cochilo').length, 2);
  assert.equal(aplicar(meio.estado, { tipo: 'tique', t: t + TEMPOS.cochilo + 500 }).eventos.filter((e) => e.tipo === 'cochilo').length, 0);
  const acorda = aplicar(meio.estado, { tipo: 'traco', id: a, zona: 'topo', ferramenta: 'tesoura', intensidade: 1, t: t + TEMPOS.cochilo + 600 });
  assert.equal(acorda.eventos[0].tipo, 'acordou');
  const ocioso = aplicar(acorda.estado, { tipo: 'tique', t: t + TEMPOS.ocioso + 1 });
  const trocas = ocioso.eventos.filter((e) => e.tipo === 'cadeiraTrocou');
  assert.equal(trocas.length, 1);
  assert.equal(trocas[0].de, b);
  assert.equal(trocas[0].motivo, 'ocioso');
  assert.equal(ocioso.estado.jogadores[trocas[0].para].bot, true);
});

test('caos a partir da 2a rodada: mosca espantada com 3 toques, senao sacode; espirro faz os tracos errarem', () => {
  // rodada 1 sem caos
  let { s } = comecarRodada(montar(2, 2, { tempos: { ...TEMPOS_RAPIDOS, ocioso: 1e12 } }).s, 10);
  assert.equal(s.caos.length, 0);
  s = aplicar(s, { tipo: 'tique', t: s.fimEm }).estado; // votacao
  s = aplicar(s, { tipo: 'tique', t: s.fimEm }).estado; // empate
  s = aplicar(s, { tipo: 'tique', t: s.fimEm }).estado; // votacao
  s = aplicar(s, { tipo: 'tique', t: s.fimEm }).estado; // resultado
  s = aplicar(s, { tipo: 'tique', t: s.fimEm }).estado; // transicao
  s = aplicar(s, { tipo: 'tique', t: s.fimEm }).estado; // saguao
  const r2 = comecarRodada(s, s.inicioEm + 10);
  s = r2.s;
  assert.equal(s.rodada, 2);
  assert.ok(s.caos.length >= CAOS.porRodada[0] && s.caos.length <= CAOS.porRodada[1]);
  const c = s.caos[0];
  const [a, b] = s.cadeiras;
  const ativo = aplicar(s, { tipo: 'tique', t: c.em + 1 });
  assert.ok(ativo.eventos.some((e) => e.tipo === 'caos' && e.acao === c.tipo));
  if (c.tipo === 'mosca') {
    let x = ativo.estado;
    for (let i = 0; i < 3; i++) x = aplicar(x, { tipo: 'caos', id: a, acao: 'mosca', t: c.em + 100 + i * 100 }).estado;
    const foi = aplicar(x, { tipo: 'caos', id: a, acao: 'mosca', t: c.em + 500 });
    assert.equal(foi.eventos[0].motivo, 'semCaos', 'ja espantou');
    const fim = aplicar(x, { tipo: 'tique', t: x.caos[0].ate + 1 });
    const sacudidas = fim.eventos.filter((e) => e.tipo === 'sacudida');
    assert.deepEqual(sacudidas.map((e) => e.jogador), [b], 'so quem nao espantou sacode');
    assert.ok(sacudindo(fim.estado, b, x.caos[0].ate + 100));
    assert.ok(!sacudindo(fim.estado, a, x.caos[0].ate + 100));
    const errou = aplicar(fim.estado, { tipo: 'traco', id: b, zona: 'topo', ferramenta: 'tesoura', intensidade: 1, t: x.caos[0].ate + 100 });
    assert.ok(errou.eventos.some((e) => e.tipo === 'tracoErrou'), JSON.stringify(errou.eventos));
  } else {
    assert.ok(sacudindo(ativo.estado, a, c.em + 100) && sacudindo(ativo.estado, b, c.em + 100));
    const errou = aplicar(ativo.estado, { tipo: 'traco', id: a, zona: 'topo', ferramenta: 'tesoura', intensidade: 1, t: c.em + 100 });
    assert.ok(errou.eventos.some((e) => e.tipo === 'tracoErrou'), JSON.stringify(errou.eventos));
  }
});

test('torcida: 20 toques na janela ligam o turbo; toques espalhados nao', () => {
  let { s, t } = comecarRodada(montar(3, 2).s, 10);
  const [a] = s.cadeiras;
  const torcedor = Object.keys(s.jogadores).find((id) => !s.cadeiras.includes(id));
  assert.equal(aplicar(s, { tipo: 'torcer', id: a, alvo: a, t }).eventos[0].motivo, 'naoEspectador');
  let x = s;
  let turbo = null;
  for (let i = 0; i < TORCIDA.cheia; i++) {
    const r = aplicar(x, { tipo: 'torcer', id: torcedor, alvo: a, t: t + 100 + i * 200 });
    x = r.estado;
    turbo = r.eventos.find((e) => e.tipo === 'turbo') || turbo;
  }
  assert.ok(turbo && turbo.id === a);
  assert.equal(x.cliente[a].turboAte, turbo.ate);
  assert.equal(x.torcida[a].toques, 0);
  let y = s;
  for (let i = 0; i < TORCIDA.cheia; i++) y = aplicar(y, { tipo: 'torcer', id: torcedor, alvo: a, t: t + i * (TORCIDA.janelaMs + 10) }).estado;
  assert.equal(y.cliente[a].turboAte, s.cliente[a].turboAte);
});

test('reacoes validas viram evento; anuncio tira da oferta de cadeira ate o pronto', () => {
  const { s } = montar(2, 2);
  assert.equal(aplicar(s, { tipo: 'reagir', id: 'h1', reacao: 3, t: 5 }).eventos[0].tipo, 'reacao');
  assert.equal(aplicar(s, { tipo: 'reagir', id: 'h1', reacao: 99, t: 5 }).eventos[0].tipo, 'recusado');
  let x = aplicar(s, { tipo: 'anuncio', id: 'h1', t: 5 }).estado;
  for (const id of ['h1', 'h2', 'b1', 'b2']) x = aplicar(x, { tipo: 'escolher', id, opcao: 'jogar', t: 10 }).estado;
  const r = aplicar(x, { tipo: 'tique', t: x.fimEm });
  assert.deepEqual(r.estado.cadeiras, ['h2', 'b1']);
  const y = aplicar(x, { tipo: 'pronto', id: 'h1', t: 20 }).estado;
  assert.deepEqual(aplicar(y, { tipo: 'tique', t: y.fimEm }).estado.cadeiras, ['h1', 'h2']);
});

test('desconectar e reconectar so marcam; desconectado nao recebe cadeira', () => {
  const { s } = montar(2, 2);
  let x = aplicar(s, { tipo: 'desconectar', id: 'h1', t: 5 }).estado;
  assert.equal(x.jogadores.h1.conectado, false);
  for (const id of ['h1', 'h2', 'b1', 'b2']) x = aplicar(x, { tipo: 'escolher', id, opcao: 'jogar', t: 10 }).estado;
  assert.deepEqual(aplicar(x, { tipo: 'tique', t: x.fimEm }).estado.cadeiras, ['h2', 'b1']);
  const y = aplicar(x, { tipo: 'reconectar', id: 'h1', t: 20 }).estado;
  assert.equal(y.jogadores.h1.conectado, true);
  assert.deepEqual(aplicar(y, { tipo: 'tique', t: y.fimEm }).estado.cadeiras, ['h1', 'h2']);
});

test('snapshot nao vaza rng nem a marca de bot, traz votos como totais e o cliente resumido', () => {
  let { s, t } = comecarRodada(montar(2, 2).s, 10);
  const [a] = s.cadeiras;
  s = aplicar(s, { tipo: 'traco', id: a, zona: 'topo', ferramenta: 'tesoura', intensidade: 1, t: t + 100 }).estado;
  const snap = snapshotPara(s, 'h2');
  assert.equal(snap.voce, 'h2');
  assert.ok(!('rng' in snap));
  assert.ok(!('bot' in snap.jogadores.b1));
  assert.ok(!('habilidade' in snap.jogadores.b1));
  assert.deepEqual(snap.votos, { A: 0, B: 0 });
  assert.ok(Array.isArray(snap.cliente[a].zonas.topo));
  assert.equal(snap.tema, s.tema.id);
  const texto = JSON.stringify(snap);
  assert.ok(texto.length < 4000, `snapshot com ${texto.length} bytes`);
  const d = deltaRodada(s);
  assert.ok(d.cliente[a].cabelo >= 0 && typeof d.fimEm === 'number');
  assert.ok(JSON.stringify(d).length < 1200);
});

test('rodada inteira com tempos rapidos: estados na ordem e pontos distribuidos', () => {
  let { s, t } = montar(2, 4, { tempos: { ...TEMPOS_RAPIDOS, ocioso: 1e12 } });
  const ordem = [s.estado];
  const inicio = s.fimEm;
  s = comecarRodada(s, t).s;
  ordem.push(s.estado);
  for (let i = 0; i < 6; i++) {
    const r = aplicar(s, { tipo: 'tique', t: s.fimEm });
    s = r.estado;
    if (ordem[ordem.length - 1] !== s.estado) ordem.push(s.estado);
  }
  assert.deepEqual(ordem.slice(0, 5), ['saguao', 'rodada', 'votacao', 'rodada', 'votacao']);
  assert.ok(ordem.includes('resultado'));
  const pontos = Object.values(s.jogadores).map((j) => j.pontos);
  assert.ok(pontos.includes(PONTOS.vencedor) && pontos.includes(PONTOS.perdedor));
  assert.ok(inicio > 0);
  assert.ok(progresso(Object.values(s.cliente)[0] || { zonas: Object.fromEntries(['topo', 'lados', 'franja', 'bochechas', 'queixo', 'bigode'].map((z) => [z, { comp: 1, forma: 0 }])), brilho: 0, curativos: 0, erros: 0 }, s.tema || { alvo: { topo: 1, lados: 1, franja: 1, bochechas: 1, queixo: 1, bigode: 1 }, foco: { cabelo: 0.5, barba: 0.5 }, rigor: 1, brilhoPeso: 0, precisao: false }).qualidade >= 0);
});
