// Protocolo JSON sobre WebSocket (v1): schemas, validacao e baldes de taxa.
// Modulo puro: o servidor e os testes usam `validar` e `tomar`; nada aqui le
// relogio (o `agora` vem de fora).
import { VERSAO_PROTOCOLO, ZONAS, REACOES, LIMITES, CAOS } from './constantes.js';
import { IDS_FERRAMENTAS } from './ferramentas.js';
import { nomeValido, avatarValido } from './nomes.js';

/** Tipos de mensagem que o cliente envia. */
export const TIPOS_CLIENTE = Object.freeze([
  'entrar', 'escolher', 'ferramenta', 'traco', 'votar', 'reagir', 'torcer', 'caos', 'anuncio', 'pronto', 'recompensa', 'ping',
]);

/** Tipos de mensagem que o servidor envia. */
export const TIPOS_SERVIDOR = Object.freeze(['bemvindo', 'sala', 'delta', 'evento', 'pong', 'erro', 'manutencao']);

/** [capacidade, fichas por segundo] por tipo. */
export const TAXAS = Object.freeze({
  entrar: [1, 0.2], escolher: [2, 2], ferramenta: [5, 5], traco: [20, 12], votar: [2, 2], reagir: [3, 1],
  torcer: [6, 6], caos: [6, 6], anuncio: [2, 1], pronto: [2, 1], recompensa: [2, 1], ping: [4, 4],
});

const ID_RE = /^[a-z0-9-]{1,24}$/;
const SESSAO_RE = /^[0-9a-f]{32}$/;
const DIRECOES = ['', 'cima', 'lado'];

const inteiro = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const numero = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

/**
 * Valida e normaliza uma mensagem do cliente.
 * @param {unknown} msg
 * @returns {{ ok: true, msg: Record<string, any> } | { ok: false, erro: string }}
 */
export function validar(msg) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return { ok: false, erro: 'formato' };
  const m = /** @type {Record<string, any>} */ (msg);
  if (typeof m.t !== 'string' || !TIPOS_CLIENTE.includes(m.t)) return { ok: false, erro: 'tipo' };
  switch (m.t) {
    case 'entrar': {
      if (m.v !== VERSAO_PROTOCOLO) return { ok: false, erro: 'versao' };
      if (m.sessao !== undefined && !(typeof m.sessao === 'string' && SESSAO_RE.test(m.sessao))) return { ok: false, erro: 'sessao' };
      if (m.nome !== undefined && !nomeValido(m.nome)) return { ok: false, erro: 'nome' };
      if (m.avatar !== undefined && !avatarValido(m.avatar)) return { ok: false, erro: 'avatar' };
      if (m.idioma !== undefined && !(typeof m.idioma === 'string' && /^[a-z]{2}(-[a-z]{2})?$/i.test(m.idioma))) return { ok: false, erro: 'idioma' };
      if (m.sala !== undefined && !(typeof m.sala === 'string' && ID_RE.test(m.sala))) return { ok: false, erro: 'sala' };
      if (m.bots !== undefined && !inteiro(m.bots, 0, LIMITES.salaMax)) return { ok: false, erro: 'bots' };
      return { ok: true, msg: { t: 'entrar', v: m.v, sessao: m.sessao, nome: m.nome, avatar: m.avatar, idioma: m.idioma, sala: m.sala, bots: m.bots } };
    }
    case 'escolher':
      if (m.opcao !== 'jogar' && m.opcao !== 'assistir') return { ok: false, erro: 'opcao' };
      return { ok: true, msg: { t: 'escolher', opcao: m.opcao } };
    case 'ferramenta':
      if (!IDS_FERRAMENTAS.includes(m.id)) return { ok: false, erro: 'ferramenta' };
      return { ok: true, msg: { t: 'ferramenta', id: m.id } };
    case 'traco': {
      if (!ZONAS.includes(m.zona)) return { ok: false, erro: 'zona' };
      if (!IDS_FERRAMENTAS.includes(m.ferramenta)) return { ok: false, erro: 'ferramenta' };
      if (!numero(m.intensidade, 0, 1)) return { ok: false, erro: 'intensidade' };
      if (m.precisao !== undefined && !numero(m.precisao, 0, 1)) return { ok: false, erro: 'precisao' };
      if (m.direcao !== undefined && !DIRECOES.includes(m.direcao)) return { ok: false, erro: 'direcao' };
      if (!inteiro(m.seq, 0, 1e9)) return { ok: false, erro: 'seq' };
      return { ok: true, msg: { t: 'traco', zona: m.zona, ferramenta: m.ferramenta, intensidade: m.intensidade, precisao: m.precisao === undefined ? 1 : m.precisao, direcao: m.direcao || '', seq: m.seq } };
    }
    case 'votar':
    case 'torcer':
      if (!(typeof m.alvo === 'string' && ID_RE.test(m.alvo))) return { ok: false, erro: 'alvo' };
      return { ok: true, msg: { t: m.t, alvo: m.alvo } };
    case 'reagir':
      if (!inteiro(m.reacao, 0, REACOES.length - 1)) return { ok: false, erro: 'reacao' };
      return { ok: true, msg: { t: 'reagir', reacao: m.reacao } };
    case 'caos':
      if (!CAOS.tipos.includes(m.acao)) return { ok: false, erro: 'acao' };
      return { ok: true, msg: { t: 'caos', acao: m.acao } };
    case 'recompensa':
      if (!inteiro(m.rodada, 1, 1e6)) return { ok: false, erro: 'rodada' };
      return { ok: true, msg: { t: 'recompensa', rodada: m.rodada } };
    case 'ping':
      if (!inteiro(m.id, 0, 1e9) || !numero(m.tc, 0, 1e15)) return { ok: false, erro: 'ping' };
      return { ok: true, msg: { t: 'ping', id: m.id, tc: m.tc } };
    default:
      return { ok: true, msg: { t: m.t } };
  }
}

/**
 * Texto JSON -> mensagem validada. Recusa texto grande demais antes de analisar.
 * @param {string} texto
 */
export function decodificar(texto) {
  if (typeof texto !== 'string' || texto.length > LIMITES.msgMax) return { ok: false, erro: 'tamanho' };
  let obj;
  try {
    obj = JSON.parse(texto);
  } catch {
    return { ok: false, erro: 'json' };
  }
  return validar(obj);
}

/**
 * Balde de fichas (token bucket) imutavel.
 * @param {number} capacidade @param {number} porSegundo @param {number} agora ms
 */
export function criarBalde(capacidade, porSegundo, agora) {
  return { capacidade, porSegundo, fichas: capacidade, ultimo: agora };
}

/**
 * Tenta tomar uma ficha. Devolve o balde novo e se deu.
 * @param {{ capacidade: number, porSegundo: number, fichas: number, ultimo: number }} b
 * @param {number} agora
 */
export function tomar(b, agora) {
  const dt = Math.max(0, agora - b.ultimo) / 1000;
  const fichas = Math.min(b.capacidade, b.fichas + dt * b.porSegundo);
  if (fichas < 1) return { balde: { ...b, fichas, ultimo: agora }, ok: false };
  return { balde: { ...b, fichas: fichas - 1, ultimo: agora }, ok: true };
}

/**
 * Baldes de todos os tipos, para uma conexao.
 * @param {number} agora
 */
export function criarBaldes(agora) {
  /** @type {Record<string, ReturnType<typeof criarBalde>>} */
  const b = {};
  for (const [tipo, [cap, seg]] of Object.entries(TAXAS)) b[tipo] = criarBalde(cap, seg, agora);
  return b;
}

/**
 * Toma uma ficha do balde do tipo. Tipos sem taxa passam sempre.
 * @param {Record<string, ReturnType<typeof criarBalde>>} baldes
 * @param {string} tipo
 * @param {number} agora
 */
export function tomarDo(baldes, tipo, agora) {
  const b = baldes[tipo];
  if (!b) return { baldes, ok: true };
  const r = tomar(b, agora);
  return { baldes: { ...baldes, [tipo]: r.balde }, ok: r.ok };
}
