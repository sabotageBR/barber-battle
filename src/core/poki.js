// Camada unica de contato com o SDK da Poki (copia de 2048_cards/src/core/poki.js, que vem de
// carimbador-maluco e do hexadrop), mais openExternalLink e idioma para o Barber Battle.
// Somente src/main.js importa este modulo (vigiado por test/estilo.test.js).
//
// O script v2 e so um carregador: ele injeta o nucleo com onload, sem onerror nem prazo. Com um
// bloqueador de anuncios, o nucleo nunca chega e as promessas do SDK ficam pendentes para sempre.
// Por isso toda promessa aqui tem prazo (init 4 s, anuncio 45 s) e toda chamada tem guarda de
// existencia. O jogo se comporta igual com e sem SDK, e nenhum texto menciona bloqueador.
// O prazo de 45 s do anuncio vale so ate ele COMECAR (o onStart que o SDK chama quando o video
// entra na tela): e o caso do bloqueador, com a promessa pendurada. Depois do onStart o jogo
// espera a resposta real, com um teto de seguranca de 180 s (um video longo carregando devagar
// nao pode devolver o som e o jogo por baixo dele, nem descartar um true que chega depois).
//
// Regras:
// - sdkPronto so liga quando o init RESPONDE; rejeitar tambem e resposta (e o proprio SDK dizendo
//   que carregou e sabe se virar). No prazo de 4 s o init() resolve assim mesmo, com sdkPronto
//   falso; se a resposta vier depois, o SDK liga dali em diante;
// - o SDK so recebe chamadas com sdkPronto. Antes disso o estado fica guardado (loading pedido,
//   jogando ou nao, measures) e e enviado na ordem certa quando ele ligar: loading, gameplay,
//   measures. O input do jogo nunca espera nada daqui;
// - gameLoadingFinished uma vez; gameplayStart antes dele emite o loading antes;
// - gameplayStart e gameplayStop idempotentes, e nada durante um anuncio;
// - anuncio: gameplayStop, onAdStart (audio mudo) ANTES da chamada ao SDK, e onAdEnd no fim;
// - rewarded so premia com === true ('true', 1, {} e rejeicao nao premiam);
// - commercialBreak recusado antes do primeiro gameplayStart (jaJogou);
// - measure troca '/' e '^' por '-' (a Poki usa os dois como separador) e fica calado no anuncio.
//
// Diferencas para o hexadrop: dependencias injetaveis (obterSdk, prazos, agendar, cancelar), sem
// platform.js nem import.meta.env, fila de estado ate o sdkPronto, onAdStart uma vez so (antes
// da chamada), getDeviceInfo sem atrasar o init() e aceitando resposta sincrona.

/** Prazos em ms. */
export const PRAZOS_PADRAO = Object.freeze({ init: 4000, intervalo: 45000, info: 1500, aposInicio: 180000 });

const MAX_FILA_MEDIDAS = 100;

/** @param {unknown} v */
const limparCampo = (v) => String(v ?? '').replace(/[/^]/g, '-');

/**
 * @typedef {Object} Prazos
 * @property {number} [init]        ms ate o init() desistir de esperar (sdkPronto fica falso)
 * @property {number} [intervalo]   ms ate um anuncio (commercial ou rewarded) desistir, se nao comecou
 * @property {number} [aposInicio]  teto de seguranca (ms) depois do onStart do anuncio
 * @property {number} [info]        ms ate getDeviceInfo desistir
 */

/**
 * @typedef {Object} OpcoesPoki
 * @property {() => any} [obterSdk]                             o PokiSDK, ou nada
 * @property {Prazos} [prazos]
 * @property {(fn: () => void, ms: number) => any} [agendar]    setTimeout
 * @property {(id: any) => void} [cancelar]                     clearTimeout
 */

/**
 * @typedef {Object} Poki
 * @property {() => Promise<void>} init   resolve na resposta do SDK ou no prazo; nunca rejeita
 * @property {() => void} gameLoadingFinished
 * @property {() => void} gameplayStart
 * @property {() => void} gameplayStop
 * @property {() => Promise<boolean>} commercialBreak   true se o intervalo foi pedido ao SDK
 * @property {(tamanho?: 'small'|'medium'|'large') => Promise<boolean>} rewardedBreak   true so com premio
 * @property {(categoria: string, oque: string, acao: string) => void} measure
 * @property {boolean} sdkPronto    so leitura
 * @property {boolean} jaJogou      so leitura: houve gameplayStart nesta sessao
 * @property {boolean} emAnuncio    so leitura
 * @property {boolean} jogando      so leitura: entre gameplayStart e gameplayStop
 * @property {any} dispositivo      so leitura: getDeviceInfo(), se o SDK respondeu
 * @property {(url: string) => boolean} openExternalLink   abre pelo SDK (true) ou em nova aba (false)
 * @property {() => string} idioma      'en', 'pt'... segundo o SDK, ou '' sem resposta
 * @property {(() => void)|null} onAdStart   mudar o audio aqui (sincrono)
 * @property {(() => void)|null} onAdEnd
 */

/**
 * @param {OpcoesPoki} [opcoes]
 * @returns {Poki}
 */
export function criarPoki({
  obterSdk = () => /** @type {any} */ (globalThis).PokiSDK,
  prazos,
  agendar = (fn, ms) => globalThis.setTimeout(fn, ms),
  cancelar = (id) => globalThis.clearTimeout(id),
} = {}) {
  const limites = { ...PRAZOS_PADRAO, ...(prazos || {}) };

  let pronto = false;
  let pedidoCarregou = false;
  let enviouCarregou = false;
  let jogando = false;
  let jogandoNoSdk = false;
  let jaJogou = false;
  let emAnuncio = false;
  /** @type {any} */
  let dispositivo = null;
  /** @type {Promise<void>|null} */
  let promessaInit = null;
  /** @type {string[][]} */
  let filaMedidas = [];

  /** @returns {any} */
  function sdk() {
    try {
      const s = obterSdk();
      return s && (typeof s === 'object' || typeof s === 'function') ? s : null;
    } catch {
      return null;
    }
  }

  /**
   * O metodo do SDK amarrado ao proprio SDK, ou null.
   * @param {any} api
   * @param {string} nome
   * @returns {((...args: any[]) => any)|null}
   */
  function metodo(api, nome) {
    if (!api) return null;
    try {
      const fn = api[nome];
      return typeof fn === 'function' ? (...args) => fn.apply(api, args) : null;
    } catch {
      return null;
    }
  }

  /**
   * @param {string} nome
   * @param {...any} args
   */
  function chamar(nome, ...args) {
    const fn = metodo(sdk(), nome);
    if (!fn) return;
    try {
      fn(...args);
    } catch {
      /* ignora */
    }
  }

  /**
   * Resolve com o valor da promessa ou com a reserva no prazo (ou na rejeicao). Nunca rejeita.
   * @template T
   * @param {any} promessa
   * @param {number} ms
   * @param {T} reserva
   * @returns {Promise<any>}
   */
  function comPrazo(promessa, ms, reserva) {
    return new Promise((resolve) => {
      let feito = false;
      /** @type {any} */
      let id = null;
      /** @param {any} v */
      const fim = (v) => {
        if (feito) return;
        feito = true;
        if (id !== null) {
          try { cancelar(id); } catch { /* ignora */ }
        }
        resolve(v);
      };
      try {
        id = agendar(() => fim(reserva), ms);
      } catch {
        id = null;
      }
      Promise.resolve(promessa).then(fim, () => fim(reserva));
    });
  }

  /** @param {(() => void)|null} fn */
  function avisar(fn) {
    if (typeof fn !== 'function') return;
    try {
      fn();
    } catch {
      /* ignora */
    }
  }

  /** Leva ao SDK o que ficou pendente, na ordem: loading, gameplay, measures. */
  function sincronizar() {
    if (!pronto || emAnuncio) return;
    if (pedidoCarregou && !enviouCarregou) {
      enviouCarregou = true;
      chamar('gameLoadingFinished');
    }
    if (!enviouCarregou) return; // nada de gameplay nem measure antes do loading
    if (jogando !== jogandoNoSdk) {
      jogandoNoSdk = jogando;
      chamar(jogando ? 'gameplayStart' : 'gameplayStop');
    }
    if (filaMedidas.length) {
      const fila = filaMedidas;
      filaMedidas = [];
      for (const m of fila) chamar('measure', m[0], m[1], m[2]);
    }
  }

  function pedirInfo() {
    const fn = metodo(sdk(), 'getDeviceInfo');
    if (!fn) return;
    let pedido;
    try {
      pedido = fn();
    } catch {
      return;
    }
    comPrazo(pedido, limites.info, null).then((info) => {
      if (info && typeof info === 'object') dispositivo = info;
    });
  }

  function marcarPronto() {
    if (pronto) return;
    pronto = true;
    sincronizar();
    pedirInfo();
  }

  function init() {
    if (promessaInit) return promessaInit;
    promessaInit = (async () => {
      try {
        const fn = metodo(sdk(), 'init');
        if (!fn) return;
        let pedido;
        try {
          pedido = fn();
        } catch {
          return; // SDK quebrado: segue sem anuncios
        }
        const resposta = Promise.resolve(pedido).then(marcarPronto, marcarPronto);
        await comPrazo(resposta, limites.init, undefined);
      } catch {
        /* ignora */
      }
    })();
    return promessaInit;
  }

  function gameLoadingFinished() {
    if (pedidoCarregou) return;
    pedidoCarregou = true;
    sincronizar();
  }

  function gameplayStart() {
    if (jogando || emAnuncio) return;
    pedidoCarregou = true; // o loading sai antes do primeiro start
    jogando = true;
    jaJogou = true;
    sincronizar();
  }

  function gameplayStop() {
    if (!jogando) return;
    jogando = false;
    sincronizar();
  }

  /**
   * Espera o anuncio: resolve com a resposta do SDK, ou com a reserva na rejeicao, no prazo de
   * limites.intervalo SEM o onStart (pendurado: bloqueador) ou no teto de limites.aposInicio
   * contado do onStart (anuncio na tela). Nunca rejeita.
   * @param {(aoIniciar: () => void) => any} chamada   pede o anuncio ao SDK passando o onStart
   * @param {any} reserva
   * @returns {Promise<any>}
   */
  function esperarAnuncio(chamada, reserva) {
    return new Promise((resolve) => {
      let feito = false;
      let iniciou = false;
      /** @type {any} */
      let id = null;
      const desarmar = () => {
        if (id === null) return;
        try { cancelar(id); } catch { /* ignora */ }
        id = null;
      };
      /** @param {any} v */
      const fim = (v) => {
        if (feito) return;
        feito = true;
        desarmar();
        resolve(v);
      };
      /** @param {number} ms */
      const armar = (ms) => {
        desarmar();
        try {
          id = agendar(() => { id = null; fim(reserva); }, ms);
        } catch {
          id = null;
        }
      };
      const aoIniciar = () => {
        if (feito || iniciou) return;
        iniciou = true;
        armar(limites.aposInicio);
      };
      armar(limites.intervalo);
      let pedido;
      try {
        pedido = chamada(aoIniciar);
      } catch {
        pedido = reserva;
      }
      Promise.resolve(pedido).then(fim, () => fim(reserva));
    });
  }

  /**
   * @param {(aoIniciar: () => void) => any} chamada   pede o anuncio ao SDK (com o onStart)
   * @param {any} reserva         resultado no prazo, na rejeicao ou na excecao
   */
  async function rodarAnuncio(chamada, reserva) {
    gameplayStop();
    emAnuncio = true;
    avisar(poki.onAdStart);
    const resultado = await esperarAnuncio(chamada, reserva);
    emAnuncio = false;
    avisar(poki.onAdEnd);
    sincronizar();
    return resultado;
  }

  /**
   * Intervalo comercial: so na volta de uma pausa natural (a partida dos trens), a partir do
   * nivel 6 (quem decide e src/main.js). Sem cooldown proprio: a Poki decide a frequencia.
   */
  async function commercialBreak() {
    if (!pronto || emAnuncio || !jaJogou) return false;
    const fn = metodo(sdk(), 'commercialBreak');
    if (!fn) return false;
    await rodarAnuncio((aoIniciar) => fn(aoIniciar), undefined);
    return true;
  }

  /**
   * Video recompensado, so por escolha explicita do jogador. Sem SDK pronto nao ha video, e sem
   * video nao ha premio.
   * @param {'small'|'medium'|'large'} [tamanho]
   */
  async function rewardedBreak(tamanho) {
    if (!pronto || emAnuncio) return false;
    const fn = metodo(sdk(), 'rewardedBreak');
    if (!fn) return false;
    // como o hexadrop: { size, onStart } com tamanho; sem tamanho, o onStart como argumento
    const resultado = await rodarAnuncio((aoIniciar) => (tamanho ? fn({ size: tamanho, onStart: aoIniciar }) : fn(aoIniciar)), false);
    return resultado === true;
  }

  /**
   * Telemetria. Os nomes ficam fixos depois de publicados (ver CLAUDE.md).
   * @param {string} categoria
   * @param {string} oque
   * @param {string} acao
   */
  function measure(categoria, oque, acao) {
    if (emAnuncio) return;
    const m = [limparCampo(categoria), limparCampo(oque), limparCampo(acao)];
    if (pronto && enviouCarregou) {
      chamar('measure', m[0], m[1], m[2]);
      return;
    }
    if (filaMedidas.length < MAX_FILA_MEDIDAS) filaMedidas.push(m);
  }

  /** @type {Poki} */
  const poki = {
    init,
    gameLoadingFinished,
    gameplayStart,
    gameplayStop,
    commercialBreak,
    rewardedBreak,
    measure,
    /** Move a pilula da Poki (celular): topPercent e topPx. So com o SDK pronto. */
    movePill(topPercent, topPx) { if (pronto) chamar('movePill', topPercent, topPx); },
    get sdkPronto() { return pronto; },
    get jaJogou() { return jaJogou; },
    get emAnuncio() { return emAnuncio; },
    get jogando() { return jogando; },
    get dispositivo() { return dispositivo; },
    /**
     * Unica forma de abrir um link externo que a Poki aceita (politica de privacidade).
     * Sem SDK (jogo fora da Poki) abre em nova aba.
     * @param {string} url
     */
    openExternalLink(url) {
      const fn = metodo(sdk(), 'openExternalLink');
      if (fn) {
        try { fn(url); return true; } catch { /* ignora */ }
      }
      try { globalThis.open(url, '_blank', 'noopener'); } catch { /* ignora */ }
      return false;
    },
    /** Idioma do jogador segundo a Poki (getLanguage e sincrono); '' sem SDK ou sem resposta. */
    idioma() {
      const fn = metodo(sdk(), 'getLanguage');
      if (!fn) return '';
      try {
        const v = fn();
        return typeof v === 'string' ? v.toLowerCase() : '';
      } catch {
        return '';
      }
    },
    onAdStart: null,
    onAdEnd: null,
  };
  return poki;
}

/** Instancia do jogo: usa globalThis.PokiSDK e setTimeout. */
export const poki = criarPoki();
