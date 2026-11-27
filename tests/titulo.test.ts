import { describe, expect, it } from "vitest";
import { buscar, indexar, type ItemBusca } from "../src/lib/busca-hinos";
import { todosOsTitulos, tituloDoHino } from "../src/lib/titulo";

// Hinos FICTÍCIOS para o seletor e para a busca (o pacote de exemplo real tem o seu teste em exemplo.test.ts).
const bilingue = { titulo: "Original", titulos: { pt: "Nome em português", es: "Nombre en español" } };

describe("tituloDoHino", () => {
  it("usa o título do idioma da interface e cai em `titulo` quando falta", () => {
    expect(tituloDoHino(bilingue, "pt")).toBe("Nome em português");
    expect(tituloDoHino(bilingue, "es")).toBe("Nombre en español");
    expect(tituloDoHino(bilingue, "en")).toBe("Original"); // a chave do idioma original falta de propósito: vale o título original
  });

  it("hinário antigo (sem `titulos`) e valores inúteis caem em `titulo`", () => {
    expect(tituloDoHino({ titulo: "A" }, "pt")).toBe("A");
    expect(tituloDoHino({ titulo: "A", titulos: null }, "es")).toBe("A");
    expect(tituloDoHino({ titulo: "A", titulos: { pt: "   " } }, "pt")).toBe("A");
    expect(tituloDoHino({ titulo: "A", titulos: { pt: 3 as unknown as string } }, "pt")).toBe("A");
    expect(tituloDoHino({ titulo: "A", titulos: { pt: "B" } }, "fr")).toBe("A"); // idioma desconhecido
  });

  it("todosOsTitulos junta o padrão e os outros, sem repetir nem trazer vazios", () => {
    expect(todosOsTitulos(bilingue)).toEqual(["Original", "Nome em português", "Nombre en español"]);
    expect(todosOsTitulos({ titulo: "X", titulos: { pt: "X", en: "" } })).toEqual(["X"]);
  });
});

describe("busca por título em qualquer idioma", () => {
  const itens: ItemBusca[] = [
    { numero: 1, titulo: "Stille Nacht", titulos: { pt: "Noite Feliz", en: "Silent Night", es: "Noche de paz" }, letra: [] },
    { numero: 2, titulo: "An die Freude", titulos: { pt: "Ode à Alegria", en: "Ode to Joy", es: "Oda a la Alegría" }, letra: [] },
    { numero: 3, titulo: "Hino antigo", letra: [] },
  ];
  const ind = indexar(itens);
  const nums = (q: string) => buscar(ind, q).resultados.map((r) => r.item.numero);

  it("acha pelo título original e por cada tradução", () => {
    expect(nums("stille")).toEqual([1]);
    expect(nums("noite")).toEqual([1]);
    expect(nums("silent")).toEqual([1]);
    expect(nums("noche paz")).toEqual([1]);
    expect(nums("ode to")).toEqual([2]);
    expect(nums("oda")).toEqual([2]);
  });

  it("segue a regra de acentos e caixa de sempre", () => {
    expect(nums("ALEGRIA")).toEqual([2]);
    expect(nums("alegría")).toEqual([2]);
    expect(nums("a ode")).toEqual([2]); // "a" e "ode": os dois termos têm de estar no título
  });

  it("hino sem `titulos` continua achável pelo título", () => {
    expect(nums("antigo")).toEqual([3]);
  });

  it("os termos não casam 'emprestados' entre traduções diferentes", () => {
    expect(nums("silent paz")).toEqual([]); // "silent" é do inglês e "paz" do espanhol
    expect(nums("silent night")).toEqual([1]);
  });

  it("o título exato (original ou o de um idioma) ganha do que só começa com a consulta", () => {
    const acervo: ItemBusca[] = [
      { numero: 20, titulo: "Graça Divina", letra: [] },
      { numero: 21, titulo: "Amazing Grace", titulos: { pt: "Graça" }, letra: [] },
    ];
    const i = indexar(acervo);
    const ordem = (q: string) => buscar(i, q).resultados.map((r) => r.item.numero);
    expect(ordem("graça")).toEqual([21, 20]); // o título pt do 21 é exatamente "Graça"
    expect(ordem("amazing grace")).toEqual([21]);
  });
});
