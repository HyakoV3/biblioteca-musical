"""Os arquivos de saída: quais versões gerar, gravação segura e limpeza das versões que não foram pedidas."""
from pathlib import Path

# O sufixo do nome do arquivo de cada versão (o app lê estes nomes: src-tauri/src/pacote.rs).
SUFIXO_PAISAGEM = "-paisagem"
EXTENSOES = (".svg", ".timemap.json")


def versoes(largura: int, largura_paisagem: int | None):
    """As versões a gerar, como (sufixo do nome, largura da página): o retrato sempre, e a paisagem se pedida (None = só retrato)."""
    saida = [("", largura)]
    if largura_paisagem is not None:
        saida.append((SUFIXO_PAISAGEM, largura_paisagem))
    return saida


def gravar(saida: Path, arquivos: dict):
    """Grava os arquivos (nome -> bytes) por arquivo temporário + troca. Se algo falhar ENQUANTO se escrevem os temporários (disco cheio, por
    exemplo), nenhum destino é tocado e nenhum temporário sobra. A troca em si (`replace`, um arquivo por vez, na mesma pasta) não é atômica
    para o conjunto: se uma troca falhar no meio, os anteriores já valem. O hino é então dado como falho (código de saída 1) e basta rodar de
    novo, que ele é gravado inteiro."""
    temporarios = [((saida / nome).with_name(nome + ".tmp"), saida / nome, dados) for nome, dados in arquivos.items()]
    try:
        for tmp, _, dados in temporarios:
            tmp.write_bytes(dados)
        for tmp, destino, _ in temporarios:
            tmp.replace(destino)
    finally:
        for tmp, _, _ in temporarios:
            tmp.unlink(missing_ok=True)


def apagar_versoes_nao_pedidas(saida: Path, n: int, versoes_: list):
    """A versão não pedida nesta rodada não pode sobrar de uma rodada anterior: o montador de pacote empacotaria a paisagem velha ao lado
    do retrato novo, e o app mostraria desenhos diferentes ao girar o aparelho."""
    for sufixo in {"", SUFIXO_PAISAGEM} - {s for s, _ in versoes_}:
        for extensao in EXTENSOES:
            (saida / f"hino-{n}{sufixo}{extensao}").unlink(missing_ok=True)


def simular(entrada: Path, saida: Path, hinos: list, versoes_: list):
    """Diz o que seria gerado (hinos achados e arquivos de saída), sem rodar o MuseScore nem o Verovio e sem criar nada."""
    nomes = [f"hino-N{sufixo}{extensao}" for sufixo, _ in versoes_ for extensao in EXTENSOES]
    print(f"{len(hinos)} hino(s) achado(s) em {entrada}: hino-{hinos[0][0]}.mscx ... hino-{hinos[-1][0]}.mscx")
    print(f"por hino, {len(nomes)} arquivos em {saida}: {', '.join(nomes)}")
    print(f"ao todo {len(hinos) * len(nomes)} arquivos")
    if len(versoes_) == 1:
        print("e apagaria a versão de paisagem (e o timemap dela) que já existir na saída")
