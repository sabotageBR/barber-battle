// Unico lugar do servidor com console: linhas JSON em stdout, filtradas por nivel.
const NIVEIS = { debug: 10, info: 20, aviso: 30, erro: 40 };

/**
 * @param {string} nivelMinimo
 */
export function criarRegistro(nivelMinimo = 'info') {
  const minimo = NIVEIS[nivelMinimo] || NIVEIS.info;
  /** @param {string} nivel @param {string} msg @param {Record<string, any>} [dados] */
  function escrever(nivel, msg, dados) {
    if ((NIVEIS[nivel] || 0) < minimo) return;
    const linha = { t: new Date().toISOString(), nivel, msg, ...(dados || {}) };
    try {
      if (nivel === 'erro') console.error(JSON.stringify(linha));
      else console.log(JSON.stringify(linha));
    } catch { /* ignora */ }
  }
  return {
    debug: (m, d) => escrever('debug', m, d),
    info: (m, d) => escrever('info', m, d),
    aviso: (m, d) => escrever('aviso', m, d),
    erro: (m, d) => escrever('erro', m, d),
  };
}
