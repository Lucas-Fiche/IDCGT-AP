/* Configuração pública do PRÉ-TESTE.
 *
 * Usa endpoint, projeto Apps Script e planilha PRÓPRIOS (aba Base_PreTeste).
 * Nunca preencha aqui o endpoint da aplicação principal: o endpoint principal
 * recusa os campos do pré-teste, e o endpoint do pré-teste só grava em
 * planilha com a aba Base_PreTeste.
 *
 * ambiente: "desenvolvimento" (dados fictícios) ou "pre_teste" (exige parecer e endpoint).
 */
window.IDCGT_CONFIG = {
  modo: 'pre_teste',
  ambiente: 'desenvolvimento',

  // URL da implantação /exec do Apps Script do PRÉ-TESTE. PENDENTE.
  endpoint: '',

  parecer: 'INSERIR_ANTES_DA_PUBLICACAO',
  versao: '1.0.0-dev',

  documentos: {
    tcle: '../assets/documentos/pre-teste/03_TCLE_PRE_TESTE.pdf',
    roteiro: '../assets/documentos/pre-teste/08_ROTEIRO_PRE_TESTE.pdf',
    privacidade: '../privacidade/'
  },

  feedbackHabilitado: true
};
