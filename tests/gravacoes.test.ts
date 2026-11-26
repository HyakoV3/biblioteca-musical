import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { ESPERA_AO_ABRIR_MS, Gravacoes, LimiteEstourado, TAMANHO_DA_PAGINA, TENTATIVAS_DE_ABRIR, comLimite, formatarData } from "../src/lib/gravacoes";

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

  it("atualizar muda nome e estrela, preserva o resto (inclusive campos desconhecidos) e não toca no áudio", async () => {
    const g = novo();
    const m = await g.salvar(audio(10), "audio/webm", 1);
    const a = await g.atualizar(m.id, { titulo: "  Ensaio   do coro ", favorita: true });
    expect(a).toMatchObject({ id: m.id, bytes: 10, titulo: "Ensaio do coro", favorita: true });
    expect((await g.blob(m.id))?.size).toBe(10);
    const b = await g.atualizar(m.id, { titulo: "" }); // vazio volta ao nome padrão
    expect(b).not.toHaveProperty("titulo");
    expect(b).toHaveProperty("favorita", true);
    const c = await g.atualizar(m.id, { favorita: false });
    expect(c).not.toHaveProperty("favorita");
    expect((await g.listarTodas())[0]).toEqual(c);
  });

  it("atualizar de um id que não existe não grava nada", async () => {
    const g = novo();
    expect(await g.atualizar("fantasma", { favorita: true })).toBeNull();
    expect(await g.listarTodas()).toEqual([]);
  });

  it("duas mudanças juntas não se perdem; apagar e mudar juntos não recria o registro", async () => {
    const g = novo();
    const m = await g.salvar(audio(10), "audio/webm", 1);
    await Promise.all([g.atualizar(m.id, { favorita: true }), g.atualizar(m.id, { titulo: "X" })]);
    expect((await g.listarTodas())[0]).toMatchObject({ favorita: true, titulo: "X" });
    await Promise.all([g.apagar(m.id), g.atualizar(m.id, { favorita: false })]);
    expect(await g.listarTodas()).toEqual([]);
    expect(await g.blob(m.id)).toBeNull();
  });

  it("listarTodas valida o nome e a estrela lidos do banco", async () => {
    const idb = new IDBFactory();
    const g = new Gravacoes(() => idb);
    const m = await g.salvar(audio(10), "audio/webm", 1);
    const banco = await new Promise<IDBDatabase>((ok, falha) => {
      const r = idb.open("bm-gravacoes");
      r.onsuccess = () => ok(r.result);
      r.onerror = () => falha(r.error);
    });
    await new Promise<void>((ok) => {
      const t = banco.transaction("meta", "readwrite");
      t.objectStore("meta").put({ ...m, titulo: 123, favorita: "sim" });
      t.oncomplete = () => ok();
    });
    const [lida] = await g.listarTodas();
    expect(lida).not.toHaveProperty("titulo");
    expect(lida).not.toHaveProperty("favorita");
  });

  it("listarTodas devolve todos os metadados da mais nova para a mais antiga, igual às páginas juntas", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      const g = novo();
      for (let i = 0; i < 25; i++) {
        vi.setSystemTime(new Date(2026, 10, 25, 10, i));
        await g.salvar(audio(10 + i), "audio/webm", i);
      }
      const todas = await g.listarTodas();
      expect(todas).toHaveLength(25);
      expect(todas.map((m) => m.segundos)).toEqual(Array.from({ length: 25 }, (_, i) => 24 - i));
      let juntas: typeof todas = [];
      let antes: { criadaEm: number; id: string } | undefined;
      for (;;) {
        const p = await g.listar(10, antes);
        juntas = [...juntas, ...p.itens];
        if (!p.temMais) break;
        const ultima = p.itens[p.itens.length - 1]!;
        antes = { criadaEm: ultima.criadaEm, id: ultima.id };
      }
      expect(todas.map((m) => m.id)).toEqual(juntas.map((m) => m.id));
      expect(await novo().listarTodas()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("guarda o contexto (I-38) quando há; sem ele, o registro não ganha o campo", async () => {
    const g = novo();
    const contexto = { v: 1, fone: true, origem: "metronomo", metronomo: { bpm: 65, cliques: 4, familia: "simples", tempos: 4 } } as const;
    const com = await g.salvar(audio(10), "audio/webm", 1, contexto);
    const sem = await g.salvar(audio(10), "audio/webm", 1, null);
    expect(sem).not.toHaveProperty("contexto");
    const { itens } = await g.listar();
    expect(itens.find((i) => i.id === com.id)?.contexto).toEqual(contexto);
    expect(itens.find((i) => i.id === sem.id)).not.toHaveProperty("contexto");
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

describe("abrir o banco quando o navegador não responde (o open() que nunca volta)", () => {
  /** Uma fábrica cujos primeiros `mudos` pedidos de `open` nunca disparam evento nenhum; os seguintes vão para um IDBFactory de verdade. */
  function fabricaMuda(mudos: number) {
    const real = new IDBFactory();
    const chamadas = { n: 0 };
    const fabrica = {
      open: (nome: string, versao?: number) => {
        chamadas.n++;
        if (chamadas.n <= mudos) return {} as IDBOpenDBRequest; // nunca chama onsuccess, onerror nem onblocked
        return real.open(nome, versao);
      },
    } as unknown as IDBFactory;
    return { fabrica, chamadas };
  }

  it("se a 1ª tentativa fica muda, pede de novo e guarda normalmente", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const { fabrica, chamadas } = fabricaMuda(1);
      const g = new Gravacoes(() => fabrica);
      const pronto = g.salvar(audio(500), "audio/webm", 3);
      await vi.advanceTimersByTimeAsync(ESPERA_AO_ABRIR_MS + 10);
      vi.useRealTimers(); // o fake-indexeddb precisa dos timers de verdade para concluir
      const m = await pronto;
      expect(m.bytes).toBe(500);
      expect(chamadas.n).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("se nenhuma tentativa responde, falha com uma mensagem clara e a próxima chamada tenta de novo", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const { fabrica, chamadas } = fabricaMuda(TENTATIVAS_DE_ABRIR);
      const g = new Gravacoes(() => fabrica);
      const falhou = g.listar().then(
        () => null,
        (e: Error) => e.message,
      );
      await vi.advanceTimersByTimeAsync(ESPERA_AO_ABRIR_MS * TENTATIVAS_DE_ABRIR + 50);
      expect(await falhou).toBe("o armazenamento não respondeu ao abrir");
      expect(chamadas.n).toBe(TENTATIVAS_DE_ABRIR);
      vi.useRealTimers();
      expect((await g.listar()).itens).toEqual([]); // a falha não ficou guardada: agora abre
    } finally {
      vi.useRealTimers();
    }
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

describe("gravação em pedaços e recuperação (AND-002)", () => {
  const pedaco = (...bytes: number[]) => new Blob([new Uint8Array(bytes)]);
  const lerBytes = async (b: Blob | null) => [...new Uint8Array((await b?.arrayBuffer()) ?? new ArrayBuffer(0))];

  it("uma sessão que ficou aberta vira uma gravação guardada, com os pedaços na ordem certa", async () => {
    const fabrica = new IDBFactory();
    const antes = new Gravacoes(() => fabrica);
    const id = await antes.abrirSessao("audio/webm;codecs=opus", { v: 1, fone: true, origem: "metronomo", metronomo: { bpm: 60, cliques: 4, familia: "simples", tempos: 4 } });
    // os pedaços chegam fora de ordem (as escritas terminam em ordens diferentes) e o 10 vem depois do 2 (a ordem é numérica, não de texto)
    await antes.guardarPedaco(id, 10, pedaco(10));
    await antes.guardarPedaco(id, 1, pedaco(1));
    await antes.guardarPedaco(id, 0, pedaco(0));
    await antes.guardarPedaco(id, 2, pedaco(2));
    await antes.fechar(); // o app caiu: nada de `descartarSessao`

    const depois = new Gravacoes(() => fabrica);
    const [meta, ...resto] = await depois.recuperarSessoes();
    expect(resto).toEqual([]);
    expect(meta).toMatchObject({ bytes: 4, tipo: "audio/webm;codecs=opus", segundos: 4 });
    expect(meta.contexto).toMatchObject({ origem: "metronomo", mudouDurante: true });
    expect(await lerBytes(await depois.blob(meta.id))).toEqual([0, 1, 2, 10]);
    expect((await depois.listarTodas()).map((m) => m.id)).toEqual([meta.id]);
    expect(await depois.recuperarSessoes()).toEqual([]); // e não recupera duas vezes
  });

  it("a gravação em curso (a de `excluir`) não é tratada como sobra", async () => {
    const g = novo();
    const id = await g.abrirSessao("audio/webm");
    await g.guardarPedaco(id, 0, pedaco(1, 2, 3));
    expect(await g.recuperarSessoes([id])).toEqual([]);
    expect((await g.recuperarSessoes()).length).toBe(1);
  });

  it("sessão sem nenhum pedaço é só apagada, sem criar gravação vazia", async () => {
    const g = novo();
    await g.abrirSessao("audio/webm");
    expect(await g.recuperarSessoes()).toEqual([]);
    expect(await g.listarTodas()).toEqual([]);
    expect(await g.recuperarSessoes()).toEqual([]);
  });

  it("descartar a sessão apaga os pedaços, e um pedaço que chega atrasado não é escrito", async () => {
    const fabrica = new IDBFactory();
    const g = new Gravacoes(() => fabrica);
    const id = await g.abrirSessao("audio/webm");
    await g.guardarPedaco(id, 0, pedaco(1));
    await g.descartarSessao(id);
    await g.guardarPedaco(id, 1, pedaco(2)); // atrasado: a gravação já foi fechada
    const outro = new Gravacoes(() => fabrica);
    expect(await outro.recuperarSessoes()).toEqual([]); // nada ficou órfão
  });

  it("salvar com a sessão guarda a gravação e tira a sessão na mesma transação: nada é recuperado depois", async () => {
    const fabrica = new IDBFactory();
    const g = new Gravacoes(() => fabrica);
    const id = await g.abrirSessao("audio/webm");
    await g.guardarPedaco(id, 0, pedaco(1, 2, 3));
    const m = await g.salvar(pedaco(1, 2, 3), "audio/webm", 2, null, id);
    const depois = new Gravacoes(() => fabrica); // outra abertura do app
    expect(await depois.recuperarSessoes()).toEqual([]);
    expect((await depois.listarTodas()).map((x) => x.id)).toEqual([m.id]); // uma cópia só
  });

  it("uma sessão que não se recupera (erro) não impede as outras, e fica para a próxima abertura", async () => {
    const fabrica = new IDBFactory();
    const g = new Gravacoes(() => fabrica);
    const ruim = await g.abrirSessao("audio/webm");
    const boa = await g.abrirSessao("audio/webm");
    await g.guardarPedaco(ruim, 0, pedaco(1));
    await g.guardarPedaco(boa, 0, pedaco(2, 2));
    // quebra a recuperação da primeira (por exemplo, sem espaço para a cópia inteira): a outra tem de ser recuperada mesmo assim
    const outra = new Gravacoes(() => fabrica);
    const original = (outra as unknown as { recuperarUma: (b: IDBDatabase, s: { id: string }) => Promise<unknown> }).recuperarUma.bind(outra);
    vi.spyOn(outra as unknown as { recuperarUma: typeof original }, "recuperarUma").mockImplementation(async (b, sessao) => {
      if (sessao.id === ruim) throw new DOMException("sem espaço", "QuotaExceededError");
      return original(b, sessao);
    });
    const metas = await outra.recuperarSessoes();
    expect(metas.map((m) => m.bytes)).toEqual([2]); // a boa foi recuperada mesmo com a ruim na frente
    expect(await new Gravacoes(() => fabrica).recuperarSessoes()).toHaveLength(1); // e a ruim ficou para a próxima abertura
  });

  it("cada sessão vira a sua própria gravação", async () => {
    const g = novo();
    const a = await g.abrirSessao("audio/webm");
    const b = await g.abrirSessao("audio/webm");
    await g.guardarPedaco(a, 0, pedaco(1));
    await g.guardarPedaco(b, 0, pedaco(2, 2));
    const metas = await g.recuperarSessoes();
    expect(metas.map((m) => m.bytes).sort()).toEqual([1, 2]);
  });

  it("um banco da versão 1 é atualizado sem perder as gravações guardadas", async () => {
    const fabrica = new IDBFactory();
    const banco = await new Promise<IDBDatabase>((ok, falha) => {
      const r = fabrica.open("bm-gravacoes", 1); // o formato antigo: só meta e blobs
      r.onupgradeneeded = () => {
        r.result.createObjectStore("meta", { keyPath: "id" }).createIndex("porData", ["criadaEm", "id"]);
        r.result.createObjectStore("blobs");
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => falha(r.error);
    });
    await new Promise<void>((ok) => {
      const t = banco.transaction(["meta", "blobs"], "readwrite");
      t.objectStore("meta").put({ id: "antiga", criadaEm: 1, segundos: 2, tipo: "audio/webm", bytes: 3 });
      t.objectStore("blobs").put({ dados: new Uint8Array([7, 8, 9]).buffer, tipo: "audio/webm" }, "antiga");
      t.oncomplete = () => ok();
    });
    banco.close();
    const g = new Gravacoes(() => fabrica);
    expect((await g.listarTodas()).map((m) => m.id)).toEqual(["antiga"]);
    expect(await lerBytes(await g.blob("antiga"))).toEqual([7, 8, 9]);
    const id = await g.abrirSessao("audio/webm"); // e os depósitos novos existem
    await g.guardarPedaco(id, 0, pedaco(1));
    expect((await g.recuperarSessoes()).length).toBe(1);
  });
});

describe("LimiteEstourado", () => {
  it("comLimite estoura com o erro próprio, com a mensagem pedida", async () => {
    vi.useFakeTimers();
    try {
      const p = comLimite(new Promise<number>(() => {}), 1000, "demorou");
      const visto = expect(p).rejects.toBeInstanceOf(LimiteEstourado);
      await vi.advanceTimersByTimeAsync(1000);
      await visto;
      await expect(comLimite(Promise.reject(new Error("cota cheia")), 1000, "demorou")).rejects.not.toBeInstanceOf(LimiteEstourado);
    } finally {
      vi.useRealTimers();
    }
  });
});
