/* IDCGT-AP — gerador mínimo de PDF executado no próprio dispositivo.
 *
 * Produz um PDF A4 com fontes padrão (Helvetica), sem bibliotecas externas,
 * sem rede e sem metadados de data, autor ou dispositivo.
 * Texto em WinAnsiEncoding: cobre os caracteres do português.
 */

// Larguras Helvetica (1/1000 em), códigos 32–126.
var IDCGT_PDF_LARGURAS = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,
  556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,
  611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,
  278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,
  333,500,278,556,500,722,500,500,500,334,260,334,584];

function idcgtPdfLargura(ch) {
  var base = ch.normalize ? ch.normalize('NFD').charAt(0) : ch;
  var c = base.charCodeAt(0);
  if (c >= 32 && c <= 126) return IDCGT_PDF_LARGURAS[c - 32];
  if (ch === '—') return 1000;
  if (ch === '–') return 556;
  return 556;
}

/** Converte para WinAnsi (bytes 0–255); caracteres fora do conjunto viram '?'. */
function idcgtPdfWinAnsi(s) {
  var especiais = { '—': 151, '–': 150, '“': 147, '”': 148, '‘': 145, '’': 146, '•': 149, '…': 133 };
  var out = '';
  for (var i = 0; i < s.length; i++) {
    var ch = s.charAt(i), c = s.charCodeAt(i);
    if (especiais[ch]) out += String.fromCharCode(especiais[ch]);
    else if (c >= 32 && c <= 126) out += ch;
    else if (c >= 160 && c <= 255) out += ch;
    else out += '?';
  }
  return out.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function idcgtPdfQuebrar(texto, tamanho, larguraMax) {
  var palavras = texto.split(/\s+/), linhas = [], atual = '';
  function larg(s) { var t = 0; for (var i = 0; i < s.length; i++) t += idcgtPdfLargura(s.charAt(i)); return t * tamanho / 1000; }
  palavras.forEach(function (p) {
    var tentativa = atual ? atual + ' ' + p : p;
    if (larg(tentativa) <= larguraMax || !atual) { atual = tentativa; }
    else { linhas.push(atual); atual = p; }
  });
  if (atual) linhas.push(atual);
  return linhas;
}

/**
 * blocos: [{ estilo: 'titulo'|'subtitulo'|'bloco'|'normal'|'item', texto }]
 * rodape: texto curto repetido no fim de cada página.
 * Retorna Uint8Array com o PDF.
 */
function idcgtGerarPdf(blocos, rodape) {
  var L = 595.28, A = 841.89, M = 56, larguraUtil = L - 2 * M;
  var estilos = {
    titulo: { fonte: 'F2', tam: 16, antes: 0, depois: 10 },
    subtitulo: { fonte: 'F2', tam: 12.5, antes: 10, depois: 4 },
    bloco: { fonte: 'F2', tam: 11, antes: 6, depois: 2 },
    normal: { fonte: 'F1', tam: 10.5, antes: 4, depois: 4 },
    item: { fonte: 'F1', tam: 10.5, antes: 2, depois: 2, recuo: 14, marcador: true }
  };
  var paginas = [], cmds = [], y = A - M;
  function novaPagina() { if (cmds.length) paginas.push(cmds); cmds = []; y = A - M; }
  blocos.forEach(function (b) {
    var e = estilos[b.estilo] || estilos.normal;
    var recuo = e.recuo || 0, entre = e.tam * 1.35;
    var linhas = idcgtPdfQuebrar(b.texto, e.tam, larguraUtil - recuo);
    y -= e.antes;
    linhas.forEach(function (ln, i) {
      if (y - entre < M + 24) novaPagina();
      y -= entre;
      if (e.marcador && i === 0) {
        cmds.push('BT /F1 ' + e.tam + ' Tf ' + M + ' ' + y.toFixed(2) + ' Td (' + idcgtPdfWinAnsi('•') + ') Tj ET');
      }
      cmds.push('BT /' + e.fonte + ' ' + e.tam + ' Tf ' + (M + recuo) + ' ' + y.toFixed(2) + ' Td (' + idcgtPdfWinAnsi(ln) + ') Tj ET');
    });
    y -= e.depois;
  });
  novaPagina();

  var objs = [];
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  var kids = [], prox = 5;
  paginas.forEach(function (pc, idx) {
    var rod = 'BT /F1 8.5 Tf ' + M + ' ' + (M - 20) + ' Td (' +
      idcgtPdfWinAnsi((rodape || '') + '  |  Página ' + (idx + 1) + ' de ' + paginas.length) + ') Tj ET';
    var conteudo = pc.concat([rod]).join('\n');
    var idPag = prox++, idCont = prox++;
    objs[idCont] = '<< /Length ' + conteudo.length + ' >>\nstream\n' + conteudo + '\nendstream';
    objs[idPag] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + L + ' ' + A + '] ' +
      '/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + idCont + ' 0 R >>';
    kids.push(idPag + ' 0 R');
  });
  objs[2] = '<< /Type /Pages /Kids [' + kids.join(' ') + '] /Count ' + kids.length + ' >>';

  var saida = '%PDF-1.4\n%âãÏÓ\n', offsets = [];
  for (var i = 1; i < objs.length; i++) {
    offsets[i] = saida.length;
    saida += i + ' 0 obj\n' + objs[i] + '\nendobj\n';
  }
  var xref = saida.length;
  saida += 'xref\n0 ' + objs.length + '\n0000000000 65535 f \n';
  for (var j = 1; j < objs.length; j++) saida += ('0000000000' + offsets[j]).slice(-10) + ' 00000 n \n';
  saida += 'trailer\n<< /Size ' + objs.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';

  var bytes = new Uint8Array(saida.length);
  for (var k = 0; k < saida.length; k++) bytes[k] = saida.charCodeAt(k) & 0xff;
  return bytes;
}
