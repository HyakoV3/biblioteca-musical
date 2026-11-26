import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErroPacote, LIMITE_ZIP } from "../src/lib/sons/extrair";

// O download usa o `fetch` NATIVO do Tauri (plugin HTTP). Aqui ele é trocado por Responses sintéticas, para exercitar o corte por tamanho,
// o progresso, as rejeições e o tempo-limite sem rede.
const nativo = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@tauri-apps/plugin-http", () => ({ fetch: nativo.fetch }));

const { baixarZip } = await import("../src/lib/sons/baixar");

const bytes = (n: number, v = 7) => new Uint8Array(n).fill(v);
const codigoDe = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof ErroPacote ? e.codigo : `outro: ${e}`;
  }
};

/** Um corpo que entrega os `pedacos` e depois fica parado (nunca termina) se `travar`. */
function corpo(pedacos: Uint8Array[], travar = false): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(c) {
      if (i < pedacos.length) c.enqueue(pedacos[i++]);
      else if (!travar) c.close();
      else return new Promise(() => {}); // a rede parou
    },
  });
}

beforeEach(() => {
  nativo.fetch.mockReset(); // sem `return`: o Vitest chamaria o mock devolvido como função de limpeza
});

describe("baixarZip", () => {
  it("junta os pedaços na ordem e avisa o progresso até 1", async () => {
    nativo.fetch.mockResolvedValue(new Response(corpo([bytes(3, 1), bytes(2, 2)]), { headers: { "content-length": "5" } }));
    const fracoes: number[] = [];
    const r = await baixarZip("https://exemplo.invalid/a.zip", 999, (f) => fracoes.push(f));
    expect([...r]).toEqual([1, 1, 1, 2, 2]);
    expect(fracoes).toEqual([0.6, 1]);
  });

  it("sem content-length, o progresso usa a estimativa (e nunca passa de 1)", async () => {
    nativo.fetch.mockResolvedValue(new Response(corpo([bytes(5), bytes(5)])));
    const fracoes: number[] = [];
    await baixarZip("https://exemplo.invalid/a.zip", 8, (f) => fracoes.push(f));
    expect(fracoes).toEqual([0.625, 1]);
  });

  it("recusa HTTP de erro como erro de rede", async () => {
    nativo.fetch.mockResolvedValue(new Response("não achei", { status: 404 }));
    expect(await codigoDe(baixarZip("https://exemplo.invalid/a.zip", 1))).toBe("rede");
  });

  it("falha de conexão vira erro de rede", async () => {
    nativo.fetch.mockRejectedValue(new Error("sem rede"));
    expect(await codigoDe(baixarZip("https://exemplo.invalid/a.zip", 1))).toBe("rede");
  });

  it("recusa de cara um content-length acima do limite", async () => {
    nativo.fetch.mockResolvedValue(new Response(corpo([bytes(1)]), { headers: { "content-length": String(LIMITE_ZIP + 1) } }));
    expect(await codigoDe(baixarZip("https://exemplo.invalid/a.zip", 1))).toBe("tamanho");
  });

  it("corta o download que passa do limite mesmo sem content-length", async () => {
    const cancelou = vi.fn();
    const grande = new ReadableStream<Uint8Array>({
      pull(c) {
        c.enqueue(bytes(40 * 1024 * 1024));
      },
      cancel: cancelou,
    });
    nativo.fetch.mockResolvedValue(new Response(grande));
    expect(await codigoDe(baixarZip("https://exemplo.invalid/a.zip", 1))).toBe("tamanho");
    expect(cancelou).toHaveBeenCalled();
  });

  it("pede a conexão com tempo-limite e com sinal de cancelamento", async () => {
    nativo.fetch.mockResolvedValue(new Response(corpo([bytes(1)])));
    await baixarZip("https://exemplo.invalid/a.zip", 1);
    const opcoes = nativo.fetch.mock.calls[0][1];
    expect(opcoes.connectTimeout).toBeGreaterThan(0);
    expect(opcoes.signal).toBeInstanceOf(AbortSignal);
  });

  it("aborta como erro de rede quando nenhum pedaço chega por semDadosMs", async () => {
    nativo.fetch.mockResolvedValue(new Response(corpo([bytes(2)], true)));
    expect(await codigoDe(baixarZip("https://exemplo.invalid/a.zip", 1, undefined, 50))).toBe("rede");
  });

  it("aborta quando nem a resposta chega (conexão que não abre)", async () => {
    nativo.fetch.mockImplementation(() => new Promise(() => {}));
    expect(await codigoDe(baixarZip("https://exemplo.invalid/a.zip", 1, undefined, 50))).toBe("rede");
  });

  it("o relógio recomeça a cada pedaço: um download lento mas que anda não é abortado", async () => {
    let i = 0;
    const lento = new ReadableStream<Uint8Array>({
      async pull(c) {
        await new Promise((r) => setTimeout(r, 30));
        if (i++ < 4) c.enqueue(bytes(1));
        else c.close();
      },
    });
    nativo.fetch.mockResolvedValue(new Response(lento));
    const r = await baixarZip("https://exemplo.invalid/a.zip", 4, undefined, 80); // dura ~150 ms, mas nunca fica 80 ms parado
    expect(r.length).toBe(4);
  });

  it("sem corpo em stream: o relógio conta só os dados, não a conexão, e o tamanho recebido também é limitado", async () => {
    const semStream = (corpoBytes: Uint8Array) => {
      const r = new Response(corpoBytes as BodyInit);
      Object.defineProperty(r, "body", { value: null });
      return r;
    };
    nativo.fetch.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 60)); // a conexão demora mais que semDadosMs (50)
      return semStream(bytes(3));
    });
    expect((await baixarZip("https://exemplo.invalid/a.zip", 1, undefined, 100)).length).toBe(3);
    nativo.fetch.mockResolvedValue(semStream(bytes(LIMITE_ZIP + 1)));
    expect(await codigoDe(baixarZip("https://exemplo.invalid/a.zip", 1))).toBe("tamanho");
  });

  it("a mensagem diferencia 'sem resposta do servidor' de 'sem dados'", async () => {
    nativo.fetch.mockImplementation(() => new Promise(() => {}));
    await expect(baixarZip("https://exemplo.invalid/a.zip", 1, undefined, 30)).rejects.toThrow(/sem resposta do servidor/);
    nativo.fetch.mockResolvedValue(new Response(corpo([bytes(1)], true)));
    await expect(baixarZip("https://exemplo.invalid/a.zip", 1, undefined, 30)).rejects.toThrow(/sem dados/);
  });
});
