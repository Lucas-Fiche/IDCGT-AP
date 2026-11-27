#!/usr/bin/env python3
"""Verifica a exportação do banco antes da criptografia e do descarte em nuvem.

Confere, sem exibir nenhuma resposta:
  - aba Base_Respostas (xlsx) ou arquivo CSV com exatamente as 42 colunas, na ordem;
  - nenhuma coluna adicional (timestamp, e-mail, IP etc.);
  - concluido = 1 em todas as linhas;
  - Q01–Q07 dentro das categorias da matriz; Q08 em {0,1,9};
  - escalas dentro dos códigos autorizados; vazios preservados;
  - Q27–Q34 vazias quando Q08 != 1;
  - textos abertos dentro do limite de caracteres;
e imprime o SHA-256 do arquivo para o registro de exportação.

Uso:
  python3 ferramentas/verificar_exportacao.py caminho/para/exportacao.xlsx
  python3 ferramentas/verificar_exportacao.py caminho/para/exportacao.csv
Sai com código 0 se tudo conferir; 1 caso contrário.
"""
import csv
import hashlib
import json
import pathlib
import re
import sys

import openpyxl

RAIZ = pathlib.Path(__file__).resolve().parent.parent


def ler_max_texto():
    """Lê o limite das abertas da validação compartilhada (fonte única)."""
    txt = (RAIZ / "compartilhado" / "validacao.js").read_text(encoding="utf-8")
    return int(re.search(r"var IDCGT_MAX_TEXTO = (\d+);", txt).group(1))


MAX_TEXTO = ler_max_texto()


def carregar_instrumento():
    txt = (RAIZ / "compartilhado" / "instrumento.js").read_text(encoding="utf-8")
    corpo = txt[txt.index("{"): txt.rindex("}") + 1]
    return json.loads(corpo)


def ler(caminho):
    if caminho.suffix.lower() == ".csv":
        with caminho.open(encoding="utf-8-sig", newline="") as f:
            linhas = list(csv.reader(f))
        return linhas[0], linhas[1:]
    wb = openpyxl.load_workbook(caminho, read_only=True, data_only=True)
    if "Base_Respostas" not in wb.sheetnames:
        raise SystemExit("ERRO: aba Base_Respostas não encontrada.")
    linhas = [list(l) for l in wb["Base_Respostas"].iter_rows(values_only=True)]
    cab = linhas[0]
    while cab and cab[-1] is None:
        cab = cab[:-1]
    corpo = [l for l in linhas[1:] if any(v not in (None, "") for v in l)]
    return cab, corpo


def normal(v):
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def main():
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    caminho = pathlib.Path(sys.argv[1])
    inst = carregar_instrumento()
    cab, linhas = ler(caminho)
    problemas = []
    if [normal(c) for c in cab] != inst["campos"]:
        problemas.append(f"Cabeçalhos diferentes do esquema de 42 colunas (encontradas {len(cab)}).")
    itens = {i["codigo"]: i for i in inst["itens"]}
    gerenciais = ["Q27", "Q28", "Q29a", "Q29b", "Q30", "Q31a", "Q31b", "Q32", "Q33", "Q34"]
    for n, linha in enumerate(linhas, start=2):
        extra = [v for v in linha[len(inst["campos"]):] if v not in (None, "")]
        if extra:
            problemas.append(f"Linha {n}: conteúdo fora das 42 colunas.")
        reg = {c: normal(linha[i]) if i < len(linha) else "" for i, c in enumerate(inst["campos"])}
        if reg["concluido"] != "1":
            problemas.append(f"Linha {n}: concluido diferente de 1.")
        for cod, item in itens.items():
            v = reg[cod]
            if v == "":
                continue
            if item["tipo"] == "texto":
                if len(v) > MAX_TEXTO:
                    problemas.append(f"Linha {n}: {cod} excede {MAX_TEXTO} caracteres.")
                continue
            permitidos = [str(o["valor"]) for o in item["opcoes"]]
            if v not in permitidos:
                problemas.append(f"Linha {n}: {cod} fora do domínio autorizado.")
        if reg["Q08"] != "1" and any(reg[g] != "" for g in gerenciais):
            problemas.append(f"Linha {n}: bloco gerencial preenchido sem Q08 = 1.")
    h = hashlib.sha256(caminho.read_bytes()).hexdigest().upper()
    print(f"Arquivo: {caminho.name}")
    print(f"Registros: {len(linhas)} | Colunas: {len(cab)}")
    print(f"SHA-256: {h}")
    if problemas:
        print("RESULTADO: NÃO CONFORME")
        for p in problemas:
            print(" -", p)
        sys.exit(1)
    print("RESULTADO: CONFORME (42 colunas, domínios válidos, lógica Q08 respeitada, sem colunas adicionais)")


if __name__ == "__main__":
    main()
