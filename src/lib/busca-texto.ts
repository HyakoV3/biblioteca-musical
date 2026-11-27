// Pontuação e destaque dos acertos de TEXTO (título, autoria, letra) da busca de hinos. Puro.

import { CURTO, type Destaque, type Entrada, type ItemBusca, type Resultado } from "./busca-tipos";
import { normalizarComMapa } from "./busca-normalizar";
import type { Tom } from "./busca-tom";


const PONTOS_TITULO_INICIO = 100;
const PONTOS_TITULO_PALAVRA = 80;
const PONTOS_AUTORIA = 60;
const PONTOS_LETRA = 30;
const BONUS_MESMA_LINHA = 15;
const BONUS_TITULO_COMECA = 50;
const BONUS_TITULO_IGUAL = 100;

const comecaPalavra = (palavras: readonly string[], termo: string): boolean => palavras.some((p) => p.startsWith(termo));

/** Se o termo vale na letra: de 3 letras para cima, por início de palavra; de 1 a 2, só como palavra inteira. */
const casaNaLetra = (palavras: readonly string[], termo: string): boolean => (termo.length > CURTO ? comecaPalavra(palavras, termo) : palavras.includes(termo));

/** Onde o termo aparece no texto original: o trecho que casou (a partir do início de uma palavra) e o contexto de cada lado. */
function destacar(textoOriginal: string, termos: readonly string[], inteira: (t: string) => boolean): { antes: string; achado: string; depois: string } | null {
  const { n, mapa } = normalizarComMapa(textoOriginal);
  for (const m of n.matchAll(/[a-z0-9]+/g)) {
    const palavra = m[0];
    const termo = termos.find((t) => (inteira(t) ? palavra === t : palavra.startsWith(t)));
    if (!termo) continue;
    const ini = mapa[m.index]!;
    let fim = mapa[m.index + termo.length - 1]! + 1;
    // texto em NFD: a marca de acento que vem logo depois da letra pertence ao trecho que casou (o normalizador a descarta e ela não tem posição própria)
    while (fim < textoOriginal.length && /[\u0300-\u036f]/.test(textoOriginal[fim]!)) fim++;
    const CONTEXTO = 28;
    // O corte é em unidades UTF-16: se cair no meio de um par substituto (um emoji), recua ou avança uma unidade para não deixar metade dele.
    const meioDePar = (k: number) => /[\uDC00-\uDFFF]/.test(textoOriginal[k] ?? "");
    let a = Math.max(0, ini - CONTEXTO);
    if (a > 0 && meioDePar(a)) a--;
    let d = Math.min(textoOriginal.length, fim + CONTEXTO);
    if (d < textoOriginal.length && meioDePar(d)) d++;
    return {
      antes: (a > 0 ? "…" : "") + textoOriginal.slice(a, ini),
      achado: textoOriginal.slice(ini, fim),
      depois: textoOriginal.slice(fim, d) + (d < textoOriginal.length ? "…" : ""),
    };
  }
  return null;
}

function pontuar<T extends ItemBusca>(e: Entrada<T>, termos: readonly string[], consultaN: string): { r: Resultado<T>; pontos: number } | null {
  let melhor: { r: Resultado<T>; pontos: number } | null = null;
  for (const titulo of e.titulos) {
    const atual = pontuarComTitulo(e, titulo, termos, consultaN);
    if (atual && (!melhor || atual.pontos > melhor.pontos)) melhor = atual;
  }
  return melhor;
}

function pontuarComTitulo<T extends ItemBusca>(e: Entrada<T>, titulo: { inteiro: string; palavras: string[] }, termos: readonly string[], consultaN: string): { r: Resultado<T>; pontos: number } | null {
  let pontos = 0;
  let usouLetra = false;
  let usouAutoria = false;
  /** Só os termos que casaram na autoria e na letra: o destaque e a escolha do verso usam estes, e não os que já foram satisfeitos pelo título. */
  const naAutoria: string[] = [];
  const naLetra: string[] = [];
  const soCurtos = termos.length === 1 && termos[0]!.length <= CURTO; // um termo curto sozinho não consulta a letra: só título e autoria
  for (const t of termos) {
    let melhor = 0;
    if (titulo.palavras[0]?.startsWith(t)) melhor = PONTOS_TITULO_INICIO;
    else if (comecaPalavra(titulo.palavras, t)) melhor = PONTOS_TITULO_PALAVRA;
    if (melhor < PONTOS_AUTORIA && comecaPalavra(e.autoriaPalavras, t)) {
      melhor = PONTOS_AUTORIA;
      usouAutoria = true;
      naAutoria.push(t);
    }
    if (melhor === 0 && !soCurtos && e.linhas.some((l) => casaNaLetra(l, t))) {
      melhor = PONTOS_LETRA;
      usouLetra = true;
      naLetra.push(t);
    }
    if (melhor === 0) return null; // todos os termos precisam casar
    pontos += melhor;
  }
  if (naLetra.length > 1 && e.linhas.some((l) => naLetra.every((t) => casaNaLetra(l, t)))) pontos += BONUS_MESMA_LINHA;
  if (consultaN && titulo.inteiro === consultaN) pontos += BONUS_TITULO_IGUAL;
  else if (consultaN && titulo.inteiro.startsWith(consultaN)) pontos += BONUS_TITULO_COMECA;

  let destaque: Destaque | null = null;
  if (usouLetra) {
    // a linha da letra que mais termos reúne (a que reúne todos, se houver)
    let melhorLinha = -1;
    let melhorQtd = 0;
    e.linhas.forEach((l, i) => {
      const qtd = naLetra.filter((t) => casaNaLetra(l, t)).length;
      if (qtd > melhorQtd) {
        melhorQtd = qtd;
        melhorLinha = i;
      }
    });
    const d = melhorLinha >= 0 ? destacar(e.item.letra[melhorLinha]!, naLetra, (t) => t.length <= CURTO) : null;
    if (d) destaque = { onde: "letra", ...d };
  } else if (usouAutoria && e.item.autoria) {
    const d = destacar(e.item.autoria, naAutoria, () => false);
    if (d) destaque = { onde: "autoria", ...d };
  }
  return { r: { item: e.item, destaque }, pontos };
}

/** Os acertos de texto de `termos` entre as `candidatas`, do mais para o menos relevante; sem termos, todas as candidatas na ordem do acervo. */
export function rodarTexto<T extends ItemBusca>(candidatas: readonly Entrada<T>[], termos: readonly string[]): Resultado<T>[] {
  if (termos.length === 0) return candidatas.map((e) => ({ item: e.item, destaque: null }));
  const consultaN = termos.join(" ");
  const achados: { r: Resultado<T>; pontos: number }[] = [];
  for (const e of candidatas) {
    const a = pontuar(e, termos, consultaN);
    if (a) achados.push(a);
  }
  achados.sort((a, b) => b.pontos - a.pontos || a.r.item.numero - b.r.item.numero);
  return achados.map((a) => a.r);
}

export const dosTom = <T extends ItemBusca>(entradas: readonly Entrada<T>[], tom: Tom): Entrada<T>[] =>
  entradas.filter((e) => e.tom !== null && e.tom.classe === tom.classe && (tom.modo === null || e.tom.modo === null || e.tom.modo === tom.modo));
