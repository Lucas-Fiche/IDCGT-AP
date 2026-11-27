# Decisões técnicas e pontos para confirmação do pesquisador

Os documentos do pacote não definem os pontos abaixo de forma explícita. As decisões foram tomadas
para preservar a privacidade e o contrato do banco. Itens marcados **[confirmado em 27/11/2026]**
foram validados pelo pesquisador; itens marcados **[confirmar]** ainda dependem de validação antes
da versão congelada.

| # | Tema | Decisão adotada | Fundamento |
|---|---|---|---|
| D1 | Valores de Q01–Q07 **[confirmado em 27/11/2026]** | Gravados como o **texto da categoria** (ex.: `Mulher`); sem resposta, a célula fica em branco. Q08 e escalas como números. | Aba `Listas_Validacao` da matriz; decisão do pesquisador |
| D2 | Vazios | `null` no envio e célula vazia na planilha; nunca zero. | Briefing: “sem substituir vazios por zero” |
| D3 | Tamanho das abertas **[confirmado em 27/11/2026]** | Máximo de **2.000 caracteres** por questão, com contador visível na tela; o campo não aceita além do limite e o servidor recusa acima disso. Nenhum truncamento silencioso. | Decisão do pesquisador |
| D4 | Texto iniciado por `=`, `+`, `-` ou `@` | Gravado com apóstrofo inicial, que o Google Planilhas não incorpora ao valor; impede execução como fórmula. | Segurança contra injeção de fórmula |
| D5 | Limite de temas no feedback **[confirmado em 27/11/2026]** | Até **3 temas por bloco** (transversais e, se Q08 = 1, gerenciais). | Manifesto, JSON (`maximo_temas_por_bloco`), briefing e decisão do pesquisador |
| D6 | Escolha dos temas quando há mais de 3 **[confirmado em 27/11/2026]** | Menor resposta primeiro (1, depois 2, depois 3); em empate, a ordem das perguntas. | Decisão do pesquisador |
| D7 | Agrupamento de temas | Pela coluna “Competência/tema” do Dicionario_Itens (ex.: Q13 e Q15 formam um tema). | Matriz-mestre |
| D8 | Cursos EV.G **[confirmado em 27/11/2026]** | Somente cursos marcados como “Conferido” (com data de verificação) na matriz; hoje nenhum é exibido. | JSON `cursos_apenas_se_conferidos` e decisão do pesquisador |
| D9 | PDF do feedback | Gerado no navegador (gerador próprio, sem biblioteca externa nem rede), sem data, autor ou metadados. | Briefing |
| D10 | Estado da sessão | Somente em memória. Recarregar a página apaga as respostas; há aviso do navegador ao sair com respostas não enviadas. | Proibição de cookies, armazenamento e identificadores |
| D11 | Duplicidade **[em análise pelo pesquisador]** | Botão bloqueado desde o primeiro clique até a resposta do servidor, envio único por sessão e retorno impedido após o envio. **Não há deduplicação no servidor**: o contrato aceita somente `concluido` e Q01–Q39, e um identificador de envio seria um campo adicional. Risco residual: se a rede falhar *depois* da gravação, uma nova tentativa pode gerar linha duplicada. | Contrato de recebimento |
| D12 | Recusa | Após “Não concordo”, a atividade fica encerrada até a página ser recarregada. Nada é gravado. | TCLE: “O questionário será encerrado” |
| D13 | Rotas | Rotas com `#` (`#/consentimento`, `#/questionario/1`, `#/revisao`, `#/feedback`, `#/conclusao`) para manter as respostas apenas em memória numa página estática. `/privacidade/`, `/pre-teste/` e `/admin/` são páginas próprias. | GitHub Pages é estático |
| D14 | Painel **[confirmar]** | Implementado como projeto Apps Script “somente eu” (autenticação Google com 2FA), não no GitHub Pages. Sem filtros nem comparações; células 1–4 exibidas como “<5”, com supressão complementar; blocos com base < 5 suprimidos; com menos de 5 submissões, nada é exibido. Quartis por interpolação linear (QUARTIL.INC). | Briefing e Especificacao_Painel |
| D15 | Esquema do pré-teste **[confirmado em 27/11/2026]** | Planilha separada, aba `Base_PreTeste`: 42 colunas + `PT01`–`PT12` (perguntas do roteiro) + `codigo_pre_teste` (P1–P5, facultativo). O sistema não coleta nome nem e-mail, e o código não é associado a eles; o pesquisador não deve manter registro de qual pessoa recebeu qual código. | TCLE do pré-teste, roteiro e decisão do pesquisador |
| D16 | Mensagens de erro do servidor | Produção devolve só `ok` ou o tipo de erro. O ambiente de desenvolvimento também devolve o nome do campo inválido (nunca o valor). | Contrato de recebimento |
| D17 | Separação de planilhas | Planilha de desenvolvimento deve ter `DESENVOLVIMENTO` no nome; o servidor recusa trocas entre ambientes e abas cruzadas. | Ambientes separados |
| D18 | Textos de interface sem redação definida **[confirmar]** | Tela inicial do pré-teste (derivada do TCLE do pré-teste), mensagem de cancelamento, oferta opcional do resumo, aviso de ambiente de teste e de “Coleta não liberada”. | Não constam no manual |

## Divergências encontradas no pacote

- `05_ARQUIVOS_TECNICOS/conteudo_sistema_idcgt_ap.json` e `README_IMPLEMENTACAO.md`: o SHA-256
  da cópia no repositório difere da lista de integridade **apenas pelas quebras de linha**. Os originais
  usam CRLF (Windows) e a cópia versionada usa LF. Reconvertendo para CRLF, os dois arquivos conferem
  byte a byte com a lista (verificado em 27/11/2026). O conteúdo não foi alterado e a lista de
  integridade continua correta para os originais. O JSON também foi conferido regra a regra com a
  matriz-mestre (blocos de feedback, regra 1–3, condição Q08, Q19–Q26 sem feedback, supressão n<5,
  ausência de escore geral, de cursos no painel e de metadados técnicos): sem divergências.
- O repositório estava **público** com documentos internos. Decisão do pesquisador (27/11/2026):
  tornar este repositório privado e, na publicação, usar um repositório público novo contendo apenas
  o site e os PDFs destinados aos participantes.
