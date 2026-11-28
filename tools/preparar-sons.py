#!/usr/bin/env python3
"""Prepara o pacote de sons gravados (I-07): um arquivo por instrumento, cortado à faixa de notas que os hinos usam.

Uso (a partir da raiz do projeto, depois de `sh tools/baixar-sons-teste.sh`):
    python3 tools/preparar-sons.py                       # lê sons-fonte/FluidR3_GM, grava em dist-sons/
    python3 tools/preparar-sons.py --faixa 30 86         # outra faixa de notas MIDI (padrão: 30 a 86)
    python3 tools/preparar-sons.py --instrumentos drawbar_organ flute clarinet --pacote sons-001 --saida ~/Downloads/sons-001

O que faz:
  1. lê cada `<instrumento>-mp3.js` (formato do banco FluidR3_GM do repositório midi-js-soundfonts: um objeto com uma
     nota em base64 por chave, que o smplr lê sem executar);
  2. mantém só as notas dentro da faixa. Padrão 30 a 86: os hinos de amostra usam MIDI 39 a 77, mais a transposição de
     ±6 semitons e uma terça menor de folga para o smplr transpor a amostra vizinha (cerca de 35% menos);
  3. grava no MESMO formato (o app não precisa de um carregador novo) e confere relendo como o smplr lê;
  4. escreve `manifesto.json` com tamanho e SHA-256 de cada arquivo, para o app conferir o que baixou.

A saída (`dist-sons/`) fica fora do Git. Licenças dos bancos: ver docs/licencas-de-terceiros.md.
Para um banco renderizado por tools/renderizar-banco.mjs, use `--entrada` com a pasta das amostras e `--banco` com o nome dele.
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
NOMES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
ENTRADA_PADRAO = RAIZ / "sons-fonte" / "FluidR3_GM"
SAIDA_PADRAO = RAIZ / "dist-sons"


def midi(nome):
    """'Db4' -> 61."""
    m = re.fullmatch(r"([A-G])([b#]?)(-?\d)", nome)
    if not m:
        raise ValueError(f"nome de nota inesperado: {nome!r}")
    ajuste = 1 if m.group(2) == "#" else -1 if m.group(2) == "b" else 0
    return 12 * (int(m.group(3)) + 1) + NOMES[m.group(1)] + ajuste


def ler_como_o_smplr(texto):
    """Mesma leitura do smplr (midiJsToJson): acha 'MIDI.Soundfont.', pega do '=' até a última vírgula e faz JSON.parse."""
    cabeca = texto.index("MIDI.Soundfont.")
    inicio = texto.index("=", cabeca) + 2
    fim = texto.rindex(",")
    return json.loads(texto[inicio:fim] + "}")


def escrever(nome_instrumento, notas):
    corpo = ",\n".join(f"{json.dumps(k)}: {json.dumps(v)}" for k, v in notas.items())
    return (
        "if (typeof(MIDI) === 'undefined') var MIDI = {};\n"
        "if (typeof(MIDI.Soundfont) === 'undefined') MIDI.Soundfont = {};\n"
        f"MIDI.Soundfont.{nome_instrumento} = {{\n{corpo},\n}}\n"
    )


SUFIXO = "-mp3.js"


def ler_argumentos():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--entrada", type=Path, default=ENTRADA_PADRAO)
    ap.add_argument("--saida", type=Path, default=SAIDA_PADRAO)
    ap.add_argument("--faixa", type=int, nargs=2, default=[30, 86], metavar=("MIN", "MAX"))
    ap.add_argument("--instrumentos", nargs="+", metavar="NOME", help="só estes (ex.: drawbar_organ flute); padrão: todos os da entrada")
    ap.add_argument("--pacote", default="sons", help="nome do pacote, gravado no manifesto (ex.: sons-001)")
    ap.add_argument("--banco", default="FluidR3_GM", help="nome do banco de origem, gravado no manifesto (ex.: GeneralUserGS-2.0.3)")
    return ap.parse_args()


def nome_do_instrumento(arquivo: Path) -> str:
    return arquivo.name[: -len(SUFIXO)]


def filtrar_pedidos(arquivos, instrumentos):
    """Só os arquivos dos `instrumentos` pedidos. Encerra com mensagem se faltar algum."""
    pedidos = set(instrumentos)
    arquivos = [a for a in arquivos if nome_do_instrumento(a) in pedidos]
    faltam = pedidos - {nome_do_instrumento(a) for a in arquivos}
    if faltam:
        sys.exit(f"instrumento(s) sem arquivo de entrada: {', '.join(sorted(faltam))}")
    return arquivos


def escolher_arquivos(entrada: Path, instrumentos):
    """Os `*-mp3.js` da entrada (só os `instrumentos` pedidos, se houver). Encerra com mensagem se não houver nenhum."""
    arquivos = sorted(entrada.expanduser().glob("*" + SUFIXO))
    if instrumentos:
        arquivos = filtrar_pedidos(arquivos, instrumentos)
    if not arquivos:
        sys.exit(f"nenhum *-mp3.js em {entrada} (rode tools/baixar-sons-teste.sh)")
    return arquivos


def preparar_instrumento(arq: Path, saida: Path, faixa):
    """Corta um instrumento à faixa, grava em `saida`, confere a releitura e imprime o resumo. Devolve a linha do manifesto."""
    minimo, maximo = faixa
    instrumento = nome_do_instrumento(arq)
    todas = ler_como_o_smplr(arq.read_text(encoding="utf-8"))
    mantidas = {k: v for k, v in todas.items() if minimo <= midi(k) <= maximo}
    if not mantidas:
        sys.exit(f"{instrumento}: nenhuma nota na faixa {minimo} a {maximo}")
    texto = escrever(instrumento, mantidas)
    # confere relendo do jeito do smplr: as mesmas notas, com os mesmos dados
    if ler_como_o_smplr(texto) != mantidas:
        sys.exit(f"{instrumento}: o arquivo gravado não bate com o original")
    dados = texto.encode("utf-8")
    (saida / arq.name).write_bytes(dados)
    print(f"{instrumento:14} {len(todas):3} -> {len(mantidas):3} notas | {arq.stat().st_size/1e6:5.2f} MB -> {len(dados)/1e6:5.2f} MB")
    return {
        "instrumento": instrumento,
        "arquivo": arq.name,
        "notas": len(mantidas),
        "bytes": len(dados),
        "sha256": hashlib.sha256(dados).hexdigest(),
    }


def main():
    args = ler_argumentos()
    arquivos = escolher_arquivos(args.entrada, args.instrumentos)
    saida = args.saida.expanduser()
    saida.mkdir(parents=True, exist_ok=True)

    lista = [preparar_instrumento(arq, saida, args.faixa) for arq in arquivos]

    manifesto = {"versao": 1, "pacote": args.pacote, "banco": args.banco, "faixa": list(args.faixa), "arquivos": lista}
    (saida / "manifesto.json").write_text(json.dumps(manifesto, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    total = sum(a["bytes"] for a in lista)
    print(f"{len(lista)} arquivo(s), {total/1e6:.2f} MB no total, manifesto em {saida / 'manifesto.json'}")


if __name__ == "__main__":
    main()
