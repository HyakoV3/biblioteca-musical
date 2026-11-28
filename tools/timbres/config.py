"""Caminhos, constantes e catálogo de instrumentos compartilhados pelas medições de timbre."""
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent.parent
FONTE = RAIZ / "sons-fonte" / "FluidR3_GM"  # a CLI pode trocar (--fonte); quem lê usa `config.FONTE` na hora de usar
SAIDA = RAIZ / "src" / "lib" / "timbres.json"
SR = 44100
PASSO_ANCORAS = 3  # semitons entre âncoras

# Instrumento da síntese -> (arquivo da amostra, faixa de alturas MIDI onde o instrumento soa natural).
# Fora da faixa as amostras são só deslocadas e o timbre não é o do instrumento: a síntese usa a âncora da ponta.
INSTRUMENTOS = {
    "trompete": ("trumpet", 52, 84),
    "trombone": ("trombone", 38, 72),
    "tuba": ("tuba", 26, 60),
    "fagote": ("bassoon", 34, 75),
    "oboe": ("oboe", 58, 91),
    "sax_alto": ("alto_sax", 49, 81),
    "sax_tenor": ("tenor_sax", 44, 76),
    # Segunda leva: os demais com gravado no banco. O contrabaixo só tem notas audíveis até a 57.
    "flauta": ("flute", 60, 84),  # flauta transversal (2026-11-25); o pacote só vai até a nota 86 e as acima da 84 não entram nas âncoras
    "flauta_doce": ("recorder", 72, 96),
    "violino": ("violin", 55, 96),
    "clarinete": ("clarinet", 50, 94),
    "viola": ("viola", 48, 84),
    "violoncelo": ("cello", 36, 76),
    "contrabaixo": ("contrabass", 28, 55),
    "trompa": ("french_horn", 41, 77),
}
NOTAS = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
FAIXA_VOZ = {"soprano": (60, 81), "contralto": (55, 74), "tenor": (48, 67), "baixo": (40, 60)}


def ler_ts(nome):
    """Texto de um arquivo de src/lib (instrumentos.ts, realista.ts)."""
    return (RAIZ / "src" / "lib" / nome).read_text(encoding="utf-8")
