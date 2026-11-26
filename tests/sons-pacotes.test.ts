import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PacoteSom } from "../src/lib/sons/tipos";

// O store dos sons gravados, com o download, a conferência e o Cache trocados por falsos: o que se testa é a MÁQUINA DE ESTADOS (duplo toque,
// rollback, remoção que falha, o que conta como instalado), não o Cache do navegador.
const dados = new TextEncoder().encode("conteudo");
const SHA = [...new Uint8Array(await crypto.subtle.digest("SHA-256", dados))].map((b) => b.toString(16).padStart(2, "0")).join(""); // o app grava o hash REAL dos bytes
const pacote: PacoteSom = {
  id: "teste",
  url: "https://exemplo.invalid/teste.zip",
  bytesZip: 500,
  arquivos: [
    { instrumento: "flute", arquivo: "flute-mp3.js", bytes: dados.length, sha256: SHA },
    { instrumento: "drawbar_organ", arquivo: "drawbar_organ-mp3.js", bytes: dados.length, sha256: SHA },
  ],
};

const falsos = vi.hoisted(() => ({
  guardados: new Map<string, string>(),
  baixarZip: vi.fn(),
  extrair: vi.fn(),
  guardar: vi.fn(),
  apagar: vi.fn(),
  disponivel: vi.fn(() => true),
  listar: vi.fn(async () => [...falsos.guardados].map(([arquivo, sha256]) => ({ arquivo, sha256 }))),
}));

vi.mock("../src/lib/sons/manifesto", () => ({ MANIFESTO: { versao: 1, pacotes: [pacote] } }));
vi.mock("../src/lib/sons/baixar", () => ({ baixarZip: falsos.baixarZip }));
vi.mock("../src/lib/sons/extrair", async (original) => ({
  ...(await original<typeof import("../src/lib/sons/extrair")>()),
  extrairEConferir: falsos.extrair,
}));
vi.mock("../src/lib/sons/armazenamento", () => ({
  disponivel: falsos.disponivel,
  pedirPersistencia: async () => {},
  guardar: falsos.guardar,
  apagar: falsos.apagar,
  listar: () => falsos.listar(),
}));

const { sons } = await import("../src/lib/sons/pacotes.svelte");

const dois = () => new Map(pacote.arquivos.map((a) => [a.arquivo, dados] as const));

beforeEach(async () => {
  falsos.guardados.clear();
  falsos.baixarZip.mockReset().mockResolvedValue(new Uint8Array(1));
  falsos.extrair.mockReset().mockImplementation(async () => dois());
  falsos.guardar.mockReset().mockImplementation(async (nome: string, _d: Uint8Array, sha: string) => void falsos.guardados.set(nome, sha));
  falsos.apagar.mockReset().mockImplementation(async (nomes: string[]) => nomes.forEach((n) => falsos.guardados.delete(n)));
  falsos.disponivel.mockReturnValue(true);
  await sons.atualizar();
});

describe("sons: baixar", () => {
  it("baixa, confere, grava com o SHA do manifesto e passa a contar como instalado", async () => {
    await sons.baixar("teste");
    expect(sons.pacoteInstalado(pacote)).toBe(true);
    expect(sons.andamento("teste").fase).toBe("ocioso");
    expect(falsos.guardados.get("flute-mp3.js")).toBe(SHA);
  });

  it("a estimativa do progresso é o tamanho do zip, não a soma dos arquivos", async () => {
    await sons.baixar("teste");
    expect(falsos.baixarZip.mock.calls[0][1]).toBe(500);
  });

  it("duplo toque durante o download: o segundo é ignorado", async () => {
    let terminar!: (z: Uint8Array) => void;
    falsos.baixarZip.mockReturnValue(new Promise<Uint8Array>((r) => (terminar = r)));
    const a = sons.baixar("teste");
    await sons.baixar("teste");
    expect(falsos.baixarZip).toHaveBeenCalledTimes(1);
    terminar(new Uint8Array(1));
    await a;
    expect(sons.pacoteInstalado(pacote)).toBe(true);
  });

  it("falha na rede: o erro aparece com o código e nada é gravado", async () => {
    const { ErroPacote } = await import("../src/lib/sons/extrair");
    falsos.baixarZip.mockRejectedValue(new ErroPacote("rede", "caiu"));
    await sons.baixar("teste");
    expect(sons.andamento("teste")).toMatchObject({ fase: "erro", erro: "rede" });
    expect(falsos.guardar).not.toHaveBeenCalled();
  });

  it("zip adulterado: o erro de integridade aparece e nada é gravado", async () => {
    const { ErroPacote } = await import("../src/lib/sons/extrair");
    falsos.extrair.mockRejectedValue(new ErroPacote("integridade", "flute-mp3.js"));
    await sons.baixar("teste");
    expect(sons.andamento("teste")).toMatchObject({ fase: "erro", erro: "integridade" });
    expect(sons.pacoteInstalado(pacote)).toBe(false);
  });

  it("falha no meio da gravação: apaga o que já gravou (nada de pacote pela metade)", async () => {
    let n = 0;
    falsos.guardar.mockImplementation(async (nome: string, _d: Uint8Array, sha: string) => {
      if (++n === 2) throw new Error("cota excedida");
      falsos.guardados.set(nome, sha);
    });
    await sons.baixar("teste");
    expect(sons.andamento("teste")).toMatchObject({ fase: "erro", erro: "armazenamento" });
    expect(falsos.guardados.size).toBe(0);
    expect(falsos.apagar).toHaveBeenCalledWith(["flute-mp3.js"]);
  });

  it("sem Cache API: erro de armazenamento, sem baixar", async () => {
    falsos.disponivel.mockReturnValue(false);
    await sons.baixar("teste");
    expect(sons.andamento("teste")).toMatchObject({ fase: "erro", erro: "armazenamento" });
    expect(falsos.baixarZip).not.toHaveBeenCalled();
  });

  it("depois de um erro dá para tentar de novo", async () => {
    falsos.baixarZip.mockRejectedValueOnce(new Error("travou"));
    await sons.baixar("teste");
    expect(sons.andamento("teste").fase).toBe("erro");
    await sons.baixar("teste");
    expect(sons.pacoteInstalado(pacote)).toBe(true);
  });
});

describe("sons: instalado só se o SHA guardado bate com o manifesto", () => {
  it("mesmo nome, outro conteúdo: não conta como instalado", async () => {
    falsos.guardados.set("flute-mp3.js", "b".repeat(64)); // o nome está no manifesto, o conteúdo guardado é outro
    falsos.guardados.set("drawbar_organ-mp3.js", SHA);
    await sons.atualizar();
    expect(sons.pacoteInstalado(pacote)).toBe(false);
    expect(sons.instalado("real_orgao_tirantes")).toBe(true);
    expect(sons.instalado("real_flauta")).toBe(false);
  });
});

describe("sons: atualizar", () => {
  it("uma leitura lenta que termina depois de uma mais nova não desfaz o resultado dela", async () => {
    await sons.baixar("teste");
    const antiga = [...falsos.guardados].map(([arquivo, sha256]) => ({ arquivo, sha256 })); // o que havia ANTES da remoção
    let soltar!: () => void;
    falsos.listar.mockImplementationOnce(() => new Promise((r) => (soltar = () => r(antiga))));
    const lenta = sons.atualizar(); // a leitura do início do app, ainda esperando o Cache
    await sons.remover("teste"); // apaga e lê de novo (rápido): nada instalado
    soltar();
    await lenta;
    expect(sons.pacoteInstalado(pacote)).toBe(false);
  });
});

describe("sons: remover", () => {
  it("apaga os arquivos do pacote e atualiza", async () => {
    await sons.baixar("teste");
    await sons.remover("teste");
    expect(sons.pacoteInstalado(pacote)).toBe(false);
    expect(sons.andamento("teste").fase).toBe("ocioso");
  });

  it("remover durante um download do mesmo pacote é ignorado (e um id desconhecido não vira rejeição)", async () => {
    let terminar!: (z: Uint8Array) => void;
    falsos.baixarZip.mockReturnValue(new Promise<Uint8Array>((r) => (terminar = r)));
    const a = sons.baixar("teste");
    await sons.remover("teste");
    expect(falsos.apagar).not.toHaveBeenCalled();
    expect(sons.andamento("teste").fase).toBe("baixando");
    terminar(new Uint8Array(1));
    await a;
    expect(sons.pacoteInstalado(pacote)).toBe(true);
    await expect(sons.remover("nao-existe")).resolves.toBeUndefined();
  });

  it("o Cache recusa apagar: mostra o erro (sem rejeição solta) e relê o que ficou", async () => {
    await sons.baixar("teste");
    falsos.apagar.mockRejectedValue(new Error("bloqueado"));
    await expect(sons.remover("teste")).resolves.toBeUndefined();
    expect(sons.andamento("teste")).toMatchObject({ fase: "erro", erro: "armazenamento" });
    expect(sons.pacoteInstalado(pacote)).toBe(true);
  });
});
