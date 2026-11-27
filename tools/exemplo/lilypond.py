"""Leitura de um subconjunto do LilyPond: o que os arquivos do Mutopia usados no pacote de exemplo trazem.

Lê uma voz como uma lista de eventos (notas e pausas, em semínimas) e RECUSA, com o motivo, o que não reconhece.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from fractions import Fraction


class ErroFonte(Exception):
    """A fonte tem algo que este leitor não entende (ou as vozes não fecham)."""


PASSO = {"c": 0, "d": 2, "e": 4, "f": 5, "g": 7, "a": 9, "b": 11}
NOTA = re.compile(r"([a-grs](?:is|es|s|as)?)([',]*)(\d+)?(\.*)((?:\\[a-z]+|[\[\]()~!?^_-])*)")
COMANDOS_IGNORADOS = re.compile(r"\\(voiceOne|voiceTwo|voiceThree|voiceFour|oneVoice)\b|\\bar\s*\"[^\"]*\"")


@dataclass
class Evento:
    inicio: Fraction  # em fração de semibreve, como o LilyPond escreve as durações
    dur: Fraction
    tipo: str  # "n" nota, "r" pausa, "s" espaço (pausa invisível)
    passo: str = ""
    alter: int = 0
    oitava: int = 0  # científica: o dó central é 4
    tie: bool = False
    sl_i: bool = False
    sl_f: bool = False
    melisma: bool = False
    ligada_a_seguinte: bool = False

    @property
    def midi(self) -> int | None:
        if self.tipo != "n":
            return None
        return 12 * (self.oitava + 1) + PASSO[self.passo] + self.alter


@dataclass
class Voz:
    eventos: list[Evento]
    compasso: tuple[int, int] | None = None
    armadura: tuple[str, str] | None = None
    anacruse: Fraction | None = None
    total: Fraction = Fraction(0)
    extra: dict = field(default_factory=dict)


def duracao(num: str, pontos: str) -> Fraction:
    base = Fraction(1, int(num))
    return base + sum((base / 2**k for k in range(1, len(pontos) + 1)), Fraction(0))


def _limpar(texto: str) -> str:
    texto = re.sub(r"%\{.*?%\}", " ", texto, flags=re.S)
    return re.sub(r"%[^\n]*", " ", texto)


def _bloco(texto: str, abre: int) -> tuple[str, int]:
    """Conteúdo do bloco `{ ... }` que abre em `abre` e o índice logo depois do fecha."""
    nivel = 0
    for i in range(abre, len(texto)):
        if texto[i] == "{":
            nivel += 1
        elif texto[i] == "}":
            nivel -= 1
            if nivel == 0:
                return texto[abre + 1 : i], i + 1
    raise ErroFonte("chave sem fechar")


def _tirar_markup(corpo: str) -> str:
    """Remove `_\\markup { ... }` (texto solto sobre a nota, sem som)."""
    achou = re.search(r"[_^-]?\\markup\s*\{", corpo)
    while achou:
        _, fim = _bloco(corpo, achou.end() - 1)
        corpo = corpo[: achou.start()] + " " + corpo[fim:]
        achou = re.search(r"[_^-]?\\markup\s*\{", corpo)
    return corpo


def variaveis(texto: str) -> dict[str, str]:
    """`nome = [\\transpose x y] { ... }` de nível mais externo."""
    texto = _limpar(texto)
    achados = {}
    for m in re.finditer(r"(?m)^\s*([A-Za-z]+)\s*=\s*(\\transpose\s+\S+\s+\S+\s*)?\{", texto):
        corpo, _ = _bloco(texto, m.end() - 1)
        achados[m.group(1)] = (m.group(2) or "") + "{" + corpo + "}"
    return achados


def _alter_do_sufixo(sufixo: str) -> int:
    tabela = {"": 0, "is": 1, "isis": 2, "es": -1, "s": -1, "as": -1, "eses": -2}
    if sufixo not in tabela:
        raise ErroFonte(f"alteração desconhecida: {sufixo}")
    return tabela[sufixo]


def altura(nome: str, marcas: str) -> tuple[str, int, int]:
    """(passo, alteração, oitava científica) de um nome do LilyPond; `c` sem marca é o dó 3."""
    return nome[0], _alter_do_sufixo(nome[1:]), 3 + marcas.count("'") - marcas.count(",")


def _par_de_alturas(m: re.Match) -> tuple[tuple, tuple]:
    pares = [re.fullmatch(r"([a-g])([',]*)", g) for g in m.groups()]
    if not all(pares):
        raise ErroFonte(f"\\transpose não suportado: {m.group(1)} {m.group(2)}")
    return altura(*pares[0].groups()), altura(*pares[1].groups())


def _oitavas_da_transposicao(definicao: str) -> tuple[int, str]:
    """Quantas oitavas `\\transpose x y` sobe, e o texto depois do `{` que o abre."""
    m = re.match(r"\s*\\transpose\s+(\S+)\s+(\S+)\s*\{", definicao)
    if not m:
        return 0, definicao
    a, b = _par_de_alturas(m)
    if a[:2] != b[:2]:
        raise ErroFonte("\\transpose só pode mover oitavas inteiras")
    return b[2] - a[2], definicao[m.end() - 1 :]


COMANDOS = [
    (re.compile(r"\\time\s+(\d+)/(\d+)"), "compasso", lambda g: (int(g[0]), int(g[1]))),
    (re.compile(r"\\key\s+([a-g](?:is|es|s)?)\s+\\(major|minor)"), "armadura", lambda g: (g[0], g[1])),
    (re.compile(r"\\partial\s+(\d+)(\.*)"), "anacruse", lambda g: duracao(*g)),
]


def _comando(corpo: str, pos: int, voz: Voz) -> int | None:
    """Trata \\time, \\key e \\partial na posição; devolve a posição seguinte, ou None se não é um deles."""
    for padrao, campo, converter in COMANDOS:
        m = padrao.match(corpo, pos)
        if m:
            setattr(voz, campo, converter(m.groups()))
            return m.end()
    return None


def _marca_solta(corpo: str, pos: int, eventos: list[Evento]) -> int:
    """`(`, `)`, `~`, `[` e `]` soltos valem para a nota que veio antes."""
    if not eventos or eventos[-1].tipo != "n":
        raise ErroFonte(f"marca {corpo[pos]!r} sem nota antes")
    campo = {"(": "sl_i", ")": "sl_f", "~": "tie"}.get(corpo[pos])
    if campo:
        setattr(eventos[-1], campo, True)
    return pos + 1


def _nota(m: re.Match, t: Fraction, dur: Fraction, oitavas: int) -> tuple[Evento, Fraction]:
    nome, marcas, num, pontos, mods = m.groups()
    if num:
        dur = duracao(num, pontos)
    elif pontos:
        raise ErroFonte("ponto sem número")
    extras = re.findall(r"\\[a-z]+", mods)
    if extras and extras != ["\\fermata"]:
        raise ErroFonte(f"comando de nota não suportado: {extras}")
    if nome in ("r", "s"):
        return Evento(t, dur, nome), dur
    passo, alter, oitava = altura(nome, marcas)
    return Evento(t, dur, "n", passo, alter, oitava + oitavas, "~" in mods, "(" in mods, ")" in mods), dur


def _resolver_ligaduras(eventos: list[Evento]) -> None:
    """Um arco entre duas notas de MESMA altura vale como ligadura de prolongamento; entre alturas diferentes, as notas sob o arco são melisma."""
    aberto = None
    for k, e in enumerate(eventos):
        if e.tipo != "n":
            continue
        e.ligada_a_seguinte = e.tie and k + 1 < len(eventos)
        aberto = k if e.sl_i else aberto
        if e.sl_f and aberto is not None:
            _fechar_arco(eventos, aberto, k)
            aberto = None


def _fechar_arco(eventos: list[Evento], a: int, k: int) -> None:
    if a == k:
        return
    if k == a + 1 and eventos[a].midi == eventos[k].midi:
        eventos[a].ligada_a_seguinte = True
        return
    for x in eventos[a + 1 : k + 1]:
        x.melisma = True


class _Leitor:
    """Percorre o texto de uma voz, um item por vez (comando, marca solta ou nota/pausa)."""

    def __init__(self, corpo: str, oitavas: int):
        self.corpo, self.oitavas, self.pos = corpo, oitavas, 0
        self.t, self.dur = Fraction(0), Fraction(1, 4)
        self.voz = Voz([])

    def passo(self) -> None:
        c = self.corpo[self.pos]
        novo = None if c.isspace() else _comando(self.corpo, self.pos, self.voz)
        if c.isspace():
            self.pos += 1
        elif novo is not None:
            self.pos = novo
        elif c in "()~[]":
            self.pos = _marca_solta(self.corpo, self.pos, self.voz.eventos)
        else:
            self._nota()

    def _nota(self) -> None:
        m = NOTA.match(self.corpo, self.pos)
        if not m or m.end() == self.pos:
            raise ErroFonte(f"não entendi {self.corpo[self.pos:self.pos + 30]!r}")
        e, self.dur = _nota(m, self.t, self.dur, self.oitavas)
        self.voz.eventos.append(e)
        self.t += self.dur
        self.pos = m.end()


def ler_voz(definicao: str) -> Voz:
    """Lê uma voz: eventos, compasso, armadura e anacruse (quando a própria voz os traz)."""
    oitavas, definicao = _oitavas_da_transposicao(definicao)
    corpo = COMANDOS_IGNORADOS.sub(" ", _tirar_markup(definicao)).replace("{", " ").replace("}", " ").replace("|", " ")
    leitor = _Leitor(corpo, oitavas)
    while leitor.pos < len(corpo):
        leitor.passo()
    _resolver_ligaduras(leitor.voz.eventos)
    leitor.voz.total = leitor.t
    return leitor.voz


def ler_global(definicao: str) -> Voz:
    """`global = { \\time .. \\key .. \\tempo .. \\skip .. }`: só o compasso e a armadura interessam."""
    voz = Voz([])
    for m in re.finditer(r"\\(time|key)\b", definicao):
        _comando(definicao, m.start(), voz)
    return voz


def armadura_em_numero(nome: str, modo: str) -> int:
    """Sustenidos (+) ou bemóis (-) do tom."""
    maior = {"c": 0, "g": 1, "d": 2, "a": 3, "e": 4, "b": 5, "fis": 6, "cis": 7, "f": -1, "bes": -2, "ees": -3, "aes": -4, "des": -5, "ges": -6, "ces": -7}
    menor = {"a": 0, "e": 1, "b": 2, "fis": 3, "cis": 4, "gis": 5, "dis": 6, "ais": 7, "d": -1, "g": -2, "c": -3, "f": -4, "bes": -5, "ees": -6, "aes": -7}
    return (maior if modo == "major" else menor)[nome]
