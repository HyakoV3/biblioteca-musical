"""Leitura e decodificação das amostras e localização do trecho sustentado de uma nota."""
import base64
import re
import subprocess
from typing import NamedTuple

import numpy as np

from . import config
from .config import NOTAS, SR


def midi_da_nota(nome):
    m = re.fullmatch(r"([A-G])([b#]?)(\d)", nome)
    base = NOTAS[m.group(1)] + {"": 0, "b": -1, "#": 1}[m.group(2)]
    return 12 * (int(m.group(3)) + 1) + base


def frequencia_da_nota(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def ler_amostras(arquivo):
    texto = (config.FONTE / f"{arquivo}-mp3.js").read_text(encoding="utf-8")
    return {midi_da_nota(n): b for n, b in re.findall(r'"([A-G][b#]?\d)":\s*"data:audio/mp3;base64,([^"]+)"', texto)}


def decodificar(b64):
    mp3 = base64.b64decode(b64)
    r = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", "pipe:0", "-f", "f32le", "-ac", "1", "-ar", str(SR), "pipe:1"],
        input=mp3, capture_output=True, check=True,
    )
    return np.frombuffer(r.stdout, dtype=np.float32).astype(np.float64)


def rms_janelas(x, passo=0.005, janela=0.02):
    h, w = int(passo * SR), int(janela * SR)
    n = max(0, (len(x) - w) // h)
    return np.array([np.sqrt(np.mean(x[i * h : i * h + w] ** 2)) for i in range(n)]), passo


def inicio_da_nota(env):
    """Índice da janela de RMS em que a nota começa (passa de 5% do pico)."""
    return int(np.argmax(env > 0.05 * env.max()))


class Sustentado(NamedTuple):
    """Envelope da nota e o trecho sustentado dela: x[a:b], de 0,45 s a 1,2 s depois do início."""

    env: np.ndarray
    passo: float
    inicio: int
    a: int
    b: int


def localizar_sustentado(x):
    env, passo = rms_janelas(x)
    inicio = inicio_da_nota(env)
    t_ini = inicio * passo
    return Sustentado(env, passo, inicio, int((t_ini + 0.45) * SR), min(len(x), int((t_ini + 1.2) * SR)))
