// Cabeca procedural em canvas 2D: as pecas da folha de personagens
// (modelos/personagens.html) como caminhos SVG em Path2D, com cores por
// arquetipo, selecao de peca pelo estado das zonas (o corte aparece) e
// expressoes. Sem DOM alem do canvas que recebe.
import { ZONAS_CABELO, ZONAS_BARBA } from '../jogo/constantes.js';
import { proximidade } from '../jogo/corte.js';

export const LARG = 300;
export const ALT = 380;
const INK = '#2a1a52';

/**
 * Uma peca e uma lista de operacoes. fill/stroke: 'skin' | 'hair' | 'beard' | 'ink' | 'shirt' | 'iris' |
 * 'crest' | cor literal | 'stubble' | 'flannel'. w = espessura do contorno; o = opacidade.
 * @typedef {{ t: 'p', d: string, f?: string, s?: string, w?: number, o?: number }
 *  | { t: 'e', cx: number, cy: number, rx: number, ry: number, f?: string, s?: string, w?: number, o?: number }
 *  | { t: 'c', cx: number, cy: number, r: number, f?: string, s?: string, w?: number, o?: number }
 *  | { t: 'r', x: number, y: number, w: number, h: number, rx: number, f?: string, s?: string, sw?: number, o?: number }
 *  | { t: 'g', itens: Peca, f?: string, s?: string, w?: number, o?: number }} Op
 * @typedef {Op[]} Peca
 */

const P = (d, f, s = 'ink', w = 6, o) => ({ t: 'p', d, f, s, w, o });
const L = (d, s = 'ink', w = 3, o = 0.35) => ({ t: 'p', d, f: 'none', s, w, o });
const E = (cx, cy, rx, ry, f, s = 'ink', w = 6, o) => ({ t: 'e', cx, cy, rx, ry, f, s, w, o });
const C = (cx, cy, r, f, s = 'ink', w = 6, o) => ({ t: 'c', cx, cy, r, f, s, w, o });

const SOMBRA_HAIR = P('M70 152 C 86 118, 110 106, 150 106 C 192 106, 216 118, 234 150 C 216 130, 190 120, 150 120 C 110 120, 86 130, 70 152 Z', 'ink', 'none', 0, 0.12);
const COSTELETAS = [P('M62 150 C 58 172, 60 192, 68 200 L 76 150 Z', 'hair', 'ink', 5), P('M238 150 C 242 172, 240 192, 232 200 L 224 150 Z', 'hair', 'ink', 5)];

/** @type {Record<string, Peca>} */
export const PECAS = {
  camisa: [P('M42 392 C 52 332, 106 312, 150 312 C 194 312, 248 332, 258 392 Z', 'shirt'), L('M118 316 L150 348 L182 316', 'ink', 6, 1)],
  flanela: [P('M42 392 C 52 332, 106 312, 150 312 C 194 312, 248 332, 258 392 Z', 'flannel'), L('M118 316 L150 348 L182 316 M150 348 v44', 'ink', 6, 1), P('M122 318 C 118 334, 138 344, 150 348 C 162 344, 182 334, 178 318 Z', '#fff6e3', 'ink', 5)],
  pescoco: [{ t: 'r', x: 120, y: 258, w: 60, h: 68, rx: 18, f: 'skin', s: 'ink', sw: 6 }, P('M123 268 C 130 294, 170 294, 177 268 Z', 'ink', 'none', 0, 0.16)],
  orelhas: [E(64, 186, 17, 24, 'skin'), E(236, 186, 17, 24, 'skin'), E(67, 188, 8, 13, 'ink', 'none', 0, 0.18), E(233, 188, 8, 13, 'ink', 'none', 0, 0.18)],
  rostoOval: [P('M150 66 C 206 66, 240 114, 238 186 C 236 248, 200 294, 150 294 C 100 294, 64 248, 62 186 C 60 114, 94 66, 150 66 Z', 'skin'), P('M238 186 C 236 248, 200 294, 150 294 C 186 282, 216 242, 222 186 C 224 150, 214 110, 196 84 C 222 104, 240 140, 238 186 Z', 'ink', 'none', 0, 0.09)],
  rostoQuadrado: [P('M150 66 C 206 66, 238 108, 238 176 C 238 244, 228 290, 150 294 C 72 290, 62 244, 62 176 C 62 108, 94 66, 150 66 Z', 'skin'), P('M238 176 C 238 244, 228 290, 150 294 C 194 284, 218 246, 222 176 C 224 140, 214 108, 196 84 C 222 102, 238 136, 238 176 Z', 'ink', 'none', 0, 0.09)],
  rostoRedondo: [P('M150 64 C 216 64, 250 124, 248 192 C 246 254, 206 296, 150 296 C 94 296, 54 254, 52 192 C 50 124, 84 64, 150 64 Z', 'skin'), P('M248 192 C 246 254, 206 296, 150 296 C 192 284, 226 244, 230 192 C 232 150, 220 112, 200 84 C 230 104, 250 148, 248 192 Z', 'ink', 'none', 0, 0.09)],
  bochechasRosadas: [E(102, 226, 17, 9, '#ff6b8a', 'none', 0, 0.4), E(198, 226, 17, 9, '#ff6b8a', 'none', 0, 0.4)],
  sardas: [94, 222, 106, 230, 100, 238, 114, 222, 206, 222, 194, 230, 200, 238, 186, 222].reduce((a, v, i, arr) => (i % 2 ? a : [...a, C(v, arr[i + 1], 2.2, 'ink', 'none', 0, 0.35)]), []),
  rugas: [L('M90 192 q-6 4 -9 12 M88 184 q-8 1 -12 6 M210 192 q6 4 9 12 M212 184 q8 1 12 6 M120 124 q30 -8 60 0', 'ink', 3, 0.4)],
  nariz: [L('M150 184 C 148 198, 142 206, 139 214', 'ink', 5, 1), E(150, 220, 14, 10, 'skin', 'ink', 5), E(146, 217, 4, 2.5, '#fff', 'none', 0, 0.5)],
  olhos: [E(112, 176, 17, 19, '#fff', 'ink', 5), E(188, 176, 17, 19, '#fff', 'ink', 5), C(115, 179, 9.5, 'iris', 'none', 0), C(191, 179, 9.5, 'iris', 'none', 0), C(116, 180, 4.8, 'ink', 'none', 0), C(192, 180, 4.8, 'ink', 'none', 0), C(109, 171, 3.4, '#fff', 'none', 0), C(185, 171, 3.4, '#fff', 'none', 0), L('M95 168 Q112 150 129 168 M171 168 Q188 150 205 168', 'ink', 6, 1)],
  olhosFelizes: [L('M95 182 Q112 160 129 182 M171 182 Q188 160 205 182', 'ink', 7, 1)],
  olhosFechados: [L('M95 178 Q112 186 129 178 M171 178 Q188 186 205 178', 'ink', 6, 1)],
  olhosArregalados: [E(112, 176, 19, 22, '#fff', 'ink', 5), E(188, 176, 19, 22, '#fff', 'ink', 5), C(113, 178, 8, 'iris', 'none', 0), C(187, 178, 8, 'iris', 'none', 0), C(114, 179, 4, 'ink', 'none', 0), C(188, 179, 4, 'ink', 'none', 0), C(108, 170, 3.2, '#fff', 'none', 0), C(182, 170, 3.2, '#fff', 'none', 0)],
  sobrancelhas: [P('M84 148 C 96 130, 122 128, 138 142 C 124 142, 104 146, 84 156 Z', 'hair', 'ink', 4), P('M216 148 C 204 130, 178 128, 162 142 C 176 142, 196 146, 216 156 Z', 'hair', 'ink', 4)],
  sobrancelhasAltas: [P('M84 136 C 96 116, 122 114, 138 128 C 124 128, 104 132, 84 144 Z', 'hair', 'ink', 4), P('M216 136 C 204 116, 178 114, 162 128 C 176 128, 196 132, 216 144 Z', 'hair', 'ink', 4)],
  sobrancelhasPreocupadas: [P('M86 156 C 98 146, 120 134, 138 136 C 126 142, 106 150, 86 164 Z', 'hair', 'ink', 4), P('M214 156 C 202 146, 180 134, 162 136 C 174 142, 194 150, 214 164 Z', 'hair', 'ink', 4)],
  sobrancelhasGrossas: [P('M80 152 C 94 126, 124 124, 140 142 C 126 146, 104 150, 80 164 Z', 'hair', 'ink', 4), P('M220 152 C 206 126, 176 124, 160 142 C 174 146, 196 150, 220 164 Z', 'hair', 'ink', 4)],
  bocaSorrisao: [P('M114 244 C 126 276, 174 276, 186 244 C 168 253, 132 253, 114 244 Z', '#5b1e3a', 'ink', 5), P('M121 247 C 132 259, 168 259, 179 247 C 164 252, 136 252, 121 247 Z', '#fff', 'none', 0)],
  bocaSorriso: [L('M124 248 Q150 270 176 248', 'ink', 6, 1), L('M118 244 q2 8 8 10 M182 244 q-2 8 -8 10', 'ink', 4, 0.6)],
  bocaPreocupada: [L('M126 260 C 134 250, 142 252, 150 258 C 158 252, 166 250, 174 260', 'ink', 6, 1)],
  bocaO: [E(150, 256, 11, 14, '#5b1e3a', 'ink', 5)],
  barbaCheia: [P('M64 192 C 60 246, 84 306, 118 324 C 130 332, 140 328, 150 336 C 160 328, 170 332, 182 324 C 216 306, 240 246, 236 192 C 230 238, 206 270, 150 274 C 94 270, 70 238, 64 192 Z', 'beard'), L('M84 240 C 96 262, 112 276, 134 282', '#fff', 6, 0.2), L('M102 292 q6 10 2 22 M128 304 q6 10 2 22 M172 304 q-6 10 -2 22 M198 292 q-6 10 -2 22', 'ink', 3, 0.35)],
  barbaDesgrenhada: [P('M64 192 C 60 240, 80 292, 104 312 L 110 338 L 124 316 L 136 346 L 150 320 L 164 346 L 176 316 L 190 338 L 196 312 C 220 292, 240 240, 236 192 C 230 238, 206 270, 150 274 C 94 270, 70 238, 64 192 Z', 'beard'), L('M94 262 l-12 10 M206 262 l12 10 M88 232 l-14 6 M212 232 l14 6', 'ink', 5, 1), L('M100 290 q8 8 4 20 M128 300 q6 10 2 22 M172 300 q-6 10 -2 22 M200 290 q-8 8 -4 20', 'ink', 3, 0.4)],
  barbaPorFazer: [P('M66 196 C 64 242, 86 292, 150 296 C 214 292, 236 242, 234 196 C 228 238, 206 270, 150 274 C 94 270, 72 238, 66 196 Z', 'beard', 'none', 0, 0.14), P('M66 196 C 64 242, 86 292, 150 296 C 214 292, 236 242, 234 196 C 228 238, 206 270, 150 274 C 94 270, 72 238, 66 196 Z', 'stubble', 'none', 0)],
  cavanhaque: [P('M116 268 C 118 302, 182 302, 184 268 C 170 282, 130 282, 116 268 Z', 'beard', 'ink', 5)],
  bigode: [P('M108 234 C 120 218, 140 220, 150 232 C 160 220, 180 218, 192 234 C 184 244, 166 246, 150 240 C 134 246, 116 244, 108 234 Z', 'beard', 'ink', 5)],
  bigodeGuidao: [P('M96 222 C 100 212, 112 214, 118 226 C 130 214, 146 218, 150 232 C 154 218, 170 214, 182 226 C 188 214, 200 212, 204 222 C 207 232, 197 237, 192 231 C 186 243, 166 247, 150 240 C 134 247, 114 243, 108 231 C 103 237, 93 232, 96 222 Z', 'beard', 'ink', 5)],
  barbaViking: [P('M62 192 C 52 252, 70 332, 110 368 C 124 380, 140 374, 150 384 C 160 374, 176 380, 190 368 C 230 332, 248 252, 238 192 C 232 240, 206 272, 150 276 C 94 272, 68 240, 62 192 Z', 'beard'), L('M84 244 C 96 268, 112 282, 134 288', '#fff', 6, 0.2), L('M118 296 c 10 10 -10 20 0 30 c 10 10 -10 20 0 30 M182 296 c -10 10 10 20 0 30 c -10 10 10 20 0 30 M106 300 h24 M106 330 h24 M170 300 h24 M170 330 h24', 'ink', 3.5, 0.5), E(118, 360, 11, 6, '#ffd93d', 'ink', 3), E(182, 360, 11, 6, '#ffd93d', 'ink', 3)],
  barbaNuvem: [P('M60 190 a26 26 0 0 0 -4 50 a28 28 0 0 0 10 52 a28 28 0 0 0 28 42 a30 30 0 0 0 34 26 a28 28 0 0 0 44 0 a30 30 0 0 0 34 -26 a28 28 0 0 0 28 -42 a28 28 0 0 0 10 -52 a26 26 0 0 0 -4 -50 C 232 240, 206 272, 150 276 C 94 272, 68 240, 60 190 Z', 'beard'), L('M84 244 C 96 268, 112 282, 134 288', '#fff', 7, 0.5), L('M104 300 q6 10 2 22 M130 312 q6 10 2 22 M170 312 q-6 10 -2 22 M196 300 q-6 10 -2 22', 'ink', 3, 0.3)],
  barbaCachos: [C(70, 236, 26, 'beard'), C(230, 236, 26, 'beard'), C(86, 292, 28, 'beard'), C(214, 292, 28, 'beard'), C(122, 334, 28, 'beard'), C(178, 334, 28, 'beard'), C(150, 344, 26, 'beard'), P('M58 192 C 48 250, 64 318, 104 350 C 122 364, 140 356, 150 366 C 160 356, 178 364, 196 350 C 236 318, 252 250, 242 192 C 236 240, 206 272, 150 276 C 94 272, 64 240, 58 192 Z', 'beard', 'none', 0), L('M84 244 C 96 268, 112 282, 134 288', '#fff', 6, 0.2), L('M100 300 q8 10 4 24 M130 312 q6 10 2 22 M170 312 q-6 10 -2 22 M200 300 q-8 10 -4 24', 'ink', 3, 0.35)],
  costeletas: [P('M64 190 C 58 232, 70 266, 104 276 C 108 252, 98 220, 84 196 Z', 'beard', 'ink', 5), P('M236 190 C 242 232, 230 266, 196 276 C 192 252, 202 220, 216 196 Z', 'beard', 'ink', 5)],
  cabeloTopete: [...COSTELETAS, SOMBRA_HAIR, P('M68 156 C 70 96, 92 42, 134 32 C 184 22, 230 44, 240 96 C 246 120, 240 140, 236 150 C 222 112, 194 100, 150 100 C 108 100, 84 114, 68 156 Z', 'hair'), L('M104 60 C 130 42, 172 40, 208 62', '#fff', 10, 0.3), L('M122 50 C 112 68, 102 88, 98 104 M164 38 C 160 58, 154 80, 150 100 M206 70 C 196 84, 190 94, 186 104', 'ink', 3, 0.35)],
  cabeloCrespo: [SOMBRA_HAIR, P('M56 172 a30 30 0 0 1 20 -48 a30 30 0 0 1 36 -36 a34 34 0 0 1 38 -14 a34 34 0 0 1 38 14 a30 30 0 0 1 36 36 a30 30 0 0 1 20 48 C 232 124, 200 104, 150 104 C 100 104, 68 124, 56 172 Z', 'hair'), P('M56 172 C 46 190, 48 208, 58 214 L 72 168 Z', 'hair', 'ink', 5), P('M244 172 C 254 190, 252 208, 242 214 L 228 168 Z', 'hair', 'ink', 5), C(92, 122, 9, 'none', 'ink', 3, 0.3), C(124, 92, 9, 'none', 'ink', 3, 0.3), C(176, 92, 9, 'none', 'ink', 3, 0.3), C(208, 122, 9, 'none', 'ink', 3, 0.3), C(150, 84, 7, 'none', 'ink', 3, 0.3), L('M110 70 C 130 56, 170 56, 190 70', '#fff', 8, 0.22)],
  cabeloMaquina: [P('M66 152 C 66 94, 102 60, 150 60 C 198 60, 234 94, 234 152 C 220 118, 190 104, 150 104 C 110 104, 80 118, 66 152 Z', 'hair'), P('M66 152 C 66 94, 102 60, 150 60 C 198 60, 234 94, 234 152 C 220 118, 190 104, 150 104 C 110 104, 80 118, 66 152 Z', 'stubble', 'none', 0), ...COSTELETAS, L('M104 76 C 126 66, 174 66, 196 76', '#fff', 7, 0.22)],
  cabeloExecutivo: [...COSTELETAS, SOMBRA_HAIR, P('M66 152 C 62 92, 94 50, 150 52 C 206 54, 240 88, 236 146 C 230 110, 204 96, 160 100 C 118 102, 86 114, 66 152 Z', 'hair'), P('M98 102 C 92 84, 104 66, 126 62 C 114 76, 110 90, 114 104 Z', 'hair', 'ink', 4), L('M114 64 C 130 78, 152 92, 180 100', 'ink', 3, 0.45), L('M150 62 C 180 64, 206 78, 222 100', '#fff', 8, 0.24)],
  cabeloDesgrenhado: [SOMBRA_HAIR, P('M60 170 C 50 112, 74 60, 108 52 L 114 26 L 128 56 L 148 22 L 158 56 L 184 28 L 182 60 C 220 68, 248 104, 242 166 C 234 128, 206 104, 150 106 C 100 106, 76 122, 60 170 Z', 'hair'), P('M60 168 L 46 204 L 64 196 L 58 222 L 74 180 Z', 'hair', 'ink', 5), P('M242 164 L 256 200 L 238 192 L 244 218 L 228 178 Z', 'hair', 'ink', 5), L('M96 78 C 102 96, 100 112, 96 120 M136 60 C 134 80, 132 96, 134 110 M190 66 C 196 84, 200 100, 198 112', 'ink', 3, 0.4)],
  cabeloGrisalho: [P('M60 150 C 54 176, 58 198, 70 206 L 80 148 Z', 'hair', 'ink', 5), P('M240 150 C 246 176, 242 198, 230 206 L 220 148 Z', 'hair', 'ink', 5), P('M74 150 C 74 104, 104 74, 150 74 C 196 74, 226 104, 226 150 C 220 124, 196 112, 150 112 C 104 112, 80 124, 74 150 Z', 'hair'), L('M106 94 C 126 84, 174 84, 194 94', '#fff', 7, 0.35)],
  afroTras: [C(150, 128, 112, 'hair'), C(62, 86, 28, 'hair'), C(238, 86, 28, 'hair'), C(104, 28, 26, 'hair'), C(196, 28, 26, 'hair'), C(150, 18, 24, 'hair'), C(42, 150, 26, 'hair'), C(258, 150, 26, 'hair'), C(56, 212, 24, 'hair'), C(244, 212, 24, 'hair'), C(150, 128, 110, 'hair', 'none', 0), C(86, 60, 8, 'none', 'ink', 3, 0.28), C(150, 40, 8, 'none', 'ink', 3, 0.28), C(214, 60, 8, 'none', 'ink', 3, 0.28), C(60, 120, 8, 'none', 'ink', 3, 0.28), C(240, 120, 8, 'none', 'ink', 3, 0.28), L('M96 48 C 120 30, 180 30, 204 48', '#fff', 9, 0.2)],
  afroFrente: [C(54, 176, 34, 'hair'), C(246, 176, 34, 'hair'), P('M66 150 C 70 108, 100 90, 150 90 C 200 90, 230 108, 234 150 C 220 126, 190 116, 150 116 C 110 116, 80 126, 66 150 Z', 'hair'), P('M70 152 C 86 128, 110 118, 150 118 C 190 118, 214 128, 230 150 C 214 136, 190 130, 150 130 C 110 130, 86 136, 70 152 Z', 'ink', 'none', 0, 0.12)],
  cabelaoTras: [P('M58 150 C 38 200, 34 280, 48 334 C 66 324, 86 336, 98 320 C 108 300, 100 240, 112 212 L 188 212 C 200 240, 192 300, 202 320 C 214 336, 234 324, 252 334 C 266 280, 262 200, 242 150 C 230 88, 190 48, 150 48 C 110 48, 70 88, 58 150 Z', 'hair'), L('M62 200 C 56 250, 58 300, 66 326 M238 200 C 244 250, 242 300, 234 326', 'ink', 3, 0.35)],
  cabelaoFrente: [SOMBRA_HAIR, P('M66 150 C 62 96, 96 56, 150 56 C 204 56, 238 96, 234 150 C 226 112, 196 100, 150 100 C 104 100, 74 112, 66 150 Z', 'hair'), P('M62 150 C 48 190, 50 240, 64 278 C 78 262, 82 220, 76 180 Z', 'hair', 'ink', 5), P('M238 150 C 252 190, 250 240, 236 278 C 222 262, 218 220, 224 180 Z', 'hair', 'ink', 5), L('M100 76 C 124 62, 176 62, 200 76', '#fff', 8, 0.25), L('M120 64 C 112 80, 104 96, 100 104 M184 64 C 190 80, 196 96, 200 104', 'ink', 3, 0.35)],
  cabeloCoque: [...COSTELETAS, SOMBRA_HAIR, C(150, 40, 28, 'hair'), L('M134 32 C 142 22, 158 22, 166 32', 'ink', 3, 0.4), P('M66 152 C 66 94, 102 58, 150 58 C 198 58, 234 94, 234 152 C 220 118, 190 104, 150 104 C 110 104, 80 118, 66 152 Z', 'hair'), L('M128 62 C 140 60, 148 60, 150 60 M172 62 C 160 60, 152 60, 150 60 M96 78 C 112 66, 130 62, 150 62 M204 78 C 188 66, 170 62, 150 62', 'ink', 3, 0.4), L('M110 74 C 124 66, 176 66, 190 74', '#fff', 7, 0.22)],
  mulletTras: [P('M64 170 C 52 220, 54 282, 70 324 C 90 314, 110 324, 122 304 L 178 304 C 190 324, 210 314, 230 324 C 246 282, 248 220, 236 170 Z', 'hair'), L('M78 220 C 74 260, 76 290, 82 312 M222 220 C 226 260, 224 290, 218 312', 'ink', 3, 0.35)],
  mulletFrente: [...COSTELETAS, SOMBRA_HAIR, P('M66 152 C 64 100, 96 60, 150 60 C 204 60, 236 100, 234 152 C 222 118, 192 104, 150 104 C 108 104, 78 118, 66 152 Z', 'hair'), P('M108 66 L 116 42 L 132 62 Z', 'hair', 'ink', 5), P('M146 60 L 152 34 L 166 60 Z', 'hair', 'ink', 5), P('M182 66 L 196 46 L 202 70 Z', 'hair', 'ink', 5), L('M100 80 C 124 66, 176 66, 200 80', '#fff', 7, 0.22)],
  moicano: [P('M66 152 C 66 94, 102 60, 150 60 C 198 60, 234 94, 234 152 C 220 118, 190 104, 150 104 C 110 104, 80 118, 66 152 Z', 'hair', 'none', 0, 0.25), P('M66 152 C 66 94, 102 60, 150 60 C 198 60, 234 94, 234 152 C 220 118, 190 104, 150 104 C 110 104, 80 118, 66 152 Z', 'stubble', 'none', 0), P('M118 104 L 110 58 L 130 72 L 134 24 L 150 62 L 164 14 L 170 64 L 188 30 L 186 72 L 204 58 L 190 104 Z', 'crest'), L('M136 40 L 148 62 M166 30 L 170 62', '#fff', 5, 0.35)],
  dreadsTras: [{ t: 'r', x: 34, y: 150, w: 20, h: 150, rx: 10, f: 'hair', s: 'ink', sw: 5 }, { t: 'r', x: 52, y: 130, w: 20, h: 186, rx: 10, f: 'hair', s: 'ink', sw: 5 }, { t: 'r', x: 70, y: 120, w: 20, h: 160, rx: 10, f: 'hair', s: 'ink', sw: 5 }, { t: 'r', x: 210, y: 120, w: 20, h: 160, rx: 10, f: 'hair', s: 'ink', sw: 5 }, { t: 'r', x: 228, y: 130, w: 20, h: 186, rx: 10, f: 'hair', s: 'ink', sw: 5 }, { t: 'r', x: 246, y: 150, w: 20, h: 150, rx: 10, f: 'hair', s: 'ink', sw: 5 }, C(62, 310, 7, '#ffd93d', 'ink', 3), C(238, 310, 7, '#ffd93d', 'ink', 3), C(44, 294, 6, '#ffd93d', 'ink', 3), C(256, 294, 6, '#ffd93d', 'ink', 3)],
  dreadsFrente: [SOMBRA_HAIR, P('M62 156 C 58 90, 96 48, 150 48 C 204 48, 242 90, 238 156 C 226 116, 196 102, 150 102 C 104 102, 74 116, 62 156 Z', 'hair'), L('M80 120 C 92 80, 120 58, 150 54 M112 108 C 118 78, 134 60, 150 54 M188 108 C 182 78, 166 60, 150 54 M220 120 C 208 80, 180 58, 150 54', 'ink', 4, 0.5), P('M60 150 C 48 190, 50 236, 62 262 C 74 246, 78 206, 74 176 Z', 'hair', 'ink', 5), P('M240 150 C 252 190, 250 236, 238 262 C 226 246, 222 206, 226 176 Z', 'hair', 'ink', 5)],
  careca: [C(64, 140, 24, 'hair'), C(58, 180, 22, 'hair'), C(236, 140, 24, 'hair'), C(242, 180, 22, 'hair'), L('M136 72 q8 -18 18 -2 M160 70 q8 -16 16 -2', 'hair', 5, 1), E(128, 92, 22, 10, '#fff', 'none', 0, 0.35)],
  oculos: [{ t: 'r', x: 86, y: 154, w: 52, h: 42, rx: 13, f: 'rgba(255,255,255,.18)', s: 'ink', sw: 6 }, { t: 'r', x: 162, y: 154, w: 52, h: 42, rx: 13, f: 'rgba(255,255,255,.18)', s: 'ink', sw: 6 }, L('M138 172 h24 M86 170 L 64 164 M214 170 L 236 164', 'ink', 6, 1), L('M96 164 l12 -6 M172 164 l12 -6', '#fff', 4, 0.7)],
  oculosRedondos: [C(112, 178, 26, 'rgba(255,255,255,.18)'), C(188, 178, 26, 'rgba(255,255,255,.18)'), L('M138 176 q12 -8 24 0 M86 174 L 64 166 M214 174 L 236 166', 'ink', 6, 1), L('M98 166 l10 -8 M174 166 l10 -8', '#fff', 4, 0.7)],
  brinco: [C(238, 210, 5.5, '#ffd93d', 'ink', 3)],
  brilho: [P('M246 70 l5 14 14 5 -14 5 -5 14 -5 -14 -14 -5 14 -5 Z', '#fff', 'ink', 3), P('M60 54 l3.5 9 9 3.5 -9 3.5 -3.5 9 -3.5 -9 -9 -3.5 9 -3.5 Z', '#fff', 'ink', 3)],
  curativo: [{ t: 'r', x: 196, y: 236, w: 30, h: 12, rx: 6, f: '#f3d2a8', s: 'ink', sw: 3 }, L('M206 242 h10', '#d9a37b', 3, 1)],
  zzz: [],
};

/**
 * Arquetipos: cores, formato do rosto, cabelo e barba de chegada e acessorios.
 * @type {Record<string, { rosto: string, pele: string, cabelo: string, barba: string, iris: string, camisa: string,
 *   cabeloAntes: string[], cabeloTras?: string, barbaAntes: string[], bigode: string|null, sobrancelha: string, extras: string[], crista?: string }>}
 */
export const ARQUETIPOS = Object.freeze({
  tonhao: { rosto: 'rostoQuadrado', pele: '#e8b48a', cabelo: '#4a2a14', barba: '#4a2a14', iris: '#3b7a3a', camisa: 'flanela', cabeloAntes: ['cabeloDesgrenhado'], barbaAntes: ['barbaDesgrenhada'], bigode: 'bigode', sobrancelha: 'sobrancelhas', extras: ['bochechasRosadas'] },
  ze: { rosto: 'rostoRedondo', pele: '#a0623a', cabelo: '#1d1410', barba: '#1d1410', iris: '#3a2214', camisa: '#ffd93d', cabeloAntes: ['cabeloCrespo'], barbaAntes: ['barbaPorFazer'], bigode: null, sobrancelha: 'sobrancelhasAltas', extras: ['bochechasRosadas', 'brinco'] },
  bruno: { rosto: 'rostoOval', pele: '#5c3a22', cabelo: '#0f0a08', barba: '#0f0a08', iris: '#1a100a', camisa: '#2a66d9', cabeloAntes: ['cabeloDesgrenhado'], barbaAntes: ['barbaCheia'], bigode: 'bigode', sobrancelha: 'sobrancelhas', extras: ['oculos'] },
  kaique: { rosto: 'rostoOval', pele: '#f1c7a0', cabelo: '#e86a10', barba: '#e86a10', iris: '#2f7fd1', camisa: '#6b4bd6', cabeloAntes: ['cabeloDesgrenhado'], barbaAntes: ['barbaPorFazer'], bigode: null, sobrancelha: 'sobrancelhasAltas', extras: ['bochechasRosadas', 'sardas', 'brinco'] },
  chico: { rosto: 'rostoRedondo', pele: '#d9a37b', cabelo: '#d7dbe0', barba: '#c3c8d0', iris: '#5a4a3a', camisa: '#1dc9c0', cabeloAntes: ['cabeloGrisalho'], barbaAntes: ['barbaCheia'], bigode: 'bigode', sobrancelha: 'sobrancelhas', extras: ['bochechasRosadas', 'rugas', 'oculosRedondos'] },
  leo: { rosto: 'rostoQuadrado', pele: '#c98f6a', cabelo: '#2b1b10', barba: '#2b1b10', iris: '#4a2a1a', camisa: '#ff5fa2', cabeloAntes: ['cabeloDesgrenhado'], barbaAntes: ['barbaPorFazer'], bigode: null, sobrancelha: 'sobrancelhasAltas', extras: ['bochechasRosadas'] },
  valdir: { rosto: 'rostoQuadrado', pele: '#f1c7a0', cabelo: '#b5651d', barba: '#b5651d', iris: '#2f7fd1', camisa: '#6b4bd6', cabeloAntes: ['cabeloCoque'], barbaAntes: ['barbaViking'], bigode: 'bigode', sobrancelha: 'sobrancelhasGrossas', extras: [] },
  jurandir: { rosto: 'rostoRedondo', pele: '#6b4226', cabelo: '#1d1410', barba: '#1d1410', iris: '#2a1a0e', camisa: '#ffd93d', cabeloAntes: ['afroFrente'], cabeloTras: 'afroTras', barbaAntes: ['cavanhaque'], bigode: 'bigodeGuidao', sobrancelha: 'sobrancelhasAltas', extras: ['bochechasRosadas'] },
  caio: { rosto: 'rostoOval', pele: '#d9a37b', cabelo: '#e7c27a', barba: '#c9a157', iris: '#3b7a3a', camisa: '#2a66d9', cabeloAntes: ['cabelaoFrente'], cabeloTras: 'cabelaoTras', barbaAntes: ['barbaPorFazer'], bigode: null, sobrancelha: 'sobrancelhas', extras: [] },
  osvaldo: { rosto: 'rostoRedondo', pele: '#e8b48a', cabelo: '#e9ecef', barba: '#f1f3f5', iris: '#5a4a3a', camisa: '#d9442b', cabeloAntes: ['careca'], barbaAntes: ['barbaNuvem'], bigode: 'bigode', sobrancelha: 'sobrancelhasGrossas', extras: ['bochechasRosadas', 'rugas', 'oculosRedondos'] },
  dudu: { rosto: 'rostoQuadrado', pele: '#c98f6a', cabelo: '#2b1b10', barba: '#2b1b10', iris: '#4a2a1a', camisa: '#1dc9c0', cabeloAntes: ['mulletFrente'], cabeloTras: 'mulletTras', barbaAntes: ['costeletas'], bigode: 'bigodeGuidao', sobrancelha: 'sobrancelhas', extras: [] },
  ravi: { rosto: 'rostoOval', pele: '#5c3a22', cabelo: '#0f0a08', barba: '#0f0a08', iris: '#1a100a', camisa: '#ff7a1a', cabeloAntes: ['dreadsFrente'], cabeloTras: 'dreadsTras', barbaAntes: ['barbaCachos'], bigode: 'bigode', sobrancelha: 'sobrancelhasAltas', extras: [] },
  mateus: { rosto: 'rostoQuadrado', pele: '#e8b48a', cabelo: '#2b1b10', barba: '#2b1b10', iris: '#2f7fd1', camisa: '#ff5fa2', cabeloAntes: ['moicano'], barbaAntes: ['barbaPorFazer', 'costeletas'], bigode: null, sobrancelha: 'sobrancelhasAltas', extras: ['brinco'], crista: '#1dc9c0' },
});

/** Peca de cabelo do tema (quando a zona fica pronta). */
const CABELO_TEMA = { exec: 'cabeloExecutivo', topete: 'cabeloTopete', maquina: 'cabeloMaquina' };
/** Peca de barba do tema. */
const BARBA_TEMA = { cheia: ['barbaCheia'], limpa: [], cavanhaque: ['cavanhaque'] };

/** Expressoes: olhos, boca e sobrancelhas. */
export const EXPRESSOES = Object.freeze({
  neutro: { olhos: 'olhos', boca: 'bocaSorriso', sobrancelhas: null },
  feliz: { olhos: 'olhosFelizes', boca: 'bocaSorrisao', sobrancelhas: 'sobrancelhasAltas' },
  impressionado: { olhos: 'olhosArregalados', boca: 'bocaO', sobrancelhas: 'sobrancelhasAltas' },
  preocupado: { olhos: 'olhos', boca: 'bocaPreocupada', sobrancelhas: 'sobrancelhasPreocupadas' },
  dormindo: { olhos: 'olhosFechados', boca: 'bocaSorriso', sobrancelhas: null },
  orgulhoso: { olhos: 'olhosFelizes', boca: 'bocaSorrisao', sobrancelhas: 'sobrancelhasAltas' },
});

/** @type {Map<string, Path2D>} */
const cachePath = new Map();
/** @param {string} d */
function path(d) {
  let p = cachePath.get(d);
  if (!p) {
    p = new Path2D(d);
    cachePath.set(d, p);
  }
  return p;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} nome
 * @param {Record<string, string>} cores
 */
function cor(nome, cores) {
  if (!nome || nome === 'none') return null;
  return cores[nome] || nome;
}

/**
 * Preenchimento com padrao (pontinhos da barba por fazer, xadrez da flanela), recortado pelo caminho.
 * @param {CanvasRenderingContext2D} ctx @param {Path2D} p @param {string} tipo @param {Record<string, string>} cores
 */
function padrao(ctx, p, tipo, cores) {
  ctx.save();
  ctx.clip(p);
  if (tipo === 'stubble') {
    ctx.fillStyle = cores.ink;
    for (let y = 0; y < ALT; y += 7) {
      for (let x = 0; x < LARG; x += 7) {
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(x + 2, y + 2, 1.3, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.arc(x + 5.5, y + 5.5, 1.1, 0, Math.PI * 2); ctx.fill();
      }
    }
  } else if (tipo === 'flannel') {
    ctx.fillStyle = '#d9442b';
    ctx.fillRect(0, 300, LARG, 100);
    ctx.fillStyle = 'rgba(142,27,27,.55)';
    for (let y = 300; y < 400; y += 26) ctx.fillRect(0, y, LARG, 9);
    for (let x = 0; x < LARG; x += 26) ctx.fillRect(x, 300, 9, 100);
    ctx.fillStyle = 'rgba(90,15,15,.5)';
    for (let y = 300; y < 400; y += 26) for (let x = 0; x < LARG; x += 26) ctx.fillRect(x, y, 9, 9);
  }
  ctx.restore();
}

/**
 * Desenha uma peca no sistema 300x380 (o ctx ja esta transformado).
 * @param {CanvasRenderingContext2D} ctx @param {Peca} peca @param {Record<string, string>} cores
 */
export function desenharPeca(ctx, peca, cores) {
  for (const op of peca) {
    const o = op.o === undefined ? 1 : op.o;
    ctx.globalAlpha = o;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    /** @type {Path2D|null} */
    let p = null;
    if (op.t === 'p') p = path(op.d);
    else {
      p = new Path2D();
      if (op.t === 'e') p.ellipse(op.cx, op.cy, op.rx, op.ry, 0, 0, Math.PI * 2);
      else if (op.t === 'c') p.arc(op.cx, op.cy, op.r, 0, Math.PI * 2);
      else if (op.t === 'r') p.roundRect(op.x, op.y, op.w, op.h, op.rx);
    }
    if (!p) continue;
    const f = op.f;
    if (f === 'stubble' || f === 'flannel') padrao(ctx, p, f, cores);
    else {
      const c = cor(f, cores);
      if (c) { ctx.fillStyle = c; ctx.fill(p); }
    }
    const s = cor(op.t === 'r' ? op.s : op.s, cores);
    const w = op.t === 'r' ? op.sw : op.w;
    if (s && w) { ctx.strokeStyle = s; ctx.lineWidth = w; ctx.stroke(p); }
  }
  ctx.globalAlpha = 1;
}

/**
 * Peca de cabelo e barba segundo o estado das zonas: a de chegada encolhe com o
 * corte e, quando a zona fica pronta, entra a do tema.
 * @param {{ zonas: Record<string, [number, number]|{ comp: number, forma: number }>, brilho?: number }} cliente
 * @param {import('../jogo/temas.js').Tema|null} tema
 * @param {string} arquetipo
 */
export function escolherPecas(cliente, tema, arquetipo) {
  const A = ARQUETIPOS[arquetipo] || ARQUETIPOS.tonhao;
  const z = (nome) => {
    const v = cliente.zonas[nome];
    return Array.isArray(v) ? { comp: v[0], forma: v[1] } : v || { comp: 1, forma: 0 };
  };
  const pronta = (nome) => tema && proximidade(z(nome), tema.alvo[nome], tema.rigor) >= 0.9 && z(nome).forma >= 0.6;
  const compCabelo = ZONAS_CABELO.reduce((s, n) => s + z(n).comp, 0) / 3;
  const compBarba = (z('bochechas').comp + z('queixo').comp) / 2;
  const cabeloPronto = pronta('topo') && pronta('lados') && pronta('franja');
  const barbaPronta = pronta('bochechas') && pronta('queixo');
  const cabelo = cabeloPronto && tema ? [CABELO_TEMA[tema.cabelo] || 'cabeloExecutivo'] : compCabelo < 0.12 ? ['cabeloMaquina'] : A.cabeloAntes;
  const cabeloTras = cabeloPronto || compCabelo < 0.35 ? null : A.cabeloTras || null;
  const barba = barbaPronta && tema ? BARBA_TEMA[tema.barba] || [] : compBarba < 0.12 ? [] : compBarba < 0.3 ? ['barbaPorFazer'] : A.barbaAntes;
  const bigode = z('bigode').comp > 0.25 ? A.bigode : null;
  return {
    cabelo, cabeloTras, barba, bigode,
    escalaCabelo: cabeloPronto ? 1 : 0.55 + 0.45 * compCabelo,
    escalaBarba: barbaPronta ? 1 : 0.6 + 0.4 * compBarba,
    escalaBigode: 0.5 + 0.5 * z('bigode').comp,
    bagunca: cabeloPronto ? 0 : 1 - z('topo').forma,
    brilho: cliente.brilho || 0,
  };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} p
 * @param {{ x: number, y: number, w: number, h: number }} p.caixa
 * @param {string} p.arquetipo
 * @param {{ zonas: any, brilho?: number, curativos?: number }} p.cliente
 * @param {import('../jogo/temas.js').Tema|null} p.tema
 * @param {string} [p.expressao]
 * @param {boolean} [p.piscando]
 * @param {number} [p.rotacao]   graus (mola)
 * @param {number} [p.squash]    0..0.1
 * @param {number} [p.alpha]
 */
export function desenharCabeca(ctx, { caixa, arquetipo, cliente, tema, expressao = 'neutro', piscando = false, rotacao = 0, squash = 0, alpha = 1 }) {
  const A = ARQUETIPOS[arquetipo] || ARQUETIPOS.tonhao;
  const cores = { skin: A.pele, hair: A.cabelo, beard: A.barba, iris: A.iris, ink: INK, shirt: A.camisa === 'flanela' ? '#d9442b' : A.camisa, crest: A.crista || A.cabelo };
  const pecas = escolherPecas(cliente, tema, arquetipo);
  const ex = EXPRESSOES[expressao] || EXPRESSOES.neutro;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(caixa.x, caixa.y);
  ctx.scale(caixa.w / LARG, caixa.h / ALT);
  // mola: gira e amassa em torno do pescoco
  ctx.translate(150, 300);
  ctx.rotate((rotacao * Math.PI) / 180);
  ctx.scale(1 + squash, 1 - squash);
  ctx.translate(-150, -300);
  desenharPeca(ctx, PECAS[A.camisa === 'flanela' ? 'flanela' : 'camisa'], cores);
  if (pecas.cabeloTras) {
    ctx.save();
    ctx.translate(150, 150); ctx.scale(1, pecas.escalaCabelo); ctx.translate(-150, -150);
    desenharPeca(ctx, PECAS[pecas.cabeloTras], cores);
    ctx.restore();
  }
  desenharPeca(ctx, PECAS.pescoco, cores);
  desenharPeca(ctx, PECAS.orelhas, cores);
  desenharPeca(ctx, PECAS[A.rosto], cores);
  for (const e of A.extras) if (e !== 'oculos' && e !== 'oculosRedondos' && e !== 'brinco') desenharPeca(ctx, PECAS[e], cores);
  if (pecas.barba.length) {
    ctx.save();
    ctx.translate(150, 200); ctx.scale(1, pecas.escalaBarba); ctx.translate(-150, -200);
    for (const b of pecas.barba) desenharPeca(ctx, PECAS[b], cores);
    ctx.restore();
  }
  desenharPeca(ctx, PECAS[ex.boca], cores);
  if (pecas.bigode) {
    ctx.save();
    ctx.translate(150, 232); ctx.scale(1, pecas.escalaBigode); ctx.translate(-150, -232);
    desenharPeca(ctx, PECAS[pecas.bigode], cores);
    ctx.restore();
  }
  desenharPeca(ctx, PECAS.nariz, cores);
  desenharPeca(ctx, PECAS[piscando ? 'olhosFechados' : ex.olhos], cores);
  desenharPeca(ctx, PECAS[ex.sobrancelhas || A.sobrancelha], cores);
  ctx.save();
  ctx.translate(150, 108); ctx.scale(1, pecas.escalaCabelo); ctx.translate(-150, -108);
  for (const c of pecas.cabelo) desenharPeca(ctx, PECAS[c], cores);
  ctx.restore();
  for (const e of A.extras) if (e === 'oculos' || e === 'oculosRedondos' || e === 'brinco') desenharPeca(ctx, PECAS[e], cores);
  const curativos = Math.min(3, Number(cliente.curativos) || 0);
  for (let i = 0; i < curativos; i++) {
    ctx.save();
    ctx.translate(i === 1 ? -110 : 0, i === 2 ? 24 : 0);
    desenharPeca(ctx, PECAS.curativo, cores);
    ctx.restore();
  }
  if (pecas.brilho > 0.05) {
    ctx.globalAlpha = Math.min(1, pecas.brilho) * 0.9;
    desenharPeca(ctx, PECAS.brilho, cores);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

export const IDS_ARQUETIPOS = Object.freeze(Object.keys(ARQUETIPOS));
