"""Alinha a letra às notas do soprano. Cada marca é uma nota que leva sílaba: `sil-` abre ou continua a palavra, `_` é uma nota sem sílaba
(a anterior segue nela) e `+` junta duas palavras numa nota."""
from __future__ import annotations

from xml.sax.saxutils import escape

from .compassos import Medida, Peca
from .lilypond import ErroFonte

SILABICO = {(False, False): "single", (False, True): "begin", (True, True): "middle", (True, False): "end"}


def notas_com_silaba(medidas: list[Medida]) -> list[Peca]:
    """As peças do soprano que levam sílaba (notas que não continuam uma ligadura nem estão sob um arco de melisma)."""
    return [p for m in medidas for p in m.pecas if p.evento.tipo == "n" and not p.sem_silaba]


def _lirica(estrofe: int, marca: str, continua: bool) -> str:
    texto = marca.removesuffix("-").replace("+", " ")
    silabico = SILABICO[(continua, marca.endswith("-"))]
    return f"<Lyrics><no>{estrofe}</no><syllabic>{silabico}</syllabic><text>{escape(texto)}</text></Lyrics>"


class Alinhador:
    """Põe as estrofes nas notas: `letras` (id da peça -> XML) acumula as sílabas e `fins` os últimos compassos de cada verso."""

    def __init__(self, alvos: list[Peca]):
        self.alvos, self.letras, self.fins = alvos, {}, set()

    def estrofe(self, numero: int, versos: list[list[str]]) -> None:
        total = sum(len(v) for v in versos)
        if total != len(self.alvos):
            raise ErroFonte(f"estrofe {numero + 1}: {total} marcas (sílabas e '_') para {len(self.alvos)} notas com sílaba")
        k, continua = 0, False
        for verso in versos:
            for marca in verso:
                continua = self._marca(numero, self.alvos[k], marca, continua)
                k += 1
            self.fins.add(id(self.alvos[k - 1]))
        if continua:
            raise ErroFonte(f"estrofe {numero + 1}: palavra aberta no fim da estrofe")

    def _marca(self, numero: int, peca: Peca, marca: str, continua: bool) -> bool:
        if marca == "_":
            return continua
        self.letras[id(peca)] = self.letras.get(id(peca), "") + _lirica(numero, marca, continua)
        return marca.endswith("-")


def alinhar(estrofes: list[list[list[str]]], medidas: list[Medida]) -> tuple[dict, set]:
    """(id da peça -> XML da letra, ids das peças que fecham um verso)."""
    a = Alinhador(notas_com_silaba(medidas))
    for n, versos in enumerate(estrofes):
        a.estrofe(n, versos)
    return a.letras, a.fins
