/**
 * IDCGT-AP — Apps Script de RECEBIMENTO (coleta principal, pré-teste ou desenvolvimento).
 *
 * Um projeto Apps Script SEPARADO por ambiente, cada um com sua planilha:
 *   desenvolvimento -> planilha de teste (nome contendo "DESENVOLVIMENTO"), aba Base_Respostas
 *   pre_teste       -> planilha do pré-teste, aba Base_PreTeste
 *   principal       -> planilha de coleta principal, aba Base_Respostas
 *
 * Propriedades do script (Configurações do projeto > Propriedades do script).
 * Ficam SOMENTE no Apps Script; nunca no repositório:
 *   PLANILHA_ID        identificador da planilha de destino
 *   MODO               desenvolvimento | pre_teste | principal
 *   COLETA_ATIVA       sim | nao        (desativação imediata do recebimento)
 *   PARECER_FAVORAVEL  número e data da decisão ética (obrigatório em pre_teste e principal)
 *
 * Contrato: POST com corpo JSON (Content-Type text/plain) contendo exatamente
 * os campos do esquema. Resposta: {"status":"ok"} ou {"status":"erro","tipo":...}.
 * Nunca retorna número de linha, identificador ou conteúdo do banco.
 * Nunca registra o conteúdo das respostas em logs.
 *
 * Arquivos do projeto: Codigo.gs, Instrumento.gs, Validacao.gs (gerados/copiados
 * do repositório) e appsscript.json.
 */

var IDCGT_ESPERA_LOCK_MS = 20000;

function doPost(e) {
  return idcgtResponder_(idcgtProcessar_(e));
}

/** GET não expõe dados: informa apenas se o recebimento está ativo. */
function doGet() {
  var cfg = idcgtConfig_();
  return idcgtResponder_({ servico: 'IDCGT-AP', recebimento: cfg.ok && cfg.ativa ? 'ativo' : 'inativo' });
}

function idcgtConfig_() {
  var p = PropertiesService.getScriptProperties();
  var modo = (p.getProperty('MODO') || '').trim();
  var id = (p.getProperty('PLANILHA_ID') || '').trim();
  var ativa = (p.getProperty('COLETA_ATIVA') || '').trim().toLowerCase() === 'sim';
  var parecer = (p.getProperty('PARECER_FAVORAVEL') || '').trim();
  var modosValidos = { desenvolvimento: 'principal', pre_teste: 'pre_teste', principal: 'principal' };
  if (!modosValidos[modo] || !id) return { ok: false };
  if (modo !== 'desenvolvimento' && (!parecer || parecer.indexOf('INSERIR') !== -1)) return { ok: false };
  return { ok: true, modo: modo, esquema: modosValidos[modo], planilhaId: id, ativa: ativa };
}

function idcgtProcessar_(e) {
  var cfg = idcgtConfig_();
  if (!cfg.ok) return { status: 'erro', tipo: 'indisponivel' };
  if (!cfg.ativa) return { status: 'erro', tipo: 'encerrada' };

  var corpo = e && e.postData && e.postData.contents;
  if (typeof corpo !== 'string' || corpo.length === 0 || corpo.length > IDCGT_MAX_CORPO) {
    return idcgtErroValidacao_(cfg, 'tamanho_ou_corpo_invalido');
  }
  // Parâmetros de URL não fazem parte do contrato.
  if (e.parameter && Object.keys(e.parameter).length > 0) {
    return idcgtErroValidacao_(cfg, 'parametros_nao_permitidos');
  }

  var dados;
  try { dados = JSON.parse(corpo); } catch (err) { return idcgtErroValidacao_(cfg, 'json_invalido'); }

  var v = idcgtValidarSubmissao(dados, cfg.esquema);
  if (!v.ok) return idcgtErroValidacao_(cfg, v.motivo + (v.campo ? ':' + v.campo : ''));

  var linha = idcgtLinhaPlanilha(dados, cfg.esquema);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(IDCGT_ESPERA_LOCK_MS)) return { status: 'erro', tipo: 'indisponivel' };
  try {
    var aba = idcgtAbaVerificada_(cfg);
    if (!aba) return { status: 'erro', tipo: 'indisponivel' };
    var proxima = aba.getLastRow() + 1;
    aba.getRange(proxima, 1, 1, linha.length).setValues([linha]);
    SpreadsheetApp.flush();
  } catch (err) {
    // Registra somente a categoria do erro, sem conteúdo das respostas.
    console.error('IDCGT-AP: falha de gravação (' + (err && err.name ? err.name : 'Erro') + ')');
    return { status: 'erro', tipo: 'indisponivel' };
  } finally {
    lock.releaseLock();
  }
  return { status: 'ok' };
}

/**
 * Abre a aba de destino e confere:
 *  - nome da aba conforme o esquema;
 *  - cabeçalhos exatamente iguais aos do esquema e nenhuma coluna adicional;
 *  - separação de ambientes: a planilha de desenvolvimento deve ter
 *    "DESENVOLVIMENTO" no nome e as demais não podem ter; a planilha principal
 *    não pode conter a aba do pré-teste e vice-versa.
 */
function idcgtAbaVerificada_(cfg) {
  var esquema = idcgtEsquema(cfg.esquema);
  var planilha = SpreadsheetApp.openById(cfg.planilhaId);
  var nome = planilha.getName().toUpperCase();
  var ehDesenvolvimento = nome.indexOf('DESENVOLVIMENTO') !== -1;
  if (cfg.modo === 'desenvolvimento' && !ehDesenvolvimento) return null;
  if (cfg.modo !== 'desenvolvimento' && ehDesenvolvimento) return null;
  if (cfg.modo === 'principal' && planilha.getSheetByName('Base_PreTeste')) return null;
  if (cfg.modo === 'pre_teste' && planilha.getSheetByName('Base_Respostas')) return null;

  var aba = planilha.getSheetByName(esquema.aba);
  if (!aba) return null;
  if (aba.getLastColumn() !== esquema.campos.length) return null;
  var cab = aba.getRange(1, 1, 1, esquema.campos.length).getValues()[0];
  for (var i = 0; i < esquema.campos.length; i++) {
    if (String(cab[i]) !== esquema.campos[i]) return null;
  }
  return aba;
}

function idcgtErroValidacao_(cfg, motivo) {
  var r = { status: 'erro', tipo: 'validacao' };
  // O motivo (nome do campo, nunca o valor) só é devolvido no ambiente de desenvolvimento.
  if (cfg.modo === 'desenvolvimento') r.motivo = motivo;
  return r;
}

function idcgtResponder_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Teste manual no editor (Executar > idcgtTesteConfiguracao): confere propriedades
 * e cabeçalhos sem gravar nenhuma linha.
 */
function idcgtTesteConfiguracao() {
  var cfg = idcgtConfig_();
  if (!cfg.ok) { console.log('Configuração incompleta ou parecer ausente.'); return; }
  var aba = idcgtAbaVerificada_(cfg);
  console.log('Modo: ' + cfg.modo + ' | recebimento ' + (cfg.ativa ? 'ATIVO' : 'INATIVO') +
    ' | planilha e cabeçalhos ' + (aba ? 'CONFEREM' : 'NÃO CONFEREM'));
}
