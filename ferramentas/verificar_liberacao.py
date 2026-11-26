#!/usr/bin/env python3
"""Trava de liberação: impede publicar a página de pré-teste ou de produção
enquanto houver pendência ética ou técnica verificável no repositório.

Uso: python3 ferramentas/verificar_liberacao.py pre_teste|principal

Confere:
  - config.js da etapa no ambiente correto ("pre_teste" ou "producao");
  - parecer favorável preenchido (sem o texto INSERIR);
  - endpoint no formato https://script.google.com/macros/s/<id>/exec;
  - endpoints do pré-teste e da produção diferentes entre si;
  - PDFs públicos da etapa sem o campo reservado do parecer;
  - versão do sistema preenchida e sem sufixo "-dev".
Não substitui o Termo de Conformidade Técnica assinado.
"""
import pathlib
import re
import subprocess
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SITE = RAIZ / "site"
ENDPOINT = re.compile(r"^https://script\.google\.com/macros/s/[\w-]+/exec$")


def ler_config(caminho):
    txt = caminho.read_text(encoding="utf-8")
    def campo(nome):
        m = re.search(nome + r"\s*:\s*'([^']*)'", txt)
        return m.group(1) if m else ""
    return {k: campo(k) for k in ("modo", "ambiente", "endpoint", "parecer", "versao")}


def pdf_tem_pendencia(caminho):
    try:
        texto = subprocess.run(["pdftotext", str(caminho), "-"], capture_output=True, text=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        return "não foi possível ler o PDF (instale poppler-utils)"
    if "INSERIR" in texto.upper():
        return "o PDF ainda contém o campo reservado do parecer"
    return None


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ("pre_teste", "principal"):
        sys.exit(__doc__)
    etapa = sys.argv[1]
    principal = ler_config(SITE / "assets/js/config.js")
    pre = ler_config(SITE / "pre-teste/config.js")
    cfg, esperado = (pre, "pre_teste") if etapa == "pre_teste" else (principal, "producao")
    pdfs = (["assets/documentos/pre-teste/03_TCLE_PRE_TESTE.pdf"] if etapa == "pre_teste"
            else ["assets/documentos/01_TCLE_APLICACAO_PRINCIPAL.pdf"])
    pdfs.append("assets/documentos/02_AVISO_PRIVACIDADE_E_DADOS.pdf")

    erros = []
    if cfg["ambiente"] != esperado:
        erros.append(f"config.js: ambiente deve ser '{esperado}' (atual: '{cfg['ambiente']}').")
    if not cfg["parecer"].strip() or "INSERIR" in cfg["parecer"].upper():
        erros.append("config.js: parecer favorável não preenchido.")
    if not ENDPOINT.match(cfg["endpoint"]):
        erros.append("config.js: endpoint ausente ou fora do formato /macros/s/<id>/exec.")
    if pre["endpoint"] and principal["endpoint"] and pre["endpoint"] == principal["endpoint"]:
        erros.append("Pré-teste e produção usam o MESMO endpoint.")
    if not cfg["versao"] or cfg["versao"].endswith("-dev"):
        erros.append("config.js: versão congelada não registrada.")
    for p in pdfs:
        problema = pdf_tem_pendencia(SITE / p)
        if problema:
            erros.append(f"{p}: {problema}.")

    if erros:
        print("LIBERAÇÃO BLOQUEADA:")
        for e in erros:
            print(" -", e)
        sys.exit(1)
    print(f"Verificações automáticas da etapa '{etapa}' concluídas. "
          "Confirme também o Termo de Conformidade Técnica assinado.")


if __name__ == "__main__":
    main()
