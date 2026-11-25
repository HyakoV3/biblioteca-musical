// Os filtros de ruído do Gravador (I-29): a escolha da pessoa e o que o gravador aplica. PURO (sem áudio): vale para a tela, para a preferência e para os testes.
//  - "desligado": o som sai como foi tocado ou cantado (o padrão).
//  - "android": o filtro do próprio aparelho (`noiseSuppression` do navegador): leve, mas a qualidade varia por aparelho.
//  - "rnnoise": rede neural pequena para voz (WebAssembly num AudioWorklet), local e offline.
//  - "gtcrn": outra rede neural para voz, também local (a que sobrou no lugar do DeepFilterNet3, cujo pacote baixa o modelo de um CDN de terceiros).
export const FILTROS_DE_RUIDO = ["desligado", "android", "rnnoise", "gtcrn"] as const;
export type FiltroDeRuido = (typeof FILTROS_DE_RUIDO)[number];
export const FILTRO_PADRAO: FiltroDeRuido = "desligado";

export const ehFiltroDeRuido = (v: unknown): v is FiltroDeRuido => typeof v === "string" && (FILTROS_DE_RUIDO as readonly string[]).includes(v);

/** Os filtros por rede neural precisam de um contexto de áudio de 48 kHz e de um AudioWorklet. */
export const ehNeural = (f: FiltroDeRuido): f is "rnnoise" | "gtcrn" => f === "rnnoise" || f === "gtcrn";

/** Taxa de amostragem que os filtros neurais pedem. */
export const TAXA_NEURAL = 48000;

/**
 * O valor lembrado, validado. O formato antigo era uma caixa ("1" ligada, "0" desligada): "1" vale "android" (era o filtro do aparelho). Qualquer outra coisa volta ao padrão.
 */
export function lerFiltro(bruto: unknown): FiltroDeRuido {
  if (bruto === "1") return "android";
  return ehFiltroDeRuido(bruto) ? bruto : FILTRO_PADRAO;
}
