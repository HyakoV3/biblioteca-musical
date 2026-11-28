"""Os tempos de cada nota, pausa e ligadura, tirados do `timemap` do Verovio (para o karaokê na partitura, I-12 e I-26).

Cada nota e cada pausa do SVG leva o instante em que soa, DENTRO do compasso, em semínimas (as mesmas "batidas" do hinário): `data-t` é o
começo e `data-f` o fim. O app lê estes dois atributos direto do elemento e os soma ao início do compasso que toca (a lista `compassos` do
hinário), então não precisa de mapa de ids nem de arquivo à parte."""
import re

ELEMENTO_COM_TEMPO = re.compile(r'<g id="([^"]+)" class="(?:note|rest)">')
LIGADURA_NO_SVG = re.compile(r'<g id="([^"]+)" class="(tie|slur)">')
CASAS_DO_TEMPO = 4
MINIMO = 1e-6  # uma duração menor que isto é zero (nota de enfeite)

CHAVES_QUE_ABREM = ("on", "restsOn")
CHAVES_QUE_FECHAM = ("off", "restsOff")


def numero_curto(valor: float) -> str:
    """Um tempo em batidas, com no máximo 4 casas e sem zeros à direita: 1.5, 0.3333, 4."""
    texto = f"{round(valor, CASAS_DO_TEMPO):.{CASAS_DO_TEMPO}f}".rstrip("0").rstrip(".")
    return "0" if texto in ("", "-0") else texto


def _ids_do_evento(evento: dict, chaves: tuple, real) -> list:
    """Os ids do desenho dos elementos que o evento do `timemap` abre (ou fecha), na ordem das chaves."""
    return [real(id_) for chave in chaves for id_ in evento.get(chave, [])]


def _fechar(fechados: list, instante, abertas: dict, saida: dict):
    """Os elementos que o evento fecha (já pelo id do desenho) ganham o `(início, fim)` dentro do compasso; só vale a primeira vez que soam."""
    for r in fechados:
        if r in abertas:
            inicio_do_compasso, inicio = abertas.pop(r)
            saida.setdefault(r, (inicio, instante - inicio_do_compasso))


def tempos_no_compasso(timemap: list, real) -> dict:
    """Do `timemap` do Verovio (com `includeMeasures` e `includeRests`), o `(início, fim)` de cada nota e pausa DENTRO do compasso em que
    soa, em semínimas, pelo id do desenho. `real` traduz o id do `timemap` (nas repetições, o de uma cópia que não existe no SVG) para o id
    do desenho. Vale a primeira vez que o elemento soa: nas repetições o instante dentro do compasso é o mesmo. O fim pode passar do
    compasso (nota que atravessa a barra)."""
    medida = 0.0
    abertas: dict = {}
    saida: dict = {}
    for e in timemap:
        q = e["qstamp"]
        _fechar(_ids_do_evento(e, CHAVES_QUE_FECHAM, real), q, abertas, saida)
        if "measureOn" in e:
            medida = q
        for r in _ids_do_evento(e, CHAVES_QUE_ABREM, real):
            abertas[r] = (medida, q - medida)
    return saida


def inicios_absolutos(timemap: list, real) -> dict:
    """Do `timemap`, o instante ABSOLUTO (em semínimas, desde o começo da peça) em que cada nota e pausa começa a soar, pelo id do desenho. Vale a primeira vez que o
    elemento soa. Serve para medir a distância entre duas notas de uma ligadura de expressão, que pode atravessar a barra de compasso."""
    saida: dict = {}
    for e in timemap:
        for r in _ids_do_evento(e, CHAVES_QUE_ABREM, real):
            saida.setdefault(r, e["qstamp"])
    return saida


def _traducao_das_copias(tk, svg: str):
    """A função que traduz o id do `timemap` para o do desenho: nas repetições o Verovio dá cópias de cada elemento (`getExpansionIdsForElement`)."""
    copia_para_real = {}
    for m in ELEMENTO_COM_TEMPO.finditer(svg):
        for c in tk.getExpansionIdsForElement(m.group(1)) or []:
            if c:
                copia_para_real[c] = m.group(1)
    return lambda i: copia_para_real.get(i, i)  # sem repetição o Verovio não devolve cópias: o id do timemap já é o do desenho


def _duracao_da_expressao(absolutos: dict, de: str, ate: str):
    """A distância (em semínimas) entre o começo das duas notas da ligadura de expressão, ou None se não houver (nota sem tempo ou distância zero)."""
    if de in absolutos and ate in absolutos and absolutos[ate] - absolutos[de] > MINIMO:
        return absolutos[ate] - absolutos[de]
    return None


def _ligadura(tk, m, real, absolutos: dict):
    """A ligadura do `<g>` que `m` achou: `(id da curva, nota que abre, nota que fecha)` e, se for de expressão, a duração até a nota que fecha. None se não valer."""
    a = tk.getElementAttr(m.group(1))
    inicio, fim = (a.get("startid") or "").lstrip("#"), (a.get("endid") or "").lstrip("#")
    if not (inicio and fim):
        return None
    de, ate = real(inicio), real(fim)
    if m.group(2) == "tie":
        return (m.group(1), de, ate)
    duracao = _duracao_da_expressao(absolutos, de, ate)
    return None if duracao is None else (m.group(1), de, ate, duracao)


def tempos_do_desenho(tk, svg: str, timemap: list) -> tuple:
    """Pergunta ao Verovio o que o `timemap` e o SVG não dizem sozinhos: as cópias que cada elemento tem nas repetições
    (`getExpansionIdsForElement`) e as ligaduras (`startid` e `endid` de cada `<g class="tie">`, como lista de `(id da curva, nota que abre, nota que fecha)`)."""
    real = _traducao_das_copias(tk, svg)
    absolutos = inicios_absolutos(timemap, real)
    achadas = (_ligadura(tk, m, real, absolutos) for m in LIGADURA_NO_SVG.finditer(svg))
    return tempos_no_compasso(timemap, real), [l for l in achadas if l is not None]
