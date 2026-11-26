import { describe, expect, it } from "vitest";
// @ts-expect-error o projeto não instala @types/node (mesma solução do partitura-classes.test.ts)
import { readFileSync } from "node:fs";

// Fixa a configuração de segurança do app (auditoria 2026-11, onda 10): a CSP, as permissões da janela e o FileProvider. Quem afrouxar uma delas vê o teste vermelho e explica por quê.
const raiz = new URL("../", import.meta.url);
const ler = (caminho: string): string => readFileSync(new URL(caminho, raiz), "utf-8");

const conf = JSON.parse(ler("src-tauri/tauri.conf.json")) as { app: { security: { csp: string | null } } };

function diretiva(csp: string, nome: string): string[] {
  const d = csp.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${nome} `));
  return d ? d.split(/\s+/).slice(1) : [];
}

describe("CSP da janela", () => {
  const csp = conf.app.security.csp;

  it("existe (não é null) e tem default-src 'self'", () => {
    expect(csp, "app.security.csp não pode voltar a ser null").toBeTruthy();
    expect(diretiva(csp!, "default-src")).toEqual(["'self'"]);
  });

  it("script-src: só o app e wasm-unsafe-eval; nada de unsafe-eval, unsafe-inline ou curinga", () => {
    expect(diretiva(csp!, "script-src").sort()).toEqual(["'self'", "'wasm-unsafe-eval'"]);
  });

  it("nenhuma diretiva tem curinga, unsafe-eval ou host externo em connect-src", () => {
    expect(csp).not.toMatch(/(^|\s)\*(\s|;|$)/);
    expect(csp).not.toContain("'unsafe-eval'");
    for (const origem of diretiva(csp!, "connect-src")) expect(["'self'", "ipc:", "http://ipc.localhost"]).toContain(origem);
  });

  it("objetos, base e formulários desligados", () => {
    expect(diretiva(csp!, "object-src")).toEqual(["'none'"]);
    expect(diretiva(csp!, "base-uri")).toEqual(["'none'"]);
    expect(diretiva(csp!, "form-action")).toEqual(["'none'"]);
  });
});

describe("permissões da janela", () => {
  const cap = JSON.parse(ler("src-tauri/capabilities/default.json")) as { permissions: (string | { identifier: string })[] };
  const ids = cap.permissions.map((p) => (typeof p === "string" ? p : p.identifier));

  it("sem o plugin opener (o app não abre links)", () => {
    expect(ids.some((i) => i.startsWith("opener:"))).toBe(false);
    expect(ler("src-tauri/Cargo.toml")).not.toContain("tauri-plugin-opener");
    expect(ler("package.json")).not.toContain("plugin-opener");
  });

  it("só core e http (o http restrito ao repositório de pacotes)", () => {
    expect(ids.sort()).toEqual(["core:default", "http:default"]);
  });
});

describe("FileProvider do Android", () => {
  const xml = ler("src-tauri/gen/android/app/src/main/res/xml/file_paths.xml");

  it("expõe só cache/compartilhar/", () => {
    expect(xml).toContain('<cache-path name="compartilhar" path="compartilhar/" />');
    expect(xml).not.toMatch(/path="\.?"/);
    expect(xml).not.toContain("external");
  });
});
