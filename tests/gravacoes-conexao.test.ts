import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it, vi } from "vitest";
import { ESPERA_AO_ABRIR_MS, Gravacoes, TENTATIVAS_DE_ABRIR } from "../src/lib/gravacoes";
import { audio, fabricaMuda } from "./apoio-gravacoes";

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
    const m = await g.salvar({ blob: audio(100), tipo: "audio/webm", segundos: 1 });
    const banco = await conexao(g)!;
    banco.close(); // o navegador fechou a conexão por baixo
    banco.onclose?.(new Event("close"));
    expect(conexao(g)).toBeNull();
    expect((await g.listar()).itens.map((x) => x.id)).toEqual([m.id]);
    expect((await g.blob(m.id))?.size).toBe(100);
  });

  it("se outra versão pede para fechar (onversionchange), fecha, esquece e reabre depois", async () => {
    const g = compartilhado();
    await g.salvar({ blob: audio(100), tipo: "audio/webm", segundos: 1 });
    const banco = await conexao(g)!;
    banco.onversionchange?.(new Event("versionchange") as IDBVersionChangeEvent);
    expect(conexao(g)).toBeNull();
    await g.salvar({ blob: audio(50), tipo: "audio/webm", segundos: 1 }); // reabriu
    expect(await g.resumo()).toEqual({ quantidade: 2, bytes: 150 });
  });
});

describe("abrir o banco quando o navegador não responde (o open() que nunca volta)", () => {
  it("se a 1ª tentativa fica muda, pede de novo e guarda normalmente", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const { fabrica, chamadas } = fabricaMuda(1);
      const g = new Gravacoes(() => fabrica);
      const pronto = g.salvar({ blob: audio(500), tipo: "audio/webm", segundos: 3 });
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
