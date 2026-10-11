// Print do jogo pelo Chrome headless, servido em 127.0.0.1 (modulos ES nao
// carregam por file://). Uso: node tools/shot.mjs "<query>" <LxA> <saida.png> [espera_ms]
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { servir } from './servir.mjs';

export function chrome(args, ms) {
  return new Promise((ok) => {
    const p = spawn('google-chrome', args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    const t = setTimeout(() => p.kill('SIGKILL'), ms);
    p.on('close', () => { clearTimeout(t); ok(out); });
  });
}

export async function shot(porta, query, tam, saida, espera = 3000, dom = false) {
  const perfil = mkdtempSync(join(tmpdir(), 'bb-shot-'));
  const [w, h] = tam.split('x');
  const out = await chrome([
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--host-resolver-rules=MAP game-cdn.poki.com 127.0.0.1:9', `--user-data-dir=${perfil}`,
    `--window-size=${w},${h}`, `--virtual-time-budget=${espera}`, dom ? '--dump-dom' : `--screenshot=${saida}`,
    `http://127.0.0.1:${porta}/index.html?${query}`,
  ], 120000);
  rmSync(perfil, { recursive: true, force: true });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [query, tam, saida, espera] = process.argv.slice(2);
  const porta = 5352;
  const fechar = await servir(porta);
  if (saida === '-') {
    const dom = await shot(porta, query, tam, '', Number(espera) || 3000, true);
    process.stdout.write((dom.match(/<title>[^<]*<\/title>/) || ['sem titulo'])[0] + ' ' + ((dom.match(/data-estado="[^"]*"/) || [''])[0]) + '\n');
  } else {
    await shot(porta, query, tam, saida, Number(espera) || 3000);
  }
  await fechar();
}
