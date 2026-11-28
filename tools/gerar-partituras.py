#!/usr/bin/env python3
"""Gera a partitura de cada hino em SVG (I-08): .mscx -> MusicXML (MuseScore 4) -> SVG (Verovio).

Uso:  python3 tools/gerar-partituras.py ENTRADA SAIDA [--largura 700] [--largura-paisagem 1200] [--so-retrato] [--escala 40]
                                              [--musescore "CMD"] [--tempo 180]

ENTRADA  pasta com arquivos hino-<número>.mscx (os mesmos que o conversor lê).
SAIDA    pasta onde ficam, para cada hino, hino-<número>.svg (RETRATO) e hino-<número>-paisagem.svg (PAISAGEM), cada um com o seu
         .timemap.json (cria a pasta se não existir).

É uma ferramenta de geração, fora do app: precisa do MuseScore 4 e do pacote Python "verovio" (pip install verovio). O
resultado **não vai para o Git** (as partituras são do autor das transcrições, como as letras).

O MuseScore é procurado, nesta ordem: --musescore, a variável BM_MUSESCORE, os comandos mscore/musescore4/musescore
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
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from partituras.gravacao import apagar_versoes_nao_pedidas, gravar, versoes  # noqa: E402
from partituras.marcacao import marcar_notas  # noqa: E402
from partituras.musescore import TEMPO_LIMITE, achar_musescore, mscx_para_musicxml  # noqa: E402
from partituras.musicxml import remover_andamento, remover_letra  # noqa: E402
from partituras.tempos import tempos_do_desenho  # noqa: E402

NOME = re.compile(r"^hino-(\d+)\.mscx$")

# Larguras de página, em unidades do Verovio (ver o texto no começo do arquivo).
LARGURA_RETRATO = 700
LARGURA_PAISAGEM = 1200


class ErroHino(Exception):
    """Um hino que não deu certo; a mensagem diz o porquê e o lote continua."""


@dataclass(frozen=True)
class Lote:
    """O que vale para todos os hinos da rodada: o Verovio, o MuseScore, as pastas e as versões a gerar."""
    tk: object
    musescore: list
    trabalho: Path
    saida: Path
    escala: int
    versoes: list
    tempo: int = TEMPO_LIMITE


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


def _rotulo(sufixo: str) -> str:
    """' (paisagem)' para a versão de paisagem; nada para o retrato. Entra nas mensagens de erro."""
    return f" ({sufixo.strip('-')})" if sufixo else ""


def desenhar_versao(lote: Lote, texto: str, largura: int, sufixo: str) -> tuple:
    """Desenha uma versão do hino no Verovio e devolve (bytes do SVG já com os tempos, bytes do timemap) ou levanta ErroHino."""
    tk = lote.tk
    tk.setOptions(opcoes_verovio(largura, lote.escala))
    if not tk.loadData(texto):
        raise ErroHino(f"o Verovio não leu o MusicXML{_rotulo(sufixo)}")
    if tk.getPageCount() != 1:
        raise ErroHino(f"saiu em {tk.getPageCount()} páginas (esperava 1){_rotulo(sufixo)}")
    svg_texto = tk.renderToSVG(1)
    mapa = tk.renderToTimemap({"includeMeasures": True, "includeRests": True})
    tempos, ligaduras = tempos_do_desenho(tk, svg_texto, mapa)
    svg_texto, _ = marcar_notas(svg_texto, tempos, ligaduras)
    return svg_texto.encode("utf-8"), json.dumps(mapa, separators=(",", ":")).encode("utf-8")


def gerar_hino(lote: Lote, n: int, mscx: Path):
    """Gera os arquivos de um hino (todas as versões). Devolve, por versão, (bytes do SVG, bytes comprimidos, bytes do timemap), ou levanta
    ErroHino. Nada é gravado se alguma versão falhar em ser DESENHADA (o MuseScore ou o Verovio falhando): o hino sai inteiro ou não sai. As
    versões que NESTA rodada não foram pedidas (`--so-retrato`) são apagadas da pasta de saída, para não sobrar uma paisagem de uma rodada
    anterior ao lado de um retrato novo."""
    xml = lote.trabalho / f"hino-{n}.musicxml"
    motivo = mscx_para_musicxml(lote.musescore, mscx, xml, lote.tempo)
    if motivo:
        raise ErroHino(motivo)
    arquivos = {}
    medidas = []
    try:
        texto = remover_andamento(remover_letra(xml.read_text(encoding="utf-8")))
        for sufixo, largura in lote.versoes:
            svg, tempo_json = desenhar_versao(lote, texto, largura, sufixo)
            arquivos[f"hino-{n}{sufixo}.svg"] = svg
            arquivos[f"hino-{n}{sufixo}.timemap.json"] = tempo_json
            medidas.append((len(svg), len(gzip.compress(svg, 9)), len(tempo_json)))
        gravar(lote.saida, arquivos)
        apagar_versoes_nao_pedidas(lote.saida, n, lote.versoes)
    except (OSError, UnicodeError) as e:
        raise ErroHino(f"{type(e).__name__}: {e}") from e
    return medidas


def _cabecalho(versoes_: list) -> str:
    nomes = ["retrato" if not suf else suf.strip("-") for suf, _ in versoes_]
    return f"{'hino':>5} " + " ".join(f"{'SVG ' + nome:>14}" for nome in nomes) + f" {'gzip (todas)':>13}"


def _linha(n: int, medidas: list) -> str:
    return f"{n:>5} " + " ".join(f"{svg:>14,}" for svg, _, _ in medidas) + f" {sum(gz for _, gz, _ in medidas):>13,}"


def processar(lote: Lote, hinos: list):
    """Gera todos os hinos, imprime a tabela e devolve (falhas, total de bytes de SVG). Um hino ruim não para os outros."""
    falhas = 0
    total = 0
    print(_cabecalho(lote.versoes))
    for n, mscx in hinos:
        try:
            medidas = gerar_hino(lote, n, mscx)
        except ErroHino as e:
            print(f"{n:>5}  FALHOU: {e}", file=sys.stderr)
            falhas += 1
            continue
        total += sum(svg for svg, _, _ in medidas)
        print(_linha(n, medidas))
    return falhas, total


def montar_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description="Gera a partitura (SVG) de cada hino-N.mscx.")
    ap.add_argument("entrada", type=Path)
    ap.add_argument("saida", type=Path)
    ap.add_argument("--largura", type=inteiro_positivo, default=LARGURA_RETRATO, help=f"largura da página do RETRATO, em unidades do Verovio (padrão {LARGURA_RETRATO})")
    ap.add_argument("--largura-paisagem", type=inteiro_positivo, default=LARGURA_PAISAGEM, help=f"largura da página da PAISAGEM (padrão {LARGURA_PAISAGEM})")
    ap.add_argument("--so-retrato", action="store_true", help="não gera a versão de paisagem")
    ap.add_argument("--escala", type=inteiro_positivo, default=40, help="escala do Verovio, em %% (padrão 40)")
    ap.add_argument("--musescore", help='comando do MuseScore, por exemplo "flatpak run org.musescore.MuseScore"')
    ap.add_argument("--tempo", type=inteiro_positivo, default=TEMPO_LIMITE, help=f"limite de segundos por hino no MuseScore (padrão {TEMPO_LIMITE})")
    return ap


def hinos_da_pasta(entrada: Path, como_dado: Path):
    """Os (número, arquivo) dos hino-<número>.mscx da pasta, em ordem; None (com a mensagem de erro) se a pasta não existe ou não tem nenhum."""
    if not entrada.is_dir():
        print(f"erro: {como_dado} não é uma pasta", file=sys.stderr)
        return None
    hinos = sorted((numero_do_hino(p.name), p) for p in entrada.iterdir() if numero_do_hino(p.name) is not None)
    if not hinos:
        print(f"erro: nenhum hino-<número>.mscx em {como_dado}", file=sys.stderr)
        return None
    return hinos


def importar_verovio():
    """O módulo `verovio`, ou None (com a mensagem de erro) se não estiver instalado."""
    try:
        import verovio
    except ImportError:
        print("erro: falta o pacote Python 'verovio' (pip install verovio, de preferência num venv)", file=sys.stderr)
        return None
    return verovio


def gerar_tudo(a: argparse.Namespace, entrada: Path, hinos: list, verovio) -> int:
    """Prepara a saída, acha o MuseScore e gera os hinos. Devolve o código de saída."""
    a.saida.mkdir(parents=True, exist_ok=True)
    saida = a.saida.resolve()
    tk = verovio.toolkit()
    versoes_ = versoes(a.largura, None if a.so_retrato else a.largura_paisagem)
    with tempfile.TemporaryDirectory(prefix="bm-partitura-") as t:
        trabalho = Path(t)
        musescore = achar_musescore(entrada, trabalho, a.musescore)
        if musescore is None:
            print("erro: não achei o MuseScore (use --musescore ou instale o Flatpak org.musescore.MuseScore)", file=sys.stderr)
            return 2
        print(f"verovio {tk.getVersion()}  escala={a.escala}  " + "  ".join(f"{(suf.strip('-') or 'retrato')}={larg}" for suf, larg in versoes_))
        falhas, total = processar(Lote(tk, musescore, trabalho, saida, a.escala, versoes_, a.tempo), hinos)
    print(f"{len(hinos) - falhas} de {len(hinos)} hinos; SVG somam {total:,} bytes")
    return 1 if falhas else 0


def principal() -> int:
    a = montar_parser().parse_args()
    entrada = a.entrada.resolve()
    hinos = hinos_da_pasta(entrada, a.entrada)
    verovio = importar_verovio() if hinos else None
    if not (hinos and verovio):
        return 2
    return gerar_tudo(a, entrada, hinos, verovio)


if __name__ == "__main__":
    sys.exit(principal())
