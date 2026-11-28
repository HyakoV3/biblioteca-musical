import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { Gravacoes } from "../src/lib/gravacoes";
import { novo, audio } from "./apoio-gravacoes";

describe("gravações guardadas", () => {
  it("guarda e devolve o arquivo e os metadados", async () => {
    const g = novo();
    const m = await g.salvar({ blob: audio(1000), tipo: "audio/webm;codecs=opus", segundos: 12.5 });
    expect(m).toMatchObject({ bytes: 1000, tipo: "audio/webm;codecs=opus", segundos: 12.5 });
    const b = await g.blob(m.id);
    expect(b?.size).toBe(1000);
    const p = await g.listar();
    expect(p.itens).toEqual([m]);
    expect(p.temMais).toBe(false);
  });

  it("guarda o contexto (I-38) quando há; sem ele, o registro não ganha o campo", async () => {
    const g = novo();
    const contexto = { v: 1, fone: true, origem: "metronomo", metronomo: { bpm: 65, cliques: 4, familia: "simples", tempos: 4 } } as const;
    const com = await g.salvar({ blob: audio(10), tipo: "audio/webm", segundos: 1, contexto });
    const sem = await g.salvar({ blob: audio(10), tipo: "audio/webm", segundos: 1, contexto: null });
    expect(sem).not.toHaveProperty("contexto");
    const { itens } = await g.listar();
    expect(itens.find((i) => i.id === com.id)?.contexto).toEqual(contexto);
    expect(itens.find((i) => i.id === sem.id)).not.toHaveProperty("contexto");
  });

  it("resumo: quantidade e espaço usado", async () => {
    const g = novo();
    expect(await g.resumo()).toEqual({ quantidade: 0, bytes: 0 });
    await g.salvar({ blob: audio(1000), tipo: "audio/webm", segundos: 1 });
    await g.salvar({ blob: audio(2500), tipo: "audio/webm", segundos: 1 });
    expect(await g.resumo()).toEqual({ quantidade: 2, bytes: 3500 });
  });

  it("apagar tira os metadados e o arquivo", async () => {
    const g = novo();
    const a = await g.salvar({ blob: audio(100), tipo: "audio/webm", segundos: 1 });
    const b = await g.salvar({ blob: audio(200), tipo: "audio/webm", segundos: 1 });
    await g.apagar(a.id);
    expect((await g.listar()).itens.map((m) => m.id)).toEqual([b.id]);
    expect(await g.blob(a.id)).toBeNull();
    expect(await g.resumo()).toEqual({ quantidade: 1, bytes: 200 });
    await g.apagar("nao-existe"); // apagar o que não há não falha
  });

  it("apagar todas esvazia tudo", async () => {
    const g = novo();
    for (let i = 0; i < 5; i++) await g.salvar({ blob: audio(100), tipo: "audio/webm", segundos: 1 });
    await g.apagarTodas();
    expect(await g.resumo()).toEqual({ quantidade: 0, bytes: 0 });
    expect((await g.listar()).itens).toEqual([]);
  });

  it("o que foi guardado sobrevive a reabrir o banco", async () => {
    const fabrica = new IDBFactory();
    const g1 = new Gravacoes(() => fabrica);
    const m = await g1.salvar({ blob: audio(321), tipo: "audio/webm", segundos: 2 });
    await g1.fechar();
    const g2 = new Gravacoes(() => fabrica);
    expect((await g2.listar()).itens).toEqual([m]);
    expect((await g2.blob(m.id))?.size).toBe(321);
  });

  it("sem IndexedDB, as chamadas falham com uma mensagem (a tela mostra o aviso)", async () => {
    const g = new Gravacoes(() => undefined);
    await expect(g.listar()).rejects.toThrow(/indisponível/);
    await expect(g.salvar({ blob: audio(1), tipo: "audio/webm", segundos: 1 })).rejects.toThrow(/indisponível/);
  });

  it("se a transação é recusada (cota cheia), salvar rejeita e nada fica pela metade", async () => {
    const fabrica = new IDBFactory();
    const g = new Gravacoes(() => fabrica);
    await g.salvar({ blob: audio(100), tipo: "audio/webm", segundos: 1 });
    // força uma falha no MEIO da transação: o registro de metadados entra, e o arquivo (uma função não pode ser guardada) é recusado
    const ruim = { size: 10, nao_clonavel() {} } as unknown as Blob;
    await expect(g.salvar({ blob: ruim, tipo: "audio/webm", segundos: 1 })).rejects.toBeDefined();
    expect(await g.resumo()).toEqual({ quantidade: 1, bytes: 100 });
  });
});

describe("formato guardado (bytes no lugar do Blob)", () => {
  it("guarda os bytes e devolve um Blob do mesmo tamanho e tipo", async () => {
    const g = novo();
    const m = await g.salvar({ blob: audio(321), tipo: "audio/webm;codecs=opus", segundos: 2 });
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
