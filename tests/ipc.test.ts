import { describe, expect, it } from "vitest";
// @ts-expect-error o projeto não instala @types/node (mesma solução do partitura-classes.test.ts)
import { readFileSync, readdirSync } from "node:fs";

// O contrato entre a interface (TypeScript) e o Rust: cada `invoke("comando", { argumentos })` do app precisa de um `#[tauri::command]` registrado no
// `generate_handler![...]` com o mesmo nome, e as chaves do objeto de argumentos precisam ser os parâmetros do Rust em camelCase (o Tauri converte `ao_progresso` em `aoProgresso`).
// Nenhum outro teste liga os dois lados: um comando renomeado de um lado só passaria em tudo e quebraria no aparelho.
const raiz = new URL("../", import.meta.url);
const ler = (caminho: string): string => readFileSync(new URL(caminho, raiz), "utf-8");

function arquivosTs(dir: string): string[] {
  return (readdirSync(new URL(dir, raiz), { withFileTypes: true }) as { name: string; isDirectory(): boolean }[]).flatMap((e) =>
    e.isDirectory() ? arquivosTs(`${dir}/${e.name}`) : /\.(ts|svelte)$/.test(e.name) ? [`${dir}/${e.name}`] : [],
  );
}

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

// Do lado do Rust: nome do comando → parâmetros (sem os que o Tauri injeta: AppHandle, Window, State...).
function comandosDoRust(): Map<string, string[]> {
  const lib = ler("src-tauri/src/lib.rs");
  const registrados = (/generate_handler!\[([^\]]*)\]/.exec(lib)?.[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const mapa = new Map<string, string[]>();
  for (const nome of registrados) {
    const m = new RegExp(`#\\[tauri::command\\]\\s*(?:pub\\s+)?(?:async\\s+)?fn\\s+${nome}\\s*\\(([^)]*)\\)`).exec(lib);
    expect(m, `o comando ${nome} está no generate_handler! mas não tem #[tauri::command] em lib.rs`).not.toBeNull();
    const params = (m?.[1] ?? "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => ({ nome: p.split(":")[0].trim(), tipo: p.slice(p.indexOf(":") + 1).trim() }))
      .filter((p) => !/AppHandle|WebviewWindow|Window|State</.test(p.tipo))
      .map((p) => camel(p.nome));
    mapa.set(nome, params);
  }
  return mapa;
}

// Do lado do app: cada chamada `invoke<...>("nome", { chaves })`.
function chamadasDoApp(): { arquivo: string; nome: string; chaves: string[] }[] {
  const saida: { arquivo: string; nome: string; chaves: string[] }[] = [];
  for (const arquivo of arquivosTs("src")) {
    const texto = ler(arquivo);
    for (const m of texto.matchAll(/\binvoke(?:<[^>]*>)?\(\s*"([a-z_]+)"\s*(?:,\s*\{([^}]*)\})?/g)) {
      const chaves = (m[2] ?? "")
        .split(",")
        .map((c) => c.trim().split(/[:\s]/)[0])
        .filter(Boolean);
      saida.push({ arquivo, nome: m[1], chaves });
    }
  }
  return saida;
}

describe("contrato entre o app e o Rust (invoke × generate_handler!)", () => {
  const rust = comandosDoRust();
  const app = chamadasDoApp();

  it("acha os comandos dos dois lados", () => {
    expect(rust.size).toBeGreaterThan(0);
    expect(app.length).toBeGreaterThan(0);
  });

  it("todo invoke do app chama um comando registrado no Rust", () => {
    for (const c of app) expect(rust.has(c.nome), `${c.arquivo} chama "${c.nome}", que não está no generate_handler! de lib.rs`).toBe(true);
  });

  it("as chaves dos argumentos são os parâmetros do comando, em camelCase", () => {
    for (const c of app) {
      const esperado = [...(rust.get(c.nome) ?? [])].sort();
      expect([...c.chaves].sort(), `${c.arquivo}: argumentos de "${c.nome}" diferentes dos parâmetros do Rust`).toEqual(esperado);
    }
  });

  it("todo comando do Rust é chamado pelo app (sem comando morto)", () => {
    const chamados = new Set(app.map((c) => c.nome));
    for (const nome of rust.keys()) expect(chamados.has(nome), `${nome} está registrado no Rust, mas o app não o chama`).toBe(true);
  });
});
