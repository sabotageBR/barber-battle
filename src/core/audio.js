// Sons sintetizados com WebAudio: nenhum arquivo, nenhuma requisicao.
// O contexto so nasce no primeiro toque (politica de autoplay). O mudo do
// anuncio zera o ganho mestre ANTES de pedir o anuncio e suspende o contexto
// 80 ms depois (padrao do hexadrop: o onStart do SDK pode nao chegar).
// Infra copiada do 2048_cards (que vem do stringcut); os sons sao os da barbearia.

export function criarAudio() {
  /** @type {AudioContext|null} */
  let ctx = null;
  /** @type {GainNode|null} */
  let mestre = null;
  /** @type {AudioBuffer|null} */
  let ruidoBuf = null;
  let mudo = false;
  let mudoAnuncio = false;
  let abaOculta = false;
  /** @type {{ o: OscillatorNode, g: GainNode }|null} */
  let maquina = null;
  const VOLUME = 0.6;

  function maquinaDesligar() {
    if (!maquina || !ctx) return;
    const { o, g } = maquina;
    maquina = null;
    try {
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04);
      o.stop(ctx.currentTime + 0.2);
    } catch { /* ignora */ }
  }

  const ganhoAlvo = () => (mudo || mudoAnuncio || abaOculta ? 0 : VOLUME);

  function iniciar() {
    if (ctx) {
      if (ctx.state === 'suspended' && !mudoAnuncio && !abaOculta) ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
      ctx = new AC();
      mestre = ctx.createGain();
      mestre.gain.value = ganhoAlvo();
      mestre.connect(ctx.destination);
    } catch {
      ctx = null;
    }
  }

  function aplicarGanho() {
    if (!ctx || !mestre) return;
    try {
      mestre.gain.setTargetAtTime(ganhoAlvo(), ctx.currentTime, 0.02);
    } catch { /* ignora */ }
  }

  function tom(f, dur, tipo = 'sine', vol = 0.2, f2 = 0, atraso = 0) {
    if (!ctx || !mestre || mudo || mudoAnuncio) return;
    const t = ctx.currentTime + atraso;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = /** @type {OscillatorType} */ (tipo);
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(mestre);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  function ruido(dur, freq, q, vol, atraso = 0, tipo = 'bandpass', f2 = 0) {
    if (!ctx || !mestre || mudo || mudoAnuncio) return;
    if (!ruidoBuf) {
      ruidoBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.8), ctx.sampleRate);
      const d = ruidoBuf.getChannelData(0);
      let s = 12345;
      for (let i = 0; i < d.length; i++) { s = (s * 1103515245 + 12345) >>> 0; d[i] = s / 2147483648 - 1; }
    }
    const t = ctx.currentTime + atraso;
    const s = ctx.createBufferSource();
    s.buffer = ruidoBuf;
    const f = ctx.createBiquadFilter();
    f.type = /** @type {BiquadFilterType} */ (tipo);
    f.frequency.setValueAtTime(freq, t);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f);
    f.connect(g);
    g.connect(mestre);
    s.start(t);
    s.stop(t + dur + 0.03);
  }

  return {
    iniciar,
    tom,
    ruido,
    get ctx() { return ctx; },
    get mudo() { return mudo; },
    /** true se o som esta zerado agora (mudo, anuncio ou aba oculta) */
    get calado() { return ganhoAlvo() === 0; },
    /** @param {boolean} v */
    definirMudo(v) { mudo = v; if (v) maquinaDesligar(); aplicarGanho(); },
    mudoParaAnuncio() {
      mudoAnuncio = true;
      maquinaDesligar();
      aplicarGanho();
      setTimeout(() => {
        if (mudoAnuncio && ctx && ctx.state === 'running') ctx.suspend().catch(() => {});
      }, 80);
    },
    /** @param {boolean} oculta */
    pausarAba(oculta) {
      abaOculta = oculta;
      if (oculta) maquinaDesligar();
      aplicarGanho();
      if (!ctx) return;
      if (oculta) ctx.suspend().catch(() => {});
      else if (!mudoAnuncio) ctx.resume().catch(() => {});
    },
    voltarDoAnuncio() {
      mudoAnuncio = false;
      if (ctx && ctx.state === 'suspended' && !abaOculta) ctx.resume().catch(() => {});
      aplicarGanho();
    },
    /** tesoura: dois estalos agudos */
    tesoura() { ruido(0.05, 2200, 2, 0.25); ruido(0.05, 2600, 2, 0.2, 0.07); },
    /** maquina: zumbido continuo enquanto arrasta (ligar/velocidade/desligar) */
    maquinaLigar() {
      if (!ctx || !mestre || maquina || mudo || mudoAnuncio) return;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = 110;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.05);
      o.connect(f);
      f.connect(g);
      g.connect(mestre);
      o.start();
      maquina = { o, g };
    },
    /** @param {number} v 0..1 */
    maquinaVelocidade(v) { if (maquina && ctx) maquina.o.frequency.setTargetAtTime(110 + 70 * Math.max(0, Math.min(1, v)), ctx.currentTime, 0.05); },
    maquinaDesligar,
    navalha() { ruido(0.12, 4000, 1, 0.22, 0, 'highpass', 1500); },
    pente() { tom(880, 0.04, 'triangle', 0.08); tom(990, 0.04, 'triangle', 0.06, 0, 0.05); },
    pomada() { ruido(0.2, 300, 0.7, 0.3, 0, 'lowpass', 150); },
    oops() { tom(140, 0.14, 'square', 0.05, 90); ruido(0.08, 300, 1, 0.2); },
    zonaPronta() { tom(1320, 0.18, 'sine', 0.12); tom(1760, 0.22, 'sine', 0.08, 0, 0.08); },
    /** @param {number} n */
    combo(n) { tom(523 * Math.pow(2, Math.min(n, 8) / 12), 0.15, 'triangle', 0.1); tom(1046 * Math.pow(2, Math.min(n, 8) / 12), 0.1, 'sine', 0.05, 0, 0.05); },
    tique() { tom(900, 0.05, 'triangle', 0.08, 1200); },
    voto() { tom(660, 0.08, 'sine', 0.1, 880); },
    reacao() { tom(1200, 0.05, 'triangle', 0.07, 1500); },
    torcida() { ruido(0.06, 1500, 1, 0.12); },
    turbo() { tom(300, 0.5, 'sawtooth', 0.05, 1200); ruido(0.5, 800, 0.5, 0.1, 0, 'bandpass', 4000); },
    vitoria() {
      [523, 659, 784, 1046].forEach((f, i) => { tom(f, 0.26, 'triangle', 0.13, 0, i * 0.075); tom(f / 2, 0.2, 'square', 0.03, 0, i * 0.075); });
      for (let k = 0; k < 6; k++) ruido(0.05, 2500 + k * 300, 1.2, 0.25, 0.12 + k * 0.05);
    },
    derrota() { [392, 330, 262].forEach((f, i) => tom(f, 0.22, 'triangle', 0.07, 0, i * 0.12)); },
    sino() { tom(1568, 0.5, 'sine', 0.12); tom(2093, 0.4, 'sine', 0.06, 0, 0.1); },
    mosca() { tom(220, 0.6, 'sawtooth', 0.03, 260); },
    espirro() { ruido(0.25, 1200, 0.8, 0.3, 0, 'bandpass', 400); tom(300, 0.2, 'square', 0.05, 150); },
    acordou() { tom(440, 0.08, 'square', 0.05, 660); },
    toque() { tom(700, 0.03, 'sine', 0.05); },
  };
}
