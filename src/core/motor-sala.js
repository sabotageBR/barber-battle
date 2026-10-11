// "Sala viva": liga o reducer puro (src/jogo/sala.js) a um relogio injetado, aos
// bots e as carencias de desconexao. O servidor cria um motor por sala com o
// relogio real; o modo local do cliente cria um motor com o relogio do
// navegador. Nenhum DOM, nenhum socket: so callbacks.
import { criarSala, aplicar, snapshotPara, deltaRodada } from '../jogo/sala.js';
import { decidirBot, criarMemoriaBot } from '../jogo/bots.js';
import { rngPasso } from '../jogo/aleatorio.js';
import { TEMPOS, LIMITES } from '../jogo/constantes.js';

const PASSO_MS = 100;

/**
 * @typedef {Object} Relogio
 * @property {() => number} agora
 * @property {(fn: () => void, ms: number) => any} agendar
 * @property {(id: any) => void} cancelar
 */

/**
 * @param {Object} p
 * @param {string} p.id
 * @param {number} p.semente
 * @param {Relogio} p.relogio
 * @param {typeof TEMPOS} [p.tempos]
 * @param {{ alvo?: number, prefixo?: string, habilidade?: [number, number] }} [p.bots]
 * @param {(eventos: Array<Record<string, any>>, estado: import('../jogo/sala.js').Sala) => void} [p.aoEventos]
 * @param {() => void} [p.aoVazia]   sala sem humano por tempos.salaVazia
 */
export function criarMotor({ id, semente, relogio, tempos = TEMPOS, bots = {}, aoEventos, aoVazia }) {
  const { agora, agendar, cancelar } = relogio;
  let estado = criarSala({ id, semente, agora: agora(), tempos });
  const alvoBots = bots.alvo === undefined ? LIMITES.bots : bots.alvo;
  const prefixoBot = bots.prefixo || 'bot';
  const faixaHab = bots.habilidade || [0.45, 0.9];
  let rngBots = ((semente >>> 0) ^ 0x9e3779b9) >>> 0;
  /** @type {Record<string, import('../jogo/bots.js').MemoriaBot>} */
  const memorias = {};
  /** @type {{ fim: any, tique: any, graca: Record<string, any> }} */
  const timers = { fim: null, tique: null, graca: {} };
  let nBots = 0;
  let parado = false;
  let ultimoFimEm = -1;
  /** @type {number|null} */
  let vaziaDesde = null;
  let avisouVazia = false;

  function sortear() {
    const p = rngPasso(rngBots);
    rngBots = p.a;
    return p.v;
  }

  /** @param {Array<Record<string, any>>} eventos */
  function emitir(eventos) {
    if (eventos.length && aoEventos) aoEventos(eventos, estado);
  }

  /** @param {Record<string, any>} ev */
  function aplicarInterno(ev) {
    const r = aplicar(estado, ev);
    estado = r.estado;
    emitir(r.eventos);
    rearmar();
    return r;
  }

  function cancelarTimer(id) {
    if (id === null || id === undefined) return;
    try { cancelar(id); } catch { /* ignora */ }
  }

  /**
   * Timer do fim do estado. O atraso e arredondado para cima e, se o relogio ainda nao chegou
   * em fimEm quando ele dispara (setTimeout trunca fracoes), re-arma em vez de deixar a sala
   * presa num tique que nao transita.
   */
  function armarFim() {
    cancelarTimer(timers.fim);
    timers.fim = null;
    if (!estado.fimEm) return;
    const atraso = Math.max(0, Math.ceil(estado.fimEm - agora())) + 1;
    timers.fim = agendar(() => {
      timers.fim = null;
      if (parado) return;
      if (agora() < estado.fimEm) { armarFim(); return; }
      aplicarInterno({ tipo: 'tique', t: agora() });
    }, atraso);
  }

  function rearmar() {
    if (parado) return;
    if (estado.fimEm !== ultimoFimEm) {
      ultimoFimEm = estado.fimEm;
      armarFim();
    }
    if (!timers.tique && estado.estado !== 'espera') timers.tique = agendar(passo, PASSO_MS);
  }

  function humanos() {
    return Object.values(estado.jogadores).filter((j) => !j.bot).length;
  }

  /** @param {number} t */
  function adicionarBot(t) {
    nBots += 1;
    const idBot = `${prefixoBot}-${nBots}`;
    memorias[idBot] = criarMemoriaBot(((semente >>> 0) + nBots * 7919) >>> 0);
    const habilidade = faixaHab[0] + (faixaHab[1] - faixaHab[0]) * sortear();
    aplicarInterno({
      tipo: 'entrar', id: idBot, bot: true, habilidade, t,
      nome: [Math.floor(sortear() * 24), Math.floor(sortear() * 24)], avatar: { cor: Math.floor(sortear() * 8), chapeu: 0 },
    });
  }

  /** Bots completam a sala ate o alvo; o excedente so sai na transicao e nunca da cadeira. @param {number} t */
  function ajustarBots(t) {
    const h = humanos();
    const alvo = Math.max(0, Math.min(alvoBots - h, LIMITES.salaMax - h));
    const atuais = Object.values(estado.jogadores).filter((j) => j.bot);
    for (let i = atuais.length; i < alvo; i++) adicionarBot(t);
    if (atuais.length > alvo && estado.estado === 'transicao') {
      const sobram = atuais.filter((j) => !estado.cadeiras.includes(j.id)).slice(0, atuais.length - alvo);
      for (const j of sobram) {
        delete memorias[j.id];
        aplicarInterno({ tipo: 'sair', id: j.id, t });
      }
    }
    if (h === 0) {
      if (vaziaDesde === null) vaziaDesde = t;
      else if (!avisouVazia && t - vaziaDesde >= tempos.salaVazia && aoVazia) { avisouVazia = true; aoVazia(); }
    } else {
      vaziaDesde = null;
      avisouVazia = false;
    }
  }

  function passo() {
    timers.tique = null;
    if (parado) return;
    const t = agora();
    for (const idBot of Object.keys(memorias)) {
      if (!estado.jogadores[idBot]) { delete memorias[idBot]; continue; }
      const d = decidirBot(estado, idBot, t, memorias[idBot]);
      memorias[idBot] = d.memoria;
      if (d.evento) aplicarInterno(d.evento);
    }
    if (estado.estado === 'rodada') aplicarInterno({ tipo: 'tique', t });
    ajustarBots(t);
    if (!parado && estado.estado !== 'espera' && !timers.tique) timers.tique = agendar(passo, PASSO_MS);
  }

  /** @param {string} idJ */
  function cancelarGraca(idJ) {
    cancelarTimer(timers.graca[idJ]);
    delete timers.graca[idJ];
  }

  /**
   * Desconexao: carencia antes de perder a cadeira e, depois, a vaga.
   * @param {string} idJ
   */
  function desconectar(idJ) {
    const t = agora();
    aplicarInterno({ tipo: 'desconectar', id: idJ, t });
    const j = estado.jogadores[idJ];
    if (!j) return;
    cancelarGraca(idJ);
    const gracaVaga = j.emAnuncio ? tempos.gracaAnuncio : tempos.gracaJogador;
    const sair = () => {
      delete timers.graca[idJ];
      const k = estado.jogadores[idJ];
      if (k && !k.conectado) aplicarInterno({ tipo: 'sair', id: idJ, t: agora() });
    };
    if (estado.cadeiras.includes(idJ)) {
      timers.graca[idJ] = agendar(() => {
        delete timers.graca[idJ];
        const k = estado.jogadores[idJ];
        if (!k || k.conectado) return;
        if (estado.cadeiras.includes(idJ)) aplicarInterno({ tipo: 'abandonarCadeira', id: idJ, t: agora(), motivo: 'desconectou' });
        timers.graca[idJ] = agendar(sair, Math.max(0, gracaVaga - tempos.gracaBarbeiro));
      }, tempos.gracaBarbeiro);
    } else timers.graca[idJ] = agendar(sair, gracaVaga);
  }

  /** @param {string} idJ */
  function reconectar(idJ) {
    cancelarGraca(idJ);
    return aplicarInterno({ tipo: 'reconectar', id: idJ, t: agora() });
  }

  return {
    get estado() { return estado; },
    /** Evento externo (de um socket ou da UI local); o t e o de agora. @param {Record<string, any>} ev */
    aplicar(ev) { return aplicarInterno({ ...ev, t: ev.t === undefined ? agora() : ev.t }); },
    desconectar,
    reconectar,
    /** @param {string} idJ */
    sair(idJ) { cancelarGraca(idJ); delete memorias[idJ]; return aplicarInterno({ tipo: 'sair', id: idJ, t: agora() }); },
    /** @param {string} [idJ] */
    snapshotPara(idJ) { return snapshotPara(estado, idJ); },
    delta() { return deltaRodada(estado); },
    humanos,
    bots() { return Object.values(estado.jogadores).filter((j) => j.bot).length; },
    /** Entra na vida: enche de bots e arma os timers. */
    iniciar() {
      parado = false;
      ajustarBots(agora());
      rearmar();
    },
    parar() {
      parado = true;
      cancelarTimer(timers.fim);
      cancelarTimer(timers.tique);
      timers.fim = null;
      timers.tique = null;
      for (const k of Object.keys(timers.graca)) cancelarGraca(k);
    },
    get parado() { return parado; },
  };
}
