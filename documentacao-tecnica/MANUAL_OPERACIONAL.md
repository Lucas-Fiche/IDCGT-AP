# Manual operacional

Procedimentos de ativação, desativação, exportação, substituição de documentos, revisão de
permissões e descarte. Todos executados na conta exclusiva da pesquisa.

## Ativar o recebimento

1. Confirme a decisão ética, o Termo de Conformidade assinado e a versão congelada.
2. Projeto Apps Script do ambiente → Propriedades do script → `COLETA_ATIVA = sim`.
3. Abra a URL `/exec` no navegador: deve mostrar `{"servico":"IDCGT-AP","recebimento":"ativo"}`.

## Desativar o recebimento (imediato)

1. `COLETA_ATIVA = nao`. A partir desse momento toda submissão recebe `encerrada` e nada é gravado.
2. A interface exibirá a mensagem de erro de envio; nenhuma resposta é considerada recebida.
3. Para desativação definitiva: **Implantar → Gerenciar implantações → Arquivar** a implantação.
   A URL `/exec` deixa de responder.
4. Retire a página: no GitHub, **Settings → Pages → Unpublish site** (ou desative o GitHub Pages).

## Exportar o banco

1. Desative o recebimento (acima).
2. Planilha → **Arquivo → Fazer download → Microsoft Excel (.xlsx)**, salvando em pasta local
   **fora** de qualquer pasta sincronizada (OneDrive, Google Drive, Dropbox, iCloud).
3. Verifique a exportação:
   ```bash
   python3 ferramentas/verificar_exportacao.py /caminho/local/exportacao.xlsx
   ```
   O resultado deve ser `CONFORME`. Registre o SHA-256 impresso.
4. Criptografe o arquivo (por exemplo, 7-Zip com AES-256 e “criptografar nomes de arquivo”, ou um
   volume VeraCrypt), com senha forte guardada apenas pelo pesquisador.
5. Abra o arquivo criptografado, confira que a planilha abre, que o SHA-256 do `.xlsx` extraído é o
   mesmo registrado e apague a cópia não criptografada.
6. Registre data, responsável, número de registros e SHA-256 no registro de exportação
   (sem qualquer resposta).

## Descarte em nuvem (somente após exportação íntegra)

1. Implantações arquivadas nos projetos de recebimento e do painel.
2. Projetos Apps Script excluídos (Visão geral → Remover projeto).
3. Planilhas excluídas do Drive e **lixeira esvaziada**.
4. Página despublicada no GitHub Pages; se a coleta terminou, também o workflow de publicação desativado.
5. Conferência: a URL `/exec` não responde; a URL da página retorna 404; as planilhas não aparecem
   na busca do Drive nem na lixeira.
6. Registre a data de cada etapa no checklist de encerramento (Checklist C24 da matriz).

Os registros de execução do Apps Script (data, duração e status de cada chamada, sem conteúdo das
respostas) são registros de infraestrutura do Google e são removidos com o projeto.

## Substituir documentos públicos

1. Edite o DOCX em `06_EDITAVEIS/` (por exemplo, para inserir o parecer).
2. Exporte o PDF e substitua o arquivo correspondente em `03_DOCUMENTOS_PUBLICOS/` **e** em
   `site/assets/documentos/` (ou `site/assets/documentos/pre-teste/`).
3. Se o texto do TCLE mudar além do parecer, atualize também o modelo HTML em `site/index.html`
   (`<template id="tcle">`) ou `site/pre-teste/index.html`, mantendo a redação idêntica ao PDF.
   O número do parecer é inserido automaticamente a partir de `config.js`.
4. Execute `python3 ferramentas/verificar_liberacao.py <etapa>` e `npm test`.
5. Atualize a versão em `config.js` e registre a alteração.

## Alterar o instrumento

Somente com autorização do pesquisador (e apreciação ética, se substantiva).
Edite a matriz-mestre, depois:
```bash
python3 ferramentas/gerar_instrumento.py
npm test
```
Copie os novos `Instrumento.gs` e `Validacao.gs` para os projetos Apps Script e crie nova versão
das implantações.

## Liberar cursos EV.G no feedback individual

Na aba `Mapa_Cursos_EVG` da matriz, altere “Situação” para `Conferido` e preencha
“Data de verificação” somente nos cursos verificados. Execute `python3 ferramentas/gerar_instrumento.py`.
Cursos não conferidos nunca aparecem. Os cursos não aparecem no painel em nenhuma hipótese.

## Revisar permissões (antes da abertura e após cada alteração)

| Item | Verificação esperada |
|---|---|
| Conta | verificação em duas etapas ativa; nenhum dispositivo ou app desconhecido em “Segurança” |
| Planilhas | “Compartilhar” mostra somente a conta da pesquisa; acesso geral “Restrito” |
| Projetos Apps Script | sem outros editores; implantação de recebimento “qualquer pessoa”; painel “somente eu” |
| Repositório | nenhuma URL de painel, ID de planilha, senha ou dado real em commits |
| Logs | nenhuma linha com conteúdo de respostas em Execuções do Apps Script |

## Consultar o painel

Abra a URL do painel (registro interno) com a conta da pesquisa. Ele mostra somente agregados,
com contagens de 1 a 4 exibidas como “<5”. Resultados para a RBCIP e o orientador são produzidos
depois da depuração e da revisão de confidencialidade, fora do painel.
