"""Medição das âncoras de cada instrumento e gravação de src/lib/timbres.json."""
import json
import sys

from . import config
from .audio import decodificar, ler_amostras, rms_janelas
from .config import INSTRUMENTOS, PASSO_ANCORAS
from .nota import analisar_nota


def _mostrar_diagnostico(nome, m):
    print(f"{nome:9} midi {m['midi']:3} f0={m['f_med']:7.2f} ataque={m['ataque']*1000:4.0f} ms  centroide={m['centroide']:5.2f}  "
          f"corte_início={m['fc_inicio']}  abertura={m['abertura']}  fora_dos_harm={m['ruido']:.3f}  "
          f"h1-6={[round(v, 2) for v in m['h'][:6]]}")


def _medir_ancora(nome, amostras, midi):
    """Mede a nota; None se o banco a deixou muda (sem sinal não há timbre a medir)."""
    x = decodificar(amostras[midi])
    if rms_janelas(x)[0].max(initial=0) < 1e-3:
        print(f"{nome}: nota {midi} muda no banco, pulada", file=sys.stderr)
        return None
    return analisar_nota(x, midi)


def medir_ancoras(nome, instrumento, diagnostico):
    """Âncoras do instrumento: uma nota a cada PASSO_ANCORAS semitons da faixa dele (as que existem e não estão mudas)."""
    arquivo, lo, hi = instrumento
    amostras = ler_amostras(arquivo)
    ancoras = []
    for midi in range(lo, hi + 1, PASSO_ANCORAS):
        m = _medir_ancora(nome, amostras, midi) if midi in amostras else None
        if m is None:
            continue
        ancoras.append(m)
        if diagnostico:
            _mostrar_diagnostico(nome, m)
    return ancoras


def _gravar(saida, so_um):
    if so_um and config.SAIDA.exists():
        # Atualiza só o escolhido: os demais ficam como estão no arquivo (na ordem do catálogo).
        antigos = json.loads(config.SAIDA.read_text(encoding="utf-8"))["instrumentos"]
        antigos.update(saida["instrumentos"])
        saida["instrumentos"] = {nome: antigos[nome] for nome in INSTRUMENTOS if nome in antigos}
    config.SAIDA.write_text(json.dumps(saida, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"gravado {config.SAIDA} ({config.SAIDA.stat().st_size / 1024:.1f} KB)")


def gerar(instrumento, diagnostico):
    """Mede os instrumentos (só `instrumento`, se dado) e grava o JSON; com `diagnostico` só mostra as medidas."""
    saida = {"fonte": "FluidR3_GM (licença MIT), medido por tools/analisar-timbres.py", "instrumentos": {}}
    for nome, (arquivo, lo, hi) in INSTRUMENTOS.items():
        if not instrumento or instrumento == nome:
            saida["instrumentos"][nome] = {"arquivo": arquivo, "faixa": [lo, hi], "ancoras": medir_ancoras(nome, (arquivo, lo, hi), diagnostico)}
    if not diagnostico:
        _gravar(saida, instrumento)
