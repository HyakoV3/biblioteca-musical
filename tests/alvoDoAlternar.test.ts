import { describe, expect, it } from "vitest";
import { alvoDoAlternar } from "../src/lib/alvoDoAlternar";

describe("alvo do botão Tocar ou Pausar da notificação (I-47)", () => {
  it("o metrônomo tocando vence", () => {
    expect(alvoDoAlternar("parado", true, false)).toBe("metronomo");
    expect(alvoDoAlternar("pausado", true, false)).toBe("metronomo");
  });

  it("o hino, tocando ou pausado, é o alvo quando o metrônomo está calado", () => {
    expect(alvoDoAlternar("tocando", false, false)).toBe("hino");
    expect(alvoDoAlternar("pausado", false, true)).toBe("hino");
  });

  it("o metrônomo pausado volta a tocar quando não há hino", () => {
    expect(alvoDoAlternar("parado", false, true)).toBe("metronomo-pausado");
  });

  it("sem nada a alternar, devolve nulo", () => {
    expect(alvoDoAlternar("parado", false, false)).toBeNull();
  });
});
