#!/usr/bin/env python3
"""Gera a partitura de cada hino em SVG (I-08): .mscx -> MusicXML (MuseScore 4) -> SVG (Verovio).

Uso:  python3 tools/gerar-partituras.py ENTRADA SAIDA [--largura 500] [--escala 40] [--musescore "CMD"] [--tempo 180]

ENTRADA  pasta com arquivos hino-<número>.mscx (os mesmos que o conversor lê).
SAIDA    pasta onde ficam hino-<número>.svg e hino-<número>.timemap.json (cria se não existir).

É uma ferramenta de geração, fora do app: precisa do MuseScore 4 e do pacote Python "verovio" (pip install verovio). O
resultado **não vai para o Git** (as partituras são do autor das transcrições, como as letras).

O MuseScore é procurado, nesta ordem: --musescore, a variável BMCCB_MUSESCORE, os comandos mscore/musescore4/musescore
no PATH e o Flatpak org.musescore.MuseScore. Ele roda sem janela (QT_QPA_PLATFORM=offscreen), com limite de tempo por hino
(--tempo, em segundos). Se um hino falha, o motivo é impresso e o lote continua; o código de saída é 1 se algum falhou.

O SVG sai numa **página só**, que termina onde acaba a música, com viewBox (escala com a largura do contêiner), **sem a letra**: a
letra cantada tem a aba Letra, e na partitura só atrapalha (alarga os compassos e alonga a página). A largura 500 (era 700) deixa as
notas **1,4x maiores** num celular de 412 px em pé, à custa de mais rolagem vertical (medido nos hinos de amostra: no 276, de 1,6 mil
para 2,7 mil px de altura; no 457, de 5,8 mil para 11 mil px). O timemap guarda o instante de cada nota e compasso, para o
karaokê na partitura (I-12, fase B).
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

# A letra da partitura sai: todo <lyric>...</lyric> do MusicXML (incluindo o sinal de elisão que o MuseScore escreve dentro dele). Só o
# elemento <lyric> verdadeiro: <lyric-font> e <lyric-language>, que ficam em <defaults>, têm o mesmo começo e NÃO podem ser tocados (um
# padrão frouxo apagaria a partitura inteira entre o primeiro <lyric-font> e o primeiro </lyric>).
LETRA_MUSICXML = re.compile(r"<lyric(?=[\s>])(?:[^<>]*/>|.*?</lyric>)", re.S)

LARGURA_PADRAO = 500  # unidades do Verovio (ver o texto no começo do arquivo)

TEMPO_LIMITE = 180  # segundos por hino no MuseScore (nos hinos de amostra ele leva menos de 1 s)


class ErroHino(Exception):
    """Um hino que não deu certo; a mensagem diz o porquê e o lote continua."""


def remover_letra(xml: str) -> str:
    """O MusicXML sem a letra (os elementos <lyric>)."""
    return LETRA_MUSICXML.sub("", xml)


def numero_do_hino(nome: str):
    """'hino-283.mscx' -> 283; qualquer outro nome -> None."""
    m = NOME.match(nome)
    return int(m.group(1)) if m else None


def inteiro_positivo(texto: str) -> int:
    """Para o argparse: --largura e --escala precisam ser inteiros maiores que zero."""
    try:
        valor = int(texto)
    except ValueError:
        raise argparse.ArgumentTypeError(f"'{texto}' não é um número inteiro") from None
    if valor <= 0:
        raise argparse.ArgumentTypeError(f"precisa ser maior que zero (veio {valor})")
    return valor


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


def opcoes_verovio(largura: int, escala: int) -> dict:
    """As opções do Verovio. As de saída do SVG importam para o app (ver src-tauri/src/svg.rs, que só aceita o que sai daqui)."""
    return {
        "pageWidth": largura,
        "pageHeight": 60000,
        "adjustPageHeight": True,  # a página termina onde acaba a música
        "scale": escala,
        "breaks": "auto",
        "svgViewBox": True,  # o SVG escala com o contêiner
        "svgRemoveXlink": True,  # href em vez de xlink:href (o app recusa xlink)
        # Por padrão cada SVG leva a fonte Leipzig inteira embutida (58 KB em base64, num @font-face com url(data:...)), igual em
        # todos os hinos. O app traz a fonte uma vez só; o SVG fica sem ela (e sem nenhum url(), que o app recusa).
        "smuflTextFont": "none",
        "svgFormatRaw": True,  # sem indentação: o arquivo cai para menos da metade
        "header": "none",
        "footer": "none",
    }


def ultimas_linhas(texto: str, quantas: int = 3) -> str:
    linhas = [l.strip() for l in (texto or "").splitlines() if l.strip()]
    return " | ".join(linhas[-quantas:])


def mscx_para_musicxml(musescore: list, mscx: Path, destino: Path, tempo: int = TEMPO_LIMITE):
    """Roda o MuseScore. Devolve None se o MusicXML saiu, ou o motivo da falha (texto)."""
    ambiente = dict(os.environ, QT_QPA_PLATFORM="offscreen")
    try:
        r = subprocess.run([*musescore, "-o", str(destino), str(mscx)], env=ambiente, capture_output=True, text=True,
                           errors="replace", timeout=tempo)
    except subprocess.TimeoutExpired:
        return f"o MuseScore passou de {tempo} s e foi interrompido"
    except OSError as e:
        return f"não consegui rodar o MuseScore ({' '.join(musescore)}): {e}"
    if destino.exists() and destino.stat().st_size > 0:
        return None
    # Em caso de sucesso o MuseScore também escreve avisos inofensivos; só se mostram quando não saiu arquivo.
    motivo = f"o MuseScore não gerou o MusicXML (código {r.returncode})"
    detalhe = ultimas_linhas(r.stderr or r.stdout)
    return f"{motivo}: {detalhe}" if detalhe else motivo


def gravar(saida: Path, n: int, svg: bytes, tempo_json: str):
    """Grava o SVG e o timemap do hino por arquivo temporário + troca, para não sobrar um sem o outro."""
    pares = [(saida / f"hino-{n}.svg", svg), (saida / f"hino-{n}.timemap.json", tempo_json.encode("utf-8"))]
    temporarios = [(d.with_name(d.name + ".tmp"), d) for d, _ in pares]
    try:
        for (tmp, _), (_, dados) in zip(temporarios, pares):
            tmp.write_bytes(dados)
        for tmp, destino in temporarios:
            tmp.replace(destino)
    finally:
        for tmp, _ in temporarios:
            tmp.unlink(missing_ok=True)


def gerar_hino(tk, musescore: list, n: int, mscx: Path, trabalho: Path, saida: Path, tempo: int = TEMPO_LIMITE):
    """Gera os arquivos de um hino. Devolve (bytes do SVG, bytes comprimidos, bytes do timemap) ou levanta ErroHino."""
    xml = trabalho / f"hino-{n}.musicxml"
    motivo = mscx_para_musicxml(musescore, mscx, xml, tempo)
    if motivo:
        raise ErroHino(motivo)
    try:
        texto = xml.read_text(encoding="utf-8")
        if not tk.loadData(remover_letra(texto)):
            raise ErroHino("o Verovio não leu o MusicXML")
        if tk.getPageCount() != 1:
            raise ErroHino(f"saiu em {tk.getPageCount()} páginas (esperava 1)")
        svg = tk.renderToSVG(1).encode("utf-8")
        tempo_json = json.dumps(tk.renderToTimemap({"includeMeasures": True}), separators=(",", ":"))
        gravar(saida, n, svg, tempo_json)
    except (OSError, UnicodeError) as e:
        raise ErroHino(f"{type(e).__name__}: {e}") from e
    return len(svg), len(gzip.compress(svg, 9)), len(tempo_json.encode("utf-8"))


def processar(tk, musescore: list, hinos: list, trabalho: Path, saida: Path, tempo: int = TEMPO_LIMITE):
    """Gera todos os hinos, imprime a tabela e devolve (falhas, total de bytes de SVG). Um hino ruim não para os outros."""
    falhas = 0
    total = 0
    print(f"{'hino':>5} {'SVG':>10} {'gzip':>9} {'timemap':>9}")
    for n, mscx in hinos:
        try:
            svg, gz, tm = gerar_hino(tk, musescore, n, mscx, trabalho, saida, tempo)
        except ErroHino as e:
            print(f"{n:>5}  FALHOU: {e}", file=sys.stderr)
            falhas += 1
            continue
        total += svg
        print(f"{n:>5} {svg:>10,} {gz:>9,} {tm:>9,}")
    return falhas, total


def principal() -> int:
    ap = argparse.ArgumentParser(description="Gera a partitura (SVG) de cada hino-N.mscx.")
    ap.add_argument("entrada", type=Path)
    ap.add_argument("saida", type=Path)
    ap.add_argument("--largura", type=inteiro_positivo, default=LARGURA_PADRAO, help=f"largura da página, em unidades do Verovio (padrão {LARGURA_PADRAO})")
    ap.add_argument("--escala", type=inteiro_positivo, default=40, help="escala do Verovio, em %% (padrão 40)")
    ap.add_argument("--musescore", help='comando do MuseScore, por exemplo "flatpak run org.musescore.MuseScore"')
    ap.add_argument("--tempo", type=inteiro_positivo, default=TEMPO_LIMITE, help=f"limite de segundos por hino no MuseScore (padrão {TEMPO_LIMITE})")
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
    tk.setOptions(opcoes_verovio(a.largura, a.escala))

    with tempfile.TemporaryDirectory(prefix="bmccb-partitura-") as t:
        trabalho = Path(t)
        musescore = achar_musescore(entrada, trabalho, a.musescore)
        if musescore is None:
            print("erro: não achei o MuseScore (use --musescore ou instale o Flatpak org.musescore.MuseScore)", file=sys.stderr)
            return 2
        print(f"verovio {tk.getVersion()}  largura={a.largura} escala={a.escala}")
        falhas, total = processar(tk, musescore, hinos, trabalho, saida, a.tempo)

    print(f"{len(hinos) - falhas} de {len(hinos)} hinos; SVG somam {total:,} bytes")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(principal())
