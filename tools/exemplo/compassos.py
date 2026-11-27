"""Divide uma voz em compassos, cortando (com ligadura) a nota que atravessa a barra, e decompõe as durações em figuras escritas."""
from __future__ import annotations

from dataclasses import dataclass
from fractions import Fraction

from .lilypond import ErroFonte, Evento, Voz

# (duração em semínimas, tipo, pontos), da maior para a menor
FIGURAS = [(Fraction(4), "whole", 0), (Fraction(3), "half", 1), (Fraction(2), "half", 0), (Fraction(3, 2), "quarter", 1), (Fraction(1), "quarter", 0),
           (Fraction(3, 4), "eighth", 1), (Fraction(1, 2), "eighth", 0), (Fraction(3, 8), "16th", 1), (Fraction(1, 4), "16th", 0)]


@dataclass
class Peca:
    """Um pedaço de evento dentro de um compasso."""
    evento: Evento
    dur: Fraction  # em semínimas
    inicio: Fraction  # em semínimas, dentro do compasso
    liga_de_antes: bool
    liga_adiante: bool
    sem_silaba: bool


@dataclass
class Medida:
    usado: Fraction
    pecas: list[Peca]


def figuras(d: Fraction) -> list[tuple[str, int, Fraction]]:
    """Decompõe uma duração (em semínimas) em figuras; mais de uma figura vira notas ligadas."""
    partes = []
    while d > 0:
        valor, tipo, pontos = next(((v, t, p) for v, t, p in FIGURAS if v <= d), (None, None, None))
        if valor is None:
            raise ErroFonte(f"duração sem figura: {d}")
        partes.append((tipo, pontos, valor))
        d -= valor
    return partes


class _Divisor:
    """Acumula os pedaços dos eventos em compassos de `comp` semínimas (o 1º, de `anacruse`, se houver)."""

    def __init__(self, comp: Fraction, anacruse: Fraction | None):
        self.comp, self.alvo, self.usado = comp, anacruse or comp, Fraction(0)
        self.atual: list[Peca] = []
        self.medidas: list[Medida] = []
        self.ligada = False  # o evento anterior está ligado a este

    def evento(self, e: Evento) -> None:
        resta, primeiro = e.dur * 4, True
        while resta > 0:
            cabe = min(resta, self.alvo - self.usado)
            adiante = cabe < resta or (e.ligada_a_seguinte and cabe == resta)
            liga = (not primeiro) or self.ligada
            self.atual.append(Peca(e, cabe, self.usado, liga, adiante, liga or e.melisma))
            self.usado += cabe
            resta -= cabe
            primeiro = False
            if self.usado == self.alvo:
                self.fechar()
        self.ligada = e.ligada_a_seguinte

    def fechar(self) -> None:
        self.medidas.append(Medida(self.usado, self.atual))
        self.atual, self.usado, self.alvo = [], Fraction(0), self.comp


def dividir(voz: Voz, comp: Fraction, anacruse: Fraction | None) -> list[Medida]:
    """Os eventos da voz em compassos de `comp` semínimas (o 1º com `anacruse`, se houver). O último pode ficar incompleto."""
    d = _Divisor(comp, anacruse)
    for e in voz.eventos:
        d.evento(e)
    if d.atual:
        d.fechar()
    return d.medidas
