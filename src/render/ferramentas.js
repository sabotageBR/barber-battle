// Ferramentas desenhadas no canvas (a mao do barbeiro segue o dedo) e os
// icones SVG dos botoes do HUD (os mesmos tracos das paginas de modelos).
import { SKIN } from './skin.js';

/** Icones SVG (viewBox 0 0 24 24, so tracos) para os botoes do HUD. */
export const ICONES = Object.freeze({
  tesoura: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12"/>',
  maquina: '<rect x="7" y="3" width="10" height="7" rx="1"/><rect x="8.5" y="10" width="7" height="12" rx="2"/><path d="M8 1v2M11 1v2M14 1v2M17 1v2"/>',
  navalha: '<path d="M5 19 15 4h5L10 19Z"/><path d="M5 19l-2 3"/>',
  pente: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v4M8 13v4M11 13v4M14 13v4M17 13v4M20 13v4"/>',
  pomada: '<ellipse cx="12" cy="7" rx="8" ry="3"/><path d="M4 7v9c0 1.7 3.6 3 8 3s8-1.3 8-3V7"/>',
});

/**
 * Mao segurando a ferramenta, com a ponta em (x, y). `escala` ~ altura da cabeca / 380.
 * @param {CanvasRenderingContext2D} ctx @param {string} id @param {number} x @param {number} y @param {number} escala @param {number} vibra 0..1
 */
export function desenharMao(ctx, id, x, y, escala, vibra = 0) {
  const s = Math.max(0.35, escala) * 1.1;
  const j = vibra ? (Math.random() - 0.5) * 3 * vibra : 0;
  ctx.save();
  ctx.translate(x + j, y + j);
  ctx.scale(s, s);
  ctx.rotate(-0.35);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = SKIN.tinta;
  ctx.lineWidth = 5;
  // ferramenta (a ponta no 0,0)
  ctx.fillStyle = '#ffffff';
  if (id === 'tesoura') {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(26, 30); ctx.moveTo(0, 0); ctx.lineTo(-6, 34); ctx.stroke();
    ctx.beginPath(); ctx.arc(30, 40, 9, 0, 6.28); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(-10, 44, 9, 0, 6.28); ctx.fill(); ctx.stroke();
  } else if (id === 'maquina') {
    ctx.fillStyle = '#ffd93d';
    ctx.beginPath(); ctx.roundRect(-14, 0, 28, 16, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); for (let i = -12; i <= 12; i += 6) { ctx.moveTo(i, 0); ctx.lineTo(i, -6); } ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.roundRect(-11, 16, 22, 46, 8); ctx.fill(); ctx.stroke();
  } else if (id === 'navalha') {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(24, 2); ctx.lineTo(30, 44); ctx.lineTo(6, 42); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = SKIN.tinta;
    ctx.beginPath(); ctx.roundRect(10, 42, 22, 30, 6); ctx.fill();
  } else if (id === 'pente') {
    ctx.fillStyle = '#1dc9c0';
    ctx.beginPath(); ctx.roundRect(-20, 0, 40, 12, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); for (let i = -16; i <= 16; i += 6) { ctx.moveTo(i, 12); ctx.lineTo(i, 24); } ctx.stroke();
  } else {
    ctx.fillStyle = '#ff5fa2';
    ctx.beginPath(); ctx.ellipse(0, 6, 18, 7, 0, 0, 6.28); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-18, 6); ctx.lineTo(-18, 30); ctx.quadraticCurveTo(0, 42, 18, 30); ctx.lineTo(18, 6); ctx.stroke();
  }
  // mao
  ctx.fillStyle = '#e8b48a';
  ctx.beginPath(); ctx.roundRect(-16, 48, 36, 34, 12); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.roundRect(14, 54, 14, 20, 7); ctx.fill(); ctx.stroke();
  ctx.restore();
}

/**
 * Mao fantasma do onboarding: a mesma mao, translucida.
 * @param {CanvasRenderingContext2D} ctx @param {string} id @param {number} x @param {number} y @param {number} escala
 */
export function desenharMaoFantasma(ctx, id, x, y, escala) {
  ctx.save();
  ctx.globalAlpha = 0.55;
  desenharMao(ctx, id, x, y, escala);
  ctx.restore();
}
