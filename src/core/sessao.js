// Sessao: o que a UI consome, igual no modo local (motor em memoria com bots)
// e no modo online (socket). Interface:
//   sessao.voce            id do jogador
//   sessao.snapshot()      ultimo snapshot da sala (ou null)
//   sessao.clientes        clientes mais recentes (delta), por id
//   sessao.agir(msg)       { tipo: 'escolher'|'ferramenta'|'traco'|'votar'|'reagir'|'torcer'|'caos'|'anuncio'|'pronto'|'recompensa', ... }
//   sessao.drenarEventos() eventos desde a ultima chamada
//   sessao.iniciar() / sessao.parar()
import { criarMotor } from './motor-sala.js';
import { TEMPOS, TEMPOS_RAPIDOS, LIMITES } from '../jogo/constantes.js';
import { temaPorId } from '../jogo/temas.js';
import { hashTexto } from '../jogo/aleatorio.js';

/**
 * Sessao local: uma sala viva dentro do navegador, com bots.
 * @param {Object} p
 * @param {{ agora: () => number, agendar: Function, cancelar: Function }} p.relogio
 * @param {{ nome: [number, number], avatar: { cor: number, chapeu: number }, vitorias?: number }} p.perfil
 * @param {{ rapido?: boolean, bots?: number, papel?: string, tema?: string, estado?: string, semente?: number }} [p.opcoes]
 */
export function criarSessaoLocal({ relogio, perfil, opcoes = {} }) {
  const voce = 'voce';
  // o atalho ?estado= pula no tempo; sem tracos a regra de ocioso tiraria a cadeira do humano
  const base = opcoes.rapido ? TEMPOS_RAPIDOS : TEMPOS;
  const tempos = opcoes.estado ? { ...base, ocioso: 1e12 } : base;
  /** @type {Array<Record<string, any>>} */
  let fila = [];
  const semente = opcoes.semente === undefined ? (hashTexto(String(relogio.agora())) ^ 0x51ed) >>> 0 : opcoes.semente;
  const motor = criarMotor({
    id: 'local', semente, relogio, tempos,
    bots: { alvo: opcoes.bots === undefined || opcoes.bots < 0 ? Math.min(LIMITES.bots, 7) + 1 : opcoes.bots + 1 },
    aoEventos: (eventos) => { fila.push(...eventos); },
  });
  /** @type {Record<string, any>} */
  let clientes = {};
  function atualizarClientes() {
    const d = motor.delta();
    clientes = d.cliente || {};
  }
  return {
    tipo: 'local',
    voce,
    get online() { return false; },
    snapshot() { return motor.snapshotPara(voce); },
    get clientes() { atualizarClientes(); return clientes; },
    /** @param {Record<string, any>} msg */
    agir(msg) {
      const r = motor.aplicar({ ...msg, id: voce });
      return r;
    },
    drenarEventos() {
      const e = fila;
      fila = [];
      return e;
    },
    iniciar() {
      motor.iniciar();
      motor.aplicar({ tipo: 'entrar', id: voce, nome: perfil.nome, avatar: perfil.avatar, vitorias: perfil.vitorias || 0 });
      // atalhos de teste: tema da primeira rodada e comeco direto na rodada
      if (opcoes.tema && temaPorId(opcoes.tema)) motor.estado.temaProx = temaPorId(opcoes.tema);
      if (opcoes.papel === 'barbeiro' || opcoes.estado === 'rodada' || opcoes.estado === 'votacao' || opcoes.estado === 'resultado') {
        motor.aplicar({ tipo: 'escolher', id: voce, opcao: opcoes.papel === 'espectador' ? 'assistir' : 'jogar' });
        for (const j of Object.values(motor.estado.jogadores)) if (j.bot && !j.escolha) motor.aplicar({ tipo: 'escolher', id: j.id, opcao: 'jogar' });
      }
      if (opcoes.estado && opcoes.estado !== 'saguao') {
        const alvo = ['rodada', 'votacao', 'resultado'];
        const ate = alvo.indexOf(opcoes.estado);
        for (let i = 0; i <= ate && i < 3; i++) {
          if (motor.estado.estado === 'votacao') {
            // votos da plateia para a primeira cadeira, para o resultado ter vencedor
            const alvoVoto = motor.estado.cadeiras[0];
            for (const j of Object.values(motor.estado.jogadores)) if (j.bot && j.papel !== 'barbeiro') motor.aplicar({ tipo: 'votar', id: j.id, alvo: alvoVoto, t: motor.estado.inicioEm + 10 });
          }
          motor.aplicar({ tipo: 'tique', t: motor.estado.fimEm });
        }
      }
    },
    parar() { motor.parar(); },
    motor,
  };
}

/**
 * Sessao remota: espelha o que o servidor manda (sala, delta, evento) e traduz
 * os gestos da UI para o protocolo. Os instantes vem no relogio do servidor e
 * sao convertidos para o relogio local pela rede.
 * @param {Object} p
 * @param {ReturnType<typeof import('./rede.js').criarRede>} p.rede
 * @param {(id: string) => void} [p.aoIdentidade]
 */
export function criarSessaoRemota({ rede, aoIdentidade }) {
  let voce = '';
  /** @type {any} */
  let snap = null;
  /** @type {Record<string, any>} */
  let clientes = {};
  /** @type {Array<Record<string, any>>} */
  let fila = [];
  let seq = 0;

  function converter(s) {
    if (!s) return s;
    const c = { ...s };
    for (const k of ['inicioEm', 'fimEm']) if (typeof c[k] === 'number' && c[k]) c[k] = rede.paraLocal(c[k]);
    if (Array.isArray(c.caos)) c.caos = c.caos.map((x) => ({ ...x, ate: rede.paraLocal(x.ate) }));
    return c;
  }

  const sessao = {
    tipo: 'remota',
    get voce() { return voce; },
    get online() { return rede.estado === 'online'; },
    snapshot() { return snap; },
    get clientes() { return clientes; },
    /** @param {Record<string, any>} msg */
    agir(msg) {
      switch (msg.tipo) {
        case 'escolher': rede.enviar({ t: 'escolher', opcao: msg.opcao }); break;
        case 'ferramenta': rede.enviar({ t: 'ferramenta', id: msg.ferramenta }); break;
        case 'traco': rede.enviar({ t: 'traco', zona: msg.zona, ferramenta: msg.ferramenta, intensidade: msg.intensidade, precisao: msg.precisao === undefined ? 1 : msg.precisao, direcao: msg.direcao || '', seq: seq++ }); break;
        case 'votar': rede.enviar({ t: 'votar', alvo: msg.alvo }); break;
        case 'reagir': rede.enviar({ t: 'reagir', reacao: msg.reacao }); break;
        case 'torcer': rede.enviar({ t: 'torcer', alvo: msg.alvo }); break;
        case 'caos': rede.enviar({ t: 'caos', acao: msg.acao }); break;
        case 'anuncio': rede.enviar({ t: 'anuncio' }); break;
        case 'pronto': rede.enviar({ t: 'pronto' }); break;
        case 'recompensa': rede.enviar({ t: 'recompensa', rodada: msg.rodada }); break;
        default: break;
      }
      return null;
    },
    drenarEventos() {
      const e = fila;
      fila = [];
      return e;
    },
    /** Mensagem do servidor (chamada pela rede). @param {Record<string, any>} m */
    receber(m) {
      if (m.t === 'bemvindo') {
        voce = m.jogadorId;
        snap = converter(m.sala);
        clientes = snap && snap.cliente ? { ...snap.cliente } : {};
        if (aoIdentidade) aoIdentidade(voce);
        return;
      }
      if (m.t === 'sala') { snap = converter(m.sala); clientes = snap && snap.cliente ? { ...snap.cliente } : {}; return; }
      if (m.t === 'delta') {
        clientes = m.cliente || {};
        if (snap) snap = { ...snap, estado: m.estado, fimEm: rede.paraLocal(m.fimEm), ferramenta: m.ferramenta || snap.ferramenta, torcida: m.torcida || snap.torcida, dormindo: m.dormindo || snap.dormindo };
        return;
      }
      if (m.t === 'evento' && Array.isArray(m.lista)) fila.push(...m.lista);
    },
    iniciar() { rede.conectar(); },
    parar() { rede.parar(); },
    rede,
  };
  return sessao;
}
