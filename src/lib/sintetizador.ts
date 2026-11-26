// Sintetizador simples com Web Audio: toca notas (MIDI) de várias vozes.
// Não usa gravações: tudo é gerado a partir dos eventos de nota do pacote.
// Pausar suspende o relógio do AudioContext: as notas já agendadas retomam do ponto certo.
// Para mudar instrumento, andamento ou tom no meio do hino, `tocar` reagenda tudo a partir de uma posição em batidas.
import { Soundfont } from "smplr";
import { chaveAtual, criarContexto } from "./saidaAudio";
import { INSTRUMENTOS, PADRAO, type InstrumentoId, type SinteticoId } from "./instrumentos";
import { REALISTAS, ehRealista, urlDoRealista, type RealistaId } from "./realista";
import { armazenamentoDoSmplr } from "./sons/armazenamento";
import { perfilDaNota } from "./timbres";

export type Nota = [inicio: number, duracao: number, midi: number];
export type Voz = { nome: string; notas: Nota[] };

export type Opcoes = {
  andamento: number; // batidas por minuto
  transposicao: number; // semitons
  instrumentos: InstrumentoId[]; // um por voz
  volumes: number[]; // 0..1 por voz (0 = silenciada)
};

export const frequencia = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/**
 * As notas que ainda soam a partir de `batida`, com o tempo recontado desde esse ponto: as que terminaram antes
 * somem, as que atravessam o ponto começam em 0 com a duração que sobra, as demais só andam para trás.
 */
export function notasAPartirDe(notas: Nota[], batida: number): Nota[] {
  const ap = Number.isFinite(batida) ? Math.max(0, batida) : 0;
  if (ap === 0) return notas;
  const saida: Nota[] = [];
  for (const [inicio, dur, midi] of notas) {
    const fim = inicio + dur;
    if (fim <= ap + 1e-9) continue;
    saida.push(inicio >= ap ? [inicio - ap, dur, midi] : [0, fim - ap, midi]);
  }
  return saida;
}

/**
 * Agenda UMA nota sintetizada (oscilador, filtro de abertura nos metais, envoltória e vibrato) e devolve as fontes, para
 * quem chamou poder pará-las. `midi` é a altura que SOA (já transposta); `ini` e `dur` estão em segundos do relógio de
 * `ctx`. Serve ao app (AudioContext) e às prévias geradas offline (OfflineAudioContext). `ondas` guarda as ondas já
 * criadas: cada (instrumento, altura) tem a sua tabela de harmônicos, e criá-la a cada nota seria desperdício.
 */
export function agendarNota(
  ctx: BaseAudioContext,
  ondas: Map<string, PeriodicWave>,
  destino: AudioNode,
  id: SinteticoId,
  midi: number,
  ini: number,
  dur: number,
): AudioScheduledSourceNode[] {
  const perfil = perfilDaNota(id, midi);
  const chave = `${id}:${Math.round(midi)}`;
  let onda = ondas.get(chave);
  if (!onda) {
    onda = ctx.createPeriodicWave(new Float32Array(perfil.harmonicos.length), Float32Array.from(perfil.harmonicos));
    ondas.set(chave, onda);
  }
  const f0 = frequencia(midi);
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.setPeriodicWave(onda);
  osc.frequency.value = f0;
  const fimNota = ini + Math.max(dur, 0.05);
  const ataque = Math.min(perfil.ataque, (fimNota - ini) / 2);
  env.gain.setValueAtTime(0, ini);
  env.gain.linearRampToValueAtTime(perfil.nivel, ini + ataque);
  env.gain.setValueAtTime(perfil.nivel, Math.max(ini + ataque, fimNota - perfil.solta));
  env.gain.linearRampToValueAtTime(0, fimNota);
  if (perfil.abertura) {
    // Metais: o brilho nasce fechado e abre em poucas dezenas de milissegundos (passa-baixa de 2ª ordem).
    const teto = ctx.sampleRate * 0.45;
    const filtro = ctx.createBiquadFilter();
    filtro.type = "lowpass";
    filtro.Q.value = 20 * Math.log10(Math.SQRT1_2); // no lowpass do Web Audio o Q é em dB: -3,01 dB = Butterworth, sem pico (o modelo medido)
    const de = Math.min(teto, perfil.abertura.corte * f0);
    filtro.frequency.setValueAtTime(de, ini);
    filtro.frequency.exponentialRampToValueAtTime(teto, ini + perfil.abertura.tempo);
    osc.connect(filtro).connect(env).connect(destino);
  } else {
    osc.connect(env).connect(destino);
  }
  const fontes: AudioScheduledSourceNode[] = [osc];

  if (perfil.vibrato) {
    // O vibrato entra devagar, depois do atraso: notas curtas quase não o recebem.
    const lfo = ctx.createOscillator();
    const prof = ctx.createGain();
    lfo.frequency.value = perfil.vibrato.hz;
    prof.gain.setValueAtTime(0, ini);
    prof.gain.setValueAtTime(0, ini + perfil.vibrato.atraso);
    prof.gain.linearRampToValueAtTime(perfil.vibrato.cents, ini + perfil.vibrato.atraso + 0.25);
    lfo.connect(prof).connect(osc.detune);
    lfo.start(ini);
    lfo.stop(fimNota + 0.02);
    fontes.push(lfo);
  }

  osc.start(ini);
  osc.stop(fimNota + 0.02);
  return fontes;
}

/** Como `tocar` deve começar. */
export type Partida = {
  /** Posição, em batidas, de onde tocar (0 = do começo). */
  aPartirDe?: number;
  /** O relógio está suspenso (pausa): agenda sem retomar; quem chamou retoma depois com `continuar()`. */
  pausado?: boolean;
};

/** Antecedência do início, em segundos, para dar tempo de agendar todas as notas. */
const ATRASO_INICIAL = 0.1;

export class Sintetizador {
  private ctx: AudioContext | null = null;
  /** A rota e o modo de áudio com que `ctx` nasceu: se a pessoa trocar de saída ou de modo, o contexto é refeito antes do próximo hino. */
  private chaveDoCtx = "";
  private mestre: GainNode | null = null;
  private ganhos: GainNode[] = [];
  private fontes: AudioScheduledSourceNode[] = [];
  private ondas = new Map<string, PeriodicWave>();
  /** Instrumentos gravados já carregados, um por (instrumento, voz): as amostras demoram a decodificar e se reaproveitam. */
  private reais = new Map<string, { inst: ReturnType<typeof Soundfont>; saida: GainNode }>();
  /** Os gravados que estão soando no agendamento atual (para parar). */
  private reaisAtivos: ReturnType<typeof Soundfont>[] = [];
  private inicio = 0;
  /** Segundos já "tocados" antes do início do agendamento atual (quando tocar começou no meio do hino). */
  private base = 0;

  /**
   * Instrumento gravado pronto para tocar, ligado ao volume da voz. Cada (instrumento, voz) tem o seu: as amostras
   * demoram a carregar e ficam guardadas. Se o carregamento falhar, esquece o instrumento para tentar de novo.
   */
  private async real(ctx: AudioContext, id: RealistaId, voz: number, destino: GainNode) {
    const chave = `${id}#${voz}`;
    let r = this.reais.get(chave);
    if (!r) {
      const saida = ctx.createGain();
      saida.gain.value = REALISTAS[id].ganho; // iguala o volume ao da síntese equivalente
      r = { inst: Soundfont(ctx, { instrumentUrl: urlDoRealista(id), storage: armazenamentoDoSmplr, destination: saida, volume: 100 }), saida };
      this.reais.set(chave, r);
    }
    try {
      await r.inst.ready;
    } catch (e) {
      this.reais.delete(chave);
      throw e;
    }
    r.saida.disconnect();
    r.saida.connect(destino);
    return r.inst;
  }

  /**
   * Agenda e começa a tocar. Devolve a duração total do hino em segundos, no andamento pedido (contando também o
   * que ficou para trás quando `aPartirDe` não é 0, para o tempo decorrido e a duração continuarem na mesma régua).
   */
  /** Fecha o contexto de uma saída que a pessoa deixou: as ondas e os instrumentos gravados nasceram nele e não servem a outro. */
  private descartarContexto(): void {
    const velho = this.ctx;
    this.ctx = null;
    this.ondas.clear();
    this.reais.clear();
    this.reaisAtivos = [];
    if (velho && velho.state !== "closed") void velho.close().catch(() => {});
  }

  async tocar(vozes: Voz[], opcoes: Opcoes, partida: Partida = {}): Promise<number> {
    this.parar();
    const chave = chaveAtual();
    if (this.ctx && chave !== this.chaveDoCtx) this.descartarContexto();
    if (!this.ctx) {
      this.ctx = criarContexto();
      this.chaveDoCtx = chave;
    }
    // Em iOS/WebView o áudio só inicia após um gesto do usuário (clique em "Tocar").
    if (!partida.pausado) await this.ctx.resume();
    const ctx = this.ctx;
    // Pedido de um ponto COM o hino pausado (arrastar a barra depois de trocar de saída): o contexto novo nasce rodando, e a tela diz "pausado".
    if (partida.pausado && ctx.state === "running") await ctx.suspend();

    // Compressor no fim da cadeia: várias vozes somadas não estouram o volume.
    const compressor = ctx.createDynamicsCompressor();
    compressor.connect(ctx.destination);
    const mestre = ctx.createGain();
    mestre.gain.value = 0.9;
    mestre.connect(compressor);
    this.mestre = mestre;
    // Todas as vozes são agendadas; silenciar é só baixar o volume da voz (vale ao vivo).
    // `ganhos` fica em referência LOCAL: `parar()` (que zera `this.ganhos`) pode rodar durante o carregamento dos sons gravados abaixo.
    const ganhos = vozes.map((_, i) => {
      const g = ctx.createGain();
      g.gain.value = opcoes.volumes[i] ?? 1;
      g.connect(mestre);
      return g;
    });
    this.ganhos = ganhos;

    const seg = 60 / Math.max(opcoes.andamento, 1); // segundos por batida
    const aPartirDe = Math.max(0, partida.aPartirDe ?? 0);
    this.base = aPartirDe * seg;
    // Instrumentos gravados: carrega antes de marcar o início (a primeira vez demora; depois ficam guardados).
    const reais = await Promise.all(
      vozes.map((_, i) => {
        const pedido = opcoes.instrumentos[i];
        // Se o som gravado não carregar (pacote removido, sem arquivo), a voz toca na síntese padrão.
        return pedido && ehRealista(pedido) ? this.real(ctx, pedido, i, ganhos[i]).catch(() => null) : null;
      }),
    );
    this.inicio = ctx.currentTime + ATRASO_INICIAL;
    const inicio = this.inicio;
    let fim = 0;

    vozes.forEach((voz, i) => {
      const real = reais[i];
      if (real) {
        // Gravado: o smplr agenda cada nota (início e duração em segundos do relógio do AudioContext).
        for (const [t, dur, midi] of notasAPartirDe(voz.notas, aPartirDe)) {
          const ini = inicio + t * seg;
          const duracao = Math.max(dur * seg, 0.05);
          real.start({ note: midi + opcoes.transposicao, velocity: 90, time: ini, duration: duracao });
          fim = Math.max(fim, ini + duracao - inicio);
        }
        this.reaisAtivos.push(real);
        return;
      }
      const pedido = opcoes.instrumentos[i];
      const id: SinteticoId = pedido && pedido in INSTRUMENTOS ? (pedido as SinteticoId) : PADRAO;
      for (const [t, dur, midi] of notasAPartirDe(voz.notas, aPartirDe)) {
        const ini = inicio + t * seg;
        const duracao = Math.max(dur * seg, 0.05);
        this.fontes.push(...agendarNota(ctx, this.ondas, ganhos[i], id, midi + opcoes.transposicao, ini, duracao));
        fim = Math.max(fim, ini + duracao - inicio);
      }
    });

    return this.base + fim;
  }

  /** Segundos tocados desde o início do hino (congela durante a pausa). */
  decorrido(): number {
    return this.ctx ? this.base + Math.max(0, this.ctx.currentTime - this.inicio) : 0;
  }

  /**
   * Como `decorrido`, mas descontando o atraso da saída de áudio do aparelho: o que se OUVE agora, e não o que já foi
   * entregue ao hardware. Serve para o karaokê não acender a sílaba antes de ela soar. Na pausa, vale o `decorrido`.
   */
  audivel(): number {
    const ctx = this.ctx;
    if (!ctx) return 0;
    const atraso = ctx.state === "running" && Number.isFinite(ctx.outputLatency) ? Math.max(0, ctx.outputLatency) : 0;
    return Math.max(0, this.decorrido() - atraso);
  }

  async pausar() {
    await this.ctx?.suspend();
  }

  async continuar() {
    await this.ctx?.resume();
  }

  /** Ajusta o volume de uma voz enquanto toca (0 silencia). */
  volume(voz: number, valor: number) {
    const g = this.ganhos[voz];
    if (g && this.ctx) g.gain.setTargetAtTime(valor, this.ctx.currentTime, 0.015);
  }

  parar() {
    for (const o of this.fontes) {
      try {
        o.stop();
      } catch {
        /* já parado */
      }
    }
    this.fontes = [];
    for (const inst of this.reaisAtivos) {
      // `stop()` só cala as notas que já estão soando. As notas futuras ficam na fila do agendador do smplr e
      // seguiriam disparando no andamento antigo por cima do novo: é preciso esvaziar a fila também.
      try {
        inst.scheduler.stop();
      } catch {
        /* sem agendador */
      }
      try {
        inst.stop();
      } catch {
        /* já parado */
      }
    }
    this.reaisAtivos = [];
    this.ganhos = [];
    this.mestre?.disconnect();
    this.mestre = null;
  }
}
