"""Testes do tools/bump.py: o que a troca de versão pode e não pode tocar."""

import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bump  # noqa: E402

LOCK_REAL = (
    '{\n  "name": "bibliotecamusical",\n  "version": "0.3.9",\n  "lockfileVersion": 3,\n  "packages": {\n'
    '    "": {\n      "name": "bibliotecamusical",\n      "version": "0.3.9",\n      "license": "MIT"\n    },\n'
    '    "node_modules/x": {\n      "version": "0.3.9",\n      "resolved": "https://registro/x.tgz"\n    }\n  }\n}\n'
)


class TesteTroca(unittest.TestCase):
    def regra(self, arquivo: str) -> bump.Regra:
        return next(r for r in bump.regras("0.3.9") if r.arquivo == arquivo)

    def test_cargo_lock_so_troca_a_estrofe_do_app(self):
        lock = 'name = "serde"\nversion = "0.3.9"\n\nname = "bibliotecamusical"\nversion = "0.3.9"\n'
        novo = bump.trocar(lock, self.regra("src-tauri/Cargo.lock"), "0.3.10")
        self.assertEqual(novo, 'name = "serde"\nversion = "0.3.9"\n\nname = "bibliotecamusical"\nversion = "0.3.10"\n')

    def test_package_lock_real_troca_so_a_raiz_e_o_pacote_vazio(self):
        """Uma dependência com a mesma versão do app, numa linha própria (como no lockfile de verdade), não conta nem derruba o bump."""
        novo = bump.trocar(LOCK_REAL, self.regra("package-lock.json"), "0.3.10")
        self.assertEqual(len(re.findall(r'"version": "0\.3\.10"', novo)), 2)
        self.assertIn('"node_modules/x": {\n      "version": "0.3.9"', novo)

    def test_cargo_toml_so_troca_a_tabela_package(self):
        toml = '[package]\nname = "bibliotecamusical"\nversion = "0.3.9"\n\n[dependencies.foo]\nversion = "0.3.9"\n'
        novo = bump.trocar(toml, self.regra("src-tauri/Cargo.toml"), "0.3.10")
        self.assertEqual(novo, '[package]\nname = "bibliotecamusical"\nversion = "0.3.10"\n\n[dependencies.foo]\nversion = "0.3.9"\n')

    def test_mantem_as_quebras_de_linha_crlf(self):
        lock = 'name = "bibliotecamusical"\r\nversion = "0.3.9"\r\n'
        self.assertEqual(bump.trocar(lock, self.regra("src-tauri/Cargo.lock"), "0.3.10"), 'name = "bibliotecamusical"\r\nversion = "0.3.10"\r\n')

    def test_recusa_quando_o_arquivo_mudou_de_forma(self):
        with self.assertRaises(SystemExit):
            bump.trocar("sem versão aqui", self.regra("package.json"), "0.3.10")

    def test_acha_todas_as_ocorrencias_nos_arquivos_reais_do_repositorio(self):
        """Só lê: pega mudança de formato dos arquivos antes do dia do release, e não depois de gravar metade."""
        plano = bump.planejar(bump.versao_atual(), "999.0.0")
        self.assertEqual(len(plano), len(bump.regras(bump.versao_atual())))
        self.assertTrue(all("999.0.0" in conteudo for conteudo in plano.values()))


class TesteVersao(unittest.TestCase):
    def test_ordem_numerica_e_nao_de_texto(self):
        self.assertGreater(bump.como_tupla("0.3.10", "t"), bump.como_tupla("0.3.9", "t"))

    def test_recusa_o_que_nao_e_xyz_estrito(self):
        for ruim in ["0.3.10-rc1", "0.3.010", "0.3.9\n", "٣.٣.٩", "1.2", "v1.2.3", ""]:
            with self.subTest(ruim=ruim), self.assertRaises(SystemExit):
                bump.como_tupla(ruim, "t")

    def test_package_json_sem_versao_da_mensagem_clara(self):
        with tempfile.TemporaryDirectory() as pasta, mock.patch.object(bump, "RAIZ", Path(pasta)):
            (Path(pasta) / "package.json").write_text('{"name": "x"}', encoding="utf-8")
            with self.assertRaises(SystemExit) as e:
                bump.versao_atual()
            self.assertIn("version", str(e.exception))


class TesteGravar(unittest.TestCase):
    def test_se_um_arquivo_falha_nenhum_real_muda_e_nao_sobra_temporario(self):
        with tempfile.TemporaryDirectory() as pasta, mock.patch.object(bump, "RAIZ", Path(pasta)):
            raiz = Path(pasta)
            (raiz / "a.txt").write_text("velho", encoding="utf-8")
            with self.assertRaises(OSError):
                bump.gravar({"a.txt": "novo", "pasta-que-nao-existe/b.txt": "novo"})
            self.assertEqual((raiz / "a.txt").read_text(encoding="utf-8"), "velho")
            self.assertEqual([p.name for p in raiz.iterdir()], ["a.txt"])

    def test_grava_sem_converter_quebra_de_linha(self):
        with tempfile.TemporaryDirectory() as pasta, mock.patch.object(bump, "RAIZ", Path(pasta)):
            bump.gravar({"a.txt": "x\r\ny\n"})
            self.assertEqual((Path(pasta) / "a.txt").read_bytes(), b"x\r\ny\n")


class TesteTezcat(unittest.TestCase):
    def test_sem_tzt_recusa_antes_de_gravar(self):
        with mock.patch.object(bump.shutil, "which", return_value=None), self.assertRaises(SystemExit):
            bump.exigir_tzt(False)
        with mock.patch.object(bump.shutil, "which", return_value=None):
            bump.exigir_tzt(True)  # --sem-tezcat não precisa dele

    def test_falha_do_tzt_vira_codigo_diferente_de_zero(self):
        with mock.patch.object(bump.subprocess, "run", side_effect=PermissionError("sem permissão")):
            self.assertNotEqual(bump.resumo_do_tezcat("0.3.9", "0.3.10"), 0)
        with mock.patch.object(bump.subprocess, "run", side_effect=bump.subprocess.TimeoutExpired("tzt", 1)):
            self.assertNotEqual(bump.resumo_do_tezcat("0.3.9", "0.3.10"), 0)
        with mock.patch.object(bump.subprocess, "run", return_value=mock.Mock(returncode=3)):
            self.assertEqual(bump.resumo_do_tezcat("0.3.9", "0.3.10"), 3)

    def test_concluir_sai_com_1_e_mostra_o_comando_quando_o_tzt_falha(self):
        with mock.patch.object(bump, "resumo_do_tezcat", return_value=2), mock.patch("sys.stderr") as erro:
            self.assertEqual(bump.concluir(False, "0.3.9", "0.3.10"), 1)
        texto = "".join(c.args[0] for c in erro.write.call_args_list)
        self.assertIn("--changelog-inject --version 0.3.10 --prev-version 0.3.9", texto)
        with mock.patch.object(bump, "resumo_do_tezcat") as roda:
            self.assertEqual(bump.concluir(True, "0.3.9", "0.3.10"), 0)
            roda.assert_not_called()


if __name__ == "__main__":
    unittest.main()
