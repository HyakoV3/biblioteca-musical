#!/usr/bin/env python3
"""Testes de tools/montar-pacote.py e tools/montar-manifesto-partituras.py.

Uso:  python3 tools/test_montar_pacote.py
"""
import contextlib
import hashlib
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


def carrega(nome, arquivo):
    spec = importlib.util.spec_from_file_location(nome, AQUI / arquivo)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


m = carrega("montar_pacote", "montar-pacote.py")
mm = carrega("montar_manifesto", "montar-manifesto-partituras.py")

SVG = '<svg xmlns="http://www.w3.org/2000/svg"><g/></svg>'


class NumeroDoSvg(unittest.TestCase):
    def test_nomes_que_o_app_aceita(self):
        self.assertEqual(m.numero_do_svg("hino-1.svg"), (1, False))
        self.assertEqual(m.numero_do_svg("hino-283.svg"), (283, False))
        self.assertEqual(m.numero_do_svg("hino-999999999.svg"), (999999999, False))
        self.assertEqual(m.numero_do_svg("hino-1-paisagem.svg"), (1, True))
        self.assertEqual(m.numero_do_svg("hino-283-paisagem.svg"), (283, True))

    def test_nomes_que_o_app_recusaria(self):
        for nome in ("hino-0.svg", "hino-01.svg", "hino-1.SVG", "hino-1.svg.bak", "hino-.svg", "hino-1000000000.svg",
                     "hino-1.timemap.json", "hino-1-paisagem.timemap.json", "x-hino-1.svg", "hino-1a.svg", "hino-١.svg", "Leipzig.woff2",
                     "hinario.json", "hino-0-paisagem.svg", "hino-01-paisagem.svg", "hino--paisagem.svg", "hino-1-Paisagem.svg",
                     "hino-1-retrato.svg", "hino-1-paisagem-paisagem.svg", "hino-1paisagem.svg", "hino-1-paisagem.svg.bak"):
            self.assertIsNone(m.numero_do_svg(nome), nome)

    def test_o_nome_no_zip_e_o_que_o_rust_le(self):
        self.assertEqual(m.nome_no_zip(283, False), "partituras/hino-283.svg")
        self.assertEqual(m.nome_no_zip(283, True), "partituras/hino-283-paisagem.svg")


class Zip(unittest.TestCase):
    def monta(self, tmp: Path, nomes_svg, extra=()):
        pasta = tmp / "svgs"
        pasta.mkdir()
        for nome in nomes_svg:
            nome = nome if isinstance(nome, str) else f"hino-{nome}.svg"
            (pasta / nome).write_text(SVG + nome, encoding="utf-8")  # conteúdo diferente por arquivo
        for nome in extra:
            (pasta / nome).write_text(SVG, encoding="utf-8")
        saida = tmp / "saida" / "pacote.zip"
        out, err = io.StringIO(), io.StringIO()
        with mock.patch.object(sys, "argv", ["montar-pacote.py", str(pasta), str(saida)]), \
                contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            codigo = m.principal()
        return codigo, saida, out.getvalue(), err.getvalue()

    def test_so_os_svg_com_os_nomes_que_o_app_aceita_e_nunca_o_hinario_json(self):
        with tempfile.TemporaryDirectory() as t:
            codigo, saida, out, _ = self.monta(Path(t), [283, 1, 276])
            self.assertEqual(codigo, 0)
            with zipfile.ZipFile(saida) as z:
                self.assertEqual(z.namelist(), ["partituras/hino-1.svg", "partituras/hino-276.svg", "partituras/hino-283.svg"])
                self.assertIsNone(z.testzip())
                self.assertEqual(z.read("partituras/hino-1.svg").decode(), SVG + "hino-1.svg")
            self.assertIn("3 partituras (0 com versão de paisagem)", out)

    def test_leva_o_retrato_e_a_paisagem_de_cada_hino_na_ordem_certa(self):
        with tempfile.TemporaryDirectory() as t:
            codigo, saida, out, err = self.monta(Path(t), ["hino-283-paisagem.svg", "hino-283.svg", "hino-1.svg", "hino-1-paisagem.svg", "hino-276.svg"])
            self.assertEqual(codigo, 0, err)
            with zipfile.ZipFile(saida) as z:
                self.assertEqual(z.namelist(), ["partituras/hino-1.svg", "partituras/hino-1-paisagem.svg", "partituras/hino-276.svg",
                                                "partituras/hino-283.svg", "partituras/hino-283-paisagem.svg"])
                # cada nome leva o arquivo certo (a paisagem não troca de lugar com o retrato)
                self.assertEqual(z.read("partituras/hino-283-paisagem.svg").decode(), SVG + "hino-283-paisagem.svg")
                self.assertEqual(z.read("partituras/hino-283.svg").decode(), SVG + "hino-283.svg")
            self.assertIn("3 partituras (2 com versão de paisagem)", out)

    def test_paisagem_sem_o_retrato_e_ignorada_com_aviso(self):
        with tempfile.TemporaryDirectory() as t:
            codigo, saida, out, err = self.monta(Path(t), ["hino-1.svg", "hino-2-paisagem.svg"])
            self.assertEqual(codigo, 0)
            with zipfile.ZipFile(saida) as z:
                self.assertEqual(z.namelist(), ["partituras/hino-1.svg"])
            self.assertIn("hino-2-paisagem.svg ignorado (falta o hino-2.svg", err)
            self.assertIn("1 partituras (0 com versão de paisagem)", out)

    def test_so_paisagens_nao_geram_pacote(self):
        with tempfile.TemporaryDirectory() as t:
            codigo, saida, _, _ = self.monta(Path(t), ["hino-1-paisagem.svg"])
            self.assertEqual(codigo, 2)
            self.assertFalse(saida.exists())

    def test_e_reproduzivel(self):
        with tempfile.TemporaryDirectory() as a, tempfile.TemporaryDirectory() as b:
            _, s1, _, _ = self.monta(Path(a), ["hino-1.svg", "hino-1-paisagem.svg", "hino-2.svg"])
            _, s2, _, _ = self.monta(Path(b), ["hino-1.svg", "hino-1-paisagem.svg", "hino-2.svg"])
            self.assertEqual(s1.read_bytes(), s2.read_bytes())

    def test_nao_leva_o_timemap(self):
        with tempfile.TemporaryDirectory() as t:
            _, saida, _, err = self.monta(Path(t), [1], extra=["hino-1.timemap.json", "hino-1-paisagem.timemap.json"])
            with zipfile.ZipFile(saida) as z:
                self.assertEqual(z.namelist(), ["partituras/hino-1.svg"])

    def test_avisa_e_ignora_nome_ruim(self):
        with tempfile.TemporaryDirectory() as t:
            codigo, saida, _, err = self.monta(Path(t), [1], extra=["hino-01.svg", "leia-me.svg"])
            self.assertEqual(codigo, 0)
            with zipfile.ZipFile(saida) as z:
                self.assertEqual(z.namelist(), ["partituras/hino-1.svg"])
            self.assertIn("hino-01.svg ignorado", err)
            self.assertIn("leia-me.svg ignorado", err)

    def test_sem_nenhum_svg_ou_pasta_inexistente_da_erro_sem_criar_o_zip(self):
        with tempfile.TemporaryDirectory() as t:
            tmp = Path(t)
            (tmp / "vazia").mkdir()
            for pasta in (tmp / "vazia", tmp / "nao-existe"):
                saida = tmp / "z.zip"
                with mock.patch.object(sys, "argv", ["x", str(pasta), str(saida)]), contextlib.redirect_stderr(io.StringIO()):
                    self.assertEqual(m.principal(), 2, str(pasta))
                self.assertFalse(saida.exists())


class Manifesto(unittest.TestCase):
    def zip_de_teste(self, tmp: Path) -> Path:
        z = tmp / "p.zip"
        with zipfile.ZipFile(z, "w") as f:
            f.writestr("partituras/hino-1.svg", SVG)
        return z

    def test_tamanho_e_sha256_do_arquivo(self):
        with tempfile.TemporaryDirectory() as t:
            z = self.zip_de_teste(Path(t))
            r = mm.montar("https://fb.hm.hv2.xyz/public/api/resources/download?hash=abc", z)
            dados = z.read_bytes()
            self.assertEqual(r, {"versao": 1, "pacote": {"url": "https://fb.hm.hv2.xyz/public/api/resources/download?hash=abc",
                                                          "arquivo": "p.zip", "bytes": len(dados),
                                                          "sha256": hashlib.sha256(dados).hexdigest()}})

    def test_link_ruim_e_arquivo_que_nao_e_zip_dao_erro(self):
        with tempfile.TemporaryDirectory() as t:
            tmp = Path(t)
            z = self.zip_de_teste(tmp)
            for link in ("", "http://x/p.zip", "https://", "ftp://x", "x.zip", "https://x /p.zip", "https://x\n/p.zip"):
                with self.assertRaises(ValueError, msg=repr(link)):
                    mm.montar(link, z)
            nao = tmp / "nao.zip"
            nao.write_bytes(b"isto nao e um zip")
            with self.assertRaises(ValueError):
                mm.montar("https://x/p.zip", nao)

    def test_escreve_o_arquivo_e_o_app_le_de_volta(self):
        with tempfile.TemporaryDirectory() as t:
            tmp = Path(t)
            z = self.zip_de_teste(tmp)
            saida = tmp / "sub" / "manifesto.json"
            with mock.patch.object(sys, "argv", ["x", "https://x/p.zip", str(z), "--saida", str(saida)]), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(mm.principal(), 0)
            lido = json.loads(saida.read_text(encoding="utf-8"))
            self.assertEqual(lido["pacote"]["bytes"], z.stat().st_size)
            self.assertRegex(lido["pacote"]["sha256"], r"^[0-9a-f]{64}$")

    def test_erro_nao_escreve_nada(self):
        with tempfile.TemporaryDirectory() as t:
            tmp = Path(t)
            saida = tmp / "manifesto.json"
            with mock.patch.object(sys, "argv", ["x", "http://x/p.zip", str(self.zip_de_teste(tmp)), "--saida", str(saida)]), \
                    contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(mm.principal(), 2)
            self.assertFalse(saida.exists())

    def test_o_manifesto_que_vai_no_app_e_o_valido(self):
        # o do repositório: sem pacote publicado ou com um pacote bem formado
        lido = json.loads(mm.PADRAO.read_text(encoding="utf-8"))
        self.assertEqual(lido["versao"], 1)
        if lido["pacote"] is not None:
            self.assertTrue(lido["pacote"]["url"].startswith("https://"))
            self.assertRegex(lido["pacote"]["sha256"], r"^[0-9a-f]{64}$")
            self.assertRegex(lido["pacote"]["arquivo"], r"^[\w.-]+\.zip$")
            self.assertGreater(lido["pacote"]["bytes"], 0)


if __name__ == "__main__":
    sys.exit(0 if unittest.main(exit=False).result.wasSuccessful() else 1)
