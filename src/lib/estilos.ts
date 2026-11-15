// Estilos de cor do app (paletas em src/lib/tema.css). O modo (Automático, Claro, Escuro) é outra escolha, em
// src/lib/tema.svelte.ts: cada estilo tem versão clara e escura, então as duas escolhas se combinam (6 paletas).
//
//   normal      o visual de sempre (cinza azulado e azul)
//   pergaminho  claro em bege, papiro e marfim; escuro quente, mais claro que o normal (I-02)
//   marinho     azul-marinho e dourado do ícone (I-14)
//
// O script de src/app.html aplica o estilo salvo antes da primeira pintura e repete esta lista à mão:
// tests/estilos.test.ts confere que as duas continuam iguais.

/** Chave do localStorage onde o estilo é guardado. O script de src/app.html lê a mesma chave (conferido em tests/). */
export const CHAVE_ESTILO = "estilo";

export const ESTILOS = ["normal", "pergaminho", "marinho"] as const;
export type Estilo = (typeof ESTILOS)[number];

export const ehEstilo = (x: unknown): x is Estilo => typeof x === "string" && (ESTILOS as readonly string[]).includes(x);
