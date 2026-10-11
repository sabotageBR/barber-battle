// Cliente de rede com transporte falso e relogio falso: handshake, relogio,
// reconexao com recuo, queda para o modo local e reenvio de tracos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarRede } from '../src/core/rede.js';
import { criarRelogioFalso } from './apoio/relogio-falso.js';
import { VERSAO_PROTOCOLO } from '../src/jogo/constantes.js';

/** Transporte falso: o teste controla abertura, mensagens e fechamento. */
function transporteFalso(registro) {
  const t = {
    enviadas: [], ouvintes: new Set(), aberturas: new Set(), fechamentos: new Set(), estaAberto: false,
    enviar(m) { t.enviadas.push(m); },
    aoMensagem(fn) { t.ouvintes.add(fn); return () => t.ouvintes.delete(fn); },
    aoAbrir(fn) { t.aberturas.add(fn); return () => t.aberturas.delete(fn); },
    aoFechar(fn) { t.fechamentos.add(fn); return () => t.fechamentos.delete(fn); },
    aberto() { return t.estaAberto; },
    fechar() { t.estaAberto = false; for (const fn of t.fechamentos) fn({ codigo: 1000 }); },
    // controles do teste
    abrir() { t.estaAberto = true; for (const fn of t.aberturas) fn(); },
    receber(m) { for (const fn of t.ouvintes) fn(m); },
    cair() { t.estaAberto = false; for (const fn of t.fechamentos) fn({ codigo: 1006 }); },
  };
  registro.push(t);
  return t;
}

function montar() {
  const relogio = criarRelogioFalso(1000);
  const transportes = [];
  const mensagens = [];
  const estados = [];
  const memoria = {};
  const armazem = { ler: (k) => memoria[k] ?? null, gravar: (k, v) => { memoria[k] = v; } };
  const rede = criarRede({
    url: 'ws://x/ws', criarTransporte: () => transporteFalso(transportes), relogio, armazem,
    perfil: () => ({ nome: [1, 2], avatar: { cor: 1, chapeu: 0 }, idioma: 'pt', sala: 'teste', bots: 3 }),
    aoMensagem: (m) => mensagens.push(m), aoEstado: (e) => estados.push(e),
  });
  return { rede, relogio, transportes, mensagens, estados, memoria };
}

test('conecta, manda entrar com perfil, guarda o token do bemvindo e fica online', () => {
  const { rede, transportes, mensagens, estados, memoria } = montar();
  rede.conectar();
  const t = transportes[0];
  t.abrir();
  const entrar = t.enviadas.find((m) => m.t === 'entrar');
  assert.deepEqual(entrar, { t: 'entrar', v: VERSAO_PROTOCOLO, nome: [1, 2], avatar: { cor: 1, chapeu: 0 }, idioma: 'pt', sala: 'teste', bots: 3 });
  assert.ok(t.enviadas.some((m) => m.t === 'ping'), 'ping inicial');
  t.receber({ t: 'bemvindo', sessao: 'a'.repeat(32), jogadorId: 'a-h1', sala: { estado: 'saguao' }, relogio: 5000, salaId: 'a-1' });
  assert.equal(rede.estado, 'online');
  assert.deepEqual(estados, ['conectando', 'online']);
  assert.equal(mensagens[0].t, 'bemvindo');
  assert.ok(String(memoria.sessao).includes('a'.repeat(32)));
  t.receber({ t: 'sala', sala: { estado: 'rodada' } });
  assert.equal(mensagens[1].t, 'sala');
});

test('o relogio do servidor e estimado pelo pong de menor ida e volta', () => {
  const { rede, relogio, transportes } = montar();
  rede.conectar();
  const t = transportes[0];
  t.abrir();
  const ping = t.enviadas.find((m) => m.t === 'ping');
  relogio.avancar(40);
  t.receber({ t: 'pong', id: ping.id, tc: ping.tc, ts: 90000 + ping.tc + 20 });
  assert.ok(Math.abs(rede.deslocamento - 90000) < 1, `deslocamento ${rede.deslocamento}`);
  assert.equal(rede.rtt, 40);
  assert.ok(Math.abs(rede.paraLocal(90000 + 5000) - 5000) < 1);
  // um pong pior nao piora a estimativa
  relogio.avancar(400);
  const p2 = t.enviadas.filter((m) => m.t === 'ping').pop();
  relogio.avancar(300);
  t.receber({ t: 'pong', id: p2.id, tc: p2.tc, ts: 95000 + p2.tc + 150 });
  assert.equal(rede.rtt, 40);
});

test('queda: reconecta com recuo, reenvia tracos recentes com o token, e depois de 5 falhas cai para local', () => {
  const { rede, relogio, transportes, estados } = montar();
  rede.conectar();
  transportes[0].abrir();
  transportes[0].receber({ t: 'bemvindo', sessao: 'b'.repeat(32), jogadorId: 'a-h1', sala: {}, relogio: 0, salaId: 'a-1' });
  rede.enviar({ t: 'traco', zona: 'topo', ferramenta: 'tesoura', intensidade: 0.5, precisao: 1, direcao: '', seq: 0 });
  relogio.avancar(100);
  transportes[0].cair();
  assert.equal(rede.estado, 'reconectando');
  assert.equal(transportes.length, 1, 'espera o recuo');
  relogio.avancar(500);
  assert.equal(transportes.length, 2, 'tentou de novo em 500 ms');
  transportes[1].abrir();
  const entrar = transportes[1].enviadas.find((m) => m.t === 'entrar');
  assert.equal(entrar.sessao, 'b'.repeat(32), 'reconecta com o token');
  transportes[1].receber({ t: 'bemvindo', sessao: 'b'.repeat(32), jogadorId: 'a-h1', sala: {}, relogio: 0, salaId: 'a-1' });
  assert.ok(transportes[1].enviadas.some((m) => m.t === 'traco' && m.seq === 0), 'traco pendente reenviado');
  assert.equal(rede.estado, 'online');
  // agora cai de novo: 5 tentativas com recuo falham e a 6a queda leva ao modo local
  for (let i = 0; i < 6; i++) {
    transportes[transportes.length - 1].cair();
    relogio.avancar(9000);
  }
  assert.equal(rede.estado, 'local');
  assert.equal(estados[estados.length - 1], 'local');
  const n = transportes.length;
  relogio.avancar(60000);
  assert.equal(transportes.length, n, 'em modo local nao insiste');
});

test('erro de versao ou sala lotada cai para local na hora; acordar reconecta se caiu', () => {
  const { rede, relogio, transportes } = montar();
  rede.conectar();
  transportes[0].abrir();
  transportes[0].receber({ t: 'erro', codigo: 'versao' });
  assert.equal(rede.estado, 'local');

  const b = montar();
  b.rede.conectar();
  b.transportes[0].abrir();
  b.transportes[0].receber({ t: 'bemvindo', sessao: 'c'.repeat(32), jogadorId: 'x', sala: {}, relogio: 0, salaId: 's' });
  b.transportes[0].cair();
  b.rede.acordar();
  assert.equal(b.transportes.length, 2, 'acordar tenta ja, sem esperar o recuo');
  b.rede.parar();
  assert.equal(b.rede.estado, 'parado');
  b.relogio.avancar(60000);
  assert.equal(b.transportes.length, 2);
  assert.ok(relogio.timersPendentes() >= 0);
});

test('fechamento 4005 (sessao assumida por outra aba): esquece o token e entra como jogador novo', () => {
  const { rede, transportes, memoria } = montar();
  rede.conectar();
  transportes[0].abrir();
  transportes[0].receber({ t: 'bemvindo', sessao: 'd'.repeat(32), jogadorId: 'a-h1', sala: {}, relogio: 0, salaId: 'a-1' });
  assert.ok(String(memoria.sessao).includes('d'.repeat(32)));
  transportes[0].estaAberto = false;
  for (const fn of transportes[0].fechamentos) fn({ codigo: 4005 });
  assert.equal(transportes.length, 2, 'reconectou na hora');
  transportes[1].abrir();
  const entrar = transportes[1].enviadas.find((m) => m.t === 'entrar');
  assert.equal(entrar.sessao, undefined, 'sem token');
  assert.equal(rede.sessao, null);
});
