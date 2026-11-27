# Relatório de testes — versão 1.0.0-dev

| Campo | Registro |
|---|---|
| Versão testada | 1.0.0-dev (desenvolvimento, não liberada) |
| Data | 27/11/2026 (reexecução após as decisões do pesquisador) |
| Dados | exclusivamente fictícios; nenhum endpoint real foi chamado |
| Ambiente | Node 22, Chromium (Playwright 1.63), Python 3 + openpyxl, poppler (pdftotext) |
| Comando | `npm test` |
| Resultado | **57 testes automatizados aprovados, 0 falhas** (32 unitários/servidor simulado, 22 de navegador, 3 de exportação) |
| Responsável técnico | **[PREENCHER]** |

Os testes de navegador interceptam o endereço do Apps Script, de modo que nenhuma requisição sai da máquina.
O Apps Script é executado em Node com os serviços do Google simulados (`testes/apps_script.test.js`).
Por isso, **os itens marcados “manual” precisam ser repetidos na implantação real** antes do Termo de Conformidade.

## Plano mínimo de testes do briefing

| Grupo | Caso | Evidência automatizada | Situação |
|---|---|---|---|
| Consentimento | TCLE integral e PDF disponíveis antes da decisão | e2e “consentimento: TCLE completo e PDF…” | Aprovado |
| Consentimento | Aceite libera o questionário; acesso direto sem aceite volta ao início | e2e “acesso direto ao questionário…” | Aprovado |
| Consentimento | Recusa encerra, nenhuma requisição externa, não reabre | e2e “recusa…” | Aprovado |
| Consentimento | Nada transmitido antes da confirmação final | e2e “facultatividade…” (lista de requisições externas vazia até Enviar) | Aprovado |
| Facultatividade | Envio sem nenhuma resposta: `concluido = 1` e 41 vazios | e2e “facultatividade…”; unit “submissão sem respostas…” | Aprovado |
| Facultatividade | Limpar resposta já marcada; aberta só com espaços vira vazio | e2e “respostas: valores tipados…” | Aprovado |
| Q08 | Vazio, 0 e 9 ocultam; 1 exibe Q27–Q34 | e2e “Q08: somente Sim…” | Aprovado |
| Q08 | Troca de 1 para 9/0 apaga o bloco; respostas não reaparecem; envio com Q27–Q34 nulos | e2e “Q08…” | Aprovado |
| Q08 | Servidor recusa Q27–Q34 preenchidas com Q08 = 0, 9 ou vazia | unit “bloco gerencial…”; servidor “recusa…” | Aprovado |
| Validação | Valor fora da escala, 9 fora de Q19–Q26, categoria inexistente | unit “valores fora da escala…” | Aprovado |
| Validação | Campo adicional (timestamp, e-mail, IP), campo ausente, `__proto__`, parâmetros de URL | unit “estrutura diferente…”; servidor | Aprovado |
| Validação | Tipo incorreto (`"3"` em vez de 3, decimal, objeto) | unit; servidor | Aprovado |
| Validação | Texto com acentos, aspas, HTML, emoji, quebra de linha, fórmula | unit; e2e (exibição escapada); servidor (apóstrofo) | Aprovado |
| Validação | Texto acima de 2.000 caracteres e caracteres de controle | unit; servidor | Aprovado |
| Validação | Campo aberto limitado a 2.000 caracteres, com contador “N de 2000 caracteres”; texto colado acima do limite é contido | e2e “questões abertas: limite de 2.000…” | Aprovado |
| Envio | Duplo clique gera uma única requisição; botão desabilitado e `aria-busy` | e2e “envio único…” | Aprovado |
| Envio | Voltar no histórico após o envio não permite reenviar | e2e “envio único…” | Aprovado |
| Envio | Falha de rede e erro do servidor exibem a mensagem do manual; nova tentativa funciona | e2e “falha de rede…” | Aprovado |
| Envio | Bloqueio (LockService) impede gravação sem trava | servidor “concorrência…” | Aprovado |
| Envio | Primeira submissão na linha 2; linhas seguintes em sequência; 42 colunas | servidor “grava uma linha…” | Aprovado |
| Privacidade | Requisição POST `text/plain`, sem cookie e sem referer; corpo só com `concluido` e Q01–Q39 | e2e “requisição…” | Aprovado |
| Privacidade | Sem cookies, localStorage, sessionStorage, IndexedDB; código sem APIs de data, geolocalização ou agente do usuário | e2e “privacidade no navegador…” | Aprovado |
| Privacidade | Conteúdo das respostas ausente dos logs do servidor | servidor “grava uma linha…” | Aprovado |
| Privacidade | Resposta do servidor sem linha, identificador ou conteúdo; motivo só em desenvolvimento | servidor | Aprovado |
| Feedback | Máximo de 3 temas por bloco; Q19–Q26 nunca aparecem; 4 e 5 não sinalizam | unit; e2e “feedback…” | Aprovado |
| Feedback | Bloco gerencial só com Q08 = 1 | unit “bloco gerencial somente…” | Aprovado |
| Feedback | Cursos só se conferidos e ligados ao tema (atualmente nenhum) | unit “cursos somente se conferidos…” | Aprovado |
| Feedback | Nenhuma requisição após o envio; temas não enviados | e2e “feedback…” | Aprovado |
| Feedback | PDF gerado no dispositivo (`blob:`), válido, com acentuação, sem metadados de data | e2e; unit “PDF local…” | Aprovado |
| Feedback | “Encerrar e apagar a visualização” remove o resumo; voltar não o recupera | e2e “feedback…” | Aprovado |
| Painel | Menos de 5 submissões: nada exibido | unit; template | Aprovado |
| Painel | Células 1–4 como “<5” e supressão complementar; bloco gerencial suprimido com base < 5 | unit “painel: células…” | Aprovado |
| Painel | Texto bruto das abertas e linhas individuais ausentes; sem formulário, filtro ou exportação | unit; template “painel: renderiza…” | Aprovado |
| Painel | NSA fora da mediana/IIQ; ausentes reportados | unit | Aprovado |
| Painel | Autenticação (acesso “somente eu”) | manifesto `access: MYSELF` + verificação de conta | **Manual** |
| Dispositivos | iPhone 13, Pixel 7, iPad Mini, 1366×768 e 320 px sem rolagem horizontal; fluxo completo | e2e “dispositivo…” (5 casos) | Aprovado (emulado) |
| Dispositivos | Teclado: Tab, Enter, Espaço, setas; foco no título; rótulos associados | e2e “teclado…” | Aprovado |
| Dispositivos | Aparelhos reais e leitores de tela (NVDA, VoiceOver, TalkBack) | — | **Manual** |
| Exportação | 42 colunas, domínios, Q08, coluna adicional detectada, SHA-256 | `testes/test_exportacao.py` | Aprovado |
| Exportação | Exportação real do Google Planilhas + criptografia + conferência | — | **Manual** |
| Ambientes | Pré-teste com página, TCLE, esquema (55 campos) e endpoint próprios | e2e “pré-teste…”; servidor “pré-teste…” | Aprovado |
| Ambientes | Desenvolvimento só grava em planilha DESENVOLVIMENTO; produção nunca nela; abas cruzadas recusadas | servidor “separação de ambientes…” | Aprovado |
| Liberação | Produção/pré-teste sem parecer ou endpoint: “Coleta não liberada” (interface) e `indisponivel` (servidor) | e2e “produção sem parecer…”; servidor | Aprovado |
| Liberação | Trava de publicação bloqueia config, parecer, endpoint, versão e PDFs pendentes | `ferramentas/verificar_liberacao.py` (executado: BLOQUEADA nas duas etapas) | Aprovado |
| Encerramento | `COLETA_ATIVA = nao` recusa e não grava; `doGet` informa inativo | servidor “endpoint desativado…” | Aprovado |
| Encerramento | Arquivamento da implantação, exclusão de projeto, planilha, lixeira e página | — | **Manual** |
| Esquema | Instrumento gerado da matriz (41 questões, ordem, redação) e 42 colunas iguais à planilha | `gerar_instrumento.py` + unit “instrumento…” + CI | Aprovado |

## Testes manuais pendentes (implantação real, dados fictícios)

Registrar para cada um: versão, data, responsável, cenário, resultado e evidência (capturas sem respostas reais).

1. **Apps Script de desenvolvimento**: `idcgtTesteConfiguracao` → “CONFEREM”; envio fictício pela interface
   grava uma linha na linha 2 com as 42 colunas e sem coluna extra; `{"status":"ok"}` no navegador.
2. **Validação real**: enviar com `curl` um corpo com campo adicional e um com Q09 = 7 ao endpoint de
   desenvolvimento → `validacao` e nenhuma linha nova.
3. **Fórmula**: enviar `=1+1` numa aberta → célula mostra o texto `=1+1`, não `2`.
4. **Concorrência**: dois navegadores enviando ao mesmo tempo → duas linhas distintas.
5. **Logs**: Apps Script → Execuções: nenhuma linha com conteúdo de resposta.
6. **Painel**: abrir com a conta da pesquisa (ok) e em janela anônima/outra conta (acesso negado);
   com 4 linhas fictícias → nada exibido; com 6 → agregados com “<5”.
7. **Dispositivos reais**: computador (Chrome/Edge/Firefox), celular Android e iPhone, tablet;
   leitor de tela em pelo menos um deles.
8. **Exportação**: baixar `.xlsx`, `verificar_exportacao.py` → CONFORME; criptografar; reabrir; conferir SHA-256.
9. **Desativação**: `COLETA_ATIVA = nao` → interface mostra erro; arquivar implantação → URL não responde.
10. **Descarte (ensaio)**: excluir projeto e planilha de desenvolvimento, esvaziar lixeira, despublicar página de teste.

## Não conformidades e correções durante o desenvolvimento

| Achado | Correção | Reteste |
|---|---|---|
| Navegação dependia do evento assíncrono `hashchange`; um clique rápido podia atingir a tela anterior | Navegação interna síncrona (`history.pushState` + renderização imediata) | e2e completo aprovado |
| Limite das abertas alterado de 5.000 para 2.000 caracteres (decisão do pesquisador, 27/11/2026) | Valor único em `compartilhado/validacao.js`, copiado para interface e Apps Script; ferramenta de exportação lê o mesmo valor | Suíte completa aprovada |
