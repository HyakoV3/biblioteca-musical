import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Pacote } from "../src/lib/biblioteca.svelte";

// O `invoke` do Tauri não existe no Node: este falso responde por comando, e o teste decide o que o "Rust" devolve.
const falso = vi.hoisted(() => ({ respostas: new Map<string, () => unknown>() }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: async (cmd: string) => {
    const r = falso.respostas.get(cmd);
    if (!r) throw new Error(`comando sem resposta no teste: ${cmd}`);
    return r();
  },
  Channel: class {},
}));

// Dados FICTÍCIOS.
const pacote = (exemplo: boolean): Pacote => ({ hinario: { versao: 1, hinario: { id: "x", nome: "X" }, hinos: [] }, exemplo, partituras: [] });

/** Um store novo (o módulo guarda o estado) cuja carga falhou: sem pacote e com o erro. */
async function storeComErroDeCarga() {
  vi.resetModules();
  const { biblioteca } = await import("../src/lib/biblioteca.svelte");
  falso.respostas.set("carregar_hinario", () => {
    throw "falhou";
  });
  await biblioteca.carregar();
  expect(biblioteca.erro).toBe("falhou");
  expect(biblioteca.pacote).toBeNull();
  return biblioteca;
}

beforeEach(() => falso.respostas.clear());

describe("store da biblioteca: o erro de carga", () => {
  it("tentar de novo e acertar apaga o erro", async () => {
    const b = await storeComErroDeCarga();
    falso.respostas.set("carregar_hinario", () => pacote(true));
    await b.carregar();
    expect(b.erro).toBe("");
    expect(b.pacote?.exemplo).toBe(true);
  });

  it("remover (voltar ao exemplo) apaga o erro: é a saída quando o conteúdo instalado não carrega", async () => {
    const b = await storeComErroDeCarga();
    falso.respostas.set("remover_conteudo", () => pacote(true));
    await b.remover();
    expect(b.erro).toBe("");
    expect(b.pacote?.exemplo).toBe(true);
  });

  it("importar e remover as partituras também apagam o erro antigo", async () => {
    let b = await storeComErroDeCarga();
    falso.respostas.set("importar_hinario", () => pacote(false));
    await b.importar("{}");
    expect(b.erro).toBe("");
    b = await storeComErroDeCarga();
    falso.respostas.set("remover_partituras", () => pacote(false));
    await b.removerPartituras();
    expect(b.erro).toBe("");
  });

  it("uma remoção que falha lança o erro e não mexe no conteúdo nem no erro", async () => {
    const b = await storeComErroDeCarga();
    falso.respostas.set("remover_conteudo", () => {
      throw "sem permissão";
    });
    await expect(b.remover()).rejects.toBe("sem permissão");
    expect(b.pacote).toBeNull();
    expect(b.erro).toBe("falhou");
  });
});
