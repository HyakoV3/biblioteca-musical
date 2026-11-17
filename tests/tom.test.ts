import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TomSustentado } from "../src/lib/tom";

// Um AudioContext de mentira, que deixa o teste decidir QUANDO o `resume()` termina (o áudio real só inicia depois de um gesto) e registra
// o que o tom agenda. Só serve para a lógica de ordem e de tempo do `tom.ts`; o som de verdade é conferido no teste de ponta a ponta.
class ParamFalso {
  chamadas: string[] = [];
  value = 0;
  setValueAtTime(v: number) {
    this.chamadas.push(`set:${v}`);
  }
  linearRampToValueAtTime(v: number) {
    this.chamadas.push(`rampa:${v}`);
  }
  cancelScheduledValues() {
    this.chamadas.push("cancela");
  }
  setTargetAtTime(v: number) {
    this.chamadas.push(`alvo:${v}`);
  }
}
class OscilatorFalso {
  iniciou = 0;
  parou = 0;
  frequency = { value: 0 };
  setPeriodicWave() {}
  connect(destino: unknown) {
    return destino;
  }
  start() {
    this.iniciou++;
  }
  stop() {
    this.parou++;
  }
}
class GanhoFalso {
  gain = new ParamFalso();
  connect(destino: unknown) {
    return destino;
  }
}
class ContextoFalso {
  static criados: ContextoFalso[] = [];
  state = "suspended";
  currentTime = 0;
  destination = {};
  osciladores: OscilatorFalso[] = [];
  ganhos: GanhoFalso[] = [];
  private pendentes: (() => void)[] = [];
  fechou = false;
  constructor() {
    ContextoFalso.criados.push(this);
  }
  /** Quem chamou `resume()` fica esperando até o teste chamar `terminarResume()`, que libera todos de uma vez. */
  resume() {
    return new Promise<void>((ok) => this.pendentes.push(ok));
  }
  terminarResume() {
    this.state = "running";
    for (const ok of this.pendentes.splice(0)) ok();
  }
  createPeriodicWave() {
    return {};
  }
  createOscillator() {
    const o = new OscilatorFalso();
    this.osciladores.push(o);
    return o;
  }
  createGain() {
    const g = new GanhoFalso();
    this.ganhos.push(g);
    return g;
  }
  createAnalyser() {
    return { fftSize: 0, connect() {} };
  }
  close() {
    this.fechou = true;
    this.state = "closed";
    return Promise.resolve();
  }
}
const ctx = () => ContextoFalso.criados.at(-1)!;
const iniciados = () => ContextoFalso.criados.flatMap((c) => c.osciladores).reduce((n, o) => n + o.iniciou, 0);

beforeEach(() => {
  ContextoFalso.criados = [];
  vi.useFakeTimers();
  vi.stubGlobal("AudioContext", ContextoFalso);
  vi.stubGlobal("window", {}); // a sonda de teste (só em desenvolvimento) grava em window
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("TomSustentado", () => {
  it("tocar inicia um oscilador na frequência pedida, e parar o solta", async () => {
    const tom = new TomSustentado();
    const p = tom.tocar(440);
    ctx().terminarResume();
    await p;
    expect(iniciados()).toBe(1);
    expect(ctx().osciladores[0].frequency.value).toBe(440);
    expect(tom.tocando).toBe(true);
    tom.parar();
    expect(tom.tocando).toBe(false);
    expect(ctx().osciladores[0].parou).toBe(1);
  });

  it("parar() durante a espera do áudio: o tom NÃO começa depois (corrida)", async () => {
    const tom = new TomSustentado();
    const p = tom.tocar(440); // o resume() ainda não terminou
    tom.parar(); // a pessoa apertou de novo, ou saiu da aba
    ctx().terminarResume();
    await p;
    expect(iniciados()).toBe(0);
    expect(tom.tocando).toBe(false);
  });

  it("fechar() durante a espera do áudio: nada começa no contexto que vai ser fechado (corrida)", async () => {
    const tom = new TomSustentado();
    const p = tom.tocar(440);
    const antigo = ctx();
    tom.fechar();
    antigo.terminarResume();
    await p;
    expect(iniciados()).toBe(0);
    expect(tom.tocando).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(antigo.fechou).toBe(true); // o contexto é devolvido
  });

  it("dois pedidos seguidos: só o último toca (o primeiro, ainda esperando o áudio, fica sem efeito)", async () => {
    const tom = new TomSustentado();
    const primeiro = tom.tocar(440);
    const segundo = tom.tocar(311);
    ctx().terminarResume();
    await Promise.all([primeiro, segundo]);
    expect(iniciados()).toBe(1);
    expect(ctx().osciladores[0].frequency.value).toBe(311);
  });

  it("depois de fechar, tocar de novo cria outro contexto", async () => {
    const tom = new TomSustentado();
    let p = tom.tocar(440);
    ctx().terminarResume();
    await p;
    tom.fechar();
    vi.advanceTimersByTime(1000);
    p = tom.tocar(220);
    expect(ContextoFalso.criados).toHaveLength(2);
    ctx().terminarResume();
    await p;
    expect(tom.tocando).toBe(true);
    expect(ctx().osciladores[0].frequency.value).toBe(220);
  });
});
