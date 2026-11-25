import { beforeEach, describe, expect, it, vi } from "vitest";
import { lerVoz, ajustesPadrao, cartoesPadrao, lerAjustes, lerCartoes, lerKaraoke, lerCiente, lerManterTela, salvarAjustes, salvarCartoes, salvarCiente, salvarKaraoke, salvarManterTela } from "../src/lib/preferencias";

// localStorage simples, em memória.
let mem: Record<string, string>;
beforeEach(() => {
  mem = {};
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => (k in mem ? mem[k] : null),
    setItem: (k: string, v: string) => {
      mem[k] = String(v);
    },
  });
});

const com = (v: string) => {
  mem["prefs.cartoes"] = v;
  return lerCartoes();
};
const SO_VOZES = { ajustes: false, vozes: true, instrumentos: false };

describe("cards abertos do player", () => {
  it("padrão: só as vozes", () => {
    expect(cartoesPadrao()).toEqual(SO_VOZES);
    expect(lerCartoes()).toEqual(SO_VOZES); // nada salvo
  });

  it("os cards são um grupo exclusivo: vale o primeiro por prioridade (vozes, ajustes, instrumentos)", () => {
    expect(com('{"ajustes":true,"vozes":true,"instrumentos":true}')).toEqual(SO_VOZES);
    expect(com('{"ajustes":true,"vozes":false,"instrumentos":true}')).toEqual({ ajustes: true, vozes: false, instrumentos: false });
    expect(com('{"ajustes":false,"vozes":false,"instrumentos":true}')).toEqual({ ajustes: false, vozes: false, instrumentos: true });
    expect(com('{"ajustes":false,"vozes":false,"instrumentos":false}')).toEqual({ ajustes: false, vozes: false, instrumentos: false });
  });

  it("JSON inválido ou valor que não é booleano volta ao padrão", () => {
    expect(com("{ quebrado")).toEqual(SO_VOZES);
    expect(com('{"vozes":"sim"}')).toEqual(SO_VOZES);
  });

  it("salvar e ler", () => {
    salvarCartoes({ ajustes: true, vozes: false, instrumentos: false });
    expect(lerCartoes()).toEqual({ ajustes: true, vozes: false, instrumentos: false });
  });
});

describe("aviso de app independente (Concordo)", () => {
  it("começa sem ciência e guarda o Concordo", () => {
    expect(lerCiente()).toBe(false);
    salvarCiente();
    expect(lerCiente()).toBe(true);
  });

  it("sem armazenamento não quebra e o aviso segue à vista", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(lerCiente()).toBe(false);
    expect(() => salvarCiente()).not.toThrow();
    vi.unstubAllGlobals();
  });
});

describe("manter a tela ligada", () => {
  it("vem desligado por padrão, e salvar vale entre aberturas", () => {
    expect(lerManterTela()).toBe(false);
    salvarManterTela(true);
    expect(lerManterTela()).toBe(true);
    salvarManterTela(false);
    expect(lerManterTela()).toBe(false);
  });

  it("sem armazenamento não quebra e vale o padrão (desligado)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(lerManterTela()).toBe(false);
    expect(() => salvarManterTela(true)).not.toThrow();
    vi.unstubAllGlobals();
  });
});

describe("karaokê", () => {
  it("vem ligado por padrão, e salvar vale entre aberturas", () => {
    expect(lerKaraoke()).toBe(true);
    salvarKaraoke(false);
    expect(lerKaraoke()).toBe(false);
    salvarKaraoke(true);
    expect(lerKaraoke()).toBe(true);
  });

  it("sem armazenamento (erro ao ler ou gravar) não quebra e vale o padrão", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(lerKaraoke()).toBe(true);
    expect(() => salvarKaraoke(false)).not.toThrow();
  });
});

describe("cartões abertos de Ajustes", () => {
  const TODOS_FECHADOS = { aparencia: false, idioma: false, conteudo: false };
  const com = (v: string) => {
    mem["prefs.ajustes"] = v;
    return lerAjustes();
  };

  it("padrão: todos fechados; a chave é própria (a prefs.cartoes é do player)", () => {
    expect(ajustesPadrao()).toEqual(TODOS_FECHADOS);
    expect(lerAjustes()).toEqual(TODOS_FECHADOS); // nada salvo
    mem["prefs.cartoes"] = '{"ajustes":true,"vozes":true,"instrumentos":true}';
    expect(lerAjustes()).toEqual(TODOS_FECHADOS); // o do player não vaza para Ajustes
  });

  it("salvar e ler: os cartões são livres (vários abertos ao mesmo tempo)", () => {
    salvarAjustes({ aparencia: true, idioma: false, conteudo: true });
    expect(lerAjustes()).toEqual({ aparencia: true, idioma: false, conteudo: true });
    expect(JSON.parse(mem["prefs.ajustes"])).toEqual({ aparencia: true, idioma: false, conteudo: true });
  });

  it("valor que não é booleano volta ao padrão só naquele cartão", () => {
    expect(com('{"aparencia":true,"idioma":"sim","conteudo":1}')).toEqual({ aparencia: true, idioma: false, conteudo: false });
  });

  it("JSON inválido, lista, texto e nulo voltam ao padrão", () => {
    for (const ruim of ["{ quebrado", "[true,true,true]", "null", "7", '"aberto"', ""]) {
      expect(com(ruim), ruim).toEqual(TODOS_FECHADOS);
    }
  });

  it("chaves desconhecidas são ignoradas (Sobre e Créditos não entram)", () => {
    expect(com('{"sobre":true,"creditos":true,"conteudo":true}')).toEqual({ aparencia: false, idioma: false, conteudo: true });
    salvarAjustes({ aparencia: false, idioma: true, conteudo: false, sobre: true } as never);
    expect(JSON.parse(mem["prefs.ajustes"])).toEqual({ aparencia: false, idioma: true, conteudo: false });
  });

  it("sem armazenamento (erro ao ler ou gravar) não quebra e vale o padrão", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(lerAjustes()).toEqual(TODOS_FECHADOS);
    expect(() => salvarAjustes({ aparencia: true, idioma: true, conteudo: true })).not.toThrow();
  });
});

describe("o último hino aberto (I-17)", () => {
  it("sem nada guardado é null; guarda e lê o número", async () => {
    const { lerUltimoHino, salvarUltimoHino } = await import("../src/lib/preferencias");
    expect(lerUltimoHino()).toBeNull();
    salvarUltimoHino(10);
    expect(mem["prefs.ultimo-hino"]).toBe("10");
    expect(lerUltimoHino()).toBe(10);
  });

  it("valor inválido no armazenamento (texto, zero, negativo, fração) é ignorado", async () => {
    const { lerUltimoHino } = await import("../src/lib/preferencias");
    for (const ruim of ["abc", "0", "-3", "2.5", "", "NaN"]) {
      mem["prefs.ultimo-hino"] = ruim;
      expect(lerUltimoHino(), ruim).toBeNull();
    }
  });

  it("sem armazenamento não quebra", async () => {
    const { lerUltimoHino, salvarUltimoHino } = await import("../src/lib/preferencias");
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(lerUltimoHino()).toBeNull();
    expect(() => salvarUltimoHino(5)).not.toThrow();
  });
});

describe("reduzir ruído do Gravador (I-29)", () => {
  it("padrão desligado; guarda e lê; sem armazenamento não quebra", async () => {
    const { lerReduzirRuido, salvarReduzirRuido } = await import("../src/lib/preferencias");
    expect(lerReduzirRuido()).toBe(false);
    salvarReduzirRuido(true);
    expect(mem["prefs.reduzir-ruido"]).toBe("1");
    expect(lerReduzirRuido()).toBe(true);
    salvarReduzirRuido(false);
    expect(lerReduzirRuido()).toBe(false);
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(lerReduzirRuido()).toBe(false);
    expect(() => salvarReduzirRuido(true)).not.toThrow();
  });
});

describe("as duas flautas", () => {
  it("a flauta doce e a transversal sintetizadas são escolhas válidas do soprano", () => {
    for (const id of ["flauta_doce", "flauta"]) {
      mem["prefs.vozes"] = JSON.stringify({ soprano: { instrumento: id, volume: 0.5, muda: false } });
      expect(lerVoz("Soprano").instrumento).toBe(id);
    }
  });
  it("cada flauta gravada é o par da sua sintetizada", async () => {
    const { gravadoEquivalente, sinteticoEquivalente } = await import("../src/lib/realista");
    expect(gravadoEquivalente("flauta")).toBe("real_flauta");
    expect(sinteticoEquivalente("real_flauta")).toBe("flauta");
    expect(gravadoEquivalente("flauta_doce")).toBe("real_flauta_doce");
    expect(sinteticoEquivalente("real_flauta_doce")).toBe("flauta_doce");
  });
});
