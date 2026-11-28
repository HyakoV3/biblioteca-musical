"""A leitura dos arquivos `<instrumento>-mp3.js` do banco FluidR3_GM, igual para o download e para o preparo dos sons."""
import json


def ler_como_o_smplr(texto):
    """Mesma leitura do smplr (midiJsToJson): acha 'MIDI.Soundfont.', pega do '=' até a última vírgula e faz JSON.parse."""
    cabeca = texto.index("MIDI.Soundfont.")
    inicio = texto.index("=", cabeca) + 2
    fim = texto.rindex(",")
    return json.loads(texto[inicio:fim] + "}")
