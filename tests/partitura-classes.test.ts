import { describe, expect, it } from "vitest";
// @ts-expect-error o projeto não instala @types/node (mesma solução do estilos.test.ts e do vite.config.js)
import { readFileSync, readdirSync, statSync } from "node:fs";

// O SVG da partitura é embutido na página, e as regras GLOBAIS do app (as que não são escopadas pelo Svelte) alcançam os
// elementos dele pelo nome da classe. Já aconteceu: o app tinha `:global(.flag)` (o ícone da bandeira do "final") e o Verovio
// chama as bandeirolas das notas de `g.flag`, que ficaram douradas e em negrito. Este teste barra o mesmo erro: nenhuma classe
// global do app pode ter o nome de uma classe do Verovio.

// Classes que o Verovio escreve nos SVG: as vistas nos hinos de amostra e os nomes dos elementos MEI, que ele usa como classe.
const CLASSES_DO_VEROVIO = [
  "accid", "arpeg", "artic", "barLine", "beam", "bracketSpan", "breath", "chord", "clef", "cursor", "definition-scale", "dir",
  "dots", "dynam", "ending", "fermata", "fing", "flag", "grpSym", "hairpin", "harm", "keyAccid", "keySig", "label", "labelAbbr",
  "layer", "ledgerLines", "mNum", "mRest", "mdiv", "measure", "meterSig", "mordent", "multiRest", "note", "notehead", "ornam",
  "page-margin", "pb", "placeholder", "reh", "rend", "rest", "sb", "score", "section", "slur", "space", "spanning", "staff",
  "stem", "syl", "system", "tempo", "text", "tie", "trill", "tuplet", "turn", "verse",
];

const raiz = new URL("../", import.meta.url);

/** Caminhos (relativos à raiz do projeto) dos .svelte e .css de `dir`. */
function arquivos(dir: string): string[] {
  return (readdirSync(new URL(dir, raiz)) as string[]).flatMap((nome) => {
    const caminho = `${dir}/${nome}`;
    if (statSync(new URL(caminho, raiz)).isDirectory()) return arquivos(caminho);
    return /\.(svelte|css)$/.test(nome) ? [caminho] : [];
  });
}

/** Nomes de classe que o app estiliza para a página toda: `:global(.x)` nos componentes e qualquer `.x` nos .css globais. */
function classesGlobais(): Map<string, string> {
  const achadas = new Map<string, string>();
  for (const f of arquivos("src")) {
    const texto = readFileSync(new URL(f, raiz), "utf-8") as string;
    const alvo = f.endsWith(".css") ? texto.replace(/\/\*[\s\S]*?\*\//g, "") : texto;
    const re = f.endsWith(".css") ? /\.([A-Za-z][\w-]*)/g : /:global\(\.([A-Za-z][\w-]*)/g;
    for (const m of alvo.matchAll(re)) achadas.set(m[1], f);
  }
  return achadas;
}

describe("classes globais do app x classes do SVG da partitura", () => {
  it("o teste enxerga as classes globais que existem (não passa por não achar nada)", () => {
    const globais = classesGlobais();
    for (const esperada of ["botao", "bandeira-final", "coluna"]) expect([...globais.keys()], esperada).toContain(esperada);
  });

  it("nenhuma classe global do app tem o nome de uma classe do Verovio", () => {
    const globais = classesGlobais();
    const colisoes = CLASSES_DO_VEROVIO.filter((c) => globais.has(c)).map((c) => `${c} (${globais.get(c)})`);
    expect(colisoes).toEqual([]);
  });

  it("o ícone da bandeira do final usa a classe própria, e não a `flag` do Verovio", () => {
    const player = readFileSync(new URL("src/lib/Player.svelte", raiz), "utf-8") as string;
    expect(player).toContain('class="bandeira-final"');
    expect(player).not.toContain('class="flag"');
  });
});
