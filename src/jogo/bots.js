// Bots: barbeiro automatico com ritmo humano e habilidade variavel, e espectador
// que escolhe, vota, reage e torce. Puro: decidirBot(estado, id, t, memoria)
// devolve o evento (ou null) e a memoria nova; o rng do bot vive na memoria.
import { ZONAS, ZONAS_CABELO, PESO_ZONA, DOMINIO_ZONA, REACOES, POMADA_MIN_CABELO, clamp } from './constantes.js';
import { ferramentaPorId } from './ferramentas.js';
import { progresso } from './corte.js';
import { rngPasso } from './aleatorio.js';

/**
 * @typedef {Object} MemoriaBot
 * @property {number} rng
 * @property {number} saguaoVisto     inicioEm do saguao ja tratado
 * @property {number} escolheEm
 * @property {number} rodadaVista     inicioEm da rodada ja tratada
 * @property {number} pensaAte
 * @property {number} pausaAte
 * @property {number} proxTracoEm
 * @property {number} rajada
 * @property {string} ferramenta
 * @property {number} votacaoVista
 * @property {number} votaEm
 * @property {number} reacoes
 * @property {number} proxReacaoEm
 * @property {number} proxTorcidaEm
 * @property {number} torcidaRestante
 * @property {string} torcidaAlvo
 */

/** @param {number} semente @returns {MemoriaBot} */
export function criarMemoriaBot(semente) {
  return {
    rng: semente >>> 0, saguaoVisto: -1, escolheEm: 0, rodadaVista: -1, pensaAte: 0, pausaAte: 0, proxTracoEm: 0, rajada: 0,
    ferramenta: 'tesoura', votacaoVista: -1, votaEm: 0, reacoes: 0, proxReacaoEm: 0, proxTorcidaEm: 0, torcidaRestante: 0, torcidaAlvo: '',
  };
}

/** @param {MemoriaBot} m */
function sortear(m) {
  const p = rngPasso(m.rng);
  m.rng = p.a;
  return p.v;
}

/**
 * Proximo gesto do barbeiro bot: a zona com mais trabalho pendente e a ferramenta certa.
 * @param {import('./sala.js').Sala} s @param {string} id @param {MemoriaBot} m @param {number} t
 */
function gestoBarbeiro(s, id, m, t) {
  const c = s.cliente[id];
  const tema = s.tema;
  if (!c || !tema) return null;
  const j = s.jogadores[id];
  const hab = j.habilidade;
  const margem = (1 - hab) * 0.08;
  let melhor = null;
  let melhorPeso = 0.004;
  for (const z of ZONAS) {
    const zona = c.zonas[z];
    const foco = DOMINIO_ZONA[z] === 'cabelo' ? tema.foco.cabelo : tema.foco.barba;
    const sobra = zona.comp - tema.alvo[z] - margem;
    const peso = PESO_ZONA[z] * foco * (sobra > 0 ? sobra : zona.comp <= tema.alvo[z] + margem + 0.05 ? (0.9 - zona.forma) * 0.5 : 0);
    if (peso > melhorPeso) { melhorPeso = peso; melhor = { zona: z, cortar: sobra > 0, sobra }; }
  }
  if (!melhor) {
    const p = progresso(c, tema, { punir: false });
    if (p.cabelo >= POMADA_MIN_CABELO && c.brilho < 0.9 && hab >= 0.6) return { zona: 'topo', ferramenta: 'pomada', intensidade: 0.6 + 0.4 * sortear(m), direcao: tema.id === 'festa' ? 'cima' : '' };
    return null;
  }
  const z = melhor.zona;
  const barba = DOMINIO_ZONA[z] === 'barba';
  let ferramenta = melhor.cortar ? (barba ? 'navalha' : z === 'lados' ? 'maquina' : 'tesoura') : 'pente';
  // erro ocasional: ferramenta do outro dominio
  if (sortear(m) < (1 - hab) * 0.15) ferramenta = barba ? 'maquina' : 'navalha';
  const f = ferramentaPorId(ferramenta);
  let intensidade = 0.4 + 0.5 * sortear(m);
  if (melhor.cortar && f.comp < 0) {
    const delta = -f.comp * (f.bonusZona[z] || 1);
    intensidade = clamp((melhor.sobra + margem * 0.5) / delta, 0.2, 0.85);
  }
  const precisao = clamp(0.45 + 0.55 * hab + (sortear(m) - 0.5) * 0.3, 0, 1);
  return { zona: z, ferramenta, intensidade, precisao, direcao: '' };
}

/**
 * @param {import('./sala.js').Sala} s
 * @param {string} id
 * @param {number} t
 * @param {MemoriaBot} m0
 * @returns {{ evento: Record<string, any>|null, memoria: MemoriaBot }}
 */
export function decidirBot(s, id, t, m0) {
  const m = { ...m0 };
  const j = s.jogadores[id];
  if (!j || !j.conectado) return { evento: null, memoria: m };
  const barbeiro = s.cadeiras.includes(id);
  const T = s.tempos; // as esperas escalam com os tempos da sala (normais ou rapidos)

  if (s.estado === 'saguao') {
    if (m.saguaoVisto !== s.inicioEm) {
      m.saguaoVisto = s.inicioEm;
      m.escolheEm = s.inicioEm + T.saguao * (0.033 + 0.1 * sortear(m));
      m.reacoes = 0;
    }
    if (!j.escolha && t >= m.escolheEm) return { evento: { tipo: 'escolher', id, opcao: 'jogar', t }, memoria: m };
    return { evento: null, memoria: m };
  }

  if (s.estado === 'rodada') {
    if (m.rodadaVista !== s.inicioEm) {
      m.rodadaVista = s.inicioEm;
      m.pensaAte = s.inicioEm + T.rodada * (0.0055 + 0.011 * sortear(m));
      m.pausaAte = 0;
      m.proxTracoEm = 0;
      m.rajada = 0;
      m.ferramenta = 'tesoura';
      m.proxReacaoEm = s.inicioEm + T.rodada * (0.03 + 0.2 * sortear(m));
      m.proxTorcidaEm = s.inicioEm + T.rodada * (0.045 + 0.11 * sortear(m));
      m.torcidaRestante = 0;
    }
    if (barbeiro) {
      if (t < m.pensaAte || t < m.pausaAte || t < m.proxTracoEm) return { evento: null, memoria: m };
      const mosca = s.caos.find((c) => c.ativo && c.tipo === 'mosca' && c.toques[id] >= 0);
      if (mosca && sortear(m) < 0.5 + 0.4 * j.habilidade) return { evento: { tipo: 'caos', id, acao: 'mosca', t }, memoria: m };
      const g = gestoBarbeiro(s, id, m, t);
      if (!g) { m.proxTracoEm = t + 400; return { evento: null, memoria: m }; }
      if (g.ferramenta !== m.ferramenta) {
        m.ferramenta = g.ferramenta;
        m.proxTracoEm = t + 300 + 400 * sortear(m);
        return { evento: { tipo: 'ferramenta', id, ferramenta: g.ferramenta, t }, memoria: m };
      }
      m.rajada += 1;
      m.proxTracoEm = t + 150 + 250 * sortear(m);
      if (m.rajada >= 3 + Math.floor(sortear(m) * 4)) {
        m.rajada = 0;
        m.pausaAte = t + 600 + 900 * sortear(m);
      }
      return { evento: { tipo: 'traco', id, zona: g.zona, ferramenta: g.ferramenta, intensidade: g.intensidade, precisao: g.precisao, direcao: g.direcao, t }, memoria: m };
    }
    // espectador: reacoes e torcida
    if (t >= m.proxReacaoEm && m.reacoes < 3) {
      m.reacoes += 1;
      m.proxReacaoEm = t + T.rodada * (0.08 + 0.22 * sortear(m));
      return { evento: { tipo: 'reagir', id, reacao: Math.floor(sortear(m) * REACOES.length), t }, memoria: m };
    }
    if (m.torcidaRestante > 0 && t >= m.proxTorcidaEm) {
      m.torcidaRestante -= 1;
      m.proxTorcidaEm = t + 200 + 150 * sortear(m);
      return { evento: { tipo: 'torcer', id, alvo: m.torcidaAlvo, t }, memoria: m };
    }
    if (m.torcidaRestante === 0 && t >= m.proxTorcidaEm) {
      const alvos = s.cadeiras.filter(Boolean);
      if (alvos.length) {
        m.torcidaAlvo = alvos[Math.floor(sortear(m) * alvos.length)];
        m.torcidaRestante = 3 + Math.floor(sortear(m) * 4);
      }
      m.proxTorcidaEm = t + T.rodada * (0.055 + 0.14 * sortear(m));
    }
    return { evento: null, memoria: m };
  }

  if (s.estado === 'votacao' && !barbeiro) {
    if (m.votacaoVista !== s.votacaoInicioEm) {
      m.votacaoVista = s.votacaoInicioEm;
      m.votaEm = s.votacaoInicioEm + T.votacao * (0.13 + 0.47 * sortear(m));
    }
    if (!s.votos[id] && t >= m.votaEm && s.tema) {
      const [a, b] = s.cadeiras;
      if (!a || !b) return { evento: null, memoria: m };
      const qa = s.cliente[a] ? progresso(s.cliente[a], s.tema, { punir: false }).qualidade : 0;
      const qb = s.cliente[b] ? progresso(s.cliente[b], s.tema, { punir: false }).qualidade : 0;
      const ruido = (sortear(m) - 0.5) * 24;
      return { evento: { tipo: 'votar', id, alvo: qa + ruido >= qb ? a : b, t }, memoria: m };
    }
  }
  return { evento: null, memoria: m };
}

export { ZONAS_CABELO };
