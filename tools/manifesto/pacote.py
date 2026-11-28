"""O manifesto de UM pacote (`{"versao": 1, "pacote": {...}}`), igual para o hinário e para as partituras."""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections.abc import Callable
from pathlib import Path
from typing import NamedTuple

# O `montar` de cada script: recebe o link e o arquivo e devolve o manifesto (ou levanta ValueError).
Montar = Callable[[str, Path], dict]


def validar_https(link: str) -> None:
    """Levanta ValueError se o link não é um endereço https:// sem espaços."""
    if not link.startswith("https://") or len(link) <= len("https://") or any(c.isspace() for c in link):
        raise ValueError("o link precisa ser um endereço https:// sem espaços")


def manifesto_do_pacote(link: str, nome: str, dados: bytes) -> dict:
    """O manifesto de um pacote: o endereço, o nome do arquivo, o tamanho e o SHA-256 dos bytes."""
    return {"versao": 1, "pacote": {"url": link, "arquivo": nome, "bytes": len(dados), "sha256": hashlib.sha256(dados).hexdigest()}}


class Regras(NamedTuple):
    """As validações de cada script: do link, do conteúdo e (opcional, antes de ler o arquivo) do nome."""
    link: Callable[[str], None]
    corpo: Callable[[str, bytes], None]
    nome: Callable[[Path], None] = lambda _: None


def montar_pacote(link: str, arquivo: Path, regras: Regras) -> dict:
    """O `montar` comum: valida o link e o nome, lê o arquivo, valida o conteúdo e monta o manifesto. Levanta ValueError (ou OSError ao ler)."""
    regras.link(link)
    regras.nome(arquivo)
    dados = arquivo.read_bytes()
    regras.corpo(arquivo.name, dados)
    return manifesto_do_pacote(link, arquivo.name, dados)


def gravar_manifesto(saida: Path, manifesto: dict) -> None:
    """Grava o manifesto em JSON (cria a pasta, se faltar)."""
    saida.parent.mkdir(parents=True, exist_ok=True)
    saida.write_text(json.dumps(manifesto, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def principal_pacote(descricao: str, argumento: str, padrao: Path, montar: Montar) -> int:
    """A linha de comando `LINK ARQUIVO [--saida X]`: monta, grava e resume. Devolve o código de saída (2 se o link, o arquivo ou a gravação não servem)."""
    ap = argparse.ArgumentParser(description=descricao)
    ap.add_argument("link")
    ap.add_argument(argumento, type=Path)
    ap.add_argument("--saida", type=Path, default=padrao)
    a = ap.parse_args()
    try:
        manifesto = montar(a.link, getattr(a, argumento))
        gravar_manifesto(a.saida, manifesto)
    except (OSError, ValueError) as e:
        print(f"erro: {e}", file=sys.stderr)
        return 2
    p = manifesto["pacote"]
    print(f"{a.saida}: {p['bytes']:,} bytes, sha256 {p['sha256'][:12]}…")
    return 0
