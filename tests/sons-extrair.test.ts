import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { ErroPacote, LIMITE_EXTRAIDO, extrairEConferir } from "../src/lib/sons/extrair";
import type { ArquivoSom, PacoteSom } from "../src/lib/sons/tipos";

// Zips SINTÉTICOS: o teste monta os arquivos, calcula o tamanho e o SHA-256 deles e confere o que o app recusa.
const enc = (s: string) => new TextEncoder().encode(s);

async function sha256(dados: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", dados as BufferSource);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function arquivo(instrumento: string, bytes: Uint8Array): Promise<ArquivoSom> {
  return { instrumento, arquivo: `${instrumento}-mp3.js`, bytes: bytes.length, sha256: await sha256(bytes) };
}

/** Conteúdo determinístico de `n` bytes. */
const conteudo = (n: number, semente: number) => Uint8Array.from({ length: n }, (_, i) => (i * 31 + semente) & 255);

const montar = (mapa: Record<string, Uint8Array>, prefixo = "Pasta/") =>
  zipSync(Object.fromEntries(Object.entries(mapa).map(([n, d]) => [prefixo + n, d])), { level: 0 });

const erroDe = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return null;
  } catch (e) {
    return e instanceof ErroPacote ? e.codigo : `outro: ${e}`;
  }
};

async function cenario() {
  const flauta = conteudo(5000, 1);
  const orgao = conteudo(7000, 2);
  const af = await arquivo("flute", flauta);
  const ao = await arquivo("drawbar", orgao);
  const pacote: PacoteSom = { id: "teste", url: "https://exemplo.invalid/", arquivos: [af, ao] };
  const um: PacoteSom = { id: "um", url: "https://exemplo.invalid/", arquivos: [af] };
  return { flauta, orgao, af, ao, pacote, um };
}

describe("extrairEConferir", () => {
  it("extrai e confere os arquivos do manifesto, em qualquer pasta do zip", async () => {
    const c = await cenario();
    const r = await extrairEConferir(montar({ [c.af.arquivo]: c.flauta, [c.ao.arquivo]: c.orgao }, "qualquer/pasta/"), c.pacote);
    expect([...r.keys()].sort()).toEqual([c.af.arquivo, c.ao.arquivo].sort());
    expect(r.get(c.af.arquivo)).toEqual(c.flauta);
  });

  it("ignora (sem nem abrir) arquivos que o manifesto não espera", async () => {
    const c = await cenario();
    const zip = montar({ [c.af.arquivo]: c.flauta, "intruso.js": enc("alert(1)"), "../../etc/passwd": enc("x") });
    const r = await extrairEConferir(zip, c.um);
    expect([...r.keys()]).toEqual([c.af.arquivo]);
  });

  it("recusa 1 byte trocado e arquivo truncado (integridade)", async () => {
    const c = await cenario();
    const alterado = new Uint8Array(c.flauta);
    alterado[100] ^= 1;
    expect(await erroDe(() => extrairEConferir(montar({ [c.af.arquivo]: alterado }), c.um))).toBe("integridade");
    expect(await erroDe(() => extrairEConferir(montar({ [c.af.arquivo]: c.flauta.slice(0, -1) }), c.um))).toBe("integridade");
  });

  it("recusa zip com arquivo esperado ausente", async () => {
    const c = await cenario();
    expect(await erroDe(() => extrairEConferir(montar({ "outro.js": enc("x") }), c.um))).toBe("faltando");
    // com 2 esperados e só 1 presente
    expect(await erroDe(() => extrairEConferir(montar({ [c.af.arquivo]: c.flauta }), c.pacote))).toBe("faltando");
  });

  it("recusa o que não é zip e o zip vazio", async () => {
    const c = await cenario();
    expect(await erroDe(() => extrairEConferir(enc("isto não é um zip"), c.um))).toBe("zip");
    expect(await erroDe(() => extrairEConferir(new Uint8Array(0), c.um))).toBe("zip");
  });

  it("recusa zip-bomba pelo tamanho declarado, sem descompactar tudo", async () => {
    const c = await cenario();
    // 101 MB de zeros cabem em poucos KB compactados
    const bomba = zipSync({ [c.af.arquivo]: new Uint8Array(LIMITE_EXTRAIDO + 1024 * 1024) }, { level: 1 });
    expect(bomba.length).toBeLessThan(1_000_000);
    expect(await erroDe(() => extrairEConferir(bomba, c.um))).toBe("tamanho");
  });

  it("recusa o nome esperado que aparece duas vezes (em pastas diferentes)", async () => {
    const c = await cenario();
    const zip = zipSync({ ["a/" + c.af.arquivo]: c.flauta, ["b/" + c.af.arquivo]: c.flauta }, { level: 0 });
    expect(await erroDe(() => extrairEConferir(zip, c.um))).toBe("zip");
  });
});
