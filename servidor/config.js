// Configuracao por variaveis de ambiente, com os padroes do desenvolvimento local.
import { LIMITES } from '../src/jogo/constantes.js';

const ORIGENS_PADRAO = [
  'https://barberbattle.io', 'https://www.barberbattle.io', 'http://barberbattle.io',
  'https://*.poki.com', 'https://*.poki.io', 'https://*.poki.dev', 'https://*.poki-cdn.com', 'https://*.poki-gdn.com', 'https://*.poki-user-content.com',
  'http://127.0.0.1:*', 'http://localhost:*',
];

/** @param {string|undefined} v @param {number} padrao */
const inteiro = (v, padrao) => (v === undefined || v === '' ? padrao : Math.max(0, parseInt(v, 10) || 0));
/** @param {string|undefined} v @param {boolean} padrao */
const ligado = (v, padrao) => (v === undefined || v === '' ? padrao : !/^(0|off|false|nao|no)$/i.test(v));

/**
 * @param {Record<string, string|undefined>} env
 */
export function lerConfig(env = process.env) {
  const origens = (env.ALLOWED_ORIGINS || '').split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  return {
    porta: inteiro(env.PORT, 3000),
    host: env.HOST || '127.0.0.1',
    origens: origens.length ? origens : ORIGENS_PADRAO,
    checarOrigem: ligado(env.WS_ORIGIN_CHECK, env.NODE_ENV === 'production'),
    salaMax: Math.min(LIMITES.salaMax, inteiro(env.SALA_MAX, LIMITES.salaMax)),
    humanosMax: Math.min(LIMITES.humanosMax, inteiro(env.HUMANOS_MAX, LIMITES.humanosMax)),
    bots: ligado(env.SALA_BOTS, true) ? inteiro(env.SALA_BOTS_ALVO, LIMITES.bots) : 0,
    deltaHz: inteiro(env.DELTA_HZ, 6),
    maxSockets: inteiro(env.MAX_SOCKETS, 2000),
    maxPorIp: inteiro(env.MAX_POR_IP, 8),
    trustProxy: ligado(env.TRUST_PROXY, false),
    shard: (env.SHARD || 'a').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'a',
    temposRapidos: ligado(env.TEMPOS_RAPIDOS, false),
    logLevel: env.LOG_LEVEL || 'info',
    urlPublica: env.URL_PUBLICA || '',
    encerramentoMs: inteiro(env.ENCERRAMENTO_MS, 15000),
    estatico: ligado(env.ESTATICO, true),
    salaVaziaMs: inteiro(env.SALA_VAZIA_MS, 0),
  };
}
