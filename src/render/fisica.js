// Fisica leve de apresentacao (nunca muda o estado da sala): mola da cabeca,
// aparas de cabelo que caem e quicam na capa, confete do resultado.

/** Mola amortecida de uma dimensao. */
export function criarMola(k = 120, c = 14) {
  return { x: 0, v: 0, k, c };
}

/** @param {ReturnType<typeof criarMola>} m @param {number} dt segundos @param {number} alvo */
export function passoMola(m, dt, alvo = 0) {
  const a = -m.k * (m.x - alvo) - m.c * m.v;
  m.v += a * dt;
  m.x += m.v * dt;
  if (Math.abs(m.x - alvo) < 0.0005 && Math.abs(m.v) < 0.0005) { m.x = alvo; m.v = 0; }
  return m;
}

/** @param {ReturnType<typeof criarMola>} m @param {number} dv */
export function impulso(m, dv) {
  m.v += dv;
  return m;
}

/**
 * Aparas (fiapos) soltas pelo traco: gravidade, giro, quique na linha da capa
 * e um montinho que cresce no chao.
 */
export function criarAparas(max = 240) {
  /** @type {Array<{ x: number, y: number, vx: number, vy: number, a: number, va: number, cor: string, l: number, vida: number, chao: number }>} */
  const lista = [];
  let monte = 0;
  return {
    get lista() { return lista; },
    get monte() { return monte; },
    /** @param {number} x @param {number} y @param {string} cor @param {number} n @param {number} chao y onde pousam @param {number} dir -1..1 */
    soltar(x, y, cor, n, chao, dir = 0, escala = 1) {
      for (let i = 0; i < n; i++) {
        if (lista.length >= max) lista.shift();
        const ang = (Math.PI / 2) * (0.5 + Math.random()) + dir * 0.6;
        const vel = (90 + Math.random() * 160) * escala;
        lista.push({ x, y, vx: Math.cos(ang) * vel * (Math.random() < 0.5 ? -1 : 1) * 0.5 + dir * 60, vy: -Math.sin(ang) * vel * 0.6, a: Math.random() * 6.28, va: (Math.random() - 0.5) * 12, cor, l: (5 + Math.random() * 8) * escala, vida: 2.5 + Math.random(), chao });
      }
    },
    /** @param {number} dt */
    passo(dt) {
      for (let i = lista.length - 1; i >= 0; i--) {
        const p = lista[i];
        p.vida -= dt;
        p.vy += 900 * dt;
        p.vx *= 0.985;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.a += p.va * dt;
        if (p.y >= p.chao) {
          p.y = p.chao;
          if (Math.abs(p.vy) > 60) { p.vy = -p.vy * 0.35; p.vx *= 0.6; p.va *= 0.5; } else { p.vy = 0; p.vx = 0; p.va = 0; }
        }
        if (p.vida <= 0) { lista.splice(i, 1); monte = Math.min(60, monte + 1); }
      }
    },
    /** @param {CanvasRenderingContext2D} ctx */
    desenhar(ctx) {
      ctx.save();
      ctx.lineCap = 'round';
      for (const p of lista) {
        ctx.globalAlpha = Math.min(1, p.vida);
        ctx.strokeStyle = p.cor;
        ctx.lineWidth = Math.max(1.5, p.l * 0.28);
        ctx.beginPath();
        ctx.moveTo(p.x - Math.cos(p.a) * p.l / 2, p.y - Math.sin(p.a) * p.l / 2);
        ctx.lineTo(p.x + Math.cos(p.a) * p.l / 2, p.y + Math.sin(p.a) * p.l / 2);
        ctx.stroke();
      }
      ctx.restore();
    },
    /** Montinho no chao, perto da base da cabeca. @param {CanvasRenderingContext2D} ctx @param {number} cx @param {number} y @param {string} cor @param {number} escala */
    desenharMonte(ctx, cx, y, cor, escala = 1) {
      if (monte <= 0) return;
      const w = (20 + monte * 1.6) * escala;
      const h = (4 + monte * 0.25) * escala;
      ctx.save();
      ctx.fillStyle = cor;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(cx, y, w, h, 0, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
    limpar() { lista.length = 0; monte = 0; },
    zerarMonte() { monte = 0; },
  };
}

/** Confete do resultado: retangulos coloridos com giro e queda. */
export function criarConfete(max = 300) {
  /** @type {Array<{ x: number, y: number, vx: number, vy: number, a: number, va: number, cor: string, w: number, h: number, vida: number }>} */
  const lista = [];
  return {
    get lista() { return lista; },
    /** @param {number} x @param {number} y @param {string[]} cores @param {number} n */
    estourar(x, y, cores, n) {
      for (let i = 0; i < n; i++) {
        if (lista.length >= max) lista.shift();
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
        const vel = 220 + Math.random() * 320;
        lista.push({ x, y, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, a: Math.random() * 6.28, va: (Math.random() - 0.5) * 16, cor: cores[i % cores.length], w: 6 + Math.random() * 6, h: 3 + Math.random() * 4, vida: 2 + Math.random() * 1.5 });
      }
    },
    /** @param {number} dt */
    passo(dt) {
      for (let i = lista.length - 1; i >= 0; i--) {
        const p = lista[i];
        p.vida -= dt;
        p.vy += 520 * dt;
        p.vx *= 0.99;
        p.x += p.vx * dt;
        p.y += p.vy * dt + Math.sin(p.a * 3) * 20 * dt;
        p.a += p.va * dt;
        if (p.vida <= 0) lista.splice(i, 1);
      }
    },
    /** @param {CanvasRenderingContext2D} ctx */
    desenhar(ctx) {
      ctx.save();
      for (const p of lista) {
        ctx.globalAlpha = Math.min(1, p.vida);
        ctx.fillStyle = p.cor;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.a);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.setTransform(ctx.getTransform().multiplySelf(new DOMMatrix().rotateSelf(0)));
        ctx.rotate(-p.a);
        ctx.translate(-p.x, -p.y);
      }
      ctx.restore();
    },
    limpar() { lista.length = 0; },
  };
}

/** Textos que sobem e somem (+10, Perfeito!, No ritmo). */
export function criarFlutuantes() {
  /** @type {Array<{ x: number, y: number, texto: string, cor: string, vida: number, total: number, tam: number }>} */
  const lista = [];
  return {
    get lista() { return lista; },
    /** @param {number} x @param {number} y @param {string} texto @param {string} cor @param {number} tam */
    soltar(x, y, texto, cor, tam = 22, vida = 1.1) {
      lista.push({ x, y, texto, cor, vida, total: vida, tam });
    },
    /** @param {number} dt */
    passo(dt) {
      for (let i = lista.length - 1; i >= 0; i--) {
        const f = lista[i];
        f.vida -= dt;
        f.y -= 48 * dt;
        if (f.vida <= 0) lista.splice(i, 1);
      }
    },
    /** @param {CanvasRenderingContext2D} ctx @param {string} fonte */
    desenhar(ctx, fonte) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      for (const f of lista) {
        const k = f.vida / f.total;
        ctx.globalAlpha = Math.min(1, k * 2);
        ctx.font = `${Math.round(f.tam * (1 + (1 - k) * 0.25))}px ${fonte}`;
        ctx.lineWidth = Math.max(3, f.tam * 0.18);
        ctx.strokeStyle = '#2a1a52';
        ctx.strokeText(f.texto, f.x, f.y);
        ctx.fillStyle = f.cor;
        ctx.fillText(f.texto, f.x, f.y);
      }
      ctx.restore();
    },
  };
}
