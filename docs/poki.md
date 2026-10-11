# Checklist Poki do Barber Battle

## Antes de enviar
1. `npm test` verde e `npm run sdkcheck` com os 7 cenários passando (normal, recusa, bloqueado, pendente, lsquebrado, semservidor, espectador).
2. `npm run poki`: thumb em `marketing/thumb/`, zip em `dist-poki/` (≤ 5 MB gzip, sem `.map`, sem `servidor/`, única URL além do SDK = `wss://barberbattle.io/ws` e `https://barberbattle.io/privacidade`), prints em `docs/prints/`.
3. Servidor no ar com `wss://` válido (fase B: domínio comprado, Let's Encrypt) e `https://barberbattle.io/privacidade` respondendo.

## No Poki for Developers
1. Upload da build (pasta com `index.html` na raiz ou o zip).
2. **Settings → CSP**: pedir a liberação de `wss://barberbattle.io` (servidor de salas em tempo real; WebSocket; sem dados pessoais) e `https://barberbattle.io` (política de privacidade via `openExternalLink`). Informar o link da política.
3. Depois da aprovação, **reenviar a mesma build** (a Poki reseta o cache da CSP).
4. Inspector (`inspector.poki.dev` ou aba Versions): Event Log com `gameLoadingFinished` 1× e `gameplayStart` só depois do toque; aba Warnings sem "External Resources"; Mobile → QR no celular em 4G (prova que o `wss://` público funciona); Scaling Tests em 640×360, 836×470 e 1031×580.
5. Thumbs estática (1256 e 628, quadradas, sem texto) e, se pedirem, animada.
6. Playtests: 10 gravações assistidas → Player Fit (500 jogadores, ~5 h; meta média > 3 min e ≥ 25% das sessões > 3 min) → Web Fit (C2P ≥ 65%, ≥ 5 min).

## Durante os testes
- `watch kubectl -n barberbattle top pod` e `curl https://barberbattle.io/healthz` (salas, sockets, humanos).
- Não fazer deploy durante o teste (encerra as salas em andamento).
- Ler as `measure`: `lobby/jogar|assistir`, `primeiro/traco/*`, `tempo/*`, `rewarded/dobrar/*`, `rede/online|local`.

## Regras embutidas no código (não quebrar)
- Sem chat, nomes gerados, conteúdo para todas as idades.
- `commercialBreak` só na janela resultado + transição, depois da 1ª rodada completa e de 180 s de sessão, no máximo 1 a cada 2 rodadas; a sala não espera (mensagens `anuncio`/`pronto`).
- Rewarded só pelo botão "Dobrar pontos 🎬", ao lado de "Continuar" maior; prêmio só com `=== true`; sem SDK os botões somem.
- Áudio mudo antes do anúncio, ao esconder a aba e no botão de som. Sem servidor, modo local com bots e nenhum texto técnico.
