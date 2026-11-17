#!/usr/bin/env python3
"""Testes da parte pura do mapa por nota (I-23) de tools/analisar-timbres.py. Não precisam do ffmpeg nem das amostras; precisam do numpy.

Uso:  python3 tools/test_analisar_timbres.py
"""
import contextlib
import importlib.util
import io
import json
import math
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import numpy as np

AQUI = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("analisar_timbres", AQUI / "analisar-timbres.py")
a = importlib.util.module_from_spec(spec)
spec.loader.exec_module(a)


class FaixaDeUso(unittest.TestCase):
    def test_uma_voz_e_todas(self):
        self.assertEqual(a.faixa_de_uso(["soprano"]), (60, 81))
        self.assertEqual(a.faixa_de_uso(["baixo"]), (40, 60))
        self.assertEqual(a.faixa_de_uso(["soprano", "contralto", "tenor", "baixo"]), (40, 81))
        self.assertEqual(a.faixa_de_uso(["tenor", "contralto"]), (48, 74))


class CorrecoesDb(unittest.TestCase):
    def test_niveis_iguais_nao_pedem_correcao(self):
        c = a.correcoes_db({60: -20.0, 61: -20.0, 62: -20.0}, (60, 62))
        for v in c.values():
            self.assertAlmostEqual(v, 0.0, places=9)

    def test_leva_cada_nota_ao_nivel_medio_em_potencia_da_faixa(self):
        niveis = {60: -20.0, 61: -24.0, 62: -28.0}
        referencia = 10 * math.log10(sum(10 ** (v / 10) for v in niveis.values()) / 3)
        c = a.correcoes_db(niveis, (60, 62), reforco=99, corte=-99)
        for m, v in niveis.items():
            self.assertAlmostEqual(v + c[m], referencia, places=9, msg=f"nota {m}")
        # a média em potência fica acima da em dB: a nota mais forte é cortada e a mais fraca reforçada, mas o corte é menor que o reforço
        self.assertLess(c[60], 0)
        self.assertGreater(c[62], 0)

    def test_aplicando_a_correcao_a_amplitude_vai_a_zero(self):
        niveis = {m: -20.0 - 0.7 * (m - 60) for m in range(54, 88)}
        c = a.correcoes_db(niveis, (60, 81), reforco=99, corte=-99)
        self.assertGreater(a.amplitude_db(niveis, (60, 81)), 10)
        self.assertAlmostEqual(a.amplitude_db(niveis, (60, 81), c), 0.0, places=9)

    def test_o_reforco_e_o_corte_sao_limitados(self):
        niveis = {60: -10.0, 61: -40.0, 62: -70.0}
        c = a.correcoes_db(niveis, (60, 62))
        self.assertEqual(max(c.values()), a.LIMITE_REFORCO_DB)
        self.assertGreaterEqual(min(c.values()), a.LIMITE_CORTE_DB)
        c2 = a.correcoes_db({60: -10.0, 61: -90.0, 62: -90.0, 63: -90.0}, (60, 63), corte=-3.0)
        self.assertEqual(min(c2.values()), -3.0)

    def test_a_referencia_so_conta_as_notas_da_faixa_de_uso_mas_as_da_margem_tambem_recebem_correcao(self):
        # 50 está fora da faixa (60, 62): não entra na média, mas ganha a sua correção (a transposição pode levar a voz até lá)
        dentro = {60: -20.0, 61: -20.0, 62: -20.0}
        c = a.correcoes_db({**dentro, 50: -26.0, 70: -14.0}, (60, 62), reforco=99, corte=-99)
        self.assertAlmostEqual(c[50], 6.0, places=9)
        self.assertAlmostEqual(c[70], -6.0, places=9)
        self.assertAlmostEqual(c[61], 0.0, places=9)

    def test_sem_nenhuma_nota_na_faixa_e_erro(self):
        with self.assertRaises(ValueError):
            a.correcoes_db({50: -20.0}, (60, 62))

    def test_o_reforco_maximo_cabe_na_velocity_127_do_smplr(self):
        # o app aplica a correção pela velocity (ganho = v²/16129): 127 é o máximo, +5,99 dB sobre 90; acima disso a nota some
        maximo = 40 * math.log10(127 / a.VELOCIDADE_BASE)
        self.assertLessEqual(a.LIMITE_REFORCO_DB, maximo)
        self.assertGreater(a.LIMITE_REFORCO_DB, maximo - 0.2)
        self.assertEqual(a.VELOCIDADE_BASE, 90)

    def test_os_limites_do_json_gravado_sao_os_da_ferramenta(self):
        dados = json.loads(a.SAIDA_NIVEIS.read_text(encoding="utf-8"))
        self.assertEqual(dados["limites_db"], [a.LIMITE_CORTE_DB, a.LIMITE_REFORCO_DB])


class AmplitudeDb(unittest.TestCase):
    def test_maior_menos_menor_so_na_faixa(self):
        niveis = {50: 0.0, 60: -10.0, 61: -14.0, 62: -12.0, 80: -40.0}
        self.assertAlmostEqual(a.amplitude_db(niveis, (60, 62)), 4.0)

    def test_com_correcao(self):
        niveis = {60: -10.0, 61: -14.0}
        self.assertAlmostEqual(a.amplitude_db(niveis, (60, 61), {60: -2.0, 61: 2.0}), 0.0)

    def test_faixa_vazia_e_zero(self):
        self.assertEqual(a.amplitude_db({50: 1.0}, (60, 62)), 0.0)


def seno(freq, amplitude, segundos=3.0):
    t = np.arange(int(a.SR * segundos)) / a.SR
    return amplitude * np.sin(2 * np.pi * freq * t)


class NivelDaNota(unittest.TestCase):
    def test_dobrar_a_amplitude_soma_6_dB_nas_duas_curvas(self):
        for curva in ("ouvido", "celular"):
            n1 = a.nivel_da_nota(seno(1000, 0.1), curva)
            n2 = a.nivel_da_nota(seno(1000, 0.2), curva)
            self.assertAlmostEqual(n2 - n1, 6.02, delta=0.05, msg=curva)

    def test_a_curva_do_celular_corta_o_grave_e_a_do_ouvido_nao_tanto(self):
        grave_ouvido = a.nivel_da_nota(seno(100, 0.2), "ouvido")
        grave_celular = a.nivel_da_nota(seno(100, 0.2), "celular")
        agudo_celular = a.nivel_da_nota(seno(1000, 0.2), "celular")
        agudo_ouvido = a.nivel_da_nota(seno(1000, 0.2), "ouvido")
        self.assertLess(grave_celular, grave_ouvido - 5, "o alto-falante do celular quase não reproduz 100 Hz")
        self.assertAlmostEqual(agudo_celular, agudo_ouvido, delta=0.5, msg="em 1 kHz as duas curvas coincidem")

    def test_nota_muda_ou_curta_demais_devolve_none(self):
        self.assertIsNone(a.nivel_da_nota(np.zeros(a.SR * 2)))
        self.assertIsNone(a.nivel_da_nota(np.array([])))
        self.assertIsNone(a.nivel_da_nota(seno(440, 0.2, 0.3)), "a janela de medida (0,45 a 1,2 s) não cabe numa nota de 0,3 s")

    def test_a_janela_e_contada_do_inicio_da_nota_e_nao_do_arquivo(self):
        # 0,5 s de silêncio antes: o início da nota é detectado e a janela continua a mesma
        com_silencio = np.concatenate([np.zeros(a.SR // 2), seno(1000, 0.2, 2.5)])
        sem = seno(1000, 0.2, 2.5)
        self.assertAlmostEqual(a.nivel_da_nota(com_silencio), a.nivel_da_nota(sem), delta=0.2)

    def test_uma_janela_diferente_mede_o_trecho_pedido(self):
        # nota que cai: sustenta forte no começo e fraca no fim; a janela tardia mede menos que a cedo
        x = np.concatenate([seno(1000, 0.4, 1.0), seno(1000, 0.1, 2.0)])
        cedo = a.nivel_da_nota(x, "ouvido", (0.1, 0.8))
        tarde = a.nivel_da_nota(x, "ouvido", (1.5, 2.5))
        self.assertGreater(cedo - tarde, 10)


def sai_com(teste, fn, *trechos):
    """Roda `fn`; ela tem de terminar em SystemExit (mensagem, e não traceback) com todos os `trechos` no texto."""
    with teste.assertRaises(SystemExit) as e:
        fn()
    texto = str(e.exception.code)
    for t in trechos:
        teste.assertIn(t, texto)
    return texto


class ErrosDaFerramenta(unittest.TestCase):
    """Comentários do vandame na #50: entrada vazia, mapa ausente ou desatualizado, banco errado: sempre mensagem, nunca traceback nem arquivo vazio."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.mapa = Path(self.tmp.name) / "niveis.json"
        p = mock.patch.object(a, "SAIDA_NIVEIS", self.mapa)
        p.start()
        self.addCleanup(p.stop)
        self.addCleanup(self.tmp.cleanup)
        self.um = [("real_flauta", "flute", 1.0, ["soprano"])]

    def escreve(self, dados):
        self.mapa.write_text(json.dumps(dados), encoding="utf-8")

    # --- ler_mapa ---
    def test_mapa_que_nao_existe(self):
        sai_com(self, a.ler_mapa, "não existe", "--mapa-notas --escrever")

    def test_mapa_ilegivel(self):
        self.mapa.write_text("{isto não é json", encoding="utf-8")
        sai_com(self, a.ler_mapa, "ilegível", "--mapa-notas --escrever")

    def test_mapa_sem_a_chave_instrumentos_ou_com_outro_formato(self):
        for dados in ({}, {"instrumentos": []}, [1, 2], {"instrumentos": "x"}):
            self.escreve(dados)
            sai_com(self, a.ler_mapa, "formato esperado")

    def test_mapa_valido_e_devolvido(self):
        self.escreve({"fonte": "x/y", "instrumentos": {}})
        self.assertEqual(a.ler_mapa()["fonte"], "x/y")

    # --- gravados_do_catalogo ---
    def test_catalogo_vazio_e_erro(self):
        with mock.patch.object(a, "parse_realistas", return_value=[]):
            sai_com(self, a.gravados_do_catalogo, "nenhum gravado", "realista.ts")

    # --- mapa_notas ---
    def test_mapa_notas_com_catalogo_vazio_nao_grava_um_mapa_vazio(self):
        with contextlib.redirect_stdout(io.StringIO()), mock.patch.object(a, "parse_realistas", return_value=[]):
            sai_com(self, lambda: a.mapa_notas("ouvido", True), "nenhum gravado")
        self.assertFalse(self.mapa.exists(), "não pode ficar um niveis-gravados.json com instrumentos vazios")

    def test_mapa_notas_so_com_notas_da_margem_diz_qual_instrumento_falhou(self):
        # só a nota 50 foi medida; a faixa de uso do soprano é 60-81: correcoes_db levantava um ValueError cru
        with contextlib.redirect_stdout(io.StringIO()), mock.patch.object(a, "parse_realistas", return_value=self.um), \
                mock.patch.object(a, "medir_notas", return_value={50: -20.0}):
            sai_com(self, lambda: a.mapa_notas("ouvido", True), "flute", "60-81", "nenhuma nota medida dentro da faixa")
        self.assertFalse(self.mapa.exists())

    def test_mapa_notas_sem_nenhuma_nota_medida(self):
        with contextlib.redirect_stdout(io.StringIO()), mock.patch.object(a, "parse_realistas", return_value=self.um), \
                mock.patch.object(a, "medir_notas", return_value={}):
            sai_com(self, lambda: a.mapa_notas("ouvido", False), "flute", "nenhuma nota medida")

    def test_mapa_notas_grava_o_banco_de_onde_saiu(self):
        niveis = {m: -20.0 - (m - 60) * 0.5 for m in range(54, 88)}
        with contextlib.redirect_stdout(io.StringIO()), mock.patch.object(a, "parse_realistas", return_value=self.um), \
                mock.patch.object(a, "medir_notas", return_value=niveis), mock.patch.object(a, "FONTE", Path("/x/GeneralUserGS/amostras")):
            a.mapa_notas("ouvido", True)
        dados = json.loads(self.mapa.read_text(encoding="utf-8"))
        self.assertEqual(dados["fonte"], "GeneralUserGS/amostras")
        self.assertEqual(list(dados["instrumentos"]), ["real_flauta"])

    # --- validar_mapa ---
    def test_validar_sem_mapa(self):
        sai_com(self, a.validar_mapa, "não existe")

    def test_validar_mapa_de_outro_banco_e_recusado(self):
        self.escreve({"fonte": "GeneralUserGS/amostras", "instrumentos": {}})
        with mock.patch.object(a, "FONTE", Path("/x/FluidR3_GM")):
            sai_com(self, a.validar_mapa, "GeneralUserGS/amostras", "FluidR3_GM", "sem sentido")

    def test_validar_gravado_que_falta_no_mapa_diz_qual(self):
        self.escreve({"fonte": "GeneralUserGS/amostras", "instrumentos": {"real_oboe": {"de": 50, "db": [0.0]}}})
        with mock.patch.object(a, "FONTE", Path("/x/GeneralUserGS/amostras")), mock.patch.object(a, "parse_realistas", return_value=self.um):
            sai_com(self, a.validar_mapa, "real_flauta", "--mapa-notas --escrever")

    def test_validar_com_catalogo_vazio_nao_divide_por_zero(self):
        self.escreve({"fonte": "GeneralUserGS/amostras", "instrumentos": {}})
        with mock.patch.object(a, "FONTE", Path("/x/GeneralUserGS/amostras")), mock.patch.object(a, "parse_realistas", return_value=[]):
            sai_com(self, a.validar_mapa, "nenhum gravado")

    # --- main: o banco certo ---
    def test_mapa_notas_e_validar_mapa_exigem_a_fonte(self):
        for flag in ("--mapa-notas", "--validar-mapa"):
            with mock.patch.object(sys, "argv", ["analisar-timbres.py", flag]):
                sai_com(self, a.main, "--fonte", "FluidR3_GM", "GeneralUserGS")

    def test_mapa_notas_escrever_sem_fonte_nao_toca_no_mapa(self):
        self.escreve({"fonte": "GeneralUserGS/amostras", "instrumentos": {"x": {"de": 1, "db": [0.0]}}})
        antes = self.mapa.read_text(encoding="utf-8")
        with mock.patch.object(sys, "argv", ["analisar-timbres.py", "--mapa-notas", "--escrever"]):
            sai_com(self, a.main, "--fonte")
        self.assertEqual(self.mapa.read_text(encoding="utf-8"), antes)


if __name__ == "__main__":
    unittest.main()
