# Barber Battle · laboratório visual

- `layouts.html`: os 6 modelos de layout apresentados ao usuário (página publicada em 2026-10-11). Escolha: **estrutura do 03 Palco** com a **identidade do 05 Pop Cartoon**.
- `personagens.html`: folha de personagens (13 clientes, transformação por tema, zonas de corte, expressões, mecânicas, tela do Palco com arte Pop Cartoon).
- `laboratorio.html`: o jogo real em iframes (retrato, paisagem e o tamanho da Poki) com toggles de estado, papel, tema, idioma e novato. Sirva com `npm run servir` e abra `http://127.0.0.1:5360/modelos/laboratorio.html` (módulos ES não carregam por `file://`).

Nada daqui entra na build: `tools/empacotar.mjs` só copia `index.html`, `LICENCAS.txt` e `src/`.

## Checkpoint (pendente)

| Pergunta | Opções | Escolha |
|---|---|---|
| Fonte do HUD | Fredoka (atual, já licenciada) · Lilita One + Baloo 2 (como nas páginas) | |
| Proporção dos pódios em retrato | 60/40 (atual) · 55/45 | |
| Cliente da primeira rodada | sorteio (atual) · Tonhão · Valdir | |
| Cor de fundo do palco | roxo `#6b4bd6` (atual) · azul-escuro · verde-escuro | |
