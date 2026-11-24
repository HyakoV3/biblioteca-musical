import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { baixarEInstalar, extrairDaPastaReal, type Dependencias, type Fase } from "../src/lib/partituras/baixar";
import manifesto from "../src/lib/partituras/manifesto.json";
import type { PacotePartituras } from "../src/lib/partituras/tipos";
import { ErroPacote, sha256Hex } from "../src/lib/sons/extrair";

const ZIP = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4, 5, 6, 7, 8]); // o zip de partituras (de mentira: só importa o que se confere)
const NOME = "partituras-001.zip";

/** O pacote do manifesto para o zip falso: tamanho e SHA-256 de verdade. */
async function pacoteDe(zip: Uint8Array, mudar: Partial<PacotePartituras> = {}): Promise<PacotePartituras> {
  return { url: "https://fb.hm.hv2.xyz/p", arquivo: NOME, bytes: zip.length, sha256: await sha256Hex(zip), ...mudar };
}

/** A pasta em zip que o File Browser entrega para um link de pasta: o zip das partituras dentro de uma pasta, mais o que mais houver. */
function pastaEmZip(arquivos: Record<string, Uint8Array>): Uint8Array {
  return zipSync(arquivos, { level: 0 });
}

/** Dependências falsas: guarda o que foi chamado, na ordem. `baixado` é o que o servidor entrega. */
function falsas(baixado: Uint8Array, opcoes: { falhaNaRede?: boolean; falhaAoInstalar?: boolean } = {}) {
  const chamadas: string[] = [];
  const dep: Dependencias<string> = {
    baixar: async (url, estimativa, progresso) => {
      chamadas.push(`baixar ${url} ${estimativa}`);
      if (opcoes.falhaNaRede) throw new ErroPacote("rede", "sem conexão");
      progresso(0.5);
      progresso(1);
      return baixado;
    },
    sha256: async (d) => {
      chamadas.push("sha256");
      return sha256Hex(d);
    },
    extrairDaPasta: async (pasta, pacote) => {
      chamadas.push("extrairDaPasta");
      return extrairDaPastaReal(pasta, pacote);
    },
    instalar: async (d) => {
      chamadas.push(`instalar ${d.length}`);
      if (opcoes.falhaAoInstalar) throw '["partituras_sem_hinario"]';
      return "instalado";
    },
  };
  return { dep, chamadas };
}

describe("baixar e instalar o pacote de partituras: link de um ARQUIVO (o servidor entrega o próprio zip)", () => {
  it("baixa, confere e instala, nesta ordem, avisando cada fase (sem abrir pasta nenhuma)", async () => {
    const { dep, chamadas } = falsas(ZIP);
    const fases: [Fase, number][] = [];
    const r = await baixarEInstalar(await pacoteDe(ZIP), dep, (f, p) => fases.push([f, p]));
    expect(r).toBe("instalado");
    expect(chamadas).toEqual([`baixar https://fb.hm.hv2.xyz/p ${ZIP.length}`, "sha256", `instalar ${ZIP.length}`]);
    expect(fases).toEqual([["baixando", 0], ["baixando", 0.5], ["baixando", 1], ["conferindo", 1], ["instalando", 0]]);
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

describe("baixar e instalar o pacote de partituras: link de uma PASTA (o servidor entrega a pasta inteira em zip)", () => {
  it("abre a pasta, acha o zip das partituras pelo nome (com o prefixo da pasta), confere e instala o de DENTRO", async () => {
    const pasta = pastaEmZip({ "BibliotecaMusicalPartituras/partituras-001.zip": ZIP, "BibliotecaMusicalPartituras/leia-me.txt": new TextEncoder().encode("oi") });
    const { dep, chamadas } = falsas(pasta);
    const r = await baixarEInstalar(await pacoteDe(ZIP), dep, () => {});
    expect(r).toBe("instalado");
    // o de dentro é o que chega ao Rust (12 bytes), e não a pasta
    expect(chamadas.at(-1)).toBe(`instalar ${ZIP.length}`);
    expect(chamadas).toContain("extrairDaPasta");
  });

  it("zip das partituras SEM pasta na frente, ou com várias pastas, também é achado pelo nome", async () => {
    for (const nome of [NOME, `a/${NOME}`, `a/b/c/${NOME}`]) {
      const { dep } = falsas(pastaEmZip({ [nome]: ZIP }));
      await expect(baixarEInstalar(await pacoteDe(ZIP), dep, () => {}), nome).resolves.toBe("instalado");
    }
  });

  it("o zip de dentro com o SHA-256 diferente do manifesto é descartado e NADA chega ao Rust", async () => {
    const adulterado = Uint8Array.from(ZIP);
    adulterado[5] ^= 0xff; // mesmo tamanho, outro conteúdo
    const { dep, chamadas } = falsas(pastaEmZip({ [`P/${NOME}`]: adulterado }));
    await expect(baixarEInstalar(await pacoteDe(ZIP), dep, () => {})).rejects.toMatchObject({ codigo: "integridade" });
    expect(chamadas.some((c) => c.startsWith("instalar"))).toBe(false);
  });

  it("o zip de dentro com o tamanho diferente do manifesto é descartado", async () => {
    const maior = Uint8Array.from([...ZIP, 9]);
    const { dep, chamadas } = falsas(pastaEmZip({ [`P/${NOME}`]: maior }));
    await expect(baixarEInstalar(await pacoteDe(ZIP), dep, () => {})).rejects.toMatchObject({ codigo: "integridade" });
    expect(chamadas.some((c) => c.startsWith("instalar"))).toBe(false);
  });

  it("pasta sem o zip esperado (só outros arquivos) é recusada como 'faltando'", async () => {
    const { dep, chamadas } = falsas(pastaEmZip({ "P/outro.zip": ZIP, "P/partituras-999.zip": ZIP }));
    await expect(baixarEInstalar(await pacoteDe(ZIP), dep, () => {})).rejects.toMatchObject({ codigo: "faltando" });
    expect(chamadas.some((c) => c.startsWith("instalar"))).toBe(false);
  });

  it("o que veio não é zip nenhum (página de erro, por exemplo): recusado, sem instalar", async () => {
    const { dep, chamadas } = falsas(new TextEncoder().encode("<html>404</html>"));
    await expect(baixarEInstalar(await pacoteDe(ZIP), dep, () => {})).rejects.toMatchObject({ codigo: "zip" });
    expect(chamadas.some((c) => c.startsWith("instalar"))).toBe(false);
  });

  it("um arquivo que parece o zip pelo tamanho, mas com outro SHA-256 (trocado no servidor), não é instalado como se fosse", async () => {
    const trocado = Uint8Array.from(ZIP);
    trocado[0] = 0x00;
    const { dep, chamadas } = falsas(trocado); // mesmo tamanho do manifesto, conteúdo diferente, e não é uma pasta zipada
    await expect(baixarEInstalar(await pacoteDe(ZIP), dep, () => {})).rejects.toBeInstanceOf(ErroPacote);
    expect(chamadas.some((c) => c.startsWith("instalar"))).toBe(false);
  });
});

describe("manifesto de partituras", () => {
  it("sem pacote publicado, `pacote` é null (o botão Baixar não aparece), e tudo o que existe tem endereço, nome, tamanho e SHA-256 válidos", () => {
    expect(manifesto.versao).toBe(1);
    const p = manifesto.pacote as null | PacotePartituras;
    if (p === null) return;
    expect(p.url).toMatch(/^https:\/\/(fb\.hm\.hv2\.xyz\/|github\.com\/HyakoV3\/biblioteca-musical-pacotes\/releases\/download\/)/); // só os endereços que o app pode acessar (capabilities/default.json)
    expect(p.arquivo).toMatch(/^[\w.-]+\.zip$/);
    expect(p.arquivo).toBe(`partituras-${p.sha256.slice(0, 8)}.zip`); // o nome leva os 8 primeiros caracteres do SHA-256
    expect(p.bytes).toBeGreaterThan(0);
    expect(p.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
