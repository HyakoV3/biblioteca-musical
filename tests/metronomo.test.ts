import { describe, expect, it, vi } from "vitest";
import { BPM_MAX, BPM_MIN, Metronomo, agendar, compassoValido, limitarBpm, novoEstado, progressoNoCompasso, tempoAceso, type Clique, type EstadoAgenda } from "../src/lib/metronomo";

/** Roda o agendador como o temporizador de 25 ms faria, até `fim` (s), e devolve todos os cliques. */
function simular(p: { bpm: number | ((t: number) => number); compasso: number | ((t: number) => number); fim: number; passo?: number; janela?: number }) {
  let estado: EstadoAgenda = novoEstado();
  const todos: Clique[] = [];
  for (let agora = 0; agora <= p.fim; agora += p.passo ?? 0.025) {
    const r = agendar(estado, {
      bpm: typeof p.bpm === "function" ? p.bpm(agora) : p.bpm,
      compasso: typeof p.compasso === "function" ? p.compasso(agora) : p.compasso,
      agora,
      janela: p.janela ?? 0.1,
    });
    estado = r.estado;
    todos.push(...r.cliques);
  }
  return todos;
}

describe("agendar (função pura)", () => {
  it("o primeiro clique espera o atraso inicial e é o 1º tempo (forte)", () => {
    const r = agendar(novoEstado(), { bpm: 120, compasso: 4, agora: 10, janela: 0.1 });
    expect(r.cliques).toHaveLength(1);
    expect(r.cliques[0].indice).toBe(0);
    expect(r.cliques[0].tempo).toBeCloseTo(10.1, 9);
  });

  it("1000 cliques sem deriva: t_n = t0 + n * período, e o índice dá a volta no compasso", () => {
    const cliques = simular({ bpm: 240, compasso: 3, fim: 260 });
    expect(cliques.length).toBeGreaterThanOrEqual(1000);
    const t0 = cliques[0].tempo;
    const p = 60 / 240;
    cliques.slice(0, 1000).forEach((c, n) => {
      expect(Math.abs(c.tempo - (t0 + n * p))).toBeLessThan(1e-9);
      expect(c.indice).toBe(n % 3);
    });
  });

  it("nenhum clique sai repetido nem no passado quando o temporizador anda no passo normal", () => {
    let estado = novoEstado();
    const vistos = new Set<number>();
    for (let agora = 0; agora < 20; agora += 0.025) {
      const r = agendar(estado, { bpm: 200, compasso: 4, agora, janela: 0.1 });
      estado = r.estado;
      for (const c of r.cliques) {
        expect(c.tempo).toBeGreaterThanOrEqual(agora);
        expect(vistos.has(c.tempo)).toBe(false);
        vistos.add(c.tempo);
      }
    }
  });

  it("trocar o andamento vale a partir do primeiro clique ainda não agendado (de 30 para 120 logo depois de um clique)", () => {
    const a = agendar(novoEstado(), { bpm: 30, compasso: 4, agora: 0, janela: 0.1 });
    const ultimo = a.cliques[a.cliques.length - 1].tempo;
    const b = agendar(a.estado, { bpm: 120, compasso: 4, agora: ultimo + 0.2, janela: 1 });
    expect(b.cliques[0].tempo).toBeCloseTo(ultimo + 0.5, 9); // 60/120, e não 60/30 = 2 s depois
    expect(b.cliques[1].tempo - b.cliques[0].tempo).toBeCloseTo(0.5, 9);
  });

  it("o que já estava na janela soa como estava: só os cliques seguintes usam o andamento novo", () => {
    let estado = novoEstado();
    const todos: Clique[] = [];
    for (let agora = 0; agora < 6; agora += 0.025) {
      const r = agendar(estado, { bpm: agora < 3 ? 60 : 120, compasso: 4, agora, janela: 0.1 });
      estado = r.estado;
      todos.push(...r.cliques);
    }
    const depois = todos.filter((c) => c.tempo > 3.2);
    for (let i = 1; i < depois.length; i++) expect(depois[i].tempo - depois[i - 1].tempo).toBeCloseTo(0.5, 9);
  });

  it("depois de 3 s sem o temporizador acordar, pula as batidas perdidas (sem rajada) e mantém a fase do compasso", () => {
    const a = agendar(novoEstado(), { bpm: 120, compasso: 4, agora: 0, janela: 0.6 }); // cliques em 0.1, 0.6 (índices 0 e 1)... o 3º ainda não
    const tarde = agendar(a.estado, { bpm: 120, compasso: 4, agora: 3.05, janela: 0.1 });
    for (const c of tarde.cliques) expect(c.tempo).toBeGreaterThanOrEqual(3.05); // nada no passado
    expect(tarde.cliques.length).toBeLessThanOrEqual(1);
    // a fase: a grade segue t0 + n*0.5, e o índice é o n do compasso
    const t0 = a.cliques[0].tempo;
    for (const c of tarde.cliques) {
      const n = Math.round((c.tempo - t0) / 0.5);
      expect(Math.abs(c.tempo - (t0 + n * 0.5))).toBeLessThan(1e-9);
      expect(c.indice).toBe(n % 4);
    }
  });

  it("andamento e compasso inválidos não agendam nada", () => {
    expect(agendar(novoEstado(), { bpm: 0, compasso: 4, agora: 0, janela: 1 }).cliques).toEqual([]);
    expect(agendar(novoEstado(), { bpm: NaN, compasso: 4, agora: 0, janela: 1 }).cliques).toEqual([]);
    expect(agendar(novoEstado(), { bpm: 100, compasso: 0, agora: 0, janela: 1 }).cliques).toEqual([]);
  });

  it("janela maior (escondido) agenda mais à frente de uma vez", () => {
    const curta = agendar(novoEstado(), { bpm: 120, compasso: 4, agora: 0, janela: 0.1 }).cliques.length;
    const longa = agendar(novoEstado(), { bpm: 120, compasso: 4, agora: 0, janela: 2 }).cliques.length;
    expect(longa).toBeGreaterThan(curta);
    expect(longa).toBe(4);
  });
});

describe("bolinha", () => {
  const fila: Clique[] = [
    { tempo: 1, indice: 0 },
    { tempo: 1.5, indice: 1 },
    { tempo: 2, indice: 2 },
    { tempo: 2.5, indice: 3 },
  ];
  it("antes do primeiro clique não há posição", () => {
    expect(progressoNoCompasso(fila, 0.9, 120, 4)).toBeNull();
    expect(tempoAceso(fila, 0.9)).toBeNull();
  });
  it("desliza de 0 a 1 ao longo do compasso e passa pelas marcas dos tempos no clique", () => {
    expect(progressoNoCompasso(fila, 1, 120, 4)).toBeCloseTo(0, 9);
    expect(progressoNoCompasso(fila, 1.25, 120, 4)).toBeCloseTo(0.125, 9);
    expect(progressoNoCompasso(fila, 1.5, 120, 4)).toBeCloseTo(0.25, 9);
    expect(progressoNoCompasso(fila, 2.5, 120, 4)).toBeCloseTo(0.75, 9);
    expect(progressoNoCompasso(fila, 2.99, 120, 4)!).toBeGreaterThan(0.95);
    expect(progressoNoCompasso(fila, 2.99, 120, 4)!).toBeLessThanOrEqual(1);
  });
  it("o tempo aceso é o do último clique que já soou", () => {
    expect(tempoAceso(fila, 1.49)).toBe(0);
    expect(tempoAceso(fila, 1.5)).toBe(1);
    expect(tempoAceso(fila, 2.6)).toBe(3);
  });
});

describe("limites", () => {
  it("limita o andamento a 30..240 e arredonda", () => {
    expect(limitarBpm(10)).toBe(BPM_MIN);
    expect(limitarBpm(999)).toBe(BPM_MAX);
    expect(limitarBpm(100.6)).toBe(101);
    expect(limitarBpm(NaN)).toBe(60);
  });
  it("só 2, 3, 4 e 6 tempos", () => {
    expect([2, 3, 4, 6].every(compassoValido)).toBe(true);
    expect([1, 5, 8, "4", null, undefined].some(compassoValido)).toBe(false);
  });
});

// ---- a casca, com um AudioContext falso ----
class OscFalso {
  frequency = { value: 0 };
  inicio: number | null = null;
  fim: number | null = null;
  desconectado = false;
  connect(n: unknown) {
    return n;
  }
  disconnect() {
    this.desconectado = true;
  }
  start(t: number) {
    this.inicio = t;
  }
  stop(t: number) {
    this.fim = t;
  }
}
function ganhoFalso() {
  return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: (n: unknown) => n, disconnect() {} };
}
function contextoFalso() {
  const oscs: OscFalso[] = [];
  const ctx = {
    currentTime: 0,
    state: "suspended" as string,
    outputLatency: 0,
    destination: {},
    onstatechange: null as (() => void) | null,
    resume: vi.fn(async () => {
      ctx.state = "running";
    }),
    close: vi.fn(async () => {
      ctx.state = "closed";
    }),
    createOscillator: () => {
      const o = new OscFalso();
      oscs.push(o);
      return o;
    },
    createGain: ganhoFalso,
  };
  return { ctx, oscs };
}

describe("Metronomo (casca)", () => {
  it("não cria o áudio antes de iniciar (o gesto da pessoa)", () => {
    const criar = vi.fn();
    new Metronomo({ contexto: criar as never });
    expect(criar).not.toHaveBeenCalled();
  });

  it("iniciar agenda o 1º clique forte e parar cancela os que ainda não soaram", async () => {
    vi.useFakeTimers();
    const { ctx, oscs } = contextoFalso();
    const m = new Metronomo({ contexto: () => ctx as never, escondida: () => true });
    m.definirBpm(120);
    await m.iniciar();
    expect(m.ligado).toBe(true);
    expect(oscs.length).toBe(4); // janela escondida de 2 s a 120 bpm
    expect(oscs[0].frequency.value).toBeGreaterThan(oscs[1].frequency.value); // o forte é mais agudo
    m.parar();
    expect(m.ligado).toBe(false);
    expect(oscs.every((o) => o.fim === 0 && o.desconectado)).toBe(true); // nenhum clique agendado sobra
    vi.useRealTimers();
  });

  it("mudar o compasso ligado recomeça no 1º tempo e cancela os cliques com o acento antigo", async () => {
    vi.useFakeTimers();
    const { ctx, oscs } = contextoFalso();
    const m = new Metronomo({ contexto: () => ctx as never, escondida: () => false });
    m.definirBpm(120);
    await m.iniciar();
    const antes = oscs.length;
    ctx.currentTime = 0.02;
    m.definirCompasso(3);
    expect(oscs.slice(0, antes).every((o) => o.desconectado)).toBe(true);
    ctx.currentTime = 0.05;
    vi.advanceTimersByTime(25);
    const novo = oscs[oscs.length - 1];
    expect(novo).not.toBe(oscs[antes - 1]);
    expect(m.compasso).toBe(3);
    m.fechar();
    vi.useRealTimers();
  });

  it("parar antes de o áudio acordar descarta o iniciar que esperava", async () => {
    const { ctx, oscs } = contextoFalso();
    let liberar: () => void = () => {};
    ctx.resume = vi.fn(() => new Promise<void>((ok) => (liberar = () => ((ctx.state = "running"), ok()))));
    const m = new Metronomo({ contexto: () => ctx as never });
    const p = m.iniciar();
    m.parar();
    liberar();
    await p;
    expect(m.ligado).toBe(false);
    expect(oscs).toHaveLength(0);
  });

  it("o sistema tirar o áudio com o metrônomo ligado para e avisa", async () => {
    vi.useFakeTimers();
    const { ctx } = contextoFalso();
    const m = new Metronomo({ contexto: () => ctx as never });
    const avisou = vi.fn();
    m.aoInterromper = avisou;
    await m.iniciar();
    ctx.state = "suspended";
    ctx.onstatechange?.();
    expect(m.ligado).toBe(false);
    expect(avisou).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("fechar devolve o áudio (fecha o contexto)", async () => {
    vi.useFakeTimers();
    const { ctx } = contextoFalso();
    const m = new Metronomo({ contexto: () => ctx as never });
    await m.iniciar();
    m.fechar();
    vi.advanceTimersByTime(200);
    expect(ctx.close).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("o andamento fica entre 30 e 240", () => {
    const m = new Metronomo();
    m.definirBpm(5);
    expect(m.bpm).toBe(30);
    m.definirBpm(500);
    expect(m.bpm).toBe(240);
  });
});
