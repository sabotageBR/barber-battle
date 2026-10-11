// Sobe o servidor de verdade numa porta livre e joga com clientes WebSocket.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iniciar } from '../index.js';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/** Cliente de teste: guarda tudo que chega. */
function cliente(porta, origem) {
  const ws = new WebSocket(`ws://127.0.0.1:${porta}/ws`, origem ? { headers: { origin: origem } } : undefined);
  const recebidas = [];
  const c = {
    ws, recebidas, fechado: null,
    enviar: (m) => ws.send(JSON.stringify(m)),
    tipo: (t) => recebidas.filter((m) => m.t === t),
    eventos: () => recebidas.filter((m) => m.t === 'evento').flatMap((m) => m.lista),
    async ate(fn, ms = 4000) {
      const fim = Date.now() + ms;
      while (Date.now() < fim) { if (fn()) return true; await espera(25); }
      return false;
    },
    abrir: () => new Promise((ok, falha) => { ws.onopen = () => ok(null); ws.onerror = (e) => falha(new Error('erro ' + (e.message || ''))); }),
    fechar: () => ws.close(),
  };
  ws.onmessage = (e) => { try { recebidas.push(JSON.parse(e.data)); } catch { /* ignora */ } };
  ws.onclose = (e) => { c.fechado = e.code; };
  return c;
}

test('dois clientes entram na mesma sala, jogam uma rodada com bots e veem o mesmo resultado', async () => {
  const s = await iniciar({ porta: 0, host: '127.0.0.1', temposRapidos: true, logLevel: 'erro', checarOrigem: false, salaVaziaMs: 2000 });
  try {
    const a = cliente(s.porta);
    const b = cliente(s.porta);
    await a.abrir();
    await b.abrir();
    a.enviar({ t: 'entrar', v: 1, nome: [1, 1], avatar: { cor: 1, chapeu: 0 }, sala: 'teste', bots: 4 });
    b.enviar({ t: 'entrar', v: 1, nome: [2, 2], avatar: { cor: 2, chapeu: 0 }, sala: 'teste' });
    assert.ok(await a.ate(() => a.tipo('bemvindo').length === 1));
    assert.ok(await b.ate(() => b.tipo('bemvindo').length === 1));
    const bvA = a.tipo('bemvindo')[0];
    const bvB = b.tipo('bemvindo')[0];
    assert.equal(bvA.salaId, bvB.salaId);
    assert.notEqual(bvA.jogadorId, bvB.jogadorId);
    assert.ok(/^[0-9a-f]{32}$/.test(bvA.sessao));
    assert.ok(!('bot' in Object.values(bvA.sala.jogadores)[0]));
    a.enviar({ t: 'escolher', opcao: 'jogar' });
    b.enviar({ t: 'escolher', opcao: 'jogar' });
    assert.ok(await a.ate(() => a.tipo('sala').some((m) => m.sala.estado === 'rodada'), 8000), 'rodada comecou');
    const rodada = a.tipo('sala').find((m) => m.sala.estado === 'rodada').sala;
    assert.deepEqual(rodada.cadeiras.sort(), [bvA.jogadorId, bvB.jogadorId].sort(), 'humanos nas cadeiras');
    for (let i = 0; i < 6; i++) {
      a.enviar({ t: 'traco', zona: 'topo', ferramenta: 'tesoura', intensidade: 0.5, seq: i });
      await espera(60);
    }
    assert.ok(await a.ate(() => a.tipo('delta').some((d) => d.cliente[bvA.jogadorId] && d.cliente[bvA.jogadorId].zonas.topo[0] < 1)), 'delta mostra o corte');
    assert.ok(await b.ate(() => b.tipo('delta').some((d) => d.cliente[bvA.jogadorId] && d.cliente[bvA.jogadorId].zonas.topo[0] < 1)), 'o rival ve o corte');
    assert.ok(await a.ate(() => a.eventos().some((e) => e.tipo === 'resultado'), 30000), 'resultado chegou');
    const ra = a.eventos().find((e) => e.tipo === 'resultado');
    const rb = b.eventos().find((e) => e.tipo === 'resultado');
    assert.deepEqual(ra, rb);
    assert.ok(ra.vencedor === bvA.jogadorId || ra.vencedor === bvB.jogadorId);
    a.enviar({ t: 'ping', id: 7, tc: 1234 });
    assert.ok(await a.ate(() => a.tipo('pong').some((p) => p.id === 7 && p.tc === 1234)), `pong nao veio: fechado=${a.fechado} pongs=${JSON.stringify(a.tipo('pong'))} ultimas=${a.recebidas.slice(-3).map((m) => m.t)}`);
    a.fechar();
    b.fechar();
  } finally {
    await s.fechar();
  }
});

test('reconexao com token mantem o jogador; origem proibida e versao errada sao recusadas; estouro fecha com 4008', async () => {
  const s = await iniciar({ porta: 0, host: '127.0.0.1', temposRapidos: true, logLevel: 'erro', checarOrigem: true, origens: ['https://barberbattle.io'], salaVaziaMs: 2000 });
  try {
    const a = cliente(s.porta, 'https://barberbattle.io');
    await a.abrir();
    a.enviar({ t: 'entrar', v: 1, nome: [1, 1], avatar: { cor: 1, chapeu: 0 }, sala: 'r' });
    assert.ok(await a.ate(() => a.tipo('bemvindo').length === 1));
    const bv = a.tipo('bemvindo')[0];
    a.fechar();
    await espera(100);
    const a2 = cliente(s.porta, 'https://barberbattle.io');
    await a2.abrir();
    a2.enviar({ t: 'entrar', v: 1, sessao: bv.sessao, sala: 'r' });
    assert.ok(await a2.ate(() => a2.tipo('bemvindo').length === 1));
    assert.equal(a2.tipo('bemvindo')[0].jogadorId, bv.jogadorId, 'mesmo id');
    assert.equal(a2.tipo('bemvindo')[0].sala.jogadores[bv.jogadorId].conectado, true);

    // a mesma sessao numa segunda conexao: a antiga recebe 4005 e a nova segue valendo
    const a3 = cliente(s.porta, 'https://barberbattle.io');
    await a3.abrir();
    a3.enviar({ t: 'entrar', v: 1, sessao: bv.sessao, sala: 'r' });
    assert.ok(await a3.ate(() => a3.tipo('bemvindo').length === 1));
    assert.ok(await a2.ate(() => a2.fechado === 4005), 'a conexao antiga nao foi fechada com 4005');
    a3.enviar({ t: 'ping', id: 3, tc: 3 });
    assert.ok(await a3.ate(() => a3.tipo('pong').length === 1), 'a conexao nova parou de responder');
    assert.equal(s.gerente.salas.get('a-r').motor.estado.jogadores[bv.jogadorId].conectado, true, 'o jogador ficou desconectado');

    const ruim = cliente(s.porta, 'https://evil.example');
    await assert.rejects(ruim.abrir());

    const velho = cliente(s.porta, 'https://barberbattle.io');
    await velho.abrir();
    velho.enviar({ t: 'entrar', v: 99 });
    assert.ok(await velho.ate(() => velho.fechado === 4001));

    const spam = cliente(s.porta, 'https://barberbattle.io');
    await spam.abrir();
    spam.enviar({ t: 'entrar', v: 1, sala: 'r' });
    assert.ok(await spam.ate(() => spam.tipo('bemvindo').length === 1));
    for (let i = 0; i < 60; i++) spam.enviar({ t: 'reagir', reacao: 1 });
    assert.ok(await spam.ate(() => spam.fechado === 4008));
    a3.fechar();
  } finally {
    await s.fechar();
  }
});

test('/healthz responde e sala vazia e destruida', async () => {
  const s = await iniciar({ porta: 0, host: '127.0.0.1', temposRapidos: true, logLevel: 'erro', checarOrigem: false, salaVaziaMs: 300 });
  try {
    const a = cliente(s.porta);
    await a.abrir();
    a.enviar({ t: 'entrar', v: 1, sala: 'v' });
    assert.ok(await a.ate(() => a.tipo('bemvindo').length === 1));
    let h = await (await fetch(`http://127.0.0.1:${s.porta}/healthz`)).json();
    assert.equal(h.salas, 1);
    assert.equal(h.humanos, 1);
    a.fechar();
    await espera(100);
    s.gerente.salas.get('a-v').motor.sair(a.tipo('bemvindo')[0].jogadorId);
    await espera(900);
    h = await (await fetch(`http://127.0.0.1:${s.porta}/healthz`)).json();
    assert.equal(h.salas, 0, 'sala destruida');
  } finally {
    await s.fechar();
  }
});
