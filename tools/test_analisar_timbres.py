"""Teste de caracterização de tools/analisar-timbres.py: roda o script de ponta a ponta (todas as flags) sobre amostras
sintéticas e compara a saída (stdout, stderr, timbres.json, realista.ts) com a que o código tinha antes da refatoração.
O ffmpeg é trocado por um falso (devolve um sinal determinístico a partir do número da nota), então o teste não
depende de sons-fonte/ nem do ffmpeg. Precisa de numpy: sem ele, é pulado."""
import base64
import hashlib
import itertools
import os
import re
import shutil
import stat
import subprocess
import sys
from pathlib import Path

import pytest

pytest.importorskip("numpy")

RAIZ = Path(__file__).resolve().parent.parent
FERRAMENTAS = RAIZ / "tools"
FAIXA_VOZ = {"soprano": (60, 81), "contralto": (55, 74), "tenor": (48, 67), "baixo": (40, 60)}
NOMES_DAS_NOTAS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

FFMPEG_FALSO = """#!{python}
import sys
import numpy as np
SR = 44100
midi = int(sys.stdin.buffer.read().decode())
rng = np.random.default_rng(midi)
f0 = 440.0 * 2 ** ((midi - 69) / 12)
t = np.arange(int(SR * 1.8)) / SR
x = np.zeros_like(t)
for k in range(1, 20):
    if f0 * k > SR * 0.45:
        break
    x += (1.0 / k ** (1.1 + (midi % 5) * 0.1)) * np.minimum(1.0, t / (0.02 + 0.015 * k)) * np.sin(2 * np.pi * f0 * k * t + k)
x *= np.minimum(1.0, t / 0.06) * np.exp(-0.2 * t) * 0.3
x += 0.004 * rng.standard_normal(len(t))
x = np.concatenate([np.zeros(int(0.03 * SR)), x])
if midi % 13 == 0:
    x = x * 1e-7
sys.stdout.buffer.write(x.astype("<f4").tobytes())
"""


def _alturas_de_nivel():
    alturas = {45, 55, 64, 72, 36, 48, 60, 84}
    for n in range(1, 5):
        for vozes in itertools.combinations(FAIXA_VOZ, n):
            lo = min(FAIXA_VOZ[v][0] for v in vozes)
            hi = max(FAIXA_VOZ[v][1] for v in vozes)
            alturas |= {lo, (lo + hi) // 2, hi}
    return alturas


def _nome_da_nota(midi):
    return f"{NOMES_DAS_NOTAS[midi % 12]}{midi // 12 - 1}"


def _escrever_amostras(fonte, arquivo, notas):
    linhas = []
    for midi in sorted(notas):
        carga = base64.b64encode(str(midi).encode()).decode()
        linhas.append(f'"{_nome_da_nota(midi)}": "data:audio/mp3;base64,{carga}"')
    (fonte / f"{arquivo}-mp3.js").write_text("var x = {\n" + ",\n".join(linhas) + "\n};\n", encoding="utf-8")


def _montar_arvore(destino):
    """Copia o script (e o pacote tools/timbres, se existir) e os .ts lidos por ele; cria as amostras sintéticas."""
    (destino / "tools").mkdir()
    shutil.copy(FERRAMENTAS / "analisar-timbres.py", destino / "tools")
    if (FERRAMENTAS / "timbres").is_dir():
        shutil.copytree(FERRAMENTAS / "timbres", destino / "tools" / "timbres", ignore=shutil.ignore_patterns("__pycache__"))
    (destino / "src" / "lib").mkdir(parents=True)
    for nome in ("instrumentos.ts", "realista.ts"):
        shutil.copy(RAIZ / "src" / "lib" / nome, destino / "src" / "lib")
    # as faixas (arquivo, lo, hi) estão no script ou, depois da refatoração, no pacote
    codigo = "".join(p.read_text(encoding="utf-8") for p in [FERRAMENTAS / "analisar-timbres.py", *sorted((FERRAMENTAS / "timbres").glob("*.py"))])
    faixas = {a: int(lo) for a, lo in re.findall(r'\("(\w+)", (\d+), \d+\)', codigo)}
    realista = (RAIZ / "src" / "lib" / "realista.ts").read_text(encoding="utf-8")
    arquivos = set(re.findall(r'arquivo:\s*"(\w+)"', realista)) | set(faixas) | {"drawbar_organ", "church_organ", "reed_organ"}
    fonte = destino / "sons-fonte" / "FluidR3_GM"
    fonte.mkdir(parents=True)
    for arquivo in sorted(arquivos):
        notas = _alturas_de_nivel()
        if arquivo in faixas:
            notas |= set(range(faixas[arquivo], faixas[arquivo] + 8))
        _escrever_amostras(fonte, arquivo, notas)
    bin_falso = destino / "bin"
    bin_falso.mkdir()
    ffmpeg = bin_falso / "ffmpeg"
    ffmpeg.write_text(FFMPEG_FALSO.format(python=sys.executable), encoding="utf-8")
    ffmpeg.chmod(ffmpeg.stat().st_mode | stat.S_IEXEC)
    return bin_falso


CENARIOS = [
    ("completo", []),
    ("so_um_atualiza", ["--instrumento", "oboe"]),
    ("diagnostico", ["--instrumento", "trompete", "--diagnostico"]),
    ("distancia", ["--distancia"]),
    ("orgaos", ["--orgaos"]),
    ("niveis", ["--niveis"]),
    ("calibrar", ["--calibrar"]),
    ("calibrar_alvo", ["--calibrar", "--alvo", "-20"]),
    ("calibrar_escrever", ["--calibrar", "--escrever"]),
    ("fonte_inexistente", ["--fonte", "{RAIZ}/nao-existe"]),
]
ARQUIVOS_GERADOS = ["completo.json", "so_um_atualiza.json", "realista.ts"]


@pytest.fixture(scope="module")
def resultados(tmp_path_factory):
    raiz = tmp_path_factory.mktemp("timbres")
    bin_falso = _montar_arvore(raiz)
    ambiente = {**os.environ, "PATH": f"{bin_falso}{os.pathsep}{os.environ['PATH']}"}
    saidas = {}
    for nome, args in CENARIOS:
        r = subprocess.run([sys.executable, str(raiz / "tools" / "analisar-timbres.py"), *[a.replace("{RAIZ}", str(raiz)) for a in args]], capture_output=True, text=True, env=ambiente)
        saidas[nome] = f"rc={r.returncode}\n--stdout--\n{r.stdout}--stderr--\n{r.stderr}".replace(str(raiz), "<RAIZ>")
        if nome in ("completo", "so_um_atualiza"):
            saidas[nome + ".json"] = (raiz / "src" / "lib" / "timbres.json").read_text(encoding="utf-8")
    saidas["realista.ts"] = (raiz / "src" / "lib" / "realista.ts").read_text(encoding="utf-8")
    return saidas


def _hash(texto):
    return hashlib.sha256(texto.encode()).hexdigest()[:16]


# sha256 (16 primeiros dígitos) da saída do código ORIGINAL (origin/main antes da refatoração)
ESPERADO = {
    "completo": "345a3e1487991f34",
    "so_um_atualiza": "f14c5d891604e703",
    "diagnostico": "331d3a07d0c972fd",
    "distancia": "5f66010d40404679",
    "orgaos": "8cf2d0405c7be70f",
    "niveis": "c06fd12315b66ec6",
    "calibrar": "007dbc1294903ef7",
    "calibrar_alvo": "c5148d4ff980bf91",
    "calibrar_escrever": "3a5b70aaad7e74b9",
    "fonte_inexistente": "b6593c90888f311d",
    "completo.json": "32b32097a73d68ff",
    "so_um_atualiza.json": "32b32097a73d68ff",
    "realista.ts": "9f9dca338c1e5ba9",
}


@pytest.mark.parametrize("nome", [n for n, _ in CENARIOS] + ARQUIVOS_GERADOS)
def test_saida_igual_a_original(resultados, nome):
    assert _hash(resultados[nome]) == ESPERADO[nome], resultados[nome][:2000]
