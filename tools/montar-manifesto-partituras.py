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
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from manifesto.pacote import manifesto_do_pacote, principal_pacote, validar_https  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
PADRAO = RAIZ / "src" / "lib" / "partituras" / "manifesto.json"


def montar(link: str, zip_: Path) -> dict:
    """O manifesto de um pacote. Levanta ValueError se o link ou o arquivo não servem."""
    validar_https(link)
    dados = zip_.read_bytes()
    if not dados.startswith(b"PK\x03\x04"):
        raise ValueError(f"{zip_.name} não parece um zip")
    return manifesto_do_pacote(link, zip_.name, dados)


def principal() -> int:
    return principal_pacote("Escreve o manifesto do pacote de partituras.", "pacote", PADRAO, montar)


if __name__ == "__main__":
    sys.exit(principal())
