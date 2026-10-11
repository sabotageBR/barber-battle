// Passo puro do mulberry32: o estado do rng vive dentro do estado da sala (um
// inteiro), e cada sorteio devolve o valor e o estado novo. Modulo puro.

/**
 * @param {number} a estado atual (uint32)
 * @returns {{ a: number, v: number }} estado novo e valor em [0, 1)
 */
export function rngPasso(a) {
  a = (a + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { a, v: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

/**
 * Varios sorteios de uma vez.
 * @param {number} a @param {number} n
 * @returns {{ a: number, valores: number[] }}
 */
export function rngVarios(a, n) {
  const valores = [];
  for (let i = 0; i < n; i++) {
    const p = rngPasso(a);
    a = p.a;
    valores.push(p.v);
  }
  return { a, valores };
}

/** @param {string} s */
export function hashTexto(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
