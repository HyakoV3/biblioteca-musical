import importlib.util
import json
from pathlib import Path

import pytest

_spec = importlib.util.spec_from_file_location("montar_manifesto_hinario", Path(__file__).parent / "montar-manifesto-hinario.py")
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)

LINK = "https://github.com/HyakoV3/biblioteca-musical-pacotes/releases/download/x/hinario-abc.json"


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


@pytest.mark.parametrize("link", ["http://github.com/HyakoV3/biblioteca-musical-pacotes/releases/download/x/y.json", "https://exemplo.com/x", "https://github.com.mau.com/HyakoV3/biblioteca-musical-pacotes/releases/download/x/y.json", "https://fb.hm.hv2.xyz/public/api/resources/download?hash=abc", "https://", "https://github.com/HyakoV3/biblioteca-musical-pacotes/releases/download/x/a b", "https://github.com/outro/repo/releases/download/x/y.json", "https://github.com/HyakoV3/biblioteca-musical-pacotes/raw/main/y.json", "https://github.com/HyakoV3/biblioteca-musical-pacotes/releases/download/../../../outro/repo/raw/x.json", "https://usuario@github.com/HyakoV3/biblioteca-musical-pacotes/releases/download/a/b.json", "https://github.com:444/HyakoV3/biblioteca-musical-pacotes/releases/download/a/b.json", "https://github.com/HyakoV3/biblioteca-musical-pacotes/releases/download/%2e%2e/b.json"])
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


def test_aceita_o_release_do_repositorio_de_pacotes(tmp_path):
    link = "https://github.com/HyakoV3/biblioteca-musical-pacotes/releases/download/hinario-x/hinario-x.json"
    assert mod.montar(link, _hinario(tmp_path))["pacote"]["url"] == link


def test_saida_que_nao_da_para_gravar_sai_com_erro_e_codigo_2(tmp_path, capsys, monkeypatch):
    """`--saida` apontando para um diretório: `erro: ...` e código 2, não um traceback (a gravação está dentro do mesmo try da leitura)."""
    import sys

    from manifesto import pacote

    arquivo = tmp_path / "hinario.json"
    arquivo.write_text("{}", encoding="utf-8")
    monkeypatch.setattr(sys, "argv", ["x", "https://exemplo.org/a.json", str(arquivo), "--saida", str(tmp_path), "--aplicar"])
    montar = lambda link, arq: {"pacote": {"bytes": 1, "sha256": "0" * 64}}  # noqa: E731
    assert pacote.principal_pacote("d", "arquivo", tmp_path / "padrao.json", montar) == 2
    assert capsys.readouterr().err.startswith("erro:")
