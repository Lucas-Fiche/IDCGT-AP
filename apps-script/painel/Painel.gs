/**
 * IDCGT-AP — PAINEL ADMINISTRATIVO AGREGADO.
 *
 * Projeto Apps Script SEPARADO do recebimento, implantado como app da Web com
 * "Executar como: eu" e "Quem pode acessar: somente eu" (appsscript.json:
 * access MYSELF). Assim, apenas a conta exclusiva da pesquisa, autenticada no
 * Google com verificação em duas etapas, abre o painel.
 *
 * Propriedades do script (somente no Apps Script):
 *   PLANILHA_ID        planilha cujo resumo será exibido (somente leitura)
 *   PARECER_FAVORAVEL  número e data da decisão ética (exibido como status)
 *   N_ELEGIVEIS        total de elegíveis informado de forma agregada pelo RH (opcional)
 *   N_CONVIDADOS       total de convidados informado de forma agregada pelo RH (opcional)
 *
 * Arquivos do projeto: Painel.gs, Agregacao.gs, Instrumento.gs, Validacao.gs,
 * Painel.html e appsscript.json.
 */

function doGet() {
  var ativo = Session.getActiveUser().getEmail();
  var efetivo = Session.getEffectiveUser().getEmail();
  if (!ativo || ativo !== efetivo) {
    return HtmlService.createHtmlOutput('<p>Acesso não autorizado.</p>').setTitle('IDCGT-AP');
  }
  var p = PropertiesService.getScriptProperties();
  var t = HtmlService.createTemplateFromFile('Painel');
  t.parecer = (p.getProperty('PARECER_FAVORAVEL') || '').trim();
  t.resumo = idcgtResumoDaPlanilha_(p);
  return t.evaluate()
    .setTitle('IDCGT-AP — Painel agregado')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DENY);
}

function idcgtResumoDaPlanilha_(p) {
  var id = (p.getProperty('PLANILHA_ID') || '').trim();
  if (!id) return { erro: 'Propriedade PLANILHA_ID não configurada.' };
  var aba = SpreadsheetApp.openById(id).getSheetByName('Base_Respostas');
  if (!aba) return { erro: 'Aba Base_Respostas não encontrada.' };
  var valores = aba.getDataRange().getValues();
  var num = function (k) { var v = parseInt(p.getProperty(k) || '', 10); return isNaN(v) ? null : v; };
  return idcgtAgregar(valores, { elegiveis: num('N_ELEGIVEIS'), convidados: num('N_CONVIDADOS') });
}
