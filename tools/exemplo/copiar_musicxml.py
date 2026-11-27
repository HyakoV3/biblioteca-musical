"""Faz de "MuseScore" para `tools/gerar-partituras.py`: o pacote de exemplo já tem o MusicXML, então a "conversão" só copia.
Chamado como o MuseScore: `copiar_musicxml.py -o DESTINO ORIGEM`."""
import shutil
import sys

if __name__ == "__main__":
    shutil.copyfile(sys.argv[-1], sys.argv[-2])
