import { describe, expect, it } from "vitest";
import { buscar, chaveDoHino, indexar, normalizar, numeroDaConsulta, tomDoHino, type ItemBusca } from "../src/lib/busca-hinos";

// Hinos FICTÍCIOS (o hinário real é conteúdo de terceiros e não entra no Git). Os números imitam o hinário: de 1 a 480.
const h = (numero: number, titulo: string, extra: Partial<ItemBusca> = {}): ItemBusca => ({ numero, titulo, letra: [], ...extra });
const ACERVO: ItemBusca[] = [
  h(1, "Louvor ao Cordeiro", { autoria: "Ana Maria Souza", tonalidade: "Mi♭ maior", letra: ["1. Cantemos ao Cordeiro", "Que nos amou primeiro"] }),
  h(2, "Aleluia, cantai", { tonalidade: "Sol maior", letra: ["1. Aleluia, cantai ao Senhor", "Só ele é digno"] }),
  h(10, "Prossegui em Cristo", { autoria: "Leila Naylor Morris", tonalidade: "Si♭ maior", letra: ["1. Prossegui vitoriosos em Cristo", "Ele em breve vai voltar"] }),
  h(11, "Paz na tempestade", { autoria: "João Dieners", tonalidade: "Ré♭ maior", letra: ["1. Na tempestade vem a paz", "Senhor, tu és o meu pastor"] }),
  h(12, "Fé que vence", { tonalidade: "Lá♭ maior", letra: ["1. A fé vence o mundo", "Ti louvamos, ó Pai"] }),
  h(21, "Ó que amor tão grande", { autoria: "Leila Naylor Morris", tonalidade: "Dó maior", letra: ["1. Ó que amor tão grande", "Sol do meu caminho"] }),
  h(100, "Cristo, rocha firme", { tonalidade: "Fá maior", letra: ["1. Cristo é a rocha firme", "Em ti confio, Senhor"] }),
  h(101, "Glória a Deus nos céus", { tonalidade: "Ré maior", letra: ["1. Glória a Deus nos céus", "Amém."] }),
  h(210, "Lá no céu", { tonalidade: "Lá maior", letra: ["1. Lá no céu há paz", "Lá me espera o Senhor"] }),
  h(480, "Tarde de domingo", { tonalidade: "Mi maior", letra: ["1. A tarde cai tranquila", "Assim é o dia do Senhor"] }),
];
const ind = indexar(ACERVO);
const nums = (consulta: string, op = {}) => buscar(ind, consulta, op).resultados.map((r) => r.item.numero);

describe("normalizar", () => {
  it("tira acentos, caixa e pontuação", () => {
    expect(normalizar("  Ó, que AMOR-tão grande! ")).toBe("o que amor tao grande");
    expect(normalizar("Cordeiro: ção ñ")).toBe("cordeiro cao n");
    expect(normalizar("   ")).toBe("");
  });
});

describe("chave do hino", () => {
  it("é acervo + número: o mesmo número em dois acervos são hinos diferentes", () => {
    expect(chaveDoHino("ccb-hinario-5-do", 21)).toBe("ccb-hinario-5-do#21");
    expect(chaveDoHino("ccb-hinario-4", 21)).not.toBe(chaveDoHino("ccb-hinario-5-do", 21));
  });
});

describe("consulta vazia", () => {
  it("devolve todos, na ordem do acervo", () => {
    for (const q of ["", "   ", "...", "-"]) {
      const b = buscar(ind, q);
      expect(b.intencao).toBe("vazia");
      expect(b.resultados.map((r) => r.item.numero)).toEqual(ACERVO.map((i) => i.numero));
    }
  });
});

describe("número", () => {
  it("reconhece as formas de digitar o número", () => {
    for (const q of ["21", "021", "0021", "hino 21", "Hino 21", "nº 21", "no 21", "n 21", "n. 21", "#21", " 21 "]) expect(numeroDaConsulta(q), q).toBe(21);
    for (const q of ["jesus", "21 jesus", "2a", "12 34", "", "hino"]) expect(numeroDaConsulta(q), q).toBeNull();
  });

  it("o exato vem primeiro e fixo, e é o `exato`", () => {
    const b = buscar(ind, "21");
    expect(b.intencao).toBe("numero");
    expect(b.exato?.numero).toBe(21);
    expect(b.resultados[0]!.item.numero).toBe(21);
    expect(nums("021")[0]).toBe(21);
    expect(nums("hino 21")[0]).toBe(21);
  });

  it('"1" mostra o 1 primeiro e depois os que começam por 1, em ordem numérica', () => {
    expect(nums("1")).toEqual([1, 10, 11, 12, 100, 101]);
  });

  it('"2" acha o 2 e depois o 21 e o 210', () => {
    expect(nums("2")).toEqual([2, 21, 210]);
  });

  it("limita os de prefixo e diz quantos ficaram de fora; expandir mostra todos", () => {
    const limitado = buscar(ind, "1", { limitePrefixo: 2 });
    expect(limitado.resultados.map((r) => r.item.numero)).toEqual([1, 10, 11]);
    expect(limitado.maisNumeros).toBe(3); // 12, 100, 101: total de prefixos (5) menos os 2 mostrados
    const tudo = buscar(ind, "1", { limitePrefixo: 2, expandirPrefixo: true });
    expect(tudo.resultados).toHaveLength(6);
    expect(tudo.maisNumeros).toBe(0);
  });

  it("zeros à esquerda valem como o número (o prefixo é sobre o número sem zeros)", () => {
    expect(nums("01")).toEqual(nums("1"));
    expect(nums("001")).toEqual(nums("1"));
  });

  it("com tantos dígitos quanto o maior número (3), só o exato", () => {
    expect(nums("100")).toEqual([100]);
    expect(nums("210")).toEqual([210]);
    expect(buscar(ind, "100").maisNumeros).toBe(0);
  });

  it("dois dígitos ainda mostram os de prefixo (21 → 210; 48 → 480)", () => {
    expect(nums("21")).toEqual([21, 210]);
    expect(nums("48")).toEqual([480]); // o 48 não existe: sem exato, mas o 480 aparece
    expect(buscar(ind, "48").exato).toBeNull();
  });

  it("número que não existe: sem exato (Enter não faz nada) e sem resultados", () => {
    for (const q of ["481", "0", "999"]) {
      const b = buscar(ind, q);
      expect(b.exato, q).toBeNull();
      expect(b.resultados, q).toEqual([]);
    }
  });
});

describe("título", () => {
  it("por início de palavra, sem acentos nem caixa", () => {
    expect(nums("cordeiro")).toContain(1);
    expect(nums("LOUVOR")).toEqual([1]);
    expect(nums("o que amor")).toContain(21);
  });

  it("não casa no meio da palavra (mudança em relação ao filtro antigo)", () => {
    expect(nums("ordeiro")).not.toContain(1);
  });

  it("título que começa com a consulta vem antes de título que só a contém", () => {
    // "cristo": 100 (começa por Cristo) antes de 10 (Prossegui em Cristo)
    const r = nums("cristo");
    expect(r.indexOf(100)).toBeLessThan(r.indexOf(10));
  });

  it("todos os termos precisam casar (E)", () => {
    expect(nums("prossegui cristo")).toEqual([10]);
    expect(nums("prossegui louvor")).toEqual([]);
  });
});

describe("autoria", () => {
  it("acha pelo nome, em qualquer parte do nome", () => {
    expect(nums("leila")).toEqual([10, 21]);
    expect(nums("naylor")).toEqual([10, 21]);
    expect(nums("joao")).toEqual([11]);
  });

  it("devolve o destaque da autoria", () => {
    const r = buscar(ind, "leila").resultados[0]!;
    expect(r.destaque).toEqual({ onde: "autoria", antes: "", achado: "Leila", depois: " Naylor Morris" });
  });

  it("título e autoria juntos: ordem pelo título, depois autoria", () => {
    expect(nums("cristo leila")).toEqual([10]);
  });
});

describe("letra", () => {
  it("acha o hino pelo verso e devolve o trecho", () => {
    const b = buscar(ind, "tempestade vem a paz");
    expect(b.resultados.map((r) => r.item.numero)).toEqual([11]);
    expect(b.resultados[0]!.destaque?.onde).toBe("letra");
  });

  it("o trecho vem do texto original (com acento e caixa) e com o termo destacado", () => {
    const d = buscar(ind, "pastor").resultados[0]!.destaque!;
    expect(d.onde).toBe("letra");
    expect(d.achado).toBe("pastor");
    expect(d.antes + d.achado + d.depois).toBe("Senhor, tu és o meu pastor");
  });

  it("título vale mais que letra: 'cristo' acha o 100 e o 10 pelo título antes de qualquer acerto só na letra", () => {
    const r = nums("cristo");
    expect(r.slice(0, 2).sort((a, b) => a - b)).toEqual([10, 100]);
  });

  it("palavras curtas só valem inteiras na letra (fé, ti, só)", () => {
    expect(nums("fé ti")).toEqual([12]); // 'fé' e 'ti' como palavras, ambos na letra do 12
    expect(nums("só ele")).toEqual([2]);
    // "ti" como prefixo NÃO acha "tipo", "tinha"... e "só" não acha "sólido": aqui só confere que 'ti' inteira acha o 12 e o 100 ('Em ti confio')
    expect(nums("ti louvamos")).toEqual([12]);
  });

  it("um termo curto sozinho não consulta a letra (só número, título e autoria)", () => {
    // "ti" está na letra do 12 e do 100 como palavra, mas sozinho não vale na letra
    expect(nums("ti")).toEqual([]);
    // "só" está na letra do 2 como palavra: não vale na letra; vale como início de palavra na autoria (Souza, do 1)
    expect(nums("só")).toEqual([1]);
  });

  it("verso com todos os termos na mesma linha vence termos espalhados", () => {
    const a = indexar([
      h(1, "A", { letra: ["amor de Deus", "paz no mundo"] }), // espalhado
      h(2, "B", { letra: ["amor e paz no mundo"] }), // na mesma linha
    ]);
    expect(buscar(a, "amor paz").resultados.map((r) => r.item.numero)).toEqual([2, 1]);
  });

  it("lá como palavra: 'lá no céu' acha o 210 pelo título", () => {
    expect(nums("lá no céu")[0]).toBe(210);
  });
});

describe("tom", () => {
  it("lê a tonalidade do hinário pela classe da nota e pelo modo", () => {
    expect(tomDoHino("Mi♭ maior")).toEqual({ classe: 3, modo: "maior" });
    expect(tomDoHino("Ré♭ maior")).toEqual({ classe: 1, modo: "maior" });
    expect(tomDoHino("E♭ major")).toEqual({ classe: 3, modo: "maior" });
    expect(tomDoHino("Sol")).toEqual({ classe: 7, modo: null });
    expect(tomDoHino(null)).toBeNull();
    expect(tomDoHino("xyz")).toBeNull();
  });

  it("nota + acidente, nas formas de digitar", () => {
    for (const q of ["mib", "mi bemol", "mi b", "mi♭", "Mi♭ maior", "tom mi bemol", "eb", "e bemol", "tom eb"]) expect(nums(q), q).toEqual([1]);
    for (const q of ["sib", "si bemol", "si♭", "bb", "tom bb"]) expect(nums(q), q).toEqual([10]);
    expect(nums("reb")).toEqual([11]);
    expect(nums("lab")).toEqual([12]);
  });

  it("dó sustenido acha Ré♭ (mesma nota)", () => {
    expect(nums("do sustenido")).toEqual([11]);
    expect(nums("do#")).toEqual([11]);
    expect(nums("dó♯ maior")).toEqual([11]);
  });

  it("nota + modo, e 'tom' + nota", () => {
    expect(nums("sol maior")).toEqual([2]);
    expect(nums("tom sol")).toEqual([2]);
    expect(nums("la maior")).toEqual([210]);
    expect(nums("mi maior")).toEqual([480]); // Mi maior, e não Mi♭
  });

  it("modo menor não casa com hinos maiores", () => {
    expect(nums("sol menor")).toEqual([]);
  });

  it("uma nota SOZINHA é texto, não tom", () => {
    // "sol" sozinho: texto. Aparece na letra do 21 como palavra ('Sol do meu caminho')
    expect(nums("sol")).toEqual([21]);
    // "lá" sozinho: texto, e acha pelo título do 210 e pela letra
    expect(nums("lá")[0]).toBe(210);
    expect(nums("la")).toEqual(nums("lá"));
  });

  it("tom junto de texto filtra e busca", () => {
    expect(nums("sib prossegui")).toEqual([10]);
    expect(nums("sib louvor")).toEqual([]);
  });
});

describe("robustez", () => {
  it("consulta estranha não quebra", () => {
    for (const q of ["((", "\\", "%%", "a|b", "😀", "ñ", "çççç", "x".repeat(500)]) expect(() => buscar(ind, q), q).not.toThrow();
  });
  it("acervo vazio", () => {
    const vazio = indexar<ItemBusca>([]);
    expect(buscar(vazio, "21").resultados).toEqual([]);
    expect(buscar(vazio, "jesus").resultados).toEqual([]);
    expect(buscar(vazio, "").resultados).toEqual([]);
  });
  it("hino sem autoria, sem tonalidade ou sem letra", () => {
    const so = indexar([h(5, "Só o título")]);
    expect(buscar(so, "titulo").resultados.map((r) => r.item.numero)).toEqual([5]);
    expect(buscar(so, "sib").resultados).toEqual([]);
    expect(buscar(so, "leila").resultados).toEqual([]);
  });
});
