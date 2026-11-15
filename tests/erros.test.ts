import { describe, expect, it } from "vitest";
import { en } from "../src/lib/i18n/en";
import { es } from "../src/lib/i18n/es";
import { pt } from "../src/lib/i18n/pt";
import { ERROS_DO_RUST, traduzirErro } from "../src/lib/erros";

// Tradutor falso: devolve a chave e os parâmetros, para conferir o que a função entrega.
const t = (c: string, p?: Record<string, string | number>) => `${c} ${JSON.stringify(p ?? {})}`;
const tr = (s: string) => traduzirErro(s, t as never);

describe("traduzirErro (erros do Rust)", () => {
  it("código sem argumentos", () => {
    expect(tr("vazio")).toBe("erro.rust.vazio {}");
    expect(tr("grande_demais")).toBe("erro.rust.grande_demais {}");
  });

  it("código com argumentos, na ordem do Rust", () => {
    expect(tr("versao|2|1")).toBe('erro.rust.versao {"versao":"2","esperado":"1"}');
    expect(tr("repetido|5")).toBe('erro.rust.repetido {"numero":"5"}');
    expect(tr("vozes_final|457|Baixo, Soprano|Soprano")).toBe(
      'erro.rust.vozes_final {"hino":"457","outras":"Baixo, Soprano","normal":"Soprano"}',
    );
  });

  it("o último argumento recebe o resto, mesmo com '|' dentro (detalhe do sistema)", () => {
    expect(tr("json_invalido|expected value | line 1 column 3")).toBe('erro.rust.json_invalido {"detalhe":"expected value | line 1 column 3"}');
    expect(tr("gravar|/pasta/x: permissão negada")).toBe('erro.rust.gravar {"detalhe":"/pasta/x: permissão negada"}');
  });

  it("texto sem código conhecido volta como está (inclusive nomes herdados do objeto)", () => {
    expect(tr("falha qualquer")).toBe("falha qualquer");
    expect(tr("toString")).toBe("toString");
    expect(tr("constructor|x")).toBe("constructor|x");
    expect(tr("__proto__")).toBe("__proto__");
    expect(tr("")).toBe("");
  });

  it("todo código tem texto nos três idiomas, com exatamente os parâmetros que a função envia", () => {
    for (const [codigo, nomes] of Object.entries(ERROS_DO_RUST)) {
      for (const [idioma, dic] of [["pt", pt], ["es", es], ["en", en]] as const) {
        const texto = (dic as Record<string, string>)[`erro.rust.${codigo}`];
        expect(texto, `${idioma} ${codigo}`).toBeTypeOf("string");
        expect([...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort(), `${idioma} ${codigo}`).toEqual([...nomes].sort());
      }
    }
  });
});
