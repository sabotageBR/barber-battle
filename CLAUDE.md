# CLAUDE.md

Guia para o Claude Code neste repositório.

# Barber Battle

Duelo de barbearia multiplayer-only para a Poki: dois barbeiros estilizam o mesmo cliente (cabelo + barba) ao mesmo tempo, cada um na sua cópia, e a plateia vota no vencedor. Cliente em **HTML + JavaScript puro** (ES modules, canvas 2D + HUD em DOM, WebAudio), no padrão do `../2048_cards`; servidor em **Node 22 + `ws`** (`servidor/`) que roda no cluster Kubernetes do usuário. Nada de bundler, framework ou TypeScript. O jogo publicado não tem dependência (não há `npm install` na raiz); só `servidor/` instala `ws`.

- **Plano aprovado:** `~/.claude/plans/pasted-content-id-6e13-barberbattle-io-optimized-swan.md` (2026-10-11).
- **Referência visual:** `modelos/layouts.html` (6 modelos; estrutura do 03 Palco + identidade do 05 Pop Cartoon) e `modelos/personagens.html` (13 clientes, zonas, expressões, mecânicas). Escolhas do usuário em `docs/autoria.md`.
- **Regras da Poki:** vault `../obsidian/POKI/` e `developers.poki.com`; checklist de submissão em `docs/poki.md`.

## Regra do jogo
- **Sala:** até 12 jogadores (6 humanos), 2 cadeiras por rodada, resto assiste; bots completam até 8. Fila por ordem de chegada; barbeiros voltam ao fim da fila. Estados `espera → saguao (30 s) → rodada (180 s) → votacao (15 s) → resultado (10 s) → transicao (5 s) → saguao`. Saguão e votação terminam antes quando todos já escolheram/votaram. Empate: rodada extra de 30 s; novo empate decide pela qualidade.
- **Corte:** 6 zonas (`topo`, `lados`, `franja` = cabelo; `bochechas`, `queixo`, `bigode` = barba), cada uma com `comp` (comprimento 0..1) e `forma` (acabamento 0..1), mais `brilho` (pomada). 5 ferramentas: tesoura e máquina cortam cabelo, navalha corta barba (com precisão), pente dá forma, pomada dá brilho (só com cabelo ≥ 60%). Ferramenta errada na zona = `oops` visual (penaliza −1 só a partir da 3ª rodada da sessão). 4 temas com alvo por zona, foco cabelo/barba e rigor (`src/jogo/temas.js`). Qualidade 0..100 derivada das zonas.
- **Mecânicas:** combo "No ritmo" (5 traços certos seguidos → ×1,3), navalha de precisão (curativo cômico), torcida da plateia (medidor → Turbo 5 s), eventos de caos (mosca, espirro), pomada deslizante, cochilo do cliente. Nenhuma pune nos 3 primeiros minutos.
- **Pontos:** vencedor +10, perdedor +3; rewarded "dobrar pontos" só para os barbeiros, só com `=== true`. Chapéus em 1/3/5 vitórias.
- **Plateia:** reações prontas (emoji + 2 frases) e torcida. **Sem chat.** Nomes gerados (nunca texto livre).

## Estrutura
- **`src/jogo/`, lógica pura** (sem DOM, sem `Math.random`, sem relógio; o tempo entra nas ações; só importa de `src/jogo/`): `constantes.js`, `temas.js`, `ferramentas.js`, `corte.js` (traço → zonas, combo, precisão, qualidade), `sala.js` (reducer `aplicar(estado, evento) => { estado, eventos }`), `fila.js`, `bots.js`, `nomes.js`, `protocolo.js` (schemas, `validar`, baldes de taxa).
- **`src/core/`:** `poki.js` (cópia do template + `openExternalLink`, `idioma`), `config.js` (**única** URL do servidor e da política), `rede.js` (cliente WebSocket, backoff, relógio, queda para o modo local), `transporte.js` (único a criar `WebSocket`; `TransporteLocal.par()` em memória), `sessao.js`, `motor-sala.js` (sala viva: reducer + timers injetados + bots; usada pelo servidor e pelo modo local), `audio.js`, `armazenamento.js` (prefixo `barber.`), `depuracao.js`, `haptico.js`, `rng.js`.
- **`src/render/`:** `layout.js` (geometria pura, estrutura `palco` em retrato e paisagem), `cabeca.js` (peças `Path2D` da folha de personagens, `zonaEm`, expressões), `cena.js`, `fisica.js`, `particulas.js`, `ferramentas.js`, `transicoes.js`, `skin.js`.
- **`src/ui/`:** `hud.js`, `saguao.js`, `votacao.js`, `resultado.js`, `reacoes.js`, `menus.js`, `estilo.css`, fontes woff2 (OFL, em `LICENCAS.txt`).
- **`src/i18n/textos.js`:** EN padrão, PT e ES; listas de nomes alinhadas.
- **`src/main.js`** liga tudo; é o **único** que importa `poki.js` e `rede.js`.
- **`servidor/`:** `index.js` (http + upgrade `/ws` + estático + `/healthz`; único a importar `ws`), `config.js`, `origem.js`, `estatico.js`, `salas.js`, `sala-viva.js`, `conexao.js`, `relogio.js`, `registro.js` (único com `console`), `privacidade.html`, `Dockerfile`. Importa `../src/jogo/*` e `../src/core/motor-sala.js` por caminho relativo.
- **`kubernetes/`:** manifests do namespace `barberbattle` e `bin/deploy.sh`.
- **A build da Poki só leva `index.html`, `LICENCAS.txt` e `src/`** (`tools/empacotar.mjs`); `servidor/` nunca entra no zip.

## Convenções
- Código e comentários em português, comentários em ASCII. 2 espaços, aspas simples, ponto e vírgula, `catch { /* ignora */ }`, JSDoc no lugar de tipos.
- Fronteiras vigiadas por `test/estilo.test.js`: só `main.js` importa `poki.js` e `rede.js`; só `armazenamento.js` toca o `localStorage`; só `depuracao.js` lê a URL; só `transporte.js` cria `WebSocket`; `src/jogo/` é puro e folha; `src/` não importa `servidor/`; `servidor/` só importa `src/jogo` e `motor-sala.js`; sem `console.log`; URLs externas permitidas = SDK (qualquer arquivo), `wss://barberbattle.io/ws` e `https://barberbattle.io/privacidade` (só `config.js`), `ws://127.0.0.1:<porta>/ws` (só `depuracao.js`).
- **Um relógio só** no cliente: `performance.now()`; o servidor injeta o seu em `motor-sala.js`. Estado da sala imutável e serializável (RNG mulberry32 dentro do estado).
- **Toda proposta visual vai como imagem ou protótipo jogável**, nunca só como descrição. O usuário escolhe entre várias opções renderizadas.

## Poki
- SDK por tag síncrona no `<head>`. `gameLoadingFinished` uma vez. `gameplayStart` só em input real de jogo (traço, Jogar/Assistir, voto, reação, torcida, teclas 1–5). `gameplayStop` ao abrir o menu, antes de anúncio, aba oculta, início do resultado para barbeiros, ócio > 90 s.
- `commercialBreak` só na janela resultado + transição (espectadores no início do resultado, barbeiros sem rewarded no início da transição), depois da 1ª rodada completa e de 180 s de sessão, no máximo 1 a cada 2 rodadas. A sala nunca espera o anúncio: quem volta tarde entra como espectador (`anuncio`/`pronto`).
- Rewarded só pelo botão "Dobrar pontos 🎬" ao lado de um "Continuar" maior; prêmio só com `=== true`; sem SDK os botões de vídeo somem (`body.sem-anuncio`). Áudio mudo antes do anúncio, ao esconder a aba e no botão de som.
- Servidor externo exige aprovação da Poki (Settings → CSP) e política de privacidade em `https://barberbattle.io/privacidade` (botão no menu via `openExternalLink`). Sem servidor o jogo roda em modo local com bots, sem texto técnico.
- Build ≤ 5 MB gzip, sem `.map`, fontes locais, sem splash; 16:9 preenchendo a tela, retrato e paisagem.

## Comandos
| Comando | O que faz |
|---|---|
| `npm test` | Testes do motor, da sala, dos bots, do protocolo, do layout, dos textos, do wrapper Poki e das fronteiras |
| `npm run servir` | Servidor estático em `127.0.0.1:5360` (módulos ES não carregam por `file://`) |
| `npm run servidor` | Servidor de salas em `127.0.0.1:3000` (`npm run servidor:instalar` antes, uma vez) |
| `node tools/shot.mjs "<query>" LxA saida.png [ms]` | Print do jogo no Chrome headless; `saida` = `-` imprime o título e o `data-estado` |
| `npm run sdkcheck` | Banco de testes do SDK em Chrome headless (`tools/sdkcheck.html`) |
| `node tools/thumb.mjs [--final]` | Renderiza e mede a thumb; `--final` grava `marketing/thumb/` |
| `npm run poki` | Testes, thumb, empacotamento (`dist/` e `dist-poki/`), sdkcheck da build e prints |
| `HOSTS="MAP barberbattle.io 192.168.12.50" node tools/dois-clientes.mjs http://barberbattle.io/ 2` | Fumaça de ponta a ponta: Chrome headless (CDP, tempo real) com 2 jogadores contra um servidor de verdade; use `TEMPOS_RAPIDOS=1` no servidor para durar 20 s |
| `node tools/carga.mjs ws://127.0.0.1:3000/ws 200 120` | Teste de carga: 200 clientes falsos por 120 s (suba o servidor com `MAX_POR_IP=10000`) |
| `kubernetes/bin/deploy.sh [tag] [--aplicar\|--dry-run\|--no-push\|--rollback]` | Testes, build da imagem (`trixtecnologia/barberbattle-server`), push e `kubectl set image` no cluster (ver `kubernetes/README.md`) |

**Armadilhas do ferramental**: o Chrome headless em modo `--dump-dom` mantém a janela ~90 px mais baixa que `--window-size` e não roda `requestAnimationFrame`; por isso o `main.js` tem um passo lógico por timer e confere o tamanho da janela a cada quadro. Testes do navegador contra o servidor real não funcionam com `--virtual-time-budget` (tempo virtual × tempo real): use `servidor/test/integracao.test.js`.

**Parâmetros de teste** (só em localhost; ver `src/core/depuracao.js`): `?local`, `?servidor=ws://127.0.0.1:3000/ws`, `?sala=nome`, `?bots=7`, `?rapido`, `?papel=barbeiro|espectador`, `?tema=lenhador|executivo|festa|militar`, `?estado=saguao|rodada|votacao|resultado`, `?gesto=...`, `?novato`, `?semanuncio`, `?lang=pt`, `?fixo`.
