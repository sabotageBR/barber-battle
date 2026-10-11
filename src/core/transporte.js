// Transporte de mensagens: WebSocket real ou par em memoria (loopback) para o
// modo local e os testes. Unico modulo que cria WebSocket.

/**
 * @typedef {Object} Transporte
 * @property {(msg: Record<string, any>) => void} enviar
 * @property {(fn: (msg: Record<string, any>) => void) => () => void} aoMensagem
 * @property {(fn: () => void) => () => void} aoAbrir
 * @property {(fn: (motivo: { codigo?: number, erro?: boolean }) => void) => () => void} aoFechar
 * @property {() => void} fechar
 * @property {() => boolean} aberto
 */

/** Par de transportes ligados em memoria; `bombear` entrega o que esta na fila. */
export class TransporteLocal {
  constructor() {
    /** @type {TransporteLocal|null} */
    this.par = null;
    /** @type {Set<(msg: any) => void>} */
    this.ouvintes = new Set();
    /** @type {Set<() => void>} */
    this.aberturas = new Set();
    /** @type {Set<(m: any) => void>} */
    this.fechamentos = new Set();
    /** @type {any[]} */
    this.fila = [];
    this.estaAberto = true;
  }

  static par() {
    const a = new TransporteLocal();
    const b = new TransporteLocal();
    a.par = b;
    b.par = a;
    return [a, b];
  }

  /** @param {Record<string, any>} msg */
  enviar(msg) {
    if (!this.par || !this.estaAberto) return;
    this.par.fila.push(JSON.parse(JSON.stringify(msg)));
  }

  /** Entrega as mensagens pendentes aos ouvintes (chame uma vez por quadro). */
  bombear() {
    const lista = this.fila;
    this.fila = [];
    for (const m of lista) for (const fn of this.ouvintes) fn(m);
    return lista.length;
  }

  aoMensagem(fn) { this.ouvintes.add(fn); return () => this.ouvintes.delete(fn); }
  aoAbrir(fn) { this.aberturas.add(fn); return () => this.aberturas.delete(fn); }
  aoFechar(fn) { this.fechamentos.add(fn); return () => this.fechamentos.delete(fn); }
  aberto() { return this.estaAberto; }
  fechar() {
    if (!this.estaAberto) return;
    this.estaAberto = false;
    for (const fn of this.fechamentos) fn({ codigo: 1000 });
    if (this.par && this.par.estaAberto) this.par.fechar();
  }
}

/**
 * WebSocket real com a mesma interface. `criarSocket` e injetavel para testes.
 * @param {string} url
 * @param {{ criarSocket?: (url: string) => any }} [opcoes]
 * @returns {Transporte}
 */
export function criarTransporteWs(url, { criarSocket } = {}) {
  const ouvintes = new Set();
  const aberturas = new Set();
  const fechamentos = new Set();
  let ws = null;
  let fechou = false;
  try {
    ws = criarSocket ? criarSocket(url) : new WebSocket(url);
  } catch {
    ws = null;
  }
  const avisarFechou = (m) => {
    if (fechou) return;
    fechou = true;
    for (const fn of fechamentos) fn(m);
  };
  if (ws) {
    ws.onopen = () => { for (const fn of aberturas) fn(); };
    ws.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(typeof e.data === 'string' ? e.data : ''); } catch { return; }
      if (msg && typeof msg === 'object') for (const fn of ouvintes) fn(msg);
    };
    ws.onerror = () => avisarFechou({ erro: true });
    ws.onclose = (e) => avisarFechou({ codigo: e && e.code });
  } else {
    queueMicrotask(() => avisarFechou({ erro: true }));
  }
  return {
    enviar(msg) {
      if (!ws || ws.readyState !== 1) return;
      try { ws.send(JSON.stringify(msg)); } catch { /* ignora */ }
    },
    aoMensagem(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); },
    aoAbrir(fn) { aberturas.add(fn); return () => aberturas.delete(fn); },
    aoFechar(fn) { fechamentos.add(fn); return () => fechamentos.delete(fn); },
    aberto() { return !!ws && ws.readyState === 1; },
    fechar() {
      if (ws) { try { ws.close(); } catch { /* ignora */ } }
      avisarFechou({ codigo: 1000 });
    },
  };
}
