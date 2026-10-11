// O corte em si: estado do cliente (cabeca), efeito de cada traco, combo,
// precisao da navalha e a qualidade final. Deterministico: o mesmo traco da o
// mesmo resultado no servidor, no cliente (previsao) e nos bots.
import {
  ZONAS, ZONAS_CABELO, ZONAS_BARBA, PESO_ZONA, DOMINIO_ZONA, COMBO, TORCIDA, PRECISAO, POMADA_MIN_CABELO, clamp,
} from './constantes.js';
import { ferramentaPorId } from './ferramentas.js';

const RITMO_MS = 250;        // 2o traco na mesma zona antes disso rende metade
const RITMO_FATOR = 0.5;
const TOLERANCIA = 0.35;     // erro de comprimento que zera a proximidade (antes do rigor)
const EXCESSO = 1.5;         // passar do alvo custa isso a mais
const ZONA_PRONTA = { prox: 0.9, forma: 0.6 };
/** "Nunca" como numero (serializa em JSON; -Infinity viraria null). */
export const NUNCA = -1e12;

/**
 * @typedef {Object} Zona
 * @property {number} comp   comprimento 0..1 (1 = como chegou)
 * @property {number} forma  acabamento 0..1
 */

/**
 * @typedef {Object} Cliente
 * @property {string} arquetipo
 * @property {Record<string, Zona>} zonas
 * @property {number} brilho        0..1 (pomada)
 * @property {number} combo         tracos certos seguidos
 * @property {number} ultimoCerto   t do ultimo traco certo
 * @property {Record<string, number>} ultimoTraco   t do ultimo traco por zona
 * @property {number} erros         ferramenta errada (so conta quando punir)
 * @property {number} oops          ferramenta errada (sempre conta, para metricas)
 * @property {number} curativos     cortezinhos da navalha
 * @property {number} tracos
 * @property {number} turboAte      t ate quando o Turbo da torcida vale
 */

/**
 * @typedef {Object} Traco
 * @property {string} zona
 * @property {string} ferramenta
 * @property {number} intensidade   0..1
 * @property {number} [precisao]    0..1 (navalha)
 * @property {string} [direcao]     'cima' ou 'lado' (pomada deslizante)
 * @property {number} t             ms
 */

/**
 * @param {string} arquetipo
 * @param {() => number} [r]   rng: varia como o cliente chega (0,85..1 de comprimento)
 * @returns {Cliente}
 */
export function criarCliente(arquetipo, r) {
  /** @type {Record<string, Zona>} */
  const zonas = {};
  /** @type {Record<string, number>} */
  const ultimoTraco = {};
  for (const z of ZONAS) {
    zonas[z] = { comp: r ? 0.85 + 0.15 * r() : 1, forma: 0 };
    ultimoTraco[z] = NUNCA;
  }
  return { arquetipo, zonas, brilho: 0, combo: 0, ultimoCerto: NUNCA, ultimoTraco, erros: 0, oops: 0, curativos: 0, tracos: 0, turboAte: NUNCA };
}

/**
 * Proximidade 0..1 de uma zona ao alvo do tema.
 * @param {Zona} zona @param {number} alvo @param {number} rigor
 */
export function proximidade(zona, alvo, rigor) {
  const erro = zona.comp >= alvo ? zona.comp - alvo : EXCESSO * (alvo - zona.comp);
  return clamp(1 - (rigor * erro) / TOLERANCIA, 0, 1);
}

/**
 * Progresso 0..100 por zona, por dominio e a qualidade final.
 * @param {Cliente} c
 * @param {import('./temas.js').Tema} tema
 * @param {{ punir?: boolean }} [opcoes]   punir: descontar erros e curativos (a partir da 3a rodada)
 */
export function progresso(c, tema, { punir = true } = {}) {
  /** @type {Record<string, number>} */
  const zonas = {};
  for (const z of ZONAS) {
    const zona = c.zonas[z];
    zonas[z] = 100 * proximidade(zona, tema.alvo[z], tema.rigor) * (0.6 + 0.4 * zona.forma);
  }
  const media = (lista) => {
    let soma = 0;
    let pesos = 0;
    for (const z of lista) {
      soma += PESO_ZONA[z] * zonas[z];
      pesos += PESO_ZONA[z];
    }
    return soma / pesos;
  };
  const cabelo = media(ZONAS_CABELO);
  const barba = media(ZONAS_BARBA);
  let qualidade = (tema.foco.cabelo * cabelo + tema.foco.barba * barba) * (1 + (cabelo >= POMADA_MIN_CABELO ? tema.brilhoPeso * c.brilho : 0));
  if (tema.precisao) {
    const m = ZONAS_CABELO.reduce((s, z) => s + zonas[z], 0) / ZONAS_CABELO.length;
    const desvio = Math.sqrt(ZONAS_CABELO.reduce((s, z) => s + (zonas[z] - m) ** 2, 0) / ZONAS_CABELO.length);
    qualidade -= 0.2 * desvio;
  }
  if (punir) qualidade -= c.curativos * 2 + Math.min(10, c.erros);
  return { zonas, cabelo, barba, qualidade: clamp(qualidade, 0, 100), brilho: c.brilho };
}

/** @param {Cliente} c @param {string} z @param {import('./temas.js').Tema} tema */
function zonaPronta(c, z, tema) {
  const zona = c.zonas[z];
  return proximidade(zona, tema.alvo[z], tema.rigor) >= ZONA_PRONTA.prox && zona.forma >= ZONA_PRONTA.forma;
}

/**
 * Aplica um traco e devolve o cliente novo e os eventos (nunca muda o de entrada).
 * @param {Cliente} c
 * @param {Traco} traco
 * @param {import('./temas.js').Tema} tema
 * @param {{ punir?: boolean }} [opcoes]
 * @returns {{ cliente: Cliente, eventos: Array<Record<string, any>> }}
 */
export function aplicarTraco(c, traco, tema, { punir = false } = {}) {
  /** @type {Array<Record<string, any>>} */
  const eventos = [];
  const f = ferramentaPorId(traco.ferramenta);
  const z = traco.zona;
  if (!f || !ZONAS.includes(z)) return { cliente: c, eventos: [{ tipo: 'recusado', motivo: 'traco' }] };
  const t = Number(traco.t) || 0;
  const intensidade = clamp(Number(traco.intensidade) || 0, 0.15, 1);
  const precisao = traco.precisao === undefined ? 1 : clamp(Number(traco.precisao) || 0, 0, 1);
  const dominio = DOMINIO_ZONA[z];
  const zonas = { ...c.zonas, [z]: { ...c.zonas[z] } };
  const cliente = { ...c, zonas, ultimoTraco: { ...c.ultimoTraco, [z]: t }, tracos: c.tracos + 1 };
  const antes = progresso(c, tema, { punir: false });

  // Pomada: brilho global, so com o cabelo pronto; deslizar para cima ergue o topete.
  if (f.dominio.includes('brilho')) {
    if (antes.cabelo < POMADA_MIN_CABELO) {
      eventos.push({ tipo: 'pomadaCedo', zona: z });
      return { cliente, eventos };
    }
    cliente.brilho = clamp(c.brilho + 0.25 * intensidade, 0, 1);
    if (traco.direcao === 'cima' && z === 'topo') zonas.topo.forma = clamp(zonas.topo.forma + 0.1 * intensidade, 0, 1);
    if (traco.direcao === 'lado' && z === 'franja') zonas.franja.forma = clamp(zonas.franja.forma + 0.1 * intensidade, 0, 1);
    eventos.push({ tipo: 'pomada', zona: z, brilho: cliente.brilho });
    return { cliente, eventos };
  }

  // Ferramenta fora do dominio da zona: ops visual; so pune depois das primeiras rodadas.
  if (!f.dominio.includes(dominio)) {
    cliente.oops = c.oops + 1;
    if (punir) cliente.erros = c.erros + 1;
    cliente.combo = 0;
    eventos.push({ tipo: 'oops', zona: z, ferramenta: f.id });
    return { cliente, eventos };
  }

  const zona = zonas[z];
  const ritmo = t - c.ultimoTraco[z] < RITMO_MS ? RITMO_FATOR : 1;
  const combo = c.combo >= COMBO.limiar ? COMBO.bonus : 1;
  const turbo = t < c.turboAte ? TORCIDA.bonus : 1;
  const bonus = combo * turbo;
  const alvo = tema.alvo[z];
  const excesso = f.comp < 0 && zona.comp <= alvo - 0.05;
  if (f.comp < 0) {
    // O bonus (combo, turbo) acelera o corte mas nunca empurra alem do alvo: so a parte
    // base do traco pode passar, e essa e responsabilidade de quem corta.
    const base = -f.comp * (f.bonusZona[z] || 1) * intensidade * ritmo;
    const extra = Math.min(base * (bonus - 1), Math.max(0, zona.comp - alvo - base));
    zona.comp = clamp(zona.comp - base - extra, 0, 1);
  }
  if (f.forma > 0) zona.forma = clamp(zona.forma + f.forma * intensidade * (f.precisao ? precisao : 1) * (1 - zona.forma) * bonus, 0, 1);
  else if (f.forma < 0) zona.forma = clamp(zona.forma + f.forma * intensidade, 0, 1);
  eventos.push({ tipo: 'traco', zona: z, ferramenta: f.id, intensidade, comp: zona.comp, forma: zona.forma });

  if (excesso) {
    cliente.combo = 0;
    eventos.push({ tipo: 'excesso', zona: z });
  } else {
    cliente.combo = t - c.ultimoCerto <= COMBO.janelaMs ? c.combo + 1 : 1;
    cliente.ultimoCerto = t;
    if (cliente.combo === COMBO.limiar) eventos.push({ tipo: 'combo', n: cliente.combo });
  }
  if (f.precisao) {
    if (precisao >= PRECISAO.perfeito) eventos.push({ tipo: 'perfeito', zona: z });
    else if (precisao < PRECISAO.curativo && punir && c.curativos < PRECISAO.curativosMax) {
      cliente.curativos = c.curativos + 1;
      eventos.push({ tipo: 'curativo', zona: z, n: cliente.curativos });
    }
  }
  if (!zonaPronta(c, z, tema) && zonaPronta(cliente, z, tema)) eventos.push({ tipo: 'zonaPronta', zona: z });
  return { cliente, eventos };
}

/**
 * Liga o Turbo da torcida por TORCIDA.turboMs a partir de t.
 * @param {Cliente} c @param {number} t
 */
export function ligarTurbo(c, t) {
  return { ...c, turboAte: t + TORCIDA.turboMs };
}

/** Resumo compacto para o snapshot (sem os carimbos de tempo). */
export function resumirCliente(c) {
  /** @type {Record<string, [number, number]>} */
  const zonas = {};
  for (const z of ZONAS) zonas[z] = [Math.round(c.zonas[z].comp * 100) / 100, Math.round(c.zonas[z].forma * 100) / 100];
  return { arquetipo: c.arquetipo, zonas, brilho: Math.round(c.brilho * 100) / 100, combo: c.combo, curativos: c.curativos, tracos: c.tracos };
}
