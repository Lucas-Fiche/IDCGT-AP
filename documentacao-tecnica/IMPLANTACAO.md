# Implantação do sistema IDCGT-AP

> **Condição ética.** Os passos 1 a 4 podem ser executados agora, somente com dados fictícios.
> Os passos 5 a 7 (pré-teste, produção e publicação) dependem da decisão ética favorável
> e do Termo de Conformidade Técnica assinado.

## Arquitetura

| Camada | Onde fica | Observação |
|---|---|---|
| Interface | `site/` publicada no GitHub Pages | HTML, CSS e JavaScript sem bibliotecas externas, sem cookies e sem armazenamento local |
| Recebimento | 3 projetos Apps Script separados (`apps-script/coleta/`) | desenvolvimento, pré-teste e produção, cada um com sua planilha |
| Armazenamento temporário | 3 planilhas Google separadas | aba `Base_Respostas` (42 colunas) ou `Base_PreTeste` (55 colunas) |
| Painel | 1 projeto Apps Script separado (`apps-script/painel/`) | acesso “Somente eu”, somente agregados |

Identificadores de planilha, parecer e totais do RH ficam **somente** nas Propriedades do script.
O único dado de configuração publicado é o endereço `/exec` do recebimento, que é público por natureza.

## 1. Conta da pesquisa

1. Use a conta Google **exclusiva da pesquisa**, com verificação em duas etapas ativa.
2. Não compartilhe a senha nem adicione outros editores às planilhas ou projetos.
3. Todas as etapas abaixo são feitas nessa conta.

## 2. Planilhas

| Ambiente | Arquivo de origem | Nome no Google Drive |
|---|---|---|
| Desenvolvimento | `planilhas-modelo/IDCGT_AP_DESENVOLVIMENTO_Base_Respostas.xlsx` | deve conter **DESENVOLVIMENTO** |
| Pré-teste | `planilhas-modelo/IDCGT_AP_PreTeste_Base.xlsx` | não pode conter DESENVOLVIMENTO |
| Produção | `02_MATRIZ_E_BANCO/Base_Respostas_IDCGT_AP_RBCIP_Coleta_Principal.xlsx` | não pode conter DESENVOLVIMENTO |

Para cada uma: enviar ao Drive → abrir com Google Planilhas → **Arquivo > Salvar como Planilhas Google**
→ excluir o `.xlsx` enviado → conferir que a aba e a primeira linha não mudaram.
Não use Google Forms nem “Respostas” vinculadas: eles criam coluna de carimbo de data e hora.

O Apps Script recusa a gravação se o nome da aba, os cabeçalhos ou o número de colunas forem diferentes,
se uma planilha de desenvolvimento for usada por outro ambiente (ou o contrário), ou se a planilha
principal contiver a aba do pré-teste (ou o contrário).

O identificador da planilha é o trecho entre `/d/` e `/edit` no endereço. **Não o copie para o repositório.**

## 3. Projetos Apps Script de recebimento (um por ambiente)

Para cada ambiente, crie um projeto independente em <https://script.google.com> (Novo projeto):

1. **Configurações do projeto** → marque “Mostrar o arquivo de manifesto appsscript.json”.
2. Crie os arquivos e cole o conteúdo do repositório:
   - `Codigo.gs` ← `apps-script/coleta/Codigo.gs`
   - `Instrumento.gs` ← `apps-script/coleta/Instrumento.gs`
   - `Validacao.gs` ← `apps-script/coleta/Validacao.gs`
   - `appsscript.json` ← `apps-script/coleta/appsscript.json`
3. **Configurações do projeto → Propriedades do script**:

| Propriedade | Desenvolvimento | Pré-teste | Produção |
|---|---|---|---|
| `MODO` | `desenvolvimento` | `pre_teste` | `principal` |
| `PLANILHA_ID` | ID da planilha DESENVOLVIMENTO | ID da planilha do pré-teste | ID da planilha principal |
| `COLETA_ATIVA` | `sim` | `nao` até o início do pré-teste | `nao` até a abertura |
| `PARECER_FAVORAVEL` | (vazio) | número e data | número e data |

4. Execute `idcgtTesteConfiguracao` no editor e autorize o acesso (escopo único: planilhas).
   O registro deve mostrar “planilha e cabeçalhos CONFEREM”.
5. **Implantar → Nova implantação → App da Web**: “Executar como: **eu**”; “Quem pode acessar: **qualquer pessoa**”.
   Copie a URL terminada em `/exec`. Anote no registro interno a URL e o número da versão.
6. Sem parecer preenchido, os projetos de pré-teste e de produção respondem `indisponivel` e não gravam nada.

Atualizações de código exigem **Gerenciar implantações → Editar → Nova versão** (a URL é mantida).

## 4. Testes com dados fictícios

1. Em `site/assets/js/config.js` (ambiente `desenvolvimento`), preencha `endpoint` com a URL `/exec`
   do projeto de **desenvolvimento** apenas na cópia local de testes, ou mantenha vazio para o modo demonstração.
2. Sirva localmente: `npm run servir` e abra <http://localhost:8080>.
3. Execute os testes automatizados: `npm test` (ver `RELATORIO_TESTES.md`).
4. Execute os testes manuais do relatório em computador, tablet e celular.

## 5. Painel administrativo (projeto separado)

1. Novo projeto Apps Script com `Painel.gs`, `Agregacao.gs`, `Instrumento.gs`, `Validacao.gs`,
   `Painel.html` e `appsscript.json` de `apps-script/painel/`.
2. Propriedades: `PLANILHA_ID` (planilha a resumir), `PARECER_FAVORAVEL`, e opcionalmente
   `N_ELEGIVEIS` e `N_CONVIDADOS` (totais agregados informados pelo RH, sem lista nominal).
3. Implantar como App da Web: “Executar como: **eu**”; “Quem pode acessar: **somente eu**”.
4. Guarde a URL do painel apenas no registro interno. Ela não deve ir para o repositório.
5. O painel tem permissão somente de leitura da planilha.

## 6. Pré-teste (após decisão ética favorável)

1. Substitua o campo reservado do parecer no DOCX do TCLE do pré-teste, gere o PDF e substitua
   `site/assets/documentos/pre-teste/03_TCLE_PRE_TESTE.pdf`.
2. Em `site/pre-teste/config.js`: `ambiente: 'pre_teste'`, `endpoint` do projeto do **pré-teste**,
   `parecer` e `versao` (ex.: `1.0.0`).
3. No projeto do pré-teste: `PARECER_FAVORAVEL` preenchido e `COLETA_ATIVA = sim`.
4. Publique pelo workflow **Publicar no GitHub Pages** com a etapa `pre_teste` (ver item 7).
5. Envie aos cinco participantes externos apenas o endereço `/pre-teste/` e o código P1 a P5.
   Não registre em nenhum lugar qual pessoa recebeu qual código: o código não deve ser ligado
   a nome ou e-mail. O formulário não pede nenhum dos dois.
6. Ao final: `COLETA_ATIVA = nao`, exportação e descarte conforme o manual operacional.

## 7. Produção (após pré-teste concluído e Termo de Conformidade assinado)

1. Substitua o campo reservado do parecer no TCLE principal (DOCX → PDF) e em
   `site/assets/documentos/01_TCLE_APLICACAO_PRINCIPAL.pdf`.
2. Em `site/assets/js/config.js`: `ambiente: 'producao'`, `endpoint` do projeto de **produção**,
   `parecer`, `versao` congelada.
3. Execute `python3 ferramentas/verificar_liberacao.py principal` — deve terminar sem pendências.
4. No GitHub: **Settings → Pages → Source: GitHub Actions**. Depois, **Actions → Publicar no
   GitHub Pages → Run workflow**, etapa `principal` e a frase de confirmação.
   A etapa `principal` não publica a página nem os documentos do pré-teste.
5. No projeto de produção: `COLETA_ATIVA = sim` somente no momento da abertura.
6. Não faça envio de teste ao endpoint de produção: qualquer envio vira uma linha do banco real.
   A verificação de produção é feita pelo `idcgtTesteConfiguracao` e pelo `doGet` (`recebimento: ativo`).

## Separação entre ambientes

| Controle | Como é garantido |
|---|---|
| Página | `/` (principal) e `/pre-teste/` (pré-teste), com configs e TCLEs próprios; a publicação `principal` remove `/pre-teste/` |
| Endpoint | um projeto Apps Script por ambiente; `verificar_liberacao.py` bloqueia endpoints iguais |
| Planilha | `MODO` + verificação de nome e abas no servidor |
| Esquema | o endpoint principal recusa os 13 campos do pré-teste; o do pré-teste exige os 55 campos |
| Sistema histórico de especialistas | nenhum código, planilha ou endpoint é compartilhado com ele |
