// Uma sala viva no servidor: o motor compartilhado (src/core/motor-sala.js) mais
// as conexoes dos jogadores, o broadcast de snapshots/deltas/eventos e os deltas periodicos.
import { criarMotor } from '../src/core/motor-sala.js';
import { TEMPOS, TEMPOS_RAPIDOS, LIMITES } from '../src/jogo/constantes.js';

const DELTA_VOTACAO_MS = 500;

/**
 * @param {Object} p
 * @param {string} p.id
 * @param {number} p.semente
 * @param {ReturnType<typeof import('./relogio.js').criarRelogio>} p.relogio
 * @param {ReturnType<typeof import('./config.js').lerConfig>} p.config
 * @param {ReturnType<typeof import('./registro.js').criarRegistro>} p.log
 * @param {() => void} p.aoVazia
 * @param {number} [p.alvoBots]
 */
export function criarSalaViva({ id, semente, relogio, config, log, aoVazia, alvoBots }) {
  /** @type {Map<string, { enviar: (msg: any) => void, fechar: (codigo: number) => void }>} */
  const conexoes = new Map();
  /** @type {Record<string, number>} */
  const ultimoSeq = {};
  let deltaTimer = null;
  const tempos = config.temposRapidos ? TEMPOS_RAPIDOS : TEMPOS;
  const temposSala = config.salaVaziaMs ? { ...tempos, salaVazia: config.salaVaziaMs } : tempos;

  const motor = criarMotor({
    id, semente, relogio, tempos: temposSala,
    bots: { alvo: alvoBots === undefined ? config.bots : alvoBots, prefixo: `${id}-b` },
    aoEventos: (eventos, estado) => {
      const publicos = eventos.filter((e) => e.tipo !== 'recusado');
      if (publicos.length) enviarTodos({ t: 'evento', lista: publicos });
      if (eventos.some((e) => e.tipo === 'estadoMudou' || e.tipo === 'cadeiraTrocou' || e.tipo === 'rodadaComecou' || e.tipo === 'jogadorEntrou' || e.tipo === 'jogadorSaiu' || e.tipo === 'empate')) enviarSnapshots();
      armarDelta(estado.estado);
    },
    aoVazia: () => { log.info('sala vazia', { sala: id }); aoVazia(); },
  });

  /** @param {Record<string, any>} msg */
  function enviarTodos(msg) {
    for (const c of conexoes.values()) c.enviar(msg);
  }
  function enviarSnapshots() {
    for (const [jid, c] of conexoes) c.enviar({ t: 'sala', sala: motor.snapshotPara(jid), relogio: relogio.agora() });
  }
  function armarDelta(estado) {
    const quer = estado === 'rodada' ? Math.round(1000 / Math.max(1, config.deltaHz)) : estado === 'votacao' ? DELTA_VOTACAO_MS : 0;
    if (!quer) { if (deltaTimer) { relogio.cancelar(deltaTimer); deltaTimer = null; } return; }
    if (deltaTimer) return;
    const tique = () => {
      deltaTimer = null;
      const e = motor.estado.estado;
      if (e !== 'rodada' && e !== 'votacao') return;
      enviarTodos({ t: 'delta', ...motor.delta(), relogio: relogio.agora() });
      deltaTimer = relogio.agendar(tique, e === 'rodada' ? Math.round(1000 / Math.max(1, config.deltaHz)) : DELTA_VOTACAO_MS);
    };
    deltaTimer = relogio.agendar(tique, quer);
  }

  const humanos = () => motor.humanos();
  const lotada = () => humanos() >= config.humanosMax || Object.keys(motor.estado.jogadores).length >= config.salaMax;

  return {
    id,
    motor,
    humanos,
    lotada,
    get estado() { return motor.estado.estado; },
    /** O jogador entra (ou volta) com a sua conexao. */
    entrar(jid, conexao, dados) {
      const antiga = conexoes.get(jid);
      if (antiga && antiga !== conexao) {
        // a mesma sessao em duas conexoes (outra aba): a nova vale, a antiga sai com 4005
        conexoes.delete(jid);
        try { antiga.fechar(4005); } catch { /* ignora */ }
      }
      conexoes.set(jid, conexao);
      const existe = !!motor.estado.jogadores[jid];
      const r = existe ? motor.reconectar(jid) : motor.aplicar({ tipo: 'entrar', id: jid, nome: dados.nome, avatar: dados.avatar, vitorias: dados.vitorias, bot: false });
      if (!existe && r.eventos.some((e) => e.tipo === 'recusado')) { conexoes.delete(jid); return false; }
      conexao.enviar({ t: 'bemvindo', sessao: dados.sessao, jogadorId: jid, sala: motor.snapshotPara(jid), relogio: relogio.agora(), v: 1, caminho: dados.caminho, salaId: id });
      log.info(existe ? 'reconectou' : 'entrou', { sala: id, jogador: jid, humanos: humanos() });
      return true;
    },
    desconectar(jid, conexao) {
      if (conexao && conexoes.get(jid) !== conexao) return; // uma conexao mais nova ja assumiu
      conexoes.delete(jid);
      if (motor.estado.jogadores[jid]) motor.desconectar(jid);
    },
    sair(jid) {
      conexoes.delete(jid);
      delete ultimoSeq[jid];
      if (motor.estado.jogadores[jid]) motor.sair(jid);
    },
    /** Mensagem validada do protocolo -> evento do reducer. */
    agir(jid, msg) {
      switch (msg.t) {
        case 'escolher': return motor.aplicar({ tipo: 'escolher', id: jid, opcao: msg.opcao });
        case 'ferramenta': return motor.aplicar({ tipo: 'ferramenta', id: jid, ferramenta: msg.id });
        case 'traco': {
          if (msg.seq <= (ultimoSeq[jid] ?? -1)) return null; // reenvio depois de reconectar
          ultimoSeq[jid] = msg.seq;
          return motor.aplicar({ tipo: 'traco', id: jid, zona: msg.zona, ferramenta: msg.ferramenta, intensidade: msg.intensidade, precisao: msg.precisao, direcao: msg.direcao });
        }
        case 'votar': return motor.aplicar({ tipo: 'votar', id: jid, alvo: msg.alvo });
        case 'reagir': return motor.aplicar({ tipo: 'reagir', id: jid, reacao: msg.reacao });
        case 'torcer': return motor.aplicar({ tipo: 'torcer', id: jid, alvo: msg.alvo });
        case 'caos': return motor.aplicar({ tipo: 'caos', id: jid, acao: msg.acao });
        case 'anuncio': return motor.aplicar({ tipo: 'anuncio', id: jid });
        case 'pronto': {
          const r = motor.aplicar({ tipo: 'pronto', id: jid });
          const c = conexoes.get(jid);
          if (c) c.enviar({ t: 'sala', sala: motor.snapshotPara(jid), relogio: relogio.agora() });
          return r;
        }
        case 'recompensa': return motor.aplicar({ tipo: 'recompensa', id: jid, rodada: msg.rodada });
        default: return null;
      }
    },
    snapshotPara(jid) { return motor.snapshotPara(jid); },
    iniciar() { motor.iniciar(); },
    parar(codigo = 1012) {
      motor.parar();
      if (deltaTimer) { relogio.cancelar(deltaTimer); deltaTimer = null; }
      for (const c of conexoes.values()) { try { c.enviar({ t: 'manutencao' }); c.fechar(codigo); } catch { /* ignora */ } }
      conexoes.clear();
    },
    get conexoes() { return conexoes.size; },
  };
}

export { LIMITES };
