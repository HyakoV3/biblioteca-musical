// Catálogo dos instrumentos "gravados" (I-07): amostras do banco FluidR3_GM (licença MIT) tocadas com a biblioteca smplr,
// no lugar da síntese. São um pacote OPCIONAL, baixado em Ajustes (docs/pacote-de-sons.md): os arquivos ficam no
// armazenamento do aparelho (src/lib/sons/armazenamento.ts) e só aparecem para escolha depois de baixados.
import type { SinteticoId, TipoVoz } from "./instrumentos";

/** Grupo de download: cada um é uma pasta compartilhada própria no servidor (um zip por link). */
export type GrupoId = "orgao" | "madeiras" | "metais" | "cordas";

type Entrada = {
  /** Nome do instrumento no banco: o arquivo é `<arquivo>-mp3.js`. */
  arquivo: string;
  /**
   * Multiplicador de volume que leva TODOS os gravados ao mesmo nível médio no ouvido (curva A, notas na faixa das vozes do
   * instrumento). Calculado por `tools/analisar-timbres.py --fonte <pasta das amostras> --calibrar --escrever` (alvo -24,6 dB, o
   * nível mediano de antes da troca do banco, então o volume geral do app não mudou). Refazer sempre que as amostras mudarem.
   */
  ganho: number;
  grupo: GrupoId;
  /** Vozes do coro para as quais o instrumento é oferecido (a mesma divisão dos sintetizados). */
  vozes: readonly TipoVoz[];
  /** O instrumento sintetizado equivalente (o alternador Sintetizado/Gravado troca de modo mantendo o instrumento). */
  sintetico?: SinteticoId;
};

const TODAS: readonly TipoVoz[] = ["soprano", "contralto", "tenor", "baixo"];

export const REALISTAS = {
  // O órgão de tirantes foi o escolhido como o mais parecido com o da igreja.
  // Nota sobre o tirantes: com o banco anterior (FluidR3) ele precisou de ganho 7,1 e depois 9,5, porque a calibração por RMS
  // escondia que o registro de 16' (0,5x a nota) tinha 1,9x a energia da própria nota, grave que o ouvido e o alto-falante do
  // celular quase não reproduzem. Com o GeneralUser GS o órgão é outro e a medida pelo ouvido (curva A) já o iguala aos demais.
  // Se no celular ainda soar abaixo dos outros, subir só o dele (o teto do teste é 10).
  real_orgao_tirantes: { arquivo: "drawbar_organ", ganho: 4.39, grupo: "orgao", vozes: TODAS, sintetico: "orgao_principal" },
  real_flauta: { arquivo: "flute", ganho: 1.33, grupo: "madeiras", vozes: ["soprano"], sintetico: "flauta" },
  real_flauta_doce: { arquivo: "recorder", ganho: 2.0, grupo: "madeiras", vozes: ["soprano"] },
  real_clarinete: { arquivo: "clarinet", ganho: 1.68, grupo: "madeiras", vozes: ["soprano"], sintetico: "clarinete" },
  real_oboe: { arquivo: "oboe", ganho: 1.54, grupo: "madeiras", vozes: ["contralto"], sintetico: "oboe" },
  real_sax_alto: { arquivo: "alto_sax", ganho: 2.62, grupo: "madeiras", vozes: ["contralto"], sintetico: "sax_alto" },
  real_sax_tenor: { arquivo: "tenor_sax", ganho: 4.09, grupo: "madeiras", vozes: ["tenor"], sintetico: "sax_tenor" },
  real_fagote: { arquivo: "bassoon", ganho: 1.97, grupo: "madeiras", vozes: ["baixo"], sintetico: "fagote" },
  real_trompete: { arquivo: "trumpet", ganho: 2.27, grupo: "metais", vozes: ["soprano"], sintetico: "trompete" },
  real_trompa: { arquivo: "french_horn", ganho: 2.64, grupo: "metais", vozes: ["tenor"], sintetico: "trompa" },
  real_trombone: { arquivo: "trombone", ganho: 2.37, grupo: "metais", vozes: ["tenor"], sintetico: "trombone" },
  real_tuba: { arquivo: "tuba", ganho: 3.22, grupo: "metais", vozes: ["baixo"], sintetico: "tuba" },
  real_violino: { arquivo: "violin", ganho: 1.45, grupo: "cordas", vozes: ["soprano"], sintetico: "violino" },
  real_viola: { arquivo: "viola", ganho: 3.09, grupo: "cordas", vozes: ["contralto"], sintetico: "viola" },
  real_violoncelo: { arquivo: "cello", ganho: 2.17, grupo: "cordas", vozes: ["tenor"], sintetico: "violoncelo" },
  real_contrabaixo: { arquivo: "contrabass", ganho: 4.01, grupo: "cordas", vozes: ["baixo"], sintetico: "contrabaixo" },
} as const satisfies Record<string, Entrada>;

export type RealistaId = keyof typeof REALISTAS;
export const IDS_REALISTAS = Object.keys(REALISTAS) as RealistaId[];

export const ehRealista = (id: string): id is RealistaId => Object.hasOwn(REALISTAS, id);

/** Nome do arquivo de amostras do instrumento (também é a chave dele no armazenamento e no manifesto). */
export const arquivoDoRealista = (id: RealistaId): string => `${REALISTAS[id].arquivo}-mp3.js`;

/** Endereço virtual do instrumento no armazenamento do app (nunca é buscado na rede). */
export const urlDoRealista = (id: RealistaId): string => `/sons/${arquivoDoRealista(id)}`;

/** Os instrumentos gravados oferecidos para uma voz (tipo desconhecido, como "Parte I", recebe todos). */
export const realistasDaVoz = (tipo: TipoVoz | null): RealistaId[] =>
  IDS_REALISTAS.filter((id) => tipo === null || (REALISTAS[id].vozes as readonly TipoVoz[]).includes(tipo));

/** O gravado equivalente a um sintetizado, se houver. */
export const gravadoEquivalente = (sintetico: string): RealistaId | null =>
  IDS_REALISTAS.find((id) => (REALISTAS[id] as { sintetico?: string }).sintetico === sintetico) ?? null;

/** O sintetizado equivalente a um gravado, se houver. */
export const sinteticoEquivalente = (id: RealistaId): SinteticoId | null =>
  (REALISTAS[id] as { sintetico?: SinteticoId }).sintetico ?? null;
