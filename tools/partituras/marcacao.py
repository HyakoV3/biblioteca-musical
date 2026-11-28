"""Escreve no SVG os tempos (`data-t`, `data-f`) de cada nota, pausa e ligadura (ver `tempos.py`)."""
import re

from .tempos import ELEMENTO_COM_TEMPO, LIGADURA_NO_SVG, MINIMO, numero_curto

# O desenho (`d`) de cada curva: duas curvas sobre as mesmas notas com o MESMO desenho são DUPLICATAS (o MuseScore guarda duas ligaduras iguais, uma por cima da outra) e cada
# uma leva o tempo inteiro; os PEDAÇOS de uma curva partida pelo fim da linha têm desenhos diferentes (um no fim de uma linha e outro no começo da seguinte) e dividem o tempo.
DESENHO_DA_CURVA = re.compile(r'<g id="([^"]+)" class="(?:tie|slur)"[^>]*>\s*<path d="([^"]*)"')


def _com_tempo(elemento: str, inicio: float, fim: float) -> str:
    """O `<g ...>` do elemento com `data-t` e `data-f` no fim da tag."""
    return f'{elemento[:-1]} data-t="{numero_curto(inicio)}" data-f="{numero_curto(fim)}">'


def _marcar_elementos(svg: str, tempos: dict) -> tuple:
    """O SVG com o tempo em cada nota e pausa que tem tempo (e duração), e quantos foram marcados."""
    marcados = 0

    def troca(m):
        nonlocal marcados
        if m.group(1) not in tempos:
            return m.group(0)
        inicio, fim = tempos[m.group(1)]
        if fim - inicio <= MINIMO:
            return m.group(0)
        marcados += 1
        return _com_tempo(m.group(0), inicio, fim)

    return ELEMENTO_COM_TEMPO.sub(troca, svg), marcados


def _agrupar_pedacos(ligaduras: list) -> tuple:
    """Os pedaços de uma ligadura partida pelo fim da linha só se juntam aos da MESMA espécie: uma ligadura de prolongamento e uma de expressão sobre as mesmas
    duas notas são curvas diferentes, e dividir o tempo entre elas daria meio tempo a cada uma. Devolve (ids por `(expressão?, de, até)`, duração por `(de, até)`)."""
    pedacos = {}
    duracoes = {}
    for item in ligaduras:
        gid, de, ate = item[:3]
        expressao = len(item) > 3
        pedacos.setdefault((expressao, de, ate), []).append(gid)
        if expressao:
            duracoes[(de, ate)] = item[3]
    return pedacos, duracoes


def _dividir_entre_pedacos(ids: list, inicio: float, fim: float, desenho: dict) -> dict:
    """O tempo de cada curva (id -> (início, fim)): os pedaços são os desenhos DIFERENTES, na ordem do SVG; as duplicatas de um mesmo desenho (ou curvas sem
    desenho conhecido, cada uma por si) ficam no mesmo pedaço."""
    lugares: list = []
    for gid in ids:
        chave = desenho.get(gid, gid)
        if chave not in lugares:
            lugares.append(chave)
    passo = (fim - inicio) / len(lugares)
    saida = {}
    for gid in ids:
        k = lugares.index(desenho.get(gid, gid))
        saida[gid] = (inicio + k * passo, inicio + (k + 1) * passo)
    return saida


def _tempo_das_curvas(ligaduras: list, tempos: dict, desenho: dict) -> dict:
    """O tempo de cada curva: o da nota que abre (na de expressão, até o começo da nota que fecha), dividido entre os pedaços da mesma ligadura."""
    pedacos, duracoes = _agrupar_pedacos(ligaduras)
    saida = {}
    for (expressao, de, ate), ids in pedacos.items():
        if de not in tempos:
            continue
        inicio, fim = tempos[de]
        if expressao:
            fim = inicio + duracoes[(de, ate)]  # expressão: até o começo da nota que fecha
        if fim - inicio > MINIMO:
            saida.update(_dividir_entre_pedacos(ids, inicio, fim, desenho))
    return saida


def _marcar_curvas(svg: str, tempo_da_curva: dict) -> str:
    def curva(m):
        t = tempo_da_curva.get(m.group(1))
        return m.group(0) if t is None else _com_tempo(m.group(0), t[0], t[1])

    return LIGADURA_NO_SVG.sub(curva, svg)


def marcar_notas(svg: str, tempos: dict, ligaduras: list) -> tuple:
    """O SVG com `data-t` e `data-f` em cada nota e pausa que tem tempo, e nas ligaduras. Devolve (svg, quantas notas e pausas foram marcadas).
    Cada nota acende no SEU tempo, inclusive a segunda de uma ligadura (o som é uma nota só, mas na partitura o halo acompanha a curva e depois
    preenche a segunda nota). `ligaduras` é uma lista de `(id do <g class="tie">, id da nota que abre, id da que fecha)`: a curva leva o tempo da
    nota que abre (de onde a luz parte até onde a segunda começa). Se a ligadura foi partida em duas pelo fim da linha, o tempo se divide em partes
    iguais, na ordem. Sem tempo (nota sem evento) ou com duração zero (nota de enfeite): sem atributos, não acende.
    Uma ligadura de EXPRESSÃO vem com um 4º item, a duração (em semínimas) do começo da nota que abre ao começo da que fecha: a curva dela leva
    `(início da nota que abre, início + duração)` (a duração, e não o fim da primeira nota)."""
    svg, marcados = _marcar_elementos(svg, tempos)
    desenho = {m.group(1): m.group(2) for m in DESENHO_DA_CURVA.finditer(svg)}
    return _marcar_curvas(svg, _tempo_das_curvas(ligaduras, tempos, desenho)), marcados
