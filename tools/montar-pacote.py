#!/usr/bin/env python3
"""Monta o pacote .zip de partituras (I-08): só partituras/hino-N.svg e partituras/hino-N-paisagem.svg, que o app baixa do servidor.

Uso:  python3 tools/montar-pacote.py PASTA_SVG SAIDA.zip [--aplicar]

Sem --aplicar (também vale --apply) só SIMULA: lista o que entraria no zip, sem criar a pasta nem o zip. Com --aplicar monta o pacote.

PASTA_SVG  os hino-<número>.svg (retrato) e hino-<número>-paisagem.svg que tools/gerar-partituras.py gera.
SAIDA.zip  o pacote. Depois: tools/montar-manifesto-partituras.py (nome, tamanho e SHA-256 para o manifesto do app) e, no servidor, o link
           público (docs/pacote-de-partituras.md).

O zip é **reproduzível** (mesma entrada, mesmos bytes) e só leva os nomes que o app aceita (src-tauri/src/pacote.rs): nada de hinario.json
nem de .timemap.json. Um arquivo com nome que o app recusaria (zero à esquerda, outra extensão...) é ignorado com um aviso, e a paisagem de
um hino que não tem o retrato também (o app a recusaria: a de retrato é a obrigatória). O resultado **não vai para o Git**: as partituras
são do autor das transcrições.
"""
import argparse
import re
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from aplicar import aplicar_ou_simular, flag_aplicar  # noqa: E402

SVG = re.compile(r"^hino-([1-9][0-9]{0,8})(-paisagem)?\.svg$")
DATA_FIXA = (1980, 1, 1, 0, 0, 0)  # o início do tempo do zip: sem isto cada geração teria bytes diferentes


def numero_do_svg(nome: str):
    """'hino-283.svg' -> (283, False); 'hino-283-paisagem.svg' -> (283, True); nome que o app não aceitaria -> None."""
    m = SVG.match(nome)
    return (int(m.group(1)), m.group(2) is not None) if m else None


def nome_no_zip(n: int, paisagem: bool) -> str:
    return f"partituras/hino-{n}{'-paisagem' if paisagem else ''}.svg"


def escrever_zip(destino: Path, svgs: dict):
    """Grava o zip com os SVG, por hino e com o retrato antes da paisagem. Reproduzível. `svgs` é {(número, paisagem): caminho}."""
    tmp = destino.with_name(destino.name + ".tmp")
    try:
        with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            for (n, paisagem) in sorted(svgs):
                info = zipfile.ZipInfo(nome_no_zip(n, paisagem), DATA_FIXA)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                z.writestr(info, Path(svgs[(n, paisagem)]).read_bytes(), compresslevel=9)
        tmp.replace(destino)
    finally:
        tmp.unlink(missing_ok=True)


def coletar_svgs(pasta: Path) -> dict:
    """{(número, paisagem): caminho} dos SVG com nome aceito; os outros .svg são ignorados com um aviso."""
    svgs = {}
    for p in sorted(pasta.iterdir()):
        chave = numero_do_svg(p.name)
        if chave is not None and p.is_file():
            svgs[chave] = p
        elif p.suffix == ".svg":
            print(f"aviso: {p.name} ignorado (o nome precisa ser hino-<número>.svg ou hino-<número>-paisagem.svg, sem zero à esquerda)", file=sys.stderr)
    return svgs


def descartar_paisagens_orfas(svgs: dict):
    """Tira (com aviso) a paisagem de hino sem retrato: o app a recusaria."""
    for (n, paisagem) in sorted(svgs):
        if paisagem and (n, False) not in svgs:
            print(f"aviso: hino-{n}-paisagem.svg ignorado (falta o hino-{n}.svg, o de retrato: o app recusaria a paisagem sozinha)", file=sys.stderr)
            del svgs[(n, True)]


def resumo(saida: Path, svgs: dict) -> str:
    tamanho = saida.stat().st_size
    retratos = sum(1 for (_, p) in svgs if not p)
    paisagens = len(svgs) - retratos
    return f"{saida}: {retratos} partituras ({paisagens} com versão de paisagem); {tamanho:,} bytes ({tamanho / 1048576:.1f} MiB)"


def descricao(saida: Path, svgs: dict) -> str:
    """O que a simulação diz: quantos SVG entram e em que zip, com a lista dos nomes no zip."""
    nomes = ", ".join(nome_no_zip(n, p) for n, p in sorted(svgs))
    return f"montaria {saida} com {len(svgs)} SVG: {nomes}"


def principal() -> int:
    ap = argparse.ArgumentParser(description="Monta o pacote .zip de partituras (partituras/hino-N.svg e hino-N-paisagem.svg).")
    ap.add_argument("svgs", type=Path)
    ap.add_argument("saida", type=Path)
    flag_aplicar(ap)
    a = ap.parse_args()

    if not a.svgs.is_dir():
        print(f"erro: {a.svgs} não é uma pasta", file=sys.stderr)
        return 2
    svgs = coletar_svgs(a.svgs)
    descartar_paisagens_orfas(svgs)
    if not svgs:
        print(f"erro: nenhum hino-<número>.svg em {a.svgs}", file=sys.stderr)
        return 2
    if not aplicar_ou_simular(a.aplicar, descricao(a.saida, svgs)):
        return 0
    a.saida.parent.mkdir(parents=True, exist_ok=True)
    escrever_zip(a.saida, svgs)
    print(resumo(a.saida, svgs))
    return 0


if __name__ == "__main__":
    sys.exit(principal())
