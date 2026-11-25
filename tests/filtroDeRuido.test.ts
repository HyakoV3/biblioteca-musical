import { describe, expect, it } from "vitest";
import { FILTROS_DE_RUIDO, FILTRO_PADRAO, TAXA_NEURAL, ehFiltroDeRuido, ehNeural, lerFiltro } from "../src/lib/filtroDeRuido";

describe("filtro de ruído", () => {
  it("são quatro: desligado, android, rnnoise e gtcrn; o padrão é desligado", () => {
    expect([...FILTROS_DE_RUIDO]).toEqual(["desligado", "android", "rnnoise", "gtcrn"]);
    expect(FILTRO_PADRAO).toBe("desligado");
    expect(FILTROS_DE_RUIDO.every(ehFiltroDeRuido)).toBe(true);
    expect(ehFiltroDeRuido("deepfilternet3")).toBe(false);
    expect(ehFiltroDeRuido(1)).toBe(false);
  });
  it("só rnnoise e gtcrn são neurais (pedem 48 kHz e AudioWorklet)", () => {
    expect(FILTROS_DE_RUIDO.filter(ehNeural)).toEqual(["rnnoise", "gtcrn"]);
    expect(TAXA_NEURAL).toBe(48000);
  });
  it("lerFiltro valida: o formato antigo '1' vale android, e o resto que não vale volta ao padrão", () => {
    expect(lerFiltro("1")).toBe("android");
    expect(lerFiltro("0")).toBe("desligado");
    expect(lerFiltro("gtcrn")).toBe("gtcrn");
    for (const ruim of [null, undefined, "", "RNNOISE", 2, {}, "deepfilternet3"]) expect(lerFiltro(ruim)).toBe("desligado");
  });
});
