#!/usr/bin/env python3
"""Baixa do banco FluidR3_GM (repositório midi-js-soundfonts, de Benjamin Gleitzman, licença MIT) os arquivos originais
dos instrumentos do pacote de sons gravados, para sons-fonte/FluidR3_GM/ (fora do Git e fora de static/, para não ir no APK).

Uso (a partir da raiz do projeto):
    python3 tools/baixar-sons-gm.py            # baixa os que faltam
    python3 tools/baixar-sons-gm.py --refazer  # baixa de novo todos

Cada arquivo é conferido: o tamanho tem de bater com o `Content-Length` do servidor e o conteúdo tem de ser lido do jeito
do smplr (JSON.parse do objeto de notas), com notas em base64 de mp3. Só leitura de dados: nada é executado.
O total é de cerca de 35 MB (13 arquivos de 2,1 a 3,0 MB), além dos 5 que `baixar-sons-teste.sh` já traz.
"""
import argparse
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from smplr import ler_como_o_smplr  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
DESTINO = RAIZ / "sons-fonte" / "FluidR3_GM"
BASE = "https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM"

# nome no banco -> instrumento do app
INSTRUMENTOS = {
    "recorder": "flauta doce", "violin": "violino", "trumpet": "trompete", "alto_sax": "sax alto", "oboe": "oboé",
    "viola": "viola", "tenor_sax": "sax tenor", "trombone": "trombone", "french_horn": "trompa", "cello": "violoncelo",
    "tuba": "tuba", "bassoon": "fagote", "contrabass": "contrabaixo",
}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refazer", action="store_true")
    args = ap.parse_args()
    DESTINO.mkdir(parents=True, exist_ok=True)
    total = 0
    for nome, app in INSTRUMENTOS.items():
        destino = DESTINO / f"{nome}-mp3.js"
        if destino.exists() and not args.refazer:
            print(f"{nome:12} já existe, pulando")
            continue
        with urllib.request.urlopen(f"{BASE}/{nome}-mp3.js", timeout=120) as r:
            esperado = int(r.headers.get("Content-Length", -1))
            dados = r.read()
        if esperado >= 0 and len(dados) != esperado:
            sys.exit(f"{nome}: veio {len(dados)} bytes, o servidor disse {esperado}")
        notas = ler_como_o_smplr(dados.decode("utf-8"))
        if not notas or not all(v.startswith("data:audio/mp3;base64,") for v in notas.values()):
            sys.exit(f"{nome}: conteúdo fora do formato esperado")
        destino.write_bytes(dados)
        total += len(dados)
        print(f"{nome:12} ({app:12}) {len(dados)/1e6:5.2f} MB, {len(notas)} notas")
    print(f"baixados agora: {total/1e6:.1f} MB")


if __name__ == "__main__":
    main()
