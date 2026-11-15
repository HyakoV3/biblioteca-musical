#!/usr/bin/env python3
"""Monta src/lib/sons/manifesto.json, o manifesto que vai DENTRO do app (ver docs/pacote-de-sons.md).

Cada link público de download no servidor entrega um zip de uma pasta compartilhada. O manifesto diz, para cada link, que
arquivos o zip deve conter e o tamanho e o SHA-256 de cada um; o app recusa o que não bater.

Uso (depois de `python3 tools/preparar-sons.py` ter gerado dist-sons/<grupo>/ e de subir as pastas para o servidor):
    python3 tools/montar-manifesto-sons.py --link todos=https://fb.hm.hv2.xyz/public/api/resources/download?hash=XXXX
    python3 tools/montar-manifesto-sons.py --link orgao=URL1 --link madeiras=URL2 --link metais=URL3 --link cordas=URL4

O id é o nome do grupo (orgao, madeiras, metais, cordas) ou `todos` (a pasta com todos os grupos). Só entram os ids que
ganharem um link.
"""
import argparse
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
GRUPOS = ("orgao", "madeiras", "metais", "cordas")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dist", type=Path, default=RAIZ / "dist-sons")
    ap.add_argument("--saida", type=Path, default=RAIZ / "src" / "lib" / "sons" / "manifesto.json")
    ap.add_argument("--link", action="append", default=[], metavar="ID=URL", required=True)
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

    pacotes = []
    for item in args.link:
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
        pacotes.append({"id": id_, "url": url, "arquivos": arquivos})

    args.saida.parent.mkdir(parents=True, exist_ok=True)
    args.saida.write_text(json.dumps({"versao": 1, "pacotes": pacotes}, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    for p in pacotes:
        total = sum(a["bytes"] for a in p["arquivos"])
        print(f"{p['id']:9} {len(p['arquivos']):2} arquivo(s), {total/1e6:5.2f} MB")
    print("gravado em", args.saida)


if __name__ == "__main__":
    main()
