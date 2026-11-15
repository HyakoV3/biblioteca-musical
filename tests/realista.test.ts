import { describe, expect, it } from "vitest";
import { INSTRUMENTOS } from "../src/lib/instrumentos";
import {
  IDS_REALISTAS,
  REALISTAS,
  arquivoDoRealista,
  gravadoEquivalente,
  realistasDaVoz,
  sinteticoEquivalente,
  urlDoRealista,
} from "../src/lib/realista";
import manifesto from "../src/lib/sons/manifesto.json";

describe("catálogo de sons gravados x manifesto x síntese", () => {
  const noManifesto = new Set(manifesto.pacotes.flatMap((p) => p.arquivos.map((a) => a.arquivo)));

  it("todo gravado do catálogo está no manifesto, e o manifesto não tem arquivo desconhecido", () => {
    for (const id of IDS_REALISTAS) expect(noManifesto.has(arquivoDoRealista(id)), `${id}: ${arquivoDoRealista(id)}`).toBe(true);
    expect(noManifesto.size).toBe(IDS_REALISTAS.length);
    expect(new Set(IDS_REALISTAS.map(arquivoDoRealista)).size).toBe(IDS_REALISTAS.length); // nenhum arquivo repetido
  });

  it("cada gravado tem ganho plausível e ida e volta com o sintetizado equivalente", () => {
    for (const id of IDS_REALISTAS) {
      expect(REALISTAS[id].ganho, `${id}: ganho`).toBeGreaterThan(0);
      expect(REALISTAS[id].ganho, `${id}: ganho`).toBeLessThan(10);
      const eq = sinteticoEquivalente(id);
      if (eq) {
        expect(eq in INSTRUMENTOS, `${id}: equivalente "${eq}" existe`).toBe(true);
        expect(gravadoEquivalente(eq), `${id}: ida e volta`).toBe(id);
      }
    }
  });

  it("o endereço do gravado é uma chave virtual no armazenamento do app", () => {
    expect(urlDoRealista("real_flauta")).toBe("/sons/flute-mp3.js");
  });

  it("cada voz recebe os gravados que cabem nela", () => {
    expect(realistasDaVoz("baixo").sort()).toEqual(["real_contrabaixo", "real_fagote", "real_orgao_tirantes", "real_tuba"]);
    expect(realistasDaVoz("soprano")).toHaveLength(6);
    expect(realistasDaVoz(null)).toHaveLength(16); // voz sem tipo (ex.: "Parte I") recebe todos
  });
});
