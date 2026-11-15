import { describe, expect, it } from "vitest";
import { CHAVE_ESTILO, ESTILOS, ehEstilo } from "../src/lib/estilos";
// @ts-expect-error o projeto não instala @types/node (mesma solução do vite.config.js)
import { readFileSync } from "node:fs";
// @ts-expect-error idem
import { runInNewContext } from "node:vm";

// Lê o arquivo direto do disco: o Vitest devolve texto vazio para `.css?raw`, então o `?raw` não serve para o tema.css.
const ler = (caminho: string): string => readFileSync(new URL(`../${caminho}`, import.meta.url), "utf-8");
const appHtml = ler("src/app.html");
const temaCss = ler("src/lib/tema.css");

const outros = ESTILOS.filter((x) => x !== "normal");

describe("estilos de cor", () => {
  it("o normal vem primeiro e só os valores da lista valem", () => {
    expect(ESTILOS[0]).toBe("normal");
    for (const e of ESTILOS) expect(ehEstilo(e)).toBe(true);
    for (const ruim of ["", "Normal", "escuro", "claro", "sepia", null, undefined, 3, {}]) expect(ehEstilo(ruim)).toBe(false);
  });

  // O script de src/app.html aplica o estilo antes da primeira pintura e repete a lista à mão: se um estilo entrar ou sair
  // de ESTILOS e não do script, a tela piscaria (ou ficaria no normal) a cada abertura.
  describe("o script do app.html acompanha o módulo estilos.ts", () => {
    it("lê a mesma chave do localStorage", () => {
      expect(appHtml).toContain(`localStorage.getItem("${CHAVE_ESTILO}")`);
    });

    it("aplica exatamente os estilos que não são o normal (nem a mais, nem a menos)", () => {
      // A condição que atribui o atributo: só pode citar os estilos diferentes do normal.
      const condicao = appHtml.match(/if \(e === [^)]*\) document\.documentElement\.dataset\.estilo = e;/)?.[0] ?? "";
      expect(condicao, "não achei a linha que aplica o estilo").not.toBe("");
      const citados = [...condicao.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
      expect(citados.sort()).toEqual([...outros].sort());
    });

    // Executa o script de verdade num contexto isolado: aplica o que está salvo e não cria variável global.
    const executar = (salvo: Record<string, string>) => {
      const script = appHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? "";
      const documento = { documentElement: { dataset: {} as Record<string, string> } };
      const contexto: Record<string, unknown> = {
        localStorage: { getItem: (k: string) => salvo[k] ?? null },
        document: documento,
      };
      runInNewContext(script, contexto);
      return { aplicado: documento.documentElement.dataset, globais: Object.keys(contexto).sort() };
    };

    it("aplica o modo e o estilo salvos antes da primeira pintura", () => {
      expect(executar({ tema: "escuro", estilo: "marinho" }).aplicado).toEqual({ tema: "escuro", estilo: "marinho" });
      expect(executar({ tema: "claro", estilo: "pergaminho" }).aplicado).toEqual({ tema: "claro", estilo: "pergaminho" });
      // o modo "sistema" e o estilo "normal" não levam atributo, e valor desconhecido é ignorado
      expect(executar({ tema: "sistema", estilo: "normal" }).aplicado).toEqual({});
      expect(executar({ tema: "roxo", estilo: "sepia" }).aplicado).toEqual({});
      expect(executar({}).aplicado).toEqual({});
    });

    it("não deixa variáveis globais (window.t, window.e)", () => {
      expect(executar({ tema: "escuro", estilo: "marinho" }).globais).toEqual(["document", "localStorage"]);
    });
  });

  it("o tema.css tem os três blocos (claro, escuro do sistema e escuro escolhido) de cada estilo", () => {
    for (const e of outros) {
      const claro = temaCss.match(new RegExp(`^:root\\[data-estilo="${e}"\\] \\{`, "m"));
      // O escuro do sistema só vale com o aparelho no escuro: precisa estar DENTRO do @media.
      const escuroSistema = temaCss.match(
        new RegExp(`@media \\(prefers-color-scheme: dark\\) \\{\\s*:root\\[data-estilo="${e}"\\]:not\\(\\[data-tema="claro"\\]\\) \\{`),
      );
      const escuroEscolhido = temaCss.match(new RegExp(`^:root\\[data-estilo="${e}"\\]\\[data-tema="escuro"\\] \\{`, "m"));
      expect(claro, `${e}: falta o bloco claro`).not.toBeNull();
      expect(escuroSistema, `${e}: falta o escuro do sistema dentro do @media`).not.toBeNull();
      expect(escuroEscolhido, `${e}: falta o escuro escolhido`).not.toBeNull();
    }
  });
});
