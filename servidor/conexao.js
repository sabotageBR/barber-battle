// Uma conexao WebSocket: decodifica, valida, limita a taxa e encaminha a sala.
import { decodificar, criarBaldes, tomarDo } from '../src/jogo/protocolo.js';

const ESTOUROS_MAX = 3;
const ESTOURO_JANELA_MS = 10000;
const INVALIDAS_MAX = 5;

/**
 * @param {Object} p
 * @param {{ send: Function, close: Function, terminate: Function, on: Function, ping: Function, readyState: number }} p.ws
 * @param {ReturnType<typeof import('./salas.js').criarGerente>} p.gerente
 * @param {ReturnType<typeof import('./relogio.js').criarRelogio>} p.relogio
 * @param {ReturnType<typeof import('./registro.js').criarRegistro>} p.log
 * @param {string} p.ip
 * @param {string} p.caminho
 * @param {() => void} p.aoFechar
 */
export function criarConexao({ ws, gerente, relogio, log, ip, caminho, aoFechar }) {
  let baldes = criarBaldes(relogio.agora());
  /** @type {{ sala: any, jogadorId: string, token: string } | null} */
  let sessao = null;
  let estouros = [];
  let invalidas = 0;
  let vivo = true;
  let fechou = false;

  const conexao = {
    enviar(msg) {
      if (ws.readyState !== 1) return;
      try { ws.send(JSON.stringify(msg)); } catch { /* ignora */ }
    },
    fechar(codigo = 1000) {
      try { ws.close(codigo); } catch { /* ignora */ }
    },
  };

  function encerrar(codigo, motivo) {
    if (fechou) return;
    fechou = true;
    if (sessao) sessao.sala.desconectar(sessao.jogadorId, conexao);
    log.debug('conexao fechada', { ip, codigo, motivo, jogador: sessao ? sessao.jogadorId : null });
    aoFechar();
  }

  ws.on('pong', () => { vivo = true; });
  const batimento = setInterval(() => {
    if (!vivo) { try { ws.terminate(); } catch { /* ignora */ } return; }
    vivo = false;
    try { ws.ping(); } catch { /* ignora */ }
  }, 10000);

  ws.on('message', (dados, binario) => {
    if (binario) return;
    const texto = typeof dados === 'string' ? dados : dados.toString('utf8');
    const r = decodificar(texto);
    const agora = relogio.agora();
    if (!r.ok) {
      invalidas += 1;
      if (r.erro === 'versao') { conexao.enviar({ t: 'erro', codigo: 'versao' }); conexao.fechar(4001); return; }
      if (invalidas >= INVALIDAS_MAX) conexao.fechar(4002);
      return;
    }
    const msg = r.msg;
    const taxa = tomarDo(baldes, msg.t, agora);
    baldes = taxa.baldes;
    if (!taxa.ok) {
      estouros = estouros.filter((t) => agora - t < ESTOURO_JANELA_MS);
      estouros.push(agora);
      if (estouros.length >= ESTOUROS_MAX) conexao.fechar(4008);
      return;
    }
    if (msg.t === 'ping') { conexao.enviar({ t: 'pong', id: msg.id, tc: msg.tc, ts: agora }); return; }
    if (!sessao) {
      if (msg.t !== 'entrar') return;
      const r2 = gerente.entrar(conexao, { ...msg, caminho });
      if (!r2) { conexao.enviar({ t: 'erro', codigo: 'lotado' }); conexao.fechar(4003); return; }
      sessao = r2;
      return;
    }
    if (msg.t === 'entrar') return;
    sessao.sala.agir(sessao.jogadorId, msg);
  });
  ws.on('close', (codigo) => { clearInterval(batimento); encerrar(codigo, 'close'); });
  ws.on('error', () => { clearInterval(batimento); encerrar(1006, 'error'); });

  return conexao;
}
