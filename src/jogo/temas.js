// Temas da rodada: alvo de comprimento por zona, foco cabelo/barba, rigor e o
// gesto que a mao fantasma mostra ao novato. Modulo puro: so dados.

/**
 * @typedef {Object} Tema
 * @property {string} id
 * @property {Record<string, number>} alvo        comprimento alvo por zona (0 = raspado, 1 = como chegou)
 * @property {{ cabelo: number, barba: number }} foco   pesos na qualidade (somam 1)
 * @property {number} rigor                       1 = tolerante; > 1 = exige precisao
 * @property {number} brilhoPeso                  quanto a pomada vale na qualidade
 * @property {boolean} precisao                   penaliza diferenca entre as zonas de cabelo (Militar)
 * @property {{ ferramenta: string, zona: string }} fantasma   gesto do onboarding visual
 * @property {string} cabelo                      peca de cabelo revelada quando a zona fica pronta
 * @property {string} barba                       peca de barba revelada
 */

/** @type {Tema[]} */
export const TEMAS = Object.freeze([
  {
    id: 'lenhador',
    alvo: { topo: 0.55, lados: 0.45, franja: 0.5, bochechas: 0.85, queixo: 0.9, bigode: 0.7 },
    foco: { cabelo: 0.3, barba: 0.7 }, rigor: 1.0, brilhoPeso: 0.1, precisao: false,
    fantasma: { ferramenta: 'pente', zona: 'queixo' }, cabelo: 'exec', barba: 'cheia',
  },
  {
    id: 'executivo',
    alvo: { topo: 0.45, lados: 0.2, franja: 0.35, bochechas: 0, queixo: 0, bigode: 0 },
    foco: { cabelo: 0.7, barba: 0.3 }, rigor: 1.0, brilhoPeso: 0.1, precisao: false,
    fantasma: { ferramenta: 'tesoura', zona: 'topo' }, cabelo: 'exec', barba: 'limpa',
  },
  {
    id: 'festa',
    alvo: { topo: 0.7, lados: 0.3, franja: 0.6, bochechas: 0.3, queixo: 0.4, bigode: 0.5 },
    foco: { cabelo: 0.5, barba: 0.5 }, rigor: 1.0, brilhoPeso: 0.2, precisao: false,
    fantasma: { ferramenta: 'tesoura', zona: 'topo' }, cabelo: 'topete', barba: 'cavanhaque',
  },
  {
    id: 'militar',
    alvo: { topo: 0.15, lados: 0, franja: 0.1, bochechas: 0, queixo: 0, bigode: 0 },
    foco: { cabelo: 0.65, barba: 0.35 }, rigor: 1.6, brilhoPeso: 0.1, precisao: true,
    fantasma: { ferramenta: 'maquina', zona: 'lados' }, cabelo: 'maquina', barba: 'limpa',
  },
].map(Object.freeze));

/** @param {string} id */
export function temaPorId(id) {
  return TEMAS.find((t) => t.id === id) || null;
}

/**
 * Sorteia o proximo tema sem repetir o anterior.
 * @param {() => number} r
 * @param {string} [anterior]
 */
export function sortearTema(r, anterior) {
  const opcoes = TEMAS.filter((t) => t.id !== anterior);
  return opcoes[Math.floor(r() * opcoes.length)];
}
