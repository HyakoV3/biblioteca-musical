"""O MusicXML que o MuseScore escreve, sem o que não vai para a partitura: a letra e o texto de andamento."""
import re

# A letra da partitura sai: todo <lyric>...</lyric> do MusicXML (incluindo o sinal de elisão que o MuseScore escreve dentro dele). Só o
# elemento <lyric> verdadeiro: <lyric-font> e <lyric-language>, que ficam em <defaults>, têm o mesmo começo e NÃO podem ser tocados (um
# padrão frouxo apagaria a partitura inteira entre o primeiro <lyric-font> e o primeiro </lyric>).
LETRA_MUSICXML = re.compile(r"<lyric(?=[\s>])(?:[^<>]*/>|.*?</lyric>)", re.S)

DIRECAO_MUSICXML = re.compile(r"<direction(?:\s[^>]*)?>.*?</direction>", re.S)  # `(?:\s[^>]*)?` para não pegar <direction-type>
TIPO_DE_DIRECAO = re.compile(r"<direction-type>.*?</direction-type>\s*", re.S)


def remover_letra(xml: str) -> str:
    """O MusicXML sem a letra (os elementos <lyric>)."""
    return LETRA_MUSICXML.sub("", xml)


def _sem_texto_de_andamento(m) -> str:
    """De uma <direction> que traz o andamento (<sound tempo> ou <metronome>), tira os <direction-type>; as outras ficam como estão."""
    bloco = m.group(0)
    return TIPO_DE_DIRECAO.sub("", bloco) if "<sound tempo=" in bloco or "<metronome" in bloco else bloco


def remover_andamento(xml: str) -> str:
    """O MusicXML sem o TEXTO de andamento que o autor escreveu na partitura (como "( ♪ = 112 - 144 )"): de cada <direction> que traz o andamento (<sound tempo>
    ou <metronome>) saem os <direction-type> (o que o Verovio desenha), e o <sound tempo> fica, para o resto do MusicXML não mudar. Tirar daqui, e não do SVG, faz o
    Verovio diagramar sem o espaço do texto. O andamento que vale é o do hinário (botão no topo do app)."""
    return DIRECAO_MUSICXML.sub(_sem_texto_de_andamento, xml)
