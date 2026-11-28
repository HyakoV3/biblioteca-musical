"""Validação da síntese: distância espectral entre as tabelas de harmônicos (antiga e interpolada) e a gravação."""
import json
import re

import numpy as np

from . import config
from .audio import decodificar, ler_amostras, rms_janelas
from .config import INSTRUMENTOS, ler_ts
from .nota import analisar_nota


def tabela_antiga(nome):
    """A tabela fixa de harmônicos de um instrumento em src/lib/instrumentos.ts (a que valia antes da I-15)."""
    ts = ler_ts("instrumentos.ts")
    m = re.search(rf"\b{nome}:\s*\{{\s*harmonicos:\s*\[([^\]]*)\]", ts)
    return [float(v) for v in m.group(1).split(",")][1:]


def _componente(h, k):
    return h[k] if k < len(h) else 0


def _indice_da_ancora_anterior(ms, midi):
    return max(j for j, m in enumerate(ms) if m <= midi)


def interpolar(ancoras, midi):
    """O mesmo cálculo de harmonicosEm (src/lib/timbres.ts): interpolação linear entre as duas âncoras vizinhas."""
    ms = [a["midi"] for a in ancoras]
    if midi <= ms[0]:
        return list(ancoras[0]["h"])
    if midi >= ms[-1]:
        return list(ancoras[-1]["h"])
    i = _indice_da_ancora_anterior(ms, midi)
    t = (midi - ms[i]) / (ms[i + 1] - ms[i])
    lo, hi = ancoras[i]["h"], ancoras[i + 1]["h"]
    return [_componente(lo, k) * (1 - t) + _componente(hi, k) * t for k in range(max(len(lo), len(hi)))]


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


def _notas_fora_das_ancoras(amostras, lo, hi, ancoras):
    """Notas gravadas da faixa que não são âncoras nem estão mudas: [(midi, medida dos harmônicos)]."""
    em_ancora = {a["midi"] for a in ancoras}
    notas = []
    for midi in range(lo, hi + 1):
        if midi in em_ancora or midi not in amostras:
            continue
        x = decodificar(amostras[midi])
        env, _ = rms_janelas(x)
        if not env.max() < 1e-4:  # como no original: um NaN (amostra estragada) NÃO é descartado
            notas.append((midi, analisar_nota(x, midi)["h"]))
    return notas


def _distancias_do_instrumento(nome, ancoras):
    """(distâncias da tabela antiga, distâncias da interpolada) em cada nota fora das âncoras."""
    arquivo, lo, hi = INSTRUMENTOS[nome]
    amostras = ler_amostras(arquivo)
    antiga = tabela_antiga(nome)  # antes de decodificar qualquer nota, como no original: se faltar a tabela, falha logo
    notas = _notas_fora_das_ancoras(amostras, lo, hi, ancoras)
    antes = [distancia_espectral(antiga, medida) for _, medida in notas]
    agora = [distancia_espectral(interpolar(ancoras, midi)[: len(medida)], medida) for midi, medida in notas]
    return antes, agora


def medir_distancia():
    """Valida a síntese em notas que NÃO são âncoras: mede a gravação ali e compara a tabela antiga (fixa) com a
    nova (interpolada das âncoras). Menor = mais parecido com o instrumento de verdade."""
    dados = json.loads(config.SAIDA.read_text(encoding="utf-8"))["instrumentos"]
    print("Distância espectral (dB, ponderada pela energia) à gravação, em notas fora das âncoras. Menor = mais parecido.\n")
    print(f"{'instrumento':<11}{'notas':>6} | {'antes':>7}{'agora':>8} | {'melhora':>8}")
    todas_antes, todas_agora = [], []
    for nome in INSTRUMENTOS:
        antes, agora = _distancias_do_instrumento(nome, dados[nome]["ancoras"])
        todas_antes += antes
        todas_agora += agora
        print(f"{nome:<11}{len(antes):>6} | {np.mean(antes):7.1f}{np.mean(agora):8.1f} | {np.mean(antes) / np.mean(agora):7.1f}x")
    print(f"{'todos':<11}{len(todas_antes):>6} | {np.mean(todas_antes):7.1f}{np.mean(todas_agora):8.1f} | {np.mean(todas_antes) / np.mean(todas_agora):7.1f}x")
