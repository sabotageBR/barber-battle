// Reducer puro da sala: aplicar(estado, evento) => { estado, eventos }.
// E a fonte da verdade no servidor e o motor do modo local no cliente. Nao le
// relogio nem sorteia por conta propria: o tempo vem em `evento.t` e o rng
// vive no estado (mulberry32). O estado de entrada nunca e alterado.
import {
  ESTADOS, TEMPOS, LIMITES, PONTOS, TORCIDA, CAOS, REACOES, ZONAS, clamp,
} from './constantes.js';
import { sortearTema, temaPorId } from './temas.js';
import { ferramentaPorId } from './ferramentas.js';
import { criarCliente, aplicarTraco, progresso, ligarTurbo, resumirCliente } from './corte.js';
import { entrarNaFila, sairDaFila, paraOFim, posicoes, candidatos, escolherCadeiras, substituto } from './fila.js';
import { rngPasso } from './aleatorio.js';
import { nomeValido, avatarPermitido } from './nomes.js';

/** @typedef {import('./corte.js').Cliente} Cliente */

/**
 * @typedef {Object} Jogador
 * @property {string} id
 * @property {[number, number]} nome
 * @property {{ cor: number, chapeu: number }} avatar
 * @property {'barbeiro'|'espectador'} papel
 * @property {number} pontos
 * @property {number} vitorias
 * @property {boolean} conectado
 * @property {boolean} bot
 * @property {number} habilidade      0..1 (bots)
 * @property {''|'jogar'|'assistir'} escolha
 * @property {boolean} emAnuncio
 * @property {number} entrouEm
 * @property {number} ultimoInputEm
 * @property {number} rodadas         rodadas jogadas como barbeiro
 * @property {number|null} desconectouEm
 */

/**
 * @typedef {Object} Sala
 * @property {number} v
 * @property {string} id
 * @property {string} estado
 * @property {number} rodada
 * @property {number} inicioEm
 * @property {number} fimEm
 * @property {typeof TEMPOS} tempos
 * @property {number} rng
 * @property {Record<string, Jogador>} jogadores
 * @property {string[]} fila
 * @property {(string|null)[]} cadeiras
 * @property {import('./temas.js').Tema|null} tema
 * @property {import('./temas.js').Tema|null} temaProx
 * @property {Record<string, Cliente>} cliente
 * @property {Record<string, string>} ferramenta
 * @property {Record<string, number>} ultimoTracoEm
 * @property {Record<string, boolean>} dormindo
 * @property {Record<string, string>} votos
 * @property {number} votacaoInicioEm
 * @property {number} desempate
 * @property {Record<string, { toques: number, desde: number }>} torcida
 * @property {Array<Record<string, any>>} caos
 * @property {Record<string, any>|null} resultado
 * @property {boolean} cancelada
 */

/**
 * @param {{ id: string, semente: number, agora: number, tempos?: typeof TEMPOS }} p
 * @returns {Sala}
 */
export function criarSala({ id, semente, agora, tempos = TEMPOS }) {
  return {
    v: 1, id, estado: 'espera', rodada: 0, inicioEm: agora, fimEm: 0, tempos, rng: semente >>> 0,
    jogadores: {}, fila: [], cadeiras: [null, null], tema: null, temaProx: null,
    cliente: {}, ferramenta: {}, ultimoTracoEm: {}, dormindo: {}, votos: {}, votacaoInicioEm: 0, desempate: 0,
    torcida: {}, caos: [], resultado: null, cancelada: false,
  };
}

/** @param {Sala} s */
function sortear(s) {
  const p = rngPasso(s.rng);
  s.rng = p.a;
  return p.v;
}

/** @param {Sala} s */
function humanos(s) {
  return Object.values(s.jogadores).filter((j) => !j.bot);
}

/** @param {Sala} s @param {string} id */
function ehBarbeiro(s, id) {
  return s.cadeiras.includes(id);
}

/** Espectadores que podem votar nesta votacao. @param {Sala} s */
export function aptosAVotar(s) {
  return Object.values(s.jogadores).filter((j) => j.papel !== 'barbeiro' && j.conectado && !j.emAnuncio && j.entrouEm < s.votacaoInicioEm).map((j) => j.id);
}

/** Copia rasa do estado com os mapas que vao mudar copiados. @param {Sala} s */
function copiar(s) {
  return { ...s, jogadores: { ...s.jogadores }, cadeiras: [...s.cadeiras], cliente: { ...s.cliente }, ferramenta: { ...s.ferramenta }, ultimoTracoEm: { ...s.ultimoTracoEm }, dormindo: { ...s.dormindo }, votos: { ...s.votos }, torcida: { ...s.torcida }, caos: s.caos.map((c) => ({ ...c, toques: { ...(c.toques || {}) } })) };
}

/**
 * @param {Sala} s @param {string} estado @param {number} t @param {number} duracao
 * @param {Array<Record<string, any>>} eventos
 */
function mudar(s, estado, t, duracao, eventos) {
  const de = s.estado;
  s.estado = estado;
  s.inicioEm = t;
  s.fimEm = t + duracao;
  eventos.push({ tipo: 'estadoMudou', de, para: estado, inicioEm: t, fimEm: s.fimEm });
}

/** @param {Sala} s @param {number} t @param {Array<Record<string, any>>} eventos */
function abrirSaguao(s, t, eventos) {
  if (!s.temaProx) s.temaProx = sortearTema(() => sortear(s), s.tema ? s.tema.id : undefined);
  for (const id of Object.keys(s.jogadores)) s.jogadores[id] = { ...s.jogadores[id], escolha: '' };
  mudar(s, 'saguao', t, s.tempos.saguao, eventos);
  eventos.push({ tipo: 'temaRevelado', tema: s.temaProx.id, rodada: s.rodada + 1 });
}

/** @param {Sala} s @param {number} t @param {Array<Record<string, any>>} eventos */
function iniciarRodada(s, t, eventos) {
  const ocupantes = escolherCadeiras(s.fila, s.jogadores, LIMITES.cadeiras);
  if (ocupantes.length < LIMITES.cadeiras) {
    s.fimEm = t + s.tempos.saguao;
    eventos.push({ tipo: 'aguardando', fimEm: s.fimEm });
    return;
  }
  s.rodada += 1;
  s.tema = s.temaProx || sortearTema(() => sortear(s));
  s.temaProx = null;
  s.cadeiras = [ocupantes[0], ocupantes[1]];
  const arquetipos = ['tonhao', 'ze', 'bruno', 'kaique', 'chico', 'leo', 'valdir', 'jurandir', 'caio', 'osvaldo', 'dudu', 'ravi', 'mateus'];
  const arquetipo = arquetipos[Math.floor(sortear(s) * arquetipos.length)];
  const base = criarCliente(arquetipo, () => sortear(s));
  s.cliente = {};
  s.ferramenta = {};
  s.ultimoTracoEm = {};
  s.dormindo = {};
  s.torcida = {};
  s.votos = {};
  s.desempate = 0;
  s.cancelada = false;
  for (const id of s.cadeiras) {
    if (!id) continue;
    s.jogadores[id] = { ...s.jogadores[id], papel: 'barbeiro', rodadas: s.jogadores[id].rodadas + 1 };
    s.cliente[id] = JSON.parse(JSON.stringify(base));
    s.ferramenta[id] = 'tesoura';
    s.ultimoTracoEm[id] = t;
    s.torcida[id] = { toques: 0, desde: t };
  }
  // eventos de caos: iguais para os dois, sorteados dentro da rodada (20%..80%)
  s.caos = [];
  if (s.rodada >= CAOS.aPartirDaRodada) {
    const n = CAOS.porRodada[0] + Math.floor(sortear(s) * (CAOS.porRodada[1] - CAOS.porRodada[0] + 1));
    for (let i = 0; i < n; i++) {
      const tipo = CAOS.tipos[Math.floor(sortear(s) * CAOS.tipos.length)];
      const em = t + s.tempos.rodada * (0.2 + 0.6 * sortear(s));
      s.caos.push({ tipo, em, ativo: false, ate: 0, toques: {}, sacudindo: {} });
    }
    s.caos.sort((a, b) => a.em - b.em);
  }
  mudar(s, 'rodada', t, s.tempos.rodada, eventos);
  eventos.push({ tipo: 'rodadaComecou', rodada: s.rodada, tema: s.tema.id, cadeiras: [...s.cadeiras], arquetipo });
}

/** @param {Sala} s @param {number} t @param {Array<Record<string, any>>} eventos */
function abrirVotacao(s, t, eventos) {
  const ocupadas = s.cadeiras.filter(Boolean);
  if (ocupadas.length < 2) {
    // uma cadeira ficou vazia sem substituto: quem ficou vence sem votacao
    fecharRodada(s, t, eventos, ocupadas[0] || null, false, { A: 0, B: 0 });
    return;
  }
  s.votacaoInicioEm = t;
  s.votos = {};
  mudar(s, 'votacao', t, s.tempos.votacao, eventos);
  eventos.push({ tipo: 'votacaoAberta', cadeiras: [...s.cadeiras] });
}

/** @param {Sala} s */
function contarVotos(s) {
  const [a, b] = s.cadeiras;
  let A = 0;
  let B = 0;
  for (const alvo of Object.values(s.votos)) {
    if (alvo === a) A++;
    else if (alvo === b) B++;
  }
  return { A, B };
}

/**
 * @param {Sala} s @param {number} t @param {Array<Record<string, any>>} eventos
 * @param {string|null} vencedor @param {boolean} empate @param {{ A: number, B: number }} votos
 */
function fecharRodada(s, t, eventos, vencedor, empate, votos) {
  const [a, b] = s.cadeiras;
  /** @type {Record<string, number>} */
  const qualidade = {};
  /** @type {Record<string, number>} */
  const pontos = {};
  for (const id of [a, b]) {
    if (!id) continue;
    const j = s.jogadores[id];
    qualidade[id] = s.cliente[id] ? Math.round(progresso(s.cliente[id], s.tema, { punir: j.rodadas >= 3 }).qualidade) : 0;
    pontos[id] = s.cancelada ? PONTOS.cancelada : id === vencedor ? PONTOS.vencedor : PONTOS.perdedor;
    s.jogadores[id] = { ...j, pontos: j.pontos + pontos[id], vitorias: j.vitorias + (id === vencedor ? 1 : 0) };
  }
  s.resultado = { rodada: s.rodada, cadeiras: [a, b], vencedor, empate, votos, pontos, qualidade, dobrou: {}, cancelada: s.cancelada };
  mudar(s, 'resultado', t, s.tempos.resultado, eventos);
  eventos.push({ tipo: 'resultado', ...s.resultado });
}

/** @param {Sala} s @param {number} t @param {Array<Record<string, any>>} eventos */
function apurar(s, t, eventos) {
  const [a, b] = s.cadeiras;
  const votos = contarVotos(s);
  if (votos.A !== votos.B) {
    fecharRodada(s, t, eventos, votos.A > votos.B ? a : b, false, votos);
    return;
  }
  if (s.desempate === 0 && a && b) {
    s.desempate = 1;
    s.votos = {};
    mudar(s, 'rodada', t, s.tempos.desempate, eventos);
    eventos.push({ tipo: 'empate', votos, fimEm: s.fimEm });
    return;
  }
  const qa = a && s.cliente[a] ? progresso(s.cliente[a], s.tema).qualidade : -1;
  const qb = b && s.cliente[b] ? progresso(s.cliente[b], s.tema).qualidade : -1;
  let vencedor = qa > qb ? a : qb > qa ? b : (sortear(s) < 0.5 ? a : b);
  fecharRodada(s, t, eventos, vencedor, true, votos);
}

/** @param {Sala} s @param {number} t @param {Array<Record<string, any>>} eventos */
function encerrarTransicao(s, t, eventos) {
  const saem = s.cadeiras.filter(Boolean);
  for (const id of saem) if (s.jogadores[id]) s.jogadores[id] = { ...s.jogadores[id], papel: 'espectador' };
  s.fila = paraOFim(s.fila, saem);
  s.cadeiras = [null, null];
  s.cliente = {};
  s.ferramenta = {};
  s.caos = [];
  s.torcida = {};
  eventos.push({ tipo: 'filaMudou', fila: [...s.fila] });
  abrirSaguao(s, t, eventos);
}

/**
 * Cadeira abandonada no meio da rodada: substituto assume o cliente como esta.
 * @param {Sala} s @param {string} id @param {number} t @param {string} motivo
 * @param {Array<Record<string, any>>} eventos
 */
function trocarCadeira(s, id, t, motivo, eventos) {
  const i = s.cadeiras.indexOf(id);
  if (i < 0) return;
  const novo = substituto(s.fila, s.jogadores, s.cadeiras.filter(Boolean));
  const cliente = s.cliente[id];
  delete s.cliente[id];
  delete s.ferramenta[id];
  delete s.ultimoTracoEm[id];
  delete s.dormindo[id];
  const torcida = s.torcida[id] || { toques: 0, desde: t };
  delete s.torcida[id];
  if (s.jogadores[id]) s.jogadores[id] = { ...s.jogadores[id], papel: 'espectador' };
  s.cadeiras[i] = novo;
  if (novo) {
    s.jogadores[novo] = { ...s.jogadores[novo], papel: 'barbeiro', rodadas: s.jogadores[novo].rodadas + 1 };
    s.cliente[novo] = cliente;
    s.ferramenta[novo] = 'tesoura';
    s.ultimoTracoEm[novo] = t;
    s.torcida[novo] = torcida;
    for (const [k, v] of Object.entries(s.votos)) if (v === id) s.votos[k] = novo;
  }
  eventos.push({ tipo: 'cadeiraTrocou', cadeira: i, de: id, para: novo, motivo });
  if (!s.cadeiras.some(Boolean) && (s.estado === 'rodada' || s.estado === 'votacao')) {
    s.cancelada = true;
    fecharRodada(s, t, eventos, null, false, { A: 0, B: 0 });
    eventos.push({ tipo: 'rodadaCancelada' });
  }
}

/**
 * @param {Sala} s @param {number} t @param {Array<Record<string, any>>} eventos
 */
function processarCaos(s, t, eventos) {
  for (const c of s.caos) {
    if (!c.ativo && !c.fim && t >= c.em) {
      c.ativo = true;
      c.ate = t + (c.tipo === 'mosca' ? CAOS.moscaMs : CAOS.espirroMs);
      for (const id of s.cadeiras) if (id) { c.toques[id] = 0; if (c.tipo === 'espirro') c.sacudindo[id] = c.ate; }
      eventos.push({ tipo: 'caos', acao: c.tipo, ate: c.ate });
    } else if (c.ativo && t >= c.ate) {
      c.ativo = false;
      c.fim = true;
      if (c.tipo === 'mosca') {
        for (const id of s.cadeiras) {
          if (!id || c.toques[id] === -1) continue;
          c.sacudindo[id] = t + CAOS.sacudidaMs;
          eventos.push({ tipo: 'sacudida', jogador: id, ate: c.sacudindo[id] });
        }
      }
      eventos.push({ tipo: 'caosFim', acao: c.tipo });
    }
  }
}

/** O barbeiro esta sendo sacudido (mosca nao espantada ou espirro)? @param {Sala} s @param {string} id @param {number} t */
export function sacudindo(s, id, t) {
  return s.caos.some((c) => c.sacudindo && c.sacudindo[id] && t < c.sacudindo[id]);
}

/**
 * @param {Sala} s0
 * @param {Record<string, any>} ev   { tipo, t, ... }
 * @returns {{ estado: Sala, eventos: Array<Record<string, any>> }}
 */
export function aplicar(s0, ev) {
  const s = copiar(s0);
  /** @type {Array<Record<string, any>>} */
  const eventos = [];
  const t = Number(ev.t) || 0;
  const j = ev.id ? s.jogadores[ev.id] : null;
  const recusar = (motivo) => { eventos.push({ tipo: 'recusado', id: ev.id, evento: ev.tipo, motivo }); return { estado: s0, eventos }; };
  const marcarInput = () => { if (j) s.jogadores[ev.id] = { ...s.jogadores[ev.id], ultimoInputEm: t }; };

  switch (ev.tipo) {
    case 'entrar': {
      if (s.jogadores[ev.id]) return recusar('repetido');
      if (Object.keys(s.jogadores).length >= LIMITES.salaMax) return recusar('lotada');
      if (!ev.bot && humanos(s).length >= LIMITES.humanosMax) return recusar('lotada');
      const nome = nomeValido(ev.nome) ? ev.nome : [Math.floor(sortear(s) * 24), Math.floor(sortear(s) * 24)];
      s.jogadores[ev.id] = {
        id: ev.id, nome, avatar: avatarPermitido(ev.avatar, Number(ev.vitorias) || 0), papel: 'espectador', pontos: 0, vitorias: 0,
        conectado: true, bot: !!ev.bot, habilidade: clamp(Number(ev.habilidade) || 0.6, 0, 1), escolha: '', emAnuncio: false,
        entrouEm: t, ultimoInputEm: t, rodadas: 0, desconectouEm: null,
      };
      s.fila = entrarNaFila(s.fila, ev.id);
      eventos.push({ tipo: 'jogadorEntrou', id: ev.id, bot: !!ev.bot });
      eventos.push({ tipo: 'filaMudou', fila: [...s.fila] });
      if (s.estado === 'espera' && Object.keys(s.jogadores).length >= 2) abrirSaguao(s, t, eventos);
      return { estado: s, eventos };
    }
    case 'sair': {
      if (!j) return recusar('desconhecido');
      if (ehBarbeiro(s, ev.id)) trocarCadeira(s, ev.id, t, 'saiu', eventos);
      delete s.jogadores[ev.id];
      s.fila = sairDaFila(s.fila, ev.id);
      delete s.votos[ev.id];
      eventos.push({ tipo: 'jogadorSaiu', id: ev.id });
      eventos.push({ tipo: 'filaMudou', fila: [...s.fila] });
      if (s.estado === 'votacao' && aptosAVotar(s).every((id) => s.votos[id])) s.fimEm = Math.min(s.fimEm, t + s.tempos.votacaoMin);
      return { estado: s, eventos };
    }
    case 'desconectar':
      if (!j) return recusar('desconhecido');
      s.jogadores[ev.id] = { ...j, conectado: false, desconectouEm: t };
      eventos.push({ tipo: 'desconectou', id: ev.id });
      return { estado: s, eventos };
    case 'reconectar':
      if (!j) return recusar('desconhecido');
      s.jogadores[ev.id] = { ...j, conectado: true, desconectouEm: null, ultimoInputEm: t };
      eventos.push({ tipo: 'reconectou', id: ev.id });
      return { estado: s, eventos };
    case 'abandonarCadeira':
      if (!j || !ehBarbeiro(s, ev.id)) return recusar('naoBarbeiro');
      if (s.estado !== 'rodada' && s.estado !== 'votacao') return recusar('estado');
      trocarCadeira(s, ev.id, t, ev.motivo || 'abandono', eventos);
      return { estado: s, eventos };
    case 'anuncio':
      if (!j) return recusar('desconhecido');
      s.jogadores[ev.id] = { ...j, emAnuncio: true };
      return { estado: s, eventos };
    case 'pronto':
      if (!j) return recusar('desconhecido');
      s.jogadores[ev.id] = { ...j, emAnuncio: false, conectado: true, ultimoInputEm: t };
      return { estado: s, eventos };
    case 'escolher': {
      if (!j) return recusar('desconhecido');
      if (s.estado !== 'saguao') return recusar('estado');
      s.jogadores[ev.id] = { ...j, escolha: ev.opcao === 'jogar' ? 'jogar' : 'assistir', ultimoInputEm: t };
      eventos.push({ tipo: 'escolha', id: ev.id, opcao: s.jogadores[ev.id].escolha });
      const pendentes = humanos(s).filter((h) => h.conectado && !h.emAnuncio && !h.escolha);
      if (pendentes.length === 0 && candidatos(s.fila, s.jogadores).length >= LIMITES.cadeiras) {
        s.fimEm = Math.min(s.fimEm, t + s.tempos.saguaoMin);
      }
      return { estado: s, eventos };
    }
    case 'ferramenta':
      if (!j || !ehBarbeiro(s, ev.id)) return recusar('naoBarbeiro');
      if (s.estado !== 'rodada') return recusar('estado');
      if (!ferramentaPorId(ev.ferramenta)) return recusar('ferramenta');
      s.ferramenta[ev.id] = ev.ferramenta;
      marcarInput();
      eventos.push({ tipo: 'ferramenta', id: ev.id, ferramenta: ev.ferramenta });
      return { estado: s, eventos };
    case 'traco': {
      if (!j || !ehBarbeiro(s, ev.id)) return recusar('naoBarbeiro');
      if (s.estado !== 'rodada') return recusar('estado');
      if (!s.cliente[ev.id]) return recusar('semCliente');
      marcarInput();
      const dormia = t - (s.ultimoTracoEm[ev.id] ?? t) > s.tempos.cochilo;
      s.ultimoTracoEm[ev.id] = t;
      if (dormia) {
        s.dormindo[ev.id] = false;
        eventos.push({ tipo: 'acordou', id: ev.id });
      }
      if (sacudindo(s, ev.id, t)) {
        eventos.push({ tipo: 'tracoErrou', id: ev.id, zona: ev.zona });
        return { estado: s, eventos };
      }
      const r = aplicarTraco(s.cliente[ev.id], {
        zona: ev.zona, ferramenta: ev.ferramenta, intensidade: ev.intensidade, precisao: ev.precisao, direcao: ev.direcao, t,
      }, s.tema, { punir: j.rodadas >= 3 });
      s.cliente[ev.id] = r.cliente;
      s.ferramenta[ev.id] = ev.ferramenta;
      for (const e of r.eventos) eventos.push({ ...e, id: ev.id });
      return { estado: s, eventos };
    }
    case 'votar': {
      if (!j) return recusar('desconhecido');
      if (s.estado !== 'votacao') return recusar('estado');
      if (!aptosAVotar(s).includes(ev.id)) return recusar('naoApto');
      if (!s.cadeiras.includes(ev.alvo) || !ev.alvo) return recusar('alvo');
      s.votos[ev.id] = ev.alvo;
      marcarInput();
      const votos = contarVotos(s);
      eventos.push({ tipo: 'voto', total: votos.A + votos.B });
      if (aptosAVotar(s).every((id) => s.votos[id])) s.fimEm = Math.min(s.fimEm, t + s.tempos.votacaoMin);
      return { estado: s, eventos };
    }
    case 'reagir':
      if (!j) return recusar('desconhecido');
      if (!Number.isInteger(ev.reacao) || ev.reacao < 0 || ev.reacao >= REACOES.length) return recusar('reacao');
      marcarInput();
      eventos.push({ tipo: 'reacao', id: ev.id, reacao: ev.reacao });
      return { estado: s, eventos };
    case 'torcer': {
      if (!j || ehBarbeiro(s, ev.id)) return recusar('naoEspectador');
      if (s.estado !== 'rodada') return recusar('estado');
      if (!s.cadeiras.includes(ev.alvo) || !ev.alvo) return recusar('alvo');
      marcarInput();
      const tz = s.torcida[ev.alvo] || { toques: 0, desde: t };
      const toques = t - tz.desde > TORCIDA.janelaMs ? 1 : tz.toques + 1;
      const desde = t - tz.desde > TORCIDA.janelaMs ? t : tz.desde;
      if (toques >= TORCIDA.cheia) {
        s.torcida[ev.alvo] = { toques: 0, desde: t };
        if (s.cliente[ev.alvo]) s.cliente[ev.alvo] = ligarTurbo(s.cliente[ev.alvo], t);
        eventos.push({ tipo: 'turbo', id: ev.alvo, ate: t + TORCIDA.turboMs });
      } else {
        s.torcida[ev.alvo] = { toques, desde };
        eventos.push({ tipo: 'torcida', id: ev.alvo, toques, de: ev.id });
      }
      return { estado: s, eventos };
    }
    case 'caos': {
      if (!j || !ehBarbeiro(s, ev.id)) return recusar('naoBarbeiro');
      if (s.estado !== 'rodada') return recusar('estado');
      marcarInput();
      const c = s.caos.find((x) => x.ativo && x.tipo === ev.acao && x.toques[ev.id] >= 0);
      if (!c) return recusar('semCaos');
      c.toques[ev.id] += 1;
      if (c.tipo === 'mosca' && c.toques[ev.id] >= CAOS.moscaToques) {
        c.toques[ev.id] = -1; // espantada por este barbeiro
        eventos.push({ tipo: 'moscaFoi', id: ev.id });
      } else eventos.push({ tipo: 'caosToque', id: ev.id, toques: c.toques[ev.id] });
      return { estado: s, eventos };
    }
    case 'recompensa': {
      if (!j) return recusar('desconhecido');
      const r = s.resultado;
      if (!r || r.rodada !== ev.rodada || !r.cadeiras.includes(ev.id) || r.dobrou[ev.id] || r.cancelada) return recusar('recompensa');
      const ganho = r.pontos[ev.id] || 0;
      s.resultado = { ...r, dobrou: { ...r.dobrou, [ev.id]: true } };
      s.jogadores[ev.id] = { ...j, pontos: j.pontos + ganho };
      eventos.push({ tipo: 'dobrou', id: ev.id, pontos: ganho });
      return { estado: s, eventos };
    }
    case 'tique': {
      if (s.estado === 'rodada') {
        processarCaos(s, t, eventos);
        for (const id of s.cadeiras) {
          if (!id) continue;
          const jb = s.jogadores[id];
          const parado = t - (s.ultimoTracoEm[id] ?? t);
          if (!jb.bot && parado > s.tempos.ocioso) {
            trocarCadeira(s, id, t, 'ocioso', eventos);
            if (s.estado !== 'rodada') break;
            continue;
          }
          if (parado > s.tempos.cochilo && !s.dormindo[id]) {
            s.dormindo[id] = true;
            eventos.push({ tipo: 'cochilo', id });
          }
        }
      }
      if (s.fimEm && t >= s.fimEm) {
        switch (s.estado) {
          case 'saguao': iniciarRodada(s, t, eventos); break;
          case 'rodada': abrirVotacao(s, t, eventos); break;
          case 'votacao': apurar(s, t, eventos); break;
          case 'resultado': mudar(s, 'transicao', t, s.tempos.transicao, eventos); break;
          case 'transicao': encerrarTransicao(s, t, eventos); break;
          default: break;
        }
      }
      return { estado: s, eventos };
    }
    default:
      return recusar('tipo');
  }
}

/**
 * Snapshot para um jogador: sem rng, votos so como totais, clientes resumidos.
 * @param {Sala} s @param {string} [voce]
 */
export function snapshotPara(s, voce) {
  /** @type {Record<string, any>} */
  const jogadores = {};
  for (const j of Object.values(s.jogadores)) {
    jogadores[j.id] = { id: j.id, nome: j.nome, avatar: j.avatar, papel: j.papel, pontos: j.pontos, vitorias: j.vitorias, conectado: j.conectado, escolha: j.escolha };
  }
  /** @type {Record<string, any>} */
  const cliente = {};
  for (const [id, c] of Object.entries(s.cliente)) cliente[id] = resumirCliente(c);
  const votos = contarVotos(s);
  return {
    v: s.v, id: s.id, estado: s.estado, rodada: s.rodada, inicioEm: s.inicioEm, fimEm: s.fimEm, tempos: s.tempos,
    voce: voce || null, jogadores, fila: [...s.fila], posicoes: posicoes(s.fila), cadeiras: [...s.cadeiras],
    tema: s.tema ? s.tema.id : null, temaProx: s.temaProx ? s.temaProx.id : null, cliente, ferramenta: { ...s.ferramenta },
    votos, desempate: s.desempate, votei: voce ? s.votos[voce] || null : null, apto: voce ? aptosAVotar(s).includes(voce) : false,
    torcida: Object.fromEntries(Object.entries(s.torcida).map(([k, v]) => [k, v.toques])),
    caos: s.caos.filter((c) => c.ativo).map((c) => ({ tipo: c.tipo, ate: c.ate, toques: { ...c.toques } })),
    resultado: s.resultado, dormindo: { ...s.dormindo },
  };
}

/**
 * Delta leve da rodada (6 Hz): progresso dos clientes, torcida, combo.
 * @param {Sala} s
 */
export function deltaRodada(s) {
  /** @type {Record<string, any>} */
  const cliente = {};
  for (const [id, c] of Object.entries(s.cliente)) {
    const p = s.tema ? progresso(c, s.tema, { punir: false }) : null;
    cliente[id] = { ...resumirCliente(c), cabelo: p ? Math.round(p.cabelo) : 0, barba: p ? Math.round(p.barba) : 0, turbo: c.turboAte };
  }
  return { estado: s.estado, fimEm: s.fimEm, cliente, ferramenta: { ...s.ferramenta }, torcida: Object.fromEntries(Object.entries(s.torcida).map(([k, v]) => [k, v.toques])), dormindo: { ...s.dormindo } };
}

export { ESTADOS, ZONAS };
