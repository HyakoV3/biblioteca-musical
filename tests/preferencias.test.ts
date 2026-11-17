import { beforeEach, describe, expect, it, vi } from "vitest";
import { afinadorPadrao, cartoesPadrao, lerAfinador, lerCartoes, lerKaraoke, salvarAfinador, salvarCartoes, salvarKaraoke } from "../src/lib/preferencias";

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

describe("afinador", () => {
  it("padrão: volume 0,6; salvar e ler", () => {
    expect(afinadorPadrao()).toEqual({ volume: 0.6 });
    expect(lerAfinador()).toEqual({ volume: 0.6 }); // nada salvo
    salvarAfinador({ volume: 0.25 });
    expect(lerAfinador()).toEqual({ volume: 0.25 });
  });

  it("o volume salvo fica entre 0 e 1", () => {
    mem["prefs.afinador"] = '{"volume":7}';
    expect(lerAfinador().volume).toBe(1);
    mem["prefs.afinador"] = '{"volume":-2}';
    expect(lerAfinador().volume).toBe(0);
  });

  it("JSON inválido, lista, e valor que não é número voltam ao padrão", () => {
    for (const ruim of ["{ quebrado", "[1]", "null", '{"volume":"alto"}', '{"volume":null}', '{"outro":1}', "7"]) {
      mem["prefs.afinador"] = ruim;
      expect(lerAfinador(), ruim).toEqual({ volume: 0.6 });
    }
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
    expect(lerAfinador()).toEqual({ volume: 0.6 });
    expect(() => salvarAfinador({ volume: 0.3 })).not.toThrow();
  });
});
