#!/usr/bin/env python3
"""Monta src/lib/sons/manifesto.json, o manifesto que vai DENTRO do app (ver docs/pacote-de-sons.md).

Cada link público de download no servidor entrega um zip de uma pasta compartilhada. O manifesto diz, para cada link, que
arquivos o zip deve conter e o tamanho e o SHA-256 de cada um; o app recusa o que não bater.

Uso (depois de `python3 tools/preparar-sons.py` ter gerado dist-sons/<grupo>/ e de subir as pastas para o servidor):
    python3 tools/montar-manifesto-sons.py --link todos=https://github.com/HyakoV3/biblioteca-musical-pacotes/releases/download/x/sons-XXXX.zip
    python3 tools/montar-manifesto-sons.py --link orgao=URL1 --link madeiras=URL2 --link metais=URL3 --link cordas=URL4

O id é o nome do grupo (orgao, madeiras, metais, cordas) ou `todos` (a pasta com todos os grupos). Só entram os ids que
ganharem um link.

`--zip ID=arquivo.zip` (opcional) grava no manifesto o tamanho do zip (`bytesZip`): é o que o app mostra no botão "Baixar" e usa
na barra de progresso. Sem ele, o app mostra a soma dos arquivos descompactados, que é maior que o download.
"""
import argparse
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
GRUPOS = ("orgao", "madeiras", "metais", "cordas")


def montar_pacotes(por_grupo, links, tamanhos_zip=None):
    """Os pacotes do manifesto: um por `ID=URL`, com os arquivos do grupo e, se `tamanhos_zip` o traz, o `bytesZip`."""
    tamanhos_zip = tamanhos_zip or {}
    pacotes = []
    for item in links:
        id_, _, url = item.partition("=")
        if not url.startswith("https://"):
            sys.exit(f"--link {id_}: o endereço precisa ser https://")
        if id_ == "todos":
            arquivos = [a for g in GRUPOS for a in por_grupo[g]]
        elif id_ in por_grupo:
            arquivos = por_grupo[id_]
        else:
            sys.exit(f"id desconhecido: {id_} (use {', '.join(GRUPOS)} ou todos)")
        nomes = [a["arquivo"] for a in arquivos]
        if len(set(nomes)) != len(nomes):
            sys.exit(f"{id_}: nome de arquivo repetido")
        pacote = {"id": id_, "url": url}
        if id_ in tamanhos_zip:
            pacote["bytesZip"] = tamanhos_zip[id_]
        pacote["arquivos"] = arquivos
        pacotes.append(pacote)
    for id_ in tamanhos_zip:
        if id_ not in {p["id"] for p in pacotes}:
            sys.exit(f"--zip {id_}: não há --link com esse id")
    return pacotes


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dist", type=Path, default=RAIZ / "dist-sons")
    ap.add_argument("--saida", type=Path, default=RAIZ / "src" / "lib" / "sons" / "manifesto.json")
    ap.add_argument("--link", action="append", default=[], metavar="ID=URL", required=True)
    ap.add_argument("--zip", action="append", default=[], metavar="ID=ARQUIVO", help="o zip que esse link entrega (grava o tamanho dele)")
    args = ap.parse_args()

    por_grupo = {}
    for g in GRUPOS:
        m = json.loads((args.dist / g / "manifesto.json").read_text(encoding="utf-8"))
        arquivos = [
            {"instrumento": a["instrumento"], "arquivo": a["arquivo"], "bytes": a["bytes"], "sha256": a["sha256"]}
            for a in m["arquivos"]
        ]
        for a in arquivos:  # o arquivo precisa existir e bater, senão o manifesto prometeria o que o servidor não tem
            dados = (args.dist / g / a["arquivo"]).read_bytes()
            if len(dados) != a["bytes"]:
                sys.exit(f"{g}/{a['arquivo']}: o tamanho no disco não bate com o do manifesto do grupo")
        por_grupo[g] = arquivos

    tamanhos_zip = {}
    for item in args.zip:
        id_, _, caminho = item.partition("=")
        if not Path(caminho).is_file():
            sys.exit(f"--zip {id_}: o arquivo {caminho!r} não existe")
        tamanhos_zip[id_] = Path(caminho).stat().st_size
    pacotes = montar_pacotes(por_grupo, args.link, tamanhos_zip)

    args.saida.parent.mkdir(parents=True, exist_ok=True)
    args.saida.write_text(json.dumps({"versao": 1, "pacotes": pacotes}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    for p in pacotes:
        total = sum(a["bytes"] for a in p["arquivos"])
        zip_ = f", zip {p['bytesZip']/1e6:5.2f} MB" if "bytesZip" in p else ""
        print(f"{p['id']:9} {len(p['arquivos']):2} arquivo(s), {total/1e6:5.2f} MB{zip_}")
    print("gravado em", args.saida)


if __name__ == "__main__":
    main()
