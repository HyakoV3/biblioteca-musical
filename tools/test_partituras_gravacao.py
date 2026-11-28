#!/usr/bin/env python3
"""Testes de tools/partituras/gravacao.py (versões a gerar e gravação segura).

Uso:  python3 tools/test_partituras_gravacao.py
"""
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
from partituras import gravacao as g  # noqa: E402

class Versoes(unittest.TestCase):
    def test_retrato_e_paisagem_por_padrao_e_so_retrato_se_pedido(self):
        self.assertEqual(g.versoes(700, 1200), [("", 700), ("-paisagem", 1200)])
        self.assertEqual(g.versoes(700, None), [("", 700)])
        self.assertEqual(g.versoes(650, 1300), [("", 650), ("-paisagem", 1300)])


class Gravar(unittest.TestCase):
    def test_grava_todos_os_arquivos_sem_deixar_temporario(self):
        with tempfile.TemporaryDirectory() as t:
            saida = Path(t)
            g.gravar(saida, {"hino-7.svg": b"<svg/>", "hino-7.timemap.json": b"[1,2]", "hino-7-paisagem.svg": b"<g/>"})
            self.assertEqual((saida / "hino-7.svg").read_bytes(), b"<svg/>")
            self.assertEqual((saida / "hino-7.timemap.json").read_bytes(), b"[1,2]")
            self.assertEqual((saida / "hino-7-paisagem.svg").read_bytes(), b"<g/>")
            self.assertEqual(sorted(p.name for p in saida.iterdir()), ["hino-7-paisagem.svg", "hino-7.svg", "hino-7.timemap.json"])

    def test_substitui_o_que_ja_existia(self):
        with tempfile.TemporaryDirectory() as t:
            saida = Path(t)
            (saida / "hino-7.svg").write_bytes(b"velho")
            g.gravar(saida, {"hino-7.svg": b"novo"})
            self.assertEqual((saida / "hino-7.svg").read_bytes(), b"novo")

    def test_falha_na_escrita_no_meio_nao_deixa_arquivo_nem_temporario(self):
        with tempfile.TemporaryDirectory() as t:
            saida = Path(t)
            original = Path.write_bytes
            chamadas = []

            def falha_na_terceira(self, dados):
                chamadas.append(self.name)
                if len(chamadas) == 3:
                    raise OSError("disco cheio")
                return original(self, dados)

            with mock.patch.object(Path, "write_bytes", falha_na_terceira):
                with self.assertRaises(OSError):
                    g.gravar(saida, {"a.svg": b"1", "b.svg": b"2", "c.svg": b"3", "d.svg": b"4"})
            self.assertEqual(list(saida.iterdir()), [], "não pode sobrar nenhum dos quatro, nem o .tmp")

if __name__ == "__main__":
    sys.exit(0 if unittest.main(exit=False).result.wasSuccessful() else 1)
