/* IDCGT-AP — devolutiva individual calculada SOMENTE no navegador.
 *
 * Regras (04_MODELO_FEEDBACK_INDIVIDUAL; Regras_Analise R25–R28):
 *  - usa apenas Q09–Q18 e, quando Q08 = 1, Q27–Q34;
 *  - respostas 1 a 3 apenas sinalizam um tema para reflexão;
 *  - no máximo três temas por bloco, sem nota total ou comparação;
 *  - Q19–Q26 nunca geram devolutiva nem curso;
 *  - cursos somente se marcados como conferidos no catálogo.
 * Nada deste arquivo é transmitido ao Apps Script.
 *
 * Critério de escolha quando houver mais de três temas sinalizados no bloco
 * (decisão documentada em DECISOES_TECNICAS.md): menor resposta primeiro;
 * em empate, ordem do primeiro item do tema no instrumento.
 */

var IDCGT_FEEDBACK_TEXTOS = {
  titulo: 'Resumo para reflexão pessoal',
  inicial: 'Obrigado por participar. O resumo abaixo foi produzido a partir das respostas desta sessão. Ele serve para reflexão pessoal e não constitui avaliação de desempenho, diagnóstico clínico, classificação profissional ou indicação automática de deficiência.',
  secaoTemas: 'Temas para reflexão e desenvolvimento',
  frasesTema: [
    'Sua resposta sugere que este tema pode merecer atenção no contexto atual.',
    'Considere se há recursos, orientação ou prática que poderiam apoiar seu desenvolvimento.',
    'A interpretação deve considerar sua função, suas condições de trabalho e as respostas abertas.'
  ],
  secaoCursos: 'Sugestões opcionais de aprendizagem',
  nenhum: 'Pela regra programada, suas respostas não sinalizaram temas prioritários entre os itens apresentados. Esse resultado não significa domínio completo nem dispensa de desenvolvimento. Você poderá registrar outras necessidades nas questões abertas.',
  final: 'A RBCIP receberá somente resultados agregados. Este resumo não será usado para remuneração, seleção, permanência, distribuição de oportunidades ou avaliação individual. Se você optar por baixar uma cópia, o arquivo ficará sob sua responsabilidade no dispositivo utilizado.'
};

var IDCGT_FEEDBACK_BLOCOS = [
  { nome: 'Competências transversais',
    codigos: ['Q09', 'Q10', 'Q11', 'Q12', 'Q13', 'Q14', 'Q15', 'Q16', 'Q17', 'Q18'] },
  { nome: 'Competências gerenciais', exigeQ08: true,
    codigos: ['Q27', 'Q28', 'Q29a', 'Q29b', 'Q30', 'Q31a', 'Q31b', 'Q32', 'Q33', 'Q34'] }
];

var IDCGT_MAX_TEMAS_POR_BLOCO = 3;

function idcgtCalcularFeedback(respostas, cursos) {
  var resultado = { blocos: [], cursos: [], algumTema: false };
  var codigosTemas = [];

  IDCGT_FEEDBACK_BLOCOS.forEach(function (bloco) {
    if (bloco.exigeQ08 && respostas.Q08 !== 1) return; // bloco omitido
    var porTema = {};
    var ordemTemas = [];
    bloco.codigos.forEach(function (codigo, posicao) {
      var item = idcgtItem(codigo);
      if (!item || !item.feedback) return;
      var v = respostas[codigo];
      if (v !== 1 && v !== 2 && v !== 3) return;
      if (!porTema[item.tema]) {
        porTema[item.tema] = { tema: item.tema, itens: [], menor: v, ordem: posicao };
        ordemTemas.push(item.tema);
      }
      var t = porTema[item.tema];
      t.itens.push(codigo);
      if (v < t.menor) t.menor = v;
    });
    var temas = ordemTemas.map(function (n) { return porTema[n]; });
    temas.sort(function (a, b) { return a.menor - b.menor || a.ordem - b.ordem; });
    temas = temas.slice(0, IDCGT_MAX_TEMAS_POR_BLOCO).map(function (t) {
      return { tema: t.tema, itens: t.itens };
    });
    temas.forEach(function (t) { codigosTemas = codigosTemas.concat(t.itens); });
    if (temas.length) resultado.algumTema = true;
    resultado.blocos.push({ nome: bloco.nome, temas: temas });
  });

  var vistos = {};
  (cursos || []).forEach(function (c) {
    if (c.conferido !== true || vistos[c.id]) return;
    var relacionado = c.itens.some(function (i) { return codigosTemas.indexOf(i) !== -1; });
    if (!relacionado) return;
    vistos[c.id] = true;
    resultado.cursos.push({ nome: c.nome, cargaHoraria: c.cargaHoraria, link: c.link });
  });
  return resultado;
}

/** Converte o resultado em linhas de texto (tela e PDF usam o mesmo conteúdo). */
function idcgtFeedbackEmLinhas(fb) {
  var T = IDCGT_FEEDBACK_TEXTOS;
  var linhas = [
    { estilo: 'titulo', texto: T.titulo },
    { estilo: 'normal', texto: T.inicial }
  ];
  if (!fb.algumTema) {
    linhas.push({ estilo: 'normal', texto: T.nenhum });
  } else {
    linhas.push({ estilo: 'subtitulo', texto: T.secaoTemas });
    fb.blocos.forEach(function (b) {
      if (!b.temas.length) return;
      linhas.push({ estilo: 'bloco', texto: b.nome });
      b.temas.forEach(function (t, i) {
        linhas.push({ estilo: 'item', texto: t.tema + '. Itens relacionados: ' + t.itens.join(', ') + '. ' + T.frasesTema[i] });
      });
    });
    if (fb.cursos.length) {
      linhas.push({ estilo: 'subtitulo', texto: T.secaoCursos });
      fb.cursos.forEach(function (c) {
        linhas.push({ estilo: 'item', texto: c.nome + ' — ' + c.cargaHoraria + ' h — ' + c.link });
      });
    }
  }
  linhas.push({ estilo: 'normal', texto: T.final });
  return linhas;
}
