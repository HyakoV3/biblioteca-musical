#!/usr/bin/env python3
"""Mede o timbre das amostras gravadas (FluidR3_GM, licença MIT) para alimentar a síntese dos instrumentos.

Para cada instrumento e para algumas alturas ("âncoras") espalhadas pela faixa dele, mede na amostra real:
  - o espectro de harmônicos na parte sustentada (amplitudes relativas ao harmônico mais forte);
  - o tempo de ataque (do começo ao nível sustentado);
  - o quanto o brilho cresce no começo da nota: o quanto um filtro passa-baixa teria de estar fechado no início
    (frequência de corte em múltiplos da frequência da nota), para o espectro do começo bater com o do final;
  - quanto da energia está fora dos harmônicos (ruído de sopro e outros).
Grava src/lib/timbres.json. A síntese interpola entre as âncoras para qualquer altura.

Uso:
  python3 tools/analisar-timbres.py                      # analisa os 7 instrumentos e grava o JSON
  python3 tools/analisar-timbres.py --instrumento trumpet --diagnostico   # só mostra as medidas, sem gravar

Precisa de: numpy, ffmpeg e dos arquivos de sons-fonte/FluidR3_GM/ (baixados por tools/baixar-sons-gm.py, fora do Git).
"""
import argparse
import base64
import json
import re
import subprocess
import sys
from pathlib import Path

import numpy as np

RAIZ = Path(__file__).resolve().parent.parent
FONTE = RAIZ / "sons-fonte" / "FluidR3_GM"
SAIDA = RAIZ / "src" / "lib" / "timbres.json"
SR = 44100
PASSO_ANCORAS = 3  # semitons entre âncoras

# Instrumento da síntese -> (arquivo da amostra, faixa de alturas MIDI onde o instrumento soa natural).
# Fora da faixa as amostras são só deslocadas e o timbre não é o do instrumento: a síntese usa a âncora da ponta.
INSTRUMENTOS = {
    "trompete": ("trumpet", 52, 84),
    "trombone": ("trombone", 38, 72),
    "tuba": ("tuba", 26, 60),
    "fagote": ("bassoon", 34, 75),
    "oboe": ("oboe", 58, 91),
    "sax_alto": ("alto_sax", 49, 81),
    "sax_tenor": ("tenor_sax", 44, 76),
}
NOTAS = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def midi_da_nota(nome):
    m = re.fullmatch(r"([A-G])([b#]?)(\d)", nome)
    base = NOTAS[m.group(1)] + {"": 0, "b": -1, "#": 1}[m.group(2)]
    return 12 * (int(m.group(3)) + 1) + base


def ler_amostras(arquivo):
    texto = (FONTE / f"{arquivo}-mp3.js").read_text(encoding="utf-8")
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


def espectro_harmonico(x, f0, n_harm):
    """Amplitudes dos harmônicos 1..n_harm de um trecho estável (janela de Hann, FFT com preenchimento)."""
    n = 1 << 16
    janela = np.hanning(len(x))
    mag = np.abs(np.fft.rfft(x * janela, n))
    freqs = np.fft.rfftfreq(n, 1 / SR)
    # afina a fundamental: pico perto da nominal (±60 centésimos)
    lo, hi = f0 * 2 ** (-0.6 / 12), f0 * 2 ** (0.6 / 12)
    sel = (freqs >= lo) & (freqs <= hi)
    f_med = freqs[sel][np.argmax(mag[sel])] if sel.any() else f0
    amps = []
    for k in range(1, n_harm + 1):
        fk = f_med * k
        if fk > SR / 2 * 0.9:
            break
        sel = (freqs >= fk * 2 ** (-0.35 / 12)) & (freqs <= fk * 2 ** (0.35 / 12))
        amps.append(float(mag[sel].max()) if sel.any() else 0.0)
    amps = np.array(amps)
    energia_total = float(np.sum(mag**2))
    # energia perto dos harmônicos (±0,5 semitom) contra o total: o resto é ruído e inarmônico
    perto = np.zeros(len(freqs), bool)
    for k in range(1, len(amps) + 1):
        perto |= (freqs >= f_med * k * 2 ** (-0.5 / 12)) & (freqs <= f_med * k * 2 ** (0.5 / 12))
    fora = float(np.sum(mag[~perto & (freqs < 12000)] ** 2) / max(1e-12, np.sum(mag[freqs < 12000] ** 2)))
    return amps, f_med, fora


def corte_de_abertura(amps_cedo, amps_fim, f0):
    """Frequência de corte de um passa-baixa (em múltiplos de f0) que leva o espectro final ao do começo.
    Ajuste por mínimos quadrados em log da curva 1/sqrt(1+(f/fc)^4) (filtro de 2ª ordem). Devolve None se o
    começo não é mais escuro que o fim."""
    n = min(len(amps_cedo), len(amps_fim))  # perto do limite de Nyquist um trecho pode ter um harmônico a mais que o outro
    amps_cedo, amps_fim = amps_cedo[:n], amps_fim[:n]
    k = np.arange(1, n + 1)
    r = (amps_cedo / np.maximum(amps_fim, 1e-9))
    r = r / max(r[0], 1e-9)  # o começo é medido relativo à fundamental
    r = np.clip(r, 1e-3, 1.5)
    melhor, erro_melhor = None, 1e9
    for fc in np.arange(1.5, 40, 0.25):
        modelo = 1 / np.sqrt(1 + (k / fc) ** 4)
        modelo = modelo / modelo[0]
        # só vale onde há energia no fim: pesa pelos harmônicos fortes
        peso = amps_fim / amps_fim.max()
        e = float(np.sum(peso * (np.log(r) - np.log(modelo)) ** 2))
        if e < erro_melhor:
            melhor, erro_melhor = fc, e
    return float(melhor)


def analisar_nota(x, midi):
    f0 = 440.0 * 2 ** ((midi - 69) / 12)
    env, passo = rms_janelas(x)
    pico = env.max()
    inicio = int(np.argmax(env > 0.05 * pico))  # índice da janela do início
    t_ini = inicio * passo
    # trecho sustentado: 0,45 s a 1,0 s depois do início (as amostras duram bem mais que isso)
    a, b = int((t_ini + 0.45) * SR), int((t_ini + 1.0) * SR)
    if b > len(x):
        b = len(x)
        a = max(0, b - int(0.5 * SR))
    n_harm = int(min(32, (SR / 2 * 0.9) // f0))
    fim, f_med, fora = espectro_harmonico(x[a:b], f0, n_harm)
    nivel_fim = float(np.sqrt(np.mean(x[a:b] ** 2)))
    # ataque: tempo até 90% do nível sustentado
    alvo = 0.9 * nivel_fim
    cruz = np.argmax(env[inicio:] >= alvo)
    ataque = float(cruz * passo)
    # começo: 15 ms a 60 ms depois do início (o espectro ainda "abrindo")
    c0, c1 = int((t_ini + 0.015) * SR), int((t_ini + 0.075) * SR)
    cedo, _, _ = espectro_harmonico(x[c0:c1], f0, n_harm)
    fc = corte_de_abertura(cedo[: len(fim)], fim, f0) if cedo.max() > 0 else None
    # tempo de abertura: quando o espectro se aproxima do final (centroide do harmônico a 95% do final)
    k = np.arange(1, len(fim) + 1)
    cent_fim = float(np.sum(k * fim) / np.sum(fim))
    abertura = None
    for t in np.arange(0.02, 0.4, 0.02):
        j0, j1 = int((t_ini + t) * SR), int((t_ini + t + 0.06) * SR)
        if j1 > len(x):
            break
        esp, _, _ = espectro_harmonico(x[j0:j1], f0, n_harm)
        m = min(len(k), len(esp))  # pode vir um harmônico a menos perto do limite de Nyquist
        cent = float(np.sum(k[:m] * esp[:m]) / max(1e-9, np.sum(esp[:m])))
        if cent >= 0.95 * cent_fim:
            abertura = float(t)
            break
    rel = fim / fim.max()
    return {
        "midi": midi, "f_med": round(f_med, 2), "h": [round(float(v), 4) for v in rel], "ataque": round(ataque, 3),
        "fc_inicio": None if fc is None else round(fc, 2), "abertura": None if abertura is None else round(abertura, 2),
        "ruido": round(fora, 4),
        "centroide": round(cent_fim, 2), "inicio_s": round(t_ini, 3), "duracao_s": round(len(x) / SR, 2),
    }


def amplitudes_em(x, f0_nominal, multiplos):
    """Amplitude (janela de Hann) em cada múltiplo da frequência da nota, inclusive meios múltiplos (0,5 e 1,5 são os
    registros de 16' e de 5⅓' de um órgão de tirantes, abaixo da nota)."""
    n = 1 << 16
    mag = np.abs(np.fft.rfft(x * np.hanning(len(x)), n))
    freqs = np.fft.rfftfreq(n, 1 / SR)
    sel = (freqs >= f0_nominal * 2 ** (-0.6 / 12)) & (freqs <= f0_nominal * 2 ** (0.6 / 12))
    f_med = freqs[sel][np.argmax(mag[sel])] if sel.any() else f0_nominal
    saida = []
    for m in multiplos:
        fk = f_med * m
        s = (freqs >= fk * 2 ** (-0.35 / 12)) & (freqs <= fk * 2 ** (0.35 / 12))
        saida.append(float(mag[s].max()) if s.any() and fk < SR / 2 * 0.9 else 0.0)
    return np.array(saida), f_med


def tabelas_sinteticas():
    """Lê as tabelas de harmônicos dos órgãos sintetizados de src/lib/instrumentos.ts."""
    ts = (RAIZ / "src" / "lib" / "instrumentos.ts").read_text(encoding="utf-8")
    saida = {}
    for nome in ("orgao_suave", "orgao_principal", "orgao_pleno"):
        m = re.search(rf"{nome}:\s*\{{\s*harmonicos:\s*\[([^\]]*)\]", ts)
        saida[nome] = [float(v) for v in m.group(1).split(",")][1:]  # o índice 0 é ignorado
    return saida


def db(v):
    return 20 * np.log10(max(v, 1e-4))


def comparar_orgaos():
    """Mede o órgão de tirantes (e, de contexto, o de igreja e o de palhetas) e compara com os órgãos sintetizados."""
    sinteticos = tabelas_sinteticas()
    alturas = [36, 48, 60, 72, 84]
    multiplos = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12]
    perfis = {}
    for rotulo, arquivo in (("tirantes (drawbar_organ)", "drawbar_organ"), ("igreja (church_organ)", "church_organ"), ("palhetas (reed_organ)", "reed_organ")):
        amostras = ler_amostras(arquivo)
        print(f"\n=== Órgão {rotulo}: amplitude em cada múltiplo da nota, relativa à própria nota (1,00 = a nota) ===")
        print(f"{'altura':>8} {'ataque':>7} {'rms':>6} | " + " ".join(f"{m:>5}x" for m in multiplos))
        linhas = []
        for midi in alturas:
            x = decodificar(amostras[midi])
            env, passo = rms_janelas(x)
            ini = int(np.argmax(env > 0.05 * env.max()))
            t_ini = ini * passo
            a, b = int((t_ini + 0.45) * SR), min(len(x), int((t_ini + 1.2) * SR))
            f0 = 440.0 * 2 ** ((midi - 69) / 12)
            amps, f_med = amplitudes_em(x[a:b], f0, multiplos)
            rel = amps / max(amps[multiplos.index(1)], 1e-9)
            nivel = float(np.sqrt(np.mean(x[a:b] ** 2)))
            cruz = int(np.argmax(env[ini:] >= 0.9 * nivel)) * passo
            linhas.append(rel)
            nome_nota = f"{'C'}{midi // 12 - 1}"
            print(f"{nome_nota:>8} {cruz*1000:5.0f}ms {nivel:6.3f} | " + " ".join(f"{v:6.2f}" for v in rel))
        media = np.mean(linhas, axis=0)
        print(f"{'média':>8} {'':>7} {'':>6} | " + " ".join(f"{v:6.2f}" for v in media))
        perfis[rotulo] = dict(zip(multiplos, media))

    print("\n=== Órgãos SINTETIZADOS (tabela fixa do app; harmônico 1 = a nota = 1,00) ===")
    print(f"{'órgão':>16} | " + " ".join(f"{m:>5}x" for m in multiplos))
    for nome, tab in sinteticos.items():
        vals = [tab[int(m) - 1] if float(m).is_integer() and int(m) - 1 < len(tab) else 0.0 for m in multiplos]
        print(f"{nome:>16} | " + " ".join(f"{v:6.2f}" for v in vals))

    ref = perfis["tirantes (drawbar_organ)"]
    print("\n=== Distância dos órgãos sintetizados ao de tirantes (harmônicos inteiros 1 a 8; menor = mais parecido) ===")
    print("Diferença média absoluta em dB, comparando cada harmônico com o do órgão de tirantes (média das 5 alturas).")
    ints = [1, 2, 3, 4, 5, 6, 8]
    for nome, tab in sinteticos.items():
        dif = [abs(db(tab[k - 1] if k - 1 < len(tab) else 0.0) - db(ref[k])) for k in ints]
        print(f"{nome:>16}: {np.mean(dif):5.1f} dB  (por harmônico: " + ", ".join(f"{k}:{d:4.1f}" for k, d in zip(ints, dif)) + ")")
    sub = ref[0.5] + ref[1.5] + ref[2.5]
    print(f"\nO órgão de tirantes tem energia ABAIXO da nota que a síntese não tem: 0,5x={ref[0.5]:.2f}, 1,5x={ref[1.5]:.2f}, 2,5x={ref[2.5]:.2f} "
          f"(soma {sub:.2f} contra a nota = 1,00).")


FAIXA_VOZ = {"soprano": (60, 81), "contralto": (55, 74), "tenor": (48, 67), "baixo": (40, 60)}


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
    d = lambda v: 10 * np.log10(max(v, 1e-12))
    return d(np.sum(p)), d(np.sum(p * wa)), d(np.sum(p * wa * hp)), float(np.max(np.abs(x)))


def parse_realistas():
    ts = (RAIZ / "src" / "lib" / "realista.ts").read_text(encoding="utf-8")
    saida = []
    for m in re.finditer(r'(real_\w+):\s*\{\s*arquivo:\s*"(\w+)",\s*ganho:\s*([\d.]+),\s*grupo:\s*"(\w+)",\s*vozes:\s*(TODAS|\[[^\]]*\])', ts):
        vozes = list(FAIXA_VOZ) if m.group(5) == "TODAS" else re.findall(r'"(\w+)"', m.group(5))
        saida.append((m.group(1), m.group(2), float(m.group(3)), vozes))
    return saida


def sintetico_organ(nome, midi):
    """Trecho de 1 s de um órgão sintetizado (série de senos, normalizada em pico 1 como o PeriodicWave) vezes o nível do perfil."""
    ts = (RAIZ / "src" / "lib" / "instrumentos.ts").read_text(encoding="utf-8")
    m = re.search(rf"{nome}:\s*\{{\s*harmonicos:\s*\[([^\]]*)\].*?nivel:\s*([\d.]+)", ts)
    h = [float(v) for v in m.group(1).split(",")]
    nivel = float(m.group(2))
    f0 = 440.0 * 2 ** ((midi - 69) / 12)
    t = np.arange(int(SR * 1.0)) / SR
    onda = sum(a * np.sin(2 * np.pi * f0 * k * t) for k, a in enumerate(h) if k > 0 and a)
    onda = onda / np.max(np.abs(onda))
    return onda * nivel


def comparar_niveis():
    print("Níveis com o ganho do app, na faixa de cada voz. Quanto MAIOR o número (menos negativo), mais alto soa.")
    print("  rms    = o que a calibração atual igualou;  ouvido = ponderado pela curva A;  celular = curva A sem os graves abaixo de ~250 Hz.\n")
    linhas = []
    for id_, arquivo, ganho, vozes in parse_realistas():
        amostras = ler_amostras(arquivo)
        lo = min(FAIXA_VOZ[v][0] for v in vozes)
        hi = max(FAIXA_VOZ[v][1] for v in vozes)
        alturas = [45, 55, 64, 72] if len(vozes) == 4 else [lo, (lo + hi) // 2, hi]
        acum = []
        for midi in alturas:
            x = decodificar(amostras[midi])
            env, passo = rms_janelas(x)
            if env.max() < 1e-4:  # o banco deixa algumas notas mudas (ex.: o contrabaixo acima da nota 59)
                continue
            ini = int(np.argmax(env > 0.05 * env.max()))
            a, b = int((ini * passo + 0.45) * SR), min(len(x), int((ini * passo + 1.2) * SR))
            acum.append(niveis_do_trecho(x[a:b], ganho))
        a = np.array(acum)
        linhas.append((id_, ganho, 10 * np.log10(np.mean(10 ** (a[:, 0] / 10))), 10 * np.log10(np.mean(10 ** (a[:, 1] / 10))), 10 * np.log10(np.mean(10 ** (a[:, 2] / 10))), a[:, 3].max()))
    med_rms = float(np.median([l[2] for l in linhas]))
    med_ouv = float(np.median([l[3] for l in linhas]))
    med_cel = float(np.median([l[4] for l in linhas]))
    print(f"{'instrumento':<22}{'ganho':>6} | {'rms':>7}{'ouvido':>8}{'celular':>9} | vs mediana: {'rms':>6}{'ouvido':>8}{'celular':>9} | {'pico':>5}")
    for id_, ganho, r, o, c, pico in sorted(linhas, key=lambda l: l[4]):
        marca = "  <== órgão de tirantes" if id_ == "real_orgao_tirantes" else ""
        print(f"{id_:<22}{ganho:>6.2f} | {r:7.1f}{o:8.1f}{c:9.1f} |             {r - med_rms:+6.1f}{o - med_ouv:+8.1f}{c - med_cel:+9.1f} | {pico:5.2f}{marca}")
    print(f"\nmedianas dos 16: rms {med_rms:.1f}, ouvido {med_ouv:.1f}, celular {med_cel:.1f} dB")

    # O órgão de tirantes contra os órgãos SINTETIZADOS no mesmo RMS: quanto o formato do espectro tira (ou põe) no som.
    print("\n== Órgão de tirantes x órgãos sintetizados (média de 4 alturas; mesmos 'rms', veja o que muda no ouvido e no celular) ==")
    am = ler_amostras("drawbar_organ")
    tir = []
    for midi in [45, 55, 64, 72]:
        x = decodificar(am[midi])
        env, passo = rms_janelas(x)
        ini = int(np.argmax(env > 0.05 * env.max()))
        a, b = int((ini * passo + 0.45) * SR), min(len(x), int((ini * passo + 1.2) * SR))
        tir.append(niveis_do_trecho(x[a:b], 2.65))
    tir = np.array(tir)
    print(f"{'órgão':<20}{'rms':>8}{'ouvido':>8}{'celular':>9} | {'ouvido-rms':>11}{'celular-rms':>13}")
    print(f"{'tirantes (ganho 2,65)':<20}{np.mean(tir[:,0]):8.1f}{np.mean(tir[:,1]):8.1f}{np.mean(tir[:,2]):9.1f} | {np.mean(tir[:,1]-tir[:,0]):+11.1f}{np.mean(tir[:,2]-tir[:,0]):+13.1f}")
    for nome in ("orgao_suave", "orgao_principal", "orgao_pleno"):
        s = np.array([niveis_do_trecho(sintetico_organ(nome, m), 1.0) for m in [45, 55, 64, 72]])
        print(f"{nome:<20}{np.mean(s[:,0]):8.1f}{np.mean(s[:,1]):8.1f}{np.mean(s[:,2]):9.1f} | {np.mean(s[:,1]-s[:,0]):+11.1f}{np.mean(s[:,2]-s[:,0]):+13.1f}")


def tabela_antiga(nome):
    """A tabela fixa de harmônicos de um instrumento em src/lib/instrumentos.ts (a que valia antes da I-15)."""
    ts = (RAIZ / "src" / "lib" / "instrumentos.ts").read_text(encoding="utf-8")
    m = re.search(rf"\b{nome}:\s*\{{\s*harmonicos:\s*\[([^\]]*)\]", ts)
    return [float(v) for v in m.group(1).split(",")][1:]


def interpolar(ancoras, midi):
    """O mesmo cálculo de harmonicosEm (src/lib/timbres.ts): interpolação linear entre as duas âncoras vizinhas."""
    ms = [a["midi"] for a in ancoras]
    if midi <= ms[0]:
        return list(ancoras[0]["h"])
    if midi >= ms[-1]:
        return list(ancoras[-1]["h"])
    i = max(j for j, m in enumerate(ms) if m <= midi)
    t = (midi - ms[i]) / (ms[i + 1] - ms[i])
    lo, hi = ancoras[i]["h"], ancoras[i + 1]["h"]
    n = max(len(lo), len(hi))
    return [(lo[k] if k < len(lo) else 0) * (1 - t) + (hi[k] if k < len(hi) else 0) * t for k in range(n)]


def distancia_espectral(tabela, medida):
    """Diferença média, em dB, entre os harmônicos de uma tabela e os da gravação (ambas com a mesma energia total),
    pesando cada harmônico pela energia dele na gravação: errar um harmônico forte pesa mais que errar um fraco."""
    n = len(medida)
    a = np.zeros(n)
    a[: min(n, len(tabela))] = tabela[:n]
    b = np.array(medida, float)
    a = a / max(np.sqrt(np.sum(a**2)), 1e-9)
    b = b / np.sqrt(np.sum(b**2))
    piso = 10 ** (-60 / 20)  # harmônicos abaixo de -60 dB não contam como erro
    d = 20 * np.log10(np.maximum(a, piso)) - 20 * np.log10(np.maximum(b, piso))
    w = b**2 / np.sum(b**2)
    return float(np.sqrt(np.sum(w * d**2)))


def medir_distancia():
    """Valida a síntese em notas que NÃO são âncoras: mede a gravação ali e compara a tabela antiga (fixa) com a
    nova (interpolada das âncoras). Menor = mais parecido com o instrumento de verdade."""
    dados = json.loads(SAIDA.read_text(encoding="utf-8"))["instrumentos"]
    print("Distância espectral (dB, ponderada pela energia) à gravação, em notas fora das âncoras. Menor = mais parecido.\n")
    print(f"{'instrumento':<11}{'notas':>6} | {'antes':>7}{'agora':>8} | {'melhora':>8}")
    todas_antes, todas_agora = [], []
    for nome, (arquivo, lo, hi) in INSTRUMENTOS.items():
        ancoras = dados[nome]["ancoras"]
        em_ancora = {a["midi"] for a in ancoras}
        amostras = ler_amostras(arquivo)
        antiga = tabela_antiga(nome)
        antes, agora = [], []
        for midi in range(lo, hi + 1):
            if midi in em_ancora or midi not in amostras:
                continue
            x = decodificar(amostras[midi])
            env, _ = rms_janelas(x)
            if env.max() < 1e-4:
                continue
            medida = analisar_nota(x, midi)["h"]
            antes.append(distancia_espectral(antiga, medida))
            agora.append(distancia_espectral(interpolar(ancoras, midi)[: len(medida)], medida))
        todas_antes += antes
        todas_agora += agora
        print(f"{nome:<11}{len(antes):>6} | {np.mean(antes):7.1f}{np.mean(agora):8.1f} | {np.mean(antes) / np.mean(agora):7.1f}x")
    print(f"{'todos':<11}{len(todas_antes):>6} | {np.mean(todas_antes):7.1f}{np.mean(todas_agora):8.1f} | {np.mean(todas_antes) / np.mean(todas_agora):7.1f}x")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--distancia", action="store_true", help="valida a síntese: distância espectral à gravação em notas fora das âncoras (antes x agora)")
    ap.add_argument("--niveis", action="store_true", help="compara o volume dos 16 gravados (o órgão de tirantes em destaque)")
    ap.add_argument("--instrumento", choices=list(INSTRUMENTOS), help="só este (nome da síntese: trompete, trombone, tuba, fagote, oboe, sax_alto, sax_tenor)")
    ap.add_argument("--diagnostico", action="store_true", help="mostra as medidas e não grava")
    ap.add_argument("--orgaos", action="store_true", help="mede o órgão de tirantes e compara com os órgãos sintetizados")
    args = ap.parse_args()
    if not FONTE.is_dir():
        sys.exit(f"sem {FONTE}: rode tools/baixar-sons-gm.py")
    if args.niveis:
        comparar_niveis()
        return
    if args.orgaos:
        comparar_orgaos()
        return
    if args.distancia:
        medir_distancia()
        return

    saida = {"fonte": "FluidR3_GM (licença MIT), medido por tools/analisar-timbres.py", "instrumentos": {}}
    for nome, (arquivo, lo, hi) in INSTRUMENTOS.items():
        if args.instrumento and args.instrumento != nome:
            continue
        amostras = ler_amostras(arquivo)
        ancoras = []
        for midi in range(lo, hi + 1, PASSO_ANCORAS):
            if midi not in amostras:
                continue
            m = analisar_nota(decodificar(amostras[midi]), midi)
            ancoras.append(m)
            if args.diagnostico:
                print(f"{nome:9} midi {midi:3} f0={m['f_med']:7.2f} ataque={m['ataque']*1000:4.0f} ms  centroide={m['centroide']:5.2f}  "
                      f"corte_início={m['fc_inicio']}  abertura={m['abertura']}  fora_dos_harm={m['ruido']:.3f}  "
                      f"h1-6={[round(v, 2) for v in m['h'][:6]]}")
        saida["instrumentos"][nome] = {"arquivo": arquivo, "faixa": [lo, hi], "ancoras": ancoras}
    if not args.diagnostico:
        if args.instrumento and SAIDA.exists():
            # Atualiza só o escolhido: os demais ficam como estão no arquivo (na ordem do catálogo).
            antigos = json.loads(SAIDA.read_text(encoding="utf-8"))["instrumentos"]
            antigos.update(saida["instrumentos"])
            saida["instrumentos"] = {nome: antigos[nome] for nome in INSTRUMENTOS if nome in antigos}
        SAIDA.write_text(json.dumps(saida, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"gravado {SAIDA} ({SAIDA.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
