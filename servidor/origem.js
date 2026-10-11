// Casamento do cabecalho Origin com a lista permitida (globs: https://*.poki.com, http://localhost:*).

/** @param {string} glob */
function globParaRegex(glob) {
  const esc = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(`^${esc}$`, 'i');
}

/**
 * @param {string[]} lista
 * @returns {(origem: string|undefined) => { ok: boolean, motivo: string }}
 */
export function criarVerificadorDeOrigem(lista) {
  const regexes = lista.map(globParaRegex);
  return (origem) => {
    if (!origem) return { ok: true, motivo: 'sem-origin' }; // ferramentas e testes
    const o = origem.replace(/\/$/, '');
    return regexes.some((r) => r.test(o)) ? { ok: true, motivo: 'permitida' } : { ok: false, motivo: 'origem' };
  };
}
