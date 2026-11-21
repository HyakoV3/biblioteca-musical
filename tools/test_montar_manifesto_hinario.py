import importlib.util
import json
from pathlib import Path

import pytest

_spec = importlib.util.spec_from_file_location("montar_manifesto_hinario", Path(__file__).parent / "montar-manifesto-hinario.py")
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)

LINK = "https://fb.hm.hv2.xyz/public/api/resources/download?hash=abc"


def _hinario(tmp_path, nome="hinario-001.json", corpo=None):
    p = tmp_path / nome
    p.write_text(json.dumps(corpo or {"hinario": {"id": "x", "nome": "X"}, "hinos": []}), encoding="utf-8")
    return p


def test_monta_o_manifesto_com_nome_tamanho_e_sha(tmp_path):
    p = _hinario(tmp_path)
    m = mod.montar(LINK, p)
    assert m["pacote"]["arquivo"] == "hinario-001.json"
    assert m["pacote"]["bytes"] == p.stat().st_size
    assert len(m["pacote"]["sha256"]) == 64


@pytest.mark.parametrize("link", ["http://fb.hm.hv2.xyz/x", "https://exemplo.com/x", "https://fb.hm.hv2.xyz.mau.com/x", "https://", "https://fb.hm.hv2.xyz/a b"])
def test_recusa_link_fora_do_servidor_permitido_ou_malformado(tmp_path, link):
    with pytest.raises(ValueError):
        mod.montar(link, _hinario(tmp_path))


def test_recusa_arquivo_que_o_app_recusaria(tmp_path):
    with pytest.raises(ValueError):
        mod.montar(LINK, _hinario(tmp_path, nome="hinario-001.txt"))
    ruim = tmp_path / "hinario-002.json"
    ruim.write_bytes(b"\xff\xfe\x00")
    with pytest.raises(ValueError):
        mod.montar(LINK, ruim)
    with pytest.raises(ValueError):
        mod.montar(LINK, _hinario(tmp_path, nome="hinario-003.json", corpo={"outra": 1}))


def test_recusa_hinario_acima_do_limite_do_app(tmp_path):
    grande = tmp_path / "hinario-004.json"
    grande.write_text(json.dumps({"hinario": {}, "hinos": [], "x": "a" * (mod.LIMITE_BYTES + 10)}), encoding="utf-8")
    with pytest.raises(ValueError, match="20 MiB"):
        mod.montar(LINK, grande)
