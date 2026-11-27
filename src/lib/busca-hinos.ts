// Motor da busca da lista de hinos (I-37). Puro: sem tela, sem armazenamento e sem Svelte, para se testar no Vitest. O rascunho, com a pesquisa e as
// decisões, é `docs/ideia-busca-inteligente.md`.
//
// A consulta tem três intenções:
//  - NÚMERO ("21", "021", "hino 21", "nº 21", "#21"): o hino exato vem PRIMEIRO e fixo; os que começam pelos mesmos dígitos vêm depois, limitados
//    ("e mais N"), e só enquanto o número digitado tem menos dígitos que o maior número do acervo.
//  - TOM ("sib", "mi bemol", "mi♭ maior", "tom si"): filtra pela tonalidade (nota e modo). Uma nota SOZINHA ("lá", "sol") é texto, não tom.
//  - TEXTO: cada termo precisa aparecer (E) no título, na autoria ou na letra, no INÍCIO de uma palavra (o último termo é o que se está digitando).
//    Na letra, termo de 1 a 2 letras só vale como palavra inteira.
// O item de busca já leva o `acervo`: a chave de um hino é acervo + número (hoje há um acervo só, mas o número deixará de ser único).

import { normalizar, palavrasDe } from "./busca-normalizar";
import { extrairTom, tomDoHino } from "./busca-tom";
import { dosTom, rodarTexto } from "./busca-texto";
import { LIMITE_PREFIXO, type Busca, type Entrada, type Indice, type ItemBusca, type OpcoesBusca } from "./busca-tipos";
import { todosOsTitulos } from "./titulo";

// A API pública do motor continua saindo daqui.
export { normalizar } from "./busca-normalizar";
export { tomDoHino } from "./busca-tom";
export { chaveDoHino, LIMITE_PREFIXO } from "./busca-tipos";
export type { Busca, Destaque, Indice, ItemBusca, OpcoesBusca, Resultado } from "./busca-tipos";

const indices = new WeakMap<readonly ItemBusca[], Indice<ItemBusca>>();

/** O índice do acervo `itens`, guardado por array: voltar à tela inicial (que recria a página) não refaz a normalização de todas as letras, só um pacote novo (outro array) a refaz. */
export function indiceDe<T extends ItemBusca>(itens: readonly T[]): Indice<T> {
  let ind = indices.get(itens);
  if (!ind) {
    ind = indexar(itens);
    indices.set(itens, ind);
  }
  return ind as Indice<T>;
}

function tituloIndexado(t: string): { inteiro: string; palavras: string[] } {
  const inteiro = normalizar(t);
  return { inteiro, palavras: palavrasDe(inteiro) };
}

/** Prepara o acervo uma vez (normaliza título, autoria e letra); cada busca depois só varre. */
export function indexar<T extends ItemBusca>(itens: readonly T[]): Indice<T> {
  const entradas = itens.map<Entrada<T>>((item) => {
    return {
      item,
      titulos: todosOsTitulos(item).map(tituloIndexado),
      autoriaPalavras: palavrasDe(normalizar(item.autoria ?? "")),
      linhas: item.letra.map((l) => palavrasDe(normalizar(l))),
      tom: tomDoHino(item.tonalidade),
    };
  });
  return { entradas, maiorNumero: itens.reduce((m, i) => Math.max(m, i.numero), 0) };
}

// ---------- número ----------

// "21", "021", "hino 21", "himno 21", "hymn 21", "nº 21", "n.º 21", "n° 21", "no 21", "num. 21", "numero 21", "#21", "hino nº 21". Não "o 21", "abc 21" nem "21 abc".
const COMO_NUMERO = /^\s*(?:(?:hino|himno|hymn)\s*)?(?:#|(?:numero|num|nr|n)[.ºo°:]{0,2})?\s*(\d+)\s*$/;

/** O número digitado ("21", "021", "hino 21", "nº 21", "#21"), ou nulo se a consulta não é só um número. */
export function numeroDaConsulta(consulta: string): number | null {
  const m = COMO_NUMERO.exec(consulta.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase());
  return m ? Number(m[1]) : null;
}

function buscarNumero<T extends ItemBusca>(ind: Indice<T>, n: number, op: OpcoesBusca): Busca<T> {
  const exato = ind.entradas.find((e) => e.item.numero === n)?.item ?? null;
  // O prefixo só ajuda enquanto faltam dígitos: com tantos dígitos quanto o maior número do acervo, o exato é o único que cabe.
  const digitos = n === 0 ? 0 : String(n).length;
  const prefixos =
    digitos > 0 && digitos < String(ind.maiorNumero).length
      ? ind.entradas.map((e) => e.item).filter((i) => i.numero !== n && String(i.numero).startsWith(String(n))).sort((a, b) => a.numero - b.numero)
      : [];
  const limite = op.expandirPrefixo ? prefixos.length : (op.limitePrefixo ?? LIMITE_PREFIXO);
  const mostrados = prefixos.slice(0, limite);
  const lista = exato ? [exato, ...mostrados] : mostrados;
  return {
    intencao: "numero",
    resultados: lista.map((item) => ({ item, destaque: null })),
    exato,
    maisNumeros: prefixos.length - mostrados.length,
  };
}


/** Busca em um acervo já indexado. Consulta vazia: todos, na ordem do acervo. */
export function buscar<T extends ItemBusca>(ind: Indice<T>, consulta: string, opcoes: OpcoesBusca = {}): Busca<T> {
  if (!normalizar(consulta)) {
    return { intencao: "vazia", resultados: ind.entradas.map((e) => ({ item: e.item, destaque: null })), exato: null, maisNumeros: 0 };
  }
  const n = numeroDaConsulta(consulta);
  if (n !== null) return buscarNumero(ind, n, opcoes);

  const { tom, resto, todos, ambiguo } = extrairTom(consulta);
  // Sem tom, os termos são os do texto como digitado: `todos` já traz "#" e "♭" trocados por "sustenido" e "bemol" (para a leitura do tom), e exigi-los quebraria "#louvor".
  if (!tom) return { intencao: "texto", resultados: rodarTexto(ind.entradas, palavrasDe(normalizar(consulta))), exato: null, maisNumeros: 0 };
  const comoTom = rodarTexto(dosTom(ind.entradas, tom), resto);
  if (!ambiguo) return { intencao: "texto", resultados: comoTom, exato: null, maisNumeros: 0 };
  // Termo colado ainda sendo digitado ("reb"): os acertos de TEXTO ("Rebanho…") primeiro, depois os hinos do tom que ainda não apareceram.
  const comoTexto = rodarTexto(ind.entradas, todos);
  const vistos = new Set(comoTexto.map((r) => r.item));
  return { intencao: "texto", resultados: [...comoTexto, ...comoTom.filter((r) => !vistos.has(r.item))], exato: null, maisNumeros: 0 };
}

