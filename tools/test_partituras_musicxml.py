#!/usr/bin/env python3
"""Testes de tools/partituras/musicxml.py (a limpeza do MusicXML; não precisam do MuseScore nem do Verovio).

Uso:  python3 tools/test_partituras_musicxml.py
"""
import sys
import unittest
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
from partituras import musicxml as g  # noqa: E402

class RemoverAndamento(unittest.TestCase):
    TEMPO = ('<direction placement="above"><direction-type><words>(</words></direction-type><direction-type><metronome><beat-unit>eighth</beat-unit>'
             '<per-minute>112</per-minute></metronome></direction-type><sound tempo="56"/></direction>')

    def test_tira_o_texto_e_deixa_o_sound_tempo(self):
        self.assertEqual(g.remover_andamento(self.TEMPO), '<direction placement="above"><sound tempo="56"/></direction>')

    def test_nao_toca_nas_outras_direcoes(self):
        outras = ('<direction placement="above"><direction-type><words>*</words></direction-type></direction>'
                  '<direction><direction-type><dynamics><p/></dynamics></direction-type></direction>')
        self.assertEqual(g.remover_andamento(outras), outras)

    def test_so_a_direcao_do_andamento_perde_o_texto(self):
        xml = '<m>' + self.TEMPO + '<direction><direction-type><words>Coro</words></direction-type></direction></m>'
        self.assertEqual(g.remover_andamento(xml), '<m><direction placement="above"><sound tempo="56"/></direction><direction><direction-type><words>Coro</words></direction-type></direction></m>')

    def test_metronome_sem_sound_tambem_sai(self):
        xml = '<direction><direction-type><metronome><per-minute>60</per-minute></metronome></direction-type></direction>'
        self.assertEqual(g.remover_andamento(xml), '<direction></direction>')

    def test_sem_andamento_nada_muda(self):
        xml = '<score><part><measure><note><pitch/></note></measure></part></score>'
        self.assertEqual(g.remover_andamento(xml), xml)


class RemoverLetra(unittest.TestCase):
    def test_tira_o_lyric_e_o_que_ha_dentro(self):
        xml = '<note><pitch/><lyric number="1" default-y="-67"><syllabic>end</syllabic><text>nho,</text></lyric></note>'
        self.assertEqual(g.remover_letra(xml), "<note><pitch/></note>")

    def test_tira_todas_as_letras_de_varias_vozes_e_linhas(self):
        xml = "<n><lyric number=\"1\"><text>a</text></lyric><lyric number=\"2\">\n<text>b</text>\n</lyric></n>"
        self.assertEqual(g.remover_letra(xml), "<n></n>")

    def test_tira_o_sinal_de_elisao_que_vem_dentro_da_letra(self):
        elisao = chr(0xE552)
        xml = f'<lyric><text>nho,</text><text font-family="MScore Text">{elisao}</text><text>em</text></lyric>'
        self.assertEqual(g.remover_letra(xml), "")

    def test_lyric_vazio_de_uma_tag_so(self):
        self.assertEqual(g.remover_letra('<a/><lyric number="1"/><b/>'), "<a/><b/>")

    def test_nao_toca_nos_elementos_que_so_comecam_igual(self):
        # <lyric-font> e <lyric-language> ficam em <defaults>; um padrão frouxo apagaria o trecho entre eles e o primeiro </lyric>
        xml = ('<defaults><lyric-font font-family="FreeSerif" font-size="10"/><lyric-language xml:lang="pt"/></defaults>'
               '<note><lyric><text>x</text></lyric></note><note2/>')
        self.assertEqual(g.remover_letra(xml), '<defaults><lyric-font font-family="FreeSerif" font-size="10"/><lyric-language xml:lang="pt"/></defaults><note></note><note2/>')

    def test_sem_letra_nada_muda(self):
        xml = "<score><part><measure><note><pitch/></note></measure></part></score>"
        self.assertEqual(g.remover_letra(xml), xml)

    def test_o_resto_da_partitura_fica_inteiro(self):
        com = "".join(f'<note id="{i}"><pitch/><lyric><text>t{i}</text></lyric></note>' for i in range(50))
        sem = "".join(f'<note id="{i}"><pitch/></note>' for i in range(50))
        self.assertEqual(g.remover_letra(com), sem)

if __name__ == "__main__":
    sys.exit(0 if unittest.main(exit=False).result.wasSuccessful() else 1)
