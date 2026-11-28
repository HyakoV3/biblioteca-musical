"""Simulação por padrão de tools/gerar-partituras.py e tools/montar-pacote.py: sem --aplicar nada é gravado; com --aplicar (ou --apply)
o resultado é byte a byte o do código anterior (o de origin/main, que sempre gravava)."""
import contextlib
import importlib.util
import io
import subprocess
import sys
from pathlib import Path
from unittest import mock

import pytest

AQUI = Path(__file__).resolve().parent
sys.path.insert(0, str(AQUI))
from test_gerar_partituras import FalsoToolkit  # noqa: E402

AVISO = "Nada foi gravado (simulação)"


def carregar(nome: str, arquivo: Path):
    spec = importlib.util.spec_from_file_location(nome, arquivo)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def codigo_antigo(tmp_path: Path, arquivo: str):
    """O script como está em origin/main (antes da simulação), copiado para tmp_path e carregado."""
    try:
        texto = subprocess.run(["git", "show", f"origin/main:tools/{arquivo}"], cwd=AQUI, capture_output=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        pytest.skip("sem git/origin/main para comparar com o código anterior")
    if b"aplicar" in texto:
        pytest.skip("origin/main já tem a simulação: nada a comparar")
    destino = tmp_path / "antigo" / arquivo
    destino.parent.mkdir(exist_ok=True)
    destino.write_bytes(texto)
    return carregar("antigo_" + arquivo.replace("-", "_").removesuffix(".py"), destino)


def rodar(modulo, *argumentos):
    saida, erro = io.StringIO(), io.StringIO()
    with mock.patch.object(sys, "argv", ["x", *argumentos]), contextlib.redirect_stdout(saida), contextlib.redirect_stderr(erro):
        codigo = modulo.principal()
    return codigo, saida.getvalue(), erro.getvalue()


def arvore(raiz: Path) -> dict:
    return {str(p.relative_to(raiz)): p.read_bytes() for p in sorted(raiz.rglob("*")) if p.is_file()}


# ---- montar-pacote ----

def prepara_svgs(pasta: Path):
    pasta.mkdir()
    for nome in ("hino-1.svg", "hino-1-paisagem.svg", "hino-2.svg"):
        (pasta / nome).write_text(f"<svg>{nome}</svg>", encoding="utf-8")


@pytest.fixture(scope="module")
def montar():
    return carregar("montar_pacote_novo", AQUI / "montar-pacote.py")


def test_montar_pacote_sem_aplicar_nao_grava_nada(tmp_path, montar):
    svgs = tmp_path / "svgs"
    prepara_svgs(svgs)
    antes = arvore(tmp_path)
    codigo, saida, _ = rodar(montar, str(svgs), str(tmp_path / "nova" / "pacote.zip"))
    assert codigo == 0
    assert AVISO in saida
    assert "partituras/hino-1-paisagem.svg" in saida
    assert arvore(tmp_path) == antes
    assert not (tmp_path / "nova").exists()


@pytest.mark.parametrize("flag", ["--aplicar", "--apply"])
def test_montar_pacote_com_aplicar_e_igual_ao_codigo_anterior(tmp_path, montar, flag):
    antigo = codigo_antigo(tmp_path, "montar-pacote.py")
    svgs = tmp_path / "svgs"
    prepara_svgs(svgs)
    assert rodar(antigo, str(svgs), str(tmp_path / "a" / "p.zip"))[0] == 0
    codigo, saida, _ = rodar(montar, str(svgs), str(tmp_path / "b" / "p.zip"), flag)
    assert codigo == 0
    assert AVISO not in saida
    assert (tmp_path / "b" / "p.zip").read_bytes() == (tmp_path / "a" / "p.zip").read_bytes()


# ---- gerar-partituras ----

class Toolkit(FalsoToolkit):
    def getVersion(self):
        return "falso"


def prepara_mscx(pasta: Path):
    pasta.mkdir()
    for n in (1, 2):
        (pasta / f"hino-{n}.mscx").write_text("<mscx/>", encoding="utf-8")


def falso_musescore(cmd, **k):
    Path(cmd[cmd.index("-o") + 1]).write_text("<score/>", encoding="utf-8")
    return subprocess.CompletedProcess(cmd, 0, "", "")


def roda_gerar(modulo, *argumentos):
    """Roda o gerar-partituras com MuseScore e Verovio falsos (o Verovio devolve o mesmo desenho sempre)."""
    verovio = mock.Mock(toolkit=Toolkit)
    with mock.patch.object(subprocess, "run", falso_musescore), mock.patch.object(modulo, "importar_verovio", return_value=verovio), \
            mock.patch.object(modulo, "achar_musescore", return_value=["m"]):
        return rodar(modulo, *argumentos)


@pytest.fixture(scope="module")
def gerar():
    return carregar("gerar_partituras_novo", AQUI / "gerar-partituras.py")


def test_gerar_partituras_sem_aplicar_nao_grava_nada(tmp_path, gerar):
    mscx = tmp_path / "mscx"
    prepara_mscx(mscx)
    antes = arvore(tmp_path)
    chamadas = []
    with mock.patch.object(gerar, "gerar_tudo", lambda *a, **k: chamadas.append(1)):
        codigo, saida, _ = roda_gerar(gerar, str(mscx), str(tmp_path / "svg"))
    assert codigo == 0
    assert AVISO in saida
    assert "2 hino(s)" in saida and "hino-N-paisagem.timemap.json" in saida
    assert not chamadas
    assert arvore(tmp_path) == antes
    assert not (tmp_path / "svg").exists()


@pytest.mark.parametrize("flag", ["--aplicar", "--apply"])
def test_gerar_partituras_com_aplicar_e_igual_ao_codigo_anterior(tmp_path, gerar, flag):
    antigo = codigo_antigo(tmp_path, "gerar-partituras.py")
    mscx = tmp_path / "mscx"
    prepara_mscx(mscx)
    assert roda_gerar(antigo, str(mscx), str(tmp_path / "a"))[0] == 0
    codigo, saida, _ = roda_gerar(gerar, str(mscx), str(tmp_path / "b"), flag)
    assert codigo == 0
    assert AVISO not in saida
    esperado = arvore(tmp_path / "a")
    assert len(esperado) == 8
    assert arvore(tmp_path / "b") == esperado
