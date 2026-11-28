import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { Gravacoes } from "../src/lib/gravacoes";
import { novo } from "./apoio-gravacoes";

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
    const m = await g.salvar({ blob: pedaco(1, 2, 3), tipo: "audio/webm", segundos: 2, contexto: null, sessao: id });
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
