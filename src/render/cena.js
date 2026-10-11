// Cena no canvas: fundo do palco, cadeiras, cabecas nos podios, aparas,
// mao do barbeiro, glow da zona e textos flutuantes. O HUD (letreiro, molduras,
// botoes) e DOM por cima, posicionado pela mesma geometria de layout.js.
import { desenharFundo, desenharCadeira, desenharMoldura, desenharPorta, SKIN } from './skin.js';
import { desenharCabeca, ARQUETIPOS } from './cabeca.js';
import { desenharMao, desenharMaoFantasma } from './ferramentas.js';
import { centroZona } from './layout.js';
import { criarMola, passoMola, criarAparas, criarConfete, criarFlutuantes } from './fisica.js';

const FONTE = "'Fredoka', system-ui, sans-serif";

/**
 * @param {HTMLCanvasElement} canvas
 */
export function criarCena(canvas) {
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  let W = 0;
  let H = 0;
  let dpr = 1;
  /** @type {Record<string, { rot: ReturnType<typeof criarMola>, sq: ReturnType<typeof criarMola>, expressao: string, ate: number, piscaEm: number, piscando: boolean }>} */
  const cabecas = {};
  const aparas = criarAparas();
  const confete = criarConfete();
  const flutuantes = criarFlutuantes();
  /** @type {Record<string, { zonas: any, brilho: number, curativos: number }>} */
  const exibido = {};

  function redimensionar(w, h, d) {
    W = w;
    H = h;
    dpr = d;
    canvas.width = Math.ceil(W * dpr);
    canvas.height = Math.ceil(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
  }

  /** @param {string} id */
  function cabeca(id) {
    if (!cabecas[id]) cabecas[id] = { rot: criarMola(140, 12), sq: criarMola(200, 18), expressao: 'neutro', ate: 0, piscaEm: 3 + Math.random() * 3, piscando: false };
    return cabecas[id];
  }

  /**
   * Interpola o cliente exibido em direcao ao cliente do estado (120 ms).
   * @param {string} id @param {{ zonas: any, brilho?: number, curativos?: number }} alvo @param {number} dt @param {boolean} snap
   */
  function suavizar(id, alvo, dt, snap) {
    const k = snap ? 1 : 1 - Math.exp(-dt / 0.12);
    const e = exibido[id] || (exibido[id] = { zonas: {}, brilho: 0, curativos: 0 });
    for (const [z, v] of Object.entries(alvo.zonas)) {
      const [comp, forma] = Array.isArray(v) ? v : [v.comp, v.forma];
      const atual = e.zonas[z] || { comp, forma };
      if (Math.abs(atual.comp - comp) > 0.05 || Math.abs(atual.forma - forma) > 0.05) { atual.comp = comp; atual.forma = forma; }
      atual.comp += (comp - atual.comp) * k;
      atual.forma += (forma - atual.forma) * k;
      e.zonas[z] = atual;
    }
    e.brilho += ((alvo.brilho || 0) - e.brilho) * k;
    e.curativos = alvo.curativos || 0;
    return e;
  }

  /**
   * @param {Object} q
   * @param {number} q.dt
   * @param {number} q.t
   * @param {ReturnType<typeof import('./layout.js').calcularLayout>} q.L
   * @param {any} q.snap           snapshot da sala
   * @param {Record<string, any>} [q.clientes]   clientes mais recentes (delta), por id
   * @param {string|null} q.voce
   * @param {string} q.ferramenta
   * @param {{ x: number, y: number, ativo: boolean, zona: string|null }} q.ponteiro
   * @param {import('../jogo/temas.js').Tema|null} q.tema
   * @param {string|null} [q.glowZona]
   * @param {{ zona: string, ferramenta: string } | null} [q.fantasma]
   */
  function desenhar({ dt, t, L, snap, clientes, voce, ferramenta, ponteiro, tema, glowZona = null, fantasma = null }) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    desenharFundo(ctx, W, H, dpr);
    // antes do primeiro snapshot (conectando) a barbearia ja aparece: molduras e cadeiras vazias
    if (!snap) snap = { cadeiras: [null, null], cliente: {} };
    const ids = snap.cadeiras || [null, null];
    const ordem = voce && ids.includes(voce) ? [voce, ids.find((x) => x !== voce) || null] : ids;
    for (let i = 0; i < 2; i++) {
      const podio = L.podios[i];
      desenharMoldura(ctx, podio.caixa, podio.proprio);
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(podio.areaCabeca.x, podio.areaCabeca.y, podio.areaCabeca.w, podio.areaCabeca.h, 12);
      ctx.clip();
      desenharPorta(ctx, podio.areaCabeca);
      ctx.restore();
    }
    for (let i = 0; i < 2; i++) {
      const id = ordem[i];
      const podio = L.podios[i];
      const cx = podio.cabeca;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(podio.areaCabeca.x, podio.areaCabeca.y, podio.areaCabeca.w, podio.areaCabeca.h, 12);
      ctx.clip();
      if (!id) {
        // cadeira vazia
        desenharCadeira(ctx, cx);
        ctx.restore();
        continue;
      }
      const cli = (clientes && clientes[id]) || (snap.cliente && snap.cliente[id]);
      if (!cli) { desenharCadeira(ctx, cx); ctx.restore(); continue; }
      const cab = cabeca(id);
      passoMola(cab.rot, dt);
      passoMola(cab.sq, dt);
      cab.piscaEm -= dt;
      if (cab.piscaEm <= 0) { cab.piscando = !cab.piscando; cab.piscaEm = cab.piscando ? 0.12 : 2.5 + Math.random() * 3.5; }
      if (cab.ate && t > cab.ate) { cab.expressao = snap.dormindo && snap.dormindo[id] ? 'dormindo' : 'neutro'; cab.ate = 0; }
      const e = suavizar(id, cli, dt, false);
      desenharCadeira(ctx, cx);
      const A = ARQUETIPOS[cli.arquetipo] || ARQUETIPOS.tonhao;
      aparas.desenharMonte(ctx, cx.x + cx.w / 2, cx.y + cx.h * 0.985, A.cabelo, cx.w / 300);
      desenharCabeca(ctx, { caixa: cx, arquetipo: cli.arquetipo, cliente: e, tema, expressao: cab.expressao, piscando: cab.piscando, rotacao: cab.rot.x, squash: cab.sq.x });
      if (snap.dormindo && snap.dormindo[id] && cab.expressao !== 'dormindo') cab.expressao = 'dormindo';
      // glow da zona aplicavel (so na propria cabeca)
      if (i === 0 && glowZona && id === voce) {
        const c = centroZona(glowZona, cx);
        const r = cx.w * 0.16;
        const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
        g.addColorStop(0, 'rgba(255,217,61,0.55)');
        g.addColorStop(1, 'rgba(255,217,61,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
      }
      if (i === 0 && fantasma && id === voce) {
        const c = centroZona(fantasma.zona, cx);
        const fase = (t / 1500) % 1;
        desenharMaoFantasma(ctx, fantasma.ferramenta, c.x - cx.w * 0.12 + Math.sin(fase * Math.PI * 2) * cx.w * 0.1, c.y, cx.h / 380);
      }
      ctx.restore();
    }
    aparas.passo(dt);
    aparas.desenhar(ctx);
    confete.passo(dt);
    confete.desenhar(ctx);
    flutuantes.passo(dt);
    flutuantes.desenhar(ctx, FONTE);
    // mao do barbeiro segue o dedo (48 px acima no toque)
    if (voce && ids.includes(voce) && ponteiro.ativo) {
      const escala = L.podios[0].cabeca.h / 380;
      desenharMao(ctx, ferramenta, ponteiro.x, ponteiro.y - (ponteiro.toque ? 48 : 0), escala, ferramenta === 'maquina' ? 1 : 0);
    }
  }

  /**
   * Reacoes visuais a eventos da sala.
   * @param {Record<string, any>} ev @param {ReturnType<typeof import('./layout.js').calcularLayout>} L
   * @param {string|null} voce @param {any} snap @param {number} t
   */
  function reagir(ev, L, voce, snap, t) {
    const ids = snap ? snap.cadeiras || [] : [];
    const indice = (id) => { const ordem = voce && ids.includes(voce) ? [voce, ids.find((x) => x !== voce)] : ids; return ordem.indexOf(id); };
    const i = ev.id ? indice(ev.id) : -1;
    const podio = i >= 0 ? L.podios[i] : null;
    const cx = podio ? podio.cabeca : null;
    const cab = ev.id ? cabeca(ev.id) : null;
    const cli = snap && snap.cliente && ev.id ? snap.cliente[ev.id] : null;
    const corCabelo = cli ? (ARQUETIPOS[cli.arquetipo] || ARQUETIPOS.tonhao).cabelo : '#4a2a14';
    switch (ev.tipo) {
      case 'traco': {
        if (!cx || !cab) return;
        const c = centroZona(ev.zona, cx);
        const dir = ev.zona.endsWith('dir') ? 1 : -1;
        cab.rot.v += (ev.ferramenta === 'maquina' ? 14 : 8) * (Math.random() < 0.5 ? -1 : 1);
        cab.sq.v += 0.35;
        if (ev.ferramenta !== 'pente' && ev.ferramenta !== 'pomada') aparas.soltar(c.x, c.y, ev.ferramenta === 'navalha' ? '#ffffff' : corCabelo, 3 + Math.round(ev.intensidade * 5), cx.y + cx.h * 0.98, dir, cx.w / 300);
        return;
      }
      case 'zonaPronta': if (cab) { cab.expressao = 'feliz'; cab.ate = t + 1200; } if (cx) flutuantes.soltar(cx.x + cx.w / 2, cx.y + cx.h * 0.2, '✓', SKIN.teal, Math.max(18, cx.w * 0.1)); return;
      case 'oops': case 'excesso': case 'tracoErrou': if (cab) { cab.expressao = 'preocupado'; cab.ate = t + 900; cab.rot.v += 6; } return;
      case 'combo': if (cx) flutuantes.soltar(cx.x + cx.w / 2, cx.y + cx.h * 0.15, 'x' + ev.n, SKIN.rosa, Math.max(20, cx.w * 0.12)); if (cab) { cab.expressao = 'impressionado'; cab.ate = t + 900; } return;
      case 'perfeito': if (cx) flutuantes.soltar(cx.x + cx.w / 2, cx.y + cx.h * 0.55, '★', SKIN.amarelo, Math.max(18, cx.w * 0.1)); return;
      case 'curativo': if (cab) { cab.expressao = 'preocupado'; cab.ate = t + 1200; cab.rot.v += 10; } return;
      case 'pomada': if (cab) { cab.expressao = 'impressionado'; cab.ate = t + 800; } return;
      case 'turbo': if (cx) flutuantes.soltar(cx.x + cx.w / 2, cx.y + cx.h * 0.1, 'TURBO', SKIN.laranja, Math.max(22, cx.w * 0.14), 1.6); return;
      case 'sacudida': case 'caos': for (const id of ids) { const c = cabeca(id); c.rot.v += 18; } return;
      case 'cochilo': if (cab) { cab.expressao = 'dormindo'; cab.ate = 0; } return;
      case 'acordou': if (cab) { cab.expressao = 'impressionado'; cab.ate = t + 700; cab.rot.v += 12; } return;
      case 'resultado': {
        if (ev.vencedor) {
          const k = indice(ev.vencedor);
          const cv = k >= 0 ? L.podios[k].cabeca : null;
          const cabV = cabeca(ev.vencedor);
          cabV.expressao = 'orgulhoso';
          cabV.ate = t + 9000;
          if (cv) confete.estourar(cv.x + cv.w / 2, cv.y + cv.h * 0.3, [SKIN.amarelo, SKIN.rosa, SKIN.teal, SKIN.laranja, SKIN.branco], 90);
          const perdedor = ids.find((x) => x && x !== ev.vencedor);
          if (perdedor) { const cp = cabeca(perdedor); cp.expressao = 'preocupado'; cp.ate = t + 4000; }
        }
        return;
      }
      case 'rodadaComecou': aparas.limpar(); for (const id of Object.keys(exibido)) delete exibido[id]; return;
      default: return;
    }
  }

  return { redimensionar, desenhar, reagir, get W() { return W; }, get H() { return H; }, aparas, confete, flutuantes };
}
