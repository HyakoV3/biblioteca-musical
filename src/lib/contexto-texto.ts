// O TEXTO do contexto de uma gravação (I-38): as linhas (na tela do app), o Markdown enviado e o resumo do card. Puro: recebe o tradutor pronto. Os dados e a leitura ficam em contexto.ts.

import type { Idioma } from "./i18n/index.svelte";
import { tipoDaVoz } from "./instrumentos";
import { nomeDaTonalidade, type Notacao } from "./notacao";
import type { ContextoGravacao, ContextoHino, ContextoMetronomo } from "./contexto";

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

/** O que as linhas de um contexto precisam: o tradutor, o idioma, a notação e o limpador do título e do tom. */
type Ambiente = { t: Tradutor; idioma: string; notacao: Notacao; limpo: (x: string) => string };

/** A transposição como o texto a mostra: o número com sinal ("+1", "−3") e a unidade no singular ou no plural. */
function descreverTransposicao(transposicao: number, t: Tradutor): { n: string; unidade: string } {
  const n = Math.abs(transposicao);
  return { n: `${transposicao > 0 ? "+" : "−"}${n}`, unidade: t(n === 1 ? "ctx.semitom_um" : "ctx.semitom_varios") };
}

function linhasDoMetronomo(m: ContextoMetronomo, { t }: Ambiente): LinhaDoContexto[] {
  const composto = m.familia === "composto";
  const nome = t(`ctx.compasso.${m.familia}.${m.tempos}`);
  return [
    { texto: composto ? t("ctx.com_metronomo_composto", { bpm: m.bpm, porTempo: Math.round(m.bpm / 3) }) : t("ctx.com_metronomo", { bpm: m.bpm }) },
    { texto: composto ? t("ctx.compasso_composto", { nome, cliques: m.cliques, tempos: m.tempos }) : t("ctx.compasso_simples", { nome, tempos: m.tempos }) },
  ];
}

/** O nome da voz vem do hino (em português); o texto enviado o diz no idioma da tela. Nome fora do padrão (ex.: "Parte I") fica como está. */
function nomeDaVoz(v: { nome: string }, { t, idioma }: Ambiente): string {
  const tipo = tipoDaVoz(v.nome);
  return (tipo ? t(`voz.${tipo}`) : v.nome).toLocaleLowerCase(idioma);
}

function linhaDasVozes(h: ContextoHino, amb: Ambiente): LinhaDoContexto {
  const { t, idioma } = amb;
  const tocando = h.vozes.filter((v) => v.tocando).map((v) => nomeDaVoz(v, amb));
  const fora = h.vozes.filter((v) => !v.tocando).map((v) => nomeDaVoz(v, amb));
  if (tocando.length === 0) return { texto: t("ctx.sem_vozes") };
  return { texto: t("ctx.vozes", { lista: lista(tocando, idioma) }), ...(fora.length ? { nota: t("ctx.sem", { lista: lista(fora, idioma) }) } : {}) };
}

function linhaDoAndamento(h: ContextoHino, { t }: Ambiente): LinhaDoContexto {
  return { texto: t("ctx.andamento", { bpm: h.andamento }), ...(h.andamentoOriginal !== undefined ? { nota: t("ctx.original", { bpm: h.andamentoOriginal }) } : {}) };
}

function linhaDaParte(parte: ContextoHino["parte"], t: Tradutor): LinhaDoContexto[] {
  if (parte === "intro") return [{ texto: t("ctx.parte_intro") }];
  if (typeof parte === "number") return [{ texto: t("ctx.parte_vez", { n: parte }) }];
  return [];
}

function linhasDoHino(h: ContextoHino, amb: Ambiente): LinhaDoContexto[] {
  const { t, idioma, notacao, limpo } = amb;
  const linhas: LinhaDoContexto[] = [{ texto: t("ctx.com_hino", { numero: h.numero, titulo: limpo(h.titulo) }) }, linhaDasVozes(h, amb), linhaDoAndamento(h, amb)];
  if (h.tonalidade) linhas.push({ texto: t("ctx.tom", { tom: limpo(nomeDaTonalidade(h.tonalidade, idioma as Idioma, notacao)) }) });
  if (h.transposicao !== 0) linhas.push({ texto: t("ctx.transposicao", descreverTransposicao(h.transposicao, t)) });
  return [...linhas, ...linhaDaParte(h.parte, t)];
}

/** `paraMarkdown`: o texto sai para o envio (sem `* _ ~` e crases no título e no tom). `notacao`: o nome das notas do tom. */
export type OpcoesDasLinhas = { paraMarkdown?: boolean; notacao?: Notacao };

/** As linhas do contexto no idioma de `t`, sem formatação nenhuma (a tela do app mostra assim; o texto enviado as põe em Markdown, com `paraMarkdown`). Linhas que não se aplicam não aparecem. */
export function linhasDoContexto(c: ContextoGravacao, t: Tradutor, idioma: string, { paraMarkdown = false, notacao = "auto" }: OpcoesDasLinhas = {}): LinhaDoContexto[] {
  // Só o texto ENVIADO tira `* _ ~` e crases do título e do tom (os apps de mensagem os leriam como formatação); na tela do app não há Markdown a escapar.
  const amb: Ambiente = { t, idioma, notacao, limpo: (x) => (paraMarkdown ? limparParaMarkdown(x) : x) };
  if (c.origem === "metronomo" && c.metronomo) return linhasDoMetronomo(c.metronomo, amb);
  if (c.origem === "hino" && c.hino) return linhasDoHino(c.hino, amb);
  return [];
}

/** O texto em Markdown (só `*negrito*`, `_itálico_` e `- ` de lista: o que os apps de mensagem entendem), no idioma de `t`. Linhas que não se aplicam não aparecem. */
export function textoDoContexto(c: ContextoGravacao, t: Tradutor, idioma: string, notacao: Notacao = "auto"): string {
  const linhas: string[] = [`*${t("ctx.titulo")}*`];
  for (const l of linhasDoContexto(c, t, idioma, { paraMarkdown: true, notacao })) linhas.push(`- ${l.texto}${l.nota ? ` _(${l.nota})_` : ""}`);
  if (c.mudouDurante) linhas.push(`_${t("ctx.mudou")}_`);
  return linhas.join("\n");
}

function resumoDoHino(h: ContextoHino, t: Tradutor): string {
  const partes = [t("gravador.resumo_hino", { numero: h.numero }), `${h.andamento} bpm`];
  if (h.transposicao !== 0) {
    const { n, unidade } = descreverTransposicao(h.transposicao, t);
    partes.push(`${n} ${unidade}`);
  }
  return partes.join(" · ");
}

/** O resumo de uma linha para o card da gravação: "hino 10 · 60 bpm · +1 semitom" ou "metrônomo, 65 bpm". Os detalhes ficam nas linhas. */
export function resumoDoContexto(c: ContextoGravacao, t: Tradutor): string {
  if (c.origem === "hino" && c.hino) return resumoDoHino(c.hino, t);
  if (c.metronomo) return t("gravador.resumo_metronomo", { bpm: c.metronomo.bpm });
  return "";
}
