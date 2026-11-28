"""O padrão dos scripts de `tools/` que gravam arquivos: por padrão só SIMULAM (mostram o que fariam) e gravam com `--aplicar`.

Uso, em cada script que grava:

    from aplicar import aplicar_ou_simular, flag_aplicar

    ap = argparse.ArgumentParser(...)
    flag_aplicar(ap)
    ...
    if aplicar_ou_simular(a.aplicar, "gravaria 3 arquivos em saida/"):
        gravar(...)

`--apply` também vale (o mesmo que `--aplicar`). Quem só confere (`--conferir`) ou só lê não precisa disto.
"""

from __future__ import annotations

import argparse
import sys

MENSAGEM_FINAL = "Nada foi gravado (simulação). Para valer, acrescente --aplicar."


def flag_aplicar(ap: argparse.ArgumentParser) -> None:
    """Acrescenta `--aplicar` (alias `--apply`) ao analisador de argumentos."""
    ap.add_argument("--aplicar", "--apply", action="store_true", help="grava de verdade (sem isto só mostra o que faria)")


def aplicar_ou_simular(aplicar: bool, o_que: str, saida=None) -> bool:
    """Diz o que seria feito. Devolve True se é para gravar; False na simulação (e então avisa que nada foi gravado)."""
    saida = saida or sys.stdout
    if aplicar:
        return True
    print(f"[simulação] {o_que}", file=saida)
    print(MENSAGEM_FINAL, file=saida)
    return False
