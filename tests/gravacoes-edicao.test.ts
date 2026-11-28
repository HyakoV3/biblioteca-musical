import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { Gravacoes } from "../src/lib/gravacoes";
import { novo, audio } from "./apoio-gravacoes";

describe("gravações guardadas", () => {
  it("atualizar muda nome e estrela, preserva o resto (inclusive campos desconhecidos) e não toca no áudio", async () => {
    const g = novo();
    const m = await g.salvar({ blob: audio(10), tipo: "audio/webm", segundos: 1 });
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
    const m = await g.salvar({ blob: audio(10), tipo: "audio/webm", segundos: 1 });
    await Promise.all([g.atualizar(m.id, { favorita: true }), g.atualizar(m.id, { titulo: "X" })]);
    expect((await g.listarTodas())[0]).toMatchObject({ favorita: true, titulo: "X" });
    await Promise.all([g.apagar(m.id), g.atualizar(m.id, { favorita: false })]);
    expect(await g.listarTodas()).toEqual([]);
    expect(await g.blob(m.id)).toBeNull();
  });

  it("listarTodas valida o nome e a estrela lidos do banco", async () => {
    const idb = new IDBFactory();
    const g = new Gravacoes(() => idb);
    const m = await g.salvar({ blob: audio(10), tipo: "audio/webm", segundos: 1 });
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
});
