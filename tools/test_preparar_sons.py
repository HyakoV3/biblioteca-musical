#!/usr/bin/env python3
"""Testes de caracterização de tools/preparar-sons.py, com um banco sintético minúsculo.

Uso:  python3 tools/test_preparar_sons.py
"""
import contextlib
import importlib.util
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

AQUI = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("preparar_sons", AQUI / "preparar-sons.py")
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)


def banco(pasta: Path, nome: str, notas: dict):
    """Grava `<nome>-mp3.js` no formato do midi-js-soundfonts."""
    pasta.mkdir(parents=True, exist_ok=True)
    (pasta / f"{nome}-mp3.js").write_text(p.escrever(nome, notas), encoding="utf-8")


def roda(*args):
    """Roda main() com argv; devolve (código de saída ou None, stdout)."""
    saida = io.StringIO()
    codigo = None
    with mock.patch.object(sys, "argv", ["preparar-sons.py", *args]), contextlib.redirect_stdout(saida):
        try:
            p.main()
        except SystemExit as e:
            codigo = e.code
    return codigo, saida.getvalue()


class Notas(unittest.TestCase):
    def test_midi(self):
        self.assertEqual(p.midi("C4"), 60)
        self.assertEqual(p.midi("Db4"), 61)
        self.assertEqual(p.midi("A#3"), 58)
        with self.assertRaises(ValueError):
            p.midi("H4")

    def test_ida_e_volta(self):
        notas = {"C4": "AAA", "Db4": "BBB"}
        self.assertEqual(p.ler_como_o_smplr(p.escrever("flute", notas)), notas)


class Principal(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.entrada = self.dir / "in"
        banco(self.entrada, "flute", {"C1": "AAA", "A1": "BBB", "Db4": "CCC", "C4": "DDD", "C9": "EEE"})
        banco(self.entrada, "organ", {"C4": "FFF", "E4": "GGG"})

    def tearDown(self):
        self.tmp.cleanup()

    def test_corta_a_faixa_e_grava_manifesto(self):
        saida = self.dir / "out"
        codigo, texto = roda("--entrada", str(self.entrada), "--saida", str(saida), "--faixa", "40", "70", "--pacote", "p1", "--banco", "B1", "--aplicar")
        self.assertIsNone(codigo)
        m = json.loads((saida / "manifesto.json").read_text(encoding="utf-8"))
        self.assertEqual({k: m[k] for k in ("versao", "pacote", "banco", "faixa")}, {"versao": 1, "pacote": "p1", "banco": "B1", "faixa": [40, 70]})
        self.assertEqual([(a["instrumento"], a["arquivo"], a["notas"]) for a in m["arquivos"]],
                         [("flute", "flute-mp3.js", 2), ("organ", "organ-mp3.js", 2)])
        flauta = (saida / "flute-mp3.js").read_text(encoding="utf-8")
        self.assertEqual(p.ler_como_o_smplr(flauta), {"Db4": "CCC", "C4": "DDD"})
        self.assertEqual(m["arquivos"][0]["bytes"], len(flauta.encode("utf-8")))
        linhas = texto.splitlines()
        self.assertTrue(linhas[0].startswith("flute            5 ->   2 notas | "))
        self.assertTrue(linhas[1].startswith("organ            2 ->   2 notas | "))
        self.assertTrue(linhas[2].startswith(f"2 arquivo(s), 0.00 MB no total, manifesto em {saida / 'manifesto.json'}"))

    def test_so_os_instrumentos_pedidos(self):
        saida = self.dir / "out"
        codigo, _ = roda("--entrada", str(self.entrada), "--saida", str(saida), "--instrumentos", "organ", "--aplicar")
        self.assertIsNone(codigo)
        self.assertEqual([a["instrumento"] for a in json.loads((saida / "manifesto.json").read_text())["arquivos"]], ["organ"])
        self.assertFalse((saida / "flute-mp3.js").exists())

    def test_instrumento_sem_arquivo(self):
        codigo, _ = roda("--entrada", str(self.entrada), "--saida", str(self.dir / "o"), "--instrumentos", "organ", "zzz", "aaa")
        self.assertEqual(codigo, "instrumento(s) sem arquivo de entrada: aaa, zzz")

    def test_entrada_vazia(self):
        vazia = self.dir / "vazia"
        vazia.mkdir()
        codigo, _ = roda("--entrada", str(vazia), "--saida", str(self.dir / "o"))
        self.assertEqual(codigo, f"nenhum *-mp3.js em {vazia} (rode tools/baixar-sons-teste.sh)")

    def test_nenhuma_nota_na_faixa(self):
        codigo, _ = roda("--entrada", str(self.entrada), "--saida", str(self.dir / "o"), "--faixa", "100", "110")
        self.assertEqual(codigo, "flute: nenhuma nota na faixa 100 a 110")


if __name__ == "__main__":
    unittest.main()
