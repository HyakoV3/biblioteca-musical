import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { Gravacoes, TAMANHO_DA_PAGINA, comLimite, formatarData } from "../src/lib/gravacoes";

// O Node não tem IDBKeyRange; no WebView ele é global.
vi.stubGlobal("IDBKeyRange", IDBKeyRange);

const novo = () => new Gravacoes(() => new IDBFactory());
const audio = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: "audio/webm" });

describe("gravações guardadas", () => {
  it("guarda e devolve o arquivo e os metadados", async () => {
    const g = novo();
    const m = await g.salvar(audio(1000), "audio/webm;codecs=opus", 12.5);
    expect(m).toMatchObject({ bytes: 1000, tipo: "audio/webm;codecs=opus", segundos: 12.5 });
    const b = await g.blob(m.id);
    expect(b?.size).toBe(1000);
    const p = await g.listar();
    expect(p.itens).toEqual([m]);
    expect(p.temMais).toBe(false);
  });

  it("a lista vem da mais nova para a mais antiga", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); // só o relógio: o fake-indexeddb usa timers de verdade
    try {
      const g = novo();
      vi.setSystemTime(1_000_000);
      const a = await g.salvar(audio(10), "audio/webm", 1);
      vi.setSystemTime(2_000_000);
      const b = await g.salvar(audio(20), "audio/webm", 2);
      vi.setSystemTime(3_000_000);
      const c = await g.salvar(audio(30), "audio/webm", 3);
      expect((await g.listar()).itens.map((x) => x.id)).toEqual([c.id, b.id, a.id]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("pagina sem repetir nem pular, e diz quando acabou", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); // só o relógio: o fake-indexeddb usa timers de verdade
    try {
      const g = novo();
      const ids: string[] = [];
      for (let i = 0; i < 25; i++) {
        vi.setSystemTime(1_000_000 + i * 1000);
        ids.unshift((await g.salvar(audio(100 + i), "audio/webm", i)).id);
      }
      const lidas: string[] = [];
      let antes;
      const paginas: number[] = [];
      for (;;) {
        const p = await g.listar(TAMANHO_DA_PAGINA, antes);
        paginas.push(p.itens.length);
        lidas.push(...p.itens.map((m) => m.id));
        if (!p.temMais) break;
        const ultima = p.itens[p.itens.length - 1];
        antes = { criadaEm: ultima.criadaEm, id: ultima.id };
      }
      expect(paginas).toEqual([10, 10, 5]);
      expect(lidas).toEqual(ids); // todas, na ordem, sem repetição
    } finally {
      vi.useRealTimers();
    }
  });

  it("exatamente uma página cheia não promete outra", async () => {
    const g = novo();
    for (let i = 0; i < TAMANHO_DA_PAGINA; i++) await g.salvar(audio(10), "audio/webm", 1);
    const p = await g.listar();
    expect(p.itens).toHaveLength(TAMANHO_DA_PAGINA);
    expect(p.temMais).toBe(false);
  });

  it("gravações no mesmo instante não se perdem na paginação (o id desempata)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); // só o relógio: o fake-indexeddb usa timers de verdade
    try {
      const g = novo();
      vi.setSystemTime(5_000_000);
      for (let i = 0; i < 7; i++) await g.salvar(audio(10 + i), "audio/webm", 1);
      const a = await g.listar(3);
      const u1 = a.itens[2];
      const b = await g.listar(3, { criadaEm: u1.criadaEm, id: u1.id });
      const u2 = b.itens[2];
      const c = await g.listar(3, { criadaEm: u2.criadaEm, id: u2.id });
      const todos = [...a.itens, ...b.itens, ...c.itens].map((m) => m.id);
      expect(todos).toHaveLength(7);
      expect(new Set(todos).size).toBe(7);
      expect(c.temMais).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("resumo: quantidade e espaço usado", async () => {
    const g = novo();
    expect(await g.resumo()).toEqual({ quantidade: 0, bytes: 0 });
    await g.salvar(audio(1000), "audio/webm", 1);
    await g.salvar(audio(2500), "audio/webm", 1);
    expect(await g.resumo()).toEqual({ quantidade: 2, bytes: 3500 });
  });

  it("apagar tira os metadados e o arquivo", async () => {
    const g = novo();
    const a = await g.salvar(audio(100), "audio/webm", 1);
    const b = await g.salvar(audio(200), "audio/webm", 1);
    await g.apagar(a.id);
    expect((await g.listar()).itens.map((m) => m.id)).toEqual([b.id]);
    expect(await g.blob(a.id)).toBeNull();
    expect(await g.resumo()).toEqual({ quantidade: 1, bytes: 200 });
    await g.apagar("nao-existe"); // apagar o que não há não falha
  });

  it("apagar todas esvazia tudo", async () => {
    const g = novo();
    for (let i = 0; i < 5; i++) await g.salvar(audio(100), "audio/webm", 1);
    await g.apagarTodas();
    expect(await g.resumo()).toEqual({ quantidade: 0, bytes: 0 });
    expect((await g.listar()).itens).toEqual([]);
  });

  it("o que foi guardado sobrevive a reabrir o banco", async () => {
    const fabrica = new IDBFactory();
    const g1 = new Gravacoes(() => fabrica);
    const m = await g1.salvar(audio(321), "audio/webm", 2);
    await g1.fechar();
    const g2 = new Gravacoes(() => fabrica);
    expect((await g2.listar()).itens).toEqual([m]);
    expect((await g2.blob(m.id))?.size).toBe(321);
  });

  it("sem IndexedDB, as chamadas falham com uma mensagem (a tela mostra o aviso)", async () => {
    const g = new Gravacoes(() => undefined);
    await expect(g.listar()).rejects.toThrow(/indisponível/);
    await expect(g.salvar(audio(1), "audio/webm", 1)).rejects.toThrow(/indisponível/);
  });

  it("se a transação é recusada (cota cheia), salvar rejeita e nada fica pela metade", async () => {
    const fabrica = new IDBFactory();
    const g = new Gravacoes(() => fabrica);
    await g.salvar(audio(100), "audio/webm", 1);
    // força uma falha no MEIO da transação: o registro de metadados entra, e o arquivo (uma função não pode ser guardada) é recusado
    const ruim = { size: 10, nao_clonavel() {} } as unknown as Blob;
    await expect(g.salvar(ruim, "audio/webm", 1)).rejects.toBeDefined();
    expect(await g.resumo()).toEqual({ quantidade: 1, bytes: 100 });
  });
});

describe("conexão com o banco", () => {
  // O banco guardado em cache pode ser fechado de fora (dados limpos, erro de disco, outra versão pedindo): a próxima chamada reabre em vez de lançar para sempre.
  const conexao = (g: Gravacoes) => (g as unknown as { abrindo: Promise<IDBDatabase> | null }).abrindo;

  // Uma fábrica só: reabrir tem de achar o MESMO banco (o `novo()` cria um banco vazio a cada abertura).
  const compartilhado = () => {
    const fabrica = new IDBFactory();
    return new Gravacoes(() => fabrica);
  };

  it("se o navegador fecha a conexão (onclose), a próxima chamada reabre e funciona", async () => {
    const g = compartilhado();
    const m = await g.salvar(audio(100), "audio/webm", 1);
    const banco = await conexao(g)!;
    banco.close(); // o navegador fechou a conexão por baixo
    banco.onclose?.(new Event("close"));
    expect(conexao(g)).toBeNull();
    expect((await g.listar()).itens.map((x) => x.id)).toEqual([m.id]);
    expect((await g.blob(m.id))?.size).toBe(100);
  });

  it("se outra versão pede para fechar (onversionchange), fecha, esquece e reabre depois", async () => {
    const g = compartilhado();
    await g.salvar(audio(100), "audio/webm", 1);
    const banco = await conexao(g)!;
    banco.onversionchange?.(new Event("versionchange") as IDBVersionChangeEvent);
    expect(conexao(g)).toBeNull();
    await g.salvar(audio(50), "audio/webm", 1); // reabriu
    expect(await g.resumo()).toEqual({ quantidade: 2, bytes: 150 });
  });
});

describe("data da gravação", () => {
  it("dia e mês, hora e minuto, no formato do idioma", () => {
    const quando = new Date(2026, 10, 17, 10, 46).getTime();
    expect(formatarData(quando, "pt")).toMatch(/17\/11.*10:46/);
    expect(formatarData(quando, "en")).toMatch(/11\/17.*10:46/);
  });
  it("valor inválido vira texto vazio", () => {
    expect(formatarData(NaN, "pt")).toBe("");
  });
});

describe("formato guardado (bytes no lugar do Blob)", () => {
  it("guarda os bytes e devolve um Blob do mesmo tamanho e tipo", async () => {
    const g = novo();
    const m = await g.salvar(audio(321), "audio/webm;codecs=opus", 2);
    const b = await g.blob(m.id);
    expect(b).toBeInstanceOf(Blob);
    expect(b!.size).toBe(321);
    expect(b!.type).toBe("audio/webm;codecs=opus");
  });

  it("uma gravação guardada antes, como Blob inteiro, continua tocando", async () => {
    const g = novo();
    const banco = await (g as unknown as { banco(): Promise<IDBDatabase> }).banco();
    await new Promise<void>((ok, falha) => {
      const t = banco.transaction(["blobs"], "readwrite");
      t.objectStore("blobs").put(audio(77), "antigo");
      t.oncomplete = () => ok();
      t.onerror = () => falha(t.error);
    });
    const b = await g.blob("antigo");
    expect(b).toBeInstanceOf(Blob);
    expect(b!.size).toBe(77);
  });
});

describe("comLimite (a escrita que nunca confirma não prende a tela)", () => {
  it("devolve o resultado se a promessa termina antes do limite, sem deixar o temporizador", async () => {
    vi.useFakeTimers();
    try {
      const p = comLimite(Promise.resolve(42), 1000, "demorou");
      await expect(p).resolves.toBe(42);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejeita com o motivo se a promessa nunca termina", async () => {
    vi.useFakeTimers();
    try {
      const p = comLimite(new Promise<number>(() => {}), 1000, "o armazenamento demorou");
      const resultado = expect(p).rejects.toThrow("o armazenamento demorou");
      await vi.advanceTimersByTimeAsync(1001);
      await resultado;
    } finally {
      vi.useRealTimers();
    }
  });

  it("mantém o erro da própria promessa, antes do limite", async () => {
    vi.useFakeTimers();
    try {
      await expect(comLimite(Promise.reject(new Error("cota cheia")), 1000, "demorou")).rejects.toThrow("cota cheia");
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
