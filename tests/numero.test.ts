import { describe, expect, it } from "vitest";
import { casaComNumero, zerosAEsquerda } from "../src/lib/numero";

describe("número do hino na lista", () => {
  it("preenche a três dígitos sem cortar 1000", () => {
    expect([1, 9, 10, 99, 100, 457, 480, 1000].map((n) => zerosAEsquerda(n) + n)).toEqual([
      "001", "009", "010", "099", "100", "457", "480", "1000",
    ]);
    expect([1, 9, 10, 457].map(zerosAEsquerda)).toEqual(["00", "00", "0", ""]); // só os zeros que faltam
  });

  it("1, 01 e 001 acham o hino 1; sem prefixo nem outro número", () => {
    expect(["1", "01", "001", "0001"].map((q) => casaComNumero(q, 1))).toEqual([true, true, true, true]);
    expect(["2", "10", "11", "001"].map((q) => casaComNumero(q, 10))).toEqual([false, true, false, false]);
  });

  it("texto que não é só dígitos não casa", () => {
    expect(["", "abc", "1a", " 1", "-1", "1.0"].map((q) => casaComNumero(q, 1))).toEqual(new Array(6).fill(false));
  });
});
