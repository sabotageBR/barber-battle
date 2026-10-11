// Motor da sala viva com relogio falso: timers, bots, carencias e sala vazia.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarMotor } from '../src/core/motor-sala.js';
import { criarRelogioFalso } from './apoio/relogio-falso.js';
import { TEMPOS_RAPIDOS, PONTOS } from '../src/jogo/constantes.js';

const T = { ...TEMPOS_RAPIDOS, ocioso: 1e12 };

function montar(opcoes = {}) {
  const relogio = criarRelogioFalso(1000);
  const eventos = [];
  let vazia = 0;
  const motor = criarMotor({
    id: 'a-1', semente: 5, relogio, tempos: opcoes.tempos || T, bots: { alvo: opcoes.bots === undefined ? 4 : opcoes.bots },
    aoEventos: (lista) => eventos.push(...lista), aoVazia: () => { vazia++; },
  });
  motor.iniciar();
  return { motor, relogio, eventos, vazia: () => vazia };
}

const tipos = (eventos) => eventos.map((e) => e.tipo);

test('ao iniciar enche de bots, e um humano entrando abre o saguao', () => {
  const { motor, relogio, eventos } = montar();
  assert.equal(motor.bots(), 4);
  assert.equal(motor.estado.estado, 'saguao', 'com 4 bots ja ha dois jogadores');
  motor.aplicar({ tipo: 'entrar', id: 'h1', nome: [1, 2], avatar: { cor: 1, chapeu: 0 } });
  assert.equal(motor.humanos(), 1);
  relogio.avancar(500);
  assert.equal(motor.bots(), 4, 'o excedente so sai na transicao');
  assert.ok(tipos(eventos).includes('temaRevelado'));
  motor.parar();
});

test('uma rodada inteira anda sozinha com bots: saguao, rodada, votacao, resultado, transicao, saguao', () => {
  const { motor, relogio, eventos } = montar();
  motor.aplicar({ tipo: 'entrar', id: 'h1' });
  motor.aplicar({ tipo: 'escolher', id: 'h1', opcao: 'assistir' });
  const vistos = [];
  for (let i = 0; i < 400; i++) {
    relogio.avancar(100);
    if (vistos[vistos.length - 1] !== motor.estado.estado) vistos.push(motor.estado.estado);
  }
  assert.ok(vistos.join(',').startsWith('saguao,rodada,votacao'), vistos.join(','));
  assert.ok(vistos.includes('resultado') && vistos.includes('transicao'), vistos.join(','));
  const tracos = eventos.filter((e) => e.tipo === 'traco').length;
  assert.ok(tracos > 10, `bots cortaram (${tracos} tracos)`);
  const votos = eventos.filter((e) => e.tipo === 'voto').length;
  assert.ok(votos >= 1, 'bots votaram');
  const res = eventos.find((e) => e.tipo === 'resultado');
  assert.ok(res && (res.vencedor || res.empate !== undefined));
  // o vencedor pode ser um bot que ja saiu na transicao: conferir no proprio resultado
  assert.ok(res.cancelada || Object.values(res.pontos).includes(PONTOS.vencedor), 'alguem ganhou 10');
  motor.parar();
  assert.equal(relogio.timersPendentes(), 0);
});

test('o humano que escolhe jogar senta na cadeira; o timer re-arma quando o saguao encurta', () => {
  const { motor, relogio } = montar();
  motor.aplicar({ tipo: 'entrar', id: 'h1' });
  relogio.avancar(100);
  const fimAntes = motor.estado.fimEm;
  motor.aplicar({ tipo: 'escolher', id: 'h1', opcao: 'jogar' });
  relogio.avancar(T.saguao * 0.15); // bots escolhem em ate 13% do saguao
  assert.ok(motor.estado.fimEm < fimAntes, 'encurtou');
  relogio.avancar(T.saguaoMin + 50);
  assert.equal(motor.estado.estado, 'rodada');
  assert.ok(motor.estado.cadeiras.includes('h1'));
  motor.parar();
});

test('desconexao: barbeiro perde a cadeira depois da carencia curta e a vaga depois da longa; reconectar cancela', () => {
  const { motor, relogio, eventos } = montar();
  motor.aplicar({ tipo: 'entrar', id: 'h1' });
  relogio.avancar(100);
  motor.aplicar({ tipo: 'escolher', id: 'h1', opcao: 'jogar' });
  relogio.avancar(T.saguao * 0.15 + T.saguaoMin + 50);
  assert.ok(motor.estado.cadeiras.includes('h1'));
  motor.desconectar('h1');
  assert.equal(motor.estado.jogadores.h1.conectado, false);
  relogio.avancar(T.gracaBarbeiro - 100);
  assert.ok(motor.estado.cadeiras.includes('h1'), 'ainda na cadeira');
  relogio.avancar(200);
  assert.ok(!motor.estado.cadeiras.includes('h1'), 'cadeira trocada');
  assert.ok(tipos(eventos).includes('cadeiraTrocou'));
  assert.ok(motor.estado.jogadores.h1, 'ainda na sala como espectador');
  relogio.avancar(T.gracaJogador);
  assert.ok(!motor.estado.jogadores.h1, 'saiu da sala');

  const outro = montar();
  outro.motor.aplicar({ tipo: 'entrar', id: 'h2' });
  outro.motor.desconectar('h2');
  outro.relogio.avancar(T.gracaJogador / 2);
  outro.motor.reconectar('h2');
  outro.relogio.avancar(T.gracaJogador * 2);
  assert.ok(outro.motor.estado.jogadores.h2 && outro.motor.estado.jogadores.h2.conectado);
  outro.motor.parar();
  motor.parar();
});

test('sala sem humano avisa depois de salaVazia; parar cancela tudo', () => {
  const { motor, relogio, vazia } = montar();
  motor.aplicar({ tipo: 'entrar', id: 'h1' });
  relogio.avancar(1000);
  motor.sair('h1');
  relogio.avancar(T.salaVazia + 500);
  assert.equal(vazia(), 1);
  motor.parar();
  assert.equal(relogio.timersPendentes(), 0);
  relogio.avancar(60000);
  assert.equal(vazia(), 1);
});

test('bots excedentes saem na transicao quando humanos entram', () => {
  const { motor, relogio } = montar({ bots: 3 });
  for (const id of ['h1', 'h2', 'h3']) motor.aplicar({ tipo: 'entrar', id });
  relogio.avancar(100);
  assert.equal(motor.bots(), 3, 'no meio do ciclo ninguem sai');
  // humanos sempre escolhem jogar: as cadeiras sao deles e os bots sobram
  let transicoes = 0;
  let ultimo = '';
  for (let i = 0; i < 1200 && transicoes < 2; i++) {
    relogio.avancar(100);
    const e = motor.estado.estado;
    if (e === 'saguao') for (const id of ['h1', 'h2', 'h3']) if (!motor.estado.jogadores[id].escolha) motor.aplicar({ tipo: 'escolher', id, opcao: 'jogar' });
    if (e === 'transicao' && ultimo !== 'transicao') transicoes++;
    ultimo = e;
  }
  assert.equal(transicoes, 2);
  assert.equal(motor.bots(), 0, `bots ${motor.bots()}`);
  motor.parar();
});

test('relogio com fracoes: o timer do fim nunca deixa a sala presa (setTimeout trunca o atraso)', () => {
  // relogio falso que trunca o atraso como o setTimeout real, comecando num instante fracionario
  const base = criarRelogioFalso(1000.4);
  const relogio = { agora: base.agora, cancelar: base.cancelar, agendar: (fn, ms) => base.agendar(fn, Math.trunc(ms)) };
  const motor = criarMotor({ id: 'f', semente: 3, relogio, tempos: T, bots: { alvo: 4 } });
  motor.iniciar();
  motor.aplicar({ tipo: 'entrar', id: 'h1' });
  base.avancar(100.3);
  motor.aplicar({ tipo: 'escolher', id: 'h1', opcao: 'jogar' });
  const vistos = new Set();
  for (let i = 0; i < 600; i++) { base.avancar(100.7); vistos.add(motor.estado.estado); }
  assert.ok(vistos.has('rodada') && vistos.has('votacao') && vistos.has('resultado') && vistos.has('transicao'), [...vistos].join(','));
  motor.parar();
});
