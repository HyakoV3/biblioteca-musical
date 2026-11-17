import { beforeEach, describe, expect, it, vi } from "vitest";
import { ajustesPadrao, cartoesPadrao, lerAjustes, lerCartoes, lerKaraoke, salvarAjustes, salvarCartoes, salvarKaraoke } from "../src/lib/preferencias";

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
