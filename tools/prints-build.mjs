// Prints da build (dist/) nos tamanhos de iframe da Poki e no celular, para
// conferir que o canvas cobre a tela toda. Saida: docs/prints/build-*.png
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { servir, RAIZ } from './servir.mjs';

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

const porta = 4351;
const fechar = await servir(porta);
mkdirSync(join(RAIZ, 'docs/prints'), { recursive: true });
const tamanhos = ['640,360', '836,470', '1031,580', '390,844', '844,390'];
for (const t of tamanhos) {
  const perfil = mkdtempSync(join(tmpdir(), 'bb-shot-'));
  const arq = join(RAIZ, `docs/prints/build-${t.replace(',', 'x')}.png`);
  await chrome([
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--host-resolver-rules=MAP game-cdn.poki.com 127.0.0.1:9', `--user-data-dir=${perfil}`,
    `--window-size=${t}`, '--virtual-time-budget=2500', `--screenshot=${arq}`,
    `http://127.0.0.1:${porta}/dist/index.html`,
  ], 90000);
  rmSync(perfil, { recursive: true, force: true });
  process.stdout.write(`print ${t} -> docs/prints/build-${t.replace(',', 'x')}.png\n`);
}
await fechar();
