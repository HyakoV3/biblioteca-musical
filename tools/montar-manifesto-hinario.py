#!/usr/bin/env python3
"""Escreve o manifesto do hinário baixável (src/lib/hinario/manifesto.json), como o `montar-manifesto-partituras.py` faz para as partituras.

Uso:  python3 tools/montar-manifesto-hinario.py LINK hinario-<sha8>.json [--saida src/lib/hinario/manifesto.json]

LINK              o endereço público de download (https, no servidor que o app pode acessar: src-tauri/capabilities/default.json). Pode ser o link da
                  PASTA compartilhada que contém o arquivo (o File Browser devolve a pasta inteira em zip, e o app acha o arquivo pelo nome) ou o do arquivo.
hinario-<sha8>.json  o `hinario.json` (docs/FORMATO.md), o MESMO arquivo que está no servidor. O NOME dele vai para o manifesto (`arquivo`).

O hinário (texto e música dos hinos) NÃO entra no Git nem no app: só este manifesto (endereço, tamanho e SHA-256). O app só instala um arquivo com EXATAMENTE o
tamanho e o SHA-256 daqui; mudou o hinário no servidor, suba um arquivo com NOME NOVO (hinario-<sha8>.json: os 8 primeiros caracteres do SHA-256 do conteúdo), refaça o manifesto e gere um APK novo.
"""
import json
import sys
from pathlib import Path
from urllib.parse import SplitResult, urlsplit

sys.path.insert(0, str(Path(__file__).resolve().parent))
from manifesto.pacote import manifesto_do_pacote, principal_pacote, validar_https  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
PADRAO = RAIZ / "src" / "lib" / "hinario" / "manifesto.json"
# O que o app aceita: o limite do hinário (`LIMITE_JSON_BYTES` em src/lib/pacote.ts e `LIMITE_BYTES` em src-tauri/src/hinario.rs) e o único endereço que ele pode acessar
# (src-tauri/capabilities/default.json).
LIMITE_BYTES = 20 * 1024 * 1024
PREFIXO_GITHUB = "/HyakoV3/biblioteca-musical-pacotes/releases/download/"


def _caminho_simples(partes: SplitResult) -> bool:
    """Sem usuário, porta, "." / ".." nem "%" no caminho: o escopo do app (capabilities) compara o texto, e um caminho disfarçado sairia dele."""
    sem_credencial = partes.username is None and partes.password is None and partes.port is None
    return sem_credencial and "%" not in partes.path and not {".", ".."} & set(partes.path.split("/"))


def _validar_endereco(link: str) -> None:
    """Levanta ValueError se o link não é do release permitido no GitHub."""
    validar_https(link)
    partes = urlsplit(link)
    do_github = _caminho_simples(partes) and partes.hostname == "github.com" and partes.path.startswith(PREFIXO_GITHUB)
    if not do_github:
        raise ValueError(f"o app só pode baixar de https://github.com{PREFIXO_GITHUB}* (src-tauri/capabilities/default.json); este link é de outro endereço")


def _validar_corpo(nome: str, dados: bytes) -> None:
    """Levanta ValueError se o conteúdo não é um hinario.json que o app aceitaria."""
    if len(dados) > LIMITE_BYTES:
        raise ValueError(f"{nome} tem {len(dados):,} bytes e o app recusa hinário acima de {LIMITE_BYTES:,} (20 MiB)")
    try:
        corpo = json.loads(dados.decode("utf-8"))
    except (UnicodeDecodeError, ValueError) as e:
        raise ValueError(f"{nome} não é um JSON em UTF-8 válido: {e}") from e
    if not isinstance(corpo, dict) or "hinos" not in corpo or "hinario" not in corpo:
        raise ValueError(f"{nome} não parece um hinario.json (faltam `hinario` e `hinos`)")


def montar(link: str, arquivo: Path) -> dict:
    """O manifesto do hinário. Levanta ValueError se o link ou o arquivo não servem."""
    _validar_endereco(link)
    if not arquivo.name.endswith(".json"):
        raise ValueError(f"{arquivo.name}: o hinário é um arquivo .json")
    dados = arquivo.read_bytes()
    _validar_corpo(arquivo.name, dados)
    return manifesto_do_pacote(link, arquivo.name, dados)


def principal() -> int:
    return principal_pacote("Escreve o manifesto do hinário baixável.", "hinario", PADRAO, montar)


if __name__ == "__main__":
    sys.exit(principal())
