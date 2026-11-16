#!/usr/bin/env python3
"""Escreve o manifesto do pacote de partituras (src/lib/partituras/manifesto.json), como o `montar-manifesto-sons.py` faz para os sons.

Uso:  python3 tools/montar-manifesto-partituras.py LINK PACOTE.zip [--saida src/lib/partituras/manifesto.json]

LINK       o endereço público de download (https, no servidor que o app pode acessar: src-tauri/capabilities/default.json). Pode ser o link
           da PASTA compartilhada que contém o zip (o File Browser devolve a pasta inteira em zip, e o app acha o zip pelo nome) ou o do próprio
           arquivo.
PACOTE.zip o zip de tools/montar-pacote.py, o MESMO arquivo que está no servidor. O NOME dele vai para o manifesto (`arquivo`).

O app só instala um zip que tenha EXATAMENTE o tamanho e o SHA-256 daqui; mudou o pacote no servidor, refaça o manifesto e gere um APK
novo. Sem esse manifesto (`"pacote": null`), o botão Baixar não aparece.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
PADRAO = RAIZ / "src" / "lib" / "partituras" / "manifesto.json"


def montar(link: str, zip_: Path) -> dict:
    """O manifesto de um pacote. Levanta ValueError se o link ou o arquivo não servem."""
    if not link.startswith("https://") or len(link) <= len("https://") or any(c.isspace() for c in link):
        raise ValueError("o link precisa ser um endereço https:// sem espaços")
    dados = zip_.read_bytes()
    if not dados.startswith(b"PK\x03\x04"):
        raise ValueError(f"{zip_.name} não parece um zip")
    return {"versao": 1, "pacote": {"url": link, "arquivo": zip_.name, "bytes": len(dados), "sha256": hashlib.sha256(dados).hexdigest()}}


def principal() -> int:
    ap = argparse.ArgumentParser(description="Escreve o manifesto do pacote de partituras.")
    ap.add_argument("link")
    ap.add_argument("pacote", type=Path)
    ap.add_argument("--saida", type=Path, default=PADRAO)
    a = ap.parse_args()
    try:
        manifesto = montar(a.link, a.pacote)
    except (OSError, ValueError) as e:
        print(f"erro: {e}", file=sys.stderr)
        return 2
    a.saida.parent.mkdir(parents=True, exist_ok=True)
    a.saida.write_text(json.dumps(manifesto, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    p = manifesto["pacote"]
    print(f"{a.saida}: {p['bytes']:,} bytes, sha256 {p['sha256'][:12]}…")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
