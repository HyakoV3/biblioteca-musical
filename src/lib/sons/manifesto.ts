import dados from "./manifesto.json";
import type { ManifestoSons } from "./tipos";

/** Os pacotes que o app sabe baixar (gerado por tools/montar-manifesto-sons.py). */
export const MANIFESTO: ManifestoSons = dados;
