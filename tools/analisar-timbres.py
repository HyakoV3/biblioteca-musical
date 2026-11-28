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
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from timbres import config  # noqa: E402
from timbres.config import INSTRUMENTOS  # noqa: E402
from timbres.distancia import medir_distancia  # noqa: E402
from timbres.gerar import gerar  # noqa: E402
from timbres.niveis import calibrar, comparar_niveis  # noqa: E402
from timbres.orgaos import comparar_orgaos  # noqa: E402


def _ler_argumentos():
    ap = argparse.ArgumentParser()
    ap.add_argument("--distancia", action="store_true", help="valida a síntese: distância espectral à gravação em notas fora das âncoras (antes x agora)")
    ap.add_argument("--fonte", type=Path, help="pasta com os <instrumento>-mp3.js a medir (padrão: sons-fonte/FluidR3_GM)")
    ap.add_argument("--calibrar", action="store_true", help="calcula o ganho de cada gravado para o mesmo nível médio no ouvido")
    ap.add_argument("--alvo", type=float, default=-24.6, help="nível alvo no ouvido, em dB, para --calibrar (padrão: a mediana medida antes da troca de banco)")
    ap.add_argument("--escrever", action="store_true", help="com --calibrar, grava os ganhos em src/lib/realista.ts")
    ap.add_argument("--niveis", action="store_true", help="compara o volume dos 16 gravados (o órgão de tirantes em destaque)")
    ap.add_argument("--instrumento", choices=list(INSTRUMENTOS), help="só este (nome da síntese: trompete, trombone, tuba, fagote, oboe, sax_alto, sax_tenor)")
    ap.add_argument("--diagnostico", action="store_true", help="mostra as medidas e não grava")
    ap.add_argument("--orgaos", action="store_true", help="mede o órgão de tirantes e compara com os órgãos sintetizados")
    return ap.parse_args()


def _relatorio_pedido(args):
    """O relatório pedido pelas flags (o primeiro da lista que estiver ligado), ou None para gerar o JSON."""
    relatorios = [
        (args.calibrar, lambda: calibrar(args.alvo, args.escrever)),
        (args.niveis, comparar_niveis),
        (args.orgaos, comparar_orgaos),
        (args.distancia, medir_distancia),
    ]
    return next((executar for ligado, executar in relatorios if ligado), None)


def main():
    args = _ler_argumentos()
    if args.fonte:
        config.FONTE = args.fonte.expanduser().resolve()
    if not config.FONTE.is_dir():
        sys.exit(f"sem {config.FONTE}: rode tools/baixar-sons-gm.py")
    relatorio = _relatorio_pedido(args)
    if relatorio:
        relatorio()
    else:
        gerar(args.instrumento, args.diagnostico)


if __name__ == "__main__":
    main()
