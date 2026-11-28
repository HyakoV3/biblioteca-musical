// Instrumentos gravados (smplr/Soundfont) já carregados, um por (instrumento, voz): as amostras demoram a decodificar e se reaproveitam.
import { Soundfont } from "smplr";
import { REALISTAS, urlDoRealista, type RealistaId } from "./realista";
import { armazenamentoDoSmplr } from "./sons/armazenamento";

export type InstrumentoGravado = ReturnType<typeof Soundfont>;

export class Gravados {
  private porVoz = new Map<string, { inst: InstrumentoGravado; saida: GainNode }>();

  /**
   * Instrumento gravado pronto para tocar, ligado ao volume da voz. Cada (instrumento, voz) tem o seu: as amostras
   * demoram a carregar e ficam guardadas. Se o carregamento falhar, esquece o instrumento para tentar de novo.
   */
  async carregar(ctx: AudioContext, id: RealistaId, voz: number, destino: GainNode): Promise<InstrumentoGravado> {
    const chave = `${id}#${voz}`;
    const r = this.porVoz.get(chave) ?? this.criar(ctx, id, chave);
    try {
      await r.inst.ready;
    } catch (e) {
      this.porVoz.delete(chave);
      throw e;
    }
    r.saida.disconnect();
    r.saida.connect(destino);
    return r.inst;
  }

  /** Esquece tudo (o contexto em que nasceram foi fechado). */
  limpar(): void {
    this.porVoz.clear();
  }

  private criar(ctx: AudioContext, id: RealistaId, chave: string) {
    const saida = ctx.createGain();
    saida.gain.value = REALISTAS[id].ganho; // iguala o volume ao da síntese equivalente
    const r = { inst: Soundfont(ctx, { instrumentUrl: urlDoRealista(id), storage: armazenamentoDoSmplr, destination: saida, volume: 100 }), saida };
    this.porVoz.set(chave, r);
    return r;
  }
}
