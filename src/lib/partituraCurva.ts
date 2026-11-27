// A luz da ligadura sobre o SVG da partitura (I-26): a faixa atrás da curva, o traço dourado por cima e o ponto que anda, recortados da esquerda para a
// direita conforme a primeira nota soa. Só mexe no DOM que recebe; quem guarda o que está aceso é o `Partitura.svelte`.
import { alturaEm, progressoDaCurva, type NotaDoDesenho } from "./notas";
import { elemento, medirCaixa } from "./partituraDestaque";

type Ponto = { x: number; y: number };
type Bordas = [Ponto[], Ponto[]];
let contadorDeRecortes = 0;

// A ligadura: a curva ganha uma cópia dourada, recortada da esquerda para a direita conforme a primeira nota soa (a luz corre do halo dela até
// a segunda nota, que acende quando a curva termina).
export type CurvaAcesa = {
  n: NotaDoDesenho<Element>;
  recorte: SVGRectElement;
  clip: SVGClipPathElement;
  faixa: SVGPathElement; // a faixa larga e translúcida ATRÁS da curva (o halo da ligadura)
  copia: SVGPathElement; // o traço dourado fino POR CIMA da curva
  ponto: SVGCircleElement; // o ponto brilhante na ponta que avança
  largura: number; // largura total do recorte (com a folga), em unidades do desenho
  meio: Ponto[]; // o meio da curva, de ponta a ponta, por onde o ponto anda
  original: SVGPathElement; // a curva do Verovio (para medir a escala da tela)
  caixa: DOMRect;
  escala: number; // pixels da tela por unidade do desenho, quando a folga e o ponto foram medidos (muda com o zoom e com a janela)
};

/** A escala que a tela aplica ao desenho agora (pixels por unidade do desenho). */
function escalaDaTela(original: SVGPathElement): number {
  return Math.abs(original.getScreenCTM()?.a ?? 1) || 1;
}

/**
 * A faixa tem 0,6 rem na tela em qualquer zoom (traço sem escala), então a folga do recorte e o raio do ponto, que estão em unidades do desenho, dependem da escala
 * que a tela aplica ao desenho agora. Mede de novo (e refaz o recorte e o ponto) sempre que essa escala muda.
 */
function ajustarEscala(c: CurvaAcesa) {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const escala = escalaDaTela(c.original);
  const folga = (rem * 0.3 + 2) / escala;
  c.escala = escala;
  c.largura = c.caixa.width + folga * 2;
  c.recorte.setAttribute("x", String(c.caixa.x - folga));
  c.recorte.setAttribute("y", String(c.caixa.y - folga * 2));
  c.recorte.setAttribute("height", String(c.caixa.height + folga * 4));
  c.ponto.setAttribute("r", String((rem * 0.35) / escala));
}

/** O comprimento da 1ª curva de Bézier do traçado (a borda de ida da ligadura), ou nulo se o traçado não tem duas curvas. Mede um traçado de teste só com ela. */
function comprimentoDaIda(original: SVGPathElement): number | null {
  const d = original.getAttribute("d") ?? "";
  const primeira = d.indexOf("C");
  const segunda = primeira < 0 ? -1 : d.indexOf("C", primeira + 1);
  if (segunda < 0) return null;
  const teste = elemento("path", { d: d.slice(0, segunda) });
  original.parentNode?.appendChild(teste); // medir exige o traçado no documento
  try {
    const c = teste.getTotalLength();
    return Number.isFinite(c) && c > 0 ? c : null;
  } catch {
    return null;
  } finally {
    teste.remove();
  }
}

/** As duas bordas da curva (a lua tem uma de ida e outra de volta), cada uma ordenada por x. A ligadura de expressão (inclinada) tem as bordas de comprimentos diferentes,
 *  e a metade do comprimento total misturaria as duas: o corte é o fim da 1ª das duas curvas de Bézier do desenho (sem as duas no traçado, vale a metade). */
function bordasDaCurva(original: SVGPathElement): Bordas {
  const total = original.getTotalLength();
  const corte = comprimentoDaIda(original) ?? total / 2;
  const ida: Ponto[] = [];
  const volta: Ponto[] = [];
  for (let i = 0; i <= 40; i++) {
    const dist = (total * i) / 40;
    const q = original.getPointAtLength(dist);
    (dist <= corte ? ida : volta).push({ x: q.x, y: q.y });
  }
  const crescente = (l: Ponto[]) => [...l].sort((a, b) => a.x - b.x);
  return [crescente(ida), crescente(volta)];
}

/** A altura média das duas bordas em 25 pontos, de ponta a ponta da caixa. */
function mediaDasBordas(bordas: Bordas, caixa: DOMRect): Ponto[] {
  const [a, b] = bordas;
  const meio: Ponto[] = [];
  for (let i = 0; i <= 24; i++) {
    const x = caixa.x + (caixa.width * i) / 24;
    meio.push({ x, y: (alturaEm(a, x) + alturaEm(b, x)) / 2 });
  }
  return meio;
}

/** O meio da curva, de ponta a ponta: a média das duas bordas. Se o navegador não mede o traçado, o centro da caixa. */
function meioDaCurva(original: SVGPathElement, caixa: DOMRect): Ponto[] {
  try {
    return mediaDasBordas(bordasDaCurva(original), caixa);
  } catch (e) {
    console.warn("Partitura: não foi possível calcular o meio da ligadura; usando o centro da caixa", e);
    return [{ x: caixa.x, y: caixa.y + caixa.height / 2 }, { x: caixa.x + caixa.width, y: caixa.y + caixa.height / 2 }];
  }
}

/** Desenha a luz da ligadura `n` (a faixa atrás da curva; o traço fino e o ponto por cima), ou nulo se a curva não tem layout. */
export function criarCurva(n: NotaDoDesenho<Element>): CurvaAcesa | null {
  const original = n.el.querySelector("path") as SVGPathElement | null;
  const caixa = original ? medirCaixa(original) : null;
  if (!original || !caixa || caixa.width === 0) return null;
  const d = original.getAttribute("d") ?? "";
  const id = `recorte-ligadura-${++contadorDeRecortes}`;
  const recorte = elemento("rect", { width: "0" }); // o x, o y e a altura vêm de `ajustarEscala`
  const clip = elemento("clipPath", { id });
  clip.appendChild(recorte);
  const recortada = `url(#${id})`;
  const faixa = elemento("path", { class: "faixa-ligadura", d, "clip-path": recortada });
  const copia = elemento("path", { class: "destaque-ligadura", d, "clip-path": recortada });
  const ponto = elemento("circle", { class: "ponto-ligadura", cx: String(caixa.x), cy: String(caixa.y + caixa.height / 2) });
  const meio = meioDaCurva(original, caixa);
  // A faixa vai ATRÁS da curva (antes dela); o traço fino e o ponto, por cima.
  original.before(faixa);
  n.el.append(clip, copia, ponto);
  const nova: CurvaAcesa = { n, recorte, clip, faixa, copia, ponto, largura: caixa.width, meio, original, caixa, escala: 0 };
  ajustarEscala(nova);
  return nova;
}

/** Tira do desenho a luz da ligadura. */
export function removerCurva(c: CurvaAcesa) {
  c.faixa.remove();
  c.copia.remove();
  c.ponto.remove();
  c.clip.remove();
}

/** Anda a luz da ligadura até o ponto `local` (em batidas dentro do compasso); com pouco movimento, a curva aparece inteira de uma vez. */
export function andarCurva(c: CurvaAcesa, local: number, reduzirMovimento: boolean) {
  // O zoom ou a janela mudaram a escala do desenho: refaz a folga do recorte e o raio do ponto.
  if (Math.abs(escalaDaTela(c.original) - c.escala) / c.escala > 0.01) ajustarEscala(c);
  const p = reduzirMovimento ? 1 : progressoDaCurva(c.n, local);
  c.recorte.setAttribute("width", String(c.largura * p));
  // O ponto brilhante vai na ponta do avanço, pelo meio da curva (do começo ao fim dela, sem a folga).
  const xPonto = c.meio[0].x + (c.meio[c.meio.length - 1].x - c.meio[0].x) * p;
  c.ponto.setAttribute("cx", String(xPonto));
  c.ponto.setAttribute("cy", String(alturaEm(c.meio, xPonto)));
}
