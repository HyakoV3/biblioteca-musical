// Caracterização dos estados de "baixar pacote" (hinário e partituras): andamento, erro, trava `instalando` e limpeza ao remover.
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  baixarEInstalar: vi.fn(),
  biblioteca: {
    pacote: { exemplo: false } as { exemplo: boolean } | null,
    importar: vi.fn(),
    remover: vi.fn(),
    importarPartituras: vi.fn(),
    removerPartituras: vi.fn(),
  },
  reproducao: { limpar: vi.fn() },
}));

vi.mock("../src/lib/biblioteca.svelte", () => ({ biblioteca: m.biblioteca }));
vi.mock("../src/lib/reproducao.svelte", () => ({ reproducao: m.reproducao }));
vi.mock("../src/lib/sons/baixar", async (orig) => ({ ...(await orig<object>()), baixarZip: vi.fn() }));
vi.mock("../src/lib/sons/extrair", async (orig) => ({ ...(await orig<object>()), sha256Hex: vi.fn() }));
vi.mock("../src/lib/partituras/baixar", async (orig) => ({
  ...(await orig<typeof import("../src/lib/partituras/baixar")>()),
  baixarEInstalar: m.baixarEInstalar,
}));

import { instalando } from "../src/lib/instalando.svelte";
import { hinario } from "../src/lib/hinario/hinario.svelte";
import { partituras } from "../src/lib/partituras/partituras.svelte";

const OCIOSO = { fase: "ocioso", progresso: 0, erro: null };

beforeEach(() => {
  vi.clearAllMocks();
  m.biblioteca.pacote = { exemplo: false };
});

const casos = [
  { nome: "hinario", loja: hinario, remover: () => m.biblioteca.remover },
  { nome: "partituras", loja: partituras, remover: () => m.biblioteca.removerPartituras },
];

describe.each(casos)("$nome", ({ loja, remover }) => {
  it("começa ocioso", () => {
    expect(loja.andamento).toEqual(OCIOSO);
  });

  it("baixar: relata o andamento, volta a ocioso e libera a trava", async () => {
    const vistos: unknown[] = [];
    m.baixarEInstalar.mockImplementation(async (_p, _d, aoMudar) => {
      aoMudar("baixando", 0.5);
      vistos.push({ ...loja.andamento }, instalando.ocupado);
      return { recusadas: [] };
    });
    await loja.baixar();
    expect(vistos).toEqual([{ fase: "baixando", progresso: 0.5, erro: null }, true]);
    expect(loja.andamento).toEqual(OCIOSO);
    expect(instalando.ocupado).toBe(false);
  });

  it("baixar: um erro qualquer vira texto bruto e a trava é liberada", async () => {
    m.baixarEInstalar.mockRejectedValueOnce(new Error("boom"));
    await loja.baixar();
    expect(loja.andamento).toEqual({ fase: "erro", progresso: 0, erro: { bruto: "Error: boom" } });
    expect(instalando.ocupado).toBe(false);
  });

  it("baixar: não faz nada com a trava ocupada", async () => {
    instalando.ocupar();
    await loja.baixar();
    instalando.liberar();
    expect(m.baixarEInstalar).not.toHaveBeenCalled();
  });

  it("remover: fica ocioso; se falhar, guarda o texto bruto", async () => {
    m.baixarEInstalar.mockRejectedValueOnce(new Error("x"));
    await loja.baixar();
    await loja.remover();
    expect(loja.andamento).toEqual(OCIOSO);
    remover().mockRejectedValueOnce("falhou");
    await loja.remover();
    expect(loja.andamento).toEqual({ fase: "erro", progresso: 0, erro: { bruto: "falhou" } });
  });
});

describe("hinario", () => {
  it("instalar importa o texto e limpa a reprodução; remover também limpa", async () => {
    m.baixarEInstalar.mockImplementation(async (_p, dep) => dep.instalar(new TextEncoder().encode("{}")));
    m.biblioteca.importar.mockResolvedValue("ok");
    await hinario.baixar();
    expect(m.biblioteca.importar).toHaveBeenCalledOnce();
    expect(m.reproducao.limpar).toHaveBeenCalledOnce();
    await hinario.remover();
    expect(m.reproducao.limpar).toHaveBeenCalledTimes(2);
  });
});

describe("partituras", () => {
  it("guarda as recusadas e as zera ao remover", async () => {
    m.baixarEInstalar.mockResolvedValueOnce({ recusadas: [{ numero: 1 }] });
    await partituras.baixar();
    expect(partituras.recusadas).toEqual([{ numero: 1 }]);
    await partituras.remover();
    expect(partituras.recusadas).toEqual([]);
  });

  it("sem hinário instalado (ou só o exemplo), não baixa", async () => {
    m.biblioteca.pacote = null;
    await partituras.baixar();
    m.biblioteca.pacote = { exemplo: true };
    await partituras.baixar();
    expect(m.baixarEInstalar).not.toHaveBeenCalled();
  });
});
