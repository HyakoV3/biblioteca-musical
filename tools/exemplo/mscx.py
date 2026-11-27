"""Escreve o MuseScore (XML, formato do 3) mínimo que `tools/mscx2json` entende."""
from __future__ import annotations

from xml.sax.saxutils import escape

from .compassos import Medida, Peca, figuras

LIGA_INICIO = '<Spanner type="Tie"><Tie/><next><location><fractions>1/4</fractions></location></next></Spanner>'
LIGA_FIM = '<Spanner type="Tie"><prev><location><fractions>-1/4</fractions></location></prev></Spanner>'


def _ligacao(p: Peca, k: int, total: int) -> str:
    inicio = LIGA_INICIO if (k < total - 1 or p.liga_adiante) else ""
    return inicio + (LIGA_FIM if (p.liga_de_antes or k > 0) else "")


def _figura(p: Peca, letra: str) -> str:
    partes = figuras(p.dur)
    saida = []
    for k, (tipo, pontos, _) in enumerate(partes):
        extra = "<dots>1</dots>" if pontos else ""
        if p.evento.tipo != "n":
            saida.append(f"<Rest><durationType>{tipo}</durationType>{extra}</Rest>")
        else:
            corpo = letra if k == 0 else ""
            nota = f"<Note>{_ligacao(p, k, len(partes))}<pitch>{p.evento.midi}</pitch></Note>"
            saida.append(f"<Chord>{corpo}<durationType>{tipo}</durationType>{extra}{nota}</Chord>")
    return "".join(saida)


def _cabecalho(idx: int, ctx: dict) -> str:
    n, d = ctx["compasso"]
    cab = f"<KeySig><accidental>{ctx['armadura']}</accidental></KeySig><TimeSig><sigN>{n}</sigN><sigD>{d}</sigD></TimeSig>"
    return cab + (f"<Tempo><tempo>{ctx['andamento'] / 60:.6f}</tempo></Tempo>" if idx == 0 else "")


def _medida(i: int, idx: int, m: Medida, ctx: dict) -> str:
    corpo = ""
    for p in m.pecas:
        corpo += _figura(p, ctx["letras"].get(id(p), "") if idx == 0 else "")
        corpo += "<Breath/>" if idx == 0 and id(p) in ctx["fins"] else ""
    tam = "" if m.usado == ctx["medida"] else f' len="{m.usado.numerator}/{m.usado.denominator * 4}"'
    return f"      <Measure{tam}><voice>{_cabecalho(idx, ctx) if i == 0 else ''}{corpo}</voice></Measure>"


def _pauta(idx: int, medidas: list[Medida], ctx: dict) -> str:
    linhas = [_medida(i, idx, m, ctx) for i, m in enumerate(medidas)]
    return f'    <Staff id="{idx + 1}">\n' + "\n".join(linhas) + "\n    </Staff>"


def montar(hino: dict, pautas: list[list[Medida]], ctx: dict) -> str:
    """O .mscx do hino: uma pauta por voz, com título, letrista e compositor como textos de moldura."""
    nomes = ctx["nomes"]
    partes = "\n".join(f'    <Part><Staff id="{i + 1}"/><trackName>{nomes[i]}</trackName></Part>' for i in range(len(pautas)))
    moldura = "".join(f"<Text><style>{e}</style><text>{escape(hino[c])}</text></Text>" for e, c in (("Title", "titulo"), ("Lyricist", "letrista"), ("Composer", "compositor")))
    corpo = "\n".join(_pauta(i, p, ctx) for i, p in enumerate(pautas))
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<museScore version="3.02">\n  <Score>\n    <Division>480</Division>\n'
            f'    <metaTag name="workTitle">{escape(hino["titulo"])}</metaTag>\n{partes}\n    <VBox>{moldura}</VBox>\n{corpo}\n  </Score>\n</museScore>\n')
