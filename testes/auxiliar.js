'use strict';
// Carrega os arquivos do sistema (browser e Apps Script) em um contexto isolado.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.resolve(__dirname, '..');

function carregar(arquivos, globais) {
  const ctx = vm.createContext(Object.assign({ console }, globais || {}));
  for (const a of arquivos) {
    vm.runInContext(fs.readFileSync(path.join(RAIZ, a), 'utf8'), ctx, { filename: a });
  }
  return ctx;
}

/** Submissão vazia válida (somente concluido = 1). */
function vazia(ctx, modo) {
  const s = {};
  ctx.idcgtEsquema(modo || 'principal').campos.forEach((c) => { s[c] = null; });
  s.concluido = 1;
  return s;
}

/** Submissão completa fictícia. */
function completa(ctx, q08) {
  const s = vazia(ctx);
  for (const item of ctx.IDCGT_INSTRUMENTO.itens) {
    if (item.tipo === 'texto') s[item.codigo] = 'Texto fictício de teste para ' + item.codigo;
    else s[item.codigo] = item.opcoes[0].valor;
  }
  s.Q08 = q08 === undefined ? 1 : q08;
  if (s.Q08 !== 1) ctx.IDCGT_GERENCIAIS.forEach((c) => { s[c] = null; });
  return s;
}

module.exports = { RAIZ, carregar, vazia, completa };
