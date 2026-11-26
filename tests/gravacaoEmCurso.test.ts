import { beforeEach, describe, expect, it, vi } from "vitest";
import { GravacaoEmCurso, guardarComPrazo, type Dependencias, type Resultado } from "../src/lib/gravacaoEmCurso.svelte";
import type { Gravacao, Gravador } from "../src/lib/gravador";
import { LimiteEstourado, type MetaGravacao } from "../src/lib/gravacoes";

// A gravação em curso (ARQ-003, GRV-001, AND-002) com tudo de fora trocado por falsos: o gravador, o armazenamento, o serviço do Android, a página e o relógio.
vi.stubGlobal("URL", { createObjectURL: () => "blob:falso", revokeObjectURL: vi.fn() });

const meta = (id = "m1"): MetaGravacao => ({ id, criadaEm: 1, segundos: 2, tipo: "audio/webm", bytes: 3 });
const gravacao = (): Gravacao => ({ url: "blob:falso", blob: new Blob([new Uint8Array(3)]), tipo: "audio/webm", bytes: 3, segundos: 2 });

class GravadorFalso {
  tipo = "audio/webm";
  medidorAtivo = true;
  aoInterromper: (() => void) | null = null;
  aoPedaco: ((i: number, b: Blob) => void) | null = null;
  falhaAoIniciar: unknown = null;
  entregue: Gravacao | null = gravacao();
  soltou = 0;
  async iniciar() {
    if (this.falhaAoIniciar) throw this.falhaAoIniciar;
    return "desligado" as const;
  }
  async parar() {
    return this.entregue;
  }
  soltar() {
    this.soltou++;
  }
  nivel() {
    return 0;
  }
}

function montar(sobrescrever: Partial<Dependencias> = {}) {
  const g = new GravadorFalso();
  const chamadas: string[] = [];
  let escondida = false;
  const ouvintes = { parar: null as null | (() => void), falhou: null as null | (() => void), pagina: null as null | (() => void) };
  const pedacos: [string, number][] = [];
  const armazenamento = {
    salvar: vi.fn(async () => meta()),
    abrirSessao: vi.fn(async () => "sessao-1"),
    guardarPedaco: vi.fn(async (id: string, i: number) => void pedacos.push([id, i])),
    descartarSessao: vi.fn(async () => {}),
    recuperarSessoes: vi.fn(async () => [] as MetaGravacao[]),
  };
  let protegida = true;
  const deps: Dependencias = {
    criarGravador: () => g as unknown as Gravador,
    armazenamento,
    lerContexto: () => null,
    foneConectado: () => true,
    calarSons: () => void chamadas.push("calar"),
    servico: {
      ligar: () => (chamadas.push("ligar"), protegida),
      desligar: () => void chamadas.push("desligar"),
      aoParar: (f) => ((ouvintes.parar = f), () => (ouvintes.parar = null)),
      aoFalhar: (f) => ((ouvintes.falhou = f), () => (ouvintes.falhou = null)),
    },
    agora: () => Date.now(),
    pagina: { escondida: () => escondida, aoMudar: (f) => ((ouvintes.pagina = f), () => (ouvintes.pagina = null)) },
    ...sobrescrever,
  };
  const c = new GravacaoEmCurso(deps);
  const resultados: Resultado[] = [];
  c.aoTerminar = (r) => resultados.push(r);
  return { c, g, armazenamento, chamadas, ouvintes, pedacos, resultados, esconder: (v: boolean) => (escondida = v), semProtecao: () => (protegida = false) };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

describe("guardarComPrazo", () => {
  it("guardada dentro do prazo", async () => {
    expect(await guardarComPrazo(Promise.resolve(meta()))).toEqual({ guardada: true, meta: meta() });
  });

  it("estourou o prazo: erro próprio (sem comparar texto) e a escrita tardia segue em `depois`", async () => {
    let terminar!: (m: MetaGravacao) => void;
    const salvando = new Promise<MetaGravacao>((ok) => (terminar = ok));
    const p = guardarComPrazo(salvando, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    const r = await p;
    expect(r).toMatchObject({ guardada: false, demorou: true });
    terminar(meta("tarde"));
    if (!r.guardada) expect(await r.depois).toEqual(meta("tarde"));
    expect(new LimiteEstourado("x")).toBeInstanceOf(Error);
  });

  it("falhou (não demorou): demorou é falso, mesmo que a mensagem seja igual à do prazo", async () => {
    const r = await guardarComPrazo(Promise.reject(new Error("o armazenamento demorou demais para guardar a gravação")));
    expect(r).toMatchObject({ guardada: false, demorou: false });
  });
});

describe("gravação em curso", () => {
  it("iniciar liga o serviço e a sessão de recuperação; os pedaços vão sendo guardados", async () => {
    const { c, g, chamadas, pedacos, armazenamento } = montar();
    const r = await c.iniciar("desligado");
    expect(r).toEqual({ cancelada: false, erro: null, filtroFalhou: null });
    expect(c.gravando).toBe(true);
    expect(c.protegida).toBe(true);
    expect(chamadas).toEqual(["ligar"]);
    expect(armazenamento.abrirSessao).toHaveBeenCalledWith("audio/webm", null);
    await vi.advanceTimersByTimeAsync(0);
    g.aoPedaco?.(0, new Blob([new Uint8Array(1)]));
    g.aoPedaco?.(1, new Blob([new Uint8Array(1)]));
    await vi.advanceTimersByTimeAsync(0);
    expect(pedacos).toEqual([["sessao-1", 0], ["sessao-1", 1]]);
  });

  it("parar guarda a gravação, avisa a tela, apaga a sessão e solta o serviço", async () => {
    const { c, chamadas, resultados, armazenamento } = montar();
    await c.iniciar("desligado");
    await c.parar();
    expect(c.gravando).toBe(false);
    expect(chamadas).toEqual(["ligar", "desligar"]);
    expect(resultados).toEqual([{ tipo: "guardada", meta: meta() }]);
    await vi.advanceTimersByTimeAsync(0);
    expect(armazenamento.descartarSessao).toHaveBeenCalledWith("sessao-1");
  });

  it("sem fone, calar os sons antes de gravar; com fone, não", async () => {
    const sem = montar({ foneConectado: () => false });
    await sem.c.iniciar("desligado");
    expect(sem.chamadas[0]).toBe("calar");
    const com = montar();
    await com.c.iniciar("desligado");
    expect(com.chamadas).not.toContain("calar");
  });

  it("erro do microfone: não começa e diz o motivo", async () => {
    const { c, g } = montar();
    g.falhaAoIniciar = new DOMException("negada", "NotAllowedError");
    const r = await c.iniciar("desligado");
    expect(r).toMatchObject({ cancelada: false, erro: "negada" });
    expect(c.gravando).toBe(false);
  });

  it("nada gravado: resultado vazio", async () => {
    const { c, g, resultados } = montar();
    g.entregue = null;
    await c.iniciar("desligado");
    await c.parar();
    expect(resultados).toEqual([{ tipo: "vazia" }]);
  });

  it("não guardada: a gravação fica à mão, a sessão NÃO é apagada, e se a escrita termina depois ela é apagada", async () => {
    let terminar!: (m: MetaGravacao) => void;
    const { c, resultados, armazenamento } = montar();
    armazenamento.salvar.mockImplementation(() => new Promise<MetaGravacao>((ok) => (terminar = ok)));
    await c.iniciar("desligado");
    const p = c.parar();
    await vi.advanceTimersByTimeAsync(10_000);
    await p;
    expect(resultados[0]).toMatchObject({ tipo: "nao-guardada", demorou: true });
    expect(armazenamento.descartarSessao).not.toHaveBeenCalled();
    terminar(meta());
    await vi.advanceTimersByTimeAsync(0);
    expect(armazenamento.descartarSessao).toHaveBeenCalledWith("sessao-1");
  });

  it("alternar ignora o toque enquanto um pedido está em andamento", async () => {
    const { c } = montar();
    const a = c.alternar("desligado");
    expect(c.ocupado).toBe(true);
    expect(await c.alternar("desligado")).toBeNull();
    await a;
    expect(c.ocupado).toBe(false);
    expect(c.gravando).toBe(true);
    expect(await c.alternar("desligado")).toBeNull(); // o segundo toque, depois, para
    expect(c.gravando).toBe(false);
  });

  it("o botão Parar da notificação para a gravação", async () => {
    const { c, ouvintes, resultados } = montar();
    await c.iniciar("desligado");
    ouvintes.parar?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.gravando).toBe(false);
    expect(resultados).toHaveLength(1);
    expect(ouvintes.parar).toBeNull(); // os ouvintes da sessão saem junto
  });

  it("página escondida: com a proteção do serviço a gravação segue; sem ela, para", async () => {
    const a = montar();
    await a.c.iniciar("desligado");
    a.esconder(true);
    a.ouvintes.pagina?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(a.c.gravando).toBe(true);
    const b = montar({ servico: { ligar: () => false, desligar: () => {}, aoParar: () => () => {}, aoFalhar: () => () => {} } });
    await b.c.iniciar("desligado");
    b.esconder(true);
    b.ouvintes.pagina?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(b.c.gravando).toBe(false); // sem a proteção do Android, o navegador tira o microfone da página escondida: guarda o que há
  });

  it("o serviço que falha com a página escondida: para e guarda", async () => {
    const { c, ouvintes, esconder } = montar();
    await c.iniciar("desligado");
    esconder(true);
    ouvintes.falhou?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.gravando).toBe(false);
    expect(c.protegida).toBe(false);
  });
});

describe("a tela do Gravador sai de cena (GRV-001)", () => {
  it("com o serviço do Android a gravação SEGUE (a tela do hino mostra o aviso)", async () => {
    const { c } = montar();
    await c.iniciar("desligado");
    c.aoDesmontarATela();
    expect(c.gravando).toBe(true);
    expect(c.aoTerminar).toBeNull();
    await c.parar(); // o Parar do aviso, sem tela do Gravador por perto
    expect(c.gravando).toBe(false);
    expect(c.perdida).toBeNull(); // guardada: nada a avisar
  });

  it("sem o serviço, a gravação para e é guardada", async () => {
    const { c, armazenamento } = montar({ servico: { ligar: () => false, desligar: () => {}, aoParar: () => () => {}, aoFalhar: () => () => {} } });
    await c.iniciar("desligado");
    c.aoDesmontarATela();
    await vi.advanceTimersByTimeAsync(0);
    expect(c.gravando).toBe(false);
    expect(armazenamento.salvar).toHaveBeenCalled();
  });

  it("sem tela e sem como guardar, vira o aviso `perdida` (falhou)", async () => {
    const { c, armazenamento } = montar();
    armazenamento.salvar.mockRejectedValue(new Error("cota cheia"));
    await c.iniciar("desligado");
    c.aoDesmontarATela();
    await c.parar();
    expect(c.perdida).toBe("falhou");
  });

  it("sem tela e com o armazenamento demorando, vira `incerta` e some se a escrita termina", async () => {
    let terminar!: (m: MetaGravacao) => void;
    const { c, armazenamento } = montar();
    armazenamento.salvar.mockImplementation(() => new Promise<MetaGravacao>((ok) => (terminar = ok)));
    await c.iniciar("desligado");
    c.aoDesmontarATela();
    const p = c.parar();
    await vi.advanceTimersByTimeAsync(10_000);
    await p;
    expect(c.perdida).toBe("incerta");
    terminar(meta());
    await vi.advanceTimersByTimeAsync(0);
    expect(c.perdida).toBeNull();
  });

  it("um pedido de microfone que ainda esperava é jogado fora quando chega", async () => {
    const { c, g } = montar();
    let liberar!: () => void;
    g.iniciar = () => new Promise((ok) => (liberar = () => ok("desligado" as const)));
    const p = c.iniciar("desligado");
    c.aoDesmontarATela();
    liberar();
    expect(await p).toMatchObject({ cancelada: true });
    expect(c.gravando).toBe(false);
    expect(g.soltou).toBeGreaterThan(0);
  });
});

describe("recuperar (AND-002)", () => {
  it("pede ao armazenamento as sobras, sem a gravação em curso", async () => {
    const { c, armazenamento } = montar();
    armazenamento.recuperarSessoes.mockResolvedValue([meta("a"), meta("b")]);
    await c.iniciar("desligado");
    expect(await c.recuperar()).toBe(2);
    expect(armazenamento.recuperarSessoes).toHaveBeenCalledWith(["sessao-1"]);
  });
});
