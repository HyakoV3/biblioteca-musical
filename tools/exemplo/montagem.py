"""Do `letras.json` e das fontes LilyPond ao .mscx e ao MusicXML de cada hino."""
from __future__ import annotations

from fractions import Fraction
from pathlib import Path

from . import letra, mscx, musicxml
from .compassos import dividir
from .lilypond import ErroFonte, Voz, armadura_em_numero, ler_global, ler_voz, variaveis

NOMES_VOZ = ["Soprano", "Contralto", "Tenor", "Baixo"]


def _definicoes(hino: dict, pasta: Path) -> dict[str, str]:
    defs = variaveis((pasta / hino["ly"]).read_text(encoding="utf-8"))
    faltam = [n for n in hino["vozes_ly"] if n not in defs]
    if faltam:
        raise ErroFonte(f"{hino['ly']}: voz {faltam[0]} não encontrada ({sorted(defs)})")
    return defs


def vozes_do_hino(hino: dict, pasta: Path) -> list[Voz]:
    """As quatro vozes da fonte, com compasso e armadura (da própria voz ou do `global`). Recusa vozes de durações diferentes."""
    defs = _definicoes(hino, pasta)
    vozes = [ler_voz(defs[n]) for n in hino["vozes_ly"]]
    _completar(vozes, ler_global(defs["global"]) if "global" in defs else Voz([]))
    if len({v.total for v in vozes}) != 1:
        raise ErroFonte(f"{hino['ly']}: as vozes não têm a mesma duração: {[str(v.total) for v in vozes]}")
    return vozes


def _completar(vozes: list[Voz], glob: Voz) -> None:
    """Compasso e armadura que a voz não traz vêm do `global`."""
    for v in vozes:
        v.compasso, v.armadura = v.compasso or glob.compasso, v.armadura or glob.armadura


def estrofes_de(hino: dict) -> list[list[list[str]]]:
    return [[verso.split() for verso in estrofe] for estrofe in hino["estrofes"]]


def _contexto(hino: dict, soprano: Voz) -> dict:
    n, d = soprano.compasso
    medida = Fraction(n * 4, d)
    return {"compasso": (n, d), "medida": medida, "grupo": Fraction(3, 2) if d == 8 and n % 3 == 0 else Fraction(1),
            "armadura": armadura_em_numero(*soprano.armadura), "andamento": hino["andamento"], "nomes": NOMES_VOZ}


def preparar(hino: dict, pasta: Path) -> tuple[str, str]:
    """(texto do .mscx, texto do MusicXML) do hino."""
    vozes = vozes_do_hino(hino, pasta)
    ctx = _contexto(hino, vozes[0])
    anacruse = vozes[0].anacruse * 4 if vozes[0].anacruse else None
    pautas = [dividir(v, ctx["medida"], anacruse) for v in vozes]
    try:
        ctx["letras"], ctx["fins"] = letra.alinhar(estrofes_de(hino), pautas[0])
    except ErroFonte as e:
        raise ErroFonte(f"hino {hino['numero']}, {e}") from e
    return mscx.montar(hino, pautas, ctx), musicxml.montar(hino["titulo"], pautas, ctx)
