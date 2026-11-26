// A parte PURA de "Qual nota é essa?" (I-35): da leitura bruta do detector (frequência, clareza e volume de cada janela de som) até a nota que a tela mostra. Sem microfone e sem tela,
// para se testar no Vitest com sons sintéticos. `pitchy` (método de McLeod) acha a frequência; aqui ficam os filtros por cima: corte por clareza e volume, mediana de ~200 ms
// (vibrato, ruído), regra de oitava (um salto de uma oitava só vale se persistir), histerese do nome e o congelamento da última nota por ~1 s depois que o som acaba.
import { PitchDetector } from "pitchy";
import { centsEntre, leituraComHisterese, mediana, notaMaisProxima, LA_PADRAO, type Leitura } from "./afinador";

/** Tamanho da janela: 4096 amostras (85 ms a 48 kHz) cobrem dois períodos até ~23 Hz, o que inclui a tuba (Fá1 ≈ 44 Hz, pedais ≈ 30 Hz). */
export const JANELA = 4096;
/** Faixa aceita: da tuba grave (~30 Hz) ao Dó7 (~2100 Hz). Fora dela a leitura é descartada. */
export const FAIXA_MIN_HZ = 30;
export const FAIXA_MAX_HZ = 2100;
/** Clareza mínima do MPM (0 a 1); abaixo disso o som é ruído ou várias notas. */
export const CLAREZA_MIN = 0.9;
/** Volume mínimo (RMS, 0 a 1) para tentar achar uma nota; abaixo disso é silêncio ou ruído de fundo. */
export const VOLUME_MIN = 0.01;
/** Janela da mediana (ms). */
export const JANELA_MEDIANA_MS = 200;
/** Quanto tempo a última nota fica na tela, esmaecida, depois que o som acaba (ms). */
export const CONGELAR_MS = 1000;
/** Um salto desta grandeza (cents) em relação à mediana é suspeito de erro de oitava e só vale se persistir. */
export const SALTO_DE_OITAVA_CENTS = 1150; // perto da oitava (1200): um salto de 7ª (1000) é melodia, não erro de oitava
/** Quantas leituras seguidas confirmam um salto de oitava. */
export const CONFIRMAR_SALTO = 5;

export type Bruta = { freq: number; clareza: number; volume: number };

/** O volume (RMS) de uma janela de amostras. */
export function rms(amostras: ArrayLike<number>): number {
  let soma = 0;
  for (let i = 0; i < amostras.length; i++) soma += amostras[i]! * amostras[i]!;
  return amostras.length ? Math.sqrt(soma / amostras.length) : 0;
}

/** Acha a frequência de uma janela; nulo se o som é fraco demais ou a leitura não é confiável. */
export class Medidor {
  private readonly pitchy = PitchDetector.forFloat32Array(JANELA);
  constructor() {
    this.pitchy.minVolumeAbsolute = 0; // o corte de volume é nosso (`VOLUME_MIN`, em RMS)
  }
  medir(amostras: Float32Array, taxa: number): Bruta | null {
    const volume = rms(amostras);
    if (volume < VOLUME_MIN) return null;
    const [freq, clareza] = this.pitchy.findPitch(amostras, taxa);
    return { freq, clareza, volume };
  }
}

/** A leitura é boa o bastante para virar nota? */
export const leituraValida = (b: Bruta | null): b is Bruta =>
  !!b && Number.isFinite(b.freq) && b.freq >= FAIXA_MIN_HZ && b.freq <= FAIXA_MAX_HZ && b.clareza >= CLAREZA_MIN && b.volume >= VOLUME_MIN;

export type Estado =
  | { tipo: "silencio" }
  /** `repetida`: a leitura é a MESMA de antes (um quadro suspeito de erro de oitava foi descartado); quem suaviza segura o valor em vez de andar. */
  | { tipo: "nota"; leitura: Leitura; freq: number; repetida?: true }
  /** O som acabou há menos de `CONGELAR_MS`: a última nota segue na tela, esmaecida (sempre a mesma leitura de antes). */
  | { tipo: "congelada"; leitura: Leitura; freq: number; repetida: true };

/** Junta as leituras no tempo. `entrar(agora, leitura)` com `agora` em ms (qualquer relógio crescente) devolve o que a tela mostra. */
export class Estabilizador {
  private recentes: { t: number; f: number }[] = [];
  private nota: number | null = null;
  private ultima: { leitura: Leitura; freq: number; t: number } | null = null;
  private candidata = 0;

  constructor(private readonly la: number = LA_PADRAO) {}

  reiniciar(): void {
    this.recentes = [];
    this.nota = null;
    this.ultima = null;
    this.candidata = 0;
  }

  entrar(agora: number, bruta: Bruta | null): Estado {
    if (leituraValida(bruta)) {
      // Poda ANTES de filtrar: depois de uma pausa (entre 200 ms e o fim do congelamento) as leituras velhas não podem decidir se a nota nova é "erro de oitava".
      this.recentes = this.recentes.filter((r) => agora - r.t <= JANELA_MEDIANA_MS);
      const f = this.filtrarOitava(bruta.freq);
      if (f !== null) {
        this.recentes.push({ t: agora, f });
        const freq = mediana(this.recentes.map((r) => r.f));
        const leitura = freq === null ? null : leituraComHisterese(freq, this.nota, this.la);
        if (freq !== null && leitura) {
          this.nota = leitura.midi;
          this.ultima = { leitura, freq, t: agora };
          return { tipo: "nota", leitura, freq };
        }
      } else if (this.ultima) {
        // Um quadro suspeito de erro de oitava: segue a nota de antes (viva, não esmaecida) e adia o `t` do último som bom para o congelamento não começar à toa.
        this.ultima.t = agora;
        return { tipo: "nota", leitura: this.ultima.leitura, freq: this.ultima.freq, repetida: true };
      }
    }
    if (this.ultima && agora - this.ultima.t <= CONGELAR_MS) return { tipo: "congelada", leitura: this.ultima.leitura, freq: this.ultima.freq, repetida: true };
    this.recentes = [];
    this.nota = null;
    this.ultima = null;
    return { tipo: "silencio" };
  }

  /** Uma leitura uma oitava (ou mais) fora da mediana só entra depois de `CONFIRMAR_SALTO` seguidas: o MPM às vezes erra de oitava num quadro. */
  private filtrarOitava(f: number): number | null {
    const m = mediana(this.recentes.map((r) => r.f));
    if (m === null || Math.abs(centsEntre(f, m)) < SALTO_DE_OITAVA_CENTS) {
      this.candidata = 0;
      return f;
    }
    this.candidata++;
    if (this.candidata >= CONFIRMAR_SALTO) {
      this.candidata = 0;
      this.recentes = []; // a nota mudou de verdade: a mediana antiga não vale mais
      return f;
    }
    return null;
  }
}

/** A nota (MIDI) e o nome da oitava de uma frequência, só para quem precisa da conta sem histerese (testes e depuração). */
export const notaDe = (freq: number, la: number = LA_PADRAO) => notaMaisProxima(freq, la);
