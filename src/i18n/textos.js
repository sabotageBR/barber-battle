// Textos do HUD em ingles (padrao), portugues e espanhol. Quase tudo na tela e
// icone; o texto fica para o que precisa de palavra.
import { ADJETIVOS, SUBSTANTIVOS, textoNome } from '../jogo/nomes.js';

const en = {
  jogar: 'Play', assistir: 'Watch', continuar: 'Continue', dobrarPontos: 'Double points', votar: 'Vote', voce: 'You',
  naCadeira: 'in the chair', adversario: 'rival', assistindo: 'watching', naFila: 'in line', proximoVoce: 'Next: you',
  suaVez: 'Your turn!', voceEntrou: 'You are in!', vai: 'Go!', rodada: 'Round', tema: 'Theme', cabelo: 'Hair', barba: 'Beard',
  vencedor: 'Winner', empate: 'Tie! 30 more seconds', semVencedor: 'The client left', voceVenceu: 'You won!', voceQuase: 'Almost!',
  votacao: 'Who did it better?', aguardando: 'Waiting for votes', menu: 'Menu', som: 'Sound', idioma: 'Language', privacidade: 'Privacy',
  meuBarbeiro: 'My barber', novoNome: 'New name', chapeu: 'Hat', sairCadeira: 'Leave the chair', fechar: 'Close', pausa: 'Paused',
  temas: { lenhador: 'Lumberjack beard', executivo: 'Executive cut', festa: 'Party look', militar: 'Military' },
  ferramentas: { tesoura: 'Scissors', maquina: 'Clipper', navalha: 'Razor', pente: 'Comb', pomada: 'Pomade' },
  reacoes: ['👏', '😂', '😮', '🔥', '💈', '❤️', 'Nice!', 'Whoa'],
  balao: { comeco: 'Make it good!', meio: 'Looking sharp', fim: 'Hurry!', oops: 'Hey!', pronto: 'Love it!', dormindo: 'zzz', mosca: 'A fly!', espirro: 'Achoo!' },
  chapeus: ['None', 'Cap', 'Bowler', 'Bandana', 'Beret', 'Crown'], vitoriasPara: (n) => `${n} wins`,
};
const pt = {
  jogar: 'Jogar', assistir: 'Assistir', continuar: 'Continuar', dobrarPontos: 'Dobrar pontos', votar: 'Votar', voce: 'Você',
  naCadeira: 'na cadeira', adversario: 'adversário', assistindo: 'assistindo', naFila: 'na fila', proximoVoce: 'Próximo: você',
  suaVez: 'Sua vez!', voceEntrou: 'Você entrou!', vai: 'Vai!', rodada: 'Rodada', tema: 'Tema', cabelo: 'Cabelo', barba: 'Barba',
  vencedor: 'Vencedor', empate: 'Empate! Mais 30 segundos', semVencedor: 'O cliente foi embora', voceVenceu: 'Você venceu!', voceQuase: 'Quase!',
  votacao: 'Quem mandou melhor?', aguardando: 'Esperando os votos', menu: 'Menu', som: 'Som', idioma: 'Idioma', privacidade: 'Privacidade',
  meuBarbeiro: 'Meu barbeiro', novoNome: 'Novo nome', chapeu: 'Chapéu', sairCadeira: 'Sair da cadeira', fechar: 'Fechar', pausa: 'Pausado',
  temas: { lenhador: 'Barba de Lenhador', executivo: 'Corte Executivo', festa: 'Visual de Festa', militar: 'Militar' },
  ferramentas: { tesoura: 'Tesoura', maquina: 'Máquina', navalha: 'Navalha', pente: 'Pente', pomada: 'Pomada' },
  reacoes: ['👏', '😂', '😮', '🔥', '💈', '❤️', 'Boa!', 'Eita'],
  balao: { comeco: 'Capricha aí!', meio: 'Tá ficando bom', fim: 'Corre!', oops: 'Ei!', pronto: 'Amei!', dormindo: 'zzz', mosca: 'Uma mosca!', espirro: 'Atchim!' },
  chapeus: ['Nenhum', 'Boné', 'Coco', 'Bandana', 'Boina', 'Coroa'], vitoriasPara: (n) => `${n} vitórias`,
};
const es = {
  jogar: 'Jugar', assistir: 'Mirar', continuar: 'Continuar', dobrarPontos: 'Doblar puntos', votar: 'Votar', voce: 'Tú',
  naCadeira: 'en la silla', adversario: 'rival', assistindo: 'mirando', naFila: 'en la fila', proximoVoce: 'Siguiente: tú',
  suaVez: '¡Tu turno!', voceEntrou: '¡Entraste!', vai: '¡Dale!', rodada: 'Ronda', tema: 'Tema', cabelo: 'Pelo', barba: 'Barba',
  vencedor: 'Ganador', empate: '¡Empate! 30 segundos más', semVencedor: 'El cliente se fue', voceVenceu: '¡Ganaste!', voceQuase: '¡Casi!',
  votacao: '¿Quién lo hizo mejor?', aguardando: 'Esperando los votos', menu: 'Menú', som: 'Sonido', idioma: 'Idioma', privacidade: 'Privacidad',
  meuBarbeiro: 'Mi barbero', novoNome: 'Nuevo nombre', chapeu: 'Sombrero', sairCadeira: 'Dejar la silla', fechar: 'Cerrar', pausa: 'Pausado',
  temas: { lenhador: 'Barba de leñador', executivo: 'Corte ejecutivo', festa: 'Look de fiesta', militar: 'Militar' },
  ferramentas: { tesoura: 'Tijeras', maquina: 'Máquina', navalha: 'Navaja', pente: 'Peine', pomada: 'Pomada' },
  reacoes: ['👏', '😂', '😮', '🔥', '💈', '❤️', '¡Bien!', 'Uy'],
  balao: { comeco: '¡Hazlo bien!', meio: 'Va quedando bien', fim: '¡Rápido!', oops: '¡Oye!', pronto: '¡Me encanta!', dormindo: 'zzz', mosca: '¡Una mosca!', espirro: '¡Achís!' },
  chapeus: ['Ninguno', 'Gorra', 'Bombín', 'Bandana', 'Boina', 'Corona'], vitoriasPara: (n) => `${n} victorias`,
};

export const TEXTOS = Object.freeze({ en, pt, es });
export const LINGUAS = Object.freeze(['en', 'pt', 'es']);

/**
 * Lingua: parametro de teste > escolha do perfil > Poki > navegador.
 * @param {{ lang?: string }} dep @param {string} [perfil] @param {string} [poki] @param {readonly string[]} [navegador]
 */
export function escolherIdioma(dep, perfil, poki, navegador = []) {
  const candidatos = [dep && dep.lang, perfil, poki, ...navegador].filter(Boolean).map((l) => String(l).slice(0, 2).toLowerCase());
  for (const c of candidatos) if (LINGUAS.includes(c)) return c;
  return 'en';
}

export { ADJETIVOS, SUBSTANTIVOS, textoNome };
