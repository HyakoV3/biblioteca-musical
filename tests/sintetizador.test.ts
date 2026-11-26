import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PADRAO } from "../src/lib/instrumentos";
import { Sintetizador, notasAPartirDe, sinteticoParaTocar, type Nota, type Voz } from "../src/lib/sintetizador";

// AudioContext falso: guarda o que o sintetizador pede, para conferir posição, duração e retomada.
type Registro = { resume: number; suspend: number; osc: { t0?: number }[]; ctxs: FakeCtx[]; filtros: unknown[]; ondas: number };
let reg: Registro;

class FakeCtx {
  currentTime = 0;
  state = "running";
  outputLatency = 0;
  destination = {};
  constructor() {
    reg.ctxs.push(this);
  }
  async resume() {
    reg.resume++;
  }
  async suspend() {
    reg.suspend++;
  }
  async close() {
    this.state = "closed";
  }
  private no() {
    return { connect: (x: unknown) => x, disconnect() {} };
  }
  private param() {
    return { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, setTargetAtTime() {} };
  }
  createDynamicsCompressor() {
    return this.no();
  }
  createGain() {
    return { ...this.no(), gain: this.param() };
  }
  sampleRate = 44100;
  createPeriodicWave() {
    reg.ondas++;
    return {};
  }
  createBiquadFilter() {
    const f = { ...this.no(), type: "", Q: this.param(), frequency: { ...this.param(), exponentialRampToValueAtTime() {} } };
    reg.filtros.push(f);
    return f;
  }
  createOscillator() {
    const o = {
      ...this.no(),
      frequency: this.param(),
      detune: this.param(),
      setPeriodicWave() {},
      t0: undefined as number | undefined,
      start(t: number) {
        o.t0 = t;
      },
      stop() {},
    };
    reg.osc.push(o);
    return o;
  }
}

beforeEach(() => {
  reg = { resume: 0, suspend: 0, osc: [], ctxs: [], filtros: [], ondas: 0 };
  vi.stubGlobal("AudioContext", FakeCtx);
});
afterEach(() => vi.unstubAllGlobals());

const notas: Nota[] = [[0, 4, 60], [4, 4, 62], [8, 4, 64]];
const vozes: Voz[] = [{ nome: "S", notas }];
type Opcoes = Parameters<Sintetizador["tocar"]>[1];
const op = (andamento: number, extra: Partial<Opcoes> = {}): Opcoes => ({
  andamento,
  transposicao: 0,
  instrumentos: [PADRAO],
  volumes: [1],
  ...extra,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const interno = (s: Sintetizador) => s as any;

describe("notasAPartirDe (função pura)", () => {
  it("posição 0, negativa, NaN e além do fim", () => {
    expect(notasAPartirDe(notas, 0)).toEqual(notas);
    expect(notasAPartirDe(notas, -3)).toEqual(notas);
    expect(notasAPartirDe(notas, NaN)).toEqual(notas);
    expect(notasAPartirDe(notas, 12)).toEqual([]);
    expect(notasAPartirDe(notas, 99)).toEqual([]);
  });
  it("no meio de uma nota ela segue com a duração que sobra", () => {
    expect(notasAPartirDe(notas, 6)).toEqual([[0, 2, 62], [2, 4, 64]]);
    expect(notasAPartirDe(notas, 4)).toEqual([[0, 4, 62], [4, 4, 64]]);
  });
  it("não altera a entrada", () => {
    notasAPartirDe(notas, 6);
    expect(notas).toHaveLength(3);
  });
});

describe("Sintetizador", () => {
  it("pedir um ponto com o hino pausado num contexto que nasceu rodando o suspende (a tela diz pausado)", async () => {
    const s = new Sintetizador();
    await s.tocar(vozes, op(120), { aPartirDe: 4, pausado: true });
    expect(reg.suspend).toBe(1);
    expect(reg.resume).toBe(0);
    expect(reg.ctxs[0].state).toBe("running"); // o falso não muda o estado: o que importa é que o pedido de suspensão foi feito
  });
  it("pedir um ponto com o hino pausado num contexto já suspenso não suspende de novo", async () => {
    const s = new Sintetizador();
    await s.tocar(vozes, op(120));
    reg.ctxs[0].state = "suspended";
    reg.suspend = 0;
    await s.tocar(vozes, op(120), { aPartirDe: 4, pausado: true });
    expect(reg.suspend).toBe(0);
  });
  it("o contexto vale enquanto a saída e o modo são os mesmos, e é refeito (o velho fechado) quando a pessoa troca de saída", async () => {
    const guardado = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => void guardado.set(k, v) });
    let rota = "alto-falante";
    vi.stubGlobal("BmServico", { rotaDeSaida: () => rota });
    const s = new Sintetizador();
    await s.tocar(vozes, op(120));
    await s.tocar(vozes, op(120));
    expect(reg.ctxs.length).toBe(1);
    rota = "usb";
    await s.tocar(vozes, op(120));
    expect(reg.ctxs.length).toBe(2);
    expect((reg.ctxs[0] as unknown as { state: string }).state).toBe("closed");
    await s.tocar(vozes, op(120));
    expect(reg.ctxs.length).toBe(2);
    guardado.set("prefs.saida-audio", JSON.stringify({ usb: "estavel" }));
    await s.tocar(vozes, op(120));
    expect(reg.ctxs.length).toBe(3);
    s.parar();
  });

  it("toca do começo: duração, retomada do relógio e notas agendadas", async () => {
    const s = new Sintetizador();
    const dur = await s.tocar(vozes, op(60));
    expect(dur).toBeCloseTo(12, 9); // 12 batidas a 60 bpm
    expect(reg.resume).toBe(1);
    expect(reg.osc).toHaveLength(3);
  });

  it("metais passam por um filtro de abertura; órgão e palhetas, não", async () => {
    const s = new Sintetizador();
    await s.tocar(vozes, op(60, { instrumentos: ["trombone"] }));
    expect(reg.filtros).toHaveLength(3);
    // O Q do lowpass do Web Audio é em dB: o Butterworth (1/√2) é -3,01 dB; passar 0,707 daria um pico de ressonância.
    const q = (reg.filtros[0] as { Q: { value: number } }).Q.value;
    expect(q).toBeCloseTo(-3.0103, 3);
    reg.filtros.length = 0;
    await s.tocar(vozes, op(60, { instrumentos: ["fagote"] }));
    await s.tocar(vozes, op(60, { instrumentos: ["orgao_principal"] }));
    expect(reg.filtros).toHaveLength(0);
  });

  it("cria uma onda por (instrumento, altura), não por nota", async () => {
    const s = new Sintetizador();
    const repetidas: Voz[] = [{ nome: "S", notas: [[0, 1, 60], [1, 1, 60], [2, 1, 62], [3, 1, 60]] }];
    await s.tocar(repetidas, op(60, { instrumentos: ["oboe"] }));
    expect(reg.ondas).toBe(2); // 60 e 62
    await s.tocar(repetidas, op(60, { instrumentos: ["oboe"] })); // reagendar reaproveita
    expect(reg.ondas).toBe(2);
    await s.tocar(repetidas, op(60, { instrumentos: ["oboe"], transposicao: 2 })); // 62 e 64: só o 64 é novo
    expect(reg.ondas).toBe(3);
  });

  it("reagenda na pausa com outro andamento, a partir da posição", async () => {
    const s = new Sintetizador();
    await s.tocar(vozes, op(60));
    reg.osc.length = 0;
    const dur = await s.tocar(vozes, op(120), { aPartirDe: 6, pausado: true });
    expect(reg.resume).toBe(1); // reagendar na pausa NÃO retoma o relógio sozinho
    expect(dur).toBeCloseTo(6, 9); // 12 batidas a 120 bpm
    expect(s.decorrido()).toBeCloseTo(3, 9); // 6 batidas a 120 bpm
    expect(reg.osc).toHaveLength(2); // a nota que atravessa o ponto e a última

    reg.ctxs[0].currentTime = 1.1; // 1 s depois do início agendado (0 + 0,1 de atraso)
    expect(s.decorrido()).toBeCloseTo(4, 9);
  });

  it("reagendar no começo vale como tocar do começo; além do fim não sobra nada", async () => {
    const s = new Sintetizador();
    await s.tocar(vozes, op(60));
    let dur = await s.tocar(vozes, op(60, { transposicao: 2 }), { aPartirDe: 0, pausado: true });
    expect(dur).toBeCloseTo(12, 9);
    expect(s.decorrido()).toBeCloseTo(0, 9);
    reg.osc.length = 0;
    dur = await s.tocar(vozes, op(60), { aPartirDe: 12, pausado: true });
    expect(reg.osc).toHaveLength(0);
    expect(dur).toBeCloseTo(12, 9);
  });

  it("audivel() desconta a latência da saída, só enquanto o relógio roda", async () => {
    const s = new Sintetizador();
    await s.tocar(vozes, op(60));
    const ctx = reg.ctxs[0];
    ctx.currentTime = 2.1; // 2 s depois do início
    expect(s.audivel()).toBeCloseTo(2, 9);
    ctx.outputLatency = 0.15;
    expect(s.audivel()).toBeCloseTo(1.85, 9);
    ctx.outputLatency = Number.NaN;
    expect(s.audivel()).toBeCloseTo(2, 9);
    ctx.outputLatency = 0.15;
    ctx.state = "suspended"; // na pausa vale o decorrido
    expect(s.audivel()).toBeCloseTo(2, 9);
  });
});

describe("sinteticoParaTocar (AUD-003)", () => {
  it("o gravado que falhou cai no sintetizado equivalente, não no órgão principal", () => {
    expect(sinteticoParaTocar("real_flauta")).toBe("flauta");
    expect(sinteticoParaTocar("real_flauta_doce")).toBe("flauta_doce");
  });
  it("um sintetizado vale por ele mesmo; desconhecido ou ausente vai ao padrão", () => {
    expect(sinteticoParaTocar("flauta")).toBe("flauta");
    expect(sinteticoParaTocar("nao_existe")).toBe(PADRAO);
    expect(sinteticoParaTocar(undefined)).toBe(PADRAO);
  });
});

describe("audivel() na pausa (REP-007)", () => {
  it("congela o desconto de latência do instante da pausa em vez de zerá-lo", async () => {
    const s = new Sintetizador();
    await s.tocar(vozes, op(60));
    const ctx = reg.ctxs[0];
    ctx.currentTime = 2.1;
    ctx.outputLatency = 0.15;
    await s.pausar();
    ctx.state = "suspended";
    expect(s.audivel()).toBeCloseTo(1.85, 9); // o mesmo valor de antes da pausa
    ctx.outputLatency = 0.4; // a latência medida na pausa não muda o que se mostra
    expect(s.audivel()).toBeCloseTo(1.85, 9);
    await s.continuar();
    ctx.state = "running";
    expect(s.audivel()).toBeCloseTo(1.6, 9); // rodando de novo: vale a latência de agora (0,4)
  });
});

describe("parar() com vozes gravadas (smplr)", () => {
  // `stop()` do smplr só cala as notas que já soam; as futuras ficam na fila do agendador e seguiriam disparando no
  // andamento antigo por cima do novo. Por isso parar() tem de esvaziar a fila (scheduler.stop()) antes.
  it("esvazia a fila de cada gravado e depois cala as vozes", () => {
    const chamadas: string[] = [];
    const falso = (nome: string) => ({
      scheduler: { stop: () => chamadas.push(`${nome}:fila`) },
      stop: () => chamadas.push(`${nome}:vozes`),
    });
    const s = interno(new Sintetizador());
    s.reaisAtivos = [falso("a"), falso("b")];
    s.parar();
    expect(chamadas).toEqual(["a:fila", "a:vozes", "b:fila", "b:vozes"]);
    expect(s.reaisAtivos).toHaveLength(0);
  });

  it("um gravado sem agendador não impede de calar nem de parar os outros", () => {
    const chamadas: string[] = [];
    const sem = { stop: () => chamadas.push("c:vozes") };
    const falso = {
      scheduler: { stop: () => chamadas.push("d:fila") },
      stop: () => chamadas.push("d:vozes"),
    };
    const s = interno(new Sintetizador());
    s.reaisAtivos = [sem, falso];
    s.parar();
    expect(chamadas).toEqual(["c:vozes", "d:fila", "d:vozes"]);
  });
});
