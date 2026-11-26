/**
 * IDCGT-AP — agregação para o painel administrativo.
 *
 * Regras (Especificacao_Painel; Regras_Analise R01, R03, R05, R06, R07, R28):
 *  - nenhuma linha, resposta ou texto individual sai desta função;
 *  - contagens de 1 a 4 são exibidas como "<5"; se só uma célula de uma
 *    distribuição for suprimida, a menor célula não nula seguinte também é
 *    (supressão complementar, para impedir a dedução por subtração);
 *  - itens ou blocos com menos de cinco respostas válidas têm mediana e IIQ suprimidos;
 *  - com menos de cinco submissões no total, nada além do aviso é exibido;
 *  - NSA (9) é categoria própria e fica fora de mediana e IIQ;
 *  - ausentes são mantidos e reportados, sem imputação;
 *  - não há escore geral, ranking, filtro, cruzamento, curso ou exportação.
 */

var IDCGT_N_MINIMO = 5;

/** Recebe contagens e devolve, para cada uma, o número ou null (= "<5"). */
function idcgtSuprimir(contagens) {
  var saida = contagens.map(function (c) { return c >= 1 && c < IDCGT_N_MINIMO ? null : c; });
  var suprimidas = saida.filter(function (c) { return c === null; }).length;
  if (suprimidas === 1) {
    var menor = -1;
    contagens.forEach(function (c, i) {
      if (saida[i] !== null && c > 0 && (menor === -1 || c < contagens[menor])) menor = i;
    });
    if (menor !== -1) saida[menor] = null;
  }
  return saida;
}

/** Quantil por interpolação linear (equivalente a QUARTIL.INC). */
function idcgtQuantil(ordenados, p) {
  var pos = (ordenados.length - 1) * p;
  var base = Math.floor(pos), resto = pos - base;
  if (ordenados[base + 1] === undefined) return ordenados[base];
  return ordenados[base] + resto * (ordenados[base + 1] - ordenados[base]);
}

function idcgtVazio(v) { return v === '' || v === null || v === undefined; }

function idcgtNumero(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return parseInt(v, 10);
  return v;
}

function idcgtPct(n, base) {
  return n === null || !base ? null : Math.round((n / base) * 1000) / 10;
}

/** Distribuição de um item sobre uma base de registros. */
function idcgtDistribuicao(item, registros) {
  var categorias = item.opcoes.map(function (o) { return { rotulo: item.tipo === 'ordinal' ? o.valor + ' — ' + o.rotulo : o.rotulo, valor: o.valor, n: 0 }; });
  var ausentes = 0, validos = [];
  registros.forEach(function (r) {
    var v = r[item.codigo];
    if (idcgtVazio(v)) { ausentes++; return; }
    v = item.tipo === 'categorica' ? String(v) : idcgtNumero(v);
    for (var i = 0; i < categorias.length; i++) {
      if (categorias[i].valor === v) {
        categorias[i].n++;
        if (item.tipo === 'ordinal' && v >= 1 && v <= 5) validos.push(v);
        return;
      }
    }
    ausentes++; // valor fora do domínio é tratado como ausente (não deveria ocorrer)
  });
  var base = registros.length;
  var exibidas = idcgtSuprimir(categorias.map(function (c) { return c.n; }).concat([ausentes]));
  var saida = {
    codigo: item.codigo,
    texto: item.texto,
    base: base,
    categorias: categorias.map(function (c, i) {
      return { rotulo: c.rotulo, n: exibidas[i], pct: idcgtPct(exibidas[i], base) };
    }),
    ausentes: { n: exibidas[exibidas.length - 1], pct: idcgtPct(exibidas[exibidas.length - 1], base) }
  };
  if (item.tipo === 'ordinal') {
    var nValido = validos.length;
    saida.nValido = nValido >= IDCGT_N_MINIMO || nValido === 0 ? nValido : null;
    if (nValido >= IDCGT_N_MINIMO) {
      validos.sort(function (a, b) { return a - b; });
      var q1 = idcgtQuantil(validos, 0.25), q3 = idcgtQuantil(validos, 0.75);
      saida.mediana = idcgtQuantil(validos, 0.5);
      saida.q1 = q1; saida.q3 = q3; saida.iiq = q3 - q1;
    } else {
      saida.mediana = saida.q1 = saida.q3 = saida.iiq = null;
    }
  }
  return saida;
}

/**
 * valores: matriz lida da planilha (1ª linha = cabeçalho).
 * contexto: { elegiveis, convidados } informados de forma agregada pelo RH (opcionais).
 */
function idcgtAgregar(valores, contexto) {
  var cab = valores[0].map(String);
  var esperado = IDCGT_INSTRUMENTO.campos;
  if (cab.length !== esperado.length || cab.some(function (c, i) { return c !== esperado[i]; })) {
    return { erro: 'Cabeçalhos da planilha não conferem com o esquema de 42 colunas.' };
  }
  var registros = valores.slice(1).map(function (l) {
    var o = {}; cab.forEach(function (c, i) { o[c] = l[i]; }); return o;
  }).filter(function (r) { return idcgtNumero(r.concluido) === 1; });

  var total = registros.length;
  contexto = contexto || {};
  var resumo = {
    nMinimo: IDCGT_N_MINIMO,
    participacao: {
      elegiveis: contexto.elegiveis || null,
      convidados: contexto.convidados || null,
      recebidas: total >= IDCGT_N_MINIMO || total === 0 ? total : null,
      taxa: total >= IDCGT_N_MINIMO && contexto.convidados ? idcgtPct(total, contexto.convidados) : null
    },
    suprimidoGeral: total < IDCGT_N_MINIMO,
    blocos: []
  };
  if (resumo.suprimidoGeral) return resumo;

  var gerenciais = registros.filter(function (r) { return idcgtNumero(r.Q08) === 1; });
  var definicoes = [
    { nome: 'Perfil (Q01–Q08)', bloco: 'Perfil', base: registros },
    { nome: 'Competências transversais (Q09–Q18)', bloco: 'Competências transversais', base: registros },
    { nome: 'Práticas organizacionais (Q19–Q26)', bloco: 'Práticas organizacionais', base: registros },
    { nome: 'Competências gerenciais (Q27–Q34) — somente Q08 = Sim', bloco: 'Competências gerenciais', base: gerenciais }
  ];
  definicoes.forEach(function (d) {
    var itens = IDCGT_INSTRUMENTO.itens.filter(function (i) { return i.bloco === d.bloco; });
    var bloco = { nome: d.nome, base: d.base.length >= IDCGT_N_MINIMO ? d.base.length : null, suprimido: d.base.length < IDCGT_N_MINIMO, itens: [] };
    if (!bloco.suprimido) bloco.itens = itens.map(function (i) { return idcgtDistribuicao(i, d.base); });
    resumo.blocos.push(bloco);
  });

  resumo.abertas = IDCGT_INSTRUMENTO.itens.filter(function (i) { return i.tipo === 'texto'; }).map(function (i) {
    var n = registros.filter(function (r) { return !idcgtVazio(r[i.codigo]) && String(r[i.codigo]).trim() !== ''; }).length;
    return { codigo: i.codigo, texto: i.texto, comTexto: idcgtSuprimir([n, total - n])[0] };
  });
  return resumo;
}
