// Apelidos gerados (sem texto livre, sem filtro de palavroes): um adjetivo e um
// substantivo de barbearia, por indice, nas tres linguas. O servidor so trafega
// os indices; cada cliente mostra na propria lingua. Substantivos masculinos em
// pt e es para a concordancia ficar simples. Modulo puro.
import { CORES_AVATAR, CHAPEUS } from './constantes.js';

export const ADJETIVOS = Object.freeze({
  en: ['Swift', 'Sharp', 'Bright', 'Elegant', 'Keen', 'Golden', 'Blue', 'Red', 'Green', 'Purple', 'Happy', 'Bold', 'Brave', 'Clever', 'Calm', 'Kind', 'Strong', 'Agile', 'Fine', 'Fancy', 'Legendary', 'Famous', 'Radiant', 'Serene'],
  pt: ['Veloz', 'Afiado', 'Brilhante', 'Elegante', 'Esperto', 'Dourado', 'Azul', 'Vermelho', 'Verde', 'Roxo', 'Feliz', 'Ousado', 'Valente', 'Sagaz', 'Calmo', 'Gentil', 'Forte', 'Agil', 'Fino', 'Chique', 'Lendario', 'Famoso', 'Radiante', 'Sereno'],
  es: ['Veloz', 'Afilado', 'Brillante', 'Elegante', 'Listo', 'Dorado', 'Azul', 'Rojo', 'Verde', 'Morado', 'Feliz', 'Audaz', 'Valiente', 'Astuto', 'Tranquilo', 'Amable', 'Fuerte', 'Agil', 'Fino', 'Chic', 'Legendario', 'Famoso', 'Radiante', 'Sereno'],
});

export const SUBSTANTIVOS = Object.freeze({
  en: ['Comb', 'Quiff', 'Mustache', 'Mirror', 'Goatee', 'Cut', 'Fade', 'Curl', 'Tuft', 'Bun', 'Mohawk', 'Hairdo', 'Barber', 'Hair', 'Hat', 'Cap', 'Talc', 'Cream', 'Balm', 'Mullet', 'Strand', 'Roller', 'Pole', 'Throne'],
  pt: ['Pente', 'Topete', 'Bigode', 'Espelho', 'Cavanhaque', 'Corte', 'Degrade', 'Cacho', 'Tufo', 'Coque', 'Moicano', 'Penteado', 'Barbeiro', 'Cabelo', 'Chapeu', 'Bone', 'Talco', 'Creme', 'Balsamo', 'Mullet', 'Fio', 'Rolo', 'Poste', 'Trono'],
  es: ['Peine', 'Tupe', 'Bigote', 'Espejo', 'Chivo', 'Corte', 'Degradado', 'Rizo', 'Mechon', 'Mono', 'Mohicano', 'Peinado', 'Barbero', 'Cabello', 'Sombrero', 'Gorro', 'Talco', 'Crema', 'Balsamo', 'Mullet', 'Hilo', 'Rulo', 'Poste', 'Trono'],
});

export const LINGUAS = Object.freeze(Object.keys(ADJETIVOS));

/**
 * @param {unknown} nome
 * @returns {nome is [number, number]}
 */
export function nomeValido(nome) {
  return Array.isArray(nome) && nome.length === 2
    && Number.isInteger(nome[0]) && nome[0] >= 0 && nome[0] < ADJETIVOS.en.length
    && Number.isInteger(nome[1]) && nome[1] >= 0 && nome[1] < SUBSTANTIVOS.en.length;
}

/**
 * @param {() => number} r
 * @returns {[number, number]}
 */
export function sortearNome(r) {
  return [Math.floor(r() * ADJETIVOS.en.length), Math.floor(r() * SUBSTANTIVOS.en.length)];
}

/**
 * Texto do apelido na lingua pedida ('en' em ingles: adjetivo antes; pt e es: depois).
 * @param {[number, number]} nome
 * @param {string} lingua
 */
export function textoNome(nome, lingua = 'en') {
  const l = LINGUAS.includes(lingua) ? lingua : 'en';
  if (!nomeValido(nome)) return '';
  const adj = ADJETIVOS[l][nome[0]];
  const sub = SUBSTANTIVOS[l][nome[1]];
  return l === 'en' ? `${adj} ${sub}` : `${sub} ${adj}`;
}

/**
 * @param {unknown} avatar
 * @returns {avatar is { cor: number, chapeu: number }}
 */
export function avatarValido(avatar) {
  return !!avatar && typeof avatar === 'object'
    && Number.isInteger(/** @type {any} */ (avatar).cor) && /** @type {any} */ (avatar).cor >= 0 && /** @type {any} */ (avatar).cor < CORES_AVATAR.length
    && Number.isInteger(/** @type {any} */ (avatar).chapeu) && /** @type {any} */ (avatar).chapeu >= 0 && /** @type {any} */ (avatar).chapeu < CHAPEUS.length;
}

/**
 * O chapeu so vale se as vitorias destravaram; senao cai para 'nenhum'.
 * @param {{ cor: number, chapeu: number }} avatar @param {number} vitorias
 */
export function avatarPermitido(avatar, vitorias) {
  const chapeu = avatarValido(avatar) && CHAPEUS[avatar.chapeu].vitorias <= vitorias ? avatar.chapeu : 0;
  return { cor: avatarValido(avatar) ? avatar.cor : 0, chapeu };
}

/** @param {() => number} r */
export function sortearAvatar(r) {
  return { cor: Math.floor(r() * CORES_AVATAR.length), chapeu: 0 };
}
