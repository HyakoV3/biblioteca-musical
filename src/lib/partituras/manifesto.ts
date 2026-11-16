import dados from "./manifesto.json";
import type { ManifestoPartituras } from "./tipos";

/** O pacote de partituras que o app sabe baixar (gerado por tools/montar-manifesto-partituras.py). `pacote` é null enquanto não há um publicado. */
export const MANIFESTO: ManifestoPartituras = dados;
