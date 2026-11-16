#!/usr/bin/env python3
"""Gera a partitura de cada hino em SVG (I-08): .mscx -> MusicXML (MuseScore 4) -> SVG (Verovio).

Uso:  python3 tools/gerar-partituras.py ENTRADA SAIDA [--largura 700] [--escala 40] [--musescore "CMD"]

ENTRADA  pasta com arquivos hino-<número>.mscx (os mesmos que o conversor lê).
SAIDA    pasta onde ficam hino-<número>.svg e hino-<número>.timemap.json (cria se não existir).

É uma ferramenta de geração, fora do app: precisa do MuseScore 4 e do pacote Python "verovio" (pip install verovio). O
resultado **não vai para o Git** (as partituras são do autor das transcrições, como as letras).

O MuseScore é procurado, nesta ordem: --musescore, a variável BMCCB_MUSESCORE, os comandos mscore/musescore4/musescore
no PATH e o Flatpak org.musescore.MuseScore. Ele roda sem janela (QT_QPA_PLATFORM=offscreen).

O SVG sai numa **página só**, que termina onde acaba a música, com viewBox (escala com a largura do contêiner). A largura
700 foi escolhida olhando um celular de 412 px: as notas ficam grandes e há poucos compassos por linha. O timemap guarda o
instante de cada nota e compasso, para o karaokê na partitura (I-12, fase B).
"""
import argparse
import gzip
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

NOME = re.compile(r"^hino-(\d+)\.mscx$")

# O MuseScore escreve o sinal de elisão (duas palavras numa nota só: "sempre_em") como um <text> solto numa fonte
# privada ("MScore Text", caractere U+E550..E552 do padrão SMuFL). Nenhuma fonte comum tem esse caractere, e a página
# mostra um quadrado. O MusicXML padrão tem o elemento <elision>, que o Verovio desenha conforme a opção lyricElision.
ELISAO_MUSESCORE = re.compile(r'<text font-family="MScore Text">[-]</text>')


def corrigir_elisao(xml: str) -> str:
    """Troca o sinal de elisão do MuseScore pelo <elision> do MusicXML."""
    return ELISAO_MUSESCORE.sub("<elision> </elision>", xml)


def numero_do_hino(nome: str):
    """'hino-283.mscx' -> 283; qualquer outro nome -> None."""
    m = NOME.match(nome)
    return int(m.group(1)) if m else None


def achar_musescore(entrada: Path, trabalho: Path, escolhido: str | None):
    """Devolve o início do comando do MuseScore (lista) ou None se não achar nenhum."""
    escolhido = escolhido or os.environ.get("BMCCB_MUSESCORE")
    if escolhido:
        return shlex.split(escolhido)
    for comando in ("mscore", "musescore4", "musescore"):
        if shutil.which(comando):
            return [comando]
    if shutil.which("flatpak"):
        achou = subprocess.run(["flatpak", "info", "org.musescore.MuseScore"], capture_output=True)
        if achou.returncode == 0:
            # O Flatpak só enxerga as pastas que se pedem: a de entrada (leitura) e a de trabalho.
            return ["flatpak", "run", f"--filesystem={entrada}:ro", f"--filesystem={trabalho}", "org.musescore.MuseScore"]
    return None


def mscx_para_musicxml(musescore: list, mscx: Path, destino: Path) -> bool:
    ambiente = dict(os.environ, QT_QPA_PLATFORM="offscreen")
    subprocess.run([*musescore, "-o", str(destino), str(mscx)], env=ambiente, capture_output=True)
    return destino.exists() and destino.stat().st_size > 0


def principal() -> int:
    ap = argparse.ArgumentParser(description="Gera a partitura (SVG) de cada hino-N.mscx.")
    ap.add_argument("entrada", type=Path)
    ap.add_argument("saida", type=Path)
    ap.add_argument("--largura", type=int, default=700, help="largura da página, em unidades do Verovio (padrão 700)")
    ap.add_argument("--escala", type=int, default=40, help="escala do Verovio, em %% (padrão 40)")
    ap.add_argument("--musescore", help='comando do MuseScore, por exemplo "flatpak run org.musescore.MuseScore"')
    a = ap.parse_args()

    entrada = a.entrada.resolve()
    if not entrada.is_dir():
        print(f"erro: {a.entrada} não é uma pasta", file=sys.stderr)
        return 2
    hinos = sorted((numero_do_hino(p.name), p) for p in entrada.iterdir() if numero_do_hino(p.name) is not None)
    if not hinos:
        print(f"erro: nenhum hino-<número>.mscx em {a.entrada}", file=sys.stderr)
        return 2

    try:
        import verovio
    except ImportError:
        print("erro: falta o pacote Python 'verovio' (pip install verovio, de preferência num venv)", file=sys.stderr)
        return 2

    a.saida.mkdir(parents=True, exist_ok=True)
    saida = a.saida.resolve()
    tk = verovio.toolkit()
    tk.setOptions({
        "pageWidth": a.largura,
        "pageHeight": 60000,
        "adjustPageHeight": True,  # a página termina onde acaba a música
        "scale": a.escala,
        "breaks": "auto",
        "svgViewBox": True,  # o SVG escala com o contêiner
        "svgRemoveXlink": True,
        "lyricElision": "unicode",  # a ligação "‿", que qualquer fonte tem
        "lyricWordSpace": 2.5,  # o padrão (1,2) cola as palavras onde duas vozes cantam letras diferentes ("bemu-")
        "header": "none",
        "footer": "none",
    })

    falhas = 0
    total = 0
    with tempfile.TemporaryDirectory(prefix="bmccb-partitura-") as t:
        trabalho = Path(t)
        musescore = achar_musescore(entrada, trabalho, a.musescore)
        if musescore is None:
            print("erro: não achei o MuseScore (use --musescore ou instale o Flatpak org.musescore.MuseScore)", file=sys.stderr)
            return 2
        print(f"verovio {tk.getVersion()}  largura={a.largura} escala={a.escala}")
        print(f"{'hino':>5} {'SVG':>10} {'gzip':>9} {'timemap':>9}")
        for n, mscx in hinos:
            xml = trabalho / f"hino-{n}.musicxml"
            if not mscx_para_musicxml(musescore, mscx, xml):
                print(f"{n:>5}  FALHOU: o MuseScore não gerou o MusicXML", file=sys.stderr)
                falhas += 1
                continue
            if not tk.loadData(corrigir_elisao(xml.read_text(encoding="utf-8"))):
                print(f"{n:>5}  FALHOU: o Verovio não leu o MusicXML", file=sys.stderr)
                falhas += 1
                continue
            if tk.getPageCount() != 1:
                print(f"{n:>5}  FALHOU: saiu em {tk.getPageCount()} páginas (esperava 1)", file=sys.stderr)
                falhas += 1
                continue
            svg = tk.renderToSVG(1).encode("utf-8")
            tempo = json.dumps(tk.renderToTimemap({"includeMeasures": True}), separators=(",", ":"))
            (saida / f"hino-{n}.svg").write_bytes(svg)
            (saida / f"hino-{n}.timemap.json").write_text(tempo, encoding="utf-8")
            total += len(svg)
            print(f"{n:>5} {len(svg):>10,} {len(gzip.compress(svg, 9)):>9,} {len(tempo):>9,}")

    feitos = len(hinos) - falhas
    print(f"{feitos} de {len(hinos)} hinos; SVG somam {total:,} bytes")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(principal())
