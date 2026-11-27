// O desenho do karaokê sobre o SVG da partitura (I-12, I-26): os elementos SVG que se acrescentam ao DOM (o fundo e a barra do compasso, o halo da nota) e a medida
// deles. A luz da ligadura está em `partituraCurva.ts`. Só mexe no DOM que recebe; quem guarda o que está aceso, e quando limpar, é o `Partitura.svelte`.
const NS = "http://www.w3.org/2000/svg";

export function elemento<K extends keyof SVGElementTagNameMap>(tag: K, atributos: Record<string, string>): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const [nome, valor] of Object.entries(atributos)) e.setAttribute(nome, valor);
  return e;
}

/** A caixa do elemento, ou nulo sem layout (painel escondido): quem chama não destaca. */
export function medirCaixa(el: SVGGraphicsElement): DOMRect | null {
  try {
    return el.getBBox();
  } catch {
    return null;
  }
}

/** O fundo do compasso (só quando a partitura não traz o tempo das notas). */
export function criarRetangulo(caixa: DOMRect, folga: number): SVGRectElement {
  return elemento("rect", {
    class: "destaque-compasso",
    x: String(caixa.x - folga),
    y: String(caixa.y - folga),
    width: String(caixa.width + 2 * folga),
    height: String(caixa.height + 2 * folga),
    rx: String(folga * 2),
  });
}

/** A barra dourada na esquerda: mostra QUAL compasso é sem encher o fundo (o fundo apagava o halo da nota). */
export function criarBarra(caixa: DOMRect, folga: number): SVGLineElement {
  return elemento("line", {
    class: "barra-compasso",
    x1: String(caixa.x - folga),
    x2: String(caixa.x - folga),
    y1: String(caixa.y - folga),
    y2: String(caixa.y + caixa.height + folga),
  });
}

/** O halo da nota (ou nulo se ela não tem layout): na cabeça da nota ou na pausa inteira (a haste e a bandeirola ficam de fora do tamanho), como primeiro filho (atrás). */
export function criarHalo(el: Element): SVGEllipseElement | null {
  const caixa = medirCaixa((el.querySelector("g.notehead") ?? el) as SVGGraphicsElement);
  if (!caixa || caixa.width === 0 || caixa.height === 0) return null;
  const a = elemento("ellipse", {
    class: "destaque-nota",
    cx: String(caixa.x + caixa.width / 2),
    cy: String(caixa.y + caixa.height / 2),
    rx: String(caixa.width * 0.9),
    ry: String(Math.max(caixa.height, caixa.width) * 0.75),
  });
  el.insertBefore(a, el.firstChild); // primeiro filho: desenhado antes (atrás) da cabeça, da haste e do acidente
  return a;
}

/** Só rola se o compasso saiu da vista (entre a barra de cima e as de baixo, e dentro da `regiao` da partitura); a rolagem é suave só se a pessoa não pediu menos movimento. */
export function garantirVisivel(el: Element, regiao: Element | null | undefined) {
  const r = el.getBoundingClientRect();
  const topo = (document.querySelector("header")?.getBoundingClientRect().bottom ?? 0) + 8;
  const css = getComputedStyle(document.documentElement);
  const reservado = (parseFloat(css.getPropertyValue("--altura-miniplayer")) || 0) + (parseFloat(css.getPropertyValue("--altura-navegacao")) || 0);
  const limites = regiao?.getBoundingClientRect();
  const foraVertical = r.top < topo || r.bottom > window.innerHeight - reservado - 8;
  const foraHorizontal = !!limites && (r.left < limites.left || r.right > limites.right);
  if (foraVertical || foraHorizontal) el.scrollIntoView({ block: "center", inline: "center" });
}

/** Chama `f` a cada quadro de animação; devolve a função que para o laço. */
export function aCadaQuadro(f: () => void): () => void {
  let id = 0;
  const quadro = () => {
    f();
    id = requestAnimationFrame(quadro);
  };
  id = requestAnimationFrame(quadro);
  return () => cancelAnimationFrame(id);
}
