#!/usr/bin/env python3
"""Monta o pacote .zip de partituras (I-08): só partituras/hino-N.svg, que o app baixa do servidor.

Uso:  python3 tools/montar-pacote.py PASTA_SVG SAIDA.zip

PASTA_SVG  os hino-<número>.svg que tools/gerar-partituras.py gera.
SAIDA.zip  o pacote. Depois: tools/montar-manifesto-partituras.py (tamanho e SHA-256 para o manifesto do app) e, no servidor, o link público
           (docs/pacote-de-partituras.md).

O zip é **reproduzível** (mesma entrada, mesmos bytes) e só leva os nomes que o app aceita (src-tauri/src/pacote.rs): nada de hinario.json.
Um arquivo com nome que o app recusaria (zero à esquerda, outra extensão...) é ignorado com um aviso. O resultado **não vai para o Git**: as
partituras são do autor das transcrições.
"""
import argparse
import re
import sys
import zipfile
from pathlib import Path

SVG = re.compile(r"^hino-([1-9][0-9]{0,8})\.svg$")
DATA_FIXA = (1980, 1, 1, 0, 0, 0)  # o início do tempo do zip: sem isto cada geração teria bytes diferentes


def numero_do_svg(nome: str):
    """'hino-283.svg' -> 283; nome que o app não aceitaria (zero à esquerda, outra extensão...) -> None."""
    m = SVG.match(nome)
    return int(m.group(1)) if m else None


def escrever_zip(destino: Path, svgs: dict):
    """Grava o zip com os SVG em ordem de número. Reproduzível. `svgs` é {número: caminho}."""
    tmp = destino.with_name(destino.name + ".tmp")
    try:
        with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for n in sorted(svgs):
                info = zipfile.ZipInfo(f"partituras/hino-{n}.svg", DATA_FIXA)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                z.writestr(info, Path(svgs[n]).read_bytes(), compresslevel=9)
        tmp.replace(destino)
    finally:
        tmp.unlink(missing_ok=True)


def principal() -> int:
    ap = argparse.ArgumentParser(description="Monta o pacote .zip de partituras (só partituras/hino-N.svg).")
    ap.add_argument("svgs", type=Path)
    ap.add_argument("saida", type=Path)
    a = ap.parse_args()

    if not a.svgs.is_dir():
        print(f"erro: {a.svgs} não é uma pasta", file=sys.stderr)
        return 2
    svgs = {}
    for p in sorted(a.svgs.iterdir()):
        n = numero_do_svg(p.name)
        if n is not None and p.is_file():
            svgs[n] = p
        elif p.suffix == ".svg":
            print(f"aviso: {p.name} ignorado (o nome precisa ser hino-<número>.svg, sem zero à esquerda)", file=sys.stderr)
    if not svgs:
        print(f"erro: nenhum hino-<número>.svg em {a.svgs}", file=sys.stderr)
        return 2
    a.saida.parent.mkdir(parents=True, exist_ok=True)
    escrever_zip(a.saida, svgs)
    tamanho = a.saida.stat().st_size
    print(f"{a.saida}: {len(svgs)} partituras; {tamanho:,} bytes ({tamanho / 1048576:.1f} MiB)")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
