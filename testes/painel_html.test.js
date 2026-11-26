'use strict';
// Renderiza apps-script/painel/Painel.html com um interpretador mínimo dos
// scriptlets do HtmlService (<? ?>, <?= ?> com escape) e confere o resultado.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { RAIZ, carregar, completa } = require('./auxiliar');

function compilar(modelo) {
  let codigo = 'let __s = "";\n';
  const partes = modelo.split(/(<\?=?[\s\S]*?\?>)/);
  for (const p of partes) {
    if (p.startsWith('<?=')) codigo += '__s += __esc(' + p.slice(3, -2) + ');\n';
    else if (p.startsWith('<?')) codigo += p.slice(2, -2) + '\n';
    else codigo += '__s += ' + JSON.stringify(p) + ';\n';
  }
  return new Function('parecer', 'resumo', '__esc', codigo + 'return __s;');
}
const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const ctx = carregar(['compartilhado/instrumento.js', 'compartilhado/validacao.js', 'apps-script/painel/Agregacao.gs']);
const render = compilar(fs.readFileSync(path.join(RAIZ, 'apps-script/painel/Painel.html'), 'utf8'));
const I = ctx.IDCGT_INSTRUMENTO;
const planilha = (regs) => [I.campos.slice()].concat(regs.map((r) => I.campos.map((c) => (r[c] === null ? '' : r[c]))));

test('painel: renderiza agregados sem texto bruto nem linhas individuais', () => {
  const regs = [];
  for (let i = 0; i < 9; i++) { const r = completa(ctx, i % 2); r.Q37 = '<script>alert("SEGREDO_' + i + '")</script>'; regs.push(r); }
  const resumo = JSON.parse(JSON.stringify(ctx.idcgtAgregar(planilha(regs), { convidados: 40 })));
  const html = render('Parecer nº 1', resumo, esc);
  assert.ok(!html.includes('SEGREDO'));
  assert.ok(html.includes('Fluxo de participação'));
  assert.ok(html.includes('Q19 — Na RBCIP'));
  assert.ok(html.includes('&lt;5'));
  assert.ok(html.includes('Mediana'));
  assert.ok(!/<form|<select|<input|download|exportar/i.test(html), 'sem filtros ou exportação');
});

test('painel: aviso sem parecer e supressão geral com menos de cinco', () => {
  const resumo = JSON.parse(JSON.stringify(ctx.idcgtAgregar(planilha([completa(ctx)]), {})));
  const html = render('', resumo, esc);
  assert.ok(html.includes('Utilize este painel somente com dados fictícios'));
  assert.ok(html.includes('Há menos de cinco submissões'));
  assert.ok(!html.includes('Mediana'));
});
