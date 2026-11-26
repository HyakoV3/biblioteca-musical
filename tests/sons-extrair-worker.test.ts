import { zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import type { PacoteSom } from "../src/lib/sons/tipos";

// PERF-005: a descompactação roda num Web Worker (`unzip` do fflate). Se o ambiente não deixa criar o worker, cai na versão síncrona; um erro do zip em si não cai.
const falha = vi.hoisted(() => ({ modo: "erro" as "erro" | "mudo" | "nulo", mensagem: "Failed to construct 'Worker': blocked by CSP" }));
vi.mock("fflate", async (original) => {
  const real = await original<typeof import("fflate")>();
  return {
    ...real,
    // "erro": o worker falha com mensagem; "mudo": nunca responde (o fflate não escuta o onerror do worker); "nulo": responde (null, null).
    unzip: (_d: Uint8Array, _o: unknown, cb: (e: Error | null, d: unknown) => void) => {
      if (falha.modo === "erro") cb(new Error(falha.mensagem), null);
      else if (falha.modo === "nulo") cb(null, null);
    },
  };
});

const { ErroPacote, TEMPO_DO_WORKER_MS, extrairEConferir } = await import("../src/lib/sons/extrair");

const enc = (s: string) => new TextEncoder().encode(s);
async function pacoteDe(dados: Uint8Array): Promise<PacoteSom> {
  const h = await crypto.subtle.digest("SHA-256", dados as BufferSource);
  const sha = [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { arquivos: [{ instrumento: "x", arquivo: "x-mp3.js", bytes: dados.length, sha256: sha }] } as unknown as PacoteSom;
}

describe("extrairEConferir sem Web Worker", () => {
  it("cai na versão síncrona quando o worker não pode ser criado", async () => {
    falha.modo = "erro";
    falha.mensagem = "Failed to construct 'Worker': blocked by CSP";
    const dados = enc("conteudo do som");
    const zip = zipSync({ "Pasta/x-mp3.js": dados }, { level: 0 });
    const r = await extrairEConferir(zip, await pacoteDe(dados));
    expect(r.get("x-mp3.js")).toEqual(dados);
  });

  it("um zip ruim NÃO cai na versão síncrona: falha como zip", async () => {
    falha.modo = "erro";
    falha.mensagem = "invalid zip data";
    const dados = enc("conteudo");
    await expect(extrairEConferir(enc("isto não é um zip"), await pacoteDe(dados))).rejects.toBeInstanceOf(ErroPacote);
  });

  it("worker que nunca responde: depois do limite de tempo, cai na versão síncrona", async () => {
    vi.useFakeTimers();
    try {
      falha.modo = "mudo";
      const dados = enc("conteudo do som");
      const zip = zipSync({ "Pasta/x-mp3.js": dados }, { level: 0 });
      const p = extrairEConferir(zip, await pacoteDe(dados));
      await vi.advanceTimersByTimeAsync(TEMPO_DO_WORKER_MS + 1);
      expect((await p).get("x-mp3.js")).toEqual(dados);
    } finally {
      vi.useRealTimers();
    }
  });

  it("worker que responde vazio (null, null): cai na versão síncrona", async () => {
    falha.modo = "nulo";
    const dados = enc("conteudo do som");
    const zip = zipSync({ "Pasta/x-mp3.js": dados }, { level: 0 });
    expect((await extrairEConferir(zip, await pacoteDe(dados))).get("x-mp3.js")).toEqual(dados);
  });
});
