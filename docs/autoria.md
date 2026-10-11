# Autoria e decisões de design

Registro das escolhas feitas pelo usuário (não pela ferramenta), com data, o que foi visto e a decisão. A Poki avalia "direção de design intencional": este arquivo é a prova.

## 2026-10-11 · layout e identidade

| Pergunta | Opções vistas | Escolha |
|---|---|---|
| Modelo de layout | 6 páginas renderizadas em `modelos/layouts.html`: 01 Navalha & Latão, 02 Neon Fade, 03 Palco, 04 Estúdio, 05 Pop Cartoon, 06 Pixel Arcade | **Estrutura do 03 Palco** (dois pódios sempre visíveis, letreiro no topo, plateia com torcida embaixo) **com a identidade do 05 Pop Cartoon** (contorno grosso, sombra chapada, roxo + amarelo + laranja + teal) |
| Personagens | Esboço inicial (rejeitado: "melhorar e muito") → `modelos/personagens.html` com 6 clientes base + 7 com cabelo e barba volumosos | Folha de personagens aprovada; pedido de mais volume atendido (coque + barbão viking, black power, cabelão, careca com barba de nuvem, mullet + costeletas, dreads, moicano) |
| Mecânica principal | arrastar sobre zonas da cabeça · toques no ritmo · minijogos por ferramenta | **Arrastar sobre 6 zonas** (topo, lados, franja, bochechas, queixo, bigode) |
| Bots | barbeiros e plateia · só plateia · sem bots | **Barbeiros e plateia bots** enchem a sala; humanos têm prioridade de cadeira; nomes gerados iguais aos de humanos |
| Mecânicas extras | tabela em `modelos/personagens.html` | Pedido: "mecânicas e físicas bem divertidas e engajantes" (combo, navalha de precisão, torcida, mosca/espirro, pomada deslizante, cochilo, aparas e molas) |

| Thumb | `node tools/thumb.mjs a b c` → `marketing/thumb/comparar.png`: (a) Tonhão feliz com máquina e tesoura, (b) Valdir impressionado com navalha e pente, (c) Jurandir com tesoura e pente | **(a)** é a padrão (`ESCOLHIDA` em `tools/thumb.mjs`); (c) reprova no contraste rosto × parede (1,5:1). Confirmar no checkpoint |

Riscos anotados: saguão de 30 s e rodada de 180 s podem ser longos para a Poki (decidir no playtest); espera pela cadeira com 6 humanos.

## Checkpoint do laboratório (pendente)

Ver `modelos/laboratorio.html` quando existir. Preencher após a escolha:

| Pergunta | Opções vistas | Escolha |
|---|---|---|
| Fonte do HUD | Fredoka (já licenciada) · Lilita One + Baloo 2 (woff2 subset) | |
| Proporção dos pódios em retrato | 60/40 · 55/45 | |
| Cliente de abertura da sessão | Tonhão · Valdir · sorteio | |
