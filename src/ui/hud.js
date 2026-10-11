// HUD em DOM: posiciona os elementos pela geometria de layout.js e os atualiza
// com o snapshot da sala. Nenhuma regra de jogo aqui.
import { ICONES } from '../render/ferramentas.js';
import { IDS_FERRAMENTAS } from '../jogo/ferramentas.js';
import { REACOES, TORCIDA, CHAPEUS } from '../jogo/constantes.js';

/**
 * @param {{ T: any, $: (id: string) => HTMLElement, textoNome: Function, idioma: string }} p
 */
export function criarHud({ T, $, textoNome, idioma }) {
  let L = null;
  let lingua = idioma;
  const px = (el, c) => { el.style.left = `${c.x}px`; el.style.top = `${c.y}px`; el.style.width = `${c.w}px`; el.style.height = `${c.h}px`; };
  const caixaLocal = (c, podio) => ({ x: c.x - podio.x, y: c.y - podio.y, w: c.w, h: c.h });

  // ferramentas e reacoes sao montadas uma vez
  const ferramentas = $('ferramentas');
  ferramentas.innerHTML = IDS_FERRAMENTAS.map((id, i) => `<button class="ferramenta" type="button" data-id="${id}" aria-pressed="${i === 0}" aria-label="${id}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[id]}</svg><span></span></button>`).join('');
  const reacoes = $('reacoes');
  reacoes.innerHTML = REACOES.map((id, i) => `<button type="button" data-reacao="${i}" aria-label="${id}"></button>`).join('');

  function definirTextos(novo, novaLingua) {
    T = novo;
    lingua = novaLingua;
    ferramentas.querySelectorAll('button').forEach((b) => { b.querySelector('span').textContent = T.ferramentas[b.dataset.id]; });
    reacoes.querySelectorAll('button').forEach((b) => { b.textContent = T.reacoes[Number(b.dataset.reacao)]; });
    $('vaiA').textContent = T.vai;
    $('vaiB').textContent = T.vai;
    $('cabeloTxtA').textContent = T.cabelo; $('barbaTxtA').textContent = T.barba;
    $('cabeloTxtB').textContent = T.cabelo; $('barbaTxtB').textContent = T.barba;
    $('bJogar').textContent = T.jogar; $('bAssistir').textContent = T.assistir;
    $('votarA').textContent = T.votar; $('votarB').textContent = T.votar;
    $('bContinuar').textContent = T.continuar; $('bDobrar').textContent = `${T.dobrarPontos} 🎬`;
    $('menuTitulo').textContent = T.pausa; $('bVoltar').textContent = T.continuar; $('bSom').textContent = T.som; $('bIdioma').textContent = `${T.idioma}: ${lingua.toUpperCase()}`;
    $('meuBarbeiroTitulo').textContent = T.meuBarbeiro; $('bNovoNome').textContent = T.novoNome; $('bPrivacidade').textContent = T.privacidade; $('bSairCadeira').textContent = T.sairCadeira;
    const ch = $('chapeus');
    ch.innerHTML = CHAPEUS.map((c, i) => `<button type="button" data-chapeu="${i}"><span>${T.chapeus[i]}</span><small>${c.vitorias ? T.vitoriasPara(c.vitorias) : ''}</small></button>`).join('');
  }
  definirTextos(T, idioma);

  /** @param {any} layout */
  function posicionar(layout) {
    L = layout;
    px($('topo'), L.topo);
    for (const [k, el] of [['podioA', $('podioA')], ['podioB', $('podioB')]]) {
      const p = L.podios[k === 'podioA' ? 0 : 1];
      px(el, p.caixa);
      px(el.querySelector('.nome'), caixaLocal(p.nome, p.caixa));
      px(el.querySelector('.barras'), caixaLocal(p.barras, p.caixa));
      if (p.proprio && p.ferramentas) {
        px(ferramentas, caixaLocal(p.ferramentas, p.caixa));
        ferramentas.querySelectorAll('button').forEach((b, i) => { const s = p.slots[i]; b.style.width = `${s.w}px`; b.style.height = `${s.h}px`; });
      }
      const status = el.querySelector('.status');
      if (status) px(status, caixaLocal({ x: p.caixa.x + L.m, y: p.caixa.y + p.caixa.h - L.m - 36, w: p.caixa.w - 2 * L.m, h: 32 }, p.caixa));
    }
    px($('plateia'), L.plateia);
    px($('vaiA'), caixaLocal(L.vai[0], L.plateia));
    px($('vaiB'), caixaLocal(L.vai[1], L.plateia));
    px($('medidor'), caixaLocal(L.medidor, L.plateia));
    if (L.contador) { px($('contador'), caixaLocal(L.contador, L.plateia)); $('contador').hidden = false; } else $('contador').hidden = true;
    if (L.reacoes) px(reacoes, L.reacoes);
    reacoes.querySelectorAll('button').forEach((b) => { const lado = L.reacoes ? Math.min(42, L.reacoes.h) : 38; b.style.width = `${lado}px`; b.style.height = `${lado}px`; });
    // votacao: botoes sobre as cabecas
    px($('votarA'), L.podios[0].cabeca);
    px($('votarB'), L.podios[1].cabeca);
  }

  const mm = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

  /**
   * @param {any} snap
   * @param {Record<string, any>} clientes
   * @param {{ agora: number, voce: string|null, ferramenta: string, torcidaAlvo?: string|null, votei?: string|null, novato?: boolean }} info
   */
  function atualizar(snap, clientes, info) {
    if (!L) return;
    if (!snap) {
      // conectando: nada de ferramentas, reacoes ou cartoes; so o palco vazio
      ferramentas.hidden = true;
      reacoes.hidden = true;
      $('saguao').hidden = true;
      $('votacao').hidden = true;
      $('resultado').hidden = true;
      $('statusB').hidden = true;
      $('vaiA').disabled = true;
      $('vaiB').disabled = true;
      $('tempo').textContent = '';
      $('relogio').style.visibility = 'hidden';
      $('rodadaTxt').textContent = '';
      $('temaTxt').textContent = '';
      for (const k of ['A', 'B']) { $(`nome${k}`).textContent = ''; $(`selo${k}`).textContent = ''; $(`cabelo${k}`).style.width = '0%'; $(`barba${k}`).style.width = '0%'; }
      return;
    }
    const ids = snap.cadeiras || [null, null];
    const voce = info.voce;
    const souBarbeiro = !!voce && ids.includes(voce);
    const ordem = souBarbeiro ? [voce, ids.find((x) => x !== voce) || null] : ids;
    const restante = snap.fimEm ? snap.fimEm - info.agora : 0;
    $('relogio').style.visibility = 'visible';
    $('tempo').textContent = mm(restante);
    $('relogio').classList.toggle('urgente', snap.estado === 'rodada' && restante > 0 && restante <= 10000);
    $('rodadaTxt').textContent = `${T.rodada} ${snap.estado === 'saguao' ? snap.rodada + 1 : Math.max(1, snap.rodada)}`;
    const temaId = snap.estado === 'saguao' ? snap.temaProx : snap.tema;
    $('temaTxt').textContent = temaId ? T.temas[temaId] : '';
    for (let i = 0; i < 2; i++) {
      const id = ordem[i];
      const j = id ? snap.jogadores[id] : null;
      const k = i === 0 ? 'A' : 'B';
      $(`nome${k}`).textContent = j ? (id === voce ? T.voce.toUpperCase() : textoNome(j.nome, lingua)) : '';
      $(`selo${k}`).textContent = j ? (i === 0 && souBarbeiro ? T.naCadeira : T.adversario) : '';
      const c = id ? (clientes[id] || snap.cliente[id]) : null;
      $(`cabelo${k}`).style.width = c ? `${Math.round(c.cabelo || 0)}%` : '0%';
      $(`barba${k}`).style.width = c ? `${Math.round(c.barba || 0)}%` : '0%';
      const combo = $(`combo${k}`);
      if (c && c.combo >= 2 && snap.estado === 'rodada') { combo.hidden = false; combo.textContent = `×${c.combo}`; } else combo.hidden = true;
    }
    ferramentas.hidden = !souBarbeiro;
    ferramentas.querySelectorAll('button').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.id === info.ferramenta)); b.disabled = snap.estado !== 'rodada'; });
    const statusB = $('statusB');
    const oponente = ordem[1];
    statusB.hidden = !(oponente && snap.estado === 'rodada');
    if (oponente && snap.ferramenta[oponente]) statusB.textContent = T.ferramentas[snap.ferramenta[oponente]];
    // plateia
    const espectador = !souBarbeiro;
    const podeTorcer = espectador && snap.estado === 'rodada' && ids[0] && ids[1];
    $('vaiA').disabled = !podeTorcer;
    $('vaiB').disabled = !podeTorcer;
    $('vaiA').dataset.alvo = ordem[0] || '';
    $('vaiB').dataset.alvo = ordem[1] || '';
    const tz = snap.torcida || {};
    $('medA').style.width = `${Math.min(50, (tz[ordem[0]] || 0) / TORCIDA.cheia * 50)}%`;
    $('medB').style.width = `${Math.min(50, (tz[ordem[1]] || 0) / TORCIDA.cheia * 50)}%`;
    const total = Object.keys(snap.jogadores).length;
    const pos = voce && snap.posicoes ? snap.posicoes[voce] : 0;
    $('contador').innerHTML = `${total - 2} ${T.assistindo}<br>${pos ? `#${pos} ${T.naFila}` : ''}`;
    reacoes.hidden = !espectador || !L.reacoes || (snap.estado !== 'rodada' && snap.estado !== 'votacao' && snap.estado !== 'resultado');
    // telas por estado
    const saguao = $('saguao');
    if (snap.estado === 'saguao' || snap.estado === 'espera') {
      saguao.hidden = false;
      $('saguaoRotulo').textContent = `${T.rodada} ${snap.rodada + 1} · ${T.tema}`;
      $('saguaoTema').textContent = temaId ? T.temas[temaId] : '…';
      const frac = snap.tempos && snap.fimEm ? Math.max(0, Math.min(1, restante / snap.tempos.saguao)) : 0;
      $('saguaoAnel').style.strokeDashoffset = String(264 * (1 - frac));
      $('saguaoTempo').textContent = String(Math.max(0, Math.ceil(restante / 1000)));
      const eu = voce ? snap.jogadores[voce] : null;
      const escolhido = eu ? eu.escolha : '';
      $('bJogar').disabled = escolhido !== '';
      $('bAssistir').disabled = escolhido !== '';
      $('bJogar').classList.toggle('pulsar', !escolhido && !!info.novato);
      $('saguaoFila').textContent = pos === 1 || pos === 2 ? T.proximoVoce : pos ? `#${pos} ${T.naFila}` : '';
    } else saguao.hidden = true;
    const votacao = $('votacao');
    if (snap.estado === 'votacao' && espectador) {
      votacao.hidden = false;
      $('votarA').dataset.alvo = ordem[0] || '';
      $('votarB').dataset.alvo = ordem[1] || '';
      $('votarA').disabled = !snap.apto;
      $('votarB').disabled = !snap.apto;
      $('votarA').setAttribute('aria-pressed', String(snap.votei === ordem[0]));
      $('votarB').setAttribute('aria-pressed', String(snap.votei === ordem[1]));
    } else votacao.hidden = true;
    const resultado = $('resultado');
    if (snap.estado === 'resultado' && snap.resultado) {
      const r = snap.resultado;
      resultado.hidden = false;
      const v = r.vencedor ? snap.jogadores[r.vencedor] : null;
      $('resultadoTitulo').textContent = r.cancelada ? T.semVencedor : r.vencedor === voce ? T.voceVenceu : souBarbeiro ? T.voceQuase : T.vencedor;
      $('resultadoNome').textContent = v ? (r.vencedor === voce ? T.voce : textoNome(v.nome, lingua)) : '';
      const meus = voce && r.pontos ? r.pontos[voce] : 0;
      $('resultadoPontos').textContent = souBarbeiro && meus ? `+${meus}${r.dobrou && r.dobrou[voce] ? ' ×2' : ''}` : (v ? `+${r.pontos[r.vencedor]}` : '');
      $('bDobrar').hidden = !(souBarbeiro && meus && !(r.dobrou && r.dobrou[voce]) && !r.cancelada);
      $('bContinuar').hidden = !souBarbeiro;
    } else resultado.hidden = true;
  }

  let avisoTimer = 0;
  /** @param {string} texto */
  function aviso(texto) {
    const el = $('aviso');
    $('avisoTxt').textContent = texto;
    el.hidden = false;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => { el.hidden = true; }, 2200);
  }

  let balaoTimer = 0;
  /** @param {string} texto @param {{ x: number, y: number, w: number, h: number }} cabeca */
  function balao(texto, cabeca, ms = 2500) {
    const el = $('balao');
    el.textContent = texto;
    el.hidden = false;
    el.style.left = `${cabeca.x + cabeca.w * 0.78}px`;
    el.style.top = `${cabeca.y + cabeca.h * 0.12}px`;
    clearTimeout(balaoTimer);
    balaoTimer = setTimeout(() => { el.hidden = true; }, ms);
  }

  /** Emoji que sobe do lado de uma cabeca. @param {string} texto @param {{ x: number, y: number, w: number, h: number }} cabeca */
  function flutuar(texto, cabeca) {
    const el = document.createElement('div');
    el.className = 'flutua';
    el.textContent = texto;
    el.style.left = `${cabeca.x + cabeca.w * (0.2 + Math.random() * 0.6)}px`;
    el.style.top = `${cabeca.y + cabeca.h * 0.5}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }

  return { posicionar, atualizar, definirTextos, aviso, balao, flutuar, get L() { return L; } };
}
