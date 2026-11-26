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
