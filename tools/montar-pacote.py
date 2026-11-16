#!/usr/bin/env python3
"""Monta o pacote .zip de um hinário com partituras (I-08): hinario.json + partituras/hino-N.svg.

Uso:  python3 tools/montar-pacote.py HINARIO.json PASTA_SVG SAIDA.zip

HINARIO.json  o que o mscx2json gera (tools/mscx2json).
PASTA_SVG     os hino-<número>.svg que tools/gerar-partituras.py gera.
SAIDA.zip     o pacote, que o app importa em Ajustes ("Importar hinário").

Cada hino do JSON que tem SVG recebe `"partitura": "partituras/hino-N.svg"`. O SVG de um hino que o JSON não tem é deixado de
fora (o app o recusaria). O zip é **reproduzível** (mesma entrada, mesmos bytes) e só leva os nomes que o app aceita
(src-tauri/src/pacote.rs). O resultado **não vai para o Git**: as partituras são do autor das transcrições.
"""
import argparse
import json
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


def juntar(hinario: dict, svgs: dict):
    """Preenche `partitura` nos hinos que têm SVG. Devolve (hinário novo, números com SVG, números de SVG sem hino).

    `svgs` é {número: caminho}. Não altera o dicionário recebido.
    """
    hinos = hinario.get("hinos")
    if not isinstance(hinos, list) or not hinos:
        raise ValueError("o hinario.json não tem a lista 'hinos'")
    novo = dict(hinario)
    novo["hinos"] = []
    com = []
    for h in hinos:
        if not isinstance(h, dict) or not isinstance(h.get("numero"), int):
            raise ValueError("há um hino sem 'numero' inteiro")
        h = dict(h)
        if h["numero"] in svgs:
            h["partitura"] = f"partituras/hino-{h['numero']}.svg"
            com.append(h["numero"])
        novo["hinos"].append(h)
    numeros = {h["numero"] for h in novo["hinos"]}
    sobrando = sorted(n for n in svgs if n not in numeros)
    return novo, sorted(com), sobrando


def escrever_zip(destino: Path, json_texto: str, svgs: dict, incluir):
    """Grava o zip: o JSON primeiro, depois os SVG em ordem de número. Reproduzível."""
    tmp = destino.with_name(destino.name + ".tmp")
    try:
        with zipfile.ZipFile(tmp, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
            def grava(nome, dados):
                info = zipfile.ZipInfo(nome, DATA_FIXA)
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o644 << 16
                z.writestr(info, dados, compresslevel=9)

            grava("hinario.json", json_texto.encode("utf-8"))
            for n in sorted(incluir):
                grava(f"partituras/hino-{n}.svg", Path(svgs[n]).read_bytes())
        tmp.replace(destino)
    finally:
        tmp.unlink(missing_ok=True)


def principal() -> int:
    ap = argparse.ArgumentParser(description="Monta o pacote .zip (hinario.json + partituras) de um hinário.")
    ap.add_argument("hinario", type=Path)
    ap.add_argument("svgs", type=Path)
    ap.add_argument("saida", type=Path)
    a = ap.parse_args()

    if not a.hinario.is_file():
        print(f"erro: {a.hinario} não é um arquivo", file=sys.stderr)
        return 2
    if not a.svgs.is_dir():
        print(f"erro: {a.svgs} não é uma pasta", file=sys.stderr)
        return 2
    try:
        hinario = json.loads(a.hinario.read_text(encoding="utf-8"))
        if not isinstance(hinario, dict):
            raise ValueError("o hinario.json não é um objeto")
    except (OSError, ValueError) as e:  # json.JSONDecodeError e UnicodeDecodeError são ValueError
        print(f"erro: não consegui ler {a.hinario}: {e}", file=sys.stderr)
        return 2

    svgs = {}
    for p in sorted(a.svgs.iterdir()):
        n = numero_do_svg(p.name)
        if n is not None and p.is_file():
            svgs[n] = p
        elif p.suffix == ".svg":
            print(f"aviso: {p.name} ignorado (o nome precisa ser hino-<número>.svg, sem zero à esquerda)", file=sys.stderr)
    try:
        novo, com, sobrando = juntar(hinario, svgs)
    except ValueError as e:
        print(f"erro: {e}", file=sys.stderr)
        return 2
    for n in sobrando:
        print(f"aviso: {svgs[n].name} ignorado (o hinario.json não tem o hino {n})", file=sys.stderr)

    texto = json.dumps(novo, ensure_ascii=False, separators=(",", ":"))
    a.saida.parent.mkdir(parents=True, exist_ok=True)
    escrever_zip(a.saida, texto, svgs, com)
    total = len(novo["hinos"])
    tamanho = a.saida.stat().st_size
    print(f"{a.saida}: {total} hinos, {len(com)} com partitura ({total - len(com)} sem); {tamanho:,} bytes ({tamanho / 1048576:.1f} MiB)")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
