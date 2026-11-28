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
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SEMVER = re.compile(r"^(\d+)\.(\d+)\.(\d+)$")


def como_tupla(versao: str) -> tuple[int, int, int]:
    m = SEMVER.match(versao)
    if not m:
        sys.exit(f"versão inválida: {versao!r} (use X.Y.Z, sem o sufixo -rcN: o sufixo vai só na tag)")
    return int(m[1]), int(m[2]), int(m[3])


def versao_atual() -> str:
    return json.loads((RAIZ / "package.json").read_text(encoding="utf-8"))["version"]


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
    a = re.escape(antiga)
    return [
        Regra("package.json", rf'^(  "version": "){a}(")'),
        Regra("package-lock.json", rf'^(\s+"version": "){a}(",?)$', 2),
        Regra("src-tauri/Cargo.toml", rf'^(version = "){a}(")'),
        Regra("src-tauri/tauri.conf.json", rf'^(  "version": "){a}(")'),
        # No Cargo.lock só a estrofe de `bibliotecamusical` muda: outras dependências podem ter a mesma versão.
        Regra("src-tauri/Cargo.lock", rf'(name = "bibliotecamusical"\nversion = "){a}(")'),
        Regra("README.md", rf"(versão ){a}(\))"),
        Regra("README.en.md", rf"(version ){a}(\))"),
        Regra("README.es.md", rf"(versión ){a}(\))"),
        Regra("docs/apk-de-teste.md", rf"(`bibliotecamusical-){a}(\.apk`)"),
        Regra("docs/apk-de-teste.en.md", rf"(`bibliotecamusical-){a}(\.apk`)"),
        Regra("docs/apk-de-teste.es.md", rf"(`bibliotecamusical-){a}(\.apk`)"),
        Regra(".github/ISSUE_TEMPLATE/bug.yml", rf'(placeholder: "){a}(")'),
    ]


def planejar(antiga: str, nova: str) -> dict[str, str]:
    """Todo o conteúdo novo, em memória: só se grava depois que TUDO deu certo (não deixa o repositório pela metade)."""
    return {r.arquivo: trocar((RAIZ / r.arquivo).read_text(encoding="utf-8"), r, nova) for r in regras(antiga)}


def gravar(plano: dict[str, str]) -> None:
    for caminho, conteudo in plano.items():
        (RAIZ / caminho).write_text(conteudo, encoding="utf-8")


def resumo_do_tezcat(antiga: str, nova: str) -> int:
    """Injeta o bloco "Code Quality" do tzt em CHANGELOG.md (cria o arquivo se não existir)."""
    comando = ["tzt", ".", "--profile", "strict", "--no-baseline", "--changelog-inject", "--version", nova, "--prev-version", antiga, "--changelog-file", "CHANGELOG.md"]
    try:
        return subprocess.run(comando, cwd=RAIZ, check=False).returncode
    except FileNotFoundError:
        print("tzt não encontrado (pipx install git+https://github.com/HyakoV3/tezcat.git): o CHANGELOG.md ficou sem o resumo.", file=sys.stderr)
        return 2


def argumentos() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Sobe a versão do app e registra a qualidade do código (Tezcat).")
    ap.add_argument("versao", help="a nova versão, X.Y.Z (sem -rcN)")
    ap.add_argument("--aplicar", "--apply", action="store_true", help="grava as mudanças (sem isto só mostra o que mudaria)")
    ap.add_argument("--sem-tezcat", action="store_true", help="não roda o tzt nem toca o CHANGELOG.md")
    return ap.parse_args()


def main() -> int:
    args = argumentos()
    antiga, nova = versao_atual(), args.versao
    if como_tupla(nova) <= como_tupla(antiga):
        sys.exit(f"a nova versão ({nova}) tem de ser maior que a atual ({antiga}).")
    plano = planejar(antiga, nova)
    print(f"{antiga} -> {nova}: {len(plano)} arquivo(s)")
    for caminho in plano:
        print(f"  {caminho}")
    if not args.aplicar:
        print("\nNada foi gravado (simulação). Para valer, acrescente --aplicar.")
        return 0
    gravar(plano)
    if not args.sem_tezcat and resumo_do_tezcat(antiga, nova) != 0:
        print("O resumo do Tezcat falhou; a versão foi subida mesmo assim.", file=sys.stderr)
    print("\nFalta (não é automático): a linha da versão na tabela de docs/apk-de-teste.md (leva o hash do commit); depois npm run check, npm test,")
    print(f"PR, merge, e a tag v{nova} (ou v{nova}-rcN). Ver docs/release-e-apk-no-github.md.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
