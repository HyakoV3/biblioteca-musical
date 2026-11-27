import importlib.util
import json
import sys
import xml.etree.ElementTree as ET
from fractions import Fraction
from pathlib import Path

import pytest

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "tools"))
from exemplo import letra, mscx, musicxml  # noqa: E402
from exemplo.compassos import dividir, figuras  # noqa: E402
from exemplo.lilypond import ErroFonte, ler_global, ler_voz, variaveis  # noqa: E402
from exemplo.montagem import estrofes_de, preparar, vozes_do_hino  # noqa: E402

_spec = importlib.util.spec_from_file_location("gerar_exemplo", RAIZ / "tools" / "gerar-exemplo.py")
cli = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(cli)
EXEMPLO = RAIZ / "src-tauri" / "exemplo"
FONTES = EXEMPLO / "fontes"


def _voz(corpo):
    return ler_voz("{ " + corpo + " }")


def test_alturas_e_duracoes():
    v = _voz(r"\time 4/4 \key g \major c'4 d'8 e' fis'2 bes,4 r4")
    assert [(e.midi, e.dur * 4) for e in v.eventos] == [(60, 1), (62, Fraction(1, 2)), (64, Fraction(1, 2)), (66, 2), (46, 1), (None, 1)]
    assert v.total == Fraction(6, 4) and v.compasso == (4, 4) and v.armadura == ("g", "major")
    assert (v.eventos[4].passo, v.eventos[4].alter, v.eventos[4].oitava) == ("b", -1, 2)


def test_transpose_sobe_uma_oitava():
    assert [e.midi for e in ler_voz(r"\transpose c c' { c4 g }").eventos] == [60, 67]


def test_ligadura_de_expressao_entre_notas_iguais_vale_como_ligadura():
    ev = _voz(r"a'2 ( a'4 ) b'4 ( c'' )").eventos
    assert ev[0].ligada_a_seguinte and not ev[1].ligada_a_seguinte
    assert not ev[2].ligada_a_seguinte and ev[3].melisma  # alturas diferentes: melisma, não ligadura


def test_global_traz_so_compasso_e_armadura():
    g = ler_global(r"\time 3/4 \key d \minor \tempo 4=90 \skip 1*4")
    assert g.compasso == (3, 4) and g.armadura == ("d", "minor")


def test_recusa_o_que_nao_entende():
    with pytest.raises(ErroFonte):
        _voz(r"c4 \tuplet 3/2 { d8 e f }")


def test_nota_que_atravessa_a_barra_vira_duas_ligadas_e_figuras_somam():
    medidas = dividir(_voz(r"\time 4/4 c'2 d'1"), Fraction(4), None)
    assert [m.usado for m in medidas] == [4, 2]
    assert medidas[0].pecas[1].liga_adiante and medidas[1].pecas[0].liga_de_antes and medidas[1].pecas[0].sem_silaba
    assert [m.usado for m in dividir(_voz(r"c'4 d'1"), Fraction(4), Fraction(1))] == [1, 4]
    assert [f[2] for f in figuras(Fraction(3, 2))] == [Fraction(3, 2)] and sum(f[2] for f in figuras(Fraction(5, 4))) == Fraction(5, 4)


def v_dividir(ly_corpo):
    return dividir(_voz(ly_corpo), Fraction(2), None)


def test_letra_com_contagem_errada_e_recusada_e_a_certa_marca_as_silabas():
    medidas = v_dividir(r"\time 2/4 \key c \major c'4 d'")
    with pytest.raises(ErroFonte, match="2 notas"):
        letra.alinhar([[["só"]]], medidas)
    letras, fins = letra.alinhar([[["a-", "bc"]]], medidas)
    texto = "".join(letras.values())
    assert "<syllabic>begin</syllabic><text>a</text>" in texto and "<syllabic>end</syllabic><text>bc</text>" in texto and len(fins) == 1
    with pytest.raises(ErroFonte, match="aberta"):
        letra.alinhar([[["a-", "b-"]]], medidas)


def test_os_arquivos_gravados_estao_em_dia_com_as_fontes():
    dados = json.loads((FONTES / "letras.json").read_text(encoding="utf-8"))
    for hino in dados["hinos"]:
        m, x = preparar(hino, FONTES)
        assert (FONTES / "mscx" / f"hino-{hino['numero']}.mscx").read_text(encoding="utf-8") == m
        assert (FONTES / "musicxml" / f"hino-{hino['numero']}.musicxml").read_text(encoding="utf-8") == x


def test_musicxml_e_xml_valido_com_quatro_vozes_e_um_compasso_por_compasso_do_hinario():
    hinario = json.loads((EXEMPLO / "hinario.json").read_text(encoding="utf-8"))
    for hino in hinario["hinos"]:
        raiz = ET.fromstring((FONTES / "musicxml" / f"hino-{hino['numero']}.musicxml").read_text(encoding="utf-8"))
        compassos = raiz.findall("./part/measure")
        escritos = max(c for _, c in hino["compassos"]["normal"]) + 1
        assert len(compassos) == escritos, hino["numero"]
        assert {n.findtext("voice") for n in raiz.iter("note")} == {"1", "2", "3", "4"}
        assert raiz.find(".//lyric") is None  # a partitura sai sem letra
        for tipo in ("start", "stop"):  # toda ligadura aberta é fechada
            assert len([t for t in raiz.iter("tie") if t.get("type") == tipo]) == len([t for t in raiz.iter("tied") if t.get("type") == tipo])


def test_vozes_do_exemplo_tem_a_mesma_duracao_e_a_ode_traz_o_compasso_do_global():
    dados = json.loads((FONTES / "letras.json").read_text(encoding="utf-8"))
    for hino in dados["hinos"]:
        vozes = vozes_do_hino(hino, FONTES)
        assert len({v.total for v in vozes}) == 1 and vozes[0].compasso and vozes[0].armadura


def test_fontes_livres_continuam_declaradas_como_dominio_publico():
    for ly in sorted(FONTES.glob("*.ly")):
        assert 'copyright = "Public Domain"' in ly.read_text(encoding="utf-8"), ly.name


def test_hinario_gerado_tem_cinco_hinos_de_quatro_vozes_e_ligaduras_unidas():
    h = json.loads((EXEMPLO / "hinario.json").read_text(encoding="utf-8"))
    assert [x["numero"] for x in h["hinos"]] == [1, 2, 3, 4, 5]
    for x in h["hinos"]:
        assert [v["nome"] for v in x["vozes"]] == ["Soprano", "Contralto", "Tenor", "Baixo"], x["numero"]
        fins = {round(v["notas"][-1][0] + v["notas"][-1][1], 3) for v in x["vozes"]}
        assert len(fins) == 1, f"hino {x['numero']}: vozes de durações diferentes {fins}"
        assert x["letra"] and x["sincronia"]["normal"], x["numero"]
    por = {x["numero"]: x for x in h["hinos"]}
    assert por[2]["titulo"] == "Stille Nacht, heilige Nacht" and por[2]["titulos"] == {"pt": "Noite Feliz", "en": "Silent Night", "es": "Noche de paz"}
    assert set(por[3]["titulos"]) == {"pt", "es"} and set(por[4]["titulos"]) == {"pt", "es"}  # a língua original (inglês) não repete
    novo = h["hinos"][3]  # Amazing Grace termina com sol ligado através da barra: uma nota só de 4 batidas
    assert novo["vozes"][0]["notas"][-1][1] == 4


def test_svg_embutidos_tem_um_measure_por_compasso_e_tempo_em_cada_nota():
    h = json.loads((EXEMPLO / "hinario.json").read_text(encoding="utf-8"))
    for x in h["hinos"]:
        escritos = max(c for _, c in x["compassos"]["normal"]) + 1
        for nome in (f"hino-{x['numero']}.svg", f"hino-{x['numero']}-paisagem.svg"):
            svg = (EXEMPLO / "partituras" / nome).read_text(encoding="utf-8")
            assert svg.count('class="measure"') == escritos, nome
            assert svg.count('class="note"') == svg.count('class="note" data-t="') > 0, nome
            assert "xlink:href" not in svg and "url(" not in svg and "<script" not in svg, nome


def test_formatar_escreve_um_hino_por_linha():
    texto = cli.formatar({"versao": 1, "hinario": {"id": "a", "nome": "A"}, "hinos": [{"numero": 1}, {"numero": 2}]})
    assert texto.splitlines()[4:6] == ['    {"numero":1},', '    {"numero":2}']
    assert estrofes_de({"estrofes": [["a- b", "c"]]}) == [[["a-", "b"], ["c"]]]
    assert mscx.LIGA_INICIO and musicxml.DIVISOES == 8 and variaveis("x = { c }")["x"].startswith("{")
