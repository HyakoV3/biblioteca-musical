import argparse
import io

import aplicar


def _analisador():
    ap = argparse.ArgumentParser()
    aplicar.flag_aplicar(ap)
    return ap


def test_o_padrao_e_simular():
    assert _analisador().parse_args([]).aplicar is False


def test_aplicar_e_apply_valem_igual():
    assert _analisador().parse_args(["--aplicar"]).aplicar is True
    assert _analisador().parse_args(["--apply"]).aplicar is True


def test_simulacao_avisa_e_nao_manda_gravar():
    saida = io.StringIO()
    assert aplicar.aplicar_ou_simular(False, "gravaria 3 arquivos", saida) is False
    texto = saida.getvalue()
    assert "gravaria 3 arquivos" in texto and aplicar.MENSAGEM_FINAL in texto


def test_aplicar_manda_gravar_sem_imprimir_nada():
    saida = io.StringIO()
    assert aplicar.aplicar_ou_simular(True, "gravaria", saida) is True
    assert saida.getvalue() == ""
