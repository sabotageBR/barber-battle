// Fila por ordem de chegada e escolha das cadeiras. Humanos antes de bots.
// Modulo puro: recebe o mapa de jogadores e a fila (ids) e devolve listas novas.

/**
 * @typedef {Object} JogadorFila
 * @property {string} id
 * @property {boolean} bot
 * @property {boolean} conectado
 * @property {boolean} emAnuncio
 * @property {string} escolha   '' | 'jogar' | 'assistir'
 * @property {string} papel     'barbeiro' | 'espectador'
 */

/** @param {string[]} fila @param {string} id */
export function entrarNaFila(fila, id) {
  return fila.includes(id) ? fila : [...fila, id];
}

/** @param {string[]} fila @param {string} id */
export function sairDaFila(fila, id) {
  return fila.filter((x) => x !== id);
}

/**
 * Leva os ids ao fim da fila, mantendo a ordem relativa entre eles.
 * @param {string[]} fila @param {string[]} ids
 */
export function paraOFim(fila, ids) {
  const vao = fila.filter((x) => ids.includes(x));
  return [...fila.filter((x) => !ids.includes(x)), ...vao];
}

/** Posicao (1 = proximo) de cada id na fila. */
export function posicoes(fila) {
  /** @type {Record<string, number>} */
  const p = {};
  fila.forEach((id, i) => { p[id] = i + 1; });
  return p;
}

/**
 * Candidatos a cadeira, na ordem de prioridade: quem escolheu jogar, esta conectado
 * e nao esta em anuncio; humanos antes de bots; dentro de cada grupo, ordem da fila.
 * @param {string[]} fila
 * @param {Record<string, JogadorFila>} jogadores
 * @param {string[]} [excluir]
 */
export function candidatos(fila, jogadores, excluir = []) {
  const aptos = fila.filter((id) => {
    const j = jogadores[id];
    return j && !excluir.includes(id) && j.escolha === 'jogar' && j.conectado && !j.emAnuncio;
  });
  return [...aptos.filter((id) => !jogadores[id].bot), ...aptos.filter((id) => jogadores[id].bot)];
}

/**
 * Escolhe `n` ocupantes para as cadeiras. Faltando candidato, completa com humanos
 * conectados (qualquer escolha, fora de anuncio) e depois com bots conectados.
 * @param {string[]} fila
 * @param {Record<string, JogadorFila>} jogadores
 * @param {number} n
 * @param {string[]} [excluir]
 */
export function escolherCadeiras(fila, jogadores, n, excluir = []) {
  const escolhidos = candidatos(fila, jogadores, excluir).slice(0, n);
  if (escolhidos.length < n) {
    const reserva = fila.filter((id) => {
      const j = jogadores[id];
      return j && !excluir.includes(id) && !escolhidos.includes(id) && j.conectado && !j.emAnuncio;
    });
    for (const id of [...reserva.filter((id) => !jogadores[id].bot), ...reserva.filter((id) => jogadores[id].bot)]) {
      if (escolhidos.length >= n) break;
      escolhidos.push(id);
    }
  }
  return escolhidos;
}

/**
 * Substituto para uma cadeira abandonada no meio da rodada: primeiro espectador
 * humano conectado que escolheu jogar, senao humano conectado, senao bot conectado.
 * @param {string[]} fila
 * @param {Record<string, JogadorFila>} jogadores
 * @param {string[]} excluir   quem ja esta em cadeira ou saiu
 */
export function substituto(fila, jogadores, excluir) {
  const livres = fila.filter((id) => {
    const j = jogadores[id];
    return j && !excluir.includes(id) && j.papel !== 'barbeiro' && j.conectado && !j.emAnuncio;
  });
  return livres.find((id) => !jogadores[id].bot && jogadores[id].escolha === 'jogar')
    || livres.find((id) => !jogadores[id].bot)
    || livres.find((id) => jogadores[id].bot)
    || null;
}
