import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { CHAVE_AVISO_HINARIO, avisoDispensado, deveAvisar, dispensarAviso } from "../src/lib/hinario/aviso";
import { textoDoHinario } from "../src/lib/hinario/texto";
import manifesto from "../src/lib/hinario/manifesto.json";
import { baixarEInstalar, extrairDaPastaReal, type Dependencias } from "../src/lib/partituras/baixar";
import type { PacotePartituras } from "../src/lib/partituras/tipos";
import { ErroPacote, sha256Hex } from "../src/lib/sons/extrair";

const JSON_DO_HINARIO = JSON.stringify({ versao: 1, hinario: { id: "x", nome: "Hinário de teste ✓" }, hinos: [] });
const BYTES = new TextEncoder().encode(JSON_DO_HINARIO);

async function pacoteDe(b: Uint8Array, mudar: Partial<PacotePartituras> = {}): Promise<PacotePartituras> {
  return { url: "https://fb.hm.hv2.xyz/p", arquivo: "hinario-001.json", bytes: b.length, sha256: await sha256Hex(b), ...mudar };
}

function falsas(baixado: Uint8Array) {
  const instalado: string[] = [];
  const dep: Dependencias<string> = {
    baixar: async (_u, _e, progresso) => (progresso(1), baixado),
    sha256: sha256Hex,
    extrairDaPasta: extrairDaPastaReal,
    instalar: async (b) => (instalado.push(textoDoHinario(b)), "ok"),
  };
  return { dep, instalado };
}

describe("o hinário baixável (o mesmo caminho conferido das partituras)", () => {
  it("o manifesto publicado tem o desenho certo (arquivo .json, tamanho e SHA-256 de 64 dígitos)", () => {
    expect(manifesto.versao).toBe(1);
    const p = manifesto.pacote;
    expect(p).not.toBeNull();
    expect(p!.url).toMatch(/^https:\/\/fb\.hm\.hv2\.xyz\//);
    expect(p!.arquivo).toMatch(/^hinario-\d+\.json$/);
    expect(p!.bytes).toBeGreaterThan(0);
    expect(p!.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("link do ARQUIVO: baixa, confere e entrega ao Rust o texto do hinário (UTF-8 inclusive)", async () => {
    const { dep, instalado } = falsas(BYTES);
    expect(await baixarEInstalar(await pacoteDe(BYTES), dep, () => {})).toBe("ok");
    expect(instalado).toEqual([JSON_DO_HINARIO]);
  });

  it("link da PASTA: tira o arquivo do hinário de dentro do zip, pelo nome, e o confere", async () => {
    const pasta = zipSync({ "hinario-001.json": BYTES, "partituras-006.zip": Uint8Array.from([1, 2, 3]) }, { level: 0 });
    const { dep, instalado } = falsas(pasta);
    await baixarEInstalar(await pacoteDe(BYTES), dep, () => {});
    expect(instalado).toEqual([JSON_DO_HINARIO]);
  });

  it("um arquivo adulterado (SHA-256 diferente) é recusado e nada chega ao Rust", async () => {
    const adulterado = new TextEncoder().encode(JSON_DO_HINARIO.replace("teste", "falso"));
    const { dep, instalado } = falsas(adulterado);
    await expect(baixarEInstalar(await pacoteDe(BYTES, { bytes: adulterado.length }), dep, () => {})).rejects.toBeInstanceOf(ErroPacote);
    expect(instalado).toEqual([]);
  });

  it("bytes que não são UTF-8 válido não viram texto (o Rust nunca recebe lixo)", () => {
    expect(() => textoDoHinario(Uint8Array.from([0xff, 0xfe, 0xfd]))).toThrow();
  });
});

describe("o aviso do primeiro acesso", () => {
  it("aparece só com o conteúdo carregado, sendo o de exemplo, com hinário publicado e sem ter sido dispensado", () => {
    expect(deveAvisar({ exemplo: true }, true, false)).toBe(true);
    expect(deveAvisar(null, true, false)).toBe(false); // ainda carregando
    expect(deveAvisar({ exemplo: false }, true, false)).toBe(false); // já tem o hinário de verdade
    expect(deveAvisar({ exemplo: true }, false, false)).toBe(false); // nada publicado para baixar
    expect(deveAvisar({ exemplo: true }, true, true)).toBe(false); // dispensado
  });

  it("a escolha de dispensar é lembrada, e uma falha de armazenamento é ignorada", () => {
    const m = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    expect(avisoDispensado()).toBe(false);
    dispensarAviso();
    expect(m.get(CHAVE_AVISO_HINARIO)).toBe("dispensado");
    expect(avisoDispensado()).toBe(true);
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(avisoDispensado()).toBe(false);
    expect(() => dispensarAviso()).not.toThrow();
  });
});
