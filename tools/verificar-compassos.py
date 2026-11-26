#!/usr/bin/env python3
"""Confere os `compassos` do hinário contra os compassos desenhados nas partituras (PART-001).

Uso:  python3 tools/verificar-compassos.py hinario.json PASTA_OU_ZIP_DAS_PARTITURAS

O hinário traz, por hino, em que instante cada compasso começa (`compassos`, com o ÍNDICE do compasso escrito, docs/FORMATO.md), e a partitura é um SVG do
Verovio em que cada compasso é um `<g class="measure">`. O app acende o compasso `g.measure[índice]` (src/lib/Partitura.svelte); se o índice passa do que o
SVG desenhou, o destaque some em silêncio. Nada mais confere os dois pacotes entre si: rode isto ANTES de publicar o hinário ou as partituras.

PASTA_OU_ZIP_DAS_PARTITURAS: a pasta com hino-N.svg e hino-N-paisagem.svg (a mesma que o montar-pacote.py lê), ou o zip montado por ele.
Falha (saída 1) se, em qualquer hino com `compassos`: o maior índice + 1 for maior que o número de `g.measure` do SVG (retrato ou paisagem), ou se o
retrato e a paisagem tiverem números diferentes de compassos (o `compassos` vale para as duas versões). Hino sem SVG ou sem `compassos` só é contado.
"""
import json
import re
import sys
import zipfile
from pathlib import Path

NOME = re.compile(r"(?:partituras/)?hino-([1-9][0-9]{0,8})(-paisagem)?\.svg$")
MEDIDA = re.compile(r'<g\b[^>]*\bclass="[^"]*\bmeasure\b[^"]*"')


def compassos_do_svg(texto: str) -> int:
    """Quantos `<g class="measure">` o SVG tem."""
    return len(MEDIDA.findall(texto))


def ler_svgs(origem: Path) -> dict:
    """{(número, paisagem): texto do SVG} de uma pasta ou de um zip."""
    svgs = {}
    if origem.is_dir():
        itens = ((p.name, p.read_text(encoding="utf-8")) for p in sorted(origem.iterdir()) if p.is_file())
    else:
        with zipfile.ZipFile(origem) as z:
            itens = [(n, z.read(n).decode("utf-8")) for n in z.namelist()]
    for nome, texto in itens:
        m = NOME.search(nome)
        if m:
            svgs[(int(m.group(1)), m.group(2) is not None)] = texto
    return svgs


def maior_indice(compassos: dict):
    """O maior índice de compasso em normal, final e introdução; None se não há nenhum."""
    indices = [i for lista in (compassos.get("normal"), compassos.get("final"), compassos.get("introducao")) for _, i in (lista or [])]
    return max(indices) if indices else None


def verificar(hinario: dict, svgs: dict) -> tuple:
    """(problemas, hinos conferidos, hinos sem SVG). Cada problema é um texto."""
    problemas, conferidos, sem_svg = [], 0, 0
    for hino in hinario.get("hinos", []):
        comp = hino.get("compassos")
        n = hino.get("numero")
        if not comp:
            continue
        maior = maior_indice(comp)
        if maior is None:
            continue
        versoes = {paisagem: svgs.get((n, paisagem)) for paisagem in (False, True)}
        if all(v is None for v in versoes.values()):
            sem_svg += 1
            continue
        conferidos += 1
        contagem = {p: compassos_do_svg(t) for p, t in versoes.items() if t is not None}
        for paisagem, quantos in contagem.items():
            nome = "paisagem" if paisagem else "retrato"
            if maior + 1 > quantos:
                problemas.append(f"hino {n} ({nome}): o `compassos` chega ao índice {maior}, mas o SVG desenha só {quantos} compassos")
        if len(set(contagem.values())) > 1:
            problemas.append(f"hino {n}: retrato e paisagem têm números diferentes de compassos ({contagem[False]} e {contagem[True]})")
    return problemas, conferidos, sem_svg


def main(argv):
    if len(argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    hinario = json.loads(Path(argv[1]).read_text(encoding="utf-8"))
    problemas, conferidos, sem_svg = verificar(hinario, ler_svgs(Path(argv[2])))
    print(f"hinos conferidos: {conferidos} | com `compassos` e sem SVG: {sem_svg}")
    if problemas:
        print(f"\n{len(problemas)} problema(s):")
        for p in problemas:
            print("  -", p)
        return 1
    print("Compassos consistentes com as partituras.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
