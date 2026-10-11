// Armazenamento com reserva em memoria (porte de carimbador-maluco/src/core/armazenamento.js).
//
// A Poki exige que o jogo continue jogavel em janela anonima, com cookies
// bloqueados e com o disco cheio. Nesses casos o localStorage lanca em
// qualquer acesso, inclusive no getter (window.localStorage), por isso ate a
// obtencao do objeto fica dentro de try. Nada aqui lanca.
//
// Unico modulo do jogo que toca o localStorage.

export const PREFIXO_PADRAO = 'barber.';

/**
 * @typedef {Object} StorageMinimo
 * @property {(k: string) => string|null} getItem
 * @property {(k: string, v: string) => void} setItem
 * @property {(k: string) => void} removeItem
 */

/**
 * @param {{ prefixo?: string, obterLs?: () => StorageMinimo|null|undefined }} [opcoes]
 */
export function criarArmazem({ prefixo = PREFIXO_PADRAO, obterLs = () => globalThis.localStorage } = {}) {
  /** @type {Map<string, string|null>} valor bruto gravado nesta sessao; null = removido */
  const memoria = new Map();
  /** @type {StorageMinimo|null} */
  let ls = null;
  try {
    const candidato = obterLs();
    if (candidato && typeof candidato.getItem === 'function' && typeof candidato.setItem === 'function') ls = candidato;
  } catch {
    ls = null;
  }

  /** @param {string} chave @param {any} [padrao] */
  function ler(chave, padrao) {
    const k = prefixo + chave;
    /** @type {string|null|undefined} */
    let bruto = null;
    if (memoria.has(k)) bruto = memoria.get(k);
    else if (ls) {
      try {
        bruto = ls.getItem(k);
      } catch {
        bruto = null;
      }
    }
    if (bruto === null || bruto === undefined) return padrao;
    try {
      return JSON.parse(bruto);
    } catch {
      return padrao;
    }
  }

  /** @param {string} chave @param {any} valor */
  function gravar(chave, valor) {
    let bruto;
    try {
      bruto = JSON.stringify(valor);
    } catch {
      return false;
    }
    if (typeof bruto !== 'string') return false;
    const k = prefixo + chave;
    memoria.set(k, bruto);
    if (!ls) return false;
    try {
      ls.setItem(k, bruto);
      return true;
    } catch {
      return false;
    }
  }

  return { ler, gravar };
}
