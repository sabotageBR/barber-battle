// Unico modulo que conhece o endereco do servidor e da politica de privacidade
// (vigiado por test/estilo.test.js e tools/empacotar.mjs).

export const VERSAO_CLIENTE = '0.1.0';
export const SERVIDOR_WS = 'wss://barberbattle.io/ws';
export const POLITICA_URL = 'https://barberbattle.io/privacidade';

/**
 * Endereco do servidor para esta pagina: parametro de depuracao, o proprio
 * host quando o jogo e servido pelo servidor (fase A em http, fase B em https),
 * senao o endereco publico (caso Poki).
 * @param {{ servidor?: string, local?: boolean }} dep
 * @param {{ protocol?: string, host?: string, hostname?: string }} loc
 */
export function urlServidor(dep, loc) {
  if (dep && dep.servidor) return dep.servidor;
  const host = (loc && loc.hostname) || '';
  if (/(^|\.)barberbattle\.io$/.test(host)) return `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}/ws`;
  return SERVIDOR_WS;
}
