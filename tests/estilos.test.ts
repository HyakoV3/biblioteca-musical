import { describe, expect, it } from "vitest";
import { ESTILOS, ehEstilo } from "../src/lib/estilos";
// @ts-expect-error o projeto não instala @types/node (mesma solução do vite.config.js)
import { readFileSync } from "node:fs";

// Lê o arquivo direto do disco: o Vitest devolve texto vazio para `.css?raw`, então o `?raw` não serve para o tema.css.
const ler = (caminho: string): string => readFileSync(new URL(`../${caminho}`, import.meta.url), "utf-8");
const appHtml = ler("src/app.html");
const temaCss = ler("src/lib/tema.css");

describe("estilos de cor", () => {
  it("o normal vem primeiro e só os valores da lista valem", () => {
    expect(ESTILOS[0]).toBe("normal");
    for (const e of ESTILOS) expect(ehEstilo(e)).toBe(true);
    for (const ruim of ["", "Normal", "escuro", "claro", "sepia", null, undefined, 3, {}]) expect(ehEstilo(ruim)).toBe(false);
  });

  // O script de src/app.html aplica o estilo antes da primeira pintura e repete a lista à mão: se um estilo novo entrar
  // aqui e não lá, a tela piscaria (ou ficaria no normal) a cada abertura.
  it("o app.html aplica todos os estilos que não são o normal, lendo a chave certa", () => {
    const html = appHtml;
    expect(html).toContain('localStorage.getItem("estilo")');
    for (const e of ESTILOS.filter((x) => x !== "normal")) expect(html, `app.html sem o estilo ${e}`).toContain(`"${e}"`);
    // O normal não leva atributo: a condição que atribui o estilo só pode citar os outros.
    const condicao = html.match(/if \(e === [^)]*\) document\.documentElement\.dataset\.estilo = e;/)?.[0] ?? "";
    expect(condicao, "não achei a linha que aplica o estilo").not.toBe("");
    expect(condicao).not.toContain("normal");
  });

  it("o tema.css tem os três blocos (claro, escuro do sistema e escuro escolhido) de cada estilo", () => {
    const css = temaCss;
    for (const e of ESTILOS.filter((x) => x !== "normal")) {
      const claro = css.match(new RegExp(`^:root\\[data-estilo="${e}"\\] \\{`, "m"));
      const escuroSistema = css.match(new RegExp(`:root\\[data-estilo="${e}"\\]:not\\(\\[data-tema="claro"\\]\\) \\{`));
      const escuroEscolhido = css.match(new RegExp(`^:root\\[data-estilo="${e}"\\]\\[data-tema="escuro"\\] \\{`, "m"));
      expect(claro, `${e}: falta o bloco claro`).not.toBeNull();
      expect(escuroSistema, `${e}: falta o escuro do sistema`).not.toBeNull();
      expect(escuroEscolhido, `${e}: falta o escuro escolhido`).not.toBeNull();
    }
  });
});
