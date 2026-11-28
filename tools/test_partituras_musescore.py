#!/usr/bin/env python3
"""Testes de tools/partituras/musescore.py (achar e rodar o MuseScore, sempre com o subprocesso falso).

Uso:  python3 tools/test_partituras_musescore.py
"""
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
from partituras import musescore as g  # noqa: E402

class AcharMusescore(unittest.TestCase):
    def setUp(self):
        self.entrada = Path("/ent")
        self.trabalho = Path("/trab")

    def test_o_argumento_vence_a_variavel_de_ambiente(self):
        with mock.patch.dict(os.environ, {"BM_MUSESCORE": "do-ambiente"}):
            self.assertEqual(g.achar_musescore(self.entrada, self.trabalho, "meu mscore --x"), ["meu", "mscore", "--x"])

    def test_a_variavel_de_ambiente_vale_sem_argumento(self):
        with mock.patch.dict(os.environ, {"BM_MUSESCORE": "do-ambiente"}):
            self.assertEqual(g.achar_musescore(self.entrada, self.trabalho, None), ["do-ambiente"])

    def test_usa_o_primeiro_comando_do_path(self):
        com = {"musescore4": "/usr/bin/musescore4", "musescore": "/usr/bin/musescore"}
        with mock.patch.dict(os.environ, {}, clear=False), mock.patch.object(shutil, "which", lambda c: com.get(c)):
            os.environ.pop("BM_MUSESCORE", None)
            self.assertEqual(g.achar_musescore(self.entrada, self.trabalho, None), ["musescore4"])

    def test_flatpak_pede_acesso_as_duas_pastas(self):
        class Ok:
            returncode = 0

        with mock.patch.dict(os.environ), \
                mock.patch.object(shutil, "which", lambda c: "/usr/bin/flatpak" if c == "flatpak" else None), \
                mock.patch.object(subprocess, "run", lambda *a, **k: Ok()):
            os.environ.pop("BM_MUSESCORE", None)
            cmd = g.achar_musescore(self.entrada, self.trabalho, None)
        self.assertEqual(cmd, ["flatpak", "run", "--filesystem=/ent:ro", "--filesystem=/trab", "org.musescore.MuseScore"])

    def test_flatpak_que_trava_ou_nao_executa_vale_como_nao_instalado(self):
        for erro in (subprocess.TimeoutExpired("flatpak", 30), OSError("sem permissão")):
            def falha(*a, _erro=erro, **k):
                raise _erro

            with mock.patch.dict(os.environ), \
                    mock.patch.object(shutil, "which", lambda c: "/usr/bin/flatpak" if c == "flatpak" else None), \
                    mock.patch.object(subprocess, "run", falha):
                os.environ.pop("BM_MUSESCORE", None)
                self.assertIsNone(g.achar_musescore(self.entrada, self.trabalho, None))

    def test_sem_nada_instalado_devolve_none(self):
        with mock.patch.dict(os.environ), mock.patch.object(shutil, "which", lambda c: None):
            os.environ.pop("BM_MUSESCORE", None)
            self.assertIsNone(g.achar_musescore(self.entrada, self.trabalho, None))


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
            with mock.patch.object(subprocess, "run", run):
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

if __name__ == "__main__":
    sys.exit(0 if unittest.main(exit=False).result.wasSuccessful() else 1)
