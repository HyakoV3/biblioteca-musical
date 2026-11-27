// O título de um hino no idioma da interface. O hino traz `titulo` (o padrão: o título ORIGINAL, na língua da letra) e, opcionalmente,
// `titulos` com o nome consagrado em português, inglês e espanhol (docs/FORMATO.md). Se a interface está na língua original do hino, `titulos` não repete o
// título (a chave daquela língua falta) e vale `titulo`; hinários antigos, sem `titulos`, também caem em `titulo`.

export type Titulos = { pt?: string; en?: string; es?: string };

/** O que o seletor precisa de um hino (o `Hino` do app serve). */
export type ComTitulos = { titulo: string; titulos?: Titulos | null };

/** O título do hino no idioma `idioma` ("pt", "en" ou "es"), com reserva em `titulo`. */
export function tituloDoHino(h: ComTitulos, idioma: string): string {
  const t = (h.titulos as Record<string, unknown> | null | undefined)?.[idioma];
  return typeof t === "string" && t.trim() ? t : h.titulo;
}

/** Todos os títulos do hino (o padrão primeiro, sem repetir), para a busca achar por qualquer um. */
export function todosOsTitulos(h: ComTitulos): string[] {
  const outros = Object.values(h.titulos ?? {}).filter((t): t is string => typeof t === "string" && t.trim() !== "");
  return [...new Set([h.titulo, ...outros])];
}
