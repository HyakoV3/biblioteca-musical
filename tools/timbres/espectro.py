"""Medidas no espectro de um trecho: harmônicos, energia fora deles, amplitude em múltiplos da nota e a abertura do filtro."""
import numpy as np

from .config import SR

NFFT = 1 << 16
LIMITE_HARMONICOS = SR / 2 * 0.9  # perto do limite de Nyquist os harmônicos não valem


def magnitude(x):
    """Magnitude da FFT (janela de Hann, preenchimento até NFFT) e o eixo de frequências."""
    mag = np.abs(np.fft.rfft(x * np.hanning(len(x)), NFFT))
    return mag, np.fft.rfftfreq(NFFT, 1 / SR)


def banda(freqs, centro, semitons):
    """Máscara das frequências a até `semitons` semitons do centro."""
    return (freqs >= centro * 2 ** (-semitons / 12)) & (freqs <= centro * 2 ** (semitons / 12))


def fundamental_medida(mag, freqs, f0):
    """Afina a fundamental: pico perto da nominal (±60 centésimos)."""
    sel = banda(freqs, f0, 0.6)
    return freqs[sel][np.argmax(mag[sel])] if sel.any() else f0


def pico_perto(mag, freqs, centro):
    """Maior magnitude a até 35 centésimos do centro (0 se não há frequência ali)."""
    sel = banda(freqs, centro, 0.35)
    return float(mag[sel].max()) if sel.any() else 0.0


def _amplitudes_dos_harmonicos(mag, freqs, f_med, n_harm):
    amps = []
    for k in range(1, n_harm + 1):
        fk = f_med * k
        if fk > LIMITE_HARMONICOS:
            break
        amps.append(pico_perto(mag, freqs, fk))
    return np.array(amps)


def _fracao_fora_dos_harmonicos(mag, freqs, f_med, n_harm):
    """Energia fora dos harmônicos (±0,5 semitom) contra o total, até 12 kHz: o resto é ruído e inarmônico."""
    perto = np.zeros(len(freqs), bool)
    for k in range(1, n_harm + 1):
        perto |= banda(freqs, f_med * k, 0.5)
    return float(np.sum(mag[~perto & (freqs < 12000)] ** 2) / max(1e-12, np.sum(mag[freqs < 12000] ** 2)))


def espectro_harmonico(x, f0, n_harm):
    """Amplitudes dos harmônicos 1..n_harm de um trecho estável (janela de Hann, FFT com preenchimento)."""
    mag, freqs = magnitude(x)
    f_med = fundamental_medida(mag, freqs, f0)
    amps = _amplitudes_dos_harmonicos(mag, freqs, f_med, n_harm)
    return amps, f_med, _fracao_fora_dos_harmonicos(mag, freqs, f_med, len(amps))


def _razao_de_abertura(amps_cedo, amps_fim):
    """Espectro do começo sobre o do fim, relativo à fundamental."""
    r = amps_cedo / np.maximum(amps_fim, 1e-9)
    r = r / max(r[0], 1e-9)
    return np.clip(r, 1e-3, 1.5)


def _erro_do_corte(fc, k, r, peso):
    """Erro (em log, pesado) da curva 1/sqrt(1+(f/fc)^4) contra a razão medida."""
    modelo = 1 / np.sqrt(1 + (k / fc) ** 4)
    modelo = modelo / modelo[0]
    return float(np.sum(peso * (np.log(r) - np.log(modelo)) ** 2))


def corte_de_abertura(amps_cedo, amps_fim):
    """Frequência de corte de um passa-baixa (em múltiplos de f0) que leva o espectro final ao do começo.
    Ajuste por mínimos quadrados em log da curva 1/sqrt(1+(f/fc)^4) (filtro de 2ª ordem)."""
    n = min(len(amps_cedo), len(amps_fim))  # perto do limite de Nyquist um trecho pode ter um harmônico a mais que o outro
    amps_cedo, amps_fim = amps_cedo[:n], amps_fim[:n]
    k = np.arange(1, n + 1)
    r = _razao_de_abertura(amps_cedo, amps_fim)
    peso = amps_fim / amps_fim.max()  # só vale onde há energia no fim: pesa pelos harmônicos fortes
    melhor, erro_melhor = None, 1e9
    for fc in np.arange(1.5, 40, 0.25):
        e = _erro_do_corte(fc, k, r, peso)
        if e < erro_melhor:
            melhor, erro_melhor = fc, e
    return float(melhor)


def amplitudes_em(x, f0_nominal, multiplos):
    """Amplitude (janela de Hann) em cada múltiplo da frequência da nota, inclusive meios múltiplos (0,5 e 1,5 são os
    registros de 16' e de 5⅓' de um órgão de tirantes, abaixo da nota)."""
    mag, freqs = magnitude(x)
    f_med = fundamental_medida(mag, freqs, f0_nominal)
    return np.array([pico_perto(mag, freqs, f_med * m) if f_med * m < LIMITE_HARMONICOS else 0.0 for m in multiplos]), f_med
