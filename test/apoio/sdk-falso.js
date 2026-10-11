// SDK da Poki falso: registra a ordem das chamadas e deixa o teste escolher como o init e os
// anuncios respondem. Arquivo de apoio: so exporta.
//
// Modos de resposta (init e anuncio):
//   'resolve'      promessa que resolve com undefined
//   'rejeita'      promessa rejeitada
//   'pendura'      promessa pendente; o teste resolve com resolverInit/resolverAnuncio
//   'lanca'        excecao sincrona na chamada
//   { valor: x }   promessa que resolve com x (ex.: { valor: true } no rewarded)

/**
 * @typedef {'resolve'|'rejeita'|'pendura'|'lanca'|{ valor: any }} Modo
 */

/**
 * @typedef {Object} SdkFalso
 * @property {Record<string, Function>} sdk          o objeto que faz papel de PokiSDK
 * @property {any[][]} log                           [nome, ...args] na ordem das chamadas
 * @property {() => string[]} nomes                  so os nomes do log
 * @property {(nome: string) => number} contar
 * @property {(v?: any) => void} resolverInit
 * @property {(e?: any) => void} rejeitarInit
 * @property {(v?: any) => void} resolverAnuncio     resolve o anuncio pendurado mais antigo
 * @property {(e?: any) => void} rejeitarAnuncio
 * @property {(m: Modo) => void} definirAnuncio      troca o modo dos proximos anuncios
 */

/**
 * @param {Modo} modo
 * @param {{ resolver: Function|null, rejeitar: Function|null }[]} pendentes
 */
function responder(modo, pendentes) {
  if (modo === 'lanca') throw new Error('sdk falso: excecao sincrona');
  if (modo === 'rejeita') return Promise.reject(new Error('sdk falso: rejeitado'));
  if (modo === 'pendura') {
    return new Promise((resolver, rejeitar) => { pendentes.push({ resolver, rejeitar }); });
  }
  if (modo && typeof modo === 'object' && 'valor' in modo) return Promise.resolve(modo.valor);
  return Promise.resolve(undefined);
}

/**
 * @param {{ init?: Modo, anuncio?: Modo, info?: any }} [opcoes]
 *   info: se presente, o SDK ganha getDeviceInfo() que resolve com esse valor
 * @returns {SdkFalso}
 */
export function criarSdkFalso({ init = 'resolve', anuncio = 'resolve', info } = {}) {
  /** @type {any[][]} */
  const log = [];
  /** @type {{ resolver: Function|null, rejeitar: Function|null }[]} */
  const initsPendentes = [];
  /** @type {{ resolver: Function|null, rejeitar: Function|null }[]} */
  const anunciosPendentes = [];
  let modoAnuncio = anuncio;

  /** @type {Record<string, Function>} */
  const sdk = {
    init() {
      log.push(['init']);
      return responder(init, initsPendentes);
    },
    gameLoadingFinished() { log.push(['gameLoadingFinished']); },
    gameplayStart() { log.push(['gameplayStart']); },
    gameplayStop() { log.push(['gameplayStop']); },
    commercialBreak(...args) {
      log.push(['commercialBreak', ...args]);
      return responder(modoAnuncio, anunciosPendentes);
    },
    rewardedBreak(...args) {
      log.push(['rewardedBreak', ...args]);
      return responder(modoAnuncio, anunciosPendentes);
    },
    measure(categoria, oque, acao) { log.push(['measure', categoria, oque, acao]); },
  };
  if (info !== undefined) {
    sdk.getDeviceInfo = () => {
      log.push(['getDeviceInfo']);
      return Promise.resolve(info);
    };
  }

  return {
    sdk,
    log,
    nomes: () => log.map((e) => e[0]),
    contar: (nome) => log.filter((e) => e[0] === nome).length,
    resolverInit(v) { const p = initsPendentes.shift(); if (p && p.resolver) p.resolver(v); },
    rejeitarInit(e) { const p = initsPendentes.shift(); if (p && p.rejeitar) p.rejeitar(e || new Error('rejeitado')); },
    resolverAnuncio(v) { const p = anunciosPendentes.shift(); if (p && p.resolver) p.resolver(v); },
    rejeitarAnuncio(e) { const p = anunciosPendentes.shift(); if (p && p.rejeitar) p.rejeitar(e || new Error('rejeitado')); },
    definirAnuncio(m) { modoAnuncio = m; },
  };
}
