// Relogio falso para os testes: tempo, timers e rAF controlados a mao.
// Arquivo de apoio: so exporta (o node --test roda todo .js de test/, inclusive este).

/**
 * @typedef {Object} RelogioFalso
 * @property {() => number} agora                         tempo atual em ms
 * @property {(fn: () => void, ms: number) => number} agendar   como setTimeout
 * @property {(id: number) => void} cancelar              como clearTimeout
 * @property {(ms: number) => void} avancar               anda o tempo e dispara os timers vencidos, em ordem
 * @property {(fn: (t: number) => void) => number} raf    como requestAnimationFrame
 * @property {(id: number) => void} caf                   como cancelAnimationFrame
 * @property {(ms: number) => void} quadro                anda ms e dispara os rAF pendentes com o tempo novo
 * @property {() => number} timersPendentes
 * @property {() => number} quadrosPendentes
 */

/**
 * @param {number} [inicio=0] tempo inicial em ms
 * @returns {RelogioFalso}
 */
export function criarRelogioFalso(inicio = 0) {
  let agora = inicio;
  let proximoId = 1;
  /** @type {Map<number, { quando: number, fn: () => void }>} */
  const timers = new Map();
  /** @type {Map<number, (t: number) => void>} */
  const quadros = new Map();

  function agendar(fn, ms) {
    const id = proximoId++;
    timers.set(id, { quando: agora + Math.max(0, Number(ms) || 0), fn });
    return id;
  }

  function cancelar(id) {
    timers.delete(id);
  }

  function avancar(ms) {
    const alvo = agora + ms;
    for (;;) {
      // o mais cedo primeiro; empate fica com quem foi agendado antes (ordem do Map)
      let idEscolhido = 0;
      let escolhido = null;
      for (const [id, t] of timers) {
        if (t.quando <= alvo && (!escolhido || t.quando < escolhido.quando)) {
          escolhido = t;
          idEscolhido = id;
        }
      }
      if (!escolhido) break;
      timers.delete(idEscolhido);
      agora = escolhido.quando;
      escolhido.fn();
    }
    agora = alvo;
  }

  function raf(fn) {
    const id = proximoId++;
    quadros.set(id, fn);
    return id;
  }

  function caf(id) {
    quadros.delete(id);
  }

  function quadro(ms) {
    avancar(ms);
    const lista = Array.from(quadros.values());
    quadros.clear();
    for (const fn of lista) fn(agora);
  }

  return {
    agora: () => agora,
    agendar,
    cancelar,
    avancar,
    raf,
    caf,
    quadro,
    timersPendentes: () => timers.size,
    quadrosPendentes: () => quadros.size,
  };
}

/**
 * Deixa rodar todas as microtarefas pendentes (promessas encadeadas).
 * @returns {Promise<void>}
 */
export function esvaziar() {
  return new Promise((resolve) => setImmediate(resolve));
}
