// Tipos do motor da busca de hinos (ver busca-hinos.ts).

import type { Tom } from "./busca-tom";

/** O que o motor precisa saber de um hino (o `Hino` do app serve, sem conversão). */
export type ItemBusca = {
  numero: number;
  titulo: string;
  /** O nome em outros idiomas: a busca acha o hino por qualquer um deles. */
  titulos?: { pt?: string; en?: string; es?: string } | null;
  autoria?: string | null;
  tonalidade?: string | null;
  letra: string[];
};

/** A chave de um hino quando houver mais de um acervo: o mesmo número pode existir em dois hinários. */
export const chaveDoHino = (acervo: string, numero: number): string => `${acervo}#${numero}`;

/** Um pedaço do texto, para destacar o que casou: `antes` + `achado` + `depois`. */
export type Destaque = { onde: "autoria" | "letra"; antes: string; achado: string; depois: string };

export type Resultado<T extends ItemBusca> = {
  item: T;
  /** O que casou na letra ou na autoria (o título e o número não precisam de destaque). */
  destaque: Destaque | null;
};

export type Busca<T extends ItemBusca> = {
  intencao: "vazia" | "numero" | "texto";
  resultados: Resultado<T>[];
  /** Consulta de número: o hino exato, que é o primeiro de `resultados`; nulo se o número não existe. */
  exato: T | null;
  /** Consulta de número: quantos hinos que começam pelos mesmos dígitos ficaram de fora do limite ("e mais N"). */
  maisNumeros: number;
};

export type OpcoesBusca = {
  /** Quantos hinos de prefixo de número mostrar depois do exato (padrão 6). */
  limitePrefixo?: number;
  /** Mostrar todos os de prefixo (o toque em "e mais N"). */
  expandirPrefixo?: boolean;
};


export const LIMITE_PREFIXO = 6;
/** Termos de 1 a 2 letras só valem como palavra inteira na letra. */
export const CURTO = 2;

export type Entrada<T extends ItemBusca> = {
  item: T;
  /** Cada título do hino (o original e os de `titulos`), normalizado e em palavras: a busca pontua cada um separadamente e fica com o melhor, para os termos não casarem "emprestados" entre traduções. */
  titulos: { inteiro: string; palavras: string[] }[];
  autoriaPalavras: string[];
  /** Cada linha da letra, em palavras normalizadas. */
  linhas: string[][];
  tom: Tom | null;
};

export type Indice<T extends ItemBusca> = { entradas: Entrada<T>[]; maiorNumero: number };
