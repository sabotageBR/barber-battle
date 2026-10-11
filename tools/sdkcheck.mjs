// Roda tools/sdkcheck.html no Chrome headless para cada cenario do SDK.
// Sobe o proprio servidor estatico (porta 4350). Uso: node tools/sdkcheck.mjs [raiz] [cenarios]
//   raiz: '' testa o fonte; 'dist/' testa a build que vai para a Poki.
//   cenarios: lista separada por virgula (padrao: todos). O jogo roda em sala local com bots;
//   'semservidor' aponta para um endereco morto e confere a queda para o modo local.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { servir } from './servir.mjs';

/** Chrome sem travar o processo (o servidor deste mesmo processo precisa responder). */
function chrome(args, ms) {
  return new Promise((ok) => {
    const p = spawn('google-chrome', args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    const t = setTimeout(() => p.kill('SIGKILL'), ms);
    p.on('close', () => { clearTimeout(t); ok(out); });
  });
}

const raiz = process.argv[2] && !process.argv[2].includes(',') ? process.argv[2] : '';
const porta = 4350;
const fechar = await servir(porta);
const cenarios = (process.argv[3] ? process.argv[3].split(',') : ['normal', 'recusa', 'bloqueado', 'pendente', 'lsquebrado', 'semservidor', 'espectador']);
let ok = true;
for (const c of cenarios) {
  const perfil = mkdtempSync(join(tmpdir(), 'bb-sdk-'));
  const stdout = await chrome([
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--host-resolver-rules=MAP game-cdn.poki.com 127.0.0.1:9, MAP barberbattle.io 127.0.0.1:9',
    `--user-data-dir=${perfil}`, '--window-size=420,900', '--virtual-time-budget=120000',
    '--dump-dom', `http://127.0.0.1:${porta}/tools/sdkcheck.html?cenario=${c}&raiz=${encodeURIComponent(raiz)}`,
  ], 120000);
  rmSync(perfil, { recursive: true, force: true });
  const texto = (stdout || '').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const m = /RESULTADO (\{.*\})/.exec(texto);
  if (!m) {
    ok = false;
    process.stdout.write(`${c.padEnd(11)} SEM RESULTADO (o banco nao terminou)\n`);
    continue;
  }
  const res = JSON.parse(m[1]);
  ok = ok && res.passou;
  process.stdout.write(`${c.padEnd(11)} ${res.passou ? 'passou' : 'FALHOU: ' + res.falhas.join(' | ')}\n`);
  if (!res.passou || process.env.LOG) process.stdout.write('  ' + res.log.map((l) => (process.env.LOG ? l.join(':') : l.slice(1).join(':'))).join(' ') + '\n  estado final: ' + JSON.stringify(res.estadoFinal) + ' titulo: ' + res.titulo + '\n');
}
await fechar();
process.exit(ok ? 0 : 1);
