import { describe, expect, it } from "vitest";
import { juntar } from "../src/lib/bytes";

describe("juntar", () => {
  it("concatena os blocos na ordem", () => {
    expect(Array.from(juntar([new Uint8Array([1, 2]), new Uint8Array([]), new Uint8Array([3])]))).toEqual([1, 2, 3]);
  });
  it("sem blocos devolve vazio", () => {
    expect(juntar([]).length).toBe(0);
  });
});
