/* Configuração pública da APLICAÇÃO PRINCIPAL.
 *
 * Este arquivo é publicado. Não coloque aqui identificador de planilha,
 * chave, senha, e-mail de conta administrativa ou qualquer segredo.
 * O endereço /exec do Apps Script é público por natureza e só deve ser
 * preenchido após a decisão ética favorável (ver documentacao-tecnica/IMPLANTACAO.md).
 *
 * ambiente:
 *   "desenvolvimento" — dados fictícios; sem endpoint, nada é transmitido (modo demonstração)
 *   "producao"        — exige parecer preenchido e endpoint de produção; caso contrário,
 *                       a página exibe "Coleta não liberada" e não abre o consentimento.
 */
window.IDCGT_CONFIG = {
  modo: 'principal',
  ambiente: 'desenvolvimento',

  // URL da implantação /exec do Apps Script de COLETA PRINCIPAL. PENDENTE.
  endpoint: '',

  // Número e data da decisão ética favorável. PENDENTE.
  parecer: 'INSERIR_ANTES_DA_PUBLICACAO',

  // Versão congelada do sistema (preencher no momento da liberação).
  versao: '1.0.0-dev',

  documentos: {
    tcle: 'assets/documentos/01_TCLE_APLICACAO_PRINCIPAL.pdf',
    privacidade: 'privacidade/'
  },

  // Feedback individual opcional (calculado somente no navegador).
  feedbackHabilitado: true
};
