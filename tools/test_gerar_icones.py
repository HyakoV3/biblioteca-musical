#!/usr/bin/env python3
"""Testes da parte pura de tools/gerar-icones.py (não precisam do Inkscape nem do `tauri icon`).

Uso:  python3 tools/test_gerar_icones.py
"""
import importlib.util
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw

AQUI = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("gerar_icones", AQUI / "gerar-icones.py")
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)

CABECA = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<svg xmlns="http://www.w3.org/2000/svg" version="1.1" viewBox="0 0 100 100">\n'
GRUPO = '<g stroke-width="2.00" fill="none"><path stroke="#7f6928" d="M0 0L1 1"/></g>\n'


def svg(*caminhos, extra=""):
    corpo = "".join(f'<path fill="{c}" d="M0 0L{i} {i}"/>\n' for i, c in enumerate(caminhos, 1))
    return CABECA + GRUPO + corpo + extra + "</svg>\n"


class SepararCamadas(unittest.TestCase):
    def test_os_dois_primeiros_sao_a_placa_e_o_resto_e_o_simbolo(self):
        cabecalho, placa, simbolo = g.separar_camadas(svg("#fdaf00", "#012250", "#fcf5ea", "#012250", "#fcf5ea"))
        self.assertEqual([c for c, _ in placa], ["#fdaf00", "#012250"])
        self.assertEqual([c for c, _ in simbolo], ["#fcf5ea", "#012250", "#fcf5ea"])
        self.assertTrue(cabecalho.rstrip().endswith('viewBox="0 0 100 100">'))
        self.assertNotIn("stroke", cabecalho, "o grupo de traços finos não vai junto")

    def test_o_cabecalho_xml_com_standalone_nao_e_confundido_com_um_manipulador_de_evento(self):
        # `standalone="no"` termina em "one=": um filtro frouxo de on...= o recusaria
        self.assertIn('standalone="no"', CABECA)
        g.separar_camadas(svg("#fdaf00", "#012250", "#fcf5ea"))

    def test_recusa_conteudo_ativo(self):
        for extra in ("<script>alert(1)</script>", '<image href="x.png"/>', '<a href="http://x"/>', "<foreignObject/>", '<path onclick="x()" d="M0 0"/>'):
            with self.assertRaises(g.ErroIcone, msg=extra):
                g.separar_camadas(svg("#fdaf00", "#012250", "#fcf5ea", extra=extra))

    def test_recusa_menos_de_tres_caminhos_e_placa_de_uma_cor_so(self):
        with self.assertRaises(g.ErroIcone):
            g.separar_camadas(svg("#fdaf00", "#012250"))
        with self.assertRaises(g.ErroIcone):
            g.separar_camadas(svg("#012250", "#012250", "#fcf5ea"))

    def test_recusa_arquivo_sem_o_grupo_de_tracos(self):
        with self.assertRaises(g.ErroIcone):
            g.separar_camadas(CABECA + '<path fill="#fff" d="M0 0"/></svg>')

    def test_o_desenho_do_responsavel_passa(self):
        fonte = AQUI.parent / "src-tauri" / "icons" / "fonte" / "icone.svg"
        if not fonte.exists():
            self.skipTest("sem o SVG-fonte")
        _, placa, simbolo = g.separar_camadas(fonte.read_text(encoding="utf-8"))
        self.assertEqual((placa[0][0], placa[1][0]), ("#fdaf00", "#012250"))
        self.assertEqual(len(simbolo), 13)

    def test_montar_svg_recompoe_o_arquivo(self):
        cabecalho, placa, simbolo = g.separar_camadas(svg("#fdaf00", "#012250", "#fcf5ea"))
        saida = g.montar_svg(cabecalho, placa + simbolo)
        self.assertEqual(saida.count("<path"), 3)
        self.assertTrue(saida.endswith("</svg>\n"))


def quadrado(lado, caixa, cor=(250, 245, 235, 255)):
    im = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    ImageDraw.Draw(im).rectangle(caixa, fill=cor)
    return im


class Imagens(unittest.TestCase):
    def test_recortar_quadrado_fica_rente_ao_conteudo_e_centralizado(self):
        im = quadrado(200, (20, 60, 119, 99))  # 100 x 40
        r = g.recortar_quadrado(im, 64)
        self.assertEqual(r.size, (64, 64))
        x0, y0, x1, y1 = r.getchannel("A").point(lambda v: 255 if v > 128 else 0).getbbox()
        self.assertEqual((x0, x1), (0, 64), "a largura toca as bordas")
        self.assertAlmostEqual((y0 + y1) / 2, 32, delta=1, msg="centralizado na vertical")
        self.assertAlmostEqual((y1 - y0) / (x1 - x0), 0.4, delta=0.03, msg="a proporção 100 x 40 se mantém")

    def test_recortar_quadrado_de_imagem_vazia_e_erro(self):
        with self.assertRaises(g.ErroIcone):
            g.recortar_quadrado(Image.new("RGBA", (10, 10), (0, 0, 0, 0)), 8)

    def test_raio_maximo_e_a_distancia_do_ponto_mais_afastado_do_centro(self):
        im = quadrado(101, (0, 0, 100, 100))  # centro (50, 50); canto (0,0) a ~70,7
        self.assertAlmostEqual(g.raio_maximo(im), 70.71, delta=0.8)

    def test_o_primeiro_plano_cabe_no_circulo_seguro_e_fica_centrado(self):
        simbolo = quadrado(2048, (100, 600, 1900, 1500))  # largo e baixo, maior que a tela de destino
        lado = 1024
        r = g.primeiro_plano(simbolo, lado)
        self.assertEqual(r.size, (lado, lado))
        limite = lado * g.ZONA_SEGURA / 2  # raio do círculo seguro
        self.assertLessEqual(g.raio_maximo(r), limite, "nenhum ponto passa do círculo seguro")
        self.assertGreater(g.raio_maximo(r), limite * 0.85, "e aproveita o espaço (não fica minúsculo)")
        caixa = r.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
        self.assertAlmostEqual((caixa[0] + caixa[2]) / 2, lado / 2, delta=2)
        self.assertAlmostEqual((caixa[1] + caixa[3]) / 2, lado / 2, delta=2)

    def test_o_primeiro_plano_de_simbolo_pequeno_tambem_e_ampliado_ate_o_alvo(self):
        r = g.primeiro_plano(quadrado(300, (100, 100, 199, 199)), 1024)
        self.assertGreater(g.raio_maximo(r), 1024 * g.ZONA_SEGURA / 2 * 0.85)

    def test_silhueta_clara_vira_preto_opaco_e_escuro_vira_recorte(self):
        im = Image.new("RGBA", (4, 1))
        im.putdata([(250, 245, 235, 255), (253, 175, 0, 255), (1, 34, 80, 255), (250, 245, 235, 0)])
        s = g.silhueta(im)
        self.assertEqual(list(s.getdata()), [(0, 0, 0, 255), (0, 0, 0, 255), (0, 0, 0, 0), (0, 0, 0, 0)])

    def test_sem_alfa_regrava_em_rgb_compondo_sobre_a_cor(self):
        with tempfile.TemporaryDirectory() as t:
            pasta = Path(t)
            im = Image.new("RGBA", (8, 8), (0, 0, 0, 0))
            im.putpixel((4, 4), (255, 255, 255, 255))
            im.save(pasta / "a.png")
            (pasta / "nao-e-png.txt").write_text("x")
            self.assertEqual(g.sem_alfa(pasta, "#012250"), 1)
            r = Image.open(pasta / "a.png")
            self.assertEqual(r.mode, "RGB")
            self.assertEqual(r.getpixel((0, 0)), (1, 34, 80), "o transparente virou a cor da placa")
            self.assertEqual(r.getpixel((4, 4)), (255, 255, 255))


if __name__ == "__main__":
    unittest.main()
