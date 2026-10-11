// Cliente de rede: conecta ao servidor de salas, faz o handshake, mede o
// relogio, reconecta com recuo e, se nao der, avisa para o jogo cair no modo
// local. Nunca mostra texto tecnico: quem decide o que aparece e o main.js.
import { VERSAO_PROTOCOLO } from '../jogo/constantes.js';

const RECUOS = [500, 1000, 2000, 4000, 8000];
const PING_INICIAL = 5;
const PING_MS = 5000;
const AMOSTRAS = 8;
const REENVIO_MS = 2000;

/**
 * @param {Object} p
 * @param {string} p.url
 * @param {(url: string) => import('./transporte.js').Transporte} p.criarTransporte
 * @param {{ agora: () => number, agendar: Function, cancelar: Function }} p.relogio
 * @param {{ ler: (k: string) => any, gravar: (k: string, v: string) => void }} p.armazem
 * @param {() => { nome: [number, number], avatar: { cor: number, chapeu: number }, idioma: string, sala?: string, bots?: number }} p.perfil
 * @param {(msg: Record<string, any>) => void} p.aoMensagem      sala, delta, evento, bemvindo
 * @param {(estado: string) => void} [p.aoEstado]               conectando, online, reconectando, local
 */
export function criarRede({ url, criarTransporte, relogio, armazem, perfil, aoMensagem, aoEstado }) {
  /** @type {import('./transporte.js').Transporte|null} */
  let transporte = null;
  let estado = 'parado';
  let tentativas = 0;
  let timerReconectar = null;
  let timerPing = null;
  let pingsEnviados = 0;
  let pingId = 0;
  /** @type {Array<{ rtt: number, desloc: number }>} */
  let amostras = [];
  let deslocamento = 0;
  let rtt = 0;
  /** @type {{ token: string, sala: string } | null} */
  let sessao = lerSessao();
  /** @type {Array<{ msg: any, em: number }>} */
  let pendentesTraco = [];
  let encerrado = false;

  function lerSessao() {
    try {
      const bruto = armazem.ler('sessao');
      const v = typeof bruto === 'string' ? JSON.parse(bruto) : bruto;
      return v && typeof v.token === 'string' && /^[0-9a-f]{32}$/.test(v.token) && v.ate > Date.now() ? v : null;
    } catch {
      return null;
    }
  }
  function gravarSessao(token, sala) {
    sessao = { token, sala };
    try { armazem.gravar('sessao', JSON.stringify({ token, sala, ate: Date.now() + 10 * 60 * 1000 })); } catch { /* ignora */ }
  }
  function mudar(novo) {
    if (estado === novo) return;
    estado = novo;
    if (aoEstado) aoEstado(novo);
  }
  function cancelar(id) { if (id !== null) { try { relogio.cancelar(id); } catch { /* ignora */ } } }

  function enviarBruto(msg) {
    if (transporte && transporte.aberto()) transporte.enviar(msg);
  }
  function ping() {
    pingId += 1;
    enviarBruto({ t: 'ping', id: pingId, tc: relogio.agora() });
    pingsEnviados += 1;
    cancelar(timerPing);
    timerPing = relogio.agendar(ping, pingsEnviados < PING_INICIAL ? 400 : PING_MS);
  }
  function registrarPong(m) {
    const agora = relogio.agora();
    const ida = agora - Number(m.tc);
    if (!Number.isFinite(ida) || ida < 0) return;
    amostras.push({ rtt: ida, desloc: Number(m.ts) - (Number(m.tc) + ida / 2) });
    if (amostras.length > AMOSTRAS) amostras.shift();
    const melhor = amostras.reduce((a, b) => (b.rtt < a.rtt ? b : a));
    deslocamento = melhor.desloc;
    rtt = melhor.rtt;
  }

  function conectar() {
    if (encerrado) return;
    cancelar(timerReconectar);
    timerReconectar = null;
    mudar(tentativas === 0 ? 'conectando' : 'reconectando');
    let t;
    try {
      t = criarTransporte(url);
    } catch {
      falhou();
      return;
    }
    transporte = t;
    t.aoAbrir(() => {
      const p = perfil();
      const entrar = { t: 'entrar', v: VERSAO_PROTOCOLO, nome: p.nome, avatar: p.avatar, idioma: p.idioma };
      if (sessao) entrar.sessao = sessao.token;
      if (p.sala) entrar.sala = p.sala;
      if (p.bots !== undefined && p.bots >= 0) entrar.bots = p.bots;
      t.enviar(entrar);
      pingsEnviados = 0;
      amostras = [];
      ping();
    });
    t.aoMensagem((m) => {
      if (m.t === 'pong') { registrarPong(m); return; }
      if (m.t === 'bemvindo') {
        tentativas = 0;
        gravarSessao(m.sessao, m.salaId);
        mudar('online');
        // tracos que ficaram pendentes na queda (menos de 2 s) vao de novo
        const agora = relogio.agora();
        for (const p of pendentesTraco) if (agora - p.em < REENVIO_MS) t.enviar(p.msg);
        pendentesTraco = [];
      }
      if (m.t === 'erro') {
        if (m.codigo === 'versao' || m.codigo === 'lotado') { encerrar(); mudar('local'); }
        return;
      }
      if (m.t === 'manutencao') return; // o fechamento que vem a seguir reconecta
      aoMensagem(m);
    });
    t.aoFechar((motivo) => {
      cancelar(timerPing);
      timerPing = null;
      if (transporte !== t) return;
      transporte = null;
      if (encerrado || estado === 'local') return;
      if (motivo && motivo.codigo === 4005) {
        // outra conexao assumiu esta sessao: esquecer o token e entrar como jogador novo
        sessao = null;
        try { armazem.gravar('sessao', ''); } catch { /* ignora */ }
        pendentesTraco = [];
        tentativas = 0;
        conectar();
        return;
      }
      falhou();
    });
  }
  function falhou() {
    if (encerrado) return;
    if (tentativas >= RECUOS.length) { mudar('local'); return; }
    const espera = RECUOS[tentativas];
    tentativas += 1;
    mudar('reconectando');
    cancelar(timerReconectar);
    timerReconectar = relogio.agendar(() => { timerReconectar = null; conectar(); }, espera);
  }
  function encerrar() {
    encerrado = true;
    cancelar(timerReconectar);
    cancelar(timerPing);
    timerReconectar = null;
    timerPing = null;
    const t = transporte;
    transporte = null;
    if (t) t.fechar();
  }

  return {
    conectar,
    /** @param {Record<string, any>} msg */
    enviar(msg) {
      if (msg.t === 'traco') {
        pendentesTraco.push({ msg, em: relogio.agora() });
        if (pendentesTraco.length > 40) pendentesTraco.shift();
      }
      enviarBruto(msg);
    },
    /** A aba voltou: se caiu, tenta ja. */
    acordar() {
      if (encerrado || estado === 'local' || (transporte && transporte.aberto())) return;
      tentativas = Math.min(tentativas, 1);
      conectar();
    },
    /** Converte um instante do relogio do servidor para o relogio local. @param {number} ts */
    paraLocal(ts) { return ts - deslocamento; },
    get estado() { return estado; },
    get deslocamento() { return deslocamento; },
    get rtt() { return rtt; },
    get sessao() { return sessao; },
    parar() { encerrar(); mudar('parado'); },
  };
}
