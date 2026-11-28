"""O MuseScore: achar o comando e converter um .mscx em MusicXML."""
import os
import shlex
import shutil
import subprocess
from pathlib import Path

TEMPO_LIMITE = 180  # segundos por hino no MuseScore (nos hinos de amostra ele leva menos de 1 s)


def _flatpak(entrada: Path, trabalho: Path):
    """O comando do Flatpak do MuseScore, ou None se ele não estiver instalado. O Flatpak só enxerga as pastas que se pedem: a de entrada (leitura) e a de trabalho."""
    if not shutil.which("flatpak"):
        return None
    try:
        achou = subprocess.run(["flatpak", "info", "org.musescore.MuseScore"], capture_output=True, timeout=30)
    except (subprocess.TimeoutExpired, OSError):
        return None
    if achou.returncode != 0:
        return None
    return ["flatpak", "run", f"--filesystem={entrada}:ro", f"--filesystem={trabalho}", "org.musescore.MuseScore"]


def achar_musescore(entrada: Path, trabalho: Path, escolhido: str | None):
    """Devolve o início do comando do MuseScore (lista) ou None se não achar nenhum."""
    escolhido = escolhido or os.environ.get("BM_MUSESCORE")
    if escolhido:
        return shlex.split(escolhido)
    for comando in ("mscore", "musescore4", "musescore"):
        if shutil.which(comando):
            return [comando]
    return _flatpak(entrada, trabalho)


def ultimas_linhas(texto: str, quantas: int = 3) -> str:
    linhas = [l.strip() for l in (texto or "").splitlines() if l.strip()]
    return " | ".join(linhas[-quantas:])


def mscx_para_musicxml(musescore: list, mscx: Path, destino: Path, tempo: int = TEMPO_LIMITE):
    """Roda o MuseScore. Devolve None se o MusicXML saiu, ou o motivo da falha (texto)."""
    ambiente = dict(os.environ, QT_QPA_PLATFORM="offscreen")
    try:
        r = subprocess.run([*musescore, "-o", str(destino), str(mscx)], env=ambiente, capture_output=True, text=True,
                           errors="replace", timeout=tempo)
    except subprocess.TimeoutExpired:
        return f"o MuseScore passou de {tempo} s e foi interrompido"
    except OSError as e:
        return f"não consegui rodar o MuseScore ({' '.join(musescore)}): {e}"
    if destino.exists() and destino.stat().st_size > 0:
        return None
    # Em caso de sucesso o MuseScore também escreve avisos inofensivos; só se mostram quando não saiu arquivo.
    motivo = f"o MuseScore não gerou o MusicXML (código {r.returncode})"
    detalhe = ultimas_linhas(r.stderr or r.stdout)
    return f"{motivo}: {detalhe}" if detalhe else motivo
