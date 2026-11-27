'use strict';
// Testes ponta a ponta da interface (Chromium/Playwright), apenas com dados fictícios.
// O endpoint do Apps Script é interceptado: nenhuma requisição sai da máquina.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const SITE = path.resolve(__dirname, '..', '..', 'site');
const ENDPOINT = 'https://script.google.com/macros/s/AKfyTESTE_FICTICIO/exec';
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.pdf': 'application/pdf', '.txt': 'text/plain' };

let servidor, base, navegador;

test.before(async () => {
  servidor = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const arq = path.join(SITE, p);
    if (!arq.startsWith(SITE) || !fs.existsSync(arq)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream' });
    fs.createReadStream(arq).pipe(res);
  });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + servidor.address().port;
  navegador = await chromium.launch();
});
test.after(async () => { await navegador.close(); servidor.close(); });

/**
 * Abre uma página com configuração substituída e endpoint simulado.
 * resposta: função(corpo, n) -> { status, body } | 'abortar' | Promise.
 */
async function abrir(opcoes) {
  const o = Object.assign({ caminho: '/', config: {}, resposta: () => ({ status: 200, body: '{"status":"ok"}' }), contexto: {} }, opcoes);
  const ctx = await navegador.newContext(Object.assign({ acceptDownloads: true }, o.contexto));
  const page = await ctx.newPage();
  const envios = [];
  const externas = [];
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  page.on('request', (r) => { if (!r.url().startsWith(base)) externas.push(r.method() + ' ' + r.url()); });
  const pre = o.caminho.startsWith('/pre-teste');
  await page.route('**/config.js', async (route) => {
    const resp = await route.fetch();
    let txt = await resp.text();
    const cfg = Object.assign({ endpoint: ENDPOINT }, o.config);
    txt += '\nObject.assign(window.IDCGT_CONFIG, ' + JSON.stringify(cfg) + ');';
    await route.fulfill({ response: resp, body: txt });
  });
  await page.route('https://script.google.com/**', async (route) => {
    const req = route.request();
    envios.push({ corpo: JSON.parse(req.postData()), headers: req.headers(), metodo: req.method(), url: new URL(req.url()) });
    const r = await o.resposta(envios[envios.length - 1].corpo, envios.length);
    if (r === 'abortar') return route.abort('failed');
    await route.fulfill({ status: r.status, contentType: 'application/json', body: r.body, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await page.goto(base + o.caminho);
  return { page, ctx, envios, externas, erros, pre };
}

async function consentir(page) {
  await page.click('text=Ler o TCLE');
  await page.click('#btn-concordo');
  await page.waitForSelector('h1:has-text("Perfil")');
}
async function titulo(page) { return (await page.textContent('h1')).trim(); }
async function ateRevisao(page) {
  for (let i = 0; i < 10 && (await titulo(page)) !== 'Revisão das respostas'; i++) await page.click('#btn-proximo');
  assert.equal(await titulo(page), 'Revisão das respostas');
}
async function etapasVisitadas(page) {
  const vistos = [];
  for (let i = 0; i < 10; i++) {
    const t = await titulo(page);
    if (t === 'Revisão das respostas') break;
    vistos.push(t);
    await page.click('#btn-proximo');
  }
  return vistos;
}

test('consentimento: TCLE completo e PDF disponíveis antes da decisão', async () => {
  const { page, ctx, externas } = await abrir();
  await page.click('text=Ler o TCLE');
  assert.equal(await titulo(page), 'Consentimento');
  const termo = await page.textContent('.termo');
  for (const trecho of ['Objetivo e participação', 'Riscos e medidas de proteção', 'Retirada e exclusão da resposta', 'cep_chs@unb.br', '[INSERIR NÚMERO E DATA ANTES DA PUBLICAÇÃO]']) {
    assert.ok(termo.includes(trecho), trecho);
  }
  const href = await page.getAttribute('a:has-text("Baixar TCLE em PDF")', 'href');
  const pdf = await page.request.get(base + '/' + href);
  assert.equal(pdf.status(), 200);
  assert.equal((await pdf.body()).subarray(0, 4).toString(), '%PDF');
  assert.deepEqual(externas, []);
  await ctx.close();
});

test('recusa: "Não concordo" encerra sem transmissão e não permite abrir o questionário', async () => {
  const { page, ctx, envios, externas } = await abrir();
  await page.click('text=Ler o TCLE');
  await page.click('#btn-nao-concordo');
  assert.equal(await titulo(page), 'Participação não iniciada');
  assert.ok((await page.textContent('main')).includes('nenhuma resposta foi transmitida'));
  await page.evaluate(() => { location.hash = '#/questionario/1'; });
  await page.waitForTimeout(100);
  assert.equal(await titulo(page), 'Atividade encerrada');
  await page.evaluate(() => { location.hash = '#/consentimento'; });
  await page.waitForTimeout(100);
  assert.notEqual(await titulo(page), 'Consentimento');
  assert.equal(envios.length, 0);
  assert.deepEqual(externas, []);
  await ctx.close();
});

test('acesso direto ao questionário sem consentimento volta ao início', async () => {
  const { page, ctx } = await abrir({ caminho: '/#/questionario/2' });
  assert.equal(await titulo(page), 'Pesquisa sobre competências e práticas organizacionais na RBCIP');
  await page.goto(base + '/#/revisao');
  assert.notEqual(await titulo(page), 'Revisão das respostas');
  await ctx.close();
});

test('facultatividade: envio sem nenhuma resposta grava concluido=1 e 41 vazios', async () => {
  const { page, ctx, envios, externas } = await abrir();
  await consentir(page);
  await ateRevisao(page);
  assert.equal(await page.locator('dd.vazio').count(), 41 - 10); // bloco gerencial não exibido
  assert.deepEqual(externas, [], 'nada transmitido antes da confirmação');
  await page.click('#btn-enviar');
  await page.waitForSelector('h1:has-text("Envio confirmado")');
  assert.equal(envios.length, 1);
  const c = envios[0].corpo;
  assert.equal(Object.keys(c).length, 42);
  assert.equal(c.concluido, 1);
  assert.ok(Object.keys(c).filter((k) => k !== 'concluido').every((k) => c[k] === null));
  await ctx.close();
});

test('Q08: somente "Sim" exibe Q27–Q34; 0, 9 e vazio ocultam; troca limpa o bloco', async () => {
  const { page, ctx, envios } = await abrir();
  await consentir(page);
  // vazio
  assert.ok(!(await etapasVisitadas(page)).includes('Competências gerenciais'));
  for (const [id, exibe] of [['#Q08-0', false], ['#Q08-2', false], ['#Q08-1', true]]) {
    await page.click('button:has-text("Alterar") >> nth=0');
    await page.check(id);
    assert.equal((await etapasVisitadas(page)).includes('Competências gerenciais'), exibe, id);
  }
  // Responde Q27 e Q31a, depois muda Q08 para "Prefiro não informar".
  await page.click('button[aria-label="Alterar respostas: Competências gerenciais"]');
  await page.check('#Q27-4');
  await page.check('#Q31a-1');
  await page.click('button:has-text("Anterior")');
  await page.click('button:has-text("Anterior")');
  await page.click('button:has-text("Anterior")');
  assert.equal(await titulo(page), 'Perfil');
  await page.check('#Q08-2');
  assert.ok((await page.textContent('#anuncio')) !== null);
  await ateRevisao(page);
  assert.ok((await page.textContent('main')).includes('não foi exibido, conforme a resposta à Q08'));
  // volta para Sim: respostas anteriores não reaparecem
  await page.click('button:has-text("Alterar") >> nth=0');
  await page.check('#Q08-1');
  await page.click('#btn-proximo'); await page.click('#btn-proximo'); await page.click('#btn-proximo');
  assert.equal(await titulo(page), 'Competências gerenciais');
  assert.equal(await page.isChecked('#Q27-4'), false);
  await page.click('button:has-text("Anterior")'); await page.click('button:has-text("Anterior")'); await page.click('button:has-text("Anterior")');
  await page.check('#Q08-0');
  await ateRevisao(page);
  await page.click('#btn-enviar');
  await page.waitForSelector('h1:has-text("Envio confirmado")');
  const c = envios[0].corpo;
  assert.equal(c.Q08, 0);
  for (const g of ['Q27', 'Q28', 'Q29a', 'Q29b', 'Q30', 'Q31a', 'Q31b', 'Q32', 'Q33', 'Q34']) assert.equal(c[g], null, g);
  await ctx.close();
});

test('respostas: valores tipados, limpar resposta, texto com caracteres especiais', async () => {
  const { page, ctx, envios } = await abrir();
  await consentir(page);
  await page.check('#Q01-0');
  await page.check('#Q03-3');
  await page.check('#Q08-1');
  await page.check('#Q02-1');
  await page.click('button[aria-label="Limpar resposta da Q02"]');
  await page.click('#btn-proximo');
  await page.check('#Q09-0');   // 1 — Nunca
  await page.check('#Q12-4');   // 5 — Sempre
  await page.click('#btn-proximo');
  await page.check('#Q19-5');   // 9 — NSA
  await page.check('#Q20-2');
  await page.click('#btn-proximo');
  await page.check('#Q29b-1');
  await page.click('#btn-proximo');
  const especial = 'Acentuação ç ã é; "aspas" <b>tag</b> =SOMA(A1) 🙂\nsegunda linha';
  await page.fill('#txt-Q35', especial);
  await page.fill('#txt-Q36', '     ');
  await page.click('#btn-proximo');
  assert.equal(await titulo(page), 'Revisão das respostas');
  assert.ok((await page.innerHTML('main')).includes('&lt;b&gt;tag&lt;/b&gt;'), 'texto exibido escapado');
  await page.click('#btn-enviar');
  await page.waitForSelector('h1:has-text("Envio confirmado")');
  const c = envios[0].corpo;
  assert.equal(c.Q01, 'Mulher');
  assert.equal(c.Q02, null);
  assert.equal(c.Q03, 'Mestrado');
  assert.equal(c.Q08, 1);
  assert.equal(c.Q09, 1);
  assert.equal(c.Q12, 5);
  assert.equal(c.Q19, 9);
  assert.equal(c.Q20, 3);
  assert.equal(c.Q29b, 2);
  assert.equal(c.Q35, especial);
  assert.equal(c.Q36, null);
  await ctx.close();
});

test('envio único: duplo clique gera uma só requisição e o botão fica bloqueado', async () => {
  const { page, ctx, envios } = await abrir({ resposta: () => new Promise((r) => setTimeout(() => r({ status: 200, body: '{"status":"ok"}' }), 800)) });
  await consentir(page);
  await ateRevisao(page);
  await page.dblclick('#btn-enviar');
  await page.click('#btn-enviar', { force: true }).catch(() => {});
  assert.equal(await page.isDisabled('#btn-enviar'), true);
  assert.equal(await page.getAttribute('#btn-enviar', 'aria-busy'), 'true');
  await page.waitForSelector('h1:has-text("Envio confirmado")');
  assert.equal(envios.length, 1);
  // Voltar no histórico não permite reenviar.
  await page.goBack();
  await page.waitForTimeout(150);
  await page.evaluate(() => { location.hash = '#/revisao'; });
  await page.waitForTimeout(150);
  assert.equal(await titulo(page), 'Envio confirmado');
  assert.equal(envios.length, 1);
  await ctx.close();
});

test('falha de rede e erro do servidor: mensagem de erro, nada considerado enviado, nova tentativa funciona', async () => {
  const { page, ctx, envios } = await abrir({ resposta: (corpo, n) => (n === 1 ? 'abortar' : n === 2 ? { status: 200, body: '{"status":"erro","tipo":"validacao"}' } : { status: 200, body: '{"status":"ok"}' }) });
  await consentir(page);
  await ateRevisao(page);
  await page.click('#btn-enviar');
  await page.waitForSelector('#erro-envio:not([hidden])');
  assert.ok((await page.textContent('#erro-envio')).includes('não devem ser consideradas recebidas'));
  assert.equal(await titulo(page), 'Revisão das respostas');
  await page.click('#btn-enviar');
  await page.waitForSelector('#erro-envio:not([hidden])');
  await page.click('#btn-enviar');
  await page.waitForSelector('h1:has-text("Envio confirmado")');
  assert.equal(envios.length, 3);
  const codigos = envios.map((e) => e.url.searchParams.get('envio'));
  assert.ok(codigos.every((c) => c === codigos[0]), 'novas tentativas do mesmo envio reaproveitam o código');
  await ctx.close();
});

test('requisição: POST text/plain, sem credenciais, sem referer e sem identificadores', async () => {
  const { page, ctx, envios } = await abrir();
  await consentir(page);
  await ateRevisao(page);
  await page.click('#btn-enviar');
  await page.waitForSelector('h1:has-text("Envio confirmado")');
  const e = envios[0];
  assert.equal(e.metodo, 'POST');
  assert.ok(e.headers['content-type'].startsWith('text/plain'));
  assert.equal(e.headers.cookie, undefined);
  assert.equal(e.headers.referer, undefined);
  const esperado = ['concluido', 'Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07', 'Q08', 'Q09', 'Q10', 'Q11', 'Q12', 'Q13', 'Q14', 'Q15', 'Q16', 'Q17', 'Q18',
    'Q19', 'Q20', 'Q21', 'Q22', 'Q23', 'Q24', 'Q25', 'Q26', 'Q27', 'Q28', 'Q29a', 'Q29b', 'Q30', 'Q31a', 'Q31b', 'Q32', 'Q33', 'Q34', 'Q35', 'Q36', 'Q37', 'Q38', 'Q39'];
  assert.deepEqual(Object.keys(e.corpo), esperado, 'somente concluido e Q01–Q39, sem timestamp ou identificador');
  assert.equal(e.url.origin + e.url.pathname, ENDPOINT);
  assert.deepEqual([...e.url.searchParams.keys()], ['envio'], 'somente o código temporário no endereço');
  assert.match(e.url.searchParams.get('envio'), /^[0-9a-f]{32}$/);
  assert.ok(!JSON.stringify(e.corpo).includes(e.url.searchParams.get('envio')), 'código fora do corpo');
  await ctx.close();
});

test('feedback: local, opcional, no máximo 3 temas por bloco, sem Q19–Q26, sem nova transmissão; PDF no dispositivo', async () => {
  const { page, ctx, envios, externas } = await abrir();
  await consentir(page);
  await page.check('#Q08-1');
  await page.click('#btn-proximo');
  for (const [cod, idx] of [['Q09', 0], ['Q10', 1], ['Q11', 2], ['Q12', 0], ['Q14', 1], ['Q16', 4]]) await page.check('#' + cod + '-' + idx);
  await page.click('#btn-proximo');
  for (let n = 19; n <= 26; n++) await page.check('#Q' + n + '-0');
  await page.click('#btn-proximo');
  await page.check('#Q34-0');
  await ateRevisao(page);
  await page.click('#btn-enviar');
  await page.waitForSelector('h1:has-text("Envio confirmado")');
  const nAntes = externas.length;
  const corpoEnviado = JSON.stringify(envios[0].corpo);
  assert.ok(!corpoEnviado.includes('Comunicação'), 'tema não é enviado');
  await page.click('#btn-ver-resumo');
  const txt = await page.textContent('#devolutiva');
  const itens = await page.$$eval('#devolutiva ul li', (l) => l.map((x) => x.textContent));
  assert.equal(itens.length, 4); // 3 transversais + 1 gerencial
  assert.ok(!/Q19|Q2[0-6]/.test(txt));
  assert.ok(txt.includes('Gestão de conflitos'));
  assert.ok(!txt.includes('Sugestões opcionais de aprendizagem'), 'nenhum curso conferido');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#btn-pdf')]);
  assert.equal(download.suggestedFilename(), 'resumo-idcgt-ap.pdf');
  assert.ok(download.url().startsWith('blob:'), 'PDF produzido no próprio dispositivo');
  const arq = await download.path();
  assert.equal(fs.readFileSync(arq).subarray(0, 5).toString(), '%PDF-');
  await page.click('#btn-encerrar');
  assert.equal(await titulo(page), 'Participação concluída');
  assert.equal(await page.locator('#devolutiva').count(), 0);
  assert.equal(externas.length, nAntes, 'nenhuma requisição após o envio');
  assert.equal(envios.length, 1);
  await page.goBack();
  await page.waitForTimeout(150);
  assert.equal(await page.locator('#devolutiva').count(), 0, 'visualização apagada');
  await ctx.close();
});

test('cancelamento na revisão apaga as respostas e não transmite', async () => {
  const { page, ctx, envios, externas } = await abrir();
  await consentir(page);
  await page.check('#Q01-1');
  await ateRevisao(page);
  await page.click('#btn-cancelar');
  await page.click('#btn-confirmar-cancelar');
  assert.equal(await titulo(page), 'Participação cancelada');
  assert.equal(envios.length, 0);
  assert.deepEqual(externas, []);
  await ctx.close();
});

test('privacidade no navegador: sem cookies, localStorage, sessionStorage ou IndexedDB', async () => {
  const { page, ctx } = await abrir();
  await consentir(page);
  await page.check('#Q01-0');
  await ateRevisao(page);
  await page.click('#btn-enviar');
  await page.waitForSelector('h1:has-text("Envio confirmado")');
  const armazenamento = await page.evaluate(async () => ({
    local: localStorage.length,
    sessao: sessionStorage.length,
    cookie: document.cookie,
    idb: indexedDB.databases ? (await indexedDB.databases()).length : 0
  }));
  assert.deepEqual(armazenamento, { local: 0, sessao: 0, cookie: '', idb: 0 });
  assert.deepEqual(await ctx.cookies(), []);
  const semComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const codigo = ['app.js', 'feedback.js', 'validacao.js', 'pdf.js', 'config.js'].map((a) => semComentarios(fs.readFileSync(path.join(SITE, 'assets/js', a), 'utf8'))).join('\n');
  for (const api of ['localStorage', 'sessionStorage', 'document.cookie', 'indexedDB', 'geolocation', 'navigator.userAgent', 'Date.now', 'new Date']) {
    assert.ok(!codigo.includes(api), api);
  }
  await ctx.close();
});

test('produção sem parecer ou endpoint: "Coleta não liberada" e sem acesso ao consentimento', async () => {
  for (const config of [{ ambiente: 'producao' }, { ambiente: 'producao', parecer: 'Parecer nº 1 de 01/12/2026', endpoint: '' }]) {
    const { page, ctx } = await abrir({ config });
    assert.ok((await page.textContent('main')).includes('A coleta ainda não foi liberada'));
    assert.equal(await page.locator('text=Ler o TCLE').count(), 0);
    await page.evaluate(() => { location.hash = '#/consentimento'; });
    await page.waitForTimeout(100);
    assert.notEqual(await titulo(page), 'Consentimento');
    assert.equal(await page.isHidden('#aviso-ambiente'), true);
    await ctx.close();
  }
  const ok = await abrir({ config: { ambiente: 'producao', parecer: 'Parecer nº 1 de 01/12/2026' } });
  assert.equal(await ok.page.locator('text=Ler o TCLE').count(), 1);
  await ok.page.click('text=Ler o TCLE');
  assert.ok((await ok.page.textContent('.termo')).includes('Parecer nº 1 de 01/12/2026'));
  await ok.ctx.close();
});

test('pré-teste: página, TCLE e esquema próprios (55 campos) com roteiro escrito', async () => {
  const { page, ctx, envios } = await abrir({ caminho: '/pre-teste/' });
  assert.equal(await titulo(page), 'Pré-teste semântico e funcional do IDCGT AP');
  await page.click('text=Ler o TCLE');
  assert.ok((await page.textContent('.termo')).includes('Pré teste semântico e funcional'));
  assert.ok((await page.getAttribute('a:has-text("Baixar TCLE em PDF")', 'href')).includes('03_TCLE_PRE_TESTE.pdf'));
  await page.click('#btn-concordo');
  const etapas = await etapasVisitadas(page);
  assert.equal(etapas[etapas.length - 1], 'Observações sobre o pré-teste');
  await page.click('button[aria-label="Alterar respostas: Observações sobre o pré-teste"]');
  await page.check('#cod-P2');
  await page.fill('#txt-PT09', 'Cerca de 18 minutos.');
  await page.click('#btn-proximo');
  await page.click('#btn-enviar');
  await page.waitForSelector('h1:has-text("Envio confirmado")');
  const c = envios[0].corpo;
  assert.equal(Object.keys(c).length, 55);
  assert.equal(c.codigo_pre_teste, 'P2');
  assert.equal(c.PT09, 'Cerca de 18 minutos.');
  await ctx.close();
});

for (const [nome, opcoes] of [['celular (iPhone 13)', devices['iPhone 13']], ['celular (Pixel 7)', devices['Pixel 7']], ['tablet (iPad Mini)', devices['iPad Mini']], ['computador 1366x768', { viewport: { width: 1366, height: 768 } }], ['tela estreita 320px', { viewport: { width: 320, height: 640 } }]]) {
  test('dispositivo ' + nome + ': fluxo completo sem rolagem horizontal', async () => {
    const ctxOpts = Object.assign({}, opcoes);
    delete ctxOpts.defaultBrowserType;
    const { page, ctx, envios, erros } = await abrir({ contexto: ctxOpts });
    const semRolagem = async () => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'rolagem horizontal em ' + (await titulo(page)));
    await semRolagem();
    await consentir(page);
    await page.check('#Q08-1');
    for (let i = 0; i < 6 && (await titulo(page)) !== 'Revisão das respostas'; i++) { await semRolagem(); await page.click('#btn-proximo'); }
    await semRolagem();
    await page.click('#btn-enviar');
    await page.waitForSelector('h1:has-text("Envio confirmado")');
    await page.click('#btn-ver-resumo');
    await semRolagem();
    assert.equal(envios.length, 1);
    assert.deepEqual(erros, []);
    await ctx.close();
  });
}

test('teclado: navegação por Tab, seleção por setas e foco no título a cada tela', async () => {
  const { page, ctx, envios } = await abrir();
  await page.keyboard.press('Tab'); // link "Ir para o conteúdo"
  await page.focus('a:has-text("Ler o TCLE")');
  await page.keyboard.press('Enter');
  await page.waitForSelector('h1:has-text("Consentimento")');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'titulo-tela');
  await page.focus('#btn-concordo');
  await page.keyboard.press('Enter');
  await page.waitForSelector('h1:has-text("Perfil")');
  await page.focus('#Q01-0');
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowDown');
  assert.equal(await page.isChecked('#Q01-1'), true);
  const rotulos = await page.$$eval('input[type=radio]', (l) => l.every((i) => !!document.querySelector('label[for="' + i.id + '"]')));
  assert.ok(rotulos, 'todos os campos com rótulo associado');
  await ateRevisao(page);
  await page.focus('#btn-enviar');
  await page.keyboard.press('Enter');
  await page.waitForSelector('h1:has-text("Envio confirmado")');
  assert.equal(envios[0].corpo.Q01, 'Homem');
  await ctx.close();
});

test('modo demonstração (desenvolvimento sem endpoint): nenhuma requisição externa', async () => {
  const { page, ctx, envios, externas } = await abrir({ config: { endpoint: '' } });
  assert.ok((await page.textContent('#aviso-ambiente')).includes('Modo demonstração'));
  await consentir(page);
  await ateRevisao(page);
  await page.click('#btn-enviar');
  await page.waitForSelector('h1:has-text("Envio confirmado")');
  assert.equal(envios.length, 0);
  assert.deepEqual(externas, []);
  await ctx.close();
});

test('questões abertas: limite de 2.000 caracteres com contador visível', async () => {
  const { page, ctx, envios } = await abrir();
  await consentir(page);
  for (let i = 0; i < 3; i++) await page.click('#btn-proximo'); // sem Q08 = 1: 4 etapas
  assert.equal(await titulo(page), 'Questões abertas');
  for (const c of ['Q35', 'Q36', 'Q37', 'Q38', 'Q39']) {
    assert.equal(await page.getAttribute('#txt-' + c, 'maxlength'), '2000');
    assert.equal((await page.textContent('#txt-' + c + '-cont')).trim(), '0 de 2000 caracteres');
  }
  await page.fill('#txt-Q35', 'a'.repeat(2100)); // colagem acima do limite é contida pelo campo
  assert.equal((await page.inputValue('#txt-Q35')).length, 2000);
  assert.equal((await page.textContent('#txt-Q35-cont')).trim(), '2000 de 2000 caracteres');
  await page.click('#btn-proximo');
  await page.click('#btn-enviar');
  await page.waitForSelector('h1:has-text("Envio confirmado")');
  assert.equal(envios[0].corpo.Q35.length, 2000);
  await ctx.close();
});

test('código de envio: resposta alterada após falha gera código novo; nova sessão também', async () => {
  const { page, ctx, envios } = await abrir({ resposta: (corpo, n) => (n === 1 ? 'abortar' : { status: 200, body: '{"status":"ok"}' }) });
  await consentir(page);
  await page.check('#Q01-0');
  await ateRevisao(page);
  await page.click('#btn-enviar');
  await page.waitForSelector('#erro-envio:not([hidden])');
  await page.click('button[aria-label="Alterar respostas: Perfil"]');
  await page.check('#Q01-1');
  await ateRevisao(page);
  await page.click('#btn-enviar');
  await page.waitForSelector('h1:has-text("Envio confirmado")');
  const [c1, c2] = envios.map((e) => e.url.searchParams.get('envio'));
  assert.notEqual(c1, c2);
  assert.equal(envios[1].corpo.Q01, 'Homem');
  await ctx.close();
  const outra = await abrir();
  await consentir(outra.page);
  await ateRevisao(outra.page);
  await outra.page.click('#btn-enviar');
  await outra.page.waitForSelector('h1:has-text("Envio confirmado")');
  const c3 = outra.envios[0].url.searchParams.get('envio');
  assert.ok(c3 !== c1 && c3 !== c2);
  await outra.ctx.close();
});
