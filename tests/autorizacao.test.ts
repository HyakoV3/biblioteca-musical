import { describe, expect, it } from "vitest";
// @ts-expect-error o projeto não instala @types/node (mesma solução do partitura-classes.test.ts)
import { readFileSync } from "node:fs";

// Os manifestos do hinário e das partituras apontam para um Release público do GitHub. Distribuir esse conteúdo exige a autorização do transcritor,
// registrada em `docs/licencas-de-terceiros.md` (a única fonte). Este teste impede que um manifesto passe a apontar para um pacote sem o registro:
// se alguém trocar o endereço sem a autorização estar escrita ali, ele fica vermelho.
const raiz = new URL("../", import.meta.url);
const ler = (caminho: string): string => readFileSync(new URL(caminho, raiz), "utf-8");

describe("autorização para distribuir o hinário e as partituras", () => {
  const manifestos = [
    ["hinário", "src/lib/hinario/manifesto.json"],
    ["partituras", "src/lib/partituras/manifesto.json"],
  ] as const;

  it.each(manifestos)("o manifesto de %s só aponta para um pacote com a autorização registrada", (_nome, caminho) => {
    const { pacote } = JSON.parse(ler(caminho)) as { pacote: { url: string } | null };
    if (pacote === null) return; // sem pacote publicado: nada a registrar
    const registro = ler("docs/licencas-de-terceiros.md");
    expect(registro, `${caminho} aponta para ${pacote.url}, mas docs/licencas-de-terceiros.md não registra a autorização`).toMatch(/\*\*Autorização \(registrada em \d{4}-\d{2}-\d{2}\):\*\*/);
  });

  it("o registro diz o que a autorização não cobre", () => {
    expect(ler("docs/licencas-de-terceiros.md")).toContain("O que a autorização NÃO cobre");
  });
});
