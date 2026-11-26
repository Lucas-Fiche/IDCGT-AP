#!/usr/bin/env python3
"""Gera o instrumento do IDCGT-AP a partir da matriz-mestre.

Fonte única da redação, da ordem e dos códigos das 41 questões:
  02_MATRIZ_E_BANCO/Matriz_Implementacao_IDCGT_AP_RBCIP_CEP_18_11_2026.xlsx
  (abas Dicionario_Itens e Mapa_Cursos_EVG)

Esquema exato do banco:
  02_MATRIZ_E_BANCO/Base_Respostas_IDCGT_AP_RBCIP_Coleta_Principal.xlsx

Saídas (não editar à mão; execute novamente este script):
  compartilhado/instrumento.js   -> copiado para site/ e apps-script/
  site/assets/js/cursos.js       -> somente interface (feedback local)

Em seguida, copia os arquivos compartilhados para os destinos.

Uso:  python3 ferramentas/gerar_instrumento.py
"""
import hashlib
import json
import pathlib
import re
import shutil
import sys

import openpyxl

RAIZ = pathlib.Path(__file__).resolve().parent.parent
MATRIZ = RAIZ / "02_MATRIZ_E_BANCO" / "Matriz_Implementacao_IDCGT_AP_RBCIP_CEP_18_11_2026.xlsx"
BANCO = RAIZ / "02_MATRIZ_E_BANCO" / "Base_Respostas_IDCGT_AP_RBCIP_Coleta_Principal.xlsx"

TIPOS = {
    "Categórica": "categorica",
    "Categórica de triagem": "triagem",
    "Ordinal": "ordinal",
    "Texto": "texto",
}


def sha256(caminho):
    return hashlib.sha256(caminho.read_bytes()).hexdigest().upper()


def linha_cabecalho(linhas, primeira):
    for i, l in enumerate(linhas):
        if l and l[0] == primeira:
            return i
    sys.exit(f"Cabeçalho {primeira!r} não encontrado")


def opcoes(tipo, valores):
    """Converte a coluna Valores da matriz em lista de {valor, rotulo}."""
    if tipo == "texto":
        return []
    if tipo == "categorica":
        # Q01-Q07: o valor gravado é o próprio rótulo (aba Listas_Validacao).
        return [{"valor": v, "rotulo": v} for v in valores.split("|")]
    if tipo == "triagem":
        partes = valores.split("|")
    else:
        partes = [p.strip() for p in valores.split(";")]
    saida = []
    for p in partes:
        m = re.fullmatch(r"(\d+)=(.+)", p.strip())
        if not m:
            sys.exit(f"Valor não reconhecido na matriz: {p!r}")
        saida.append({"valor": int(m.group(1)), "rotulo": m.group(2).strip()})
    return saida


def ler_itens():
    ws = openpyxl.load_workbook(MATRIZ)["Dicionario_Itens"]
    linhas = list(ws.iter_rows(values_only=True))
    ini = linha_cabecalho(linhas, "Código")
    cab = list(linhas[ini])
    esperado = ["Código", "Bloco", "Texto do item", "Tipo", "Valores", "Condição",
                "Referente", "Feedback individual", "Análise institucional",
                "Competência/tema", "Regra/observação"]
    if cab != esperado:
        sys.exit(f"Cabeçalho inesperado em Dicionario_Itens: {cab}")
    itens = []
    for l in linhas[ini + 1:]:
        if not l[0]:
            continue
        d = dict(zip(cab, l))
        tipo = TIPOS[d["Tipo"]]
        cond = d["Condição"]
        if cond not in ("Sempre exibido", "Exibir se Q08=1"):
            sys.exit(f"Condição não prevista: {cond}")
        itens.append({
            "codigo": d["Código"],
            "bloco": d["Bloco"],
            "texto": d["Texto do item"],
            "tipo": tipo,
            "opcoes": opcoes(tipo, d["Valores"]),
            "condicao": "Q08=1" if cond == "Exibir se Q08=1" else None,
            "referente": d["Referente"],
            "feedback": d["Feedback individual"] == "Sim",
            "tema": d["Competência/tema"],
        })
    return itens


def ler_campos_banco():
    ws = openpyxl.load_workbook(BANCO)["Base_Respostas"]
    return [c for c in next(ws.iter_rows(max_row=1, values_only=True)) if c is not None]


def ler_cursos():
    ws = openpyxl.load_workbook(MATRIZ)["Mapa_Cursos_EVG"]
    linhas = list(ws.iter_rows(values_only=True))
    ini = linha_cabecalho(linhas, "Competência temática")
    cab = list(linhas[ini])
    cursos = []
    for l in linhas[ini + 1:]:
        if not l[0]:
            continue
        d = dict(zip(cab, l))
        situacao = (d["Situação"] or "").strip()
        cursos.append({
            "tema": d["Competência temática"],
            "itens": [i.strip() for i in str(d["Itens"]).split(";")],
            "id": str(d["ID curso"]),
            "nome": d["Nome do curso"],
            "cargaHoraria": d["Carga horária"],
            "link": d["Link oficial"],
            "situacao": situacao,
            # Somente cursos marcados como conferidos pelo pesquisador podem ser
            # exibidos. Para liberar um curso, altere a coluna "Situação" da
            # matriz para "Conferido" e preencha "Data de verificação".
            "conferido": situacao.lower() == "conferido" and bool(d["Data de verificação"]),
        })
    return cursos


def js(nome, obj, cabecalho):
    corpo = json.dumps(obj, ensure_ascii=False, indent=2)
    return f"{cabecalho}\nvar {nome} = {corpo};\n"


def main():
    itens = ler_itens()
    campos = ler_campos_banco()
    codigos = [i["codigo"] for i in itens]
    if len(itens) != 41:
        sys.exit(f"Esperadas 41 questões; encontradas {len(itens)}")
    if campos != ["concluido"] + codigos:
        sys.exit("Os 42 cabeçalhos da planilha de coleta não correspondem à ordem da matriz.")

    aviso = (
        "/* ARQUIVO GERADO por ferramentas/gerar_instrumento.py — não editar à mão.\n"
        f" * Matriz-mestre: {MATRIZ.name}\n * SHA-256: {sha256(MATRIZ)}\n"
        f" * Planilha de coleta: {BANCO.name}\n * SHA-256: {sha256(BANCO)}\n */"
    )
    instrumento = {
        "versaoMatriz": "2.0 — 18/11/2026",
        "campos": campos,
        "itens": itens,
    }
    comp = RAIZ / "compartilhado"
    comp.mkdir(exist_ok=True)
    (comp / "instrumento.js").write_text(js("IDCGT_INSTRUMENTO", instrumento, aviso), encoding="utf-8")

    cursos = ler_cursos()
    destino_cursos = RAIZ / "site" / "assets" / "js" / "cursos.js"
    destino_cursos.parent.mkdir(parents=True, exist_ok=True)
    destino_cursos.write_text(js("IDCGT_CURSOS", cursos, aviso), encoding="utf-8")

    copiar_compartilhados()
    print(f"OK: {len(itens)} questões, {len(campos)} colunas, {len(cursos)} cursos "
          f"({sum(c['conferido'] for c in cursos)} conferidos).")


def copiar_compartilhados():
    """Copia os arquivos compartilhados para a interface e os projetos Apps Script."""
    comp = RAIZ / "compartilhado"
    destinos = {
        "instrumento.js": [RAIZ / "site/assets/js/instrumento.js",
                           RAIZ / "apps-script/coleta/Instrumento.gs",
                           RAIZ / "apps-script/painel/Instrumento.gs"],
        "validacao.js": [RAIZ / "site/assets/js/validacao.js",
                         RAIZ / "apps-script/coleta/Validacao.gs",
                         RAIZ / "apps-script/painel/Validacao.gs"],
    }
    for nome, alvos in destinos.items():
        origem = comp / nome
        if not origem.exists():
            continue
        for alvo in alvos:
            alvo.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(origem, alvo)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--somente-copiar":
        copiar_compartilhados()
    else:
        main()
