import importlib.util
from pathlib import Path

import pytest

_spec = importlib.util.spec_from_file_location("montar_manifesto_sons", Path(__file__).parent / "montar-manifesto-sons.py")
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)

URL = "https://exemplo.invalid/sons-x.zip"


def _grupos():
    return {g: [{"instrumento": g, "arquivo": f"{g}-mp3.js", "bytes": 10, "sha256": "ab" * 32}] for g in mod.GRUPOS}


def test_sem_zip_o_pacote_nao_tem_bytes_zip():
    (p,) = mod.montar_pacotes(_grupos(), [f"todos={URL}"])
    assert "bytesZip" not in p
    assert len(p["arquivos"]) == 4


def test_com_zip_grava_o_tamanho_do_zip_antes_dos_arquivos():
    (p,) = mod.montar_pacotes(_grupos(), [f"todos={URL}"], {"todos": 26554338})
    assert p["bytesZip"] == 26554338
    assert list(p) == ["id", "url", "bytesZip", "arquivos"]


def test_zip_de_um_id_sem_link_e_recusado():
    with pytest.raises(SystemExit):
        mod.montar_pacotes(_grupos(), [f"orgao={URL}"], {"metais": 1})


def test_link_que_nao_e_https_e_recusado():
    with pytest.raises(SystemExit):
        mod.montar_pacotes(_grupos(), ["orgao=http://exemplo.invalid/x.zip"])


def _rodar(monkeypatch, tmp_path, zips):
    """Roda o main() com o dist falso e os `--zip` dados; devolve o conteúdo do manifesto gravado."""
    import json
    import sys as _sys

    dist = tmp_path / "dist"
    for g in mod.GRUPOS:
        (dist / g).mkdir(parents=True, exist_ok=True)
        (dist / g / f"{g}-mp3.js").write_bytes(b"x" * 10)
        (dist / g / "manifesto.json").write_text(
            json.dumps({"arquivos": [{"instrumento": g, "arquivo": f"{g}-mp3.js", "bytes": 10, "sha256": "ab" * 32}]}), encoding="utf-8"
        )
    argv = ["x", "--dist", str(dist), "--saida", str(tmp_path / "m.json"), "--link", f"todos={URL}"] + [a for z in zips for a in ("--zip", z)] + ["--aplicar"]
    monkeypatch.setattr(_sys, "argv", argv)
    mod.main()
    return json.loads((tmp_path / "m.json").read_text(encoding="utf-8"))


def test_main_grava_o_tamanho_do_zip(monkeypatch, tmp_path):
    z = tmp_path / "a.zip"
    z.write_bytes(b"z" * 123)
    assert _rodar(monkeypatch, tmp_path, [f"todos={z}"])["pacotes"][0]["bytesZip"] == 123


@pytest.mark.parametrize("quebrado", ["=a.zip", "todos=", "semigual"])
def test_zip_mal_formado_e_recusado(monkeypatch, tmp_path, quebrado):
    with pytest.raises(SystemExit):
        _rodar(monkeypatch, tmp_path, [quebrado])


def test_zip_vazio_repetido_ou_grande_demais_e_recusado(monkeypatch, tmp_path):
    vazio = tmp_path / "v.zip"
    vazio.write_bytes(b"")
    with pytest.raises(SystemExit):
        _rodar(monkeypatch, tmp_path, [f"todos={vazio}"])
    z = tmp_path / "a.zip"
    z.write_bytes(b"z")
    with pytest.raises(SystemExit):
        _rodar(monkeypatch, tmp_path, [f"todos={z}", f"todos={z}"])
    monkeypatch.setattr(mod, "LIMITE_ZIP", 0)
    with pytest.raises(SystemExit):
        _rodar(monkeypatch, tmp_path, [f"todos={z}"])
