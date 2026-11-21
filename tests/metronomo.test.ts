import { afterEach, describe, expect, it, vi } from "vitest";
import { BPM_MAX, BPM_MIN, COMPASSOS, Metronomo, agendar, compassoValido, ladoDoClique, posicaoDoPendulo, limitarBpm, novoEstado, progressoNoCompasso, tempoAceso, type Clique, type EstadoAgenda } from "../src/lib/metronomo";

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
    const a = agendar(novoEstado(), { bpm: 120, compasso: 4, agora: 0, janela: 0.6 }); // cliques em 0.1 e 0.6 (índices 0 e 1): o de 1.1 ainda não
    const tarde = agendar(a.estado, { bpm: 120, compasso: 4, agora: 3.05, janela: 0.1 });
    for (const c of tarde.cliques) expect(c.tempo).toBeGreaterThanOrEqual(3.05); // nada no passado
    expect(tarde.cliques).toHaveLength(1); // a grade (0.1 + n * 0.5) tem exatamente um clique em [3.05, 3.15): 3.1, o índice 2
    // a fase: a grade segue t0 + n*0.5, e o índice é o n do compasso
    const t0 = a.cliques[0].tempo;
    for (const c of tarde.cliques) {
      const n = Math.round((c.tempo - t0) / 0.5);
      expect(Math.abs(c.tempo - (t0 + n * 0.5))).toBeLessThan(1e-9);
      expect(c.indice).toBe(n % 4);
    }
  });

  it("entradas ruins não travam nem estouram: janela infinita, andamento enorme, atraso NaN, compasso fracionado, índice NaN", () => {
    expect(agendar(novoEstado(), { bpm: 120, compasso: 4, agora: 0, janela: Infinity }).cliques).toEqual([]);
    expect(agendar(novoEstado(), { bpm: 120, compasso: 4, agora: 0, janela: -1 }).cliques).toEqual([]);
    const enorme = agendar(novoEstado(), { bpm: 1e300, compasso: 4, agora: 0, janela: 1 }); // limitado a 240: termina, com intervalos de 0,25 s
    expect(enorme.cliques.length).toBeGreaterThan(0);
    expect(enorme.cliques.length).toBeLessThanOrEqual(64);
    const longa = agendar(novoEstado(), { bpm: 240, compasso: 4, agora: 0, janela: 1e9 });
    expect(longa.cliques.length).toBeLessThanOrEqual(64); // teto por chamada
    const nan = agendar(novoEstado(), { bpm: 120, compasso: 4, agora: 5, janela: 0.1, atrasoInicial: NaN });
    expect(nan.cliques[0].tempo).toBeCloseTo(5.1, 9);
    expect(agendar(novoEstado(), { bpm: 120, compasso: 2.5, agora: 0, janela: 1 }).cliques).toEqual([]);
    const ruim = agendar({ ultimo: 1, indice: NaN, n: NaN }, { bpm: 120, compasso: 4, agora: 1, janela: 1 });
    expect(ruim.cliques.every((c) => Number.isInteger(c.indice))).toBe(true);
    expect(agendar({ ultimo: NaN, indice: 0, n: 0 }, { bpm: 120, compasso: 4, agora: 1, janela: 0.2 }).cliques[0].tempo).toBeCloseTo(1.1, 9);
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
    { tempo: 1, indice: 0, n: 0 },
    { tempo: 1.5, indice: 1, n: 1 },
    { tempo: 2, indice: 2, n: 2 },
    { tempo: 2.5, indice: 3, n: 3 },
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

describe("bolinha depois de trocar o andamento", () => {
  it("usa o espaçamento até o próximo clique da fila, não o andamento novo (sem travar nem saltar)", () => {
    const fila: Clique[] = [{ tempo: 10, indice: 0, n: 0 }, { tempo: 12, indice: 1, n: 1 }]; // soaram a 30 bpm (2 s); o andamento atual já é 240
    expect(progressoNoCompasso(fila, 11, 240, 4)).toBeCloseTo(0.125, 9); // metade dos 2 s do 1º tempo
  });
});

describe("pêndulo", () => {
  const fila: Clique[] = [
    { tempo: 1, indice: 0, n: 0 },
    { tempo: 1.5, indice: 1, n: 1 },
    { tempo: 2, indice: 2, n: 2 },
    { tempo: 2.5, indice: 0, n: 3 }, // compasso de 3: o 1º tempo seguinte cai do lado direito, como num metrônomo de verdade
  ];
  it("antes do primeiro clique não há posição nem lado", () => {
    expect(posicaoDoPendulo(fila, 0.5, 120)).toBeNull();
    expect(ladoDoClique(fila, 0.5)).toBeNull();
  });
  it("cada clique é uma ponta (par à esquerda, ímpar à direita) e entre dois cliques a bolinha vai de uma ponta à outra", () => {
    expect(posicaoDoPendulo(fila, 1, 120)).toBeCloseTo(0, 9);
    expect(posicaoDoPendulo(fila, 1.25, 120)).toBeCloseTo(0.5, 9);
    expect(posicaoDoPendulo(fila, 1.5, 120)).toBeCloseTo(1, 9);
    expect(posicaoDoPendulo(fila, 1.75, 120)).toBeCloseTo(0.5, 9); // voltando
    expect(posicaoDoPendulo(fila, 2, 120)).toBeCloseTo(0, 9);
    expect(posicaoDoPendulo(fila, 2.5, 120)).toBeCloseTo(1, 9);
    expect(ladoDoClique(fila, 1.2)).toBe(0);
    expect(ladoDoClique(fila, 1.5)).toBe(1);
  });
  it("sem salto nem volta ao começo: a posição varia pouco entre instantes próximos, mesmo na virada do compasso", () => {
    let antes = posicaoDoPendulo(fila, 1, 120)!;
    for (let a = 1.01; a < 2.9; a += 0.01) {
      const p = posicaoDoPendulo(fila, a, 120)!;
      expect(Math.abs(p - antes)).toBeLessThan(0.05);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
      antes = p;
    }
  });
  it("depois de batidas perdidas o pêndulo não salta: o intervalo cobre várias batidas e a bolinha faz o mesmo número de idas e vindas", () => {
    for (const perdidas of [1, 2, 3]) {
      const fila: Clique[] = [{ tempo: 10, indice: 0, n: 4 }, { tempo: 10 + 0.5 * (1 + perdidas), indice: (1 + perdidas) % 4, n: 5 + perdidas }];
      let antes = posicaoDoPendulo(fila, 10, 120)!;
      expect(antes).toBeCloseTo(0, 9); // n = 4: esquerda
      for (let a = 10.01; a < 10 + 0.5 * (1 + perdidas); a += 0.01) {
        const p = posicaoDoPendulo(fila, a, 120)!;
        expect(Math.abs(p - antes)).toBeLessThan(0.05); // sem salto de largura total
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
        antes = p;
      }
      expect(posicaoDoPendulo(fila, 10 + 0.5 * (1 + perdidas), 120)).toBeCloseTo((5 + perdidas) % 2, 9); // a ponta certa do clique seguinte
    }
  });

  it("o agendador numera os cliques em sequência e mantém a numeração ao pular batidas perdidas", () => {
    const a = agendar(novoEstado(), { bpm: 120, compasso: 3, agora: 0, janela: 1.2 });
    expect(a.cliques.map((c) => c.n)).toEqual([0, 1, 2]);
    expect(a.cliques.map((c) => c.indice)).toEqual([0, 1, 2]);
    const tarde = agendar(a.estado, { bpm: 120, compasso: 3, agora: 3.05, janela: 0.1 });
    const t0 = a.cliques[0].tempo;
    const k = Math.round((tarde.cliques[0].tempo - t0) / 0.5);
    expect(tarde.cliques[0].n).toBe(k); // o número do clique é a posição na grade desde o começo
    expect(tarde.cliques[0].indice).toBe(k % 3);
  });
});

describe("limites", () => {
  it("limita o andamento a 30..240 e arredonda", () => {
    expect(limitarBpm(10)).toBe(BPM_MIN);
    expect(limitarBpm(999)).toBe(BPM_MAX);
    expect(limitarBpm(100.6)).toBe(101);
    expect(limitarBpm(NaN)).toBe(60);
  });
  it("os compassos são 1, 2, 3, 4, 5, 6, 7, 9 e 12 tempos (os que o hinário usa, mais 1, 5 e 7 para estudar)", () => {
    expect([...COMPASSOS]).toEqual([1, 2, 3, 4, 5, 6, 7, 9, 12]);
    expect([1, 2, 3, 4, 5, 6, 7, 9, 12].every(compassoValido)).toBe(true);
    expect([0, 8, 10, 11, 13, "4", null, undefined].some(compassoValido)).toBe(false);
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
  afterEach(() => vi.useRealTimers());

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
    m.fechar();
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
    expect(oscs.length).toBe(antes + 1);
    expect(novo.frequency.value).toBe(1600); // recomeçou no 1º tempo (forte)
    expect(m.compasso).toBe(3);
    m.fechar();
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
    m.fechar();
  });

  it("fechar devolve o áudio (fecha o contexto)", async () => {
    vi.useFakeTimers();
    const { ctx } = contextoFalso();
    const m = new Metronomo({ contexto: () => ctx as never });
    await m.iniciar();
    m.fechar();
    vi.advanceTimersByTime(200);
    expect(ctx.close).toHaveBeenCalled();
  });

  it("se o resume() volta com o contexto ainda suspenso, não liga e avisa (WebKit)", async () => {
    const { ctx, oscs } = contextoFalso();
    ctx.resume = vi.fn(async () => {});
    const m = new Metronomo({ contexto: () => ctx as never });
    const avisou = vi.fn();
    m.aoInterromper = avisou;
    await m.iniciar();
    expect(m.ligado).toBe(false);
    expect(avisou).toHaveBeenCalledTimes(1);
    expect(oscs).toHaveLength(0);
  });

  it("o andamento fica entre 30 e 240 e só avisa a tela quando muda", () => {
    const m = new Metronomo();
    const mudou = vi.fn();
    m.aoMudar = mudou;
    m.definirBpm(240);
    m.definirBpm(500);
    m.definirBpm(240);
    expect(mudou).toHaveBeenCalledTimes(1);
    expect(m.bpm).toBe(240);
    m.definirBpm(5);
    expect(m.bpm).toBe(30);
  });
});
