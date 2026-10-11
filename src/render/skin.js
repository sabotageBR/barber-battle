// Identidade Pop Cartoon: paleta e fundo do palco. O HUD em DOM usa as mesmas
// cores por variaveis CSS (src/ui/estilo.css).

export const SKIN = Object.freeze({
  fundo: '#6b4bd6', fundoClaro: '#8a6cf0', painel: '#fff6e3', painelEscuro: '#ffe3a3', tinta: '#2a1a52',
  laranja: '#ff7a1a', teal: '#1dc9c0', amarelo: '#ffd93d', rosa: '#ff5fa2', azul: '#2a66d9', branco: '#ffffff', trilho: '#3f2a8a',
});

/** @type {{ W: number, H: number, dpr: number, canvas: HTMLCanvasElement|OffscreenCanvas|null }} */
const cache = { W: 0, H: 0, dpr: 0, canvas: null };

/**
 * Fundo roxo com holofote e bolinhas, em cache por tamanho.
 * @param {CanvasRenderingContext2D} ctx @param {number} W @param {number} H @param {number} dpr
 */
export function desenharFundo(ctx, W, H, dpr) {
  if (!cache.canvas || cache.W !== W || cache.H !== H || cache.dpr !== dpr) {
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(Math.ceil(W * dpr), Math.ceil(H * dpr)) : document.createElement('canvas');
    if (!(c instanceof OffscreenCanvas)) { c.width = Math.ceil(W * dpr); c.height = Math.ceil(H * dpr); }
    const g = /** @type {CanvasRenderingContext2D} */ (c.getContext('2d'));
    g.scale(dpr, dpr);
    const grad = g.createRadialGradient(W / 2, H * 0.08, 10, W / 2, H * 0.08, Math.max(W, H) * 0.8);
    grad.addColorStop(0, SKIN.fundoClaro);
    grad.addColorStop(0.65, SKIN.fundo);
    grad.addColorStop(1, SKIN.fundo);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    const passo = Math.max(48, Math.round(Math.min(W, H) * 0.09));
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let y = passo / 2; y < H; y += passo) {
      for (let x = passo / 2; x < W; x += passo) {
        g.beginPath();
        g.arc(x, y, passo * 0.14, 0, Math.PI * 2);
        g.fill();
      }
    }
    cache.canvas = c;
    cache.W = W;
    cache.H = H;
    cache.dpr = dpr;
  }
  ctx.drawImage(/** @type {any} */ (cache.canvas), 0, 0, W, H);
}

/**
 * Cadeira laranja atras da capa do cliente.
 * @param {CanvasRenderingContext2D} ctx @param {{ x: number, y: number, w: number, h: number }} caixa
 */
export function desenharCadeira(ctx, caixa) {
  const w = caixa.w * 1.05;
  const h = caixa.h * 0.16;
  const x = caixa.x + caixa.w / 2 - w / 2;
  const y = caixa.y + caixa.h - h * 0.95;
  const r = Math.max(6, w * 0.08);
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.fillStyle = SKIN.tinta;
  ctx.beginPath();
  ctx.roundRect(x, y + h * 0.18, w, h, [r, r, r * 0.5, r * 0.5]);
  ctx.fill();
  ctx.fillStyle = SKIN.laranja;
  ctx.strokeStyle = SKIN.tinta;
  ctx.lineWidth = Math.max(3, w * 0.016);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, [r, r, r * 0.5, r * 0.5]);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Moldura do podio: sombra chapada, painel creme e contorno; destaque amarelo no seu.
 * @param {CanvasRenderingContext2D} ctx @param {{ x: number, y: number, w: number, h: number }} c @param {boolean} destaque
 */
export function desenharMoldura(ctx, c, destaque) {
  const r = 16;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.fillStyle = SKIN.tinta;
  ctx.beginPath(); ctx.roundRect(c.x + 6, c.y + 6, c.w, c.h, r); ctx.fill();
  ctx.fillStyle = SKIN.painel;
  ctx.strokeStyle = SKIN.tinta;
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.roundRect(c.x, c.y, c.w, c.h, r); ctx.fill(); ctx.stroke();
  if (destaque) {
    ctx.strokeStyle = SKIN.amarelo;
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.roundRect(c.x + 6, c.y + 6, c.w - 12, c.h - 12, r - 6); ctx.stroke();
  }
  ctx.restore();
}

/**
 * Porta do cliente dentro do podio (fundo pessego com contorno).
 * @param {CanvasRenderingContext2D} ctx @param {{ x: number, y: number, w: number, h: number }} c
 */
export function desenharPorta(ctx, c) {
  ctx.save();
  ctx.fillStyle = SKIN.painelEscuro;
  ctx.strokeStyle = SKIN.tinta;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.roundRect(c.x, c.y, c.w, c.h, 12); ctx.fill(); ctx.stroke();
  ctx.restore();
}
