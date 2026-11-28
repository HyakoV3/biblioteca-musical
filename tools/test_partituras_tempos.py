#!/usr/bin/env python3
"""Testes de tools/partituras/tempos.py e marcacao.py (os tempos de cada nota e ligadura no SVG).

Uso:  python3 tools/test_partituras_tempos.py
"""
import sys
import unittest
from pathlib import Path

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
from partituras import marcacao, tempos  # noqa: E402

class FalsoVerovio:
    """O que o Verovio sabe dizer: as cópias dos elementos nas repetições e o começo e o fim de cada ligadura."""
    ATRIBUTOS = {"t1": {"startid": "#a", "endid": "#b"}, "s1": {"startid": "#a-rend2", "endid": "#b"}, "s2": {"startid": "#b", "endid": "#a"},
                 "s3": {"startid": "#a", "endid": "#a"}, "s4": {}, "t2": {"startid": "#a"}}

    def getExpansionIdsForElement(self, id_):
        return {"a": ["a", "a-rend2"], "b": ["b-rend2", ""]}.get(id_)

    def getElementAttr(self, id_):
        return self.ATRIBUTOS[id_]


class TemposDoDesenho(unittest.TestCase):
    SVG = ('<g id="a" class="note"><g id="b" class="note"><g id="t1" class="tie"><g id="s1" class="slur"><g id="s2" class="slur">'
           '<g id="s3" class="slur"><g id="s4" class="slur"><g id="t2" class="tie">')
    TIMEMAP = [{"qstamp": 0, "measureOn": "m1", "on": ["a"]}, {"qstamp": 1, "off": ["a"], "on": ["b-rend2"]},
               {"qstamp": 4, "measureOn": "m2", "off": ["b"], "restsOn": ["p"]}, {"qstamp": 6, "restsOff": ["p"]}]

    def test_tempos_e_ligaduras_pelo_id_do_desenho(self):
        # a cópia "b-rend2" do timemap é a nota "b" do desenho; a ligadura de expressão (s1) traz a duração entre o começo das duas notas;
        # as que voltam no tempo (s2), não andam (s3) ou não dizem onde fecham (s4, t2) ficam de fora
        resultado = tempos.tempos_do_desenho(FalsoVerovio(), self.SVG, self.TIMEMAP)
        self.assertEqual(resultado, ({"a": (0, 1), "b": (1, 4), "p": (0, 2)}, [("t1", "a", "b"), ("s1", "a", "b", 1)]))


class NumeroCurto(unittest.TestCase):
    def test_sem_zeros_a_direita_e_ate_4_casas(self):
        self.assertEqual(tempos.numero_curto(4.0), "4")
        self.assertEqual(tempos.numero_curto(1.5), "1.5")
        self.assertEqual(tempos.numero_curto(1 / 3), "0.3333")
        self.assertEqual(tempos.numero_curto(0.0), "0")
        self.assertEqual(tempos.numero_curto(-0.00001), "0")


class TemposNoCompasso(unittest.TestCase):
    """O `timemap` do Verovio: `on`/`off` com ids, `measureOn` no começo de cada compasso, `restsOn`/`restsOff` para as pausas."""

    def test_o_instante_e_relativo_ao_compasso_em_que_a_nota_soa(self):
        tm = [
            {"qstamp": 0, "measureOn": "m1", "on": ["a"]},
            {"qstamp": 1, "off": ["a"], "on": ["b"]},
            {"qstamp": 4, "measureOn": "m2", "off": ["b"], "on": ["c"]},
            {"qstamp": 5.5, "off": ["c"]},
        ]
        self.assertEqual(tempos.tempos_no_compasso(tm, lambda i: i), {"a": (0, 1), "b": (1, 4), "c": (0, 1.5)})

    def test_a_pausa_tambem_tem_tempo(self):
        tm = [{"qstamp": 0, "measureOn": "m1", "on": ["a"]}, {"qstamp": 1, "off": ["a"], "restsOn": ["p"]}, {"qstamp": 2, "restsOff": ["p"]}]
        self.assertEqual(tempos.tempos_no_compasso(tm, lambda i: i)["p"], (1, 2))

    def test_na_repeticao_vale_a_primeira_vez_e_a_copia_vira_o_id_do_desenho(self):
        # a copia "a-rend2" so existe no timemap; no desenho a nota e "a". O compasso repetido recomeca em 8.
        tm = [
            {"qstamp": 0, "measureOn": "m1", "on": ["a"]},
            {"qstamp": 2, "off": ["a"]},
            {"qstamp": 8, "measureOn": "m1-rend2", "on": ["a-rend2"]},
            {"qstamp": 9, "off": ["a-rend2"]},
        ]
        real = {"a-rend2": "a"}.get
        self.assertEqual(tempos.tempos_no_compasso(tm, lambda i: real(i, i)), {"a": (0, 2)})

    def test_nota_que_atravessa_a_barra_tem_fim_maior_que_o_compasso(self):
        tm = [{"qstamp": 0, "measureOn": "m1", "on": ["a"]}, {"qstamp": 4, "measureOn": "m2", "off": ["a"]}]
        self.assertEqual(tempos.tempos_no_compasso(tm, lambda i: i), {"a": (0, 4)})

    def test_nota_que_nunca_fecha_fica_de_fora(self):
        self.assertEqual(tempos.tempos_no_compasso([{"qstamp": 0, "measureOn": "m1", "on": ["a"]}], lambda i: i), {})


class MarcarNotas(unittest.TestCase):
    SVG = (
        '<g id="m1" class="measure"><g id="a" class="note"><g class="notehead"></g></g><g id="b" class="note"></g>'
        '<g id="c" class="note"></g><g id="p" class="rest"></g><g id="e" class="note"></g><g id="x" class="notehead"></g></g>'
    )

    def test_poe_data_t_e_data_f_em_notas_e_pausas(self):
        tempos = {"a": (0, 1), "p": (1, 2)}
        svg, n = marcacao.marcar_notas(self.SVG, tempos, [])
        self.assertEqual(n, 2)
        self.assertIn('<g id="a" class="note" data-t="0" data-f="1">', svg)
        self.assertIn('<g id="p" class="rest" data-t="1" data-f="2">', svg)
        # sem tempo: intocado
        self.assertIn('<g id="b" class="note">', svg)

    SVG_LIGADURA = (
        '<g id="m1" class="measure"><g id="a" class="note"></g><g id="t1" class="tie"><path d="M0,0"/></g></g>'
        '<g id="m2" class="measure"><g id="b" class="note"></g><g id="c" class="note"></g><g id="t2" class="tie"></g><g id="t3" class="tie"></g></g>'
    )

    def test_cada_nota_da_ligadura_acende_no_seu_tempo_e_a_curva_leva_o_tempo_da_primeira(self):
        tempos = {"a": (2, 4), "b": (0, 2), "c": (2, 3)}
        svg, n = marcacao.marcar_notas(self.SVG_LIGADURA, tempos, [("t1", "a", "b")])
        self.assertEqual(n, 3)
        self.assertIn('<g id="a" class="note" data-t="2" data-f="4">', svg)
        self.assertIn('<g id="b" class="note" data-t="0" data-f="2">', svg)  # a segunda também acende, no tempo dela
        self.assertIn('<g id="t1" class="tie" data-t="2" data-f="4">', svg)  # a luz corre pela curva enquanto a primeira soa

    def test_ligadura_em_cadeia_tem_uma_curva_para_cada_par(self):
        tempos = {"a": (0, 1), "b": (1, 3), "c": (3, 4)}
        svg, _ = marcacao.marcar_notas(self.SVG_LIGADURA, tempos, [("t1", "a", "b"), ("t2", "b", "c")])
        self.assertIn('<g id="t1" class="tie" data-t="0" data-f="1">', svg)
        self.assertIn('<g id="t2" class="tie" data-t="1" data-f="3">', svg)

    def test_ligadura_partida_pelo_fim_da_linha_divide_o_tempo_entre_os_pedacos(self):
        svg, _ = marcacao.marcar_notas(self.SVG_LIGADURA, {"a": (0, 4), "b": (4, 5)}, [("t2", "a", "b"), ("t3", "a", "b")])
        self.assertIn('<g id="t2" class="tie" data-t="0" data-f="2">', svg)
        self.assertIn('<g id="t3" class="tie" data-t="2" data-f="4">', svg)

    def test_ligadura_sem_tempo_na_primeira_nota_fica_sem_atributos(self):
        svg, _ = marcacao.marcar_notas(self.SVG_LIGADURA, {"b": (0, 2)}, [("t1", "a", "b")])
        self.assertIn('<g id="t1" class="tie">', svg)

    SVG_EXPRESSAO = (
        '<g id="m1" class="measure"><g id="a" class="note"></g><g id="s1" class="slur"><path d="M0,0"/></g></g>'
        '<g id="m2" class="measure"><g id="b" class="note"></g><g id="s2" class="slur"></g><g id="s3" class="slur"></g></g>'
    )

    def test_ligadura_de_expressao_leva_o_tempo_da_nota_que_abre_ate_o_comeco_da_que_fecha(self):
        # a abre em 1 (dura 1), a curva corre até o começo de b, 3 semínimas depois: de 1 a 4 (e não de 1 a 2, o fim de a)
        svg, n = marcacao.marcar_notas(self.SVG_EXPRESSAO, {"a": (1, 2), "b": (0, 1)}, [("s1", "a", "b", 3)])
        self.assertIn('<g id="s1" class="slur" data-t="1" data-f="4">', svg)
        self.assertEqual(n, 2)

    def test_ligadura_de_expressao_partida_pelo_fim_da_linha_divide_o_tempo(self):
        svg, _ = marcacao.marcar_notas(self.SVG_EXPRESSAO, {"a": (0, 1), "b": (0, 1)}, [("s2", "a", "b", 4), ("s3", "a", "b", 4)])
        self.assertIn('<g id="s2" class="slur" data-t="0" data-f="2">', svg)
        self.assertIn('<g id="s3" class="slur" data-t="2" data-f="4">', svg)

    def test_ligadura_de_prolongamento_e_de_expressao_sobre_as_mesmas_notas_nao_dividem_o_tempo(self):
        svg = (
            '<g id="m1" class="measure"><g id="a" class="note"></g><g id="t1" class="tie"></g><g id="s1" class="slur"></g></g>'
            '<g id="m2" class="measure"><g id="b" class="note"></g></g>'
        )
        # a ligadura (a abre em 0 e dura 1,5) e a de expressão (de a até o começo de b, 1,5 depois) cobrem as MESMAS duas notas: cada uma leva o tempo inteiro
        svg, _ = marcacao.marcar_notas(svg, {"a": (0, 1.5), "b": (0, 1)}, [("t1", "a", "b"), ("s1", "a", "b", 1.5)])
        self.assertIn('<g id="t1" class="tie" data-t="0" data-f="1.5">', svg)
        self.assertIn('<g id="s1" class="slur" data-t="0" data-f="1.5">', svg)

    def test_curvas_duplicadas_com_o_mesmo_desenho_levam_o_tempo_inteiro_e_pedacos_diferentes_dividem(self):
        base = '<g id="m1" class="measure"><g id="a" class="note"></g>'
        dup = base + '<g id="s1" class="slur"><path d="M1,1 C2,2 3,3 4,4"/></g><g id="s2" class="slur"><path d="M1,1 C2,2 3,3 4,4"/></g></g><g id="m2" class="measure"><g id="b" class="note"></g></g>'
        # duas curvas IGUAIS, uma por cima da outra (duplicata): cada uma leva o tempo inteiro, sem dividir
        svg, _ = marcacao.marcar_notas(dup, {"a": (0, 1), "b": (0, 1)}, [("s1", "a", "b", 1.5), ("s2", "a", "b", 1.5)])
        self.assertIn('<g id="s1" class="slur" data-t="0" data-f="1.5">', svg)
        self.assertIn('<g id="s2" class="slur" data-t="0" data-f="1.5">', svg)
        # dois desenhos DIFERENTES (o pedaço do fim da linha e o do começo da seguinte): dividem o tempo
        partida = dup.replace('d="M1,1 C2,2 3,3 4,4"/></g></g><g id="m2"', 'd="M9,9 C8,8 7,7 6,6"/></g></g><g id="m2"', 1)
        svg, _ = marcacao.marcar_notas(partida, {"a": (0, 1), "b": (0, 1)}, [("s1", "a", "b", 1.5), ("s2", "a", "b", 1.5)])
        self.assertIn('<g id="s1" class="slur" data-t="0" data-f="0.75">', svg)
        self.assertIn('<g id="s2" class="slur" data-t="0.75" data-f="1.5">', svg)

    def test_ligadura_de_expressao_sem_duracao_conhecida_fica_sem_atributos(self):
        svg, _ = marcacao.marcar_notas(self.SVG_EXPRESSAO, {"a": (1, 2), "b": (0, 1)}, [])
        self.assertIn('<g id="s1" class="slur">', svg)

    def test_inicios_absolutos_atravessam_a_barra(self):
        tm = [
            {"qstamp": 0, "measureOn": "m1", "on": ["a"]},
            {"qstamp": 4, "measureOn": "m2", "on": ["b"], "off": ["a"]},
            {"qstamp": 6, "restsOn": ["p"], "off": ["b"]},
        ]
        self.assertEqual(tempos.inicios_absolutos(tm, lambda i: i), {"a": 0, "b": 4, "p": 6})
        self.assertEqual(tempos.inicios_absolutos(tm, lambda i: {"b": "B"}.get(i, i)), {"a": 0, "B": 4, "p": 6})

    def test_ligadura_em_ciclo_nao_trava(self):
        svg, n = marcacao.marcar_notas(self.SVG_LIGADURA, {"a": (0, 1), "b": (1, 2)}, [("t1", "a", "b"), ("t2", "b", "a")])
        self.assertEqual(n, 2)

    def test_nota_de_enfeite_sem_duracao_nao_acende(self):
        svg, n = marcacao.marcar_notas(self.SVG, {"e": (1, 1)}, [])
        self.assertEqual(n, 0)
        self.assertNotIn("data-t", svg)

    def test_so_marca_g_de_nota_e_pausa(self):
        svg, n = marcacao.marcar_notas(self.SVG, {"x": (0, 1), "m1": (0, 4)}, [])
        self.assertEqual((n, svg), (0, self.SVG))

if __name__ == "__main__":
    sys.exit(0 if unittest.main(exit=False).result.wasSuccessful() else 1)
