import { describe, expect, it } from "vitest";
import { en } from "../src/lib/i18n/en";
import { es } from "../src/lib/i18n/es";
import { pt } from "../src/lib/i18n/pt";
import { ERROS_DO_RUST, traduzirErro } from "../src/lib/erros";

// Tradutor falso: devolve a chave e os parâmetros, para conferir o que a função entrega.
const t = (c: string, p?: Record<string, string | number>) => `${c} ${JSON.stringify(p ?? {})}`;
const tr = (s: string) => traduzirErro(s, t as never);
// Como o Rust monta o erro: um JSON com o código e os argumentos.
const rust = (...v: string[]) => JSON.stringify(v);

describe("traduzirErro (erros do Rust)", () => {
  it("código sem argumentos", () => {
    expect(tr(rust("vazio"))).toBe("erro.rust.vazio {}");
    expect(tr(rust("grande_demais"))).toBe("erro.rust.grande_demais {}");
  });

  it("código com argumentos, na ordem do Rust", () => {
    expect(tr(rust("versao", "2", "1"))).toBe('erro.rust.versao {"versao":"2","esperado":"1"}');
    expect(tr(rust("repetido", "5"))).toBe('erro.rust.repetido {"numero":"5"}');
    expect(tr(rust("vozes_final", "457", "Baixo, Soprano", "Soprano"))).toBe(
      'erro.rust.vozes_final {"hino":"457","outras":"Baixo, Soprano","normal":"Soprano"}',
    );
  });

  it("os dados podem ter qualquer caractere, inclusive '|', aspas e barra invertida (nomes de voz vêm do arquivo importado)", () => {
    expect(tr(rust("vozes_final", "5", 'A|B, C"D', "Sop\\rano"))).toBe(
      'erro.rust.vozes_final {"hino":"5","outras":"A|B, C\\"D","normal":"Sop\\\\rano"}',
    );
    expect(tr(rust("json_invalido", "expected value | line 1 column 3"))).toBe('erro.rust.json_invalido {"detalhe":"expected value | line 1 column 3"}');
    expect(tr(rust("gravar", "/pasta/x: permissão negada"))).toBe('erro.rust.gravar {"detalhe":"/pasta/x: permissão negada"}');
  });

  it("argumento que faltou vira texto vazio, e o que sobrou é ignorado", () => {
    expect(tr(rust("versao", "2"))).toBe('erro.rust.versao {"versao":"2","esperado":""}');
    expect(tr(rust("vazio", "sobra"))).toBe("erro.rust.vazio {}");
  });

  it("texto que não é um desses JSON, ou de código desconhecido, volta como está (inclusive nomes herdados do objeto)", () => {
    for (const s of ["falha qualquer", "", "toString", "__proto__", "[", "[1,2]", "[]", '{"a":1}', rust("constructor"), rust("toString", "x"), rust("__proto__")]) {
      expect(tr(s), s).toBe(s);
    }
  });

  it("o motivo de recusar a partitura, que vem codificado dentro de outro erro, é traduzido por dentro", () => {
    const motivo = rust("svg_elemento", "script");
    expect(tr(rust("partitura_invalida", "5", motivo))).toBe(`erro.rust.partitura_invalida {"numero":"5","motivo":"erro.rust.svg_elemento {\\"nome\\":\\"script\\"}"}`);
    // a paisagem recusada envolve o motivo de dentro
    expect(tr(rust("svg_paisagem", motivo))).toContain("erro.rust.svg_elemento");
    // texto que não é um erro codificado segue como está
    expect(tr(rust("partitura_invalida", "5", "falha qualquer"))).toContain('"motivo":"falha qualquer"');
  });

  it("o erro de remover que Ajustes mostra (JSON do Rust) sai traduzido, sem o JSON cru", () => {
    const texto = tr(rust("remover", "hinario.json: negado"));
    expect(texto.startsWith("erro.rust.remover")).toBe(true);
    expect(texto).not.toContain('["remover"');
  });

  it("nenhum texto erro.rust.* manda pôr hinario.json no zip das partituras (o pacote com hinario.json é recusado)", () => {
    for (const dic of [pt, es, en] as Record<string, string>[]) {
      expect(dic["erro.rust.zip_inesperado"]).not.toMatch(/hinario\.json/);
      expect(dic["erro.rust.zip_inesperado"]).toMatch(/paisagem/);
    }
  });

  it("os códigos de partitura (gravar, ler, remover) falam de partituras, não do hinário", () => {
    for (const dic of [pt, es, en] as Record<string, string>[]) {
      for (const c of ["partituras_gravar", "partituras_ler", "partituras_remover"]) expect(dic[`erro.rust.${c}`], c).toMatch(/partituras|scores/);
    }
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
