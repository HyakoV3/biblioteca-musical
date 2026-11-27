"""Escreve o MusicXML (sem letra) de um hino em quatro vozes: soprano e contralto na pauta de sol, tenor e baixo na de fá.

É a entrada do Verovio (via `tools/gerar-partituras.py`). Os compassos são os mesmos do .mscx (a ordem dos `g.measure` do SVG é a ordem
da lista `compassos` do hinário)."""
from __future__ import annotations

from fractions import Fraction
from xml.sax.saxutils import escape

from .compassos import Medida, Peca, figuras
from .lilypond import Evento

DIVISOES = 8  # por semínima: dá para a menor figura usada (semicolcheia pontuada = 3/8 de semínima)
PAUTA_DA_VOZ = [1, 1, 2, 2]
HASTE_DA_VOZ = ["up", "down", "up", "down"]
CLAVES = ('<clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>F</sign><line>4</line></clef>')


def _altura(e: Evento) -> str:
    alter = f"<alter>{e.alter}</alter>" if e.alter else ""
    return f"<pitch><step>{e.passo.upper()}</step>{alter}<octave>{e.oitava}</octave></pitch>"


def _tipo_de_viga(p: Peca) -> str | None:
    """O tipo ("eighth" ou "16th") se a peça é uma nota de uma figura só que leva viga; senão None."""
    figs = figuras(p.dur)
    ok = p.evento.tipo == "n" and len(figs) == 1 and figs[0][0] in ("eighth", "16th")
    return figs[0][0] if ok else None


def _marca(antes: bool, depois: bool) -> str:
    return "continue" if antes and depois else ("end" if antes else "begin")


def _vigas_da_nota(tipo: str, antes: str | None, depois: str | None) -> str:
    """As marcas de viga de uma nota, dados os tipos dos vizinhos do MESMO grupo de pulso (None se não há vizinho)."""
    if antes is None and depois is None:
        return ""
    saida = f'<beam number="1">{_marca(antes is not None, depois is not None)}</beam>'
    if tipo != "16th":
        return saida
    liga_antes, liga_depois = antes == "16th", depois == "16th"
    if liga_antes or liga_depois:
        return saida + f'<beam number="2">{_marca(liga_antes, liga_depois)}</beam>'
    return saida + f'<beam number="2">{"backward hook" if antes else "forward hook"}</beam>'


def _vigas(pecas: list[Peca], grupo: Fraction) -> list[str]:
    """Para cada peça, o XML das vigas: notas de colcheia e semicolcheia vizinhas no mesmo grupo de pulso."""
    tipos = [_tipo_de_viga(p) for p in pecas]
    chaves = [(p.inicio // grupo) if t else None for p, t in zip(pecas, tipos)]
    return [_vigas_da_nota(t, _vizinho(tipos, chaves, k, k - 1), _vizinho(tipos, chaves, k, k + 1)) if t else "" for k, t in enumerate(tipos)]


def _vizinho(tipos: list, chaves: list, k: int, outro: int) -> str | None:
    """O tipo de viga da peça `outro`, se ela existe e está no mesmo grupo de pulso que a `k`."""
    mesmo = 0 <= outro < len(tipos) and chaves[outro] == chaves[k]
    return tipos[outro] if mesmo else None


def _liga(p: Peca, k: int, total: int) -> tuple[str, str]:
    """(elementos <tie>, notações <tied>) de uma figura."""
    fim = p.liga_de_antes or k > 0
    ini = k < total - 1 or p.liga_adiante
    tie = ('<tie type="stop"/>' if fim else "") + ('<tie type="start"/>' if ini else "")
    tied = ('<tied type="stop"/>' if fim else "") + ('<tied type="start"/>' if ini else "")
    return tie, (f"<notations>{tied}</notations>" if tied else "")


def _pausa(p: Peca, voz: int, base: str, escrita: str) -> str:
    invisivel = ' print-object="no"' if p.evento.tipo == "s" else ""
    return f"<note{invisivel}><rest/>{base}{escrita}<staff>{PAUTA_DA_VOZ[voz]}</staff></note>"


def _nota(p: Peca, voz: int, vigas: str) -> str:
    """Um pedaço de evento (uma ou mais figuras, se a duração pedir mais de uma)."""
    figs = figuras(p.dur)
    saida = []
    for k, (tipo, pontos, valor) in enumerate(figs):
        base = f"<duration>{int(valor * DIVISOES)}</duration>"
        escrita = f"<voice>{voz + 1}</voice><type>{tipo}</type>" + "<dot/>" * pontos
        if p.evento.tipo != "n":
            saida.append(_pausa(p, voz, base, escrita))
            continue
        tie, tied = _liga(p, k, len(figs))
        haste = f"<stem>{HASTE_DA_VOZ[voz]}</stem><staff>{PAUTA_DA_VOZ[voz]}</staff>"
        saida.append(f"<note>{_altura(p.evento)}{base}{tie}{escrita}{haste}{vigas if len(figs) == 1 else ''}{tied}</note>")
    return "".join(saida)


def _atributos(ctx: dict) -> str:
    n, d = ctx["compasso"]
    return (f"<attributes><divisions>{DIVISOES}</divisions><key><fifths>{ctx['armadura']}</fifths></key>"
            f"<time><beats>{n}</beats><beat-type>{d}</beat-type></time><staves>2</staves>{CLAVES}</attributes>")


def _vozes_do_compasso(vozes: list[Medida], ctx: dict) -> str:
    corpo = ""
    for v, medida in enumerate(vozes):
        vigas = _vigas(medida.pecas, ctx["grupo"])
        corpo += "".join(_nota(p, v, vigas[k]) for k, p in enumerate(medida.pecas))
        corpo += f"<backup><duration>{int(medida.usado * DIVISOES)}</duration></backup>" if v < len(vozes) - 1 else ""
    return corpo


def _compasso(numero: int, vozes: list[Medida], ctx: dict) -> str:
    implicito = ' implicit="yes"' if numero == 0 and vozes[0].usado != ctx["medida"] else ""
    return f'<measure number="{numero + 1}"{implicito}>{_atributos(ctx) if numero == 0 else ""}{_vozes_do_compasso(vozes, ctx)}</measure>'


def montar(titulo: str, pautas: list[list[Medida]], ctx: dict) -> str:
    """O MusicXML do hino (`pautas`: as medidas de cada voz, na ordem soprano, contralto, tenor, baixo)."""
    compassos = "\n".join(_compasso(i, [p[i] for p in pautas], ctx) for i in range(len(pautas[0])))
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="3.1">\n'
            f"<work><work-title>{escape(titulo)}</work-title></work>\n"
            '<part-list><score-part id="P1"><part-name print-object="no">Coro</part-name></score-part></part-list>\n'
            f'<part id="P1">\n{compassos}\n</part>\n</score-partwise>\n')
