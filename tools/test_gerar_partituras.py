#!/usr/bin/env python3
"""Testes da parte pura de tools/gerar-partituras.py (não precisam do MuseScore nem do Verovio).

Uso:  python3 tools/test_gerar_partituras.py
"""
import importlib.util
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

AQUI = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("gerar_partituras", AQUI / "gerar-partituras.py")
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)

ELISAO = ""


class CorrigirElisao(unittest.TestCase):
    def test_troca_o_texto_da_fonte_privada_pelo_elemento_padrao(self):
        xml = f'<text>nho,</text><text font-family="MScore Text">{ELISAO}</text><text font-family="FreeSerif">em</text>'
        self.assertEqual(g.corrigir_elisao(xml), '<text>nho,</text><elision> </elision><text font-family="FreeSerif">em</text>')

    def test_troca_as_tres_larguras_do_padrao_smufl(self):
        for glifo in ("", "", ""):
            self.assertEqual(g.corrigir_elisao(f'<text font-family="MScore Text">{glifo}</text>'), "<elision> </elision>")

    def test_troca_todas_as_ocorrencias(self):
        um = f'<text font-family="MScore Text">{ELISAO}</text>'
        self.assertEqual(g.corrigir_elisao(um + "x" + um), "<elision> </elision>x<elision> </elision>")

    def test_nao_mexe_em_outro_texto_nem_em_outra_fonte(self):
        for xml in ("<text>nho,</text>", '<text font-family="FreeSerif">em</text>', '<text font-family="MScore Text">a</text>',
                    f'<text font-family="Outra">{ELISAO}</text>'):
            self.assertEqual(g.corrigir_elisao(xml), xml)


class NumeroDoHino(unittest.TestCase):
    def test_nomes_validos(self):
        self.assertEqual(g.numero_do_hino("hino-283.mscx"), 283)
        self.assertEqual(g.numero_do_hino("hino-1.mscx"), 1)

    def test_nomes_que_nao_sao_hino(self):
        for nome in ("hino-.mscx", "hino-2a.mscx", "hino-283.mscz", "x-hino-283.mscx", "hino-283.mscx.bak", "283.mscx"):
            self.assertIsNone(g.numero_do_hino(nome), nome)


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


class MsxcParaMusicxml(unittest.TestCase):
    def test_sucesso_so_se_o_arquivo_existe_e_nao_esta_vazio(self):
        with tempfile.TemporaryDirectory() as t:
            destino = Path(t) / "saida.musicxml"

            def escreve(conteudo):
                def falso(cmd, **k):
                    if conteudo is not None:
                        Path(cmd[cmd.index("-o") + 1]).write_text(conteudo)
                return falso

            for conteudo, esperado in ((None, False), ("", False), ("<score/>", True)):
                destino.unlink(missing_ok=True)
                with mock.patch.object(g.subprocess, "run", escreve(conteudo)):
                    self.assertEqual(g.mscx_para_musicxml(["mscore"], Path("x.mscx"), destino), esperado, repr(conteudo))

    def test_roda_sem_janela(self):
        visto = {}

        def falso(cmd, env=None, **k):
            visto["env"] = env

        with mock.patch.object(g.subprocess, "run", falso):
            g.mscx_para_musicxml(["mscore"], Path("x.mscx"), Path("/nao/existe.musicxml"))
        self.assertEqual(visto["env"]["QT_QPA_PLATFORM"], "offscreen")


if __name__ == "__main__":
    sys.exit(0 if unittest.main(exit=False).result.wasSuccessful() else 1)
