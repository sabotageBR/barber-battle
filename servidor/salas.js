// Gerente de salas: matchmaking, tokens de sessao e vida das salas.
import { randomBytes } from 'node:crypto';
import { criarSalaViva } from './sala-viva.js';
import { hashTexto } from '../src/jogo/aleatorio.js';

const TOKEN_MS = 10 * 60 * 1000;

/**
 * @param {Object} p
 * @param {ReturnType<typeof import('./config.js').lerConfig>} p.config
 * @param {ReturnType<typeof import('./relogio.js').criarRelogio>} p.relogio
 * @param {ReturnType<typeof import('./registro.js').criarRegistro>} p.log
 */
export function criarGerente({ config, relogio, log }) {
  /** @type {Map<string, ReturnType<typeof criarSalaViva>>} */
  const salas = new Map();
  /** @type {Map<string, { salaId: string, jogadorId: string, expiraEm: number }>} */
  const tokens = new Map();
  let proximaSala = 1;
  let proximoJogador = 1;

  function novaSala(nome, alvoBots) {
    const id = nome ? `${config.shard}-${nome}` : `${config.shard}-${proximaSala++}`;
    const sala = criarSalaViva({
      id, semente: (hashTexto(id) ^ Date.now()) >>> 0, relogio, config, log, alvoBots,
      aoVazia: () => destruir(id),
    });
    salas.set(id, sala);
    sala.iniciar();
    log.info('sala criada', { sala: id, bots: alvoBots === undefined ? config.bots : alvoBots });
    return sala;
  }

  function destruir(id) {
    const sala = salas.get(id);
    if (!sala) return;
    if (sala.humanos() > 0) return;
    sala.parar(1000);
    salas.delete(id);
    for (const [tok, v] of tokens) if (v.salaId === id) tokens.delete(tok);
    log.info('sala destruida', { sala: id, restantes: salas.size });
  }

  /** Sala para quem chega sem token: saguao com vaga, senao qualquer com vaga, senao nova. */
  function escolherSala(nome, bots) {
    if (nome) {
      const id = `${config.shard}-${nome}`;
      return salas.get(id) || novaSala(nome, bots);
    }
    const lista = [...salas.values()].filter((s) => !s.lotada());
    const emSaguao = lista.find((s) => s.estado === 'saguao' || s.estado === 'espera');
    return emSaguao || lista[0] || novaSala('', bots);
  }

  function novoToken(salaId, jogadorId) {
    const token = randomBytes(16).toString('hex');
    tokens.set(token, { salaId, jogadorId, expiraEm: relogio.agora() + TOKEN_MS });
    return token;
  }

  return {
    salas,
    /**
     * Entrada de um socket ja validado. Devolve { sala, jogadorId, token } ou null (lotado).
     * @param {{ enviar: Function, fechar: Function }} conexao
     * @param {{ sessao?: string, nome?: any, avatar?: any, sala?: string, bots?: number, caminho?: string }} msg
     */
    entrar(conexao, msg) {
      // reconexao por token
      if (msg.sessao && tokens.has(msg.sessao)) {
        const v = /** @type {any} */ (tokens.get(msg.sessao));
        const sala = salas.get(v.salaId);
        if (sala && sala.motor.estado.jogadores[v.jogadorId] && v.expiraEm > relogio.agora()) {
          v.expiraEm = relogio.agora() + TOKEN_MS;
          if (sala.entrar(v.jogadorId, conexao, { ...msg, sessao: msg.sessao })) return { sala, jogadorId: v.jogadorId, token: msg.sessao };
        }
        tokens.delete(msg.sessao);
      }
      const sala = escolherSala(msg.sala, msg.bots);
      const jogadorId = `${config.shard}-h${proximoJogador++}`;
      const token = novoToken(sala.id, jogadorId);
      if (!sala.entrar(jogadorId, conexao, { ...msg, sessao: token })) { tokens.delete(token); return null; }
      return { sala, jogadorId, token };
    },
    estatisticas() {
      let sockets = 0;
      let humanos = 0;
      for (const s of salas.values()) { sockets += s.conexoes; humanos += s.humanos(); }
      return { salas: salas.size, sockets, humanos };
    },
    pararTudo() {
      for (const s of salas.values()) s.parar(1012);
      salas.clear();
      tokens.clear();
    },
    destruir,
  };
}
