"""Níveis de um trecho em dB: RMS, ponderado pela curva A e "no alto-falante do celular"."""
import numpy as np

from .config import SR


def db(v):
    return 20 * np.log10(max(v, 1e-4))


def _db_potencia(v):
    return 10 * np.log10(max(v, 1e-12))


def ponderacao_a(f):
    """Curva A (IEC 61672), em potência: o quanto o ouvido pesa cada frequência."""
    f2 = f**2
    ra = (12194.0**2 * f2**2) / ((f2 + 20.6**2) * np.sqrt((f2 + 107.7**2) * (f2 + 737.9**2)) * (f2 + 12194.0**2))
    return (ra * 10 ** (2.0 / 20)) ** 2  # +2,00 dB deixa a curva em 0 dB a 1 kHz


def niveis_do_trecho(x, ganho):
    """Níveis (dB) do trecho com o ganho do app: RMS, ponderado pela curva A e 'no alto-falante do celular' (curva A
    e graves abaixo de ~250 Hz cortados, 2ª ordem). Pela relação de Parseval, o RMS puro e o ponderado têm a mesma escala."""
    x = x * ganho
    n = len(x)
    X = np.fft.rfft(x * np.hanning(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    p = np.abs(X) ** 2
    p = p / np.sum(p) * np.mean(x**2)  # normaliza para que a soma da potência dê o RMS² do trecho
    wa = ponderacao_a(np.maximum(f, 1e-3))
    wa[f < 10] = 0
    hp = (f / 250.0) ** 4 / (1 + (f / 250.0) ** 4)
    return _db_potencia(np.sum(p)), _db_potencia(np.sum(p * wa)), _db_potencia(np.sum(p * wa * hp)), float(np.max(np.abs(x)))
