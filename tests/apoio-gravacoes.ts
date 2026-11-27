import { IDBFactory, IDBKeyRange } from "fake-indexeddb";
import { vi } from "vitest";
import { Gravacoes } from "../src/lib/gravacoes";

// Apoio dos testes de `gravacoes` (divididos por assunto em tests/gravacoes-*.test.ts).
// O Node não tem IDBKeyRange; no WebView ele é global. Importar este arquivo já o instala.
vi.stubGlobal("IDBKeyRange", IDBKeyRange);

export const novo = () => new Gravacoes(() => new IDBFactory());
export const audio = (bytes: number) => new Blob([new Uint8Array(bytes)], { type: "audio/webm" });

/** Uma fábrica cujos primeiros `mudos` pedidos de `open` nunca disparam evento nenhum; os seguintes vão para um IDBFactory de verdade. */
export function fabricaMuda(mudos: number) {
  const real = new IDBFactory();
  const chamadas = { n: 0 };
  const open = (nome: string, versao?: number) => {
    chamadas.n++;
    if (chamadas.n <= mudos) return {} as IDBOpenDBRequest; // nunca chama onsuccess, onerror nem onblocked
    return real.open(nome, versao);
  };
  const fabrica = { open } as unknown as IDBFactory;
  return { fabrica, chamadas };
}
