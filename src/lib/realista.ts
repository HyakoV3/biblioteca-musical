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
   * Multiplicador de volume que iguala o som gravado ao da síntese equivalente (medido em 2026-11-15: RMS de três notas na
   * faixa da voz, mesma cadeia de áudio; ganho = volume da síntese ÷ volume do gravado). As amostras vêm mais baixas.
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
  // Ganho 7,1 (era 2,65): a calibração por RMS escondia que o tirantes tem o registro de 16' (0,5x a nota) 1,9x mais forte
  // que a própria nota, energia grave que o ouvido e o alto-falante do celular quase não reproduzem. Medido com
  // `tools/analisar-timbres.py --niveis` (2026-11-15): ele era o mais baixo dos 16, 8,6 dB abaixo da mediana no ouvido
  // (curva A) e 9,8 dB no celular; +8,6 dB o põe na mediana do ouvido, com pico de 0,62.
  real_orgao_tirantes: { arquivo: "drawbar_organ", ganho: 7.1, grupo: "orgao", vozes: TODAS, sintetico: "orgao_principal" },
  real_flauta: { arquivo: "flute", ganho: 3.95, grupo: "madeiras", vozes: ["soprano"] },
  real_flauta_doce: { arquivo: "recorder", ganho: 3.8, grupo: "madeiras", vozes: ["soprano"], sintetico: "flauta_doce" },
  real_clarinete: { arquivo: "clarinet", ganho: 1.65, grupo: "madeiras", vozes: ["soprano"], sintetico: "clarinete" },
  real_oboe: { arquivo: "oboe", ganho: 1.14, grupo: "madeiras", vozes: ["contralto"], sintetico: "oboe" },
  real_sax_alto: { arquivo: "alto_sax", ganho: 1.27, grupo: "madeiras", vozes: ["contralto"], sintetico: "sax_alto" },
  real_sax_tenor: { arquivo: "tenor_sax", ganho: 1.66, grupo: "madeiras", vozes: ["tenor"], sintetico: "sax_tenor" },
  real_fagote: { arquivo: "bassoon", ganho: 1.44, grupo: "madeiras", vozes: ["baixo"], sintetico: "fagote" },
  real_trompete: { arquivo: "trumpet", ganho: 0.99, grupo: "metais", vozes: ["soprano"], sintetico: "trompete" },
  real_trompa: { arquivo: "french_horn", ganho: 2.87, grupo: "metais", vozes: ["tenor"], sintetico: "trompa" },
  real_trombone: { arquivo: "trombone", ganho: 0.91, grupo: "metais", vozes: ["tenor"], sintetico: "trombone" },
  real_tuba: { arquivo: "tuba", ganho: 2.28, grupo: "metais", vozes: ["baixo"], sintetico: "tuba" },
  real_violino: { arquivo: "violin", ganho: 1.19, grupo: "cordas", vozes: ["soprano"], sintetico: "violino" },
  real_viola: { arquivo: "viola", ganho: 2.07, grupo: "cordas", vozes: ["contralto"], sintetico: "viola" },
  real_violoncelo: { arquivo: "cello", ganho: 1.78, grupo: "cordas", vozes: ["tenor"], sintetico: "violoncelo" },
  real_contrabaixo: { arquivo: "contrabass", ganho: 4.87, grupo: "cordas", vozes: ["baixo"], sintetico: "contrabaixo" },
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
