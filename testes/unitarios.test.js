'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const os = require('os');
const { RAIZ, carregar, vazia, completa } = require('./auxiliar');

const BASE = ['compartilhado/instrumento.js', 'compartilhado/validacao.js'];
const ctx = carregar(BASE.concat(['site/assets/js/cursos.js', 'site/assets/js/feedback.js', 'site/assets/js/pdf.js', 'apps-script/painel/Agregacao.gs']));
const J = (x) => JSON.parse(JSON.stringify(x)); // normaliza objetos do contexto vm
const I = J(ctx.IDCGT_INSTRUMENTO);
const validar = (d, m) => J(ctx.idcgtValidarSubmissao(d, m || 'principal'));

// ------------------------------------------------------------ instrumento
test('instrumento: 41 questões na ordem da matriz e 42 colunas', () => {
  assert.equal(I.itens.length, 41);
  const codigos = I.itens.map((i) => i.codigo);
  const esperado = ['Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06', 'Q07', 'Q08', 'Q09', 'Q10', 'Q11', 'Q12', 'Q13', 'Q14', 'Q15', 'Q16', 'Q17', 'Q18',
    'Q19', 'Q20', 'Q21', 'Q22', 'Q23', 'Q24', 'Q25', 'Q26', 'Q27', 'Q28', 'Q29a', 'Q29b', 'Q30', 'Q31a', 'Q31b', 'Q32', 'Q33', 'Q34',
    'Q35', 'Q36', 'Q37', 'Q38', 'Q39'];
  assert.deepEqual(codigos, esperado);
  assert.deepEqual(I.campos, ['concluido'].concat(esperado));
});

test('instrumento: escalas e condição conforme a matriz', () => {
  const item = (c) => I.itens.find((i) => i.codigo === c);
  assert.deepEqual(item('Q08').opcoes.map((o) => o.valor), [0, 1, 9]);
  for (const c of ['Q09', 'Q18', 'Q27', 'Q34']) assert.deepEqual(item(c).opcoes.map((o) => o.valor), [1, 2, 3, 4, 5]);
  for (const c of ['Q19', 'Q26']) assert.deepEqual(item(c).opcoes.map((o) => o.valor), [1, 2, 3, 4, 5, 9]);
  assert.equal(item('Q19').opcoes[5].rotulo, 'Não sei/não se aplica');
  for (const c of ctx.IDCGT_GERENCIAIS) assert.equal(item(c).condicao, 'Q08=1');
  for (const c of ['Q35', 'Q39']) assert.equal(item(c).tipo, 'texto');
  assert.ok(I.itens.filter((i) => i.bloco === 'Práticas organizacionais').every((i) => i.feedback === false));
});

test('cópias de instrumento.js e validacao.js idênticas na interface e no Apps Script', () => {
  const pares = [
    ['compartilhado/instrumento.js', ['site/assets/js/instrumento.js', 'apps-script/coleta/Instrumento.gs', 'apps-script/painel/Instrumento.gs']],
    ['compartilhado/validacao.js', ['site/assets/js/validacao.js', 'apps-script/coleta/Validacao.gs', 'apps-script/painel/Validacao.gs']]
  ];
  for (const [fonte, copias] of pares) {
    const original = fs.readFileSync(path.join(RAIZ, fonte), 'utf8');
    for (const c of copias) assert.equal(fs.readFileSync(path.join(RAIZ, c), 'utf8'), original, c);
  }
});

// -------------------------------------------------------------- validação
test('validação: submissão completa e submissão sem respostas são aceitas', () => {
  assert.deepEqual(validar(completa(ctx, 1)), { ok: true });
  assert.deepEqual(validar(completa(ctx, 0)), { ok: true });
  assert.deepEqual(validar(vazia(ctx)), { ok: true });
});

test('validação: estrutura diferente é recusada', () => {
  const extra = vazia(ctx); extra.timestamp = '2026-11-26';
  assert.equal(validar(extra).motivo, 'campo_nao_permitido');
  const email = vazia(ctx); email.email = 'x@y';
  assert.equal(validar(email).ok, false);
  const faltando = vazia(ctx); delete faltando.Q39;
  assert.equal(validar(faltando).motivo, 'campo_ausente');
  assert.equal(validar(null).ok, false);
  assert.equal(validar([]).ok, false);
  assert.equal(validar('texto').ok, false);
  const proto = JSON.parse(JSON.stringify(vazia(ctx)).replace('{', '{"__proto__":1,'));
  assert.equal(validar(proto).ok, false);
});

test('validação: concluido precisa ser 1', () => {
  for (const v of [0, '1', null, true, 2]) {
    const s = vazia(ctx); s.concluido = v;
    assert.equal(validar(s).ok, false, String(v));
  }
});

test('validação: valores fora da escala e tipos incorretos são recusados', () => {
  const casos = [['Q09', 6], ['Q09', 0], ['Q09', 9], ['Q09', '3'], ['Q09', 2.5], ['Q19', 6], ['Q19', 0], ['Q27', 9],
    ['Q08', 2], ['Q08', '1'], ['Q01', 'Outro gênero'], ['Q01', 1], ['Q03', 'mestrado'], ['Q35', 123], ['Q35', ''], ['Q35', {}]];
  for (const [campo, valor] of casos) {
    const s = completa(ctx, 1); s[campo] = valor;
    assert.equal(validar(s).ok, false, campo + '=' + JSON.stringify(valor));
  }
  const nsa = vazia(ctx); nsa.Q19 = 9; nsa.Q26 = 9;
  assert.equal(validar(nsa).ok, true);
});

test('validação: bloco gerencial preenchido sem Q08 = 1 é recusado (0, 9 e vazio)', () => {
  for (const q08 of [0, 9, null]) {
    const s = vazia(ctx); s.Q08 = q08; s.Q31a = 4;
    assert.equal(validar(s).motivo, 'bloco_gerencial_sem_q08', String(q08));
  }
  const ok = vazia(ctx); ok.Q08 = 1; ok.Q31a = 4;
  assert.equal(validar(ok).ok, true);
});

test('validação: tamanho e caracteres das respostas abertas', () => {
  const s = vazia(ctx);
  s.Q35 = 'a'.repeat(ctx.IDCGT_MAX_TEXTO);
  assert.equal(validar(s).ok, true);
  s.Q35 = 'a'.repeat(ctx.IDCGT_MAX_TEXTO + 1);
  assert.equal(validar(s).motivo, 'texto_invalido');
  s.Q35 = 'texto\u0000nulo';
  assert.equal(validar(s).ok, false);
  s.Q35 = 'Acentuação, "aspas", <script>alert(1)</script>, =SOMA(A1), emoji 🙂\nnova linha\tTab & ; DROP TABLE';
  assert.equal(validar(s).ok, true);
});

test('linha da planilha: 42 valores na ordem, vazios como "" e textos protegidos contra fórmula', () => {
  const s = vazia(ctx); s.Q01 = 'Mulher'; s.Q08 = 0; s.Q09 = 3; s.Q35 = '=IMPORTXML("http://x")'; s.Q36 = '-lista'; s.Q37 = 'normal';
  const linha = ctx.idcgtLinhaPlanilha(s, 'principal');
  assert.equal(linha.length, 42);
  assert.equal(linha[0], 1);
  assert.equal(linha[1], 'Mulher');
  assert.equal(linha[8], 0);
  assert.equal(linha[9], 3);
  assert.equal(linha[10], '');
  assert.equal(linha[37], '\'=IMPORTXML("http://x")');
  assert.equal(linha[38], "'-lista");
  assert.equal(linha[39], 'normal');
});

test('montagem no cliente: todos os campos, sem extras, gerencial limpo quando Q08 != 1', () => {
  const r = { Q08: 9, Q27: 5, Q09: 2, Q35: '   texto  \r\n ', Q36: '   ' };
  const s = ctx.idcgtMontarSubmissao(r, 'principal');
  assert.deepEqual(J(Object.keys(s)), I.campos);
  assert.equal(s.concluido, 1);
  assert.equal(s.Q27, null);
  assert.equal(s.Q35, 'texto');
  assert.equal(s.Q36, null);
  assert.equal(validar(s).ok, true);
  const vaziaCliente = ctx.idcgtMontarSubmissao({}, 'principal');
  assert.ok(Object.keys(vaziaCliente).every((k) => k === 'concluido' ? vaziaCliente[k] === 1 : vaziaCliente[k] === null));
});

test('pré-teste: esquema próprio, recusado pelo esquema principal e vice-versa', () => {
  const pre = ctx.idcgtMontarSubmissao({ Q09: 4 }, 'pre_teste', { codigo_pre_teste: 'P3', PT09: '20 minutos' });
  assert.equal(Object.keys(pre).length, 55);
  assert.equal(ctx.idcgtValidarSubmissao(pre, 'pre_teste').ok, true);
  assert.equal(ctx.idcgtValidarSubmissao(pre, 'principal').ok, false);
  assert.equal(ctx.idcgtValidarSubmissao(vazia(ctx), 'pre_teste').ok, false);
  pre.codigo_pre_teste = 'P6';
  assert.equal(ctx.idcgtValidarSubmissao(pre, 'pre_teste').ok, false);
  assert.equal(ctx.idcgtEsquema('pre_teste').aba, 'Base_PreTeste');
});

// --------------------------------------------------------------- feedback
const calc = (r, cursos) => JSON.parse(JSON.stringify(ctx.idcgtCalcularFeedback(r, cursos || ctx.IDCGT_CURSOS)));

test('feedback: no máximo três temas por bloco, menor resposta primeiro', () => {
  const r = { Q08: 1, Q09: 3, Q10: 1, Q11: 2, Q12: 3, Q13: 1, Q14: 2, Q15: 1, Q16: 3, Q17: 3, Q18: 3 };
  ctx.IDCGT_GERENCIAIS.forEach((c) => { r[c] = 2; });
  const fb = calc(r);
  assert.equal(fb.blocos.length, 2);
  for (const b of fb.blocos) assert.ok(b.temas.length <= 3);
  assert.deepEqual(fb.blocos[0].temas.map((t) => t.tema),
    ['Trabalho em equipe e cooperação', 'Conhecimento técnico e aprendizagem', 'Gestão do tempo e prazos']);
  assert.deepEqual(fb.blocos[0].temas[1].itens, ['Q13', 'Q15']);
});

test('feedback: Q19–Q26 nunca geram tema; 4 e 5 não sinalizam', () => {
  const r = { Q08: 0 };
  for (let n = 19; n <= 26; n++) r['Q' + n] = 1;
  ['Q09', 'Q10', 'Q11'].forEach((c) => { r[c] = 5; });
  r.Q12 = 4;
  const fb = calc(r);
  assert.equal(fb.algumTema, false);
  const txt = JSON.stringify(ctx.idcgtFeedbackEmLinhas(ctx.idcgtCalcularFeedback(r, [])));
  assert.ok(!/Q(19|2[0-6])/.test(txt));
  assert.ok(txt.includes('não sinalizaram temas prioritários'));
});

test('feedback: bloco gerencial somente quando Q08 = 1', () => {
  for (const q08 of [0, 9, undefined]) {
    const fb = calc({ Q08: q08, Q27: 1, Q28: 1 });
    assert.equal(fb.blocos.length, 1);
    assert.equal(fb.blocos[0].nome, 'Competências transversais');
  }
  assert.equal(calc({ Q08: 1, Q27: 1 }).blocos[1].temas[0].tema, 'Planejamento e priorização');
});

test('feedback: cursos somente se conferidos e relacionados ao tema', () => {
  assert.equal(ctx.IDCGT_CURSOS.filter((c) => c.conferido).length, 0);
  assert.equal(calc({ Q09: 1 }).cursos.length, 0);
  const cursos = [
    { id: '1', itens: ['Q09'], nome: 'Curso conferido', cargaHoraria: 8, link: 'https://www.escolavirtual.gov.br/curso/1', conferido: true },
    { id: '2', itens: ['Q09'], nome: 'Curso não conferido', cargaHoraria: 8, link: 'x', conferido: false },
    { id: '3', itens: ['Q20'], nome: 'Curso de prática', cargaHoraria: 8, link: 'x', conferido: true }
  ];
  const fb = calc({ Q09: 1, Q20: 1 }, cursos);
  assert.deepEqual(fb.cursos.map((c) => c.nome), ['Curso conferido']);
});

// -------------------------------------------------------------------- PDF
test('PDF local: arquivo válido, com acentuação e sem metadados de data', () => {
  const linhas = ctx.idcgtFeedbackEmLinhas(ctx.idcgtCalcularFeedback({ Q09: 1, Q14: 2 }, []));
  const bytes = ctx.idcgtGerarPdf(linhas, 'Rodapé de teste');
  const buf = Buffer.from(bytes);
  assert.equal(buf.subarray(0, 8).toString('latin1'), '%PDF-1.4');
  assert.ok(!buf.toString('latin1').includes('CreationDate'));
  const arq = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'idcgt-')), 'r.pdf');
  fs.writeFileSync(arq, buf);
  let texto;
  try { texto = execFileSync('pdftotext', [arq, '-'], { encoding: 'utf8' }); } catch (e) { return; } // pdftotext ausente
  assert.ok(texto.includes('Comunicação'));
  assert.ok(texto.includes('Competência digital'));
  assert.ok(texto.includes('reflexão pessoal'));
});

// -------------------------------------------------------------- agregação
function planilha(registros) {
  return [I.campos.slice()].concat(registros.map((r) => I.campos.map((c) => (r[c] === null || r[c] === undefined ? '' : r[c]))));
}

test('painel: menos de cinco submissões suprime tudo', () => {
  const res = ctx.idcgtAgregar(planilha([completa(ctx), completa(ctx), completa(ctx), completa(ctx)]), { convidados: 40 });
  assert.equal(res.suprimidoGeral, true);
  assert.equal(res.participacao.recebidas, null);
  assert.equal(res.blocos.length, 0);
});

test('painel: células 1–4 suprimidas, supressão complementar e nenhum dado individual', () => {
  const regs = [];
  for (let i = 0; i < 12; i++) {
    const r = completa(ctx, i < 3 ? 1 : 0);
    r.Q09 = i < 7 ? 5 : (i < 11 ? 4 : 2); // 7 cincos, 4 quatros, 1 dois
    r.Q35 = 'RESPOSTA_SECRETA_' + i;
    r.Q19 = i < 6 ? 9 : 3;
    regs.push(r);
  }
  const res = J(ctx.idcgtAgregar(planilha(regs), { convidados: 40, elegiveis: 40 }));
  const json = JSON.stringify(res);
  assert.ok(!json.includes('RESPOSTA_SECRETA'), 'texto bruto não pode aparecer');
  assert.equal(res.participacao.recebidas, 12);
  assert.equal(res.participacao.taxa, 30);
  const q09 = res.blocos[1].itens.find((i) => i.codigo === 'Q09');
  const n = q09.categorias.map((c) => c.n);
  assert.deepEqual(n, [0, null, 0, null, 7]); // 2→<5, 4→<5 e 5 visível
  assert.equal(q09.mediana, 5);
  const q19 = res.blocos[2].itens.find((i) => i.codigo === 'Q19');
  assert.equal(q19.categorias[5].n, 6); // NSA como categoria própria
  assert.equal(q19.nValido, 6);         // NSA fora da mediana
  assert.equal(q19.mediana, 3);
  // Gerencial: só 3 com Q08 = 1 -> bloco suprimido
  assert.equal(res.blocos[3].suprimido, true);
  assert.equal(res.blocos[3].itens.length, 0);
  // Perfil Q08: Sim = 3 -> <5, e complementar
  const q08 = res.blocos[0].itens.find((i) => i.codigo === 'Q08');
  assert.equal(q08.categorias[1].n, null);
  assert.equal(q08.categorias.filter((c) => c.n === null).length + (q08.ausentes.n === null ? 1 : 0) >= 2, true);
});

test('painel: supressão complementar isolada', () => {
  assert.deepEqual(J(ctx.idcgtSuprimir([10, 3, 7])), [10, null, null]);
  assert.deepEqual(J(ctx.idcgtSuprimir([10, 3, 2])), [10, null, null]);
  assert.deepEqual(J(ctx.idcgtSuprimir([10, 0, 7])), [10, 0, 7]);
  assert.deepEqual(J(ctx.idcgtSuprimir([3, 0, 0])), [null, 0, 0]);
});

test('painel: recusa planilha com cabeçalho diferente', () => {
  const v = planilha([]); v[0].push('Carimbo de data/hora');
  assert.ok(ctx.idcgtAgregar(v, {}).erro);
});
