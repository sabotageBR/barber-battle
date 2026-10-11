import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcularLayout, zonaEm, zonaCanonica, centroZona, SLOT_MIN, CABECA_MIN } from '../src/render/layout.js';

const TELAS = [[360, 640], [360, 780], [390, 844], [412, 915], [640, 360], [844, 390], [836, 470], [1031, 580], [1280, 720], [1920, 1080], [2560, 1080], [768, 1024], [1024, 768]];
const dentro = (c, W, H) => c.x >= 0 && c.y >= 0 && c.x + c.w <= W + 0.5 && c.y + c.h <= H + 0.5;
const separadas = (a, b) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;

test('em todas as telas nada sai da tela nem se sobrepoe, e os minimos de toque valem', () => {
  for (const [W, H] of TELAS) {
    for (const papel of ['barbeiro', 'espectador']) {
      const L = calcularLayout({ W, H, papel });
      const caixas = [L.topo, L.plateia, L.podios[0].caixa, L.podios[1].caixa];
      for (const c of caixas) assert.ok(dentro(c, W, H), `${W}x${H} ${papel}: fora da tela`);
      for (let i = 0; i < caixas.length; i++) for (let k = i + 1; k < caixas.length; k++) assert.ok(separadas(caixas[i], caixas[k]), `${W}x${H} ${papel}: sobreposicao`);
      for (const p of L.podios) {
        assert.ok(dentro(p.cabeca, W, H) && p.cabeca.x >= p.caixa.x && p.cabeca.y + p.cabeca.h <= p.caixa.y + p.caixa.h + 0.5, `${W}x${H}: cabeca fora do podio`);
        assert.ok(separadas(p.cabeca, p.barras) || p.empilhado, `${W}x${H}: cabeca sobre as barras`);
        if (p.proprio) {
          assert.equal(p.slots.length, 5);
          for (const s of p.slots) {
            assert.ok(s.w >= SLOT_MIN && s.h >= SLOT_MIN, `${W}x${H}: slot ${s.w}x${s.h}`);
            assert.ok(separadas(s, p.cabeca), `${W}x${H}: slot sobre a cabeca`);
          }
        }
      }
      const minimo = papel === 'barbeiro' && W >= 390 && H >= 640 ? CABECA_MIN : 100;
      assert.ok(L.podios[0].cabeca.w >= minimo, `${W}x${H} ${papel}: cabeca propria ${L.podios[0].cabeca.w}`);
      assert.ok(L.podios[1].cabeca.w >= 80, `${W}x${H}: cabeca do adversario ${L.podios[1].cabeca.w}`);
      for (const v of L.vai) assert.ok(v.w >= 44 && v.h >= 36, `${W}x${H}: botao vai ${v.w}x${v.h}`);
      assert.ok(L.medidor.w > 40, `${W}x${H}: medidor`);
    }
  }
});

test('retrato empilha os podios (o proprio maior) e paisagem poe lado a lado', () => {
  const r = calcularLayout({ W: 390, H: 844, papel: 'barbeiro' });
  assert.equal(r.retrato, true);
  assert.ok(r.podios[0].caixa.h > r.podios[1].caixa.h);
  assert.equal(r.podios[0].caixa.x, r.podios[1].caixa.x);
  const p = calcularLayout({ W: 844, H: 390, papel: 'barbeiro' });
  assert.equal(p.retrato, false);
  assert.equal(p.podios[0].caixa.y, p.podios[1].caixa.y);
  const e = calcularLayout({ W: 390, H: 844, papel: 'espectador' });
  assert.ok(Math.abs(e.podios[0].caixa.h - e.podios[1].caixa.h) <= 1, 'espectador: podios iguais');
  assert.equal(e.podios[0].slots.length, 0);
});

test('zonaEm devolve cada zona no seu centro, null fora da cabeca, e os centros batem', () => {
  const cabeca = { x: 100, y: 50, w: 300, h: 380 };
  for (const zona of ['topo', 'franja', 'lados', 'bochechas', 'bigode', 'queixo']) {
    const c = centroZona(zona, cabeca);
    assert.equal(zonaCanonica(zonaEm(c.x, c.y, cabeca)), zona);
  }
  assert.equal(zonaCanonica(zonaEm(cabeca.x + 290, cabeca.y + 240, cabeca)), 'bochechas', 'lado direito');
  assert.equal(zonaEm(cabeca.x - 100, cabeca.y - 100, cabeca), null);
  assert.equal(zonaEm(cabeca.x + 150, cabeca.y + 410, cabeca), null);
  const meia = { x: 0, y: 0, w: 150, h: 190 };
  assert.equal(zonaCanonica(zonaEm(75, 31, meia)), 'topo');
});
