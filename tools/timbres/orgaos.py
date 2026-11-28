"""Comparação do órgão de tirantes gravado com os órgãos sintetizados de src/lib/instrumentos.ts."""
import re

import numpy as np

from .audio import decodificar, frequencia_da_nota, ler_amostras, localizar_sustentado
from .config import SR, ler_ts
from .espectro import amplitudes_em
from .sonoridade import db

ORGAOS_SINTETICOS = ("orgao_suave", "orgao_principal", "orgao_pleno")
ORGAOS_GRAVADOS = (("tirantes (drawbar_organ)", "drawbar_organ"), ("igreja (church_organ)", "church_organ"), ("palhetas (reed_organ)", "reed_organ"))
ALTURAS = [36, 48, 60, 72, 84]
MULTIPLOS = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12]
HARMONICOS_COMPARADOS = [1, 2, 3, 4, 5, 6, 8]
REFERENCIA = "tirantes (drawbar_organ)"


def tabelas_sinteticas():
    """Lê as tabelas de harmônicos dos órgãos sintetizados de src/lib/instrumentos.ts."""
    ts = ler_ts("instrumentos.ts")
    saida = {}
    for nome in ORGAOS_SINTETICOS:
        m = re.search(rf"{nome}:\s*\{{\s*harmonicos:\s*\[([^\]]*)\]", ts)
        saida[nome] = [float(v) for v in m.group(1).split(",")][1:]  # o índice 0 é ignorado
    return saida


def sintetico_organ(nome, midi):
    """Trecho de 1 s de um órgão sintetizado (série de senos, normalizada em pico 1 como o PeriodicWave) vezes o nível do perfil."""
    ts = ler_ts("instrumentos.ts")
    m = re.search(rf"{nome}:\s*\{{\s*harmonicos:\s*\[([^\]]*)\].*?nivel:\s*([\d.]+)", ts)
    h = [float(v) for v in m.group(1).split(",")]
    nivel = float(m.group(2))
    f0 = frequencia_da_nota(midi)
    t = np.arange(int(SR * 1.0)) / SR
    onda = sum(a * np.sin(2 * np.pi * f0 * k * t) for k, a in enumerate(h) if k > 0 and a)
    onda = onda / np.max(np.abs(onda))
    return onda * nivel


def _medir_altura(amostras, midi):
    """(tempo de ataque em s, nível RMS, amplitude em cada múltiplo relativa à própria nota) de uma nota gravada."""
    x = decodificar(amostras[midi])
    s = localizar_sustentado(x)
    amps, _ = amplitudes_em(x[s.a : s.b], frequencia_da_nota(midi), MULTIPLOS)
    rel = amps / max(amps[MULTIPLOS.index(1)], 1e-9)
    nivel = float(np.sqrt(np.mean(x[s.a : s.b] ** 2)))
    cruz = int(np.argmax(s.env[s.inicio :] >= 0.9 * nivel)) * s.passo
    return cruz, nivel, rel


def _mostrar_perfil_gravado(rotulo, arquivo):
    """Imprime a tabela do órgão gravado e devolve o perfil médio das alturas (múltiplo -> amplitude relativa)."""
    amostras = ler_amostras(arquivo)
    print(f"\n=== Órgão {rotulo}: amplitude em cada múltiplo da nota, relativa à própria nota (1,00 = a nota) ===")
    print(f"{'altura':>8} {'ataque':>7} {'rms':>6} | " + " ".join(f"{m:>5}x" for m in MULTIPLOS))
    linhas = []
    for midi in ALTURAS:
        cruz, nivel, rel = _medir_altura(amostras, midi)
        linhas.append(rel)
        nome_nota = f"{'C'}{midi // 12 - 1}"
        print(f"{nome_nota:>8} {cruz*1000:5.0f}ms {nivel:6.3f} | " + " ".join(f"{v:6.2f}" for v in rel))
    media = np.mean(linhas, axis=0)
    print(f"{'média':>8} {'':>7} {'':>6} | " + " ".join(f"{v:6.2f}" for v in media))
    return dict(zip(MULTIPLOS, media))


def _harmonico(tab, k):
    """Amplitude do harmônico k (1 = a nota) de uma tabela; 0 se a tabela não chega lá."""
    return tab[k - 1] if k - 1 < len(tab) else 0.0


def _mostrar_sinteticos(sinteticos):
    print("\n=== Órgãos SINTETIZADOS (tabela fixa do app; harmônico 1 = a nota = 1,00) ===")
    print(f"{'órgão':>16} | " + " ".join(f"{m:>5}x" for m in MULTIPLOS))
    for nome, tab in sinteticos.items():
        vals = [_harmonico(tab, int(m)) if float(m).is_integer() else 0.0 for m in MULTIPLOS]
        print(f"{nome:>16} | " + " ".join(f"{v:6.2f}" for v in vals))


def _mostrar_distancias(sinteticos, ref):
    print("\n=== Distância dos órgãos sintetizados ao de tirantes (harmônicos inteiros 1 a 8; menor = mais parecido) ===")
    print("Diferença média absoluta em dB, comparando cada harmônico com o do órgão de tirantes (média das 5 alturas).")
    for nome, tab in sinteticos.items():
        dif = [abs(db(_harmonico(tab, k)) - db(ref[k])) for k in HARMONICOS_COMPARADOS]
        print(f"{nome:>16}: {np.mean(dif):5.1f} dB  (por harmônico: " + ", ".join(f"{k}:{d:4.1f}" for k, d in zip(HARMONICOS_COMPARADOS, dif)) + ")")


def _mostrar_energia_abaixo(ref):
    sub = ref[0.5] + ref[1.5] + ref[2.5]
    print(f"\nO órgão de tirantes tem energia ABAIXO da nota que a síntese não tem: 0,5x={ref[0.5]:.2f}, 1,5x={ref[1.5]:.2f}, 2,5x={ref[2.5]:.2f} "
          f"(soma {sub:.2f} contra a nota = 1,00).")


def comparar_orgaos():
    """Mede o órgão de tirantes (e, de contexto, o de igreja e o de palhetas) e compara com os órgãos sintetizados."""
    sinteticos = tabelas_sinteticas()
    perfis = {rotulo: _mostrar_perfil_gravado(rotulo, arquivo) for rotulo, arquivo in ORGAOS_GRAVADOS}
    _mostrar_sinteticos(sinteticos)
    _mostrar_distancias(sinteticos, perfis[REFERENCIA])
    _mostrar_energia_abaixo(perfis[REFERENCIA])
