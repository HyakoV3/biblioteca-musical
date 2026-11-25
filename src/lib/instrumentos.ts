// Catálogo de instrumentos sintetizados (aproximações por síntese aditiva, não gravações).
// Cada instrumento é descrito por harmônicos, envelope e vibrato opcional.

import type { RealistaId } from "./realista";

export type Perfil = {
  /** Amplitudes dos harmônicos (índice 0 é ignorado). */
  harmonicos: number[];
  ataque: number; // segundos
  solta: number; // segundos
  nivel: number; // pico de volume do instrumento (equilibra a sensação de volume)
  /** Vibrato: frequência (Hz), profundidade (centésimos de tom) e atraso (s). */
  vibrato?: { hz: number; cents: number; atraso: number };
};

export const INSTRUMENTOS = {
  // Órgãos
  orgao_suave: { harmonicos: [0, 1, 0.15, 0.03], ataque: 0.04, solta: 0.1, nivel: 0.3 },
  orgao_principal: { harmonicos: [0, 1, 0.5, 0.35, 0.25, 0.15, 0.1, 0.07], ataque: 0.03, solta: 0.09, nivel: 0.2 },
  orgao_pleno: { harmonicos: [0, 1, 0.8, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1, 0.07, 0.05], ataque: 0.03, solta: 0.1, nivel: 0.12 },
  // Soprano
  // Flautas: a doce e a transversal (2026-11-25). Com timbre medido (timbres.json) esta tabela só serve de referência de volume (`nivel`); fora da faixa medida vale a âncora da ponta.
  flauta_doce: { harmonicos: [0, 1, 0.05, 0.02], ataque: 0.05, solta: 0.1, nivel: 0.3, vibrato: { hz: 5, cents: 6, atraso: 0.3 } },
  flauta: { harmonicos: [0, 1, 0.55, 0.15, 0.12, 0.05, 0.02], ataque: 0.06, solta: 0.1, nivel: 0.28, vibrato: { hz: 5.2, cents: 7, atraso: 0.3 } },
  violino: { harmonicos: [0, 1, 0.7, 0.55, 0.45, 0.35, 0.3, 0.25, 0.2, 0.15, 0.12, 0.1], ataque: 0.06, solta: 0.1, nivel: 0.14, vibrato: { hz: 5.5, cents: 14, atraso: 0.15 } },
  clarinete: { harmonicos: [0, 1, 0.02, 0.6, 0.02, 0.35, 0.02, 0.2, 0.02, 0.1], ataque: 0.04, solta: 0.08, nivel: 0.2 },
  trompete: { harmonicos: [0, 1, 0.9, 0.75, 0.6, 0.5, 0.4, 0.3, 0.22, 0.15, 0.1], ataque: 0.03, solta: 0.06, nivel: 0.1 },
  // Contralto
  sax_alto: { harmonicos: [0, 1, 0.55, 0.45, 0.3, 0.25, 0.15, 0.1, 0.07], ataque: 0.04, solta: 0.08, nivel: 0.17, vibrato: { hz: 5, cents: 8, atraso: 0.25 } },
  flugelhorn: { harmonicos: [0, 1, 0.5, 0.3, 0.18, 0.1, 0.06], ataque: 0.05, solta: 0.08, nivel: 0.2 },
  oboe: { harmonicos: [0, 0.7, 1, 0.8, 0.5, 0.35, 0.25, 0.15, 0.1], ataque: 0.04, solta: 0.07, nivel: 0.14, vibrato: { hz: 5.2, cents: 7, atraso: 0.2 } },
  viola: { harmonicos: [0, 1, 0.8, 0.5, 0.3, 0.25, 0.15, 0.1], ataque: 0.07, solta: 0.1, nivel: 0.17, vibrato: { hz: 5, cents: 12, atraso: 0.2 } },
  // Tenor
  sax_tenor: { harmonicos: [0, 1, 0.5, 0.5, 0.25, 0.2, 0.12, 0.08], ataque: 0.05, solta: 0.09, nivel: 0.18, vibrato: { hz: 4.8, cents: 8, atraso: 0.25 } },
  trombone: { harmonicos: [0, 1, 0.7, 0.5, 0.35, 0.25, 0.15, 0.1], ataque: 0.05, solta: 0.08, nivel: 0.15 },
  trompa: { harmonicos: [0, 1, 0.35, 0.2, 0.1, 0.06], ataque: 0.07, solta: 0.1, nivel: 0.24 },
  violoncelo: { harmonicos: [0, 1, 0.7, 0.55, 0.4, 0.3, 0.2, 0.15, 0.1, 0.08], ataque: 0.07, solta: 0.1, nivel: 0.16, vibrato: { hz: 5, cents: 10, atraso: 0.2 } },
  // Baixo
  tuba: { harmonicos: [0, 1, 0.4, 0.2, 0.1, 0.05], ataque: 0.06, solta: 0.1, nivel: 0.28 },
  bombardino: { harmonicos: [0, 1, 0.55, 0.3, 0.18, 0.1, 0.06], ataque: 0.05, solta: 0.09, nivel: 0.22 },
  fagote: { harmonicos: [0, 1, 0.6, 0.7, 0.4, 0.25, 0.12, 0.06], ataque: 0.05, solta: 0.09, nivel: 0.17 },
  contrabaixo: { harmonicos: [0, 1, 0.5, 0.3, 0.2, 0.1, 0.05], ataque: 0.06, solta: 0.1, nivel: 0.26, vibrato: { hz: 4.5, cents: 6, atraso: 0.3 } },
} satisfies Record<string, Perfil>;

/** Instrumento sintetizado (receita de harmônicos). */
export type SinteticoId = keyof typeof INSTRUMENTOS;
/** Qualquer instrumento oferecido: sintetizado ou gravado (protótipo da I-07). */
export type InstrumentoId = SinteticoId | RealistaId;

export const ORGAOS: InstrumentoId[] = ["orgao_suave", "orgao_principal", "orgao_pleno"];
export const PADRAO: SinteticoId = "orgao_principal";

export type TipoVoz = "soprano" | "contralto" | "tenor" | "baixo";

/** Instrumentos oferecidos para cada voz do coro (além dos órgãos). */
export const POR_VOZ: Record<TipoVoz, InstrumentoId[]> = {
  soprano: ["flauta", "flauta_doce", "violino", "clarinete", "trompete"],
  contralto: ["sax_alto", "flugelhorn", "oboe", "viola"],
  tenor: ["sax_tenor", "trombone", "trompa", "violoncelo"],
  baixo: ["tuba", "bombardino", "fagote", "contrabaixo"],
};

const sem_acentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Reconhece o tipo da voz pelo nome (pt/es/en). Outros nomes (ex.: "Parte I") devolvem null. */
export function tipoDaVoz(nome: string): TipoVoz | null {
  switch (sem_acentos(nome)) {
    case "soprano":
      return "soprano";
    case "contralto":
    case "alto":
      return "contralto";
    case "tenor":
      return "tenor";
    case "baixo":
    case "bajo":
    case "bass":
      return "baixo";
    default:
      return null;
  }
}

/** Instrumentos disponíveis para uma voz: os da sua faixa; sem tipo conhecido, todos. */
export function instrumentosDaVoz(nome: string): InstrumentoId[] {
  const tipo = tipoDaVoz(nome);
  if (tipo) return POR_VOZ[tipo];
  return Object.values(POR_VOZ).flat();
}
