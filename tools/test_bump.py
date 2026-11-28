"""Testes do tools/bump.py: o que a troca de versão pode e não pode tocar."""

import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bump  # noqa: E402


class TesteBump(unittest.TestCase):
    def regra(self, arquivo: str) -> bump.Regra:
        return next(r for r in bump.regras("0.3.9") if r.arquivo == arquivo)

    def test_cargo_lock_so_troca_a_estrofe_do_app(self):
        lock = 'name = "serde"\nversion = "0.3.9"\n\nname = "bibliotecamusical"\nversion = "0.3.9"\n'
        novo = bump.trocar(lock, self.regra("src-tauri/Cargo.lock"), "0.3.10")
        self.assertEqual(novo, 'name = "serde"\nversion = "0.3.9"\n\nname = "bibliotecamusical"\nversion = "0.3.10"\n')

    def test_package_lock_troca_a_raiz_e_o_pacote_vazio(self):
        texto = '{\n  "version": "0.3.9",\n  "packages": {\n    "": {\n      "version": "0.3.9",\n      "dependencies": {"x": {"version": "0.3.9"}}\n    }\n  }\n}\n'
        novo = bump.trocar(texto, self.regra("package-lock.json"), "0.3.10")
        self.assertEqual(len(re.findall(r'"version": "0\.3\.10"', novo)), 2)
        self.assertIn('{"x": {"version": "0.3.9"}}', novo)

    def test_recusa_quando_o_arquivo_mudou_de_forma(self):
        with self.assertRaises(SystemExit):
            bump.trocar("sem versão aqui", self.regra("package.json"), "0.3.10")

    def test_versao_nova_tem_de_ser_maior_na_ordem_numerica(self):
        self.assertGreater(bump.como_tupla("0.3.10"), bump.como_tupla("0.3.9"))
        with self.assertRaises(SystemExit):
            bump.como_tupla("0.3.10-rc1")


if __name__ == "__main__":
    unittest.main()
