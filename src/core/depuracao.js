// Parametros de teste na URL. So valem em file://, localhost e 127.0.0.1:
// na Poki nada disso existe. Unico modulo que le a URL.
//   ?local            sala em memoria com bots (sem servidor)
//   ?servidor=ws://127.0.0.1:3000/ws   endereco do servidor
//   ?sala=teste       cai na sala com esse nome
//   ?bots=7           quantidade alvo de bots (modo local)
//   ?rapido           tempos curtos (prints, sdkcheck)
//   ?papel=barbeiro|espectador   no modo local, fixa o papel na primeira rodada
//   ?tema=lenhador    tema da primeira rodada (modo local)
//   ?estado=rodada    comeca ja nesse estado (modo local): saguao|rodada|votacao|resultado
//   ?gesto=tool:maquina@100;traco:lados@300;tap:votarA@1200;click:bJogar@200   gestos simulados (ms)
//   ?novato           mostra a mao fantasma mesmo com perfil veterano
//   ?semanuncio       nao pede intervalo comercial
//   ?lang=pt          forca o idioma (en, pt, es)
//   ?fixo             sem animacoes de entrada (prints)
//   ?semhud           esconde o HUD (thumb)
//   ?menu             abre o menu ao carregar
//
// Fora disso, so o banco de testes de tools/sdkcheck.html liga os ganchos
// (window.__barberTeste = { servidor, rapido, local }); nesse caso "local" continua
// falso para o jogo se comportar como na Poki.

export function lerDepuracao() {
  const base = {
    local: false, ganchos: false, modoLocal: false, servidor: '', sala: '', bots: -1, rapido: false, papel: '', tema: '', estado: '',
    gesto: '', novato: false, semAnuncio: false, lang: '', fixo: false, semHud: false, menu: false,
  };
  let local = false;
  try {
    local = location.protocol === 'file:' || /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
  } catch {
    local = false;
  }
  const teste = /** @type {any} */ (globalThis).__barberTeste;
  if (!local && teste && typeof teste === 'object') {
    return Object.assign(base, { ganchos: true, servidor: teste.servidor || '', rapido: !!teste.rapido, modoLocal: !!teste.local, fixo: true });
  }
  if (!local) return base;
  const q = new URLSearchParams(location.search || location.hash.slice(1));
  return Object.assign(base, {
    local: true,
    ganchos: true,
    modoLocal: q.has('local'),
    servidor: q.get('servidor') || (q.has('local') ? '' : 'ws://127.0.0.1:3000/ws'),
    sala: q.get('sala') || '',
    bots: q.has('bots') ? Math.max(0, parseInt(q.get('bots') || '0', 10) || 0) : -1,
    rapido: q.has('rapido'),
    papel: q.get('papel') || '',
    tema: q.get('tema') || '',
    estado: q.get('estado') || '',
    gesto: q.get('gesto') || '',
    novato: q.has('novato'),
    semAnuncio: q.has('semanuncio'),
    lang: q.get('lang') || '',
    fixo: q.has('fixo'),
    semHud: q.has('semhud'),
    menu: q.has('menu'),
  });
}
