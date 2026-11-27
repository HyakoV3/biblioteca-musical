import { describe, expect, it, vi } from "vitest";
import { TAMANHO_DA_PAGINA } from "../src/lib/gravacoes";
import { novo, audio } from "./apoio-gravacoes";

describe("gravações guardadas", () => {
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
});
