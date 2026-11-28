"""Medida do timbre de uma nota gravada: espectro sustentado, ataque, abertura do brilho e ruído."""
from typing import NamedTuple

import numpy as np

from .audio import frequencia_da_nota, inicio_da_nota, rms_janelas
from .config import SR
from .espectro import corte_de_abertura, espectro_harmonico


class _Nota(NamedTuple):
    """O que as medidas do começo da nota precisam saber dela."""

    x: np.ndarray
    f0: float
    n_harm: int
    t_ini: float


def _trecho_sustentado(x, t_ini):
    """Trecho sustentado: 0,45 s a 1,0 s depois do início (as amostras duram bem mais que isso)."""
    a, b = int((t_ini + 0.45) * SR), int((t_ini + 1.0) * SR)
    if b > len(x):
        b = len(x)
        a = max(0, b - int(0.5 * SR))
    return a, b


def _tempo_de_ataque(env, inicio, passo, nivel_fim):
    """Tempo até 90% do nível sustentado."""
    cruz = np.argmax(env[inicio:] >= 0.9 * nivel_fim)
    return float(cruz * passo)


def _corte_inicial(nota, fim):
    """Corte do passa-baixa no começo (15 ms a 75 ms depois do início, o espectro ainda "abrindo"); None se sem sinal."""
    c0, c1 = int((nota.t_ini + 0.015) * SR), int((nota.t_ini + 0.075) * SR)
    cedo, _, _ = espectro_harmonico(nota.x[c0:c1], nota.f0, nota.n_harm)
    return corte_de_abertura(cedo[: len(fim)], fim) if cedo.max() > 0 else None


def _centroide(amps, piso):
    """Centroide espectral, em número de harmônico."""
    return float(np.sum(np.arange(1, len(amps) + 1) * amps) / max(piso, np.sum(amps)))


def _tempo_de_abertura(nota, fim, cent_fim):
    """Quando o espectro se aproxima do final (centroide a 95% do final); None se não chega a isso nos primeiros 0,4 s."""
    for t in np.arange(0.02, 0.4, 0.02):
        j0, j1 = int((nota.t_ini + t) * SR), int((nota.t_ini + t + 0.06) * SR)
        if j1 > len(nota.x):
            return None
        esp, _, _ = espectro_harmonico(nota.x[j0:j1], nota.f0, nota.n_harm)
        m = min(len(fim), len(esp))  # pode vir um harmônico a menos perto do limite de Nyquist
        if _centroide(esp[:m], 1e-9) >= 0.95 * cent_fim:
            return float(t)
    return None


def _arredondar(v, casas):
    return None if v is None else round(v, casas)


def analisar_nota(x, midi):
    f0 = frequencia_da_nota(midi)
    env, passo = rms_janelas(x)
    inicio = inicio_da_nota(env)
    t_ini = inicio * passo
    a, b = _trecho_sustentado(x, t_ini)
    n_harm = int(min(32, (SR / 2 * 0.9) // f0))
    fim, f_med, fora = espectro_harmonico(x[a:b], f0, n_harm)
    ataque = _tempo_de_ataque(env, inicio, passo, float(np.sqrt(np.mean(x[a:b] ** 2))))
    nota = _Nota(x, f0, n_harm, t_ini)
    fc = _corte_inicial(nota, fim)
    cent_fim = _centroide(fim, 0.0)
    abertura = _tempo_de_abertura(nota, fim, cent_fim)
    rel = fim / fim.max()
    return {
        "midi": midi, "f_med": round(f_med, 2), "h": [round(float(v), 4) for v in rel], "ataque": round(ataque, 3),
        "fc_inicio": _arredondar(fc, 2), "abertura": _arredondar(abertura, 2),
        "ruido": round(fora, 4),
        "centroide": round(cent_fim, 2), "inicio_s": round(t_ini, 3), "duracao_s": round(len(x) / SR, 2),
    }
