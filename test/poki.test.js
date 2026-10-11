import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarPoki, poki as pokiGlobal, PRAZOS_PADRAO } from '../src/core/poki.js';
import { criarSdkFalso } from './apoio/sdk-falso.js';
import { criarRelogioFalso, esvaziar } from './apoio/relogio-falso.js';

/**
 * Poki com SDK falso e relogio falso; onAdStart/onAdEnd entram no mesmo log do SDK.
 * @param {Parameters<typeof criarSdkFalso>[0]} [opcoesSdk]
 */
function montar(opcoesSdk) {
  const relogio = criarRelogioFalso();
  const falso = criarSdkFalso(opcoesSdk);
  const p = criarPoki({ obterSdk: () => falso.sdk, agendar: relogio.agendar, cancelar: relogio.cancelar });
  p.onAdStart = () => falso.log.push(['onAdStart']);
  p.onAdEnd = () => falso.log.push(['onAdEnd']);
  return { p, falso, relogio };
}

/** Poki ja pronto, com o loading enviado. */
async function montarPronto(opcoesSdk) {
  const m = montar(opcoesSdk);
  await m.p.init();
  assert.equal(m.p.sdkPronto, true);
  m.p.gameLoadingFinished();
  return m;
}

/**
 * Estado de uma promessa sem esperar por ela.
 * @param {Promise<any>} promessa
 */
function espiar(promessa) {
  const e = { feito: false, valor: /** @type {any} */ (undefined) };
  promessa.then((v) => { e.feito = true; e.valor = v; });
  return e;
}

test('SDK ausente: init resolve, sdkPronto falso, tudo vira no-op e nada lanca', async () => {
  const relogio = criarRelogioFalso();
  for (const obterSdk of [() => undefined, () => null, () => { throw new Error('bloqueado'); }, () => ({})]) {
    const p = criarPoki({ obterSdk, agendar: relogio.agendar, cancelar: relogio.cancelar });
    let avisos = 0;
    p.onAdStart = () => { avisos++; };
    p.onAdEnd = () => { avisos++; };
    await p.init();
    assert.equal(p.sdkPronto, false);
    assert.doesNotThrow(() => {
      p.gameLoadingFinished();
      p.gameplayStart();
      p.measure('turno', 'T1', 'start');
      p.gameplayStop();
    });
    assert.equal(p.jaJogou, true);
    assert.equal(await p.rewardedBreak(), false);
    assert.equal(await p.commercialBreak(), false);
    assert.equal(avisos, 0);
    assert.equal(p.emAnuncio, false);
  }
  assert.equal(relogio.timersPendentes(), 0);
});

test('init pendurado: resolve no prazo de 4000 ms com sdkPronto falso; a resposta tardia liga depois', async () => {
  const { p, falso, relogio } = montar({ init: 'pendura' });
  const e = espiar(p.init());
  await esvaziar();
  relogio.avancar(3999);
  await esvaziar();
  assert.equal(e.feito, false);
  relogio.avancar(1);
  await esvaziar();
  assert.equal(e.feito, true);
  assert.equal(p.sdkPronto, false);

  // o jogo segue sem o SDK: nada chega a ele
  p.gameLoadingFinished();
  p.gameplayStart();
  p.measure('turno', 'T1', 'start');
  assert.deepEqual(falso.nomes(), ['init']);
  assert.equal(await p.rewardedBreak(), false);
  assert.equal(await p.commercialBreak(), false);

  // a resposta chega tarde: liga e envia o que ficou pendente, na ordem certa
  falso.resolverInit();
  await esvaziar();
  assert.equal(p.sdkPronto, true);
  assert.deepEqual(falso.log, [
    ['init'], ['gameLoadingFinished'], ['gameplayStart'], ['measure', 'turno', 'T1', 'start'],
  ]);
  // e dali em diante funciona normal
  p.gameplayStop();
  assert.deepEqual(falso.log[falso.log.length - 1], ['gameplayStop']);
});

test('init pendurado com start e stop antes da resposta: o SDK nao ve o par', async () => {
  const { p, falso, relogio } = montar({ init: 'pendura' });
  p.init();
  relogio.avancar(4000);
  await esvaziar();
  p.gameLoadingFinished();
  p.gameplayStart();
  p.gameplayStop();
  falso.resolverInit();
  await esvaziar();
  assert.deepEqual(falso.nomes(), ['init', 'gameLoadingFinished']);
});

test('init que rejeita conta como resposta: sdkPronto verdadeiro, sem esperar o prazo', async () => {
  const { p, relogio } = montar({ init: 'rejeita' });
  const e = espiar(p.init());
  await esvaziar();
  assert.equal(e.feito, true);
  assert.equal(p.sdkPronto, true);
  assert.equal(relogio.timersPendentes(), 0); // o prazo foi cancelado
});

test('init com excecao sincrona: segue sem SDK', async () => {
  const { p } = montar({ init: 'lanca' });
  await p.init();
  assert.equal(p.sdkPronto, false);
});

test('init e idempotente', async () => {
  const { p, falso } = montar();
  const a = p.init();
  const b = p.init();
  assert.equal(a, b);
  await a;
  assert.equal(falso.contar('init'), 1);
});

test('rewarded so premia com === true', async () => {
  const casos = [
    [{ valor: true }, true],
    [{ valor: 'true' }, false],
    [{ valor: 1 }, false],
    [{ valor: {} }, false],
    [{ valor: null }, false],
    [{ valor: undefined }, false],
    [{ valor: false }, false],
    ['rejeita', false],
    ['lanca', false],
  ];
  for (const [modo, esperado] of casos) {
    const { p, falso } = await montarPronto({ anuncio: /** @type {any} */ (modo) });
    const r = await p.rewardedBreak();
    assert.equal(r, esperado, JSON.stringify(modo));
    assert.equal(p.emAnuncio, false);
    assert.equal(falso.contar('onAdStart'), 1, JSON.stringify(modo));
    assert.equal(falso.contar('onAdEnd'), 1, JSON.stringify(modo));
  }
});

test('rewarded pendurado: false no prazo de 45 s, e a resposta tardia e ignorada', async () => {
  const { p, falso, relogio } = await montarPronto({ anuncio: 'pendura' });
  const e = espiar(p.rewardedBreak('small'));
  await esvaziar();
  assert.equal(p.emAnuncio, true);
  relogio.avancar(PRAZOS_PADRAO.intervalo - 1);
  await esvaziar();
  assert.equal(e.feito, false);
  relogio.avancar(1);
  await esvaziar();
  assert.equal(e.feito, true);
  assert.equal(e.valor, false);
  assert.equal(p.emAnuncio, false);
  falso.resolverAnuncio(true);
  await esvaziar();
  assert.equal(e.valor, false);
  const args = falso.log.find((x) => x[0] === 'rewardedBreak');
  assert.equal(args[1].size, 'small');
  assert.equal(typeof args[1].onStart, 'function', 'o onStart vai ao SDK junto com o tamanho');
});

test('anuncio que comecou (onStart) nao vence no prazo de 45 s: espera a resposta real, com teto de 180 s', async () => {
  // rewarded com tamanho: { size, onStart }; o true que chega depois de 45 s premia
  {
    const { p, falso, relogio } = await montarPronto({ anuncio: 'pendura' });
    const e = espiar(p.rewardedBreak('medium'));
    await esvaziar();
    const { onStart } = falso.log.find((x) => x[0] === 'rewardedBreak')[1];
    relogio.avancar(10000);
    onStart();
    relogio.avancar(PRAZOS_PADRAO.intervalo + 5000);
    await esvaziar();
    assert.equal(e.feito, false, 'o video esta na tela: o prazo curto nao vale mais');
    assert.equal(p.emAnuncio, true, 'nada volta por baixo do anuncio');
    assert.equal(falso.contar('onAdEnd'), 0);
    falso.resolverAnuncio(true);
    await esvaziar();
    assert.equal(e.valor, true, 'o true que chegou depois de 45 s premia');
    assert.equal(p.emAnuncio, false);
    assert.equal(relogio.timersPendentes(), 0);
  }
  // rewarded sem tamanho: o onStart vai como argumento; o teto de 180 s conta do onStart
  {
    const { p, falso, relogio } = await montarPronto({ anuncio: 'pendura' });
    const e = espiar(p.rewardedBreak());
    await esvaziar();
    const onStart = falso.log.find((x) => x[0] === 'rewardedBreak')[1];
    assert.equal(typeof onStart, 'function');
    relogio.avancar(2000);
    onStart();
    onStart(); // repetido: nao rearma
    relogio.avancar(PRAZOS_PADRAO.aposInicio - 1);
    await esvaziar();
    assert.equal(e.feito, false);
    relogio.avancar(1);
    await esvaziar();
    assert.equal(e.feito, true);
    assert.equal(e.valor, false, 'no teto de seguranca, sem premio');
    assert.equal(p.emAnuncio, false);
  }
  // commercialBreak: o onStart vai como argumento e segura o prazo curto
  {
    const { p, falso, relogio } = await montarPronto({ anuncio: 'pendura' });
    p.gameplayStart();
    const e = espiar(p.commercialBreak());
    await esvaziar();
    const onStart = falso.log.find((x) => x[0] === 'commercialBreak')[1];
    assert.equal(typeof onStart, 'function');
    onStart();
    relogio.avancar(PRAZOS_PADRAO.intervalo * 2);
    await esvaziar();
    assert.equal(e.feito, false);
    assert.equal(p.emAnuncio, true);
    falso.resolverAnuncio();
    await esvaziar();
    assert.equal(e.valor, true);
    assert.equal(p.emAnuncio, false);
  }
  // onStart depois do prazo curto vencido nao reabre nada
  {
    const { p, falso, relogio } = await montarPronto({ anuncio: 'pendura' });
    const e = espiar(p.rewardedBreak());
    await esvaziar();
    const onStart = falso.log.find((x) => x[0] === 'rewardedBreak')[1];
    relogio.avancar(PRAZOS_PADRAO.intervalo);
    await esvaziar();
    assert.equal(e.valor, false);
    onStart();
    assert.equal(relogio.timersPendentes(), 0);
    assert.equal(p.emAnuncio, false);
  }
});

test('ordem no anuncio: gameplayStop, onAdStart, SDK, onAdEnd (commercial e rewarded)', async () => {
  for (const tipo of ['commercialBreak', 'rewardedBreak']) {
    const { p, falso } = await montarPronto({ anuncio: 'pendura' });
    p.gameplayStart();
    falso.log.length = 0;
    const promessa = tipo === 'commercialBreak' ? p.commercialBreak() : p.rewardedBreak();
    // gameplayStop, mudo e pedido saem na hora, antes de qualquer await
    assert.deepEqual(falso.nomes(), ['gameplayStop', 'onAdStart', tipo]);
    falso.resolverAnuncio(true);
    const r = await promessa;
    assert.deepEqual(falso.nomes(), ['gameplayStop', 'onAdStart', tipo, 'onAdEnd'], tipo);
    assert.equal(r, true);
    assert.equal(p.jogando, false); // quem volta ao jogo chama gameplayStart de novo
  }
});

test('nada chega ao SDK durante o intervalo', async () => {
  const { p, falso, relogio } = await montarPronto({ anuncio: 'pendura' });
  p.gameplayStart();
  const e = espiar(p.commercialBreak());
  assert.equal(p.emAnuncio, true);
  const antes = falso.log.length;
  p.gameplayStart();
  p.measure('turno', 'T4', 'start');
  p.gameplayStop();
  assert.equal(await p.rewardedBreak(), false);
  assert.equal(await p.commercialBreak(), false);
  assert.equal(falso.log.length, antes);
  assert.equal(p.jogando, false);
  // prazo de 45 s tambem vale para o commercial
  relogio.avancar(PRAZOS_PADRAO.intervalo);
  await esvaziar();
  assert.equal(e.feito, true);
  assert.equal(p.emAnuncio, false);
  assert.deepEqual(falso.nomes().slice(antes), ['onAdEnd']);
});

test('um onAdStart que lanca nao impede o anuncio nem o onAdEnd', async () => {
  const { p, falso } = await montarPronto({ anuncio: { valor: true } });
  p.onAdStart = () => { throw new Error('audio quebrou'); };
  assert.equal(await p.rewardedBreak(), true);
  assert.equal(falso.contar('onAdEnd'), 1);
  assert.equal(p.emAnuncio, false);
});

test('loading uma vez so', async () => {
  const { p, falso } = await montarPronto();
  p.gameLoadingFinished();
  p.gameLoadingFinished();
  p.gameplayStart();
  assert.equal(falso.contar('gameLoadingFinished'), 1);
});

test('gameplayStart antes do loading emite o loading antes', async () => {
  const { p, falso } = montar();
  await p.init();
  p.gameplayStart();
  p.gameLoadingFinished();
  assert.deepEqual(falso.nomes(), ['init', 'gameLoadingFinished', 'gameplayStart']);
});

test('gameplayStart e gameplayStop sao idempotentes e alternam no SDK', async () => {
  const { p, falso } = await montarPronto();
  p.gameplayStop(); // stop sem start: nada
  p.gameplayStart();
  p.gameplayStart();
  p.gameplayStop();
  p.gameplayStop();
  p.gameplayStart();
  assert.deepEqual(falso.nomes(), ['init', 'gameLoadingFinished', 'gameplayStart', 'gameplayStop', 'gameplayStart']);
});

test('commercialBreak recusado sem jaJogou; depois do primeiro start passa', async () => {
  const { p, falso } = await montarPronto();
  assert.equal(p.jaJogou, false);
  assert.equal(await p.commercialBreak(), false);
  assert.equal(falso.contar('commercialBreak'), 0);
  assert.equal(falso.contar('onAdStart'), 0);
  p.gameplayStart();
  p.gameplayStop();
  assert.equal(p.jaJogou, true);
  assert.equal(await p.commercialBreak(), true);
  assert.equal(falso.contar('commercialBreak'), 1);
});

test('measure troca / e ^ por -, e converte para texto', async () => {
  const { p, falso } = await montarPronto();
  p.measure('turno/x', 'T^1', 'a/b^c');
  p.measure('erro', /** @type {any} */ (undefined), /** @type {any} */ (7));
  assert.deepEqual(falso.log.filter((e) => e[0] === 'measure'), [
    ['measure', 'turno-x', 'T-1', 'a-b-c'],
    ['measure', 'erro', '', '7'],
  ]);
});

test('measure antes do loading espera por ele', async () => {
  const { p, falso } = montar();
  await p.init();
  p.measure('carimbo', 'primeiro', 'lt2');
  assert.equal(falso.contar('measure'), 0);
  p.gameLoadingFinished();
  assert.deepEqual(falso.nomes(), ['init', 'gameLoadingFinished', 'measure']);
});

test('getDeviceInfo nao atrasa o init e preenche dispositivo', async () => {
  const { p, falso } = montar({ info: { category: 'mobile' } });
  await p.init();
  await esvaziar();
  assert.equal(falso.contar('getDeviceInfo'), 1);
  assert.deepEqual(p.dispositivo, { category: 'mobile' });
});

test('instancia global existe e, sem PokiSDK no Node, resolve sem SDK', async () => {
  assert.equal(typeof pokiGlobal.init, 'function');
  await pokiGlobal.init();
  assert.equal(pokiGlobal.sdkPronto, false);
  assert.equal(await pokiGlobal.rewardedBreak(), false);
});

test('openExternalLink usa o SDK quando ele existe e devolve true', async () => {
  const { p, falso } = await montarPronto();
  const abertos = [];
  falso.sdk.openExternalLink = (u) => { falso.log.push(['openExternalLink', u]); abertos.push(u); };
  assert.equal(p.openExternalLink('https://barberbattle.io/privacidade'), true);
  assert.deepEqual(abertos, ['https://barberbattle.io/privacidade']);
});

test('openExternalLink sem SDK devolve false e nao lanca', () => {
  const p = criarPoki({ obterSdk: () => null });
  assert.equal(p.openExternalLink('https://barberbattle.io/privacidade'), false);
  const q = criarPoki({ obterSdk: () => ({ openExternalLink() { throw new Error('quebrado'); } }) });
  assert.equal(q.openExternalLink('https://barberbattle.io/privacidade'), false);
});

test('idioma devolve a string do SDK em minusculas, ou vazio sem SDK ou com erro', () => {
  const p = criarPoki({ obterSdk: () => ({ getLanguage: () => 'PT' }) });
  assert.equal(p.idioma(), 'pt');
  assert.equal(criarPoki({ obterSdk: () => null }).idioma(), '');
  assert.equal(criarPoki({ obterSdk: () => ({ getLanguage: () => 7 }) }).idioma(), '');
  assert.equal(criarPoki({ obterSdk: () => ({ getLanguage() { throw new Error('x'); } }) }).idioma(), '');
});
