#!/usr/bin/env python3
"""Confere que o movimento do app respeita "reduzir movimento" (prefers-reduced-motion).

Uso:  python3 tools/verificar-movimento.py     # sai com código 1 se achar algum problema

Regras (veja src/lib/movimento.css):
  1. Em src/lib/movimento.css, tudo que se move (animation, transform, @keyframes) tem de estar dentro de um bloco
     @media (prefers-reduced-motion: no-preference).
  2. Em movimento.css, toda transition tem de usar var(--duracao) (que vira 0 com movimento reduzido) ou estar
     dentro do bloco no-preference.
  3. Fora de movimento.css não pode haver animation, transition, transform nem @keyframes, exceto nos arquivos da
     lista PERMITIDOS, e só se o próprio arquivo tiver uma regra prefers-reduced-motion.
"""
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SRC = RAIZ / "src"
MOVIMENTO = SRC / "lib" / "movimento.css"
PERMITIDOS = {SRC / "lib" / "Estado.svelte"}  # indicador de carregamento, com a sua própria proteção
# (?<![-\w]) evita falsos positivos como "text-transform" (maiúsculas) e "-webkit-transition".
PADRAO = re.compile(r"(@keyframes\b|(?<![-\w])(animation|transition|transform)\s*:)")
SE_MOVE = re.compile(r"(@keyframes\b|(?<![-\w])(animation|transform)\s*:)")
COMENTARIO = re.compile(r"/\*.*?\*/|<!--.*?-->", re.S)


def sem_comentarios(texto):
    """Troca comentários por espaços (mantém posições e números de linha)."""
    return COMENTARIO.sub(lambda m: re.sub(r"[^\n]", " ", m.group(0)), texto)


def blocos(css):
    """Lista de (inicio, fim, cabecalho) de cada bloco { ... }."""
    pilha, res, ultimo = [], [], 0
    for i, c in enumerate(css):
        if c == "{":
            cab = css[ultimo:i].split("}")[-1].split(";")[-1].strip()
            pilha.append((i, cab))
            ultimo = i + 1
        elif c == "}":
            ini, cab = pilha.pop()
            res.append((ini, i, cab))
            ultimo = i + 1
        elif c == ";":
            ultimo = i + 1
    return res


def dentro_de_sem_reduzir(pos, lista):
    return any(ini < pos < fim and "prefers-reduced-motion: no-preference" in cab for ini, fim, cab in lista)


def problema_de_transition(css, m, linha):
    """Mensagem se a transition não usa var(--duracao); None se usa."""
    valor = re.match(r"transition\s*:([^;]*);", css[m.start():], re.S)
    if valor and "var(--duracao)" in valor.group(1):
        return None
    return f"movimento.css:{linha}: transition sem var(--duracao) e fora do bloco no-preference"


def problema_do_achado(css, m, lista):
    """Mensagem de problema para um achado de PADRAO em movimento.css; None se está tudo certo."""
    if dentro_de_sem_reduzir(m.start(), lista):
        return None
    linha = css.count("\n", 0, m.start()) + 1
    trecho = m.group(0).strip()
    if SE_MOVE.match(m.group(0)):
        return f"movimento.css:{linha}: '{trecho}' fora de @media (prefers-reduced-motion: no-preference)"
    if trecho.startswith("transition"):
        return problema_de_transition(css, m, linha)
    return None


def verificar_movimento_css(css):
    lista = blocos(css)
    achados = (problema_do_achado(css, m, lista) for m in PADRAO.finditer(css))
    return [p for p in achados if p]


def problemas_do_movimento_css():
    """Problemas do próprio movimento.css (ou o aviso de que ele não existe)."""
    if not MOVIMENTO.exists():
        return ["falta src/lib/movimento.css"]
    return verificar_movimento_css(sem_comentarios(MOVIMENTO.read_text(encoding="utf-8")))


def arquivos_de_fora():
    """Arquivos do src que não são o movimento.css, em ordem."""
    todos = list(SRC.rglob("*.svelte")) + list(SRC.rglob("*.css")) + list(SRC.rglob("*.ts"))
    return [a for a in sorted(todos) if a != MOVIMENTO]


def problemas_de_arquivo(arq):
    """Movimento fora de movimento.css num arquivo (vazio se não há ou se o arquivo permitido tem a sua proteção)."""
    texto = sem_comentarios(arq.read_text(encoding="utf-8"))
    achados = list(PADRAO.finditer(texto))
    if arq in PERMITIDOS and "prefers-reduced-motion" in texto:
        return []
    rel = arq.relative_to(RAIZ)
    return [f"{rel}:{texto.count(chr(10), 0, m.start()) + 1}: '{m.group(0).strip()}' fora de movimento.css" for m in achados]


def main():
    problemas = problemas_do_movimento_css()
    for arq in arquivos_de_fora():
        problemas += problemas_de_arquivo(arq)

    print(f"verificados: movimento.css + {len(list(SRC.rglob('*.svelte')))} componentes (permitidos: "
          f"{', '.join(str(p.relative_to(RAIZ)) for p in PERMITIDOS)})")
    if problemas:
        print(f"\n{len(problemas)} problema(s):")
        for p in problemas:
            print("  -", p)
        sys.exit(1)
    print("Movimento consistente: tudo que se move respeita 'reduzir movimento'.")


if __name__ == "__main__":
    main()
