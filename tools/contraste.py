#!/usr/bin/env python3
"""Confere o contraste (WCAG 2.2) dos tokens de cor de src/lib/tema.css.

Uso:  python3 tools/contraste.py            # imprime a tabela e falha (exit 1) se algum par reprovar
      python3 tools/contraste.py --markdown # tabela em Markdown (para docs/design-tokens.md)

Lê os tokens do próprio CSS, um conjunto por estilo (normal, pergaminho, marinho; ver data-estilo). Em cada estilo há
o tema claro (um bloco) e o escuro (dois blocos, que precisam ser idênticos: o de @media (prefers-color-scheme: dark)
e o de [data-tema="escuro"]).

O modo "alto contraste" (I-06, :root[data-tema="alto-contraste"]) é uma paleta à parte, de um bloco só, que vale em
qualquer estilo. Ele é conferido com metas AAA (7:1 no texto e 4,5:1 nos componentes), mais rígidas que as do resto.
"""
import re
import sys
from pathlib import Path

CSS = Path(__file__).resolve().parent.parent / "src" / "lib" / "tema.css"

# (primeiro plano, fundo, mínimo, descrição). 4,5:1 = texto; 3:1 = componente de interface (1.4.11).
PARES = [
    ("texto", "fundo", 4.5, "Texto principal sobre o fundo"),
    ("texto", "superficie", 4.5, "Texto principal sobre cartões e campos"),
    ("suave", "fundo", 4.5, "Texto secundário sobre o fundo"),
    ("suave", "superficie", 4.5, "Texto secundário sobre cartões e campos"),
    ("acento", "fundo", 4.5, "Links e destaques sobre o fundo"),
    ("acento", "superficie", 4.5, "Links e destaques sobre cartões"),
    ("acento-texto", "acento", 4.5, "Texto do botão principal"),
    ("perigo", "fundo", 4.5, "Texto de ação destrutiva sobre o fundo"),
    ("perigo", "superficie", 4.5, "Texto de ação destrutiva sobre cartões"),
    ("sucesso", "superficie", 3.0, "Ícone de sucesso"),
    ("borda-controle", "fundo", 3.0, "Limite de controles sobre o fundo"),
    ("borda-controle", "superficie", 3.0, "Limite de controles sobre cartões"),
    ("foco", "fundo", 3.0, "Anel de foco sobre o fundo"),
    ("foco", "superficie", 3.0, "Anel de foco sobre cartões"),
    ("ouro-linha", "borda", 3.0, "Preenchimento da barra de progresso sobre a trilha"),
    ("ouro-linha", "fundo", 4.5, "Marca do final e aba selecionada sobre o fundo"),
    ("ouro-linha", "superficie", 4.5, "Marca do final e contorno da parte que toca sobre cartões"),
    ("ouro-sobre", "ouro", 4.5, "Texto da parte que está tocando"),
]


def luminancia(hex_):
    h = hex_.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def razao(a, b):
    la, lb = sorted((luminancia(a), luminancia(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def meta_alto_contraste(minimo):
    """Meta do modo alto contraste (AAA): 7:1 onde o normal pede 4,5:1 (texto) e 4,5:1 onde pede 3:1 (componentes)."""
    return 7.0 if minimo >= 4.5 else 4.5


def tokens_da_folha(texto, m):
    """Tokens de cor (#rrggbb) do bloco que abre em `m`; {} se o bloco contém outros blocos (ex.: @media) ou não tem token."""
    fim = texto.find("}", m.end())
    prox_abre = texto.find("{", m.end())
    if prox_abre != -1 and prox_abre < fim:
        return {}
    return dict(re.findall(r"--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;", texto[m.end() : fim]))


def guardar_tokens(estilos, alto, pilha, tokens):
    """Põe os tokens de um bloco no alto contraste ou no estilo (claro ou escuro) a que o seletor se refere."""
    # O bloco do alto contraste é UM bloco próprio. Os escuros "do sistema" só o citam dentro de :not(...), e esses
    # ficam em @media, então o que o identifica é o seletor ser exatamente :root[data-tema="alto-contraste"].
    if re.fullmatch(r':root\[data-tema="alto-contraste"\]', pilha[-1]):
        alto.update(tokens)
        return
    contexto = " ".join(pilha)
    achado = re.search(r'data-estilo="([\w-]+)"', contexto)
    estilo = estilos.setdefault(achado.group(1) if achado else "normal", {"claro": {}, "escuro": []})
    if "prefers-color-scheme: dark" in contexto or 'data-tema="escuro"' in contexto:
        estilo["escuro"].append(tokens)
    else:
        estilo["claro"].update(tokens)


def ler_tokens(texto):
    """Devolve ({estilo: {"claro": {...}, "escuro": [{...}, {...}]}}, {tokens do alto contraste}) percorrendo o CSS.

    O estilo vem de [data-estilo="x"] no seletor (sem ele, é o "normal"). O escuro de cada estilo tem dois blocos que
    precisam ser idênticos: um em @media (prefers-color-scheme: dark) e outro em [data-tema="escuro"]."""
    texto = re.sub(r"/\*.*?\*/", "", texto, flags=re.S)
    estilos = {}
    alto = {}
    pilha = []  # seletores abertos
    for m in re.finditer(r"([^{};]*)\{|\}", texto):
        if m.group(0) == "}":
            pilha.pop()
            continue
        pilha.append(m.group(1).strip())
        tokens = tokens_da_folha(texto, m)
        if tokens:
            guardar_tokens(estilos, alto, pilha, tokens)
    return estilos, alto


def erros_do_estilo(nome_estilo, est):
    """Imprime os erros de estrutura de um estilo (escuro e claro) e devolve quantos foram."""
    falhas = 0
    escuros = est["escuro"]
    if len(escuros) != 2 or escuros[0] != escuros[1]:
        print(f"ERRO ({nome_estilo}): os dois blocos do escuro precisam existir e ter os mesmos valores.")
        falhas += 1
    if not est["claro"]:
        print(f"ERRO ({nome_estilo}): falta o bloco claro.")
        falhas += 1
    return falhas


def paletas_finais(estilos, nome_estilo, est):
    """(claro, escuro) finais de um estilo, já com o que ele herda do normal."""
    escuros = est["escuro"]
    escuro = escuros[0] if escuros else {}
    # Cada estilo só redefine o que muda; o resto vem do normal (o :root padrão). Aqui conferimos a paleta final, na
    # ordem real da cascata do CSS. No escuro, o bloco claro do estilo (:root[data-estilo], especificidade igual à do
    # escuro base e escrito depois) também vale e vence o escuro base; só então o escuro do estilo (mais específico)
    # vence o claro. Ou seja: escuro base < claro do estilo < escuro do estilo. Se o escuro de um estilo omitir um
    # token, o que a pessoa vê é o valor claro do estilo, e é esse que precisa ser conferido.
    if nome_estilo == "normal":
        return est["claro"], escuro
    base = estilos["normal"]
    claro = {**base["claro"], **est["claro"]}
    escuro = {**(base["escuro"][0] if base["escuro"] else {}), **est["claro"], **escuro}
    return claro, escuro


def avaliar_par(fg, bg, minimo, paleta):
    """(razão ou None se falta token, passou?)."""
    if fg not in paleta or bg not in paleta:
        return None, False
    r = razao(paleta[fg], paleta[bg])
    return r, r >= minimo


def cabecalho_do_estilo(nome_estilo, markdown):
    if markdown:
        print(f"\n#### Estilo `{nome_estilo}`\n")
        print("| Par (texto / fundo) | Uso | Meta | Claro | Escuro |")
        print("|---|---|---|---|---|")
    else:
        print(f"\n== Estilo {nome_estilo} ==")


def imprimir_par_markdown(par, linha):
    """Linha Markdown de um par (linha = [(tema, razão, passou) do claro, idem do escuro])."""
    fg, bg, minimo, desc = par
    cel = lambda x: "—" if x[1] is None else f"{x[1]:.2f}:1 {'✓' if x[2] else '✗'}"
    print(f"| `{fg}` / `{bg}` | {desc} | {minimo}:1 | {cel(linha[0])} | {cel(linha[1])} |")


def imprimir_par_texto(par, linha):
    """Linha de texto de um par (mesmo formato de `linha`)."""
    fg, bg, minimo, _ = par
    partes = "  ".join(
        f"{n}: {'sem token' if r is None else f'{r:5.2f}:1 ' + ('ok' if ok else 'FALHA')}" for n, r, ok in linha
    )
    print(f"{fg + ' / ' + bg:<32} (meta {minimo}:1)  {partes}")


def conferir_estilo(claro, escuro, markdown):
    """Confere e imprime todos os pares de um estilo (claro e escuro); devolve quantos falharam."""
    imprimir = imprimir_par_markdown if markdown else imprimir_par_texto
    falhas = 0
    for par in PARES:
        fg, bg, minimo, _ = par
        linha = []
        for nome, paleta in (("claro", claro), ("escuro", escuro)):
            r, ok = avaliar_par(fg, bg, minimo, paleta)
            falhas += 0 if ok else 1
            linha.append((nome, r, ok))
        imprimir(par, linha)
    return falhas


def cabecalho_do_alto_contraste(markdown):
    if markdown:
        print("\n#### Modo `alto-contraste` (metas AAA)\n")
        print("| Par (texto / fundo) | Uso | Meta | Contraste |")
        print("|---|---|---|---|")
    else:
        print("\n== Modo alto contraste (metas AAA) ==")


def imprimir_par_alto(par, resultado, markdown):
    """Imprime um par do alto contraste (Markdown ou texto); resultado = (meta, razão, passou)."""
    fg, bg, _, desc = par
    meta, r, ok = resultado
    if markdown:
        print(f"| `{fg}` / `{bg}` | {desc} | {meta}:1 | {r:.2f}:1 {'✓' if ok else '✗'} |")
    else:
        print(f"{fg + ' / ' + bg:<32} (meta {meta}:1)  {r:5.2f}:1 {'ok' if ok else 'FALHA'}")


def conferir_par_alto(par, alto, markdown):
    """Confere e imprime um par do alto contraste; devolve 1 se falhou (ou faltou token), senão 0."""
    fg, bg, minimo, _ = par
    meta = meta_alto_contraste(minimo)
    if fg not in alto or bg not in alto:
        print(f"ERRO (alto-contraste): falta o token {fg if fg not in alto else bg}.")
        return 1
    r = razao(alto[fg], alto[bg])
    ok = r >= meta
    imprimir_par_alto(par, (meta, r, ok), markdown)
    return 0 if ok else 1


def conferir_alto_contraste(alto, markdown):
    """Modo alto contraste: uma paleta só, com metas AAA. Devolve quantos pares falharam."""
    cabecalho_do_alto_contraste(markdown)
    if not alto:
        print("ERRO: falta o bloco :root[data-tema=\"alto-contraste\"].")
        return 1
    return sum(conferir_par_alto(par, alto, markdown) for par in PARES)


def main():
    markdown = "--markdown" in sys.argv
    estilos, alto = ler_tokens(CSS.read_text(encoding="utf-8"))
    falhas = 0

    if "normal" not in estilos:
        print("ERRO: falta o estilo normal (o :root padrão).")
        sys.exit(1)

    for nome_estilo, est in estilos.items():
        falhas += erros_do_estilo(nome_estilo, est)
        claro, escuro = paletas_finais(estilos, nome_estilo, est)
        cabecalho_do_estilo(nome_estilo, markdown)
        falhas += conferir_estilo(claro, escuro, markdown)

    falhas += conferir_alto_contraste(alto, markdown)

    if not markdown:
        print("\nTudo dentro da meta." if falhas == 0 else f"\n{falhas} problema(s) encontrado(s).")
    sys.exit(0 if falhas == 0 else 1)


if __name__ == "__main__":
    main()
