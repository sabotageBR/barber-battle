// Teste de carga simples: N clientes falsos entram, escolhem jogar, cortam, votam e reagem
// por S segundos. Imprime salas, mensagens/s, ping p50/p95 e RSS do servidor (via /healthz).
// Uso: node tools/carga.mjs ws://127.0.0.1:3000/ws [clientes=200] [segundos=120]
// Falha (exit 1) se o p95 do ping passar de 150 ms ou o RSS de 300 MB.
const url = process.argv[2] || 'ws://127.0.0.1:3000/ws';
const N = Number(process.argv[3]) || 200;
const S = Number(process.argv[4]) || 120;
const http = url.replace(/^ws(s?):\/\//, 'http$1://').replace(/\/ws.*$/, '');
const ZONAS = ['topo', 'lados', 'franja', 'bochechas', 'queixo', 'bigode'];
const FERR = ['tesoura', 'maquina', 'navalha', 'pente'];
const pings = [];
let recebidas = 0;
let enviadas = 0;
let bemvindos = 0;
let erros = 0;

function cliente(i) {
  const ws = new WebSocket(url);
  let sala = null;
  let eu = '';
  let seq = 0;
  let timer = null;
  const enviar = (m) => { if (ws.readyState === 1) { ws.send(JSON.stringify(m)); enviadas++; } };
  ws.onopen = () => enviar({ t: 'entrar', v: 1, nome: [i % 24, (i * 7) % 24], avatar: { cor: i % 8, chapeu: 0 } });
  ws.onmessage = (e) => {
    recebidas++;
    const m = JSON.parse(e.data);
    if (m.t === 'bemvindo') { bemvindos++; eu = m.jogadorId; sala = m.sala; }
    else if (m.t === 'sala') sala = m.sala;
    else if (m.t === 'delta') { if (sala) { sala.estado = m.estado; } }
    else if (m.t === 'pong') pings.push(performance.now() - m.tc);
  };
  ws.onerror = () => { erros++; };
  timer = setInterval(() => {
    if (!sala || ws.readyState !== 1) return;
    const barbeiro = sala.cadeiras && sala.cadeiras.includes(eu);
    if (sala.estado === 'saguao' && sala.jogadores[eu] && !sala.jogadores[eu].escolha) { enviar({ t: 'escolher', opcao: 'jogar' }); sala.jogadores[eu].escolha = 'jogar'; }
    else if (sala.estado === 'rodada' && barbeiro) { for (let k = 0; k < 2; k++) enviar({ t: 'traco', zona: ZONAS[(seq + k) % 6], ferramenta: FERR[(seq + k) % 4], intensidade: 0.5, precisao: 0.8, seq: seq++ }); }
    else if (sala.estado === 'rodada' && Math.random() < 0.1) enviar({ t: 'torcer', alvo: sala.cadeiras[0] });
    else if (sala.estado === 'votacao' && !barbeiro && Math.random() < 0.3) enviar({ t: 'votar', alvo: sala.cadeiras[Math.random() < 0.5 ? 0 : 1] });
    else if (Math.random() < 0.02) enviar({ t: 'reagir', reacao: Math.floor(Math.random() * 8) });
    if (Math.random() < 0.08) enviar({ t: 'ping', id: 1, tc: performance.now() });
  }, 330);
  return () => { clearInterval(timer); try { ws.close(); } catch { /* ignora */ } };
}

const fechar = [];
for (let i = 0; i < N; i++) { fechar.push(cliente(i)); await new Promise((r) => setTimeout(r, 15)); }
const t0 = Date.now();
await new Promise((r) => setTimeout(r, S * 1000));
for (const f of fechar) f();
const dur = (Date.now() - t0) / 1000;
pings.sort((a, b) => a - b);
const p = (q) => (pings.length ? pings[Math.min(pings.length - 1, Math.floor(pings.length * q))].toFixed(1) : 'n/a');
let saude = null;
try { saude = await (await fetch(`${http}/healthz`)).json(); } catch { saude = null; }
process.stdout.write(`clientes ${N} (bemvindos ${bemvindos}, erros ${erros}) por ${dur.toFixed(0)} s\n`);
process.stdout.write(`mensagens: enviadas ${(enviadas / dur).toFixed(0)}/s, recebidas ${(recebidas / dur).toFixed(0)}/s\n`);
process.stdout.write(`ping ms: p50 ${p(0.5)} p95 ${p(0.95)} (${pings.length} amostras)\n`);
process.stdout.write(`servidor: ${saude ? `salas ${saude.salas}, sockets ${saude.sockets}, humanos ${saude.humanos}, rss ${saude.rssMb} MB` : 'healthz indisponivel'}\n`);
const ruim = (pings.length && Number(p(0.95)) > 150) || (saude && saude.rssMb > 300) || bemvindos < N * 0.95;
process.exit(ruim ? 1 : 0);
