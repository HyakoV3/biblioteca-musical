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

/** O que o motor precisa saber de um hino (o `Hino` do app serve, sem conversão). */
export type ItemBusca = {
  numero: number;
  titulo: string;
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
const CURTO = 2;

// ---------- normalização ----------

/** Texto sem acentos e em minúsculas, com tudo que não é letra ou algarismo virando espaço, e o índice, no original, de cada caractere do resultado. */
function normalizarComMapa(texto: string): { n: string; mapa: number[] } {
  let n = "";
  const mapa: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    const limpo = texto[i]!.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    for (const c of limpo) {
      n += /[a-z0-9]/.test(c) ? c : " ";
      mapa.push(i);
    }
  }
  return { n, mapa };
}

/** Sem acentos, em minúsculas, pontuação e hífen viram espaço; espaços repetidos viram um só. */
export function normalizar(texto: string): string {
  return normalizarComMapa(texto).n.replace(/ +/g, " ").trim();
}

const palavrasDe = (n: string): string[] => n.split(" ").filter(Boolean);

// ---------- tonalidade ----------

type Tom = { classe: number; modo: "maior" | "menor" | null };
const NOTAS: Record<string, number> = { do: 0, c: 0, re: 2, d: 2, mi: 4, e: 4, fa: 5, f: 5, sol: 7, g: 7, la: 9, a: 9, si: 11, b: 11 };
const SILABAS = new Set(["do", "re", "mi", "fa", "sol", "la", "si"]);
/** Palavras comuns do português que também são nome de nota: só viram tom quando a consulta inteira é o tom (ou vêm depois de "tom"). */
const NOTAS_COMUNS = new Set(["a", "e", "do", "la"]);
/** A nota (0 a 11) de um nome, sem achar propriedades herdadas do objeto ("constructor"). */
const notaDe = (w: string | undefined): number | undefined => (w !== undefined && Object.hasOwn(NOTAS, w) ? NOTAS[w] : undefined);
/** "sib", "mib", "solb", "bb", "eb": a nota com o bemol colado, sem símbolo. */
const BEMOL_COLADO = /^(do|re|mi|fa|sol|la|si|[a-g])b$/;

function acidenteDe(t: string): number | null {
  if (t === "bemol" || t === "flat" || t === "b") return -1; // "b" solto, depois de uma nota ("si b")
  if (t === "sustenido" || t === "sostenido" || t === "sharp") return 1;
  return null;
}
function modoDe(t: string): "maior" | "menor" | null {
  if (t === "maior" || t === "major" || t === "mayor") return "maior";
  if (t === "menor" || t === "minor") return "menor";
  return null;
}

/** ♭ e ♯ viram palavras ("mi♭" → "mi bemol"), para o texto digitado e o do hinário passarem pelo mesmo caminho. */
const comAcidentesEmPalavras = (s: string): string => s.replace(/♭/g, " bemol ").replace(/♯|#/g, " sustenido ");

const mod12 = (n: number): number => ((n % 12) + 12) % 12;

/**
 * Lê a tonalidade do TEXTO de um hino ("Mi♭ maior", "E♭ major"). Mesma classe de nota e modo servem de comparação, e não o texto: o hinário
 * escreve Ré♭, a pessoa pode digitar "dó sustenido".
 */
export function tomDoHino(tonalidade: string | null | undefined): Tom | null {
  if (!tonalidade) return null;
  const t = palavrasDe(normalizarComMapa(comAcidentesEmPalavras(tonalidade)).n);
  const modo = t.map(modoDe).find((m) => m !== null) ?? null;
  const colado = t[0] !== undefined ? BEMOL_COLADO.exec(t[0]) : null; // "Sib maior", "Eb major", "Bb major"
  if (colado) return { classe: mod12(notaDe(colado[1])! - 1), modo };
  const nota = notaDe(t[0]);
  if (nota === undefined) return null;
  const acidente = t[1] !== undefined ? (acidenteDe(t[1]) ?? 0) : 0;
  return { classe: mod12(nota + acidente), modo };
}

/**
 * Procura nos termos da consulta uma tonalidade: nota + acidente, colados ou separados ("sib", "si b", "si bemol", "mi♭"), nota + "maior/menor"
 * ("mi maior"), ou a palavra "tom" antes de uma nota ("tom si"). Uma nota SOZINHA ("la", "sol", "si", "a", "e") NÃO é tom: é texto.
 * Devolve o tom e os termos que sobram (os que a tonalidade não consumiu).
 */
function extrairTom(bruta: string): { tom: Tom | null; resto: string[]; todos: string[]; ambiguo: boolean } {
  const termos = palavrasDe(normalizarComMapa(comAcidentesEmPalavras(bruta)).n);
  const sem = (usados: number[]) => termos.filter((_, k) => !usados.includes(k));
  for (let i = 0; i < termos.length; i++) {
    const w = termos[i]!;
    const aposTom = termos[i - 1] === "tom";
    const prefixoTom = aposTom ? [i - 1] : [];

    // "sib", "mib", "solb", "bb", "eb": a nota com o bemol colado
    const colado = BEMOL_COLADO.exec(w);
    if (colado) {
      const modo = termos[i + 1] ? modoDe(termos[i + 1]!) : null;
      // Colado e ainda sendo digitado ("reb" a caminho de "rebanho", "lab" de "labor"): pode ser tom OU o começo de uma palavra. Com "tom" antes ou um modo depois, é tom.
      const ambiguo = i === termos.length - 1 && !aposTom && !modo;
      return { tom: { classe: mod12(notaDe(colado[1])! - 1), modo }, resto: sem([...prefixoTom, i, ...(modo ? [i + 1] : [])]), todos: termos, ambiguo };
    }

    const nota = notaDe(w);
    if (nota === undefined) continue;
    const seguinte = termos[i + 1];
    const acidente = seguinte !== undefined ? acidenteDe(seguinte) : null;
    const posModo = acidente !== null ? i + 2 : i + 1;
    const modo = termos[posModo] ? modoDe(termos[posModo]!) : null;
    if (!(aposTom || acidente !== null || modo !== null)) continue; // nota sozinha: texto
    const usados = [...prefixoTom, i, ...(acidente !== null ? [i + 1] : []), ...(modo !== null ? [posModo] : [])];
    // "Deus é maior", "a maior glória", "do maior amor": "é", "a", "do" e "lá" são palavras comuns; só valem como tom se a consulta inteira é o tom ou se vêm depois de "tom".
    if (NOTAS_COMUNS.has(w) && !aposTom && usados.length < termos.length) continue;
    return { tom: { classe: mod12(nota + (acidente ?? 0)), modo }, resto: sem(usados), todos: termos, ambiguo: false };
  }
  return { tom: null, resto: termos, todos: termos, ambiguo: false };
}

// ---------- índice ----------

type Entrada<T extends ItemBusca> = {
  item: T;
  tituloPalavras: string[];
  /** O título normalizado inteiro (para "começa com a consulta"). */
  tituloN: string;
  autoriaPalavras: string[];
  /** Cada linha da letra, em palavras normalizadas. */
  linhas: string[][];
  tom: Tom | null;
};

export type Indice<T extends ItemBusca> = { entradas: Entrada<T>[]; maiorNumero: number };

/** Prepara o acervo uma vez (normaliza título, autoria e letra); cada busca depois só varre. */
export function indexar<T extends ItemBusca>(itens: readonly T[]): Indice<T> {
  const entradas = itens.map<Entrada<T>>((item) => {
    const tituloN = normalizar(item.titulo);
    return {
      item,
      tituloN,
      tituloPalavras: palavrasDe(tituloN),
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

// ---------- texto ----------

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
  let pontos = 0;
  let usouLetra = false;
  let usouAutoria = false;
  /** Só os termos que casaram na autoria e na letra: o destaque e a escolha do verso usam estes, e não os que já foram satisfeitos pelo título. */
  const naAutoria: string[] = [];
  const naLetra: string[] = [];
  const soCurtos = termos.length === 1 && termos[0]!.length <= CURTO; // um termo curto sozinho não consulta a letra: só título e autoria
  for (const t of termos) {
    let melhor = 0;
    if (e.tituloPalavras[0]?.startsWith(t)) melhor = PONTOS_TITULO_INICIO;
    else if (comecaPalavra(e.tituloPalavras, t)) melhor = PONTOS_TITULO_PALAVRA;
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
  if (consultaN && e.tituloN === consultaN) pontos += BONUS_TITULO_IGUAL;
  else if (consultaN && e.tituloN.startsWith(consultaN)) pontos += BONUS_TITULO_COMECA;

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
function rodarTexto<T extends ItemBusca>(candidatas: readonly Entrada<T>[], termos: readonly string[]): Resultado<T>[] {
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

const dosTom = <T extends ItemBusca>(entradas: readonly Entrada<T>[], tom: Tom): Entrada<T>[] =>
  entradas.filter((e) => e.tom !== null && e.tom.classe === tom.classe && (tom.modo === null || e.tom.modo === null || e.tom.modo === tom.modo));

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
