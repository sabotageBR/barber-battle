// Monta a build da Poki: copia so o jogo para dist/, confere e zipa em
// dist-poki/barber-battle-<versao>.zip (index.html na raiz do zip). Ao lado do zip
// vai a thumb (marketing/thumb/barber-battle-1256.png, de tools/thumb.mjs --final),
// conferida contra a regra da Poki: PNG quadrado de no minimo 628 px.
// Uso: node tools/empacotar.mjs
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { RAIZ } from './servir.mjs';

const versao = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')).version;
const dist = join(RAIZ, 'dist');
const saida = join(RAIZ, 'dist-poki');
const zip = join(saida, `barber-battle-${versao}.zip`);
const PERMITIDA = 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js';
// Unicas URLs alem do SDK: o servidor de salas e a politica de privacidade, so em src/core/config.js.
const PERMITIDAS_CONFIG = ['wss://barberbattle.io/ws', 'https://barberbattle.io/privacidade'];
const THUMB = join(RAIZ, 'marketing/thumb/barber-battle-1256.png');
const THUMB_MIN = 628;

/** @param {string} d @returns {string[]} */
const listar = (d) => readdirSync(d).flatMap((n) => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? listar(p) : [p];
});

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
for (const item of ['index.html', 'LICENCAS.txt', 'src']) cpSync(join(RAIZ, item), join(dist, item), { recursive: true });

const falhas = [];
const arquivos = listar(dist);
const html = readFileSync(join(dist, 'index.html'), 'utf8');
if (!/viewport-fit=cover/.test(html)) falhas.push('index.html sem viewport-fit=cover');
if (!html.includes(PERMITIDA)) falhas.push('index.html sem o SDK da Poki');
let bruto = 0;
let gz = 0;
for (const p of arquivos) {
  const r = relative(dist, p);
  const dados = readFileSync(p);
  bruto += dados.length;
  gz += gzipSync(dados, { level: 9 }).length;
  if (extname(p) === '.map') falhas.push(`mapa de fonte na build: ${r}`);
  if (/\.(html|js|css)$/.test(p)) {
    const t = dados.toString('utf8');
    for (const u of t.match(/\b(?:https?|wss?):\/\/[^\s"'`)<>]+/g) || []) {
      const deConfig = r === 'src/core/config.js' && PERMITIDAS_CONFIG.includes(u);
      const loopback = r === 'src/core/depuracao.js' && /^ws:\/\/127\.0\.0\.1:\d+\/ws$/.test(u);
      if (u !== PERMITIDA && !deConfig && !loopback) falhas.push(`URL externa em ${r}: ${u}`);
    }
    if (/\bws:\/\//.test(t) && r !== 'src/core/depuracao.js') falhas.push(`ws:// sem TLS em ${r}`);
    if (/console\.(log|info|debug)\s*\(/.test(t)) falhas.push(`console.log em ${r}`);
  }
}
if (gz > 5 * 1024 * 1024) falhas.push(`build acima de 5 MB gzip (${gz} bytes)`);
// thumb: assinatura PNG e largura/altura do IHDR (bytes 16..23, big-endian)
let thumbLado = 0;
if (!existsSync(THUMB)) falhas.push(`thumb ausente: ${relative(RAIZ, THUMB)} (rode node tools/thumb.mjs --final)`);
else {
  const t = readFileSync(THUMB);
  const png = t.length > 24 && t.toString('latin1', 1, 4) === 'PNG';
  const w = png ? t.readUInt32BE(16) : 0, h = png ? t.readUInt32BE(20) : 0;
  if (!png) falhas.push('thumb nao e PNG');
  else if (w !== h) falhas.push(`thumb nao e quadrada (${w}x${h})`);
  else if (w < THUMB_MIN) falhas.push(`thumb menor que ${THUMB_MIN} px (${w})`);
  else thumbLado = w;
}
if (falhas.length) {
  process.stdout.write('FALHOU:\n  ' + falhas.join('\n  ') + '\n');
  process.exit(1);
}

mkdirSync(saida, { recursive: true });
rmSync(zip, { force: true });
const z = spawnSync('zip', ['-qr', '-X', zip, '.'], { cwd: dist, encoding: 'utf8' });
if (z.status !== 0) {
  process.stdout.write('zip falhou: ' + z.stderr + '\n');
  process.exit(1);
}
const teste = spawnSync('unzip', ['-tq', zip], { encoding: 'utf8' });
const lista = spawnSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).stdout.trim().split('\n');
if (lista.some((n) => /^servidor\//.test(n))) {
  process.stdout.write('servidor/ entrou no zip\n');
  process.exit(1);
}
if (teste.status !== 0 || !lista.includes('index.html')) {
  process.stdout.write('zip invalido ou sem index.html na raiz\n');
  process.exit(1);
}
const sha = createHash('sha256').update(readFileSync(zip)).digest('hex');
const tam = statSync(zip).size;
writeFileSync(join(saida, `barber-battle-${versao}.sha256`), `${sha}  barber-battle-${versao}.zip\n`);
const thumbSaida = join(saida, `barber-battle-${versao}-thumb.png`);
cpSync(THUMB, thumbSaida);
process.stdout.write(`build ok: ${arquivos.length} arquivos, ${(bruto / 1024).toFixed(0)} KB (${(gz / 1024).toFixed(0)} KB gzip)\n`);
process.stdout.write(`${relative(RAIZ, zip)}: ${(tam / 1024).toFixed(0)} KB, sha256 ${sha}\n`);
process.stdout.write(`${relative(RAIZ, thumbSaida)}: ${thumbLado}x${thumbLado}, ${(statSync(thumbSaida).size / 1024).toFixed(0)} KB\n`);
if (!existsSync(zip)) process.exit(1);
