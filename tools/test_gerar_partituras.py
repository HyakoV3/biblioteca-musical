#!/usr/bin/env python3
"""Testes da parte pura de tools/gerar-partituras.py (não precisam do MuseScore nem do Verovio).

Uso:  python3 tools/test_gerar_partituras.py
"""
import argparse
import contextlib
import importlib.util
import io
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

AQUI = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("gerar_partituras", AQUI / "gerar-partituras.py")
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)

# Os glifos de elisão do SMuFL (faixa privada do Unicode, invisíveis no editor): estreita, normal e larga.
ESTREITA, NORMAL, LARGA = chr(0xE550), chr(0xE551), chr(0xE552)


def texto_elisao(glifo):
    return f'<text font-family="MScore Text">{glifo}</text>'


class CorrigirElisao(unittest.TestCase):
    def test_troca_o_texto_da_fonte_privada_pelo_elemento_padrao(self):
        xml = f'<text>nho,</text>{texto_elisao(LARGA)}<text font-family="FreeSerif">em</text>'
        self.assertEqual(g.corrigir_elisao(xml), '<text>nho,</text><elision> </elision><text font-family="FreeSerif">em</text>')

    def test_troca_as_tres_larguras_do_padrao_smufl(self):
        for glifo in (ESTREITA, NORMAL, LARGA):
            self.assertEqual(g.corrigir_elisao(texto_elisao(glifo)), "<elision> </elision>", hex(ord(glifo)))

    def test_troca_todas_as_ocorrencias(self):
        um = texto_elisao(LARGA)
        self.assertEqual(g.corrigir_elisao(um + "x" + um), "<elision> </elision>x<elision> </elision>")

    def test_nao_mexe_em_outro_texto_nem_em_outra_fonte_nem_em_outro_glifo(self):
        for xml in ("<text>nho,</text>", '<text font-family="FreeSerif">em</text>', '<text font-family="MScore Text">a</text>',
                    f'<text font-family="Outra">{LARGA}</text>', texto_elisao(chr(0xE553)), texto_elisao(chr(0xE54F))):
            self.assertEqual(g.corrigir_elisao(xml), xml)


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


class AcharMusescore(unittest.TestCase):
    def setUp(self):
        self.entrada = Path("/ent")
        self.trabalho = Path("/trab")

    def test_o_argumento_vence_a_variavel_de_ambiente(self):
        with mock.patch.dict(os.environ, {"BMCCB_MUSESCORE": "do-ambiente"}):
            self.assertEqual(g.achar_musescore(self.entrada, self.trabalho, "meu mscore --x"), ["meu", "mscore", "--x"])

    def test_a_variavel_de_ambiente_vale_sem_argumento(self):
        with mock.patch.dict(os.environ, {"BMCCB_MUSESCORE": "do-ambiente"}):
            self.assertEqual(g.achar_musescore(self.entrada, self.trabalho, None), ["do-ambiente"])

    def test_usa_o_primeiro_comando_do_path(self):
        com = {"musescore4": "/usr/bin/musescore4", "musescore": "/usr/bin/musescore"}
        with mock.patch.dict(os.environ, {}, clear=False), mock.patch.object(g.shutil, "which", lambda c: com.get(c)):
            os.environ.pop("BMCCB_MUSESCORE", None)
            self.assertEqual(g.achar_musescore(self.entrada, self.trabalho, None), ["musescore4"])

    def test_flatpak_pede_acesso_as_duas_pastas(self):
        class Ok:
            returncode = 0

        with mock.patch.object(g.shutil, "which", lambda c: "/usr/bin/flatpak" if c == "flatpak" else None), \
                mock.patch.object(g.subprocess, "run", lambda *a, **k: Ok()):
            os.environ.pop("BMCCB_MUSESCORE", None)
            cmd = g.achar_musescore(self.entrada, self.trabalho, None)
        self.assertEqual(cmd, ["flatpak", "run", "--filesystem=/ent:ro", "--filesystem=/trab", "org.musescore.MuseScore"])

    def test_sem_nada_instalado_devolve_none(self):
        with mock.patch.object(g.shutil, "which", lambda c: None):
            os.environ.pop("BMCCB_MUSESCORE", None)
            self.assertIsNone(g.achar_musescore(self.entrada, self.trabalho, None))


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
        self.assertEqual(o["lyricElision"], "unicode")


class UltimasLinhas(unittest.TestCase):
    def test_pega_so_as_ultimas_e_ignora_linhas_vazias(self):
        self.assertEqual(g.ultimas_linhas("a\n\n b \nc\nd\n", 2), "c | d")

    def test_aceita_vazio_e_none(self):
        self.assertEqual(g.ultimas_linhas(""), "")
        self.assertEqual(g.ultimas_linhas(None), "")


class MscxParaMusicxml(unittest.TestCase):
    def falso(self, conteudo=None, codigo=0, erro="", saida=""):
        """Um subprocess.run falso: escreve (ou não) o arquivo do -o e devolve um resultado."""
        def run(cmd, **k):
            if conteudo is not None:
                Path(cmd[cmd.index("-o") + 1]).write_text(conteudo)
            return subprocess.CompletedProcess(cmd, codigo, stdout=saida, stderr=erro)
        return run

    def chama(self, run, tempo=5):
        with tempfile.TemporaryDirectory() as t:
            with mock.patch.object(g.subprocess, "run", run):
                return g.mscx_para_musicxml(["mscore"], Path("x.mscx"), Path(t) / "saida.musicxml", tempo)

    def test_sucesso_devolve_none(self):
        self.assertIsNone(self.chama(self.falso("<score/>")))

    def test_sucesso_mesmo_com_aviso_no_stderr_e_codigo_diferente_de_zero(self):
        self.assertIsNone(self.chama(self.falso("<score/>", codigo=1, erro="QCoreApplication::applicationDirPath: aviso")))

    def test_arquivo_ausente_ou_vazio_e_falha_com_codigo_e_causa(self):
        for conteudo in (None, ""):
            motivo = self.chama(self.falso(conteudo, codigo=3, erro="linha 1\nNão consegui abrir o arquivo"))
            self.assertIn("não gerou o MusicXML", motivo)
            self.assertIn("código 3", motivo)
            self.assertIn("Não consegui abrir o arquivo", motivo)

    def test_sem_mensagem_do_musescore_o_motivo_nao_termina_em_dois_pontos(self):
        motivo = self.chama(self.falso(None, codigo=1))
        self.assertTrue(motivo.endswith("(código 1)"), motivo)

    def test_usa_a_saida_padrao_se_o_stderr_estiver_vazio(self):
        self.assertIn("só no stdout", self.chama(self.falso(None, codigo=1, saida="só no stdout")))

    def test_tempo_esgotado_e_falha_com_o_limite_no_texto(self):
        def run(cmd, **k):
            raise subprocess.TimeoutExpired(cmd, k["timeout"])

        motivo = self.chama(run, tempo=7)
        self.assertIn("passou de 7 s", motivo)

    def test_passa_o_limite_de_tempo_ao_subprocesso(self):
        visto = {}

        def run(cmd, **k):
            visto.update(k)
            return subprocess.CompletedProcess(cmd, 0, "", "")

        self.chama(run, tempo=42)
        self.assertEqual(visto["timeout"], 42)

    def test_comando_inexistente_e_falha_com_o_comando_no_texto(self):
        def run(cmd, **k):
            raise FileNotFoundError(2, "No such file or directory", "mscore-que-nao-existe")

        motivo = self.chama(run)
        self.assertIn("não consegui rodar o MuseScore", motivo)
        self.assertIn("mscore", motivo)

    def test_roda_sem_janela(self):
        visto = {}

        def run(cmd, env=None, **k):
            visto["env"] = env
            return subprocess.CompletedProcess(cmd, 0, "", "")

        self.chama(run)
        self.assertEqual(visto["env"]["QT_QPA_PLATFORM"], "offscreen")


class Gravar(unittest.TestCase):
    def test_grava_os_dois_arquivos_sem_deixar_temporario(self):
        with tempfile.TemporaryDirectory() as t:
            saida = Path(t)
            g.gravar(saida, 7, b"<svg/>", "[1,2]")
            self.assertEqual((saida / "hino-7.svg").read_bytes(), b"<svg/>")
            self.assertEqual((saida / "hino-7.timemap.json").read_text(), "[1,2]")
            self.assertEqual(sorted(p.name for p in saida.iterdir()), ["hino-7.svg", "hino-7.timemap.json"])

    def test_substitui_o_que_ja_existia(self):
        with tempfile.TemporaryDirectory() as t:
            saida = Path(t)
            (saida / "hino-7.svg").write_bytes(b"velho")
            g.gravar(saida, 7, b"novo", "[]")
            self.assertEqual((saida / "hino-7.svg").read_bytes(), b"novo")

    def test_falha_na_escrita_nao_deixa_svg_sem_timemap_nem_temporario(self):
        with tempfile.TemporaryDirectory() as t:
            saida = Path(t)
            original = Path.write_bytes
            chamadas = []

            def falha_na_segunda(self, dados):
                chamadas.append(self.name)
                if len(chamadas) == 2:
                    raise OSError("disco cheio")
                return original(self, dados)

            with mock.patch.object(Path, "write_bytes", falha_na_segunda):
                with self.assertRaises(OSError):
                    g.gravar(saida, 7, b"<svg/>", "[]")
            self.assertEqual(list(saida.iterdir()), [], "não pode sobrar nem o .svg, nem o .tmp")


class FalsoToolkit:
    """Faz as vezes do verovio.toolkit()."""

    def __init__(self, le=True, paginas=1):
        self.le, self.paginas, self.lido = le, paginas, None

    def loadData(self, texto):
        self.lido = texto
        return self.le

    def getPageCount(self):
        return self.paginas

    def renderToSVG(self, pagina):
        return "<svg>é</svg>"

    def renderToTimemap(self, opcoes):
        return [{"qstamp": 0}]


class GerarHino(unittest.TestCase):
    def roda(self, tk, musicxml="<score/>", tempo=5):
        with tempfile.TemporaryDirectory() as t:
            trabalho, saida = Path(t) / "trab", Path(t) / "out"
            trabalho.mkdir()
            saida.mkdir()

            def run(cmd, **k):
                if musicxml is not None:
                    Path(cmd[cmd.index("-o") + 1]).write_bytes(musicxml if isinstance(musicxml, bytes) else musicxml.encode())
                return subprocess.CompletedProcess(cmd, 0, "", "")

            with mock.patch.object(g.subprocess, "run", run):
                resultado = g.gerar_hino(tk, ["mscore"], 5, Path("hino-5.mscx"), trabalho, saida, tempo)
            return resultado, sorted(p.name for p in saida.iterdir())

    def test_sucesso_grava_os_arquivos_e_devolve_os_tamanhos(self):
        (svg, gz, tm), arquivos = self.roda(FalsoToolkit())
        self.assertEqual(svg, len("<svg>é</svg>".encode()))  # bytes UTF-8, não caracteres
        self.assertGreater(gz, 0)
        self.assertEqual(arquivos, ["hino-5.svg", "hino-5.timemap.json"])

    def test_o_verovio_recebe_o_xml_com_a_elisao_corrigida(self):
        tk = FalsoToolkit()
        self.roda(tk, musicxml=texto_elisao(LARGA))
        self.assertEqual(tk.lido, "<elision> </elision>")

    def test_verovio_que_nao_le_e_erro_do_hino(self):
        with self.assertRaisesRegex(g.ErroHino, "Verovio não leu"):
            self.roda(FalsoToolkit(le=False))

    def test_mais_de_uma_pagina_e_erro_do_hino(self):
        with self.assertRaisesRegex(g.ErroHino, "2 páginas"):
            self.roda(FalsoToolkit(paginas=2))

    def test_falha_do_musescore_vira_erro_do_hino_com_o_motivo(self):
        with self.assertRaisesRegex(g.ErroHino, "não gerou o MusicXML"):
            self.roda(FalsoToolkit(), musicxml=None)

    def test_musicxml_em_outra_codificacao_vira_erro_do_hino(self):
        with self.assertRaisesRegex(g.ErroHino, "UnicodeDecodeError"):
            self.roda(FalsoToolkit(), musicxml=b"\xff\xfe\xfa")


class Processar(unittest.TestCase):
    def test_um_hino_ruim_nao_para_os_outros_e_conta_a_falha(self):
        def falso(tk, musescore, n, mscx, trabalho, saida, tempo):
            if n == 2:
                raise g.ErroHino("deu ruim")
            return 100 * n, 10, 5

        erro = io.StringIO()
        with mock.patch.object(g, "gerar_hino", falso), contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(erro):
            falhas, total = g.processar(None, ["mscore"], [(1, Path("a")), (2, Path("b")), (3, Path("c"))], Path("t"), Path("s"))
        self.assertEqual(falhas, 1)
        self.assertEqual(total, 100 + 300, "soma só os que deram certo")
        self.assertIn("2  FALHOU: deu ruim", erro.getvalue())

    def test_tudo_certo_nao_conta_falhas(self):
        with mock.patch.object(g, "gerar_hino", lambda *a, **k: (50, 5, 1)), contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(g.processar(None, ["m"], [(1, Path("a")), (2, Path("b"))], Path("t"), Path("s")), (0, 100))


if __name__ == "__main__":
    sys.exit(0 if unittest.main(exit=False).result.wasSuccessful() else 1)
