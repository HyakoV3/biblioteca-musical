"""Níveis (RMS, ouvido, celular) dos instrumentos gravados com o ganho do app, e a calibração desses ganhos."""
import re
import sys

import numpy as np

from . import config
from .audio import decodificar, ler_amostras, localizar_sustentado
from .config import FAIXA_VOZ, RAIZ, ler_ts
from .orgaos import ORGAOS_SINTETICOS, sintetico_organ
from .sonoridade import niveis_do_trecho

PICO_MAXIMO = 0.85  # amplitude de uma voz sozinha: acima disso, 4 vozes somadas passam do que o compressor segura
ALTURAS_DAS_QUATRO_VOZES = [45, 55, 64, 72]
GANHO_DO_TIRANTES = 2.65


def parse_realistas():
    ts = ler_ts("realista.ts")
    saida = []
    for m in re.finditer(r'(real_\w+):\s*\{\s*arquivo:\s*"(\w+)",\s*ganho:\s*([\d.]+),\s*grupo:\s*"(\w+)",\s*vozes:\s*(TODAS|\[[^\]]*\])', ts):
        vozes = list(FAIXA_VOZ) if m.group(5) == "TODAS" else re.findall(r'"(\w+)"', m.group(5))
        saida.append((m.group(1), m.group(2), float(m.group(3)), vozes))
    return saida


def _alturas_das_vozes(vozes):
    if len(vozes) == 4:
        return ALTURAS_DAS_QUATRO_VOZES
    lo = min(FAIXA_VOZ[v][0] for v in vozes)
    hi = max(FAIXA_VOZ[v][1] for v in vozes)
    return [lo, (lo + hi) // 2, hi]


def _niveis_da_nota(amostras, midi, ganho):
    """Níveis do trecho sustentado de uma nota gravada; None se o banco a deixou muda (ex.: o contrabaixo acima da nota 59)."""
    x = decodificar(amostras[midi])
    s = localizar_sustentado(x)
    if s.env.max() < 1e-4:
        return None
    return niveis_do_trecho(x[s.a : s.b], ganho)


def _media_em_db(a, coluna):
    return 10 * np.log10(np.mean(10 ** (a[:, coluna] / 10)))


def nivel_do_instrumento(arquivo, vozes, ganho):
    """(rms, ouvido, celular, pico) do instrumento, na faixa das vozes dele, com o ganho dado (dB, e o pico em amplitude)."""
    amostras = ler_amostras(arquivo)
    medidos = [_niveis_da_nota(amostras, midi, ganho) for midi in _alturas_das_vozes(vozes)]
    acum = [n for n in medidos if n is not None]
    if not acum:
        sys.exit(f"{arquivo}: todas as notas medidas estão mudas em {config.FONTE}")
    a = np.array(acum)
    return _media_em_db(a, 0), _media_em_db(a, 1), _media_em_db(a, 2), float(a[:, 3].max())


def _mediana(linhas, coluna):
    return float(np.median([l[coluna] for l in linhas]))


def _mostrar_tabela_de_niveis(linhas):
    med_rms, med_ouv, med_cel = (_mediana(linhas, c) for c in (2, 3, 4))
    print(f"{'instrumento':<22}{'ganho':>6} | {'rms':>7}{'ouvido':>8}{'celular':>9} | vs mediana: {'rms':>6}{'ouvido':>8}{'celular':>9} | {'pico':>5}")
    for id_, ganho, r, o, c, pico in sorted(linhas, key=lambda l: l[4]):
        marca = "  <== órgão de tirantes" if id_ == "real_orgao_tirantes" else ""
        print(f"{id_:<22}{ganho:>6.2f} | {r:7.1f}{o:8.1f}{c:9.1f} |             {r - med_rms:+6.1f}{o - med_ouv:+8.1f}{c - med_cel:+9.1f} | {pico:5.2f}{marca}")
    print(f"\nmedianas dos 16: rms {med_rms:.1f}, ouvido {med_ouv:.1f}, celular {med_cel:.1f} dB")


def _niveis_do_tirantes():
    """Níveis (uma linha por altura) do órgão de tirantes gravado, com o ganho dele no app."""
    amostras = ler_amostras("drawbar_organ")
    tir = []
    for midi in ALTURAS_DAS_QUATRO_VOZES:
        x = decodificar(amostras[midi])
        s = localizar_sustentado(x)
        tir.append(niveis_do_trecho(x[s.a : s.b], GANHO_DO_TIRANTES))
    return np.array(tir)


def _mostrar_tirantes_x_sinteticos():
    """O órgão de tirantes contra os órgãos SINTETIZADOS no mesmo RMS: quanto o formato do espectro tira (ou põe) no som."""
    print("\n== Órgão de tirantes x órgãos sintetizados (média de 4 alturas; mesmos 'rms', veja o que muda no ouvido e no celular) ==")
    tir = _niveis_do_tirantes()
    print(f"{'órgão':<20}{'rms':>8}{'ouvido':>8}{'celular':>9} | {'ouvido-rms':>11}{'celular-rms':>13}")
    print(f"{'tirantes (ganho 2,65)':<20}{np.mean(tir[:,0]):8.1f}{np.mean(tir[:,1]):8.1f}{np.mean(tir[:,2]):9.1f} | {np.mean(tir[:,1]-tir[:,0]):+11.1f}{np.mean(tir[:,2]-tir[:,0]):+13.1f}")
    for nome in ORGAOS_SINTETICOS:
        s = np.array([niveis_do_trecho(sintetico_organ(nome, m), 1.0) for m in ALTURAS_DAS_QUATRO_VOZES])
        print(f"{nome:<20}{np.mean(s[:,0]):8.1f}{np.mean(s[:,1]):8.1f}{np.mean(s[:,2]):9.1f} | {np.mean(s[:,1]-s[:,0]):+11.1f}{np.mean(s[:,2]-s[:,0]):+13.1f}")


def comparar_niveis():
    print("Níveis com o ganho do app, na faixa de cada voz. Quanto MAIOR o número (menos negativo), mais alto soa.")
    print("  rms    = o que a calibração atual igualou;  ouvido = ponderado pela curva A;  celular = curva A sem os graves abaixo de ~250 Hz.\n")
    linhas = []
    for id_, arquivo, ganho, vozes in parse_realistas():
        r, o, c, pico = nivel_do_instrumento(arquivo, vozes, ganho)
        linhas.append((id_, ganho, r, o, c, pico))
    _mostrar_tabela_de_niveis(linhas)
    _mostrar_tirantes_x_sinteticos()


def _ganho_para_o_alvo(alvo, ouvido, pico):
    """(ganho, limitado): o que leva o nível medido com ganho 1 ao alvo, limitado pelo pico máximo."""
    ganho = 10 ** ((alvo - ouvido) / 20)
    limitado = pico * ganho > PICO_MAXIMO
    if limitado:
        ganho = PICO_MAXIMO / pico
    return round(ganho, 2), limitado


def _calcular_ganhos(alvo):
    """Mede cada gravado com ganho 1, imprime a tabela e devolve [(id, ganho)]."""
    print(f"{'instrumento':<22}{'ganho':>7}{'(antes)':>9} | {'ouvido':>7}{'celular':>9}{'pico':>6}")
    resultados = []
    for id_, arquivo, ganho_atual, vozes in parse_realistas():
        r, o, c, pico = nivel_do_instrumento(arquivo, vozes, 1.0)
        ganho, limitado = _ganho_para_o_alvo(alvo, o, pico)
        marca = "  <== limitado pelo pico" if limitado else ""
        resultados.append((id_, ganho))
        print(f"{id_:<22}{ganho:7.2f}{ganho_atual:9.2f} | {o + 20 * np.log10(ganho):7.1f}{c + 20 * np.log10(ganho):9.1f}{pico * ganho:6.2f}{marca}")
    return resultados


def _gravar_ganhos(ts_caminho, ts, resultados):
    for id_, ganho in resultados:
        ts, n = re.subn(rf"({id_}:\s*\{{\s*arquivo:\s*\"\w+\",\s*ganho:\s*)[\d.]+", rf"\g<1>{ganho}", ts)
        if n != 1:
            sys.exit(f"não achei o ganho de {id_} em realista.ts")
    ts_caminho.write_text(ts, encoding="utf-8")
    print(f"\nganhos gravados em {ts_caminho}")


def calibrar(alvo, escrever):
    """Calcula o ganho de cada gravado para ficarem todos no MESMO nível médio no ouvido (curva A), na faixa das vozes dele.
    Sem --escrever só mostra; com --escrever grava os ganhos em src/lib/realista.ts."""
    ts_caminho = RAIZ / "src" / "lib" / "realista.ts"
    ts = ts_caminho.read_text(encoding="utf-8")
    print(f"Alvo: {alvo:.1f} dB no ouvido (curva A). Ganho = o que leva o nível medido com ganho 1 ao alvo; limitado pelo pico de {PICO_MAXIMO}.\n")
    resultados = _calcular_ganhos(alvo)
    if escrever:
        _gravar_ganhos(ts_caminho, ts, resultados)
