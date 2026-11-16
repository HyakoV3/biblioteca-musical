#!/usr/bin/env python3
"""Testes de tools/montar-pacote.py.

Uso:  python3 tools/test_montar_pacote.py
"""
import contextlib
import importlib.util
import io
import json
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

AQUI = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("montar_pacote", AQUI / "montar-pacote.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

SVG = '<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>'


def hinario(*numeros):
    return {"versao": 1, "hinario": {"id": "x", "nome": "X"}, "hinos": [{"numero": n, "titulo": f"H{n}"} for n in numeros]}


class NumeroDoSvg(unittest.TestCase):
    def test_nomes_que_o_app_aceita(self):
        self.assertEqual(m.numero_do_svg("hino-1.svg"), 1)
        self.assertEqual(m.numero_do_svg("hino-283.svg"), 283)
        self.assertEqual(m.numero_do_svg("hino-999999999.svg"), 999999999)

    def test_nomes_que_o_app_recusaria(self):
        for nome in ("hino-0.svg", "hino-01.svg", "hino-1.SVG", "hino-1.svg.bak", "hino-.svg", "hino-1000000000.svg",
                     "hino-1.timemap.json", "x-hino-1.svg", "hino-1a.svg", "hino-١.svg", "Leipzig.woff2"):
            self.assertIsNone(m.numero_do_svg(nome), nome)


class Juntar(unittest.TestCase):
    def test_preenche_partitura_so_nos_hinos_que_tem_svg(self):
        novo, com, sobrando = m.juntar(hinario(1, 2, 3), {1: "a", 3: "c"})
        self.assertEqual(com, [1, 3])
        self.assertEqual(sobrando, [])
        self.assertEqual([h.get("partitura") for h in novo["hinos"]], ["partituras/hino-1.svg", None, "partituras/hino-3.svg"])

    def test_nao_altera_o_que_recebeu(self):
        original = hinario(1)
        m.juntar(original, {1: "a"})
        self.assertNotIn("partitura", original["hinos"][0])

    def test_substitui_uma_partitura_que_ja_estava_no_json(self):
        h = hinario(1)
        h["hinos"][0]["partitura"] = "outro/caminho.pdf"
        novo, _, _ = m.juntar(h, {1: "a"})
        self.assertEqual(novo["hinos"][0]["partitura"], "partituras/hino-1.svg")

    def test_svg_de_hino_que_nao_existe_vai_para_sobrando(self):
        _, com, sobrando = m.juntar(hinario(1), {1: "a", 9: "i", 7: "g"})
        self.assertEqual((com, sobrando), ([1], [7, 9]))

    def test_json_sem_hinos_ou_hino_sem_numero_e_erro(self):
        for ruim in ({}, {"hinos": []}, {"hinos": "x"}, {"hinos": [{"titulo": "A"}]}, {"hinos": [{"numero": "1"}]}, {"hinos": [3]}):
            with self.assertRaises(ValueError, msg=str(ruim)):
                m.juntar(ruim, {})


class Zip(unittest.TestCase):
    def monta(self, tmp: Path, numeros_json, numeros_svg, extra=()):
        hin = tmp / "hinario.json"
        hin.write_text(json.dumps(hinario(*numeros_json), ensure_ascii=False), encoding="utf-8")
        pasta = tmp / "svgs"
        pasta.mkdir()
        for n in numeros_svg:
            (pasta / f"hino-{n}.svg").write_text(SVG, encoding="utf-8")
        for nome in extra:
            (pasta / nome).write_text(SVG, encoding="utf-8")
        saida = tmp / "saida" / "pacote.zip"
        err = io.StringIO()
        with mock.patch.object(sys, "argv", ["montar-pacote.py", str(hin), str(pasta), str(saida)]), \
                contextlib.redirect_stdout(io.StringIO()) as out, contextlib.redirect_stderr(err):
            codigo = m.principal()
        return codigo, saida, out.getvalue(), err.getvalue()

    def test_zip_com_os_nomes_que_o_app_aceita_e_o_json_primeiro(self):
        with tempfile.TemporaryDirectory() as t:
            codigo, saida, out, _ = self.monta(Path(t), [1, 2, 283], [283, 1])
            self.assertEqual(codigo, 0)
            with zipfile.ZipFile(saida) as z:
                self.assertEqual(z.namelist(), ["hinario.json", "partituras/hino-1.svg", "partituras/hino-283.svg"])
                self.assertIsNone(z.testzip())
                j = json.loads(z.read("hinario.json"))
                self.assertEqual([h.get("partitura") for h in j["hinos"]], ["partituras/hino-1.svg", None, "partituras/hino-283.svg"])
                self.assertEqual(z.read("partituras/hino-1.svg").decode(), SVG)
            self.assertIn("3 hinos, 2 com partitura (1 sem)", out)

    def test_e_reproduzivel(self):
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            _, s1, _, _ = self.monta(Path(a), [1, 2], [1, 2])
            _, s2, _, _ = self.monta(Path(b), [1, 2], [1, 2])
            self.assertEqual(s1.read_bytes(), s2.read_bytes())

    def test_acentos_ficam_como_estao_no_json(self):
        with tempfile.TemporaryDirectory() as t:
            tmp = Path(t)
            (tmp / "svgs").mkdir()
            (tmp / "h.json").write_text(json.dumps({"hinos": [{"numero": 1, "titulo": "Ó Senhor"}]}, ensure_ascii=False), encoding="utf-8")
            with mock.patch.object(sys, "argv", ["x", str(tmp / "h.json"), str(tmp / "svgs"), str(tmp / "p.zip")]), \
                    contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(m.principal(), 0)
            with zipfile.ZipFile(tmp / "p.zip") as z:
                self.assertIn("Ó Senhor", z.read("hinario.json").decode("utf-8"))

    def test_avisa_e_ignora_nome_ruim_e_svg_sem_hino(self):
        with tempfile.TemporaryDirectory() as t:
            codigo, saida, _, err = self.monta(Path(t), [1], [1, 9], extra=["hino-01.svg", "leia-me.svg"])
            self.assertEqual(codigo, 0)
            with zipfile.ZipFile(saida) as z:
                self.assertEqual(z.namelist(), ["hinario.json", "partituras/hino-1.svg"])
            self.assertIn("hino-01.svg ignorado", err)
            self.assertIn("leia-me.svg ignorado", err)
            self.assertIn("hino-9.svg ignorado (o hinario.json não tem o hino 9)", err)

    def test_sem_nenhum_svg_gera_so_o_json(self):
        with tempfile.TemporaryDirectory() as t:
            codigo, saida, out, _ = self.monta(Path(t), [1, 2], [])
            self.assertEqual(codigo, 0)
            with zipfile.ZipFile(saida) as z:
                self.assertEqual(z.namelist(), ["hinario.json"])
            self.assertIn("0 com partitura", out)

    def test_entradas_ruins_dao_erro_sem_criar_o_zip(self):
        with tempfile.TemporaryDirectory() as t:
            tmp = Path(t)
            (tmp / "svgs").mkdir()
            ruins = {"inexistente.json": None, "lixo.json": "{ quebrado", "lista.json": "[1,2]", "vazio.json": '{"hinos": []}'}
            for nome, conteudo in ruins.items():
                if conteudo is not None:
                    (tmp / nome).write_text(conteudo, encoding="utf-8")
                saida = tmp / f"{nome}.zip"
                with mock.patch.object(sys, "argv", ["x", str(tmp / nome), str(tmp / "svgs"), str(saida)]), \
                        contextlib.redirect_stderr(io.StringIO()):
                    self.assertEqual(m.principal(), 2, nome)
                self.assertFalse(saida.exists(), nome)
            with mock.patch.object(sys, "argv", ["x", str(tmp / "lixo.json"), str(tmp / "nao-existe"), str(tmp / "z.zip")]), \
                    contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(m.principal(), 2)


if __name__ == "__main__":
    sys.exit(0 if unittest.main(exit=False).result.wasSuccessful() else 1)
