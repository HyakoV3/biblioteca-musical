#!/usr/bin/env python3
"""Sobe a versão do app em todos os lugares que a citam e injeta o resumo do Tezcat no CHANGELOG.md.

    tools/bump.py 0.3.10            só MOSTRA o que mudaria (é o padrão: nada é gravado)
    tools/bump.py 0.3.10 --aplicar  grava: sobe a versão e registra a qualidade do código (tzt) em CHANGELOG.md (também vale --apply)
    tools/bump.py 0.3.10 --aplicar --sem-tezcat   sobe a versão, mas não roda o tzt (nem toca o CHANGELOG.md)

Os três lugares que o workflow de release confere (package.json, src-tauri/Cargo.toml, src-tauri/tauri.conf.json) mudam sempre juntos, com
os lockfiles e os textos que dizem "versão X" (READMEs, exemplo de nome do APK, modelo de bug). NÃO mexe no que é histórico (tags rc, tabela
de versões de docs/apk-de-teste.md, roadmaps): isso registra o que existiu, e a linha da tabela leva o hash do commit, que só se sabe depois.

O resumo do Tezcat é o bloco condensado que o próprio `tzt --changelog-inject` gera (o mesmo dos outros projetos). Ver docs/release-e-apk-no-github.md.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
Plano = dict[str, str]  # arquivo -> conteúdo novo
Versoes = tuple[str, str]  # (antiga, nova)
# X.Y.Z estrito: sem zeros à esquerda (Cargo e semver os recusam), só dígitos ASCII, sem sufixo.
SEMVER = re.compile(r"(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)", re.ASCII)
TEMPO_DO_TZT = 600  # segundos
INSTALAR_TZT = "pipx install git+https://github.com/HyakoV3/tezcat.git"
# `\r?\n`: o checkout pode vir com CRLF (Windows); os arquivos são lidos e gravados byte a byte, sem converter a quebra de linha.
QL = r"\r?\n"


def como_tupla(versao: str, origem: str) -> tuple[int, int, int]:
    m = SEMVER.fullmatch(versao)
    if not m:
        sys.exit(f"{origem}: versão inválida {versao!r} (use X.Y.Z, sem zeros à esquerda e sem o sufixo -rcN: o sufixo vai só na tag)")
    return int(m[1]), int(m[2]), int(m[3])


def versao_atual() -> str:
    try:
        versao = json.loads((RAIZ / "package.json").read_text(encoding="utf-8")).get("version")
    except (OSError, ValueError, AttributeError) as erro:
        sys.exit(f"package.json ilegível: {erro}")
    if not isinstance(versao, str):
        sys.exit('package.json sem campo "version" válido')
    return versao


@dataclass(frozen=True)
class Regra:
    """Onde a versão aparece num arquivo: o padrão (com dois grupos, antes e depois da versão) e quantas vezes tem de achar."""

    arquivo: str
    padrao: str
    esperado: int = 1


def trocar(texto: str, regra: Regra, nova: str) -> str:
    """Troca a versão, exigindo exatamente `esperado` ocorrências: se o arquivo mudou de forma, melhor parar que errar calado."""
    resultado, n = re.subn(regra.padrao, rf"\g<1>{nova}\g<2>", texto, flags=re.MULTILINE)
    if n != regra.esperado:
        sys.exit(f"{regra.arquivo}: esperava {regra.esperado} ocorrência(s) de {regra.padrao!r}, achei {n}. Ajuste o script ou o arquivo.")
    return resultado


def regras(antiga: str) -> list[Regra]:
    """Cada padrão se ancora no nome do pacote: outras dependências podem ter a mesma versão do app, e `version` solto casaria com elas."""
    a = re.escape(antiga)
    return [
        Regra("package.json", rf'^(  "version": "){a}(")'),
        Regra("package-lock.json", rf'("name": "bibliotecamusical",{QL}[ ]+"version": "){a}(")', 2),
        Regra("src-tauri/Cargo.toml", rf'(\[package\]{QL}name = "bibliotecamusical"{QL}version = "){a}(")'),
        Regra("src-tauri/tauri.conf.json", rf'^(  "version": "){a}(")'),
        Regra("src-tauri/Cargo.lock", rf'(name = "bibliotecamusical"{QL}version = "){a}(")'),
        Regra("README.md", rf"(versão ){a}(\))"),
        Regra("README.en.md", rf"(version ){a}(\))"),
        Regra("README.es.md", rf"(versión ){a}(\))"),
        Regra("docs/apk-de-teste.md", rf"(`bibliotecamusical-){a}(\.apk`)"),
        Regra("docs/apk-de-teste.en.md", rf"(`bibliotecamusical-){a}(\.apk`)"),
        Regra("docs/apk-de-teste.es.md", rf"(`bibliotecamusical-){a}(\.apk`)"),
        Regra(".github/ISSUE_TEMPLATE/bug.yml", rf'(placeholder: "){a}(")'),
    ]


def planejar(antiga: str, nova: str) -> Plano:
    """Todo o conteúdo novo, em memória: só se grava depois que TUDO deu certo (não deixa o repositório pela metade)."""
    return {r.arquivo: trocar((RAIZ / r.arquivo).read_bytes().decode("utf-8"), r, nova) for r in regras(antiga)}


def gravar(plano: Plano) -> None:
    """Escreve tudo em `.bump.tmp` ao lado de cada arquivo e só então troca (os erros comuns, de permissão e de disco cheio, aparecem na
    primeira fase, antes de qualquer arquivo real mudar). Não converte quebras de linha: os bytes seguem como estavam."""
    temporarios: dict[str, Path] = {}
    try:
        for caminho, conteudo in plano.items():
            tmp = (RAIZ / caminho).with_name(Path(caminho).name + ".bump.tmp")
            tmp.write_bytes(conteudo.encode("utf-8"))
            temporarios[caminho] = tmp
        for caminho, tmp in temporarios.items():
            os.replace(tmp, RAIZ / caminho)
    finally:
        for tmp in temporarios.values():
            tmp.unlink(missing_ok=True)


def comando_do_tezcat(antiga: str, nova: str) -> list[str]:
    return ["tzt", ".", "--profile", "strict", "--no-baseline", "--changelog-inject", "--version", nova, "--prev-version", antiga, "--changelog-file", "CHANGELOG.md"]


def resumo_do_tezcat(antiga: str, nova: str) -> int:
    """Injeta o bloco "Code Quality" do tzt em CHANGELOG.md (cria o arquivo se não existir). Devolve 0 se deu certo."""
    try:
        return subprocess.run(comando_do_tezcat(antiga, nova), cwd=RAIZ, check=False, timeout=TEMPO_DO_TZT).returncode
    except subprocess.TimeoutExpired:
        print(f"O tzt passou de {TEMPO_DO_TZT} s e foi interrompido.", file=sys.stderr)
        return 124
    except OSError as erro:
        print(f"Não deu para rodar o tzt: {erro}", file=sys.stderr)
        return 2


def exigir_tzt(sem_tezcat: bool) -> None:
    if not sem_tezcat and shutil.which("tzt") is None:
        sys.exit(f"tzt não encontrado ({INSTALAR_TZT}). Nada foi gravado; instale, ou use --sem-tezcat.")


def argumentos() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Sobe a versão do app e registra a qualidade do código (Tezcat).")
    ap.add_argument("versao", help="a nova versão, X.Y.Z (sem -rcN)")
    ap.add_argument("--aplicar", "--apply", action="store_true", help="grava as mudanças (sem isto só mostra o que mudaria)")
    ap.add_argument("--sem-tezcat", action="store_true", help="não roda o tzt nem toca o CHANGELOG.md")
    return ap.parse_args()


def conferir_ordem(antiga: str, nova: str) -> None:
    anterior = como_tupla(antiga, "package.json")
    if como_tupla(nova, "argumento") <= anterior:
        sys.exit(f"a nova versão ({nova}) tem de ser maior que a atual ({antiga}).")


def mostrar(plano: Plano, versoes: Versoes, sem_tezcat: bool) -> None:
    antiga, nova = versoes
    extras = [] if sem_tezcat else ["CHANGELOG.md (tzt --changelog-inject)"]
    print(f"{antiga} -> {nova}: {len(plano) + len(extras)} arquivo(s)")
    for caminho in [*plano, *extras]:
        print(f"  {caminho}")
    if extras and shutil.which("tzt") is None:
        print(f"  ! tzt não encontrado: com --aplicar isto vai recusar ({INSTALAR_TZT}), ou use --sem-tezcat.")


def concluir(sem_tezcat: bool, antiga: str, nova: str) -> int:
    if not sem_tezcat and resumo_do_tezcat(antiga, nova) != 0:
        manual = " ".join(comando_do_tezcat(antiga, nova))
        print(f"A versão foi subida, mas o resumo do Tezcat falhou. Rode à mão: {manual}", file=sys.stderr)
        return 1
    print("\nFalta (não é automático): a linha da versão na tabela de docs/apk-de-teste.md (leva o hash do commit); depois npm run check, npm test,")
    print(f"PR, merge, e a tag v{nova} (ou v{nova}-rcN). Ver docs/release-e-apk-no-github.md.")
    return 0


def main() -> int:
    args = argumentos()
    antiga, nova = versao_atual(), args.versao
    conferir_ordem(antiga, nova)
    plano = planejar(antiga, nova)
    mostrar(plano, (antiga, nova), args.sem_tezcat)
    if not args.aplicar:
        print("\nNada foi gravado (simulação). Para valer, acrescente --aplicar.")
        return 0
    exigir_tzt(args.sem_tezcat)
    gravar(plano)
    return concluir(args.sem_tezcat, antiga, nova)


if __name__ == "__main__":
    sys.exit(main())
