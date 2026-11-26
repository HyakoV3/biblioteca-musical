import importlib.util
import zipfile
from pathlib import Path

_spec = importlib.util.spec_from_file_location("verificar_compassos", Path(__file__).parent / "verificar-compassos.py")
mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(mod)


def svg(n):
    """Um SVG FICTÍCIO com n compassos (e um grupo que não é compasso)."""
    medidas = "".join(f'<g id="m{i}" class="measure"><path d="M0 0"/></g>' for i in range(n))
    return f'<svg><g class="page-margin">{medidas}<g class="staff measureX"></g></g></svg>'


def hinario(*itens):
    return {"hinos": [{"numero": n, "compassos": c} for n, c in itens]}


def test_conta_so_g_measure():
    assert mod.compassos_do_svg(svg(5)) == 5
    assert mod.compassos_do_svg('<g class="measure other"/><g class="staff"/>') == 1


def test_hinario_alinhado_passa():
    h = hinario((1, {"normal": [[0, 0], [4, 1], [8, 2]]}))
    problemas, conferidos, _ = mod.verificar(h, {(1, False): svg(3), (1, True): svg(3)})
    assert problemas == [] and conferidos == 1


def test_indice_alem_do_desenho_e_problema_nas_duas_versoes():
    h = hinario((1, {"normal": [[0, 0], [4, 3]]}))
    problemas, _, _ = mod.verificar(h, {(1, False): svg(3), (1, True): svg(4)})
    assert len(problemas) == 2  # o retrato passa do desenho; as duas versões ainda diferem em número
    assert any("retrato" in p and "índice 3" in p for p in problemas)
    assert not any("paisagem" in p and "chega" in p for p in problemas)


def test_final_e_introducao_tambem_contam():
    h = hinario((1, {"normal": [[0, 0]], "final": [[0, 0], [4, 5]], "introducao": [[0, 0]]}))
    problemas, _, _ = mod.verificar(h, {(1, False): svg(3)})
    assert any("índice 5" in p for p in problemas)


def test_retrato_e_paisagem_com_numeros_diferentes_e_problema():
    h = hinario((1, {"normal": [[0, 0]]}))
    problemas, _, _ = mod.verificar(h, {(1, False): svg(3), (1, True): svg(4)})
    assert any("diferentes" in p for p in problemas)


def test_hino_sem_svg_ou_sem_compassos_so_e_contado():
    h = hinario((1, {"normal": [[0, 0]]}), (2, None))
    problemas, conferidos, sem_svg = mod.verificar(h, {})
    assert problemas == [] and conferidos == 0 and sem_svg == 1


def test_le_pasta_e_zip(tmp_path):
    pasta = tmp_path / "svg"
    pasta.mkdir()
    (pasta / "hino-7.svg").write_text(svg(2), encoding="utf-8")
    (pasta / "hino-7-paisagem.svg").write_text(svg(2), encoding="utf-8")
    (pasta / "hino-007.svg").write_text(svg(9), encoding="utf-8")  # nome que o app recusa: ignorado
    assert set(mod.ler_svgs(pasta)) == {(7, False), (7, True)}
    z = tmp_path / "p.zip"
    with zipfile.ZipFile(z, "w") as f:
        f.writestr("partituras/hino-7.svg", svg(2))
        f.writestr("partituras/hino-7-paisagem.svg", svg(2))
    assert set(mod.ler_svgs(z)) == {(7, False), (7, True)}


def test_main_devolve_1_com_problema_e_0_sem(tmp_path):
    import json

    pasta = tmp_path / "svg"
    pasta.mkdir()
    (pasta / "hino-1.svg").write_text(svg(2), encoding="utf-8")
    ruim = tmp_path / "ruim.json"
    ruim.write_text(json.dumps(hinario((1, {"normal": [[0, 0], [1, 2]]}))), encoding="utf-8")
    bom = tmp_path / "bom.json"
    bom.write_text(json.dumps(hinario((1, {"normal": [[0, 0], [1, 1]]}))), encoding="utf-8")
    assert mod.main(["x", str(ruim), str(pasta)]) == 1
    assert mod.main(["x", str(bom), str(pasta)]) == 0


def test_ignora_arquivo_que_nao_e_svg_e_devolve_2_para_entrada_ruim(tmp_path):
    pasta = tmp_path / "svg"
    pasta.mkdir()
    (pasta / "hino-1.svg").write_text(svg(1), encoding="utf-8")
    (pasta / "imagem.png").write_bytes(b"\x89PNG\xff\xfe\x00")  # não é UTF-8, mas também não é SVG de hino: nem é lido
    assert set(mod.ler_svgs(pasta)) == {(1, False)}
    bom = tmp_path / "bom.json"
    bom.write_text('{"hinos": []}', encoding="utf-8")
    assert mod.main(["x", str(tmp_path / "nao-existe.json"), str(pasta)]) == 2
    ruim = tmp_path / "ruim.json"
    ruim.write_text("{", encoding="utf-8")
    assert mod.main(["x", str(ruim), str(pasta)]) == 2
    falso_zip = tmp_path / "p.zip"
    falso_zip.write_text("não é zip", encoding="utf-8")
    assert mod.main(["x", str(bom), str(falso_zip)]) == 2
