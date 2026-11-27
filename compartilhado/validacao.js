/* IDCGT-AP — validação compartilhada entre a interface e o Apps Script.
 *
 * Este arquivo é a fonte; cópias idênticas ficam em:
 *   site/assets/js/validacao.js
 *   apps-script/coleta/Validacao.gs
 *   apps-script/painel/Validacao.gs
 * Após editar, execute: python3 ferramentas/gerar_instrumento.py --somente-copiar
 *
 * Depende de IDCGT_INSTRUMENTO (instrumento.js / Instrumento.gs).
 * Não usa recursos específicos do navegador nem do Apps Script.
 */

/** Limite de caracteres de cada questão aberta (decisão confirmada pelo pesquisador em 27/11/2026;
 *  ver documentacao-tecnica/DECISOES_TECNICAS.md, D3). */
var IDCGT_MAX_TEXTO = 2000;

/** Código temporário de envio: 32 caracteres hexadecimais aleatórios (128 bits).
 *  Vai somente no endereço da requisição; nunca no banco. */
function idcgtCodigoEnvioValido(c) {
  return typeof c === 'string' && /^[0-9a-f]{32}$/.test(c);
}

/** Limite do corpo da requisição, em caracteres. */
var IDCGT_MAX_CORPO = 120000;

var IDCGT_GERENCIAIS = ['Q27', 'Q28', 'Q29a', 'Q29b', 'Q30', 'Q31a', 'Q31b', 'Q32', 'Q33', 'Q34'];

/** Questões do roteiro escrito do pré-teste (08_ROTEIRO_PRE_TESTE). */
var IDCGT_ROTEIRO_PRE_TESTE = [
  { codigo: 'PT01', texto: 'As instruções iniciais ficaram claras? O que poderia ser melhorado?' },
  { codigo: 'PT02', texto: 'O TCLE foi compreensível? Alguma informação gerou dúvida?' },
  { codigo: 'PT03', texto: 'Algum termo ou expressão pareceu técnico, ambíguo ou inadequado?' },
  { codigo: 'PT04', texto: 'Em algum item houve dúvida sobre o referente, como você, sua equipe, sua unidade ou a RBCIP?' },
  { codigo: 'PT05', texto: 'A escala de frequência de Nunca a Sempre foi fácil de utilizar?' },
  { codigo: 'PT06', texto: 'A escala de práticas organizacionais e a opção Não sei ou não se aplica ficaram claras?' },
  { codigo: 'PT07', texto: 'A resposta à pergunta sobre coordenação direcionou corretamente ao bloco gerencial?' },
  { codigo: 'PT08', texto: 'Algum item pareceu repetitivo, excessivamente longo ou composto por mais de uma ideia?' },
  { codigo: 'PT09', texto: 'Qual foi o tempo aproximado de preenchimento?' },
  { codigo: 'PT10', texto: 'Houve problema de carregamento, navegação, registro ou envio?' },
  { codigo: 'PT11', texto: 'O questionário funcionou adequadamente no dispositivo utilizado?' },
  { codigo: 'PT12', texto: 'Que alteração poderia melhorar clareza, conforto, privacidade ou funcionamento?' }
];

var IDCGT_CODIGOS_PRE_TESTE = ['P1', 'P2', 'P3', 'P4', 'P5'];

/** Esquemas de destino. "principal" é usado também no ambiente de desenvolvimento. */
function idcgtEsquema(modo) {
  var campos = IDCGT_INSTRUMENTO.campos.slice();
  if (modo === 'principal') {
    return { modo: 'principal', aba: 'Base_Respostas', campos: campos };
  }
  if (modo === 'pre_teste') {
    campos.push('codigo_pre_teste');
    IDCGT_ROTEIRO_PRE_TESTE.forEach(function (q) { campos.push(q.codigo); });
    return { modo: 'pre_teste', aba: 'Base_PreTeste', campos: campos };
  }
  throw new Error('Modo desconhecido');
}

function idcgtItem(codigo) {
  var itens = IDCGT_INSTRUMENTO.itens;
  for (var i = 0; i < itens.length; i++) if (itens[i].codigo === codigo) return itens[i];
  return null;
}

function idcgtValoresPermitidos(item) {
  return item.opcoes.map(function (o) { return o.valor; });
}

/** Caracteres de controle não aceitos em texto (permitidos: tabulação, LF, CR). */
var IDCGT_CONTROLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function idcgtTextoValido(v) {
  return typeof v === 'string' && v.length >= 1 && v.length <= IDCGT_MAX_TEXTO && !IDCGT_CONTROLE.test(v);
}

/**
 * Valida uma submissão já convertida de JSON.
 * Retorna { ok: true } ou { ok: false, motivo: '<código>', campo: '<nome>' }.
 * O motivo nunca contém o valor enviado.
 */
function idcgtValidarSubmissao(dados, modo) {
  var esquema;
  try { esquema = idcgtEsquema(modo); } catch (e) { return { ok: false, motivo: 'modo_invalido' }; }

  if (dados === null || typeof dados !== 'object' || Array.isArray(dados)) {
    return { ok: false, motivo: 'estrutura_invalida' };
  }
  var chaves = Object.keys(dados);
  var permitidos = {};
  esquema.campos.forEach(function (c) { permitidos[c] = true; });
  for (var i = 0; i < chaves.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(permitidos, chaves[i])) {
      return { ok: false, motivo: 'campo_nao_permitido' };
    }
  }
  for (var j = 0; j < esquema.campos.length; j++) {
    if (!Object.prototype.hasOwnProperty.call(dados, esquema.campos[j])) {
      return { ok: false, motivo: 'campo_ausente', campo: esquema.campos[j] };
    }
  }
  if (chaves.length !== esquema.campos.length) return { ok: false, motivo: 'estrutura_invalida' };

  if (dados.concluido !== 1) return { ok: false, motivo: 'valor_invalido', campo: 'concluido' };

  var itens = IDCGT_INSTRUMENTO.itens;
  for (var k = 0; k < itens.length; k++) {
    var item = itens[k];
    var v = dados[item.codigo];
    if (v === null) continue;
    if (item.tipo === 'texto') {
      if (!idcgtTextoValido(v)) return { ok: false, motivo: 'texto_invalido', campo: item.codigo };
      continue;
    }
    if (item.tipo === 'categorica') {
      if (typeof v !== 'string') return { ok: false, motivo: 'tipo_invalido', campo: item.codigo };
    } else if (typeof v !== 'number' || Math.floor(v) !== v) {
      return { ok: false, motivo: 'tipo_invalido', campo: item.codigo };
    }
    if (idcgtValoresPermitidos(item).indexOf(v) === -1) {
      return { ok: false, motivo: 'valor_invalido', campo: item.codigo };
    }
  }

  // Lógica gerencial: Q27–Q34 somente quando Q08 = 1.
  if (dados.Q08 !== 1) {
    for (var g = 0; g < IDCGT_GERENCIAIS.length; g++) {
      if (dados[IDCGT_GERENCIAIS[g]] !== null) {
        return { ok: false, motivo: 'bloco_gerencial_sem_q08', campo: IDCGT_GERENCIAIS[g] };
      }
    }
  }

  if (modo === 'pre_teste') {
    var cod = dados.codigo_pre_teste;
    if (cod !== null && IDCGT_CODIGOS_PRE_TESTE.indexOf(cod) === -1) {
      return { ok: false, motivo: 'valor_invalido', campo: 'codigo_pre_teste' };
    }
    for (var r = 0; r < IDCGT_ROTEIRO_PRE_TESTE.length; r++) {
      var rv = dados[IDCGT_ROTEIRO_PRE_TESTE[r].codigo];
      if (rv !== null && !idcgtTextoValido(rv)) {
        return { ok: false, motivo: 'texto_invalido', campo: IDCGT_ROTEIRO_PRE_TESTE[r].codigo };
      }
    }
  }
  return { ok: true };
}

/**
 * Impede que texto livre seja interpretado como fórmula na planilha
 * (=, +, -, @). O apóstrofo inicial não integra o valor armazenado no
 * Google Planilhas; ele apenas força o tratamento como texto.
 */
function idcgtProtegerTexto(v) {
  if (typeof v === 'string' && /^[=+\-@\t\r\n]/.test(v)) return "'" + v;
  return v;
}

/** Converte uma submissão validada em linha da planilha, na ordem exata do esquema. */
function idcgtLinhaPlanilha(dados, modo) {
  var esquema = idcgtEsquema(modo);
  return esquema.campos.map(function (c) {
    var v = dados[c];
    if (v === null || v === undefined) return '';
    return idcgtProtegerTexto(v);
  });
}

/**
 * Monta o corpo da submissão a partir do estado da interface.
 * respostas: objeto { Q01: valor|null|undefined, ... } (valores já tipados).
 * extras: campos do pré-teste (somente modo pre_teste).
 * Garante: todos os campos presentes, vazios como null, texto aparado,
 * bloco gerencial nulo quando Q08 != 1 e concluido = 1.
 */
function idcgtMontarSubmissao(respostas, modo, extras) {
  var esquema = idcgtEsquema(modo);
  var saida = {};
  esquema.campos.forEach(function (c) { saida[c] = null; });
  saida.concluido = 1;
  IDCGT_INSTRUMENTO.itens.forEach(function (item) {
    var v = respostas[item.codigo];
    if (v === undefined || v === null) return;
    if (item.tipo === 'texto') {
      v = idcgtLimparTexto(v);
      if (v === null) return;
    }
    saida[item.codigo] = v;
  });
  if (saida.Q08 !== 1) IDCGT_GERENCIAIS.forEach(function (c) { saida[c] = null; });
  if (modo === 'pre_teste' && extras) {
    if (IDCGT_CODIGOS_PRE_TESTE.indexOf(extras.codigo_pre_teste) !== -1) {
      saida.codigo_pre_teste = extras.codigo_pre_teste;
    }
    IDCGT_ROTEIRO_PRE_TESTE.forEach(function (q) {
      saida[q.codigo] = idcgtLimparTexto(extras[q.codigo]);
    });
  }
  return saida;
}

/** Remove caracteres de controle e espaços externos; vazio vira null. */
function idcgtLimparTexto(v) {
  if (typeof v !== 'string') return null;
  var limpo = v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!limpo) return null;
  return limpo.slice(0, IDCGT_MAX_TEXTO);
}
