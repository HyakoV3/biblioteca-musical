import { beforeEach, describe, expect, it, vi } from "vitest";
import { cartoesPadrao, lerCartoes, lerKaraoke, lerNivelar, salvarCartoes, salvarKaraoke, salvarNivelar } from "../src/lib/preferencias";

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

describe("nivelar as notas dos gravados (I-23)", () => {
  it("vem ligado por padrão, e salvar vale entre aberturas", () => {
    expect(lerNivelar()).toBe(true);
    salvarNivelar(false);
    expect(mem["prefs.nivelar"]).toBe("0");
    expect(lerNivelar()).toBe(false);
    salvarNivelar(true);
    expect(mem["prefs.nivelar"]).toBe("1");
    expect(lerNivelar()).toBe(true);
  });

  it("é independente do karaokê (cada um tem a sua chave)", () => {
    salvarNivelar(false);
    expect(lerKaraoke()).toBe(true);
    salvarKaraoke(false);
    salvarNivelar(true);
    expect(lerKaraoke()).toBe(false);
  });

  it("sem armazenamento (erro ao ler ou gravar) não quebra e vale o padrão (ligado)", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    });
    expect(lerNivelar()).toBe(true);
    expect(() => salvarNivelar(false)).not.toThrow();
  });
});
