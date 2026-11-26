#!/usr/bin/env python3
"""Gera as planilhas-modelo dos ambientes de DESENVOLVIMENTO e de PRÉ-TESTE.

A planilha de PRODUÇÃO é a fornecida pelo pesquisador e não é alterada:
  02_MATRIZ_E_BANCO/Base_Respostas_IDCGT_AP_RBCIP_Coleta_Principal.xlsx

Saídas em planilhas-modelo/:
  IDCGT_AP_DESENVOLVIMENTO_Base_Respostas.xlsx  cópia exata do esquema de 42 colunas
                                                (o nome contém DESENVOLVIMENTO, exigido
                                                pelo Apps Script no modo desenvolvimento)
  IDCGT_AP_PreTeste_Base.xlsx                   aba Base_PreTeste: 42 colunas + código
                                                P1–P5 + PT01–PT12 (roteiro escrito)

Uso: python3 ferramentas/gerar_planilhas_ambientes.py
"""
import pathlib
import shutil
from copy import copy

import openpyxl
from openpyxl.worksheet.datavalidation import DataValidation

RAIZ = pathlib.Path(__file__).resolve().parent.parent
PRODUCAO = RAIZ / "02_MATRIZ_E_BANCO" / "Base_Respostas_IDCGT_AP_RBCIP_Coleta_Principal.xlsx"
SAIDA = RAIZ / "planilhas-modelo"
EXTRAS_PRE = ["codigo_pre_teste"] + [f"PT{i:02d}" for i in range(1, 13)]


def main():
    SAIDA.mkdir(exist_ok=True)
    dev = SAIDA / "IDCGT_AP_DESENVOLVIMENTO_Base_Respostas.xlsx"
    shutil.copyfile(PRODUCAO, dev)

    wb = openpyxl.load_workbook(PRODUCAO)
    ws = wb["Base_Respostas"]
    ws.title = "Base_PreTeste"
    inicio = ws.max_column + 1
    for i, nome in enumerate(EXTRAS_PRE):
        c = ws.cell(row=1, column=inicio + i, value=nome)
        c.font = copy(ws.cell(row=1, column=1).font)
        c.fill = copy(ws.cell(row=1, column=1).fill)
    col = openpyxl.utils.get_column_letter(inicio)
    dv = DataValidation(type="list", formula1='"P1,P2,P3,P4,P5"', allow_blank=True,
                        error="Valor fora do esquema autorizado para este campo.")
    dv.add(f"{col}2:{col}501")
    ws.add_data_validation(dv)
    pre = SAIDA / "IDCGT_AP_PreTeste_Base.xlsx"
    wb.save(pre)
    print(f"OK: {dev.name} (42 colunas) e {pre.name} ({ws.max_column} colunas)")


if __name__ == "__main__":
    main()
