# Sistema IDCGT-AP — RBCIP

Sistema on-line da aplicação do IDCGT-AP na RBCIP (CAAE 01258726.4.0000.5540).
Interface no **GitHub Pages**, transmissão por **Google Apps Script** e armazenamento temporário em
**Google Planilhas** (aba `Base_Respostas`, 42 colunas).

> **Situação: em desenvolvimento, não liberado.** Somente dados fictícios. A página pública, o endpoint
> de produção, o pré-teste, o recrutamento e a coleta dependem da decisão ética favorável e do
> Termo de Conformidade Técnica. A publicação é bloqueada automaticamente enquanto houver pendência.

## Estrutura

```
site/                     interface pública (única pasta publicada no Pages)
  index.html              apresentação → consentimento → questionário → revisão → feedback → conclusão
  privacidade/            aviso de privacidade (HTML + PDF)
  pre-teste/              página exclusiva do pré-teste (TCLE, config e endpoint próprios)
  admin/                  aviso estático; o painel real fica no Apps Script
  assets/js/              app, validação, instrumento (gerado), feedback local, PDF local
  assets/documentos/      PDFs públicos (TCLE, aviso, documentos do pré-teste)
apps-script/coleta/       recebimento (um projeto por ambiente)
apps-script/painel/       painel agregado autenticado (projeto separado, acesso "somente eu")
compartilhado/            fonte de instrumento.js e validacao.js (copiados para site/ e apps-script/)
ferramentas/              geração do instrumento, planilhas-modelo, verificação de exportação e trava de liberação
planilhas-modelo/         planilhas de desenvolvimento e de pré-teste
testes/                   testes unitários, servidor simulado, navegador (Playwright) e exportação
documentacao-tecnica/     implantação, manual operacional, decisões técnicas e relatório de testes
00_… a 06_…               pacote documental original da pesquisa
```

## Uso rápido

```bash
npm run gerar      # regenera o instrumento a partir da matriz-mestre
npm run servir     # http://localhost:8080 (modo demonstração: nada é transmitido)
npm test           # 57 testes automatizados
```

## Garantias implementadas

- 41 questões (Q01–Q39 com Q29a, Q29b, Q31a, Q31b) geradas da aba `Dicionario_Itens`, sem reescrita.
- Consentimento obrigatório para abrir o questionário; recusa encerra sem nenhuma requisição.
- Nenhuma pergunta obrigatória; vazios permanecem vazios.
- Q27–Q34 exibidas e enviadas somente com Q08 = 1 (cliente e servidor).
- Revisão com voltar, alterar, deixar vazio e cancelar; envio único após confirmação; `concluido = 1`.
- Sem login, cookies, armazenamento local, identificadores, data/hora, IP, geolocalização ou dispositivo.
- Servidor aceita exatamente as 42 chaves, valida domínios, tipos, lógica de Q08 e tamanho dos textos,
  confere os cabeçalhos da planilha e usa bloqueio na gravação.
- Feedback individual opcional calculado no navegador, nunca transmitido; PDF gerado no dispositivo.
- Painel somente agregado, autenticado, com supressão de células menores que cinco.
- Pré-teste com página, endpoint, planilha e esquema próprios.

Detalhes: [`documentacao-tecnica/`](documentacao-tecnica/).

## Repositórios

Este repositório contém documentos internos e deve permanecer **privado** (decisão do pesquisador,
27/11/2026). Na publicação, será usado um **repositório público novo**, contendo apenas o conteúdo
de `site/` (interface e PDFs destinados aos participantes). Até lá, o GitHub Pages, o pré-teste e a
coleta real permanecem desativados.

## Pendências que não foram preenchidas por suposição

- Número e data da decisão ética favorável (`config.js`, PDFs e propriedades do Apps Script).
- URL definitiva da página e das implantações do Apps Script; identificadores das planilhas.
- Responsável técnico, data da liberação e versão congelada.
- Resultado do pré-teste e eventuais alterações.
- Lista de cursos EV.G conferidos (hoje nenhum curso é exibido).
- Confirmação das decisões marcadas em `documentacao-tecnica/DECISOES_TECNICAS.md`.
