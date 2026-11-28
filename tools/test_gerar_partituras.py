#!/usr/bin/env python3
"""Testes da parte pura de tools/gerar-partituras.py (não precisam do MuseScore nem do Verovio).

Uso:  python3 tools/test_gerar_partituras.py
"""
import argparse
import contextlib
import importlib.util
import io
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
from partituras.gravacao import SUFIXO_PAISAGEM  # noqa: E402

spec = importlib.util.spec_from_file_location("gerar_partituras", AQUI / "gerar-partituras.py")
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)

class NumeroDoHino(unittest.TestCase):
    def test_nomes_validos(self):
        self.assertEqual(g.numero_do_hino("hino-283.mscx"), 283)
        self.assertEqual(g.numero_do_hino("hino-1.mscx"), 1)

    def test_nomes_que_nao_sao_hino(self):
        for nome in ("hino-.mscx", "hino-2a.mscx", "hino-283.mscz", "x-hino-283.mscx", "hino-283.mscx.bak", "283.mscx"):
            self.assertIsNone(g.numero_do_hino(nome), nome)


class InteiroPositivo(unittest.TestCase):
    def test_aceita_inteiros_maiores_que_zero(self):
        self.assertEqual(g.inteiro_positivo("700"), 700)
        self.assertEqual(g.inteiro_positivo("1"), 1)

    def test_rejeita_zero_negativo_e_o_que_nao_e_inteiro(self):
        for texto in ("0", "-1", "-700", "abc", "", "1.5", "7e2"):
            with self.assertRaises(argparse.ArgumentTypeError, msg=texto):
                g.inteiro_positivo(texto)


class OpcoesVerovio(unittest.TestCase):
    def test_repassa_largura_e_escala(self):
        o = g.opcoes_verovio(700, 40)
        self.assertEqual((o["pageWidth"], o["scale"]), (700, 40))
        o = g.opcoes_verovio(900, 33)
        self.assertEqual((o["pageWidth"], o["scale"]), (900, 33))

    def test_saida_do_svg_e_a_que_o_app_aceita(self):
        o = g.opcoes_verovio(700, 40)
        # sem a fonte embutida (um @font-face com url(data:...) que o app recusa) e sem xlink:href
        self.assertEqual(o["smuflTextFont"], "none")
        self.assertIs(o["svgRemoveXlink"], True)
        # uma página só, com viewBox, e sem indentação
        self.assertIs(o["adjustPageHeight"], True)
        self.assertIs(o["svgViewBox"], True)
        self.assertIs(o["svgFormatRaw"], True)
        # a letra sai da partitura: as opções de letra do Verovio não existem mais
        for chave in o:
            self.assertNotIn("lyric", chave.lower(), chave)

    def test_as_larguras_padrao_sao_700_no_retrato_e_1200_na_paisagem(self):
        # medido nos hinos de amostra (ver o cabeçalho de tools/gerar-partituras.py): 500 dava 1 compasso por linha
        self.assertEqual((g.LARGURA_RETRATO, g.LARGURA_PAISAGEM), (700, 1200))
        self.assertLess(g.LARGURA_RETRATO, g.LARGURA_PAISAGEM)

    def test_o_nome_da_paisagem_e_o_que_o_app_le(self):
        self.assertEqual(SUFIXO_PAISAGEM, "-paisagem")  # src-tauri/src/pacote.rs: hino-<n>-paisagem.svg


class FalsoToolkit:
    """Faz as vezes do verovio.toolkit()."""

    def __init__(self, le=True, paginas=1):
        self.le, self.paginas, self.lido = le, paginas, None
        self.largura = None
        self.larguras_vistas = []

    def setOptions(self, opcoes):
        self.largura = opcoes["pageWidth"]

    def loadData(self, texto):
        self.lido = texto
        self.larguras_vistas.append(self.largura)
        return self.le

    def getPageCount(self):
        return self.paginas

    def renderToSVG(self, pagina):
        return f"<svg w={self.largura}>é</svg>"

    def renderToTimemap(self, opcoes):
        return [{"qstamp": 0}]


class GerarHino(unittest.TestCase):
    def roda(self, tk, musicxml="<score/>", versoes=None, escala=40):
        versoes = versoes if versoes is not None else [("", 700), ("-paisagem", 1200)]
        with tempfile.TemporaryDirectory() as t:
            trabalho, saida = Path(t) / "trab", Path(t) / "out"
            trabalho.mkdir()
            saida.mkdir()

            def run(cmd, **k):
                if musicxml is not None:
                    Path(cmd[cmd.index("-o") + 1]).write_bytes(musicxml if isinstance(musicxml, bytes) else musicxml.encode())
                return subprocess.CompletedProcess(cmd, 0, "", "")

            try:
                with mock.patch.object(subprocess, "run", run):
                    resultado = g.gerar_hino(g.Lote(tk, ["mscore"], trabalho, saida, escala, versoes, 5), 5, Path("hino-5.mscx"))
            finally:
                self.arquivos = {p.name: p.read_bytes() for p in saida.iterdir()}
            return resultado, sorted(self.arquivos)

    def test_sucesso_grava_as_duas_versoes_com_o_seu_timemap_e_devolve_os_tamanhos(self):
        medidas, arquivos = self.roda(FalsoToolkit())
        self.assertEqual(arquivos, ["hino-5-paisagem.svg", "hino-5-paisagem.timemap.json", "hino-5.svg", "hino-5.timemap.json"])
        self.assertEqual(len(medidas), 2)
        (svg_r, gz_r, tm_r), (svg_p, gz_p, tm_p) = medidas
        self.assertEqual(svg_r, len("<svg w=700>é</svg>".encode()))  # bytes UTF-8, não caracteres
        self.assertEqual(svg_p, len("<svg w=1200>é</svg>".encode()))
        self.assertGreater(gz_r, 0)
        self.assertGreater(tm_r, 0)

    def test_cada_versao_e_desenhada_na_sua_largura_e_o_arquivo_certo_leva_o_desenho_certo(self):
        tk = FalsoToolkit()
        self.roda(tk)
        self.assertEqual(tk.larguras_vistas, [700, 1200], "o Verovio desenha de novo, na largura de cada versão")
        self.assertEqual(self.arquivos["hino-5.svg"], "<svg w=700>é</svg>".encode())
        self.assertEqual(self.arquivos["hino-5-paisagem.svg"], "<svg w=1200>é</svg>".encode())

    def roda_sobre(self, tk, antigos, versoes):
        """Como `roda`, mas a pasta de saída já tem arquivos de uma rodada anterior (nome -> bytes). Devolve o que ficou nela."""
        with tempfile.TemporaryDirectory() as t:
            trabalho, saida = Path(t) / "trab", Path(t) / "out"
            trabalho.mkdir()
            saida.mkdir()
            for nome, dados in antigos.items():
                (saida / nome).write_bytes(dados)

            def run(cmd, **k):
                Path(cmd[cmd.index("-o") + 1]).write_bytes(b"<score/>")
                return subprocess.CompletedProcess(cmd, 0, "", "")

            self.erro = None
            try:
                with mock.patch.object(subprocess, "run", run):
                    g.gerar_hino(g.Lote(tk, ["mscore"], trabalho, saida, 40, versoes, 5), 5, Path("hino-5.mscx"))
            except g.ErroHino as e:
                self.erro = e
            return {p.name: p.read_bytes() for p in saida.iterdir()}

    def test_so_retrato_apaga_a_paisagem_e_o_timemap_dela_de_uma_rodada_anterior(self):
        antigos = {"hino-5.svg": b"v", "hino-5.timemap.json": b"v", "hino-5-paisagem.svg": b"velha", "hino-5-paisagem.timemap.json": b"velho",
                   "hino-6-paisagem.svg": b"de outro hino", "leia-me.txt": b"x"}
        ficou = self.roda_sobre(FalsoToolkit(), antigos, [("", 700)])
        self.assertEqual(sorted(ficou), ["hino-5.svg", "hino-5.timemap.json", "hino-6-paisagem.svg", "leia-me.txt"])
        self.assertEqual(ficou["hino-5.svg"], "<svg w=700>é</svg>".encode(), "o retrato é o novo")
        self.assertEqual(ficou["hino-6-paisagem.svg"], b"de outro hino", "só mexe nos arquivos do hino que está gerando")

    def test_com_as_duas_versoes_nada_e_apagado_alem_do_que_e_regravado(self):
        antigos = {"hino-5.svg": b"v", "hino-5-paisagem.svg": b"v", "hino-6.svg": b"outro"}
        ficou = self.roda_sobre(FalsoToolkit(), antigos, [("", 700), ("-paisagem", 1200)])
        self.assertEqual(sorted(ficou), ["hino-5-paisagem.svg", "hino-5-paisagem.timemap.json", "hino-5.svg", "hino-5.timemap.json", "hino-6.svg"])
        self.assertEqual(ficou["hino-5-paisagem.svg"], "<svg w=1200>é</svg>".encode())

    def test_se_o_desenho_falha_a_rodada_anterior_fica_como_estava(self):
        antigos = {"hino-5.svg": b"v", "hino-5-paisagem.svg": b"velha", "hino-5-paisagem.timemap.json": b"velho"}
        ficou = self.roda_sobre(FalsoToolkit(le=False), antigos, [("", 700)])
        self.assertIsNotNone(self.erro, "o desenho falhou")
        self.assertEqual(ficou, antigos, "uma rodada que falha não apaga nada (a paisagem antiga só sai quando o retrato novo foi gravado)")

    def test_so_retrato_nao_gera_a_paisagem(self):
        tk = FalsoToolkit()
        medidas, arquivos = self.roda(tk, versoes=[("", 700)])
        self.assertEqual(arquivos, ["hino-5.svg", "hino-5.timemap.json"])
        self.assertEqual((len(medidas), tk.larguras_vistas), (1, [700]))

    def test_a_escala_e_a_largura_chegam_ao_verovio(self):
        class Espiao(FalsoToolkit):
            def setOptions(self, opcoes):
                super().setOptions(opcoes)
                self.escalas = getattr(self, "escalas", []) + [opcoes["scale"]]

        tk = Espiao()
        self.roda(tk, escala=33)
        self.assertEqual(tk.escalas, [33, 33])

    def test_o_verovio_recebe_o_xml_sem_a_letra_nas_duas_versoes(self):
        tk = FalsoToolkit()
        self.roda(tk, musicxml="<n><lyric><text>nho</text></lyric><pitch/></n>")
        self.assertEqual(tk.lido, "<n><pitch/></n>")
        self.assertEqual(len(tk.larguras_vistas), 2)

    def test_verovio_que_nao_le_e_erro_do_hino_e_nao_grava_nada(self):
        with self.assertRaisesRegex(g.ErroHino, "Verovio não leu"):
            self.roda(FalsoToolkit(le=False))
        self.assertEqual(self.arquivos, {})

    def test_mais_de_uma_pagina_e_erro_do_hino(self):
        with self.assertRaisesRegex(g.ErroHino, "2 páginas"):
            self.roda(FalsoToolkit(paginas=2))

    def test_falha_so_na_paisagem_nao_deixa_o_retrato_sozinho(self):
        # o hino sai inteiro ou não sai: um retrato sem a paisagem do mesmo lote seria um pacote pela metade
        class FalhaNaSegunda(FalsoToolkit):
            def loadData(self, texto):
                super().loadData(texto)
                return len(self.larguras_vistas) < 2

        with self.assertRaisesRegex(g.ErroHino, r"Verovio não leu o MusicXML \(paisagem\)"):
            self.roda(FalhaNaSegunda())
        self.assertEqual(self.arquivos, {}, "nem o retrato, que deu certo, fica no disco")

    def test_falha_do_musescore_vira_erro_do_hino_com_o_motivo(self):
        with self.assertRaisesRegex(g.ErroHino, "não gerou o MusicXML"):
            self.roda(FalsoToolkit(), musicxml=None)

    def test_musicxml_em_outra_codificacao_vira_erro_do_hino(self):
        with self.assertRaisesRegex(g.ErroHino, "UnicodeDecodeError"):
            self.roda(FalsoToolkit(), musicxml=b"\xff\xfe\xfa")


class Principal(unittest.TestCase):
    def roda(self, *argumentos):
        erro = io.StringIO()
        with mock.patch.object(sys, "argv", ["gerar-partituras", *argumentos]), contextlib.redirect_stderr(erro):
            return g.principal(), erro.getvalue()

    def test_entrada_que_nao_e_pasta_e_erro_2(self):
        codigo, erro = self.roda("/nao/existe", "saida")
        self.assertEqual(codigo, 2)
        self.assertEqual(erro, "erro: /nao/existe não é uma pasta\n")

    def test_pasta_sem_hinos_e_erro_2(self):
        with tempfile.TemporaryDirectory() as t:
            (Path(t) / "hino-1.mscz").write_text("x")
            codigo, erro = self.roda(t, "saida")
        self.assertEqual(codigo, 2)
        self.assertEqual(erro, f"erro: nenhum hino-<número>.mscx em {t}\n")


class Processar(unittest.TestCase):
    VERSOES = [("", 700), ("-paisagem", 1200)]

    def lote(self, versoes=None):
        return g.Lote(None, ["m"], Path("t"), Path("s"), 40, versoes or self.VERSOES)

    def test_um_hino_ruim_nao_para_os_outros_e_conta_a_falha(self):
        def falso(lote, n, mscx):
            if n == 2:
                raise g.ErroHino("deu ruim")
            return [(100 * n, 10, 5), (200 * n, 20, 5)]

        erro = io.StringIO()
        with mock.patch.object(g, "gerar_hino", falso), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(erro):
            falhas, total = g.processar(self.lote(), [(1, Path("a")), (2, Path("b")), (3, Path("c"))])
        self.assertEqual(falhas, 1)
        self.assertEqual(total, 100 + 200 + 300 + 600, "soma as duas versões só dos que deram certo")
        self.assertIn("2  FALHOU: deu ruim", erro.getvalue())

    def test_tudo_certo_nao_conta_falhas_e_a_tabela_mostra_as_duas_versoes(self):
        saida = io.StringIO()
        with mock.patch.object(g, "gerar_hino", lambda *a, **k: [(50, 5, 1), (80, 8, 1)]), contextlib.redirect_stdout(saida):
            r = g.processar(self.lote(), [(1, Path("a")), (2, Path("b"))])
        self.assertEqual(r, (0, 260))
        cabecalho = saida.getvalue().splitlines()[0]
        self.assertIn("SVG retrato", cabecalho)
        self.assertIn("SVG paisagem", cabecalho)

    def test_so_retrato_mostra_so_uma_coluna(self):
        saida = io.StringIO()
        with mock.patch.object(g, "gerar_hino", lambda *a, **k: [(50, 5, 1)]), contextlib.redirect_stdout(saida):
            r = g.processar(self.lote([("", 700)]), [(1, Path("a"))])
        self.assertEqual(r, (0, 50))
        self.assertNotIn("paisagem", saida.getvalue())

if __name__ == "__main__":
    sys.exit(0 if unittest.main(exit=False).result.wasSuccessful() else 1)
