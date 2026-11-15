import { describe, expect, it } from "vitest";
import { pt } from "../src/lib/i18n/pt";
import { AVISO_CCBY3, CREDITOS, textoDaLicenca } from "../src/lib/licencas";
import { TEXTO_APACHE_2, TEXTO_GENERALUSER, TEXTO_MIT } from "../src/lib/licencas-textos";

describe("créditos e licenças", () => {
  it("ids únicos e cada crédito tem nome, autoria, licença e ao menos um texto", () => {
    const ids = CREDITOS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CREDITOS) {
      expect(c.nome, c.id).not.toBe("");
      expect(c.autoria, c.id).not.toBe("");
      expect(c.licenca, c.id).not.toBe("");
      expect(c.textos.length, c.id).toBeGreaterThan(0);
      if (c.url) expect(c.url, c.id).toMatch(/^https:\/\//);
    }
  });

  it("todo crédito tem a descrição de uso traduzida", () => {
    for (const c of CREDITOS) expect(pt, c.id).toHaveProperty(`creditos.uso.${c.id}`);
  });

  it("cobre o que o app usa: banco dos sons gravados, bancos medidos, biblioteca de áudio e ícones", () => {
    const ids = CREDITOS.map((c) => c.id);
    for (const esperado of ["generaluser", "fluidr3", "soundfonts", "smplr", "icones"]) expect(ids).toContain(esperado);
  });

  it("o MIT leva a linha de direitos e o texto padrão; a Apache 2.0 vem inteira", () => {
    const fluid = CREDITOS.find((c) => c.id === "fluidr3")!;
    const mit = textoDaLicenca(fluid.textos[0]);
    expect(mit).toContain("Frank Wen");
    expect(mit).toContain("Permission is hereby granted, free of charge");
    expect(mit).toContain("The above copyright notice and this permission notice shall be included");
    expect(mit).toContain(TEXTO_MIT);
    const icones = CREDITOS.find((c) => c.id === "icones")!;
    expect(textoDaLicenca(icones.textos[0])).toBe(TEXTO_APACHE_2);
    expect(TEXTO_APACHE_2).toContain("Apache License");
    expect(TEXTO_APACHE_2).toContain("Version 2.0, January 2004");
    expect(TEXTO_APACHE_2).toContain("END OF TERMS AND CONDITIONS");
  });

  it("o GeneralUser GS mostra a licença do autor, sem alteração", () => {
    const g = CREDITOS.find((c) => c.id === "generaluser")!;
    expect(textoDaLicenca(g.textos[0])).toBe(TEXTO_GENERALUSER);
    expect(TEXTO_GENERALUSER).toContain("GeneralUser GS v2.0.3");
    expect(TEXTO_GENERALUSER).toContain("Please feel free to use it in your software projects");
  });

  it("as amostras do FluidR3 citam a CC BY 3.0, o autor, o link e dizem para que servem hoje", () => {
    const g = CREDITOS.find((c) => c.id === "soundfonts")!;
    expect(g.textos.map((t) => t.tipo)).toEqual(["mit", "ccby3"]);
    expect(AVISO_CCBY3).toContain("Benjamin Gleitzman");
    expect(AVISO_CCBY3).toContain("https://creativecommons.org/licenses/by/3.0/");
    expect(AVISO_CCBY3).toContain("only to measure");
  });
});
