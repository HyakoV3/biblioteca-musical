// A parte pura da reprodução global (sem estado): tipos, limites, o plano de um hino (que vozes tocar, onde cada parte começa) e a leitura da posição.
// Separado de `reproducao.svelte.ts`, que guarda o estado reativo e fala com o sintetizador.
import type { Hino } from "./biblioteca.svelte";
import type { InstrumentoId } from "./instrumentos";
import { totalDeEstrofes } from "./letra";
import { PAUSA_ENTRE_PARTES_S, ehFinal, montarTudo, parteNaBatida, partesDoTudo, temFinal, temIntroducao, totalDeVezes, vozesDaIntroducao, vozesDaVez, type ParteDoTudo } from "./vezes";
import { tituloDoHino } from "./titulo";
import type { Voz } from "./sintetizador";

export type Estado = "parado" | "tocando" | "pausado";

/** Ajustes de um hino. Instrumento, volume e silenciar de cada voz vêm das preferências salvas. */
export type Config = {
  andamento: number;
  transposicao: number;
  instrumentos: InstrumentoId[];
  volumes: number[];
  mudas: boolean[];
};

/** O que tocar: o hino todo (introdução, 1ª vez, 2ª, ... final, com pausas), só a introdução, ou uma vez (1 = primeira). */
export type Parte = "tudo" | "intro" | number;

/** Quantas vezes o hino tem (1 se não tem final; senão uma por estrofe, a última é o final). */
export function vezesDoHino(hino: Hino): number {
  return totalDeVezes(hino, totalDeEstrofes(hino.letra));
}

export const ANDAMENTO_MIN = 40;
export const ANDAMENTO_MAX = 160;
export const TRANSPOSICAO_MAX = 6;

/**
 * O que está tocando. `parte` é o que foi pedido; em "tudo", `marcos` diz onde cada parte começa e termina (em
 * batidas, com as pausas) e `andamento` converte o tempo decorrido em batidas. `comFinal` diz se a última vez
 * é o final; `final` diz se a parte tocada sozinha é o final.
 */
export type Tocando = {
  numero: number;
  titulo: string;
  parte: Parte;
  total: number;
  comFinal: boolean;
  final: boolean;
  andamento: number;
  marcos: Pick<ParteDoTudo, "parte" | "inicio" | "fim">[];
};

/**
 * O que o som que está agendado usa: as vozes montadas (em batidas) e os ajustes do momento em que ele foi agendado.
 * Com a música pausada, se os ajustes mudarem, "continuar" reagenda a partir da posição atual (ver `continuar`).
 */
export type Agendado = { vozes: Voz[]; andamento: number; transposicao: number; instrumentos: string[] };

export const mudou = (c: Config, a: Agendado) =>
  c.andamento !== a.andamento || c.transposicao !== a.transposicao || c.instrumentos.length !== a.instrumentos.length || c.instrumentos.some((id, i) => id !== a.instrumentos[i]);

export const efetivo = (c: Config, i: number) => (c.mudas[i] ? 0 : c.volumes[i]);

/** Os ajustes iniciais de um hino, a partir das preferências salvas de cada voz (`salvas`, na ordem das vozes). */
export function configInicial(hino: Hino, salvas: { instrumento: InstrumentoId; volume: number; muda: boolean }[]): Config {
  return {
    andamento: hino.andamento ?? 90,
    transposicao: 0,
    instrumentos: salvas.map((p) => p.instrumento),
    volumes: salvas.map((p) => p.volume),
    mudas: salvas.map((p) => p.muda),
  };
}

/** O que vai tocar: as vozes montadas, as partes (com marcos) e o total de vezes. */
export type Plano = { total: number; partes: ReturnType<typeof partesDoTudo>; vozes: Voz[] };

/**
 * "tudo" = o hino como é cantado, com uma pausa entre as partes (em segundos, então vale em batidas conforme o
 * andamento escolhido); "intro" = só a introdução; um número = só aquela vez, direto.
 */
export function planejar(hino: Hino, parte: Parte, andamento: number): Plano {
  const total = vezesDoHino(hino);
  const pausa = (PAUSA_ENTRE_PARTES_S * andamento) / 60;
  const partes = partesDoTudo(hino, total, pausa);
  const vozes = parte === "tudo" ? montarTudo(hino, total, pausa) : parte === "intro" && temIntroducao(hino) ? vozesDaIntroducao(hino) : vozesDaVez(hino, typeof parte === "number" ? parte : 1, total);
  return { total, partes, vozes };
}

/** O que mostrar do hino que acabou de começar a tocar; o título vai no idioma de agora (miniplayer, notificação, contexto da gravação). */
export function descreverTocando(o: { hino: Hino; parte: Parte; c: Config; plano: Plano }, idioma: Parameters<typeof tituloDoHino>[1]): Tocando {
  const { hino, parte, c, plano } = o;
  return {
    numero: hino.numero,
    titulo: tituloDoHino(hino, idioma),
    parte,
    total: plano.total,
    comFinal: temFinal(hino),
    final: typeof parte === "number" && ehFinal(hino, parte, plano.total),
    andamento: c.andamento,
    marcos: plano.partes.map(({ parte: p, inicio, fim }) => ({ parte: p, inicio, fim })),
  };
}

/**
 * Onde a música está agora: a parte, a batida dentro dela, a duração dela (em batidas, 0 se desconhecida) e se essa
 * parte é o final do hino. `batida / duracao` é o quanto da parte já passou (o botão da parte enche com isso).
 */
export type Ponto = { parte: "intro" | number; batida: number; duracao: number; final: boolean };

/** A posição, dado o que toca e o tempo que se ouve (em segundos). Nulo se `numero` não é o hino que toca ou pausa. */
export function pontoDoHino(atual: Tocando | null, estado: Estado, numero: number, audivel: () => number): Ponto | null {
  if (!atual || atual.numero !== numero || estado === "parado") return null;
  const batida = (audivel() * atual.andamento) / 60;
  const parte = atual.parte === "tudo" ? parteNaBatida(atual.marcos, batida) : atual.parte;
  if (parte === null) return null;
  // Em "tudo" a parte começa onde o marco diz; tocada sozinha, começa em 0. A duração vem do marco nos dois casos.
  const marco = atual.marcos.find((m) => m.parte === parte);
  const inicio = atual.parte === "tudo" ? (marco?.inicio ?? 0) : 0;
  const duracao = marco ? Math.max(0, marco.fim - marco.inicio) : 0;
  const final = parte !== "intro" && atual.comFinal && parte === atual.total;
  return { parte, batida: Math.max(0, batida - inicio), duracao, final };
}

/** Qual parte está tocando ("intro" ou o número da vez). Em "tudo" acompanha a música; na pausa entre duas partes vale a que acabou de terminar. Nulo se nada toca ou pausa. */
export function parteTocandoDe(atual: Tocando | null, estado: Estado, decorrido: number): "intro" | number | null {
  if (!atual || estado === "parado") return null;
  if (atual.parte !== "tudo") return atual.parte;
  return parteNaBatida(atual.marcos, (decorrido * atual.andamento) / 60);
}
