import { describe, expect, it } from "vitest";
// @ts-expect-error o projeto não instala @types/node
import { readFileSync } from "node:fs";

// "Nivelar as notas" (I-23) vale na PRÓXIMA vez que toca: o valor é lido UMA vez, em `tocar`, e guardado em `agendado`; todo reagendamento (arrastar a
// barra, retomar depois de mexer em tom ou andamento) reusa o guardado. Se relesse a preferência, virar o interruptor em Ajustes (o miniplayer aparece lá)
// com o hino tocando mudaria o resto da música no meio, o que estraga a comparação de ouvido para a qual o interruptor existe (comentário do vandame na #50).
//
// Esta é uma guarda ESTÁTICA, de propósito: o Vitest deste projeto não compila runes, então um módulo `.svelte.ts` como `reproducao.svelte.ts` não
// pode ser importado num teste (`$state is not defined`, também em `i18n/index.svelte.ts`). Mexer na infraestrutura de testes está fora do escopo.
const fonte: string = readFileSync(new URL("../src/lib/reproducao.svelte.ts", import.meta.url), "utf-8");
const sem = (re: RegExp) => (fonte.match(re) ?? []).length;

describe('"Nivelar as notas" na reprodução (guarda estática)', () => {
  it("a preferência é lida uma vez só, ao começar a tocar", () => {
    expect(sem(/lerNivelar\(\)/g)).toBe(1);
    expect(fonte).toMatch(/const nivelar = lerNivelar\(\);/);
  });

  it("o valor lido é guardado no que está agendado", () => {
    expect(fonte).toMatch(/type Agendado = \{[^}]*nivelar: boolean[^}]*\}/);
    expect(fonte).toMatch(/instrumentos: \[\.\.\.c\.instrumentos\],\s*nivelar,\s*\};/); // em tocar()
  });

  it("todo reagendamento reusa o valor guardado, no som e no registro do que foi reagendado", () => {
    expect(sem(/nivelar: agendado\.nivelar,/g)).toBe(2); // opções do sint.tocar e o novo `agendado`
  });
});
