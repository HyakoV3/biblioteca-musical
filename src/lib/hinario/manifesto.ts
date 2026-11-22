import dados from "./manifesto.json";
import type { ManifestoPartituras } from "../partituras/tipos";

/**
 * O hinário que o app sabe baixar (`hinario-<sha8>.json`, com os 8 primeiros caracteres do SHA-256 no nome; o `hinario.json` de docs/FORMATO.md). Tem o mesmo desenho do manifesto das partituras (endereço, nome do
 * arquivo, tamanho e SHA-256), porque o download, a conferência e a extração da pasta são os mesmos: o app só instala o que bater EXATAMENTE com este manifesto.
 * O texto e a música dos hinos NÃO vão dentro do app nem do Git (conteúdo de terceiros): ficam no servidor e a pessoa os baixa uma vez. `pacote` é null
 * enquanto não há um publicado.
 */
export const MANIFESTO_HINARIO: ManifestoPartituras = dados;
