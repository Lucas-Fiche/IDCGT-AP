# Decisões técnicas e pontos para confirmação do pesquisador

Os documentos do pacote não definem os pontos abaixo de forma explícita. As decisões foram tomadas
para preservar a privacidade e o contrato do banco. Itens marcados **[confirmar]** dependem de
validação do pesquisador antes da versão congelada.

| # | Tema | Decisão adotada | Fundamento |
|---|---|---|---|
| D1 | Valores de Q01–Q07 | Gravados como o **texto da categoria** (ex.: `Mulher`). Q08 e escalas como números. | Aba `Listas_Validacao` da matriz; planilha de coleta não valida Q01–Q07 |
| D2 | Vazios | `null` no envio e célula vazia na planilha; nunca zero. | Briefing: “sem substituir vazios por zero” |
| D3 | Tamanho das abertas **[confirmar]** | Máximo de **5.000 caracteres** por questão (contador visível; o servidor recusa acima disso). Nenhum truncamento silencioso. | Briefing: validar tamanho e “não truncar sem decisão documentada” |
| D4 | Texto iniciado por `=`, `+`, `-` ou `@` | Gravado com apóstrofo inicial, que o Google Planilhas não incorpora ao valor; impede execução como fórmula. | Segurança contra injeção de fórmula |
| D5 | Limite de temas no feedback **[confirmar]** | Até **3 temas por bloco** (transversais e, se Q08 = 1, gerenciais): no máximo 6 no total. | Manifesto (“por bloco”), JSON (`maximo_temas_por_bloco`) e briefing |
| D6 | Escolha dos temas quando há mais de 3 **[confirmar]** | Menor resposta primeiro (1, depois 2, depois 3); empate pela ordem do item. | Não definido nos documentos |
| D7 | Agrupamento de temas | Pela coluna “Competência/tema” do Dicionario_Itens (ex.: Q13 e Q15 formam um tema). | Matriz-mestre |
| D8 | Cursos EV.G | Nenhum exibido enquanto a matriz indicar “A validar antes da liberação”. | JSON `cursos_apenas_se_conferidos` |
| D9 | PDF do feedback | Gerado no navegador (gerador próprio, sem biblioteca externa nem rede), sem data, autor ou metadados. | Briefing |
| D10 | Estado da sessão | Somente em memória. Recarregar a página apaga as respostas; há aviso do navegador ao sair com respostas não enviadas. | Proibição de cookies, armazenamento e identificadores |
| D11 | Duplicidade | Botão bloqueado durante o envio, envio único por sessão e retorno impedido após o envio. **Não há deduplicação no servidor**: o contrato aceita somente `concluido` e Q01–Q39, e um identificador de envio seria um campo adicional. Risco residual: se a rede falhar *depois* da gravação, uma nova tentativa pode gerar linha duplicada. | Contrato de recebimento |
| D12 | Recusa | Após “Não concordo”, a atividade fica encerrada até a página ser recarregada. Nada é gravado. | TCLE: “O questionário será encerrado” |
| D13 | Rotas | Rotas com `#` (`#/consentimento`, `#/questionario/1`, `#/revisao`, `#/feedback`, `#/conclusao`) para manter as respostas apenas em memória numa página estática. `/privacidade/`, `/pre-teste/` e `/admin/` são páginas próprias. | GitHub Pages é estático |
| D14 | Painel **[confirmar]** | Implementado como projeto Apps Script “somente eu” (autenticação Google com 2FA), não no GitHub Pages. Sem filtros nem comparações; células 1–4 exibidas como “<5”, com supressão complementar; blocos com base < 5 suprimidos; com menos de 5 submissões, nada é exibido. Quartis por interpolação linear (QUARTIL.INC). | Briefing e Especificacao_Painel |
| D15 | Esquema do pré-teste **[confirmar]** | 42 colunas + `codigo_pre_teste` (P1–P5, facultativo) + `PT01`–`PT12` (perguntas do roteiro), aba `Base_PreTeste`. | TCLE do pré-teste (“código de P1 a P5”) e roteiro |
| D16 | Mensagens de erro do servidor | Produção devolve só `ok` ou o tipo de erro. O ambiente de desenvolvimento também devolve o nome do campo inválido (nunca o valor). | Contrato de recebimento |
| D17 | Separação de planilhas | Planilha de desenvolvimento deve ter `DESENVOLVIMENTO` no nome; o servidor recusa trocas entre ambientes e abas cruzadas. | Ambientes separados |
| D18 | Textos de interface sem redação definida **[confirmar]** | Tela inicial do pré-teste (derivada do TCLE do pré-teste), mensagem de cancelamento, oferta opcional do resumo, aviso de ambiente de teste e de “Coleta não liberada”. | Não constam no manual |

## Divergências encontradas no pacote

- `05_ARQUIVOS_TECNICOS/conteudo_sistema_idcgt_ap.json` tem SHA-256 diferente do registrado em
  `LISTA_DE_INTEGRIDADE_SHA256.txt` (os demais 28 arquivos conferem; o README confere
  considerando quebras de linha CRLF). O conteúdo foi usado como referência, mas convém confirmar a versão.
- O repositório está **público** e contém os documentos internos (`04_DOCUMENTOS_INTERNOS`,
  manual, termos, comunicações, versões editáveis), que o `00_LEIA_PRIMEIRO` diz que não devem
  ficar em diretório público. A publicação no Pages envia apenas `site/`, mas o repositório em si
  continua acessível. Ver recomendação no `README.md`.
