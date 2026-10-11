// Geometria pura da tela na estrutura "palco": letreiro no topo, dois podios
// (o seu e o do adversario), plateia embaixo. Funcao de (W, H) e do papel; a
// cena (canvas) e o HUD (DOM) leem as mesmas caixas. Sem DOM.

/**
 * @typedef {{ x: number, y: number, w: number, h: number }} Caixa
 */

const SLOT_MIN = 48;
const SLOT_MAX = 84;
const CABECA_MIN = 150;

/** @param {number} v @param {number} a @param {number} b */
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * Caixa do cliente dentro da area util do podio: proporcao 3:4 (viewBox 300x380),
 * a maior que couber, encostada embaixo (o cliente senta).
 * @param {Caixa} area
 */
function caixaCabeca(area) {
  const w = Math.min(area.w, (area.h * 300) / 380);
  const h = (w * 380) / 300;
  return { x: Math.round(area.x + (area.w - w) / 2), y: Math.round(area.y + area.h - h), w: Math.round(w), h: Math.round(h) };
}

/**
 * @param {Caixa} podio
 * @param {{ proprio: boolean, m: number, retrato: boolean }} p
 */
function montarPodio(podio, { proprio, m, retrato }) {
  const cabecalho = clamp(Math.round(podio.h * 0.13), 24, 40);
  const ferramentasH = proprio ? clamp(Math.round(podio.h * 0.22), SLOT_MIN + 8, SLOT_MAX + 16) : 0;
  const interno = { x: podio.x + m, y: podio.y + cabecalho + m, w: podio.w - 2 * m, h: podio.h - cabecalho - ferramentasH - 2 * m - (proprio ? m : 0) };
  // retrato estreito: cabeca em cima e barras embaixo; senao lado a lado
  const empilhado = retrato && interno.w < 300;
  let areaCabeca;
  let barras;
  if (empilhado) {
    const barrasH = 44;
    areaCabeca = { x: interno.x, y: interno.y, w: interno.w, h: interno.h - barrasH - m };
    barras = { x: interno.x, y: interno.y + interno.h - barrasH, w: interno.w, h: barrasH };
  } else {
    const wCab = Math.round(interno.w * 0.5);
    areaCabeca = { x: interno.x, y: interno.y, w: wCab, h: interno.h };
    barras = { x: interno.x + wCab + m, y: interno.y, w: interno.w - wCab - m, h: interno.h };
  }
  const cabeca = caixaCabeca(areaCabeca);
  const nome = { x: podio.x + m, y: podio.y + Math.round(m / 2), w: podio.w - 2 * m, h: cabecalho };
  /** @type {Caixa|null} */
  let ferramentas = null;
  /** @type {Caixa[]} */
  const slots = [];
  if (proprio) {
    ferramentas = { x: podio.x + m, y: podio.y + podio.h - m - ferramentasH, w: podio.w - 2 * m, h: ferramentasH };
    const gap = 6;
    const slotW = clamp(Math.floor((ferramentas.w - gap * 4) / 5), SLOT_MIN, SLOT_MAX);
    const total = slotW * 5 + gap * 4;
    const x0 = ferramentas.x + Math.round((ferramentas.w - total) / 2);
    const slotH = Math.min(ferramentas.h, SLOT_MAX + 8);
    for (let i = 0; i < 5; i++) slots.push({ x: x0 + i * (slotW + gap), y: ferramentas.y + Math.round((ferramentas.h - slotH) / 2), w: slotW, h: slotH });
  }
  return { caixa: podio, nome, cabeca, areaCabeca, barras, ferramentas, slots, proprio, empilhado };
}

/**
 * @param {{ W: number, H: number, papel?: 'barbeiro'|'espectador'|'votacao', estrutura?: 'palco' }} p
 */
export function calcularLayout({ W, H, papel = 'barbeiro' }) {
  const retrato = H >= W * 0.95;
  const m = clamp(Math.round(Math.min(W, H) * 0.02), 6, 14);
  const topoH = clamp(Math.round((retrato ? H : H) * 0.1), 44, 72);
  const plateiaH = retrato ? clamp(Math.round(H * 0.07), 44, 60) : clamp(Math.round(H * 0.11), 48, 72);
  const menuW = 52; // botao de menu no canto superior direito
  const topo = { x: m, y: m, w: W - 2 * m - menuW, h: topoH };
  const plateia = { x: m, y: H - m - plateiaH, w: W - 2 * m, h: plateiaH };
  const proprio = papel === 'barbeiro';
  // reacoes do espectador: em retrato, uma faixa acima da plateia; em paisagem, dentro da plateia
  const reacoesH = !proprio && retrato ? 50 : 0;
  const meio = { x: m, y: topo.y + topo.h + m, w: W - 2 * m, h: plateia.y - m - reacoesH - (topo.y + topo.h + m) };
  /** @type {Caixa} */
  let podioA;
  /** @type {Caixa} */
  let podioB;
  if (retrato) {
    const fracao = proprio ? 0.6 : 0.5;
    const hA = Math.round((meio.h - m) * fracao);
    podioA = { x: meio.x, y: meio.y, w: meio.w, h: hA };
    podioB = { x: meio.x, y: meio.y + hA + m, w: meio.w, h: meio.h - hA - m };
  } else {
    const wA = Math.round((meio.w - m) / 2);
    podioA = { x: meio.x, y: meio.y, w: wA, h: meio.h };
    podioB = { x: meio.x + wA + m, y: meio.y, w: meio.w - wA - m, h: meio.h };
  }
  const podios = [montarPodio(podioA, { proprio, m, retrato }), montarPodio(podioB, { proprio: false, m, retrato })];
  // letreiro: faixa esquerda, relogio no centro, faixa direita
  const relogioW = clamp(Math.round(topo.w * 0.22), 96, 160);
  const letreiro = {
    esquerda: { x: topo.x, y: topo.y, w: Math.round((topo.w - relogioW) / 2) - m, h: topo.h },
    relogio: { x: topo.x + Math.round((topo.w - relogioW) / 2), y: topo.y, w: relogioW, h: topo.h },
    direita: { x: topo.x + Math.round((topo.w + relogioW) / 2) + m, y: topo.y, w: Math.round((topo.w - relogioW) / 2) - m, h: topo.h },
  };
  // plateia: botao "Vai!" de cada lado, medidor no meio, contador a direita (se couber)
  const vaiW = clamp(Math.round(plateia.w * 0.14), 56, 96);
  const vaiH = Math.min(plateia.h - 8, 44);
  const contadorW = plateia.w > 520 ? 110 : 0;
  const reacoesW = !proprio && !retrato ? Math.min(8 * 42 + 7 * 4, Math.round(plateia.w * 0.42)) : 0;
  const vai = [
    { x: plateia.x + m, y: plateia.y + Math.round((plateia.h - vaiH) / 2), w: vaiW, h: vaiH },
    { x: plateia.x + plateia.w - m - vaiW - contadorW - reacoesW - (reacoesW ? m : 0), y: plateia.y + Math.round((plateia.h - vaiH) / 2), w: vaiW, h: vaiH },
  ];
  const medidor = { x: vai[0].x + vaiW + m, y: plateia.y + Math.round(plateia.h / 2) - 10, w: vai[1].x - m - (vai[0].x + vaiW + m), h: 20 };
  const contador = contadorW ? { x: plateia.x + plateia.w - m - contadorW + m, y: plateia.y, w: contadorW - m, h: plateia.h } : null;
  /** @type {Caixa|null} */
  const reacoes = proprio ? null : retrato
    ? { x: plateia.x, y: plateia.y - reacoesH, w: plateia.w, h: 44 }
    : { x: vai[1].x + vaiW + m, y: plateia.y + Math.round((plateia.h - 42) / 2), w: reacoesW, h: 42 };
  return { W, H, retrato, m, topo, letreiro, meio, podios, plateia, vai, medidor, contador, reacoes, D: podios[0].cabeca.w };
}

/**
 * Zona da cabeca sob o ponto (coordenadas da tela), ou null fora da cabeca.
 * Voronoi dos centros das zonas dentro de uma elipse generosa: nunca "erra" o toque.
 * @param {number} px @param {number} py @param {Caixa} cabeca   caixa 300x380 na tela
 */
export function zonaEm(px, py, cabeca) {
  const sx = (px - cabeca.x) / cabeca.w * 300;
  const sy = (py - cabeca.y) / cabeca.h * 380;
  const dx = (sx - 150) / 165;
  const dy = (sy - 180) / 215;
  if (dx * dx + dy * dy > 1) return null;
  let melhor = null;
  let melhorD = Infinity;
  for (const [zona, [cx, cy]] of Object.entries(CENTROS_ZONA)) {
    const d = (sx - cx) ** 2 + (sy - cy) ** 2;
    if (d < melhorD) { melhorD = d; melhor = zona; }
  }
  return melhor;
}

/** Centros das zonas no viewBox 300x380 da cabeca (lados e bochechas tem dois centros). */
export const CENTROS_ZONA = Object.freeze({
  topo: [150, 62],
  franja: [150, 112],
  lados: [52, 150],
  'lados-dir': [248, 150],
  bochechas: [72, 240],
  'bochechas-dir': [228, 240],
  bigode: [150, 232],
  queixo: [150, 312],
});

/** Nome canonico da zona (os centros duplicados apontam para a mesma zona). @param {string|null} z */
export function zonaCanonica(z) {
  return z ? z.replace('-dir', '') : null;
}

/**
 * Centro de uma zona na tela (para a mao fantasma e o glow).
 * @param {string} zona @param {Caixa} cabeca
 */
export function centroZona(zona, cabeca) {
  const [cx, cy] = CENTROS_ZONA[zona] || CENTROS_ZONA.topo;
  return { x: cabeca.x + (cx / 300) * cabeca.w, y: cabeca.y + (cy / 380) * cabeca.h };
}

export { SLOT_MIN, CABECA_MIN };
