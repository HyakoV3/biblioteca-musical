import { describe, expect, it } from "vitest";
import type { MetaGravacao } from "../src/lib/gravacoes";
import { calcularFixadas, montarLinhas, ordemDaTela, rotuloDoGrupo } from "../src/lib/gravadorLinhas";
import { vizinhoNaOrdem } from "../src/lib/gravadorFoco";
import { criarChaveDe } from "../src/lib/gravadorChave";
import type { Grupo } from "../src/lib/organizar";

const meta = (id: string): MetaGravacao => ({ id, criadaEm: Date.UTC(2026, 10, 25, 15), segundos: 2, tipo: "audio/webm", bytes: 3, titulo: `T ${id}` });
const todas = ["a", "b", "c", "d"].map(meta);
const dados = (o: Partial<Parameters<typeof calcularFixadas>[0]> = {}) => ({
  novaId: null,
  tocandoId: null,
  todas,
  idsNaJanela: new Set<string>(),
  idsFiltradas: new Set<string>(),
  ...o,
});

describe("calcularFixadas", () => {
  it("fixa a nova e a que toca fora da janela, com a marca quando estão fora do filtro", () => {
    const r = calcularFixadas(dados({ novaId: "a", tocandoId: "b", idsFiltradas: new Set(["b"]) }));
    expect(r.map((f) => [f.meta.id, f.marca])).toEqual([["a", "nova"], ["b", undefined]]);
    expect(calcularFixadas(dados({ novaId: "a", tocandoId: "a" })).map((f) => f.marca)).toEqual(["tocando"]);
  });
  it("ignora o que a janela já mostra, o que não existe e o que é nulo", () => {
    expect(calcularFixadas(dados({ novaId: "a", tocandoId: "zzz", idsNaJanela: new Set(["a"]) }))).toEqual([]);
    expect(calcularFixadas(dados())).toEqual([]);
  });
});

describe("montarLinhas e ordemDaTela", () => {
  const grupo: Grupo = { chave: "hoje", tipo: "hoje", ano: 2026, mes: 10, itens: [todas[2], todas[3]] };
  it("põe os destaques, e depois cada cabeçalho seguido dos seus itens", () => {
    const fixadas = [{ meta: todas[0], marca: "nova" as const }];
    expect(montarLinhas(fixadas, [grupo]).map((l) => l.chave)).toEqual(["i:a", "g:hoje", "i:c", "i:d"]);
    expect(ordemDaTela(fixadas, grupo.itens)).toEqual(["a", "c", "d"]);
  });
});

describe("rotuloDoGrupo", () => {
  const rot = { hoje: "Hoje", ontem: "Ontem", semana: "Semana" };
  it("usa os rótulos recentes e escreve o mês com inicial maiúscula", () => {
    expect(rotuloDoGrupo({ chave: "ontem", tipo: "ontem", ano: 2026, mes: 10, itens: [] }, rot, "pt")).toBe("Ontem");
    expect(rotuloDoGrupo({ chave: "2026-11", tipo: "mes", ano: 2026, mes: 10, itens: [] }, rot, "pt")).toBe("Novembro de 2026");
  });
});

describe("vizinhoNaOrdem", () => {
  it("devolve o seguinte, senão o anterior, senão nada", () => {
    expect(vizinhoNaOrdem(["a", "b", "c"], "b")).toBe("c");
    expect(vizinhoNaOrdem(["a", "b", "c"], "c")).toBe("b");
    expect(vizinhoNaOrdem(["a"], "a")).toBeUndefined();
  });
});

describe("criarChaveDe", () => {
  it("calcula a chave uma vez por registro e a refaz quando o idioma muda", () => {
    let idioma = "pt";
    let chamadas = 0;
    const chaveDe = criarChaveDe((k) => (chamadas++, `${k}-${idioma}`), () => idioma);
    const m = { ...meta("a"), titulo: undefined };
    const a = chaveDe(m);
    expect(chaveDe(m)).toBe(a);
    expect(chamadas).toBe(1);
    idioma = "en";
    expect(chaveDe(m)).not.toBe(a);
    expect(chamadas).toBe(2);
  });
});
