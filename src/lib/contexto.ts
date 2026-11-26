// O contexto de uma gravação (I-38): o que a pessoa ouvia no fone enquanto gravava (o metrônomo ou um hino). Guarda DADOS (fica junto da gravação, com versão) e gera daí um texto
// curto em Markdown, no idioma da tela, para ir abaixo do áudio quando a pessoa o envia (ao professor, por exemplo). Tudo aqui é puro e testado; quem lê o estado do app é o Gravador.

import type { Idioma } from "./i18n/index.svelte";
import { tipoDaVoz } from "./instrumentos";
import { nomeDaTonalidade, type Notacao } from "./notacao";

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

/** O contexto do que está tocando agora, ou nulo se não há fone (o som não toca com a gravação) ou nada está tocando. O hino tem prioridade (os dois não tocam juntos). */
export function montarContexto(e: Entrada): ContextoGravacao | null {
  if (!e.fone) return null;
  if (e.hino?.tocando) {
    const h = e.hino;
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
  if (e.metronomo.ligado) {
    const composto = COMPOSTOS.includes(e.metronomo.compasso);
    return {
      v: VERSAO_DO_CONTEXTO,
      fone: true,
      origem: "metronomo",
      metronomo: {
        bpm: e.metronomo.bpm,
        cliques: e.metronomo.compasso,
        familia: composto ? "composto" : "simples",
        tempos: composto ? e.metronomo.compasso / 3 : e.metronomo.compasso,
      },
    };
  }
  return null;
}

/** Compara o contexto do início com o do fim: se mudou, o do início ganha a marca `mudouDurante`. */
export function marcarMudanca(inicio: ContextoGravacao | null, fim: ContextoGravacao | null): ContextoGravacao | null {
  if (!inicio) return null;
  const semMarca = (c: ContextoGravacao): ContextoGravacao => {
    const { mudouDurante: _, ...resto } = c;
    return resto;
  };
  const base = semMarca(inicio);
  return fim !== null && JSON.stringify(base) === JSON.stringify(semMarca(fim)) ? base : { ...base, mudouDurante: true };
}

const finito = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Lê um contexto guardado: devolve nulo se não é um objeto reconhecível. Campos que este app não conhece são ignorados ao ler, mas ficam no registro (não se reescreve o que está guardado). */
export function contextoValido(x: unknown): ContextoGravacao | null {
  if (!x || typeof x !== "object") return null;
  const c = x as Partial<ContextoGravacao>;
  if (typeof c.v !== "number" || c.v < 1 || c.v > VERSAO_DO_CONTEXTO) return null;
  if (c.origem === "metronomo") {
    const m = c.metronomo;
    return m && finito(m.bpm) && finito(m.cliques) && (m.familia === "simples" || m.familia === "composto") && [2, 3, 4].includes(m.tempos) ? (c as ContextoGravacao) : null;
  }
  if (c.origem === "hino") {
    const h = c.hino;
    return h &&
      finito(h.numero) &&
      typeof h.titulo === "string" &&
      finito(h.andamento) &&
      finito(h.transposicao) &&
      (h.tonalidade === undefined || typeof h.tonalidade === "string") &&
      (h.andamentoOriginal === undefined || finito(h.andamentoOriginal)) &&
      (h.parte === "tudo" || h.parte === "intro" || finito(h.parte)) &&
      Array.isArray(h.vozes) &&
      h.vozes.every((v) => !!v && typeof v === "object" && typeof v.nome === "string" && typeof v.tocando === "boolean")
      ? (c as ContextoGravacao)
      : null;
  }
  return null;
}

export type Tradutor = (chave: string, p?: Record<string, string | number>) => string;

/** O título do hino entra entre aspas dentro de uma linha: sem os caracteres que o WhatsApp e o Telegram leem como formatação. */
export function limparParaMarkdown(s: string): string {
  return s.replace(/[*_~`]/g, "").replace(/\s+/g, " ").trim();
}

function lista(nomes: string[], idioma: string): string {
  try {
    return new Intl.ListFormat(idioma, { style: "long", type: "conjunction" }).format(nomes);
  } catch {
    return nomes.join(", ");
  }
}

/** Uma linha do contexto: o texto e, quando há, uma nota entre parênteses (o que foi tirado, o andamento original). `plano` não leva formatação; o Markdown a põe em itálico. */
export type LinhaDoContexto = { texto: string; nota?: string };

/** As linhas do contexto no idioma de `t`, sem formatação nenhuma (a tela do app mostra assim; o texto enviado as põe em Markdown, com `paraMarkdown`). Linhas que não se aplicam não aparecem. */
export function linhasDoContexto(c: ContextoGravacao, t: Tradutor, idioma: string, paraMarkdown = false, notacao: Notacao = "auto"): LinhaDoContexto[] {
  // Só o texto ENVIADO tira `* _ ~` e crases do título e do tom (os apps de mensagem os leriam como formatação); na tela do app não há Markdown a escapar.
  const limpo = (x: string) => (paraMarkdown ? limparParaMarkdown(x) : x);
  const linhas: LinhaDoContexto[] = [];
  if (c.origem === "metronomo" && c.metronomo) {
    const m = c.metronomo;
    linhas.push({ texto: m.familia === "composto" ? t("ctx.com_metronomo_composto", { bpm: m.bpm, porTempo: Math.round(m.bpm / 3) }) : t("ctx.com_metronomo", { bpm: m.bpm }) });
    const nome = t(`ctx.compasso.${m.familia}.${m.tempos}`);
    linhas.push({ texto: m.familia === "composto" ? t("ctx.compasso_composto", { nome, cliques: m.cliques, tempos: m.tempos }) : t("ctx.compasso_simples", { nome, tempos: m.tempos }) });
  }
  if (c.origem === "hino" && c.hino) {
    const h = c.hino;
    linhas.push({ texto: t("ctx.com_hino", { numero: h.numero, titulo: limpo(h.titulo) }) });
    // O nome da voz vem do hino (em português); o texto enviado o diz no idioma da tela. Nome fora do padrão (ex.: "Parte I") fica como está.
    const nome = (v: { nome: string }) => {
      const tipo = tipoDaVoz(v.nome);
      return (tipo ? t(`voz.${tipo}`) : v.nome).toLocaleLowerCase(idioma);
    };
    const tocando = h.vozes.filter((v) => v.tocando).map(nome);
    const fora = h.vozes.filter((v) => !v.tocando).map(nome);
    if (tocando.length === 0) linhas.push({ texto: t("ctx.sem_vozes") });
    else linhas.push({ texto: t("ctx.vozes", { lista: lista(tocando, idioma) }), ...(fora.length ? { nota: t("ctx.sem", { lista: lista(fora, idioma) }) } : {}) });
    linhas.push({ texto: t("ctx.andamento", { bpm: h.andamento }), ...(h.andamentoOriginal !== undefined ? { nota: t("ctx.original", { bpm: h.andamentoOriginal }) } : {}) });
    if (h.tonalidade) linhas.push({ texto: t("ctx.tom", { tom: limpo(nomeDaTonalidade(h.tonalidade, idioma as Idioma, notacao)) }) });
    if (h.transposicao !== 0) {
      const n = Math.abs(h.transposicao);
      linhas.push({ texto: t("ctx.transposicao", { n: `${h.transposicao > 0 ? "+" : "−"}${n}`, unidade: t(n === 1 ? "ctx.semitom_um" : "ctx.semitom_varios") }) });
    }
    if (h.parte === "intro") linhas.push({ texto: t("ctx.parte_intro") });
    else if (typeof h.parte === "number") linhas.push({ texto: t("ctx.parte_vez", { n: h.parte }) });
  }
  return linhas;
}

/** O texto em Markdown (só `*negrito*`, `_itálico_` e `- ` de lista: o que os apps de mensagem entendem), no idioma de `t`. Linhas que não se aplicam não aparecem. */
export function textoDoContexto(c: ContextoGravacao, t: Tradutor, idioma: string, notacao: Notacao = "auto"): string {
  const linhas: string[] = [`*${t("ctx.titulo")}*`];
  for (const l of linhasDoContexto(c, t, idioma, true, notacao)) linhas.push(`- ${l.texto}${l.nota ? ` _(${l.nota})_` : ""}`);
  if (c.mudouDurante) linhas.push(`_${t("ctx.mudou")}_`);
  return linhas.join("\n");
}

/** O resumo de uma linha para o card da gravação: "hino 10 · 60 bpm · +1 semitom" ou "metrônomo, 65 bpm". Os detalhes ficam nas linhas. */
export function resumoDoContexto(c: ContextoGravacao, t: Tradutor): string {
  if (c.origem === "hino" && c.hino) {
    const h = c.hino;
    const partes = [t("gravador.resumo_hino", { numero: h.numero }), `${h.andamento} bpm`];
    if (h.transposicao !== 0) {
      const n = Math.abs(h.transposicao);
      partes.push(`${h.transposicao > 0 ? "+" : "−"}${n} ${t(n === 1 ? "ctx.semitom_um" : "ctx.semitom_varios")}`);
    }
    return partes.join(" · ");
  }
  if (c.metronomo) return t("gravador.resumo_metronomo", { bpm: c.metronomo.bpm });
  return "";
}
