// Constantes do jogo compartilhadas pelo cliente, pelo servidor e pelos bots.
// Modulo puro: so dados.

export const VERSAO_PROTOCOLO = 1;

/** Estados da sala, na ordem do ciclo. */
export const ESTADOS = Object.freeze(['espera', 'saguao', 'rodada', 'votacao', 'resultado', 'transicao']);

/** Tempos em ms (os do documento do jogo; ajuste fino no playtest). */
export const TEMPOS = Object.freeze({
  saguao: 30000,
  saguaoMin: 3000,      // fim antecipado: espera isso depois da ultima escolha humana
  rodada: 180000,
  desempate: 30000,
  votacao: 15000,
  votacaoMin: 5000,     // fim antecipado quando todos os aptos votaram
  resultado: 10000,
  transicao: 5000,
  gracaBarbeiro: 5000,  // barbeiro desconectado mantem a cadeira por isso
  gracaJogador: 20000,  // espectador desconectado mantem a vaga por isso
  gracaAnuncio: 60000,  // quem avisou que foi ver anuncio
  ocioso: 30000,        // barbeiro sem traco por isso perde a cadeira
  salaVazia: 60000,     // sala sem humano por isso e destruida
  cochilo: 8000,        // cliente cochila se o barbeiro para por isso
});

/** Tempos curtos para testes, prints e sdkcheck (?rapido). */
export const TEMPOS_RAPIDOS = Object.freeze({
  ...TEMPOS,
  saguao: 4000, saguaoMin: 500, rodada: 12000, desempate: 4000, votacao: 3000, votacaoMin: 800,
  resultado: 2500, transicao: 1500, gracaBarbeiro: 1000, gracaJogador: 3000, gracaAnuncio: 6000,
  ocioso: 6000, salaVazia: 10000, cochilo: 3000,
});

export const LIMITES = Object.freeze({
  salaMax: 12,
  humanosMax: 6,
  bots: 8,            // alvo de jogadores por sala contando bots
  cadeiras: 2,
  msgMax: 1024,       // bytes por mensagem
  nomeMax: 24,        // tamanho maximo de um id de jogador
});

/** Zonas da cabeca. */
export const ZONAS = Object.freeze(['topo', 'lados', 'franja', 'bochechas', 'queixo', 'bigode']);
export const ZONAS_CABELO = Object.freeze(['topo', 'lados', 'franja']);
export const ZONAS_BARBA = Object.freeze(['bochechas', 'queixo', 'bigode']);
export const PESO_ZONA = Object.freeze({ topo: 1.2, lados: 1.0, franja: 0.8, bochechas: 1.0, queixo: 1.0, bigode: 0.7 });

/** Dominio (cabelo ou barba) de cada zona. */
export const DOMINIO_ZONA = Object.freeze({
  topo: 'cabelo', lados: 'cabelo', franja: 'cabelo', bochechas: 'barba', queixo: 'barba', bigode: 'barba',
});

export const PONTOS = Object.freeze({ vencedor: 10, perdedor: 3, cancelada: 0 });

/** Combo "No ritmo": tracos certos seguidos dentro da janela. */
export const COMBO = Object.freeze({ janelaMs: 1200, limiar: 5, bonus: 1.3 });

/** Torcida da plateia: toques enchem o medidor; cheio da Turbo ao barbeiro. */
export const TORCIDA = Object.freeze({ cheia: 20, janelaMs: 10000, turboMs: 5000, bonus: 1.5 });

/** Navalha de precisao. */
export const PRECISAO = Object.freeze({ perfeito: 0.8, curativo: 0.3, curativosMax: 3 });

/** A pomada so pega com o cabelo pelo menos assim (progresso 0..100). */
export const POMADA_MIN_CABELO = 60;

/** Eventos de caos (sorteados pelo servidor com o rng da sala). */
export const CAOS = Object.freeze({
  tipos: ['mosca', 'espirro'],
  aPartirDaRodada: 2,     // da sessao do jogador (a sala conta rodadas; a 1a e tranquila)
  porRodada: [1, 2],      // min e max por rodada
  moscaToques: 3,
  moscaMs: 4000,
  sacudidaMs: 2000,
  espirroMs: 1500,
});

/** Reacoes prontas da plateia (ids; o cliente mapeia para emoji ou texto). Sem chat. */
export const REACOES = Object.freeze(['palmas', 'riso', 'uau', 'fogo', 'poste', 'coracao', 'boa', 'eita']);

export const CORES_AVATAR = Object.freeze(['#ff7a1a', '#1dc9c0', '#ffd93d', '#ff5fa2', '#2a66d9', '#6b4bd6', '#38b764', '#d9442b']);

/** Chapeus e as vitorias que os destravam. */
export const CHAPEUS = Object.freeze([
  { id: 'nenhum', vitorias: 0 },
  { id: 'bone', vitorias: 1 },
  { id: 'coco', vitorias: 3 },
  { id: 'bandana', vitorias: 3 },
  { id: 'boina', vitorias: 5 },
  { id: 'coroa', vitorias: 5 },
]);

/** Arquetipos de cliente (ids das pecas da folha de personagens). */
export const ARQUETIPOS = Object.freeze([
  'tonhao', 'ze', 'bruno', 'kaique', 'chico', 'leo', 'valdir', 'jurandir', 'caio', 'osvaldo', 'dudu', 'ravi', 'mateus',
]);

/** @param {number} v @param {number} a @param {number} b */
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
