'use strict';
// Executa apps-script/coleta/*.gs com serviços do Google simulados.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { carregar, vazia, completa } = require('./auxiliar');

const novoCodigo = () => crypto.randomBytes(16).toString('hex');

const ARQUIVOS = ['apps-script/coleta/Instrumento.gs', 'apps-script/coleta/Validacao.gs', 'apps-script/coleta/Codigo.gs'];

function ambiente(opcoes) {
  const o = Object.assign({ modo: 'principal', ativa: 'sim', parecer: 'Parecer nº 0.000.000 de 01/12/2026', nome: 'IDCGT_AP_Coleta_Principal', abas: null, travaLivre: true }, opcoes);
  const logs = [];
  const gravacoes = [];
  const memoria = new Map(); // CacheService simulado: chave -> { valor, segundos }
  function novaAba(nome, cab) {
    const linhas = [cab.slice()];
    return {
      nome,
      linhas,
      getLastRow: () => linhas.length,
      getLastColumn: () => linhas[0].length,
      getRange: (l, c, nl, nc) => ({
        getValues: () => linhas.slice(l - 1, l - 1 + nl).map((x) => x.slice(c - 1, c - 1 + nc)),
        setValues: (v) => { gravacoes.push({ linha: l, valores: v[0].slice() }); linhas[l - 1] = v[0].slice(); }
      })
    };
  }
  let ctx;
  const globais = {
    console: { log: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')), info: (...a) => logs.push(a.join(' ')) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => ({ MODO: o.modo, PLANILHA_ID: 'ID_FICTICIO', COLETA_ATIVA: o.ativa, PARECER_FAVORAVEL: o.parecer })[k] }) },
    LockService: { getScriptLock: () => ({ tryLock: () => o.travaLivre, releaseLock: () => {} }) },
    CacheService: { getScriptCache: () => ({
      get: (k) => (memoria.has(k) ? memoria.get(k).valor : null),
      put: (k, v, seg) => { memoria.set(k, { valor: v, segundos: seg }); }
    }) },
    SpreadsheetApp: {
      openById: () => ({ getName: () => o.nome, getSheetByName: (n) => abas[n] || null }),
      flush: () => {}
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (t) => ({ texto: t, setMimeType() { return this; } })
    }
  };
  ctx = carregar(ARQUIVOS, globais);
  const esquema = (m) => ctx.idcgtEsquema(m).campos;
  const abas = o.abas ? o.abas(novaAba, esquema) : { Base_Respostas: novaAba('Base_Respostas', esquema('principal')) };
  // Sem parâmetros informados, cada chamada usa um código de envio novo (envio distinto).
  const post = (corpo, parametros) => JSON.parse(ctx.doPost({
    postData: { contents: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) },
    parameter: parametros || { envio: novoCodigo() }
  }).texto);
  return { ctx, post, abas, gravacoes, logs, memoria };
}

test('doPost: grava uma linha válida na segunda linha, nas 42 colunas, e responde só "ok"', () => {
  const a = ambiente();
  const s = completa(a.ctx, 1);
  s.Q35 = 'RESPOSTA_SIGILOSA';
  const r = a.post(s);
  assert.deepEqual(r, { status: 'ok' });
  assert.equal(a.gravacoes.length, 1);
  assert.equal(a.gravacoes[0].linha, 2);
  assert.equal(a.gravacoes[0].valores.length, 42);
  assert.equal(a.gravacoes[0].valores[0], 1);
  assert.ok(!a.logs.join('\n').includes('RESPOSTA_SIGILOSA'), 'conteúdo não pode ir para logs');
  a.post(vazia(a.ctx));
  assert.equal(a.gravacoes[1].linha, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(a.gravacoes[1].valores.slice(1))), new Array(41).fill(""));
});

test('doPost: recusa sem gravar campos extras, valores inválidos, Q08 incoerente e JSON inválido', () => {
  const a = ambiente();
  const extra = vazia(a.ctx); extra.ip = '1.2.3.4';
  const fora = vazia(a.ctx); fora.Q09 = 7;
  const tipo = vazia(a.ctx); tipo.Q09 = '3';
  const ger = vazia(a.ctx); ger.Q08 = 0; ger.Q27 = 3;
  const longo = vazia(a.ctx); longo.Q39 = 'x'.repeat(2001);
  for (const corpo of [extra, fora, tipo, ger, longo, '{nao json', '', '[]', 'x'.repeat(130000)]) {
    const r = a.post(corpo);
    assert.equal(r.status, 'erro');
    assert.equal(r.tipo, 'validacao');
    assert.equal(r.motivo, undefined, 'produção não devolve motivo');
  }
  assert.equal(a.post(vazia(a.ctx), { email: 'x' }).tipo, 'validacao');
  assert.equal(a.gravacoes.length, 0);
});

test('doPost: endpoint desativado (COLETA_ATIVA=nao) não grava', () => {
  const a = ambiente({ ativa: 'nao' });
  assert.deepEqual(a.post(vazia(a.ctx)), { status: 'erro', tipo: 'encerrada' });
  assert.equal(a.gravacoes.length, 0);
  assert.equal(JSON.parse(a.ctx.doGet().texto).recebimento, 'inativo');
});

test('doPost: produção e pré-teste exigem parecer registrado', () => {
  for (const parecer of [undefined, '', 'INSERIR_ANTES_DA_PUBLICACAO']) {
    const a = ambiente({ parecer });
    assert.equal(a.post(vazia(a.ctx)).tipo, 'indisponivel');
    assert.equal(a.gravacoes.length, 0);
  }
});

test('doPost: cabeçalho alterado ou coluna automática adicional bloqueia a gravação', () => {
  const comTimestamp = ambiente({ abas: (nova, esq) => ({ Base_Respostas: nova('Base_Respostas', esq('principal').concat(['Carimbo de data/hora'])) }) });
  assert.equal(comTimestamp.post(vazia(comTimestamp.ctx)).tipo, 'indisponivel');
  const renomeada = ambiente({ abas: (nova, esq) => { const c = esq('principal'); c[5] = 'q05'; return { Base_Respostas: nova('Base_Respostas', c) }; } });
  assert.equal(renomeada.post(vazia(renomeada.ctx)).tipo, 'indisponivel');
  const semAba = ambiente({ abas: () => ({}) });
  assert.equal(semAba.post(vazia(semAba.ctx)).tipo, 'indisponivel');
  assert.equal(comTimestamp.gravacoes.length + renomeada.gravacoes.length + semAba.gravacoes.length, 0);
});

test('separação de ambientes: desenvolvimento só grava em planilha DESENVOLVIMENTO; principal nunca nela', () => {
  const devErrado = ambiente({ modo: 'desenvolvimento', parecer: '', nome: 'IDCGT_AP_Coleta_Principal' });
  assert.equal(devErrado.post(vazia(devErrado.ctx)).tipo, 'indisponivel');
  const devCerto = ambiente({ modo: 'desenvolvimento', parecer: '', nome: 'IDCGT_AP_DESENVOLVIMENTO_Base_Respostas' });
  assert.equal(devCerto.post(vazia(devCerto.ctx)).status, 'ok');
  const prodEmDev = ambiente({ nome: 'IDCGT_AP_DESENVOLVIMENTO_Base_Respostas' });
  assert.equal(prodEmDev.post(vazia(prodEmDev.ctx)).tipo, 'indisponivel');
  // Desenvolvimento devolve o motivo (nome do campo, nunca o valor).
  const s = vazia(devCerto.ctx); s.Q09 = 8;
  assert.equal(devCerto.post(s).motivo, 'valor_invalido:Q09');
});

test('pré-teste: grava somente em Base_PreTeste e recusa o payload principal', () => {
  const pre = ambiente({ modo: 'pre_teste', nome: 'IDCGT_AP_PreTeste_Base', abas: (nova, esq) => ({ Base_PreTeste: nova('Base_PreTeste', esq('pre_teste')) }) });
  assert.equal(pre.post(vazia(pre.ctx)).tipo, 'validacao');
  const corpo = pre.ctx.idcgtMontarSubmissao({ Q09: 2 }, 'pre_teste', { codigo_pre_teste: 'P1', PT01: 'Claras.' });
  assert.equal(pre.post(JSON.parse(JSON.stringify(corpo))).status, 'ok');
  assert.equal(pre.gravacoes[0].valores.length, 55);
  // Projeto do pré-teste apontado por engano para a planilha principal:
  const engano = ambiente({ modo: 'pre_teste', nome: 'X', abas: (nova, esq) => ({ Base_Respostas: nova('Base_Respostas', esq('principal')), Base_PreTeste: nova('Base_PreTeste', esq('pre_teste')) }) });
  assert.equal(engano.post(JSON.parse(JSON.stringify(corpo))).tipo, 'indisponivel');
  // Projeto principal com o payload do pré-teste:
  const principal = ambiente();
  assert.equal(principal.post(JSON.parse(JSON.stringify(corpo))).tipo, 'validacao');
});

test('concorrência: sem obter o bloqueio, nada é gravado', () => {
  const a = ambiente({ travaLivre: false });
  assert.equal(a.post(vazia(a.ctx)).tipo, 'indisponivel');
  assert.equal(a.gravacoes.length, 0);
});

test('fórmula em texto aberto é gravada como texto', () => {
  const a = ambiente();
  const s = vazia(a.ctx); s.Q36 = '=HYPERLINK("http://exemplo")';
  a.post(s);
  assert.equal(a.gravacoes[0].valores[38], '\'=HYPERLINK("http://exemplo")');
});

test('código de envio: nova tentativa do mesmo envio não grava outra linha', () => {
  const a = ambiente();
  const codigo = novoCodigo();
  const s = completa(a.ctx, 1);
  assert.deepEqual(a.post(s, { envio: codigo }), { status: 'ok' });
  assert.deepEqual(a.post(s, { envio: codigo }), { status: 'ok' }, 'mesma resposta, sem revelar a repetição');
  assert.deepEqual(a.post(s, { envio: codigo }), { status: 'ok' });
  assert.equal(a.gravacoes.length, 1);
  // Outra pessoa com respostas idênticas (código diferente) é gravada normalmente.
  assert.deepEqual(a.post(s, { envio: novoCodigo() }), { status: 'ok' });
  assert.equal(a.gravacoes.length, 2);
});

test('código de envio: fica 10 minutos na memória temporária e nunca vai para a planilha ou logs', () => {
  const a = ambiente();
  const codigo = novoCodigo();
  a.post(vazia(a.ctx), { envio: codigo });
  const [chave, item] = [...a.memoria.entries()][0];
  assert.equal(chave, 'envio_' + codigo);
  assert.equal(item.segundos, 600);
  assert.ok(!JSON.stringify(a.gravacoes).includes(codigo));
  assert.ok(!a.logs.join('\n').includes(codigo));
});

test('código de envio: ausente, malformado, repetido ou com outros parâmetros é recusado sem gravar', () => {
  const a = ambiente();
  const codigo = novoCodigo();
  for (const parametros of [{}, { envio: '' }, { envio: 'abc' }, { envio: codigo.toUpperCase() }, { envio: codigo + '0' },
    { envio: codigo, extra: '1' }, { email: 'x@y' }, { Q01: 'Mulher' }]) {
    assert.equal(a.post(vazia(a.ctx), parametros).tipo, 'validacao', JSON.stringify(parametros));
  }
  const repetido = a.ctx.doPost({ postData: { contents: JSON.stringify(vazia(a.ctx)) }, parameter: { envio: codigo }, parameters: { envio: [codigo, codigo] } });
  assert.equal(JSON.parse(repetido.texto).tipo, 'validacao');
  assert.equal(a.gravacoes.length, 0);
  assert.equal(a.memoria.size, 0);
});

test('código de envio: falha de gravação não marca o código, e a nova tentativa grava', () => {
  let falhar = true;
  const a = ambiente({ abas: (nova, esq) => {
    const aba = nova('Base_Respostas', esq('principal'));
    const original = aba.getRange;
    aba.getRange = (l, c, nl, nc) => {
      const r = original(l, c, nl, nc);
      const setValues = r.setValues;
      r.setValues = (v) => { if (falhar) throw new Error('falha simulada'); setValues(v); };
      return r;
    };
    return { Base_Respostas: aba };
  } });
  const codigo = novoCodigo();
  assert.equal(a.post(vazia(a.ctx), { envio: codigo }).tipo, 'indisponivel');
  assert.equal(a.memoria.size, 0);
  falhar = false;
  assert.equal(a.post(vazia(a.ctx), { envio: codigo }).status, 'ok');
  assert.equal(a.gravacoes.length, 1);
});
