import { describe, expect, it } from "vitest";
import { pt } from "../src/lib/i18n/pt";
import { CREDITOS, semLicenca, textoDaLicenca } from "../src/lib/licencas";
import { TEXTO_APACHE_2, TEXTO_GENERALUSER, TEXTO_MIT, TEXTO_OFL } from "../src/lib/licencas-textos";

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

  it("cobre o que o app usa: banco dos sons gravados, biblioteca de áudio e ícones", () => {
    const ids = CREDITOS.map((c) => c.id);
    for (const esperado of ["eneias", "generaluser", "smplr", "icones", "leipzig"]) expect(ids).toContain(esperado);
  });

  it("o MIT leva a linha de direitos e o texto padrão; a Apache 2.0 vem inteira", () => {
    const fflate = CREDITOS.find((c) => c.id === "fflate")!;
    const mit = textoDaLicenca(fflate.textos[0]);
    expect(mit).toContain("Arjun Barrett");
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

  it("a Leipzig (fonte da partitura) leva a linha de direitos, o nome reservado e a OFL 1.1 inteira", () => {
    const l = CREDITOS.find((c) => c.id === "leipzig")!;
    const texto = textoDaLicenca(l.textos[0]);
    expect(texto).toContain("Copyright (c) 2014");
    expect(texto).toContain("Laurent Pugin");
    expect(texto).toContain('with Reserved Font Name "Leipzig"');
    expect(texto).toContain(TEXTO_OFL);
    // a OFL em si, do começo ao fim
    expect(TEXTO_OFL.startsWith("SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007")).toBe(true);
    for (const parte of ["PREAMBLE", "DEFINITIONS", "PERMISSION & CONDITIONS", "TERMINATION", "DISCLAIMER"]) expect(TEXTO_OFL).toContain(parte);
    expect(TEXTO_OFL.endsWith("OTHER DEALINGS IN THE FONT SOFTWARE.")).toBe(true);
    expect(l.licenca).toContain("1.1");
  });

  it("o FluidR3 não aparece mais: nenhuma amostra dele está no app nem no pacote de sons", () => {
    const todos = JSON.stringify(CREDITOS).toLowerCase();
    expect(todos).not.toContain("fluidr3");
    expect(todos).not.toContain("gleitzman");
    expect(todos).not.toContain("midi-js-soundfonts");
    expect(todos).not.toContain("cc by");
  });

  it("o crédito do Enéias reconhece a autoria sem afirmar que há licença ou autorização", () => {
    const e = CREDITOS.find((c) => c.id === "eneias")!;
    expect(e.autoria).toBe("Enéias Ramos");
    expect(e.url).toBe("https://github.com/eneiasramos");
    expect(e.licenca).toBe("Todos os direitos reservados");
    const texto = textoDaLicenca(e.textos[0]);
    expect(texto).toContain("Enéias Ramos");
    expect(texto).toContain("não trazem licença");
    expect(texto.toLowerCase()).not.toContain("autorizad");
  });

  it("só o crédito sem licença usa os rótulos de 'direitos reservados', traduzidos nos três idiomas", () => {
    expect(CREDITOS.filter(semLicenca).map((c) => c.id)).toEqual(["eneias"]);
    expect(pt["creditos.reservado"]).toBe("Todos os direitos reservados");
    expect(pt["creditos.ver_direitos"]).not.toBe(pt["creditos.ver"]);
  });
});
