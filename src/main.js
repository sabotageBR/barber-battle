// Liga tudo: sessao (local com bots; online entra pela rede), layout, entrada
// por toque e teclado, cena no canvas, HUD em DOM, som e Poki. Unico modulo que
// importa core/poki.js e core/rede.js.
import { poki } from './core/poki.js';
import { criarAudio } from './core/audio.js';
import { criarArmazem } from './core/armazenamento.js';
import { lerDepuracao } from './core/depuracao.js';
import { criarSessaoLocal, criarSessaoRemota } from './core/sessao.js';
import { criarRede } from './core/rede.js';
import { criarTransporteWs } from './core/transporte.js';
import { POLITICA_URL, urlServidor } from './core/config.js';
import { vibrar } from './core/haptico.js';
import { criarRng, hashTexto } from './core/rng.js';
import { calcularLayout, zonaEm, zonaCanonica, centroZona } from './render/layout.js';
import { criarCena } from './render/cena.js';
import { criarHud } from './ui/hud.js';
import { TEXTOS, LINGUAS, escolherIdioma, textoNome } from './i18n/textos.js';
import { temaPorId } from './jogo/temas.js';
import { sortearNome, sortearAvatar, avatarPermitido, nomeValido } from './jogo/nomes.js';
import { IDS_FERRAMENTAS } from './jogo/ferramentas.js';
import { CHAPEUS, CAOS } from './jogo/constantes.js';

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
// Qualquer excecao vira o titulo da pagina (as ferramentas headless leem o titulo).
addEventListener('error', (e) => { document.title = `ERRO ${e.message}`; });
addEventListener('unhandledrejection', (e) => { document.title = `ERRO ${e.reason && e.reason.message ? e.reason.message : e.reason}`; });
const dep = lerDepuracao();
const armazem = criarArmazem();
// o token de sessao e por aba: sobrevive a recarregar, nao a fechar a aba, e nunca vaza para outra aba
const armazemAba = criarArmazem({ obterLs: () => globalThis.sessionStorage });
const audio = criarAudio();
const relogio = { agora: () => performance.now(), agendar: (fn, ms) => setTimeout(fn, ms), cancelar: (id) => clearTimeout(id) };

// ---------------------------------------------------------------- perfil
function carregarPerfil() {
  let p = null;
  try {
    const bruto = armazem.ler('perfil');
    p = typeof bruto === 'string' ? JSON.parse(bruto) : bruto;
  } catch {
    p = null;
  }
  const r = criarRng(hashTexto(String(Date.now())));
  if (!p || typeof p !== 'object' || !nomeValido(p.nome)) {
    p = { v: 1, nome: sortearNome(r), avatar: sortearAvatar(r), mudo: false, lang: '', rodadas: 0, vitorias: 0, pontos: 0, primeiraVisita: Date.now() };
  }
  p.avatar = avatarPermitido(p.avatar, p.vitorias || 0);
  return p;
}
const perfil = carregarPerfil();
function salvarPerfil() {
  try { armazem.gravar('perfil', JSON.stringify(perfil)); } catch { /* ignora */ }
}
salvarPerfil();
let idioma = escolherIdioma(dep, perfil.lang, '', navigator.languages || []);
let T = TEXTOS[idioma];

// ---------------------------------------------------------------- sessao, cena, HUD
function novaSessaoLocal() {
  return criarSessaoLocal({
    relogio, perfil: { nome: perfil.nome, avatar: perfil.avatar, vitorias: perfil.vitorias },
    opcoes: { rapido: dep.rapido, bots: dep.bots, papel: dep.papel, tema: dep.tema, estado: dep.estado },
  });
}
/** @type {any} */
let sessao;
let voce = '';
/** Sem servidor (bloqueado, caiu, lotado, versao velha) o jogo segue em memoria com bots, sem aviso tecnico. */
function cairParaLocal() {
  if (sessao && sessao.tipo === 'local') return;
  try { if (sessao) sessao.parar(); } catch { /* ignora */ }
  sessao = novaSessaoLocal();
  voce = sessao.voce;
  sessao.iniciar();
  poki.measure('rede', 'local', 'start');
  refrescar();
}
const temSocket = typeof WebSocket === 'function';
if (dep.modoLocal || !temSocket) {
  sessao = novaSessaoLocal();
  voce = sessao.voce;
} else {
  const rede = criarRede({
    url: urlServidor(dep, location), criarTransporte: (u) => criarTransporteWs(u), relogio, armazem: armazemAba,
    perfil: () => ({ nome: perfil.nome, avatar: perfil.avatar, idioma, sala: dep.sala || undefined, bots: dep.bots }),
    aoMensagem: (m) => sessao.receber(m),
    aoEstado: (e) => { if (e === 'local') cairParaLocal(); else if (e === 'online') poki.measure('rede', 'online', 'start'); },
  });
  sessao = criarSessaoRemota({ rede, aoIdentidade: (id) => { voce = id; refrescar(); } });
  // sem resposta em 6 s o jogo nao espera: vai de bots
  setTimeout(() => { if (sessao.tipo === 'remota' && !sessao.online) cairParaLocal(); }, 6000);
}
const canvas = /** @type {HTMLCanvasElement} */ ($('cena'));
const cena = criarCena(canvas);
const hud = criarHud({ T, $, textoNome, idioma });

const J = {
  ferramenta: 'tesoura', L: null, snap: null, snapEm: -1e9, tema: null, papel: '', tocou: false, tocouNaRodada: false,
  novato: perfil.rodadas < 2 || dep.novato, menuAberto: false, ultimoTique: 0, rodadaVista: -1, estadoVisto: '', anuncio: false,
  rodadasCompletas: 0, intervalosPedidos: 0, ultimoIntervaloRodada: -9, viuRewarded: false, inicioSessao: performance.now(),
};
const ponteiro = { x: 0, y: 0, ativo: false, toque: false, zona: null, px: 0, t0: 0, ux: 0, uy: 0, ang: 0, jitter: 0, amostras: 0, dy: 0, enviou: false, seq: 0 };

function layout() {
  const W = innerWidth;
  const H = innerHeight;
  const dpr = Math.min(2, devicePixelRatio || 1);
  J.L = calcularLayout({ W, H, papel: J.papel === 'barbeiro' ? 'barbeiro' : 'espectador' });
  cena.redimensionar(W, H, dpr);
  hud.posicionar(J.L);
}
addEventListener('resize', layout);
layout();
if (dep.semHud) document.body.classList.add('semhud');

const souBarbeiro = () => !!J.snap && J.snap.cadeiras.includes(voce);
const emRodada = () => !!J.snap && J.snap.estado === 'rodada';

function comecouAJogar() {
  if (J.anuncio || J.menuAberto) return;
  if (!J.tocou) { J.tocou = true; poki.measure('game', 'toque', 'first'); }
  poki.gameplayStart();
}

function definirFerramenta(id) {
  if (!IDS_FERRAMENTAS.includes(id)) return;
  J.ferramenta = id;
  if (souBarbeiro() && emRodada()) sessao.agir({ tipo: 'ferramenta', ferramenta: id });
  if (ponteiro.ativo && ponteiro.zona) { if (id === 'maquina') audio.maquinaLigar(); else audio.maquinaDesligar(); }
  hud.atualizar(J.snap, sessao.clientes, info());
}

function info() {
  return { agora: performance.now(), voce, ferramenta: J.ferramenta, novato: J.novato };
}

// ---------------------------------------------------------------- entrada: tracos
function zonaNoPonto(x, y) {
  if (!J.L) return null;
  return zonaCanonica(zonaEm(x, y, J.L.podios[0].cabeca));
}

function enviarTraco(tap = false) {
  if (!ponteiro.zona) return;
  const D = J.L.podios[0].cabeca.w;
  const intensidade = tap ? 0.15 : Math.max(0.15, Math.min(1, ponteiro.px / (0.6 * D)));
  const precisao = ponteiro.amostras > 2 ? Math.max(0, Math.min(1, 1 - ponteiro.jitter / ponteiro.amostras / 1.1)) : 0.8;
  const direcao = J.ferramenta === 'pomada' ? (ponteiro.dy < -8 ? 'cima' : Math.abs(ponteiro.dy) < 6 && ponteiro.px > 10 ? 'lado' : '') : '';
  sessao.agir({ tipo: 'traco', zona: ponteiro.zona, ferramenta: J.ferramenta, intensidade, precisao, direcao, seq: ponteiro.seq++ });
  ponteiro.px = 0;
  ponteiro.jitter = 0;
  ponteiro.amostras = 0;
  ponteiro.dy = 0;
  ponteiro.t0 = performance.now();
  ponteiro.enviou = true;
  J.tocouNaRodada = true;
  if (!tap && J.ferramenta === 'maquina') vibrar(12);
}

function comecarTraco(x, y) {
  const z = zonaNoPonto(x, y);
  ponteiro.zona = z;
  ponteiro.px = 0;
  ponteiro.jitter = 0;
  ponteiro.amostras = 0;
  ponteiro.dy = 0;
  ponteiro.ux = x;
  ponteiro.uy = y;
  ponteiro.ang = 0;
  ponteiro.t0 = performance.now();
  ponteiro.enviou = false;
  if (z && J.ferramenta === 'maquina') audio.maquinaLigar();
}

canvas.addEventListener('pointerdown', (e) => {
  audio.iniciar();
  comecouAJogar();
  ponteiro.x = e.clientX;
  ponteiro.y = e.clientY;
  ponteiro.ativo = true;
  ponteiro.toque = e.pointerType === 'touch';
  try { canvas.setPointerCapture(e.pointerId); } catch { /* ignora */ }
  if (souBarbeiro() && emRodada()) comecarTraco(e.clientX, e.clientY);
  else ponteiro.zona = null;
  // mosca: toque na cabeca espanta
  if (souBarbeiro() && emRodada() && J.snap.caos && J.snap.caos.some((c) => c.tipo === 'mosca')) sessao.agir({ tipo: 'caos', acao: 'mosca' });
});
canvas.addEventListener('pointermove', (e) => {
  if (!ponteiro.ativo) { ponteiro.x = e.clientX; ponteiro.y = e.clientY; return; }
  const dx = e.clientX - ponteiro.ux;
  const dy = e.clientY - ponteiro.uy;
  const d = Math.hypot(dx, dy);
  ponteiro.x = e.clientX;
  ponteiro.y = e.clientY;
  if (!ponteiro.zona || !souBarbeiro() || !emRodada()) { ponteiro.zona = null; return; }
  if (d < 1.5) return;
  const z = zonaNoPonto(e.clientX, e.clientY);
  const ang = Math.atan2(dy, dx);
  if (ponteiro.amostras > 0) {
    let da = Math.abs(ang - ponteiro.ang);
    if (da > Math.PI) da = 2 * Math.PI - da;
    ponteiro.jitter += da;
  }
  ponteiro.ang = ang;
  ponteiro.amostras += 1;
  ponteiro.dy += dy;
  ponteiro.ux = e.clientX;
  ponteiro.uy = e.clientY;
  audio.maquinaVelocidade(Math.min(1, d / 14));
  if (z !== ponteiro.zona) {
    if (ponteiro.px > 4) enviarTraco();
    ponteiro.zona = z;
    ponteiro.px = 0;
    ponteiro.t0 = performance.now();
    return;
  }
  ponteiro.px += d;
  if (performance.now() - ponteiro.t0 > 120 && ponteiro.px > 4) enviarTraco();
});
function soltar() {
  if (ponteiro.zona && souBarbeiro() && emRodada()) {
    if (ponteiro.px > 4) enviarTraco();
    else if (!ponteiro.enviou) enviarTraco(true);
  }
  ponteiro.ativo = false;
  ponteiro.zona = null;
  audio.maquinaDesligar();
}
canvas.addEventListener('pointerup', soltar);
canvas.addEventListener('pointercancel', soltar);
canvas.addEventListener('lostpointercapture', soltar);
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', ' '].includes(e.key)) e.preventDefault();
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { alternarMenu(); return; }
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 5) { comecouAJogar(); definirFerramenta(IDS_FERRAMENTAS[n - 1]); }
});

// ---------------------------------------------------------------- botoes do HUD
const botao = (id, fn) => $(id).addEventListener('click', (e) => { audio.iniciar(); fn(e); });
botao('bJogar', () => { comecouAJogar(); sessao.agir({ tipo: 'escolher', opcao: 'jogar' }); poki.measure('lobby', 'jogar', 'interact'); refrescar(); });
botao('bAssistir', () => { comecouAJogar(); sessao.agir({ tipo: 'escolher', opcao: 'assistir' }); poki.measure('lobby', 'assistir', 'interact'); refrescar(); });
$('ferramentas').addEventListener('click', (e) => {
  const b = /** @type {HTMLElement} */ (e.target).closest('button');
  if (!b || !b.dataset.id) return;
  audio.iniciar();
  comecouAJogar();
  definirFerramenta(b.dataset.id);
});
for (const id of ['vaiA', 'vaiB']) botao(id, (e) => {
  const alvo = /** @type {HTMLElement} */ (e.currentTarget).dataset.alvo;
  if (!alvo) return;
  comecouAJogar();
  sessao.agir({ tipo: 'torcer', alvo });
  audio.torcida();
  vibrar(8);
});
$('reacoes').addEventListener('click', (e) => {
  const b = /** @type {HTMLElement} */ (e.target).closest('button');
  if (!b) return;
  audio.iniciar();
  comecouAJogar();
  sessao.agir({ tipo: 'reagir', reacao: Number(b.dataset.reacao) });
});
for (const id of ['votarA', 'votarB']) botao(id, (e) => {
  const alvo = /** @type {HTMLElement} */ (e.currentTarget).dataset.alvo;
  if (!alvo) return;
  comecouAJogar();
  sessao.agir({ tipo: 'votar', alvo });
  audio.voto();
  poki.measure('voto', J.snap && J.snap.tema ? J.snap.tema : 'x', 'interact');
  refrescar();
});
botao('bContinuar', () => { $('resultado').hidden = true; });
botao('bDobrar', async () => {
  const r = J.snap && J.snap.resultado;
  if (!r) return;
  poki.measure('rewarded', 'dobrar', 'interact');
  let premiado = false;
  if (poki.sdkPronto) premiado = await poki.rewardedBreak();
  else if (dep.local) premiado = await anuncioLocal();
  J.viuRewarded = true;
  if (premiado) {
    sessao.agir({ tipo: 'recompensa', rodada: r.rodada });
    poki.measure('rewarded', 'dobrar', 'complete');
  } else poki.measure('rewarded', 'dobrar', 'fail');
  sessao.agir({ tipo: 'pronto' });
  $('resultado').hidden = true;
});

// menu
function alternarMenu(abrir = !J.menuAberto) {
  J.menuAberto = abrir;
  $('menu').hidden = !abrir;
  if (abrir) { poki.gameplayStop(); soltar(); atualizarMenu(); }
}
function atualizarMenu() {
  $('bSom').textContent = `${T.som}: ${perfil.mudo ? '✕' : '♪'}`;
  $('bIdioma').textContent = `${T.idioma}: ${idioma.toUpperCase()}`;
  $('apelido').textContent = textoNome(perfil.nome, idioma);
  $('chapeus').querySelectorAll('button').forEach((b) => {
    const i = Number(b.dataset.chapeu);
    b.disabled = CHAPEUS[i].vitorias > (perfil.vitorias || 0);
    b.setAttribute('aria-pressed', String(perfil.avatar.chapeu === i));
  });
  $('bSairCadeira').hidden = !(souBarbeiro() && emRodada());
}
botao('bMenu', () => alternarMenu(true));
botao('bFechar', () => alternarMenu(false));
botao('bVoltar', () => alternarMenu(false));
botao('bSom', () => { perfil.mudo = !perfil.mudo; audio.definirMudo(perfil.mudo); salvarPerfil(); atualizarMenu(); });
botao('bIdioma', () => { idioma = LINGUAS[(LINGUAS.indexOf(idioma) + 1) % LINGUAS.length]; perfil.lang = idioma; salvarPerfil(); aplicarIdioma(); atualizarMenu(); });
botao('bNovoNome', () => { perfil.nome = sortearNome(criarRng(hashTexto(String(Date.now())))); salvarPerfil(); atualizarMenu(); });
$('chapeus').addEventListener('click', (e) => {
  const b = /** @type {HTMLElement} */ (e.target).closest('button');
  if (!b || b.disabled) return;
  perfil.avatar = avatarPermitido({ cor: perfil.avatar.cor, chapeu: Number(b.dataset.chapeu) }, perfil.vitorias || 0);
  salvarPerfil();
  atualizarMenu();
});
botao('bPrivacidade', () => poki.openExternalLink(POLITICA_URL));
botao('bSairCadeira', () => { sessao.agir({ tipo: 'abandonarCadeira', motivo: 'saiu' }); alternarMenu(false); });

function aplicarIdioma() {
  T = TEXTOS[idioma];
  hud.definirTextos(T, idioma);
  document.documentElement.lang = idioma;
  refrescar();
}
audio.definirMudo(!!perfil.mudo);

/**
 * Intervalo comercial: so depois da 1a rodada completa do jogador e de 180 s de sessao, no maximo
 * 1 a cada 2 rodadas; a Poki decide a frequencia real. A sala nao espera: ao voltar, `pronto`.
 */
function podeIntervalo() {
  if (dep.semAnuncio || J.anuncio) return false;
  if (!(poki.sdkPronto || dep.local)) return false;
  // 180 s de sessao (nos tempos rapidos, uma rodada) e pelo menos uma rodada vista ate o fim
  const carencia = J.snap && J.snap.tempos ? J.snap.tempos.rodada : 180000;
  if (J.rodadasCompletas < 1 || performance.now() - J.inicioSessao < carencia) return false;
  const rodada = J.snap ? J.snap.rodada : 0;
  return rodada - J.ultimoIntervaloRodada >= 2;
}
function pedirIntervalo() {
  if (!podeIntervalo()) return;
  J.ultimoIntervaloRodada = J.snap ? J.snap.rodada : 0;
  J.intervalosPedidos += 1;
  sessao.agir({ tipo: 'anuncio' });
  const voltar = () => { sessao.agir({ tipo: 'pronto' }); refrescar(); };
  if (poki.sdkPronto) poki.commercialBreak().then(voltar, voltar);
  else anuncioLocal().then(voltar, voltar);
}

/** Anuncio simulado (so localhost, sem SDK): 3 s de tela escura. */
function anuncioLocal() {
  return new Promise((resolve) => {
    const el = $('anuncio');
    el.hidden = false;
    let n = 3;
    $('anuncioTempo').textContent = String(n);
    J.anuncio = true;
    soltar();
    poki.gameplayStop();
    audio.mudoParaAnuncio();
    const id = setInterval(() => {
      n -= 1;
      $('anuncioTempo').textContent = String(n);
      if (n <= 0) { clearInterval(id); el.hidden = true; J.anuncio = false; audio.voltarDoAnuncio(); resolve(true); }
    }, 1000);
  });
}

// ---------------------------------------------------------------- eventos da sala
function cabecaDe(id) {
  if (!J.L || !J.snap) return J.L ? J.L.podios[0].cabeca : { x: 0, y: 0, w: 100, h: 100 };
  const ids = J.snap.cadeiras;
  const ordem = souBarbeiro() ? [voce, ids.find((x) => x !== voce)] : ids;
  const i = ordem.indexOf(id);
  return J.L.podios[i >= 0 ? i : 0].cabeca;
}

function tratarEvento(ev, agora) {
  if (ev.tipo === 'estadoMudou' || ev.tipo === 'rodadaComecou' || ev.tipo === 'cadeiraTrocou' || ev.tipo === 'resultado') refrescar();
  cena.reagir(ev, J.L, voce, J.snap, agora);
  const meu = ev.id === voce;
  switch (ev.tipo) {
    case 'traco':
      if (!meu) return;
      if (ev.ferramenta === 'tesoura') audio.tesoura();
      else if (ev.ferramenta === 'navalha') audio.navalha();
      else if (ev.ferramenta === 'pente') audio.pente();
      return;
    case 'pomada': if (meu) audio.pomada(); return;
    case 'pomadaCedo': if (meu) { audio.oops(); hud.balao(T.balao.oops, cabecaDe(voce), 1200); } return;
    case 'oops': case 'excesso': case 'tracoErrou': if (meu) { audio.oops(); hud.balao(T.balao.oops, cabecaDe(voce), 1200); vibrar(30); } return;
    case 'zonaPronta': if (meu) { audio.zonaPronta(); vibrar([10, 30, 10]); } return;
    case 'combo': if (meu) { audio.combo(ev.n); hud.aviso('×' + ev.n); } return;
    case 'perfeito': if (meu) audio.zonaPronta(); return;
    case 'curativo': if (meu) { audio.oops(); hud.balao(T.balao.oops, cabecaDe(voce), 1500); } return;
    case 'turbo': audio.turbo(); if (meu) hud.aviso('TURBO'); return;
    case 'torcida': if (ev.de === voce) audio.torcida(); return;
    case 'voto': audio.voto(); return;
    case 'reacao': {
      // as reacoes sobem da plateia (barra de baixo), nao de cima do cliente
      if (J.L) hud.flutuar(T.reacoes[ev.reacao] || '👏', { x: J.L.plateia.x, y: J.L.plateia.y - 30, w: J.L.plateia.w, h: 0 });
      if (!meu) audio.reacao();
      return;
    }
    case 'cochilo': if (meu || !souBarbeiro()) hud.balao(T.balao.dormindo, cabecaDe(ev.id), 3000); return;
    case 'acordou': if (meu) audio.acordou(); return;
    case 'caos': {
      if (!souBarbeiro()) return;
      hud.balao(ev.acao === 'mosca' ? T.balao.mosca : T.balao.espirro, cabecaDe(voce), 2000);
      if (ev.acao === 'mosca') audio.mosca(); else audio.espirro();
      return;
    }
    case 'estadoMudou': {
      if (ev.para === 'saguao') { audio.sino(); J.tocouNaRodada = false; }
      // intervalo comercial: espectadores no inicio do resultado, barbeiros sem rewarded no inicio da transicao
      if (ev.para === 'resultado' && !souBarbeiro()) pedirIntervalo();
      if (ev.para === 'transicao' && souBarbeiro() && !J.viuRewarded) pedirIntervalo();
      if (ev.para === 'resultado') { J.rodadasCompletas += 1; J.viuRewarded = false; }
      if (ev.para === 'rodada' && souBarbeiro()) poki.measure('rodada', J.snap && J.snap.tema ? J.snap.tema : 'x', 'start');
      if (ev.para === 'votacao') { hud.balao(T.balao.pronto, cabecaDe(J.snap.cadeiras[0] || voce), 2500); if (!souBarbeiro()) hud.aviso(T.votacao); }
      if (ev.para === 'resultado' && souBarbeiro()) poki.gameplayStop();
      return;
    }
    case 'rodadaComecou': {
      if (souBarbeiro()) {
        perfil.rodadas = (perfil.rodadas || 0) + 1;
        salvarPerfil();
        hud.aviso(T.suaVez);
        hud.balao(T.balao.comeco, cabecaDe(voce), 2500);
      }
      return;
    }
    case 'cadeiraTrocou': if (ev.para === voce) { hud.aviso(T.voceEntrou); audio.sino(); } return;
    case 'resultado': {
      if (ev.vencedor === voce) { audio.vitoria(); perfil.vitorias = (perfil.vitorias || 0) + 1; perfil.pontos = (perfil.pontos || 0) + (ev.pontos[voce] || 0); salvarPerfil(); poki.measure('rodada', J.snap && J.snap.tema ? J.snap.tema : 'x', 'complete'); }
      else if (souBarbeiro()) { audio.derrota(); perfil.pontos = (perfil.pontos || 0) + (ev.pontos[voce] || 0); salvarPerfil(); }
      else audio.voto();
      if (J.snap && J.snap.cadeiras.includes(voce)) poki.measure('rewarded', 'dobrar', 'visible');
      return;
    }
    default: return;
  }
}

function refrescar() {
  J.snap = sessao.snapshot();
  J.snapEm = performance.now();
  if (!J.snap) { if (J.L) { hud.posicionar(J.L); hud.atualizar(null, {}, info()); } return; }
  J.tema = J.snap.tema ? temaPorId(J.snap.tema) : J.snap.temaProx ? temaPorId(J.snap.temaProx) : null;
  const papel = souBarbeiro() ? 'barbeiro' : 'espectador';
  if (papel !== J.papel) { J.papel = papel; layout(); }
  hud.atualizar(J.snap, sessao.clientes, info());
  const r = resumo();
  document.body.dataset.estado = JSON.stringify(r);
}

function resumo() {
  const s = J.snap;
  const c = s && s.cliente && s.cliente[voce] ? sessao.clientes[voce] || s.cliente[voce] : null;
  return {
    estado: s ? s.estado : '', papel: J.papel, ferramenta: J.ferramenta, rodada: s ? s.rodada : 0,
    cabelo: c ? Math.round(c.cabelo || 0) : 0, barba: c ? Math.round(c.barba || 0) : 0,
    pontos: s && s.jogadores[voce] ? s.jogadores[voce].pontos : 0, jogadores: s ? Object.keys(s.jogadores).length : 0,
    poki: { jogando: poki.jogando, jaJogou: poki.jaJogou, sdk: poki.sdkPronto }, rede: sessao.tipo, gesto: dep.gesto, tocou: J.tocouNaRodada, tracos: ponteiro.seq, rafAtivo: performance.now() - ultimoQuadro < 250, online: !!sessao.online, conexao: sessao.rede ? sessao.rede.estado : 'local', escolha: s && s.jogadores[voce] ? s.jogadores[voce].escolha : null, fimEm: s ? Math.round(s.fimEm) : 0, agora: Math.round(performance.now()), cadeiras: J.snap ? J.snap.cadeiras : null,
  };
}

// ---------------------------------------------------------------- laco
let ultimoT = performance.now();
let ultimoQuadro = 0;
let carregou = false; // gameLoadingFinished uma vez, no primeiro passo com a sala montada
/** Parte logica do quadro (eventos, snapshot, tique): roda no rAF e, se o rAF parar, por timer. */
function passoLogico(agora) {
  if (!J.L || J.L.W !== innerWidth || J.L.H !== innerHeight) layout();
  for (const ev of sessao.drenarEventos()) tratarEvento(ev, agora);
  if (!J.snap || agora - J.snapEm > 100) refrescar();
  if (!carregou && J.snap) { carregou = true; poki.gameLoadingFinished(); }
  if (J.snap && J.snap.estado === 'rodada') {
    const restante = J.snap.fimEm - agora;
    if (restante <= 10000 && restante > 0 && Math.floor(restante / 1000) !== J.ultimoTique) { J.ultimoTique = Math.floor(restante / 1000); if (souBarbeiro()) audio.tique(); }
  }
}
// Reserva: com a pagina visivel mas sem quadros (headless, aba congelada), a logica anda por timer.
setInterval(() => { const agora = performance.now(); if (agora - ultimoQuadro > 250) passoLogico(agora); }, 100);
function quadro(agora) {
  const dt = Math.min(0.05, Math.max(0.001, (agora - ultimoT) / 1000));
  ultimoT = agora;
  ultimoQuadro = agora;
  passoLogico(agora);
  const glow = souBarbeiro() && emRodada() ? (ponteiro.zona || (J.tema && !J.tocouNaRodada ? J.tema.fantasma.zona : null)) : null;
  cena.desenhar({
    dt, t: agora, L: J.L, snap: J.snap, clientes: sessao.clientes, voce, ferramenta: J.ferramenta, ponteiro, tema: J.tema, glowZona: glow,
    fantasma: J.novato && souBarbeiro() && emRodada() && !J.tocouNaRodada && J.tema ? J.tema.fantasma : null,
  });
  requestAnimationFrame(quadro);
}

// ---------------------------------------------------------------- Poki e vida da aba
document.addEventListener('visibilitychange', () => {
  audio.pausarAba(document.hidden);
  if (document.hidden) { poki.gameplayStop(); soltar(); }
  else if (sessao.tipo === 'remota' && sessao.rede) sessao.rede.acordar();
});
poki.onAdStart = () => { J.anuncio = true; audio.mudoParaAnuncio(); soltar(); };
poki.onAdEnd = () => { J.anuncio = false; audio.voltarDoAnuncio(); sessao.agir({ tipo: 'pronto' }); refrescar(); };
poki.init().then(() => {
  if (!poki.sdkPronto && !dep.local) document.body.classList.add('sem-anuncio');
  const l = poki.idioma();
  if (l && !dep.lang && !perfil.lang && LINGUAS.includes(l) && l !== idioma) { idioma = l; aplicarIdioma(); }
  poki.movePill(0, 64);
});

// ---------------------------------------------------------------- ganchos de teste
if (dep.ganchos) {
  /** @type {any} */ (window).__bb = {
    J, poki, audio, sessao, resumo, hud, cena,
    traco(zona, ferramenta = J.ferramenta, intensidade = 0.6) { J.ferramenta = ferramenta; sessao.agir({ tipo: 'traco', zona, ferramenta, intensidade, precisao: 1, direcao: '', seq: ponteiro.seq++ }); J.tocouNaRodada = true; },
    avancar() { const m = sessao.motor; if (m) m.aplicar({ tipo: 'tique', t: m.estado.fimEm }); refrescar(); },
    escolher(opcao) { sessao.agir({ tipo: 'escolher', opcao }); refrescar(); },
  };
  if (dep.gesto) {
    const fim = Math.max(...dep.gesto.split(';').map((g) => Number((g.split('@')[1] || '0').trim()) || 0)) + 600;
    setTimeout(() => { refrescar(); if (!document.title.startsWith('ERRO')) document.title = 'PRONTO'; }, fim);
    for (const g of dep.gesto.split(';')) {
      const m = /^(\w+):([\w-]+)@(\d+)$/.exec(g.trim());
      if (!m) continue;
      const [, tipo, alvo, ms] = m;
      setTimeout(() => {
        if (tipo === 'tool') definirFerramenta(alvo);
        else if (tipo === 'traco') {
          const cab = J.L.podios[0].cabeca;
          const c = centroZona(alvo, cab);
          const passo = Math.max(2, cab.w * 0.035);
          const ev = (t, x, y) => canvas.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', bubbles: true }));
          // comeca no centro da zona (vale ate em cabecas pequenas) e arrasta um pouco para a direita
          ev('pointerdown', c.x - passo, c.y);
          for (let i = 1; i <= 6; i++) ev('pointermove', c.x - passo + i * passo, c.y + (i % 2 ? 1 : -1));
          ev('pointerup', c.x + passo * 5, c.y);
        } else if (tipo === 'tap' || tipo === 'click') $(alvo).click();
        else if (tipo === 'key') dispatchEvent(new KeyboardEvent('keydown', { key: alvo }));
      }, Number(ms));
    }
  }
}

// ---------------------------------------------------------------- partida
sessao.iniciar();
refrescar();
if (dep.menu) alternarMenu(true);
document.fonts && document.fonts.ready ? document.fonts.ready.then(() => requestAnimationFrame(quadro)) : requestAnimationFrame(quadro);
