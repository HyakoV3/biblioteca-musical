#!/usr/bin/env python3
"""Gera o pacote de exemplo embutido no app (src-tauri/exemplo/): hinário (hinario.json) e partituras (SVG) de 5 hinos de domínio público.

Entrada (src-tauri/exemplo/fontes/):
  *.ly          partituras do Mutopia Project (LilyPond), SATB, domínio público, SEM alteração (ver docs/licencas-de-terceiros.md)
  letras.json   o que o responsável escolheu para cada hino: arquivo .ly, título, letrista, compositor, andamento e a letra
                (estrofes -> versos -> marcas alinhadas às notas do soprano; ver tools/exemplo/letra.py)
Saída:
  fontes/mscx/hino-N.mscx          MuseScore mínimo que o conversor entende
  fontes/musicxml/hino-N.musicxml  o mesmo hino em MusicXML (sem letra), a entrada do Verovio
  hinario.json                     o resultado de `tools/mscx2json` sobre os .mscx (qualquer aviso do conversor interrompe)
  partituras/hino-N.svg e hino-N-paisagem.svg   com --partituras (precisa do pacote Python `verovio`; usa tools/gerar-partituras.py)

Uso:  python3 tools/gerar-exemplo.py                  # regrava .mscx, .musicxml e hinario.json
      python3 tools/gerar-exemplo.py --partituras     # e também os SVG
      python3 tools/gerar-exemplo.py --conferir       # não grava: acusa o que está fora de dia
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import shlex
import subprocess
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(RAIZ / "tools"))
from exemplo.lilypond import ErroFonte  # noqa: E402
from exemplo.montagem import preparar  # noqa: E402

EXEMPLO = RAIZ / "src-tauri" / "exemplo"
FONTES = EXEMPLO / "fontes"


def textos_dos_hinos(dados: dict) -> dict[str, str]:
    """Caminho (relativo a fontes/) -> texto de cada .mscx e .musicxml."""
    saida = {}
    for hino in dados["hinos"]:
        mscx, xml = preparar(hino, FONTES)
        saida[f"mscx/hino-{hino['numero']}.mscx"] = mscx
        saida[f"musicxml/hino-{hino['numero']}.musicxml"] = xml
    return saida


def fora_de_dia(textos: dict[str, str]) -> list[str]:
    """Os arquivos de fontes/ que faltam ou diferem do que o gerador escreveria."""
    return [n for n, t in textos.items() if not (FONTES / n).is_file() or (FONTES / n).read_text(encoding="utf-8") != t]


def gravar(textos: dict[str, str]) -> None:
    """Regrava as pastas de saída (apaga o que havia nelas) com os textos."""
    for pasta in {Path(n).parent for n in textos}:
        (FONTES / pasta).mkdir(exist_ok=True)
        for velho in (FONTES / pasta).glob("*"):
            velho.unlink()
    for n, t in textos.items():
        (FONTES / n).write_text(t, encoding="utf-8")


def converter(dados: dict) -> str | None:
    """Roda `tools/mscx2json`; devolve o hinario.json formatado (uma linha por hino), ou None (e imprime) se houve erro ou aviso."""
    with tempfile.TemporaryDirectory() as t:
        avisos = Path(t) / "avisos.txt"
        cmd = ["cargo", "run", "--release", "--quiet", "--manifest-path", str(RAIZ / "tools" / "mscx2json" / "Cargo.toml"), "--",
               "--id", dados["hinario"]["id"], "--nome", dados["hinario"]["nome"], "--avisos", str(avisos), str(FONTES / "mscx")]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            print(r.stderr, file=sys.stderr)
            return None
        texto = avisos.read_text(encoding="utf-8").strip() if avisos.is_file() else ""
    if texto and texto != "sem avisos":
        print("avisos do conversor (o exemplo tem de sair limpo):\n" + texto, file=sys.stderr)
        return None
    return formatar(com_titulos(json.loads(r.stdout), dados))


def com_titulos(h: dict, dados: dict) -> dict:
    """Junta o `titulos` (nome em pt, en e es) de cada hino, que o .mscx não carrega (ele só tem o título original)."""
    por_numero = {x["numero"]: x.get("titulos") for x in dados["hinos"]}
    for hino in h["hinos"]:
        if por_numero.get(hino["numero"]):
            hino["titulos"] = por_numero[hino["numero"]]
    return h


def formatar(h: dict) -> str:
    linhas = ["{", f'  "versao": {h["versao"]},', f'  "hinario": {json.dumps(h["hinario"], ensure_ascii=False)},', '  "hinos": [']
    n = len(h["hinos"])
    linhas += [f"    {json.dumps(x, ensure_ascii=False, separators=(',', ':'))}{',' if i < n - 1 else ''}" for i, x in enumerate(h["hinos"])]
    return "\n".join(linhas + ["  ]", "}"]) + "\n"


def desenhar(entrada: Path, saida: Path) -> dict[str, bytes] | None:
    """Roda `tools/gerar-partituras.py` (o MuseScore é trocado por uma cópia: o MusicXML já existe) e devolve nome -> bytes de cada SVG."""
    spec = importlib.util.spec_from_file_location("gerar_partituras", RAIZ / "tools" / "gerar-partituras.py")
    gp = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(gp)
    opcoes = gp.opcoes_verovio
    gp.opcoes_verovio = lambda largura, escala: {**opcoes(largura, escala), "xmlIdSeed": 1}  # ids fixos: o mesmo MusicXML dá os mesmos bytes
    copiador = shlex.join([sys.executable, str(RAIZ / "tools" / "exemplo" / "copiar_musicxml.py")])
    sys.argv = ["gerar-partituras", str(entrada), str(saida), "--musescore", copiador]
    return {p.name: p.read_bytes() for p in saida.glob("*.svg")} if gp.principal() == 0 else None


def entrada_mscx(t: Path) -> Path:
    """Uma pasta com o MusicXML de cada hino com o nome hino-N.mscx (é o que o gerador de partituras procura)."""
    entrada = t / "entrada"
    entrada.mkdir()
    for xml in (FONTES / "musicxml").glob("hino-*.musicxml"):
        (entrada / xml.name.replace(".musicxml", ".mscx")).write_bytes(xml.read_bytes())
    return entrada


def gerar_svg(conferir: bool) -> bool:
    """Põe os SVG em exemplo/partituras/ (ou confere que são os mesmos)."""
    with tempfile.TemporaryDirectory() as t:
        novos = desenhar(entrada_mscx(Path(t)), Path(t) / "svg")
    pasta = EXEMPLO / "partituras"
    if novos is None:
        return False
    if conferir:
        return novos == {p.name: p.read_bytes() for p in pasta.glob("*.svg")}
    pasta.mkdir(exist_ok=True)
    for velho in pasta.glob("*"):
        velho.unlink()
    for nome, dados in novos.items():
        (pasta / nome).write_bytes(dados)
    return True


def conferir_ou_gravar_hinario(novo: str, conferir: bool) -> bool:
    alvo = EXEMPLO / "hinario.json"
    if conferir:
        return alvo.is_file() and alvo.read_text(encoding="utf-8") == novo
    alvo.write_text(novo, encoding="utf-8")
    return True


def principal(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--conferir", action="store_true")
    ap.add_argument("--partituras", action="store_true", help="gera também os SVG (precisa do pacote verovio)")
    a = ap.parse_args(argv)
    ok = executar(a.conferir, a.partituras)
    print(("em dia" if a.conferir else "gravado") if ok else "falhou ou fora de dia", file=sys.stdout if ok else sys.stderr)
    return 0 if ok else 1


def executar(conferir: bool, com_partituras: bool) -> bool:
    dados = json.loads((FONTES / "letras.json").read_text(encoding="utf-8"))
    textos = textos_dos_hinos(dados)
    fora = fora_de_dia(textos) if conferir else []
    for n in fora:
        print(f"fora de dia: {n}", file=sys.stderr)
    if not conferir:
        gravar(textos)
    novo = converter(dados)
    ok = novo is not None and not fora and conferir_ou_gravar_hinario(novo, conferir)
    return ok and (not com_partituras or gerar_svg(conferir))


if __name__ == "__main__":
    try:
        sys.exit(principal(sys.argv[1:]))
    except ErroFonte as e:
        print(f"erro: {e}", file=sys.stderr)
        sys.exit(2)
