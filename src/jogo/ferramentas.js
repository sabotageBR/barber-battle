// Ferramentas: dominio (cabelo, barba ou brilho), efeito por traco e bonus por zona.
// Modulo puro: so dados.

/**
 * @typedef {Object} Ferramenta
 * @property {string} id
 * @property {string[]} dominio      'cabelo', 'barba' ou 'brilho' (pomada)
 * @property {number} comp           variacao de comprimento por traco de intensidade 1 (negativo corta)
 * @property {number} forma          variacao de forma por traco (positivo arruma)
 * @property {Record<string, number>} bonusZona   multiplicador do corte em zonas especificas
 * @property {boolean} precisao      a navalha mede a precisao do traco
 */

/** @type {Ferramenta[]} */
export const FERRAMENTAS = Object.freeze([
  { id: 'tesoura', dominio: ['cabelo'], comp: -0.10, forma: 0.04, bonusZona: {}, precisao: false },
  { id: 'maquina', dominio: ['cabelo'], comp: -0.18, forma: -0.02, bonusZona: { lados: 1.3 }, precisao: false },
  { id: 'navalha', dominio: ['barba'], comp: -0.07, forma: 0.10, bonusZona: {}, precisao: true },
  { id: 'pente', dominio: ['cabelo', 'barba'], comp: 0, forma: 0.22, bonusZona: {}, precisao: false },
  { id: 'pomada', dominio: ['brilho'], comp: 0, forma: 0, bonusZona: {}, precisao: false },
].map(Object.freeze));

export const IDS_FERRAMENTAS = Object.freeze(FERRAMENTAS.map((f) => f.id));

/** @param {string} id */
export function ferramentaPorId(id) {
  return FERRAMENTAS.find((f) => f.id === id) || null;
}
