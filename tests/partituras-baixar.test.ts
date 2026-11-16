import { describe, expect, it } from "vitest";
import { baixarEInstalar, type Dependencias, type Fase } from "../src/lib/partituras/baixar";
import { ErroPacote, sha256Hex } from "../src/lib/sons/extrair";
import manifesto from "../src/lib/partituras/manifesto.json";

const ZIP = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8]);

/** O pacote do manifesto para o zip falso: tamanho e SHA-256 de verdade. */
async function pacoteDe(zip: Uint8Array, mudar: Partial<{ bytes: number; sha256: string }> = {}) {
  return { url: "https://exemplo.invalido/p.zip", bytes: zip.length, sha256: await sha256Hex(zip), ...mudar };
}

/** Dependências falsas: guarda o que foi chamado, na ordem. */
function falsas(zip: Uint8Array, opcoes: { falhaNaRede?: boolean; falhaAoInstalar?: boolean } = {}) {
  const chamadas: string[] = [];
  const dep: Dependencias<string> = {
    baixar: async (url, estimativa, progresso) => {
      chamadas.push(`baixar ${url} ${estimativa}`);
      if (opcoes.falhaNaRede) throw new ErroPacote("rede", "sem conexão");
      progresso(0.5);
      progresso(1);
      return zip;
    },
    sha256: async (d) => {
      chamadas.push("sha256");
      return sha256Hex(d);
    },
    instalar: async (d) => {
      chamadas.push(`instalar ${d.length}`);
      if (opcoes.falhaAoInstalar) throw '["partituras_sem_hinario"]';
      return "instalado";
    },
  };
  return { dep, chamadas };
}

describe("baixar e instalar o pacote de partituras", () => {
  it("baixa, confere e instala, nesta ordem, avisando cada fase", async () => {
    const { dep, chamadas } = falsas(ZIP);
    const fases: [Fase, number][] = [];
    const r = await baixarEInstalar(await pacoteDe(ZIP), dep, (f, p) => fases.push([f, p]));
    expect(r).toBe("instalado");
    expect(chamadas).toEqual([`baixar https://exemplo.invalido/p.zip ${ZIP.length}`, "sha256", `instalar ${ZIP.length}`]);
    expect(fases).toEqual([["baixando", 0], ["baixando", 0.5], ["baixando", 1], ["conferindo", 1], ["instalando", 1]]);
  });

  it("zip com o SHA-256 diferente do manifesto é descartado e NADA chega ao Rust", async () => {
    const { dep, chamadas } = falsas(ZIP);
    const pacote = await pacoteDe(ZIP, { sha256: "0".repeat(64) });
    await expect(baixarEInstalar(pacote, dep, () => {})).rejects.toMatchObject({ codigo: "integridade" });
    expect(chamadas.some((c) => c.startsWith("instalar"))).toBe(false);
  });

  it("zip com o tamanho diferente do manifesto é descartado antes mesmo de calcular o SHA-256", async () => {
    for (const bytes of [ZIP.length - 1, ZIP.length + 1, 0]) {
      const { dep, chamadas } = falsas(ZIP);
      const pacote = await pacoteDe(ZIP, { bytes });
      await expect(baixarEInstalar(pacote, dep, () => {}), `bytes=${bytes}`).rejects.toMatchObject({ codigo: "integridade" });
      expect(chamadas, `bytes=${bytes}`).toEqual([`baixar https://exemplo.invalido/p.zip ${bytes}`]);
    }
  });

  it("o SHA-256 do manifesto vale em maiúsculas também", async () => {
    const { dep } = falsas(ZIP);
    const pacote = await pacoteDe(ZIP);
    pacote.sha256 = pacote.sha256.toUpperCase();
    await expect(baixarEInstalar(pacote, dep, () => {})).resolves.toBe("instalado");
  });

  it("falha de rede sai como erro de rede e nada é conferido nem instalado", async () => {
    const { dep, chamadas } = falsas(ZIP, { falhaNaRede: true });
    await expect(baixarEInstalar(await pacoteDe(ZIP), dep, () => {})).rejects.toMatchObject({ codigo: "rede" });
    expect(chamadas).toHaveLength(1);
  });

  it("o erro do Rust ao instalar passa como veio (a tela o traduz)", async () => {
    const { dep } = falsas(ZIP, { falhaAoInstalar: true });
    await expect(baixarEInstalar(await pacoteDe(ZIP), dep, () => {})).rejects.toBe('["partituras_sem_hinario"]');
  });
});

describe("manifesto de partituras", () => {
  it("sem pacote publicado, `pacote` é null (o botão Baixar não aparece), e tudo o que existe tem endereço, tamanho e SHA-256 válidos", () => {
    expect(manifesto.versao).toBe(1);
    const p = manifesto.pacote as null | { url: string; bytes: number; sha256: string };
    if (p === null) return;
    expect(p.url).toMatch(/^https:\/\/fb\.hm\.hv2\.xyz\//); // o único servidor que o app pode acessar (capabilities/default.json)
    expect(p.bytes).toBeGreaterThan(0);
    expect(p.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
