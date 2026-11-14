#!/usr/bin/env python3
"""Confere o contraste (WCAG 2.2) dos tokens de cor de src/lib/tema.css.

Uso:  python3 tools/contraste.py            # imprime a tabela e falha (exit 1) se algum par reprovar
      python3 tools/contraste.py --markdown # tabela em Markdown (para docs/design-tokens.md)

Lê os tokens do próprio CSS: tema claro (bloco :root), tema escuro (bloco @media dark e
:root[data-tema="escuro"], que precisam ser idênticos).
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
    ("acento", "borda", 3.0, "Preenchimento da barra de progresso sobre a trilha"),
]


def luminancia(hex_):
    h = hex_.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)


def razao(a, b):
    la, lb = sorted((luminancia(a), luminancia(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def ler_tokens(texto):
    """Devolve {'claro': {...}, 'escuro': [{...}, {...}]} percorrendo os blocos do CSS."""
    texto = re.sub(r"/\*.*?\*/", "", texto, flags=re.S)
    claro, escuros = {}, []
    pilha = []  # seletores abertos
    pos = 0
    for m in re.finditer(r"([^{};]*)\{|\}", texto):
        if m.group(0) == "}":
            pilha.pop()
            continue
        # texto entre o fim do bloco anterior e este "{" é o seletor
        pilha.append(m.group(1).strip())
        fim = texto.find("}", m.end())
        prox_abre = texto.find("{", m.end())
        if prox_abre != -1 and prox_abre < fim:
            continue  # bloco que contém outros blocos (ex.: @media)
        corpo = texto[m.end() : fim]
        tokens = dict(re.findall(r"--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;", corpo))
        if not tokens:
            continue
        contexto = " ".join(pilha)
        if "prefers-color-scheme: dark" in contexto or 'data-tema="escuro"' in contexto:
            escuros.append(tokens)
        else:
            claro.update(tokens)
    return claro, escuros


def main():
    markdown = "--markdown" in sys.argv
    claro, escuros = ler_tokens(CSS.read_text(encoding="utf-8"))
    falhas = 0

    if len(escuros) != 2 or escuros[0] != escuros[1]:
        print("ERRO: os dois blocos do tema escuro precisam existir e ter os mesmos valores.")
        falhas += 1
    escuro = escuros[0] if escuros else {}

    if markdown:
        print("| Par (texto / fundo) | Uso | Meta | Claro | Escuro |")
        print("|---|---|---|---|---|")
    for fg, bg, minimo, desc in PARES:
        linha = []
        for nome, paleta in (("claro", claro), ("escuro", escuro)):
            if fg not in paleta or bg not in paleta:
                linha.append((nome, None, False))
                falhas += 1
                continue
            r = razao(paleta[fg], paleta[bg])
            ok = r >= minimo
            falhas += 0 if ok else 1
            linha.append((nome, r, ok))
        if markdown:
            cel = lambda x: "—" if x[1] is None else f"{x[1]:.2f}:1 {'✓' if x[2] else '✗'}"
            print(f"| `{fg}` / `{bg}` | {desc} | {minimo}:1 | {cel(linha[0])} | {cel(linha[1])} |")
        else:
            partes = "  ".join(
                f"{n}: {'sem token' if r is None else f'{r:5.2f}:1 ' + ('ok' if ok else 'FALHA')}" for n, r, ok in linha
            )
            print(f"{fg + ' / ' + bg:<32} (meta {minimo}:1)  {partes}")

    if not markdown:
        print("\nTudo dentro da meta." if falhas == 0 else f"\n{falhas} problema(s) encontrado(s).")
    sys.exit(0 if falhas == 0 else 1)


if __name__ == "__main__":
    main()
