// O contexto de uma gravação (I-38): o que a pessoa ouvia no fone enquanto gravava (o metrônomo ou um hino). Guarda DADOS (fica junto da gravação, com versão) e gera daí um texto
// curto em Markdown, no idioma da tela, para ir abaixo do áudio quando a pessoa o envia (ao professor, por exemplo). Tudo aqui é puro e testado; quem lê o estado do app é o Gravador.
// Aqui ficam os DADOS (montar, comparar, validar); o texto vem de contexto-texto.ts e é reexportado, para que os imports não mudem.

export { limparParaMarkdown, linhasDoContexto, resumoDoContexto, textoDoContexto, type LinhaDoContexto, type OpcoesDasLinhas, type Tradutor } from "./contexto-texto";

export const VERSAO_DO_CONTEXTO = 1;

export type ContextoMetronomo = {
  bpm: number;
  /** Cliques por compasso: 2, 3 e 4 (simples) ou 6, 9 e 12 (compostos, de 3 em 3). */
  cliques: number;
  familia: "simples" | "composto";
  /** Tempos do compasso: 2, 3 ou 4 (nos compostos, os cliques ÷ 3). */
  tempos: number;
};

export type ContextoHino = {
  numero: number;
  titulo: string;
  tonalidade?: string;
  /** Semitons de transposição (−6 a +6). */
  transposicao: number;
  andamento: number;
  /** O andamento do hino no pacote, quando a pessoa o mudou. */
  andamentoOriginal?: number;
  /** "tudo", "intro" ou o número da vez. */
  parte: "tudo" | "intro" | number;
  vozes: { nome: string; tocando: boolean }[];
};

export type ContextoGravacao = {
  v: number;
  /** Sempre verdadeiro: sem fone o app nem deixa o som tocar durante a gravação. */
  fone: true;
  origem: "metronomo" | "hino";
  metronomo?: ContextoMetronomo;
  hino?: ContextoHino;
  /** Algo mudou (andamento, vozes, hino parou) depois de a gravação começar: os valores acima são os do início. */
  mudouDurante?: boolean;
};

/** O que o Gravador lê do app no instante em que começa (ou termina) a gravação. */
export type Entrada = {
  fone: boolean;
  metronomo: { ligado: boolean; bpm: number; compasso: number };
  hino: {
    tocando: boolean;
    numero: number;
    titulo: string;
    tonalidade?: string | null;
    transposicao: number;
    andamento: number;
    andamentoOriginal?: number | null;
    parte: "tudo" | "intro" | number;
    vozes: { nome: string; muda: boolean }[];
  } | null;
};

const COMPOSTOS = [6, 9, 12];

type EntradaHino = NonNullable<Entrada["hino"]>;

function contextoDeHino(h: EntradaHino): ContextoGravacao {
  const original = h.andamentoOriginal ?? undefined;
  return {
    v: VERSAO_DO_CONTEXTO,
    fone: true,
    origem: "hino",
    hino: {
      numero: h.numero,
      titulo: h.titulo,
      ...(h.tonalidade ? { tonalidade: h.tonalidade } : {}),
      transposicao: h.transposicao,
      andamento: h.andamento,
      ...(original !== undefined && original !== h.andamento ? { andamentoOriginal: original } : {}),
      parte: h.parte,
      vozes: h.vozes.map((v) => ({ nome: v.nome, tocando: !v.muda })),
    },
  };
}

function contextoDeMetronomo(m: Entrada["metronomo"]): ContextoGravacao {
  const composto = COMPOSTOS.includes(m.compasso);
  return {
    v: VERSAO_DO_CONTEXTO,
    fone: true,
    origem: "metronomo",
    metronomo: { bpm: m.bpm, cliques: m.compasso, familia: composto ? "composto" : "simples", tempos: composto ? m.compasso / 3 : m.compasso },
  };
}

/** O contexto do que está tocando agora, ou nulo se não há fone (o som não toca com a gravação) ou nada está tocando. O hino tem prioridade (os dois não tocam juntos). */
export function montarContexto(e: Entrada): ContextoGravacao | null {
  if (!e.fone) return null;
  if (e.hino?.tocando) return contextoDeHino(e.hino);
  if (e.metronomo.ligado) return contextoDeMetronomo(e.metronomo);
  return null;
}

const semMarca = (c: ContextoGravacao): ContextoGravacao => {
  const { mudouDurante: _, ...resto } = c;
  return resto;
};

/** Compara o contexto do início com o do fim: se mudou, o do início ganha a marca `mudouDurante`. */
export function marcarMudanca(inicio: ContextoGravacao | null, fim: ContextoGravacao | null): ContextoGravacao | null {
  if (!inicio) return null;
  const base = semMarca(inicio);
  return fim !== null && JSON.stringify(base) === JSON.stringify(semMarca(fim)) ? base : { ...base, mudouDurante: true };
}

const finito = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

function metronomoValido(m: ContextoGravacao["metronomo"]): boolean {
  return !!m && finito(m.bpm) && finito(m.cliques) && (m.familia === "simples" || m.familia === "composto") && [2, 3, 4].includes(m.tempos);
}

const vozValida = (v: { nome: string; tocando: boolean } | null | undefined): boolean => !!v && typeof v === "object" && typeof v.nome === "string" && typeof v.tocando === "boolean";

function hinoValido(h: ContextoGravacao["hino"]): boolean {
  return (
    !!h &&
    finito(h.numero) &&
    typeof h.titulo === "string" &&
    finito(h.andamento) &&
    finito(h.transposicao) &&
    (h.tonalidade === undefined || typeof h.tonalidade === "string") &&
    (h.andamentoOriginal === undefined || finito(h.andamentoOriginal)) &&
    (h.parte === "tudo" || h.parte === "intro" || finito(h.parte)) &&
    Array.isArray(h.vozes) &&
    h.vozes.every(vozValida)
  );
}

/** Quem valida o conteúdo de cada origem: uma origem nova entra aqui, sem mexer em `contextoValido`. */
const VALIDADORES: Record<ContextoGravacao["origem"], (c: Partial<ContextoGravacao>) => boolean> = {
  metronomo: (c) => metronomoValido(c.metronomo),
  hino: (c) => hinoValido(c.hino),
};

/** Lê um contexto guardado: devolve nulo se não é um objeto reconhecível. Campos que este app não conhece são ignorados ao ler, mas ficam no registro (não se reescreve o que está guardado). */
export function contextoValido(x: unknown): ContextoGravacao | null {
  if (!x || typeof x !== "object") return null;
  const c = x as Partial<ContextoGravacao>;
  if (typeof c.v !== "number" || c.v < 1 || c.v > VERSAO_DO_CONTEXTO) return null;
  const valida = typeof c.origem === "string" && Object.hasOwn(VALIDADORES, c.origem) ? VALIDADORES[c.origem] : undefined;
  return valida?.(c) ? (c as ContextoGravacao) : null;
}
