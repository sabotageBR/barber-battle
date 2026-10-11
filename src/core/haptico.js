/**
 * Vibracao curta (Android). O iOS nao tem `navigator.vibrate`, e ai tudo
 * vira no-op silencioso.
 *
 * Duas guardas alem da existencia da API: o interruptor do jogador
 * (`definirVibracao`) e a ativacao do usuario. O Chrome bloqueia `vibrate`
 * antes do primeiro toque no frame e ainda escreve um aviso no console, entao
 * sem `userActivation.hasBeenActive` nem se tenta.
 */

/**
 * @typedef {object} NavegadorLike
 * @property {(padrao:number|number[]) => boolean} [vibrate]
 * @property {{hasBeenActive:boolean}} [userActivation]
 */

/**
 * @typedef {object} Haptico
 * @property {(padrao:number|number[]) => boolean} vibrar true se o pedido foi feito
 * @property {(ligada:boolean) => void} definirVibracao interruptor do jogador
 * @property {() => boolean} ligada
 * @property {() => boolean} suportada o aparelho tem `navigator.vibrate`?
 */

/** @returns {NavegadorLike|null} */
function lerNavegador() {
  try {
    return typeof navigator !== 'undefined' ? navigator : null;
  } catch {
    return null;
  }
}

/**
 * @param {object} [opcoes]
 * @param {() => NavegadorLike|null} [opcoes.obterNavegador] injetavel para testes
 * @returns {Haptico}
 */
export function criarHaptico(opcoes = {}) {
  const obterNavegador = opcoes.obterNavegador || lerNavegador;
  let ligada = true;

  function suportada() {
    const nav = obterNavegador();
    return !!nav && typeof nav.vibrate === 'function';
  }

  return {
    vibrar(padrao) {
      if (!ligada) return false;
      const nav = obterNavegador();
      if (!nav || typeof nav.vibrate !== 'function') return false;
      const ativ = nav.userActivation;
      if (ativ && ativ.hasBeenActive === false) return false;
      try {
        // Chamado como metodo: `vibrate` solto da "Illegal invocation".
        return nav.vibrate(padrao) !== false;
      } catch {
        return false;
      }
    },
    definirVibracao(v) {
      ligada = !!v;
    },
    ligada() {
      return ligada;
    },
    suportada,
  };
}

const padrao = criarHaptico();

/**
 * Vibra se o aparelho suportar e a vibracao estiver ligada.
 * @param {number|number[]} padraoVibracao ms, ou [vibra, pausa, vibra...]
 * @returns {boolean}
 */
export function vibrar(padraoVibracao) {
  return padrao.vibrar(padraoVibracao);
}

/** @param {boolean} ligada */
export function definirVibracao(ligada) {
  padrao.definirVibracao(ligada);
}

/** @returns {boolean} */
export function vibracaoLigada() {
  return padrao.ligada();
}

/** @returns {boolean} */
export function vibracaoSuportada() {
  return padrao.suportada();
}
