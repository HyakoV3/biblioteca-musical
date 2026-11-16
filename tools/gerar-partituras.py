#!/usr/bin/env python3
"""Gera a partitura de cada hino em SVG (I-08): .mscx -> MusicXML (MuseScore 4) -> SVG (Verovio).

Uso:  python3 tools/gerar-partituras.py ENTRADA SAIDA [--largura 700] [--largura-paisagem 1200] [--so-retrato] [--escala 40]
                                              [--musescore "CMD"] [--tempo 180]

ENTRADA  pasta com arquivos hino-<número>.mscx (os mesmos que o conversor lê).
SAIDA    pasta onde ficam, para cada hino, hino-<número>.svg (RETRATO) e hino-<número>-paisagem.svg (PAISAGEM), cada um com o seu
         .timemap.json (cria a pasta se não existir).

É uma ferramenta de geração, fora do app: precisa do MuseScore 4 e do pacote Python "verovio" (pip install verovio). O
resultado **não vai para o Git** (as partituras são do autor das transcrições, como as letras).

O MuseScore é procurado, nesta ordem: --musescore, a variável BMCCB_MUSESCORE, os comandos mscore/musescore4/musescore
no PATH e o Flatpak org.musescore.MuseScore. Ele roda sem janela (QT_QPA_PLATFORM=offscreen), com limite de tempo por hino
(--tempo, em segundos). Se um hino falha, o motivo é impresso e o lote continua; o código de saída é 1 se algum falhou.

**Duas versões de cada partitura.** O SVG é pré-desenhado, então as quebras de linha são FIXAS: ele não reorganiza os compassos quando a
tela gira. Por isso saem duas versões, e o app escolhe pela tela. Medido nos 5 hinos de amostra (média de compassos por linha, e o
tamanho da nota em px por unidade do desenho):

    largura  compassos/linha  nota em retrato (380 px)  nota em paisagem (760 px)
      500          1,08              1,90                      3,80   <- "cortando": quase 1 compasso por linha
      700          1,62              1,36                      2,71   <- RETRATO (celular em pé)
     1200          3,23              0,79                      1,58   <- PAISAGEM (celular deitado, tablet, computador)

Cada SVG sai numa **página só**, que termina onde acaba a música, com viewBox (escala com a largura do contêiner), **sem a letra**: a
letra cantada tem a aba Letra, e na partitura só atrapalha. O timemap guarda o instante de cada nota e compasso, para o karaokê na
partitura (I-12, fase B); há um por versão, porque os ids das notas mudam a cada desenho.
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

# Larguras de página, em unidades do Verovio (ver o texto no começo do arquivo).
LARGURA_RETRATO = 700
LARGURA_PAISAGEM = 1200
# O sufixo do nome do arquivo de cada versão (o app lê estes nomes: src-tauri/src/pacote.rs).
SUFIXO_PAISAGEM = "-paisagem"

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


def gravar(saida: Path, arquivos: dict):
    """Grava os arquivos (nome -> bytes) por arquivo temporário + troca, para não sobrar um sem os outros se algo falhar no meio."""
    temporarios = [((saida / nome).with_name(nome + ".tmp"), saida / nome, dados) for nome, dados in arquivos.items()]
    try:
        for tmp, _, dados in temporarios:
            tmp.write_bytes(dados)
        for tmp, destino, _ in temporarios:
            tmp.replace(destino)
    finally:
        for tmp, _, _ in temporarios:
            tmp.unlink(missing_ok=True)


def versoes(largura: int, largura_paisagem: int | None):
    """As versões a gerar, como (sufixo do nome, largura da página): o retrato sempre, e a paisagem se pedida (None = só retrato)."""
    saida = [("", largura)]
    if largura_paisagem is not None:
        saida.append((SUFIXO_PAISAGEM, largura_paisagem))
    return saida


def gerar_hino(tk, musescore: list, n: int, mscx: Path, trabalho: Path, saida: Path, escala: int, versoes_: list, tempo: int = TEMPO_LIMITE):
    """Gera os arquivos de um hino (todas as versões). Devolve, por versão, (bytes do SVG, bytes comprimidos, bytes do timemap), ou levanta
    ErroHino. Nada é gravado se alguma versão falhar: o hino sai inteiro ou não sai."""
    xml = trabalho / f"hino-{n}.musicxml"
    motivo = mscx_para_musicxml(musescore, mscx, xml, tempo)
    if motivo:
        raise ErroHino(motivo)
    arquivos = {}
    medidas = []
    try:
        texto = remover_letra(xml.read_text(encoding="utf-8"))
        for sufixo, largura in versoes_:
            tk.setOptions(opcoes_verovio(largura, escala))
            if not tk.loadData(texto):
                raise ErroHino(f"o Verovio não leu o MusicXML{(' (' + sufixo.strip('-') + ')') if sufixo else ''}")
            if tk.getPageCount() != 1:
                raise ErroHino(f"saiu em {tk.getPageCount()} páginas (esperava 1){(' (' + sufixo.strip('-') + ')') if sufixo else ''}")
            svg = tk.renderToSVG(1).encode("utf-8")
            tempo_json = json.dumps(tk.renderToTimemap({"includeMeasures": True}), separators=(",", ":")).encode("utf-8")
            arquivos[f"hino-{n}{sufixo}.svg"] = svg
            arquivos[f"hino-{n}{sufixo}.timemap.json"] = tempo_json
            medidas.append((len(svg), len(gzip.compress(svg, 9)), len(tempo_json)))
        gravar(saida, arquivos)
    except (OSError, UnicodeError) as e:
        raise ErroHino(f"{type(e).__name__}: {e}") from e
    return medidas


def processar(tk, musescore: list, hinos: list, trabalho: Path, saida: Path, escala: int, versoes_: list, tempo: int = TEMPO_LIMITE):
    """Gera todos os hinos, imprime a tabela e devolve (falhas, total de bytes de SVG). Um hino ruim não para os outros."""
    falhas = 0
    total = 0
    nomes = ["retrato" if not suf else suf.strip("-") for suf, _ in versoes_]
    print(f"{'hino':>5} " + " ".join(f"{'SVG ' + nome:>14}" for nome in nomes) + f" {'gzip (todas)':>13}")
    for n, mscx in hinos:
        try:
            medidas = gerar_hino(tk, musescore, n, mscx, trabalho, saida, escala, versoes_, tempo)
        except ErroHino as e:
            print(f"{n:>5}  FALHOU: {e}", file=sys.stderr)
            falhas += 1
            continue
        total += sum(svg for svg, _, _ in medidas)
        print(f"{n:>5} " + " ".join(f"{svg:>14,}" for svg, _, _ in medidas) + f" {sum(gz for _, gz, _ in medidas):>13,}")
    return falhas, total


def principal() -> int:
    ap = argparse.ArgumentParser(description="Gera a partitura (SVG) de cada hino-N.mscx.")
    ap.add_argument("entrada", type=Path)
    ap.add_argument("saida", type=Path)
    ap.add_argument("--largura", type=inteiro_positivo, default=LARGURA_RETRATO, help=f"largura da página do RETRATO, em unidades do Verovio (padrão {LARGURA_RETRATO})")
    ap.add_argument("--largura-paisagem", type=inteiro_positivo, default=LARGURA_PAISAGEM, help=f"largura da página da PAISAGEM (padrão {LARGURA_PAISAGEM})")
    ap.add_argument("--so-retrato", action="store_true", help="não gera a versão de paisagem")
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
    versoes_ = versoes(a.largura, None if a.so_retrato else a.largura_paisagem)

    with tempfile.TemporaryDirectory(prefix="bmccb-partitura-") as t:
        trabalho = Path(t)
        musescore = achar_musescore(entrada, trabalho, a.musescore)
        if musescore is None:
            print("erro: não achei o MuseScore (use --musescore ou instale o Flatpak org.musescore.MuseScore)", file=sys.stderr)
            return 2
        print(f"verovio {tk.getVersion()}  escala={a.escala}  " + "  ".join(f"{(suf.strip('-') or 'retrato')}={larg}" for suf, larg in versoes_))
        falhas, total = processar(tk, musescore, hinos, trabalho, saida, a.escala, versoes_, a.tempo)

    print(f"{len(hinos) - falhas} de {len(hinos)} hinos; SVG somam {total:,} bytes")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(principal())
