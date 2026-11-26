"""Testa ferramentas/verificar_exportacao.py com exportações FICTÍCIAS."""
import pathlib
import shutil
import subprocess
import sys
import tempfile
import unittest

import openpyxl

RAIZ = pathlib.Path(__file__).resolve().parent.parent
MODELO = RAIZ / "02_MATRIZ_E_BANCO" / "Base_Respostas_IDCGT_AP_RBCIP_Coleta_Principal.xlsx"
FERRAMENTA = RAIZ / "ferramentas" / "verificar_exportacao.py"


def exportacao(linhas, extra_coluna=None):
    d = pathlib.Path(tempfile.mkdtemp())
    arq = d / "exportacao.xlsx"
    shutil.copyfile(MODELO, arq)
    wb = openpyxl.load_workbook(arq)
    ws = wb["Base_Respostas"]
    if extra_coluna:
        ws.cell(row=1, column=43, value=extra_coluna)
    for i, l in enumerate(linhas, start=2):
        for j, v in enumerate(l, start=1):
            ws.cell(row=i, column=j, value=v)
    wb.save(arq)
    return arq


def rodar(arq):
    return subprocess.run([sys.executable, str(FERRAMENTA), str(arq)], capture_output=True, text=True)


def linha(q08=1, **valores):
    cab = [c.value for c in openpyxl.load_workbook(MODELO)["Base_Respostas"][1]]
    base = {c: None for c in cab}
    base.update({"concluido": 1, "Q01": "Mulher", "Q08": q08, "Q09": 4, "Q19": 9, "Q35": "Texto fictício"})
    if q08 == 1:
        base["Q27"] = 3
    base.update(valores)
    return [base[c] for c in cab]


class TesteExportacao(unittest.TestCase):
    def test_conforme(self):
        r = rodar(exportacao([linha(), linha(q08=0), linha(q08=None)]))
        self.assertEqual(r.returncode, 0, r.stdout)
        self.assertIn("CONFORME", r.stdout)
        self.assertIn("SHA-256", r.stdout)
        self.assertNotIn("Texto fictício", r.stdout)

    def test_coluna_adicional(self):
        r = rodar(exportacao([linha()], extra_coluna="Carimbo de data/hora"))
        self.assertEqual(r.returncode, 1)

    def test_valor_fora_e_q08(self):
        self.assertEqual(rodar(exportacao([linha(Q09=7)])).returncode, 1)
        self.assertEqual(rodar(exportacao([linha(q08=0, Q27=2)])).returncode, 1)
        self.assertEqual(rodar(exportacao([linha(Q01="Outro valor")])).returncode, 1)


if __name__ == "__main__":
    unittest.main()
