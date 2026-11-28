"""Os manifestos, o preparar-sons e o baixar-sons-gm simulam por padrão e só gravam/baixam com `--aplicar` (alias `--apply`).

Prova duas coisas: (1) sem a flag nada é criado, alterado ou baixado e a saída avisa "Nada foi gravado (simulação)";
(2) com `--aplicar` e com `--apply` o resultado é byte a byte o de sempre (o esperado vem de uma montagem independente do script).
"""
import hashlib
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest

TOOLS = Path(__file__).resolve().parent
AVISO = "Nada foi gravado (simulação)"
GITHUB = "https://github.com/HyakoV3/biblioteca-musical-pacotes/releases/download/x/"


def _carregar(nome, arquivo):
    spec = importlib.util.spec_from_file_location(nome, TOOLS / arquivo)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _rodar(script, *args, cwd):
    """Roda o script de verdade (linha de comando); devolve o processo concluído."""
    return subprocess.run([sys.executable, str(TOOLS / script), *args], cwd=cwd, capture_output=True, text=True, check=False)


def _foto(pasta: Path):
    """Tudo o que existe sob `pasta` (caminho -> bytes ou None para pasta): para provar que nada mudou."""
    return {str(p.relative_to(pasta)): (p.read_bytes() if p.is_file() else None) for p in sorted(pasta.rglob("*"))}


def _esperado(manifesto):
    return (json.dumps(manifesto, indent=1, ensure_ascii=False) + "\n").encode("utf-8")


# ---------- manifestos do hinário e das partituras (módulo comum manifesto/pacote.py) ----------

CASOS_PACOTE = [
    ("montar-manifesto-hinario.py", "hinario-001.json", json.dumps({"hinario": {"id": "x"}, "hinos": []}).encode()),
    ("montar-manifesto-partituras.py", "partituras-001.zip", b"PK\x03\x04conteudo"),
]


@pytest.mark.parametrize("caso", CASOS_PACOTE)
def test_manifesto_de_pacote_simula_sem_a_flag(tmp_path, caso):
    script, nome, dados = caso
    (tmp_path / nome).write_bytes(dados)
    antes = _foto(tmp_path)
    r = _rodar(script, GITHUB + nome, nome, "--saida", "sub/manifesto.json", cwd=tmp_path)
    assert r.returncode == 0, r.stderr
    assert AVISO in r.stdout
    assert f"{len(dados):,} bytes" in r.stdout and hashlib.sha256(dados).hexdigest()[:12] in r.stdout
    assert _foto(tmp_path) == antes
    assert not (tmp_path / "sub").exists()


@pytest.mark.parametrize("flag", ["--aplicar", "--apply"])
@pytest.mark.parametrize("caso", CASOS_PACOTE)
def test_manifesto_de_pacote_grava_igual_com_a_flag(tmp_path, caso, flag):
    script, nome, dados = caso
    (tmp_path / nome).write_bytes(dados)
    r = _rodar(script, GITHUB + nome, nome, "--saida", "sub/manifesto.json", flag, cwd=tmp_path)
    assert r.returncode == 0, r.stderr
    assert AVISO not in r.stdout
    esperado = {"versao": 1, "pacote": {"url": GITHUB + nome, "arquivo": nome, "bytes": len(dados), "sha256": hashlib.sha256(dados).hexdigest()}}
    assert (tmp_path / "sub" / "manifesto.json").read_bytes() == _esperado(esperado)


# ---------- manifesto dos sons ----------

URL_SONS = "https://exemplo.invalid/sons-x.zip"


def _dist_falso(raiz: Path, grupos):
    for g in grupos:
        (raiz / g).mkdir(parents=True)
        (raiz / g / f"{g}-mp3.js").write_bytes(b"x" * 10)
        (raiz / g / "manifesto.json").write_text(
            json.dumps({"arquivos": [{"instrumento": g, "arquivo": f"{g}-mp3.js", "bytes": 10, "sha256": "ab" * 32}]}), encoding="utf-8"
        )


def test_manifesto_de_sons_simula_sem_a_flag(tmp_path):
    mod = _carregar("montar_manifesto_sons", "montar-manifesto-sons.py")
    _dist_falso(tmp_path / "dist", mod.GRUPOS)
    antes = _foto(tmp_path)
    r = _rodar("montar-manifesto-sons.py", "--dist", "dist", "--saida", "novo/m.json", "--link", f"todos={URL_SONS}", cwd=tmp_path)
    assert r.returncode == 0, r.stderr
    assert AVISO in r.stdout
    assert "todos" in r.stdout and "4 arquivo(s)" in r.stdout
    assert _foto(tmp_path) == antes
    assert not (tmp_path / "novo").exists()


@pytest.mark.parametrize("flag", ["--aplicar", "--apply"])
def test_manifesto_de_sons_grava_igual_com_a_flag(tmp_path, flag):
    mod = _carregar("montar_manifesto_sons", "montar-manifesto-sons.py")
    _dist_falso(tmp_path / "dist", mod.GRUPOS)
    r = _rodar("montar-manifesto-sons.py", "--dist", "dist", "--saida", "novo/m.json", "--link", f"todos={URL_SONS}", flag, cwd=tmp_path)
    assert r.returncode == 0, r.stderr
    assert AVISO not in r.stdout
    arquivos = [{"instrumento": g, "arquivo": f"{g}-mp3.js", "bytes": 10, "sha256": "ab" * 32} for g in mod.GRUPOS]
    esperado = {"versao": 1, "pacotes": [{"id": "todos", "url": URL_SONS, "arquivos": arquivos}]}
    assert (tmp_path / "novo" / "m.json").read_bytes() == _esperado(esperado)


# ---------- preparar-sons ----------

NOTAS = {"C1": "AAA", "A1": "BBB", "Db4": "CCC", "C4": "DDD", "C9": "EEE"}


def _banco_falso(pasta: Path, p):
    pasta.mkdir()
    (pasta / "flute-mp3.js").write_text(p.escrever("flute", NOTAS), encoding="utf-8")
    (pasta / "organ-mp3.js").write_text(p.escrever("organ", {"C4": "FFF", "E4": "GGG"}), encoding="utf-8")


def test_preparar_sons_simula_sem_a_flag(tmp_path):
    p = _carregar("preparar_sons", "preparar-sons.py")
    _banco_falso(tmp_path / "in", p)
    antes = _foto(tmp_path)
    r = _rodar("preparar-sons.py", "--entrada", "in", "--saida", "out/sons", "--faixa", "40", "70", cwd=tmp_path)
    assert r.returncode == 0, r.stderr
    assert AVISO in r.stdout
    assert "flute" in r.stdout and "organ" in r.stdout and "out/sons" in r.stdout
    assert _foto(tmp_path) == antes
    assert not (tmp_path / "out").exists()


@pytest.mark.parametrize("flag", ["--aplicar", "--apply"])
def test_preparar_sons_grava_igual_com_a_flag(tmp_path, flag):
    p = _carregar("preparar_sons", "preparar-sons.py")
    _banco_falso(tmp_path / "in", p)
    r = _rodar("preparar-sons.py", "--entrada", "in", "--saida", "out/sons", "--faixa", "40", "70", "--pacote", "p1", "--banco", "B1", flag, cwd=tmp_path)
    assert r.returncode == 0, r.stderr
    assert AVISO not in r.stdout
    saida = tmp_path / "out" / "sons"
    flauta = p.escrever("flute", {"Db4": "CCC", "C4": "DDD"}).encode("utf-8")
    organ = p.escrever("organ", {"C4": "FFF", "E4": "GGG"}).encode("utf-8")
    assert (saida / "flute-mp3.js").read_bytes() == flauta
    assert (saida / "organ-mp3.js").read_bytes() == organ
    arquivos = [
        {"instrumento": n, "arquivo": f"{n}-mp3.js", "notas": 2, "bytes": len(d), "sha256": hashlib.sha256(d).hexdigest()}
        for n, d in (("flute", flauta), ("organ", organ))
    ]
    esperado = {"versao": 1, "pacote": "p1", "banco": "B1", "faixa": [40, 70], "arquivos": arquivos}
    assert (saida / "manifesto.json").read_bytes() == _esperado(esperado)


# ---------- baixar-sons-gm (sem rede: o urlopen é trocado por um falso) ----------


class _Resposta:
    def __init__(self, dados):
        self.dados = dados
        self.headers = {"Content-Length": str(len(dados))}

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self):
        return self.dados


def _dados_do_instrumento(nome):
    return f"MIDI.Soundfont.{nome} = {{\n\"C4\": \"data:audio/mp3;base64,AAA\",\n}}\n".encode()


def _baixar(monkeypatch, tmp_path, *args):
    """Roda o main() do baixar-sons-gm com destino em tmp_path e rede falsa; devolve (módulo, pedidos feitos)."""
    mod = _carregar("baixar_sons_gm", "baixar-sons-gm.py")
    pedidos = []

    def falso(url, timeout=None):
        pedidos.append(url)
        return _Resposta(_dados_do_instrumento(url.rsplit("/", 1)[1][: -len("-mp3.js")]))

    monkeypatch.setattr(mod, "DESTINO", tmp_path / "fonte" / "FluidR3_GM")
    monkeypatch.setattr(mod.urllib.request, "urlopen", falso)
    monkeypatch.setattr(sys, "argv", ["baixar-sons-gm.py", *args])
    mod.main()
    return mod, pedidos


def test_baixar_sons_gm_simula_sem_a_flag(monkeypatch, tmp_path, capsys):
    antes = _foto(tmp_path)
    mod, pedidos = _baixar(monkeypatch, tmp_path)
    saida = capsys.readouterr().out
    assert pedidos == []
    assert AVISO in saida
    assert all(n in saida for n in mod.INSTRUMENTOS)
    assert _foto(tmp_path) == antes


def test_baixar_sons_gm_simulacao_respeita_o_que_ja_existe(monkeypatch, tmp_path, capsys):
    destino = tmp_path / "fonte" / "FluidR3_GM"
    destino.mkdir(parents=True)
    (destino / "violin-mp3.js").write_bytes(b"antigo")
    antes = _foto(tmp_path)
    _baixar(monkeypatch, tmp_path)
    assert "violin" not in capsys.readouterr().out.split("baixaria", 1)[1].split(": ", 1)[1]
    assert _foto(tmp_path) == antes
    _baixar(monkeypatch, tmp_path, "--refazer")
    assert "violin" in capsys.readouterr().out
    assert _foto(tmp_path) == antes


@pytest.mark.parametrize("flag", ["--aplicar", "--apply"])
def test_baixar_sons_gm_baixa_igual_com_a_flag(monkeypatch, tmp_path, capsys, flag):
    mod, pedidos = _baixar(monkeypatch, tmp_path, flag)
    assert AVISO not in capsys.readouterr().out
    assert len(pedidos) == len(mod.INSTRUMENTOS)
    for nome in mod.INSTRUMENTOS:
        assert (tmp_path / "fonte" / "FluidR3_GM" / f"{nome}-mp3.js").read_bytes() == _dados_do_instrumento(nome)


def test_baixar_sons_gm_aplicar_pula_o_existente_e_refazer_baixa_de_novo(monkeypatch, tmp_path):
    destino = tmp_path / "fonte" / "FluidR3_GM"
    destino.mkdir(parents=True)
    (destino / "violin-mp3.js").write_bytes(b"antigo")
    mod, pedidos = _baixar(monkeypatch, tmp_path, "--aplicar")
    assert len(pedidos) == len(mod.INSTRUMENTOS) - 1
    assert (destino / "violin-mp3.js").read_bytes() == b"antigo"
    _, pedidos = _baixar(monkeypatch, tmp_path, "--aplicar", "--refazer")
    assert len(pedidos) == len(mod.INSTRUMENTOS)
    assert (destino / "violin-mp3.js").read_bytes() == _dados_do_instrumento("violin")
