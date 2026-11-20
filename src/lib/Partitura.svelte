<script lang="ts">
  import "./partitura.css";
  import { untrack } from "svelte";
  import Aviso from "./Aviso.svelte";
  import { biblioteca, type Compassos } from "./biblioteca.svelte";
  import { compassoDoPonto } from "./compassos";
  import { indexarNotas, mesmasNotas, notasDoPonto, temNotas, type NotaDoDesenho } from "./notas";
  import { reproducao } from "./reproducao.svelte";
  import Estado from "./Estado.svelte";
  import { traduzirErro } from "./erros";
  import { i18n } from "./i18n/index.svelte";
  import { CONSULTA_PAISAGEM, ESCALAS_PARTITURA, ZOOM_PADRAO, escalaDoZoom, limitarZoom, varianteDaTela, type EstadoPartitura, type Variante } from "./partitura";
  import { lerZoomPartitura, salvarZoomPartitura } from "./preferencias";
  import ControleDeTamanho from "./ControleDeTamanho.svelte";

  // O painel da aba Partitura (I-08). Com a partitura do hino instalada, mostra o SVG que o Rust entrega (já conferido na
  // importação e de novo na leitura) embutido na página, para seguir o tema; sem nenhuma partitura instalada, avisa e leva a Ajustes.
  // `compassos` e `karaoke` (I-12, fase B): com o karaokê ligado e o hino tocando, o compasso que toca fica destacado e a partitura rola até ele.
  let { numero, estado, ativa, compassos = null, karaoke = false }: { numero: number; estado: EstadoPartitura; ativa: boolean; compassos?: Compassos | null; karaoke?: boolean } = $props();

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  // --- Zoom: lembrado no aparelho e igual em todos os hinos. ---
  let passo = $state(lerZoomPartitura());
  const escala = $derived(escalaDoZoom(passo));
  function mudarZoom(acao: "menos" | "padrao" | "mais") {
    passo = acao === "padrao" ? ZOOM_PADRAO : limitarZoom(passo + (acao === "mais" ? 1 : -1));
    salvarZoomPartitura(passo);
  }

  // --- Versão: o SVG é pré-desenhado (quebras de linha fixas), então há uma versão para a tela estreita (retrato) e outra para a larga
  // (paisagem). Segue a janela: ao virar o celular a outra versão entra. ---
  let larga = $state(false);
  $effect(() => {
    const consulta = matchMedia(CONSULTA_PAISAGEM);
    larga = consulta.matches;
    const mudou = (e: MediaQueryListEvent) => (larga = e.matches);
    consulta.addEventListener("change", mudou);
    return () => consulta.removeEventListener("change", mudou);
  });
  const variante = $derived<Variante>(varianteDaTela(larga));

  // --- Carga: sozinha só na primeira vez que cada versão é preciso (o SVG tem até algumas centenas de KB); a que já foi lida fica guardada,
  // então virar o celular de volta não lê de novo. Se falhar, o aviso de erro traz o botão "Tentar de novo" (não repete sozinha ao
  // trocar de aba: isso esconderia o erro). ---
  type Carga = { svg: string } | { erro: string };
  let cargas = $state<Record<Variante, Carga | null>>({ retrato: null, paisagem: null });
  const pediu: Record<Variante, boolean> = { retrato: false, paisagem: false };
  const lendo: Record<Variante, boolean> = { retrato: false, paisagem: false }; // uma leitura de cada vez por versão
  const carga = $derived(cargas[variante]);
  async function carregar(v: Variante) {
    if (lendo[v]) return;
    lendo[v] = true;
    cargas[v] = null; // volta ao "Carregando..."
    try {
      cargas[v] = { svg: await biblioteca.lerPartitura(numero, v === "paisagem") };
    } catch (e) {
      cargas[v] = { erro: traduzirErro(String(e), t) };
    } finally {
      lendo[v] = false;
    }
  }
  $effect(() => {
    const v = variante;
    if (estado !== "tem" || !ativa || pediu[v]) return;
    pediu[v] = true;
    void carregar(v);
  });

  // --- Karaokê: destaca o compasso que toca. O destaque é um retângulo desenhado ATRÁS do compasso (primeiro filho do `g.measure`, que é o
  // N-ésimo do SVG: a ordem escrita, a mesma dos índices que o conversor emite), então vale em qualquer tema: as notas ficam por cima. ---
  let folha = $state<HTMLDivElement>();
  let compassoAceso = -1; // o índice destacado agora (não reativo: só o DOM muda)
  let retangulo: SVGRectElement | null = null;
  let barra: SVGLineElement | null = null; // a linha dourada à esquerda do compasso que toca (como a barra da estrofe da vez na letra)
  // I-26, por nota: cada nota e pausa do SVG traz o instante em que soa dentro do compasso (`data-t` e `data-f`, ver `notas.ts`). As
  // soando agora ganham um halo dourado ATRÁS (a nota fica na cor do tema), e o retângulo do compasso vira só um fundo mais fraco.
  let indiceNotas: NotaDoDesenho<Element>[][] | null = null; // lido do SVG na primeira vez que se precisa
  let notasAcesas: NotaDoDesenho<Element>[] = [];
  let aureolas: SVGEllipseElement[] = [];
  let porNota = false; // o SVG traz o tempo das notas (uma partitura de um pacote antigo não traz: fica só o compasso)

  function limparNotas() {
    for (const a of aureolas) a.remove();
    aureolas = [];
    notasAcesas = [];
  }

  function limparDestaque() {
    retangulo?.remove();
    retangulo = null;
    barra?.remove();
    barra = null;
    compassoAceso = -1;
    limparNotas();
  }

  /** Põe o halo nas notas que soam agora e tira o das que pararam. Só mexe no desenho quando o conjunto muda. */
  function destacarNotas(novas: NotaDoDesenho<Element>[]) {
    if (mesmasNotas(novas, notasAcesas)) return;
    limparNotas();
    notasAcesas = novas;
    for (const { el } of novas) {
      // A cabeça da nota (ou a pausa inteira): a haste e a bandeirola ficam de fora do tamanho do halo.
      const base = (el.querySelector("g.notehead") ?? el) as SVGGraphicsElement;
      let caixa: DOMRect;
      try {
        caixa = base.getBBox();
      } catch {
        continue; // sem layout (painel escondido): não destaca
      }
      if (caixa.width === 0 || caixa.height === 0) continue;
      const a = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
      a.setAttribute("class", "destaque-nota");
      a.setAttribute("cx", String(caixa.x + caixa.width / 2));
      a.setAttribute("cy", String(caixa.y + caixa.height / 2));
      a.setAttribute("rx", String(caixa.width * 0.9));
      a.setAttribute("ry", String(Math.max(caixa.height, caixa.width) * 0.75));
      el.insertBefore(a, el.firstChild); // primeiro filho: desenhado antes (atrás) da cabeça, da haste e do acidente
      aureolas.push(a);
    }
  }

  /** Só rola se o compasso saiu da vista (entre a barra de cima e as de baixo, e dentro da região da partitura); a rolagem é suave só se a pessoa não pediu menos movimento. */
  function garantirVisivel(el: Element) {
    const r = el.getBoundingClientRect();
    const topo = (document.querySelector("header")?.getBoundingClientRect().bottom ?? 0) + 8;
    const css = getComputedStyle(document.documentElement);
    const reservado = (parseFloat(css.getPropertyValue("--altura-miniplayer")) || 0) + (parseFloat(css.getPropertyValue("--altura-navegacao")) || 0);
    const regiao = folha?.parentElement?.getBoundingClientRect();
    const foraVertical = r.top < topo || r.bottom > window.innerHeight - reservado - 8;
    const foraHorizontal = !!regiao && (r.left < regiao.left || r.right > regiao.right);
    if (foraVertical || foraHorizontal) el.scrollIntoView({ block: "center", inline: "center" });
  }

  function destacar(indice: number | null) {
    const alvo = indice ?? -1;
    if (alvo === compassoAceso) return;
    retangulo?.remove();
    retangulo = null;
    barra?.remove();
    barra = null;
    compassoAceso = alvo;
    if (indice === null || !folha) return;
    const medida = folha.querySelectorAll<SVGGElement>("svg g.measure")[indice];
    if (!medida) return; // índice fora do desenho: sem destaque, sem quebrar
    let caixa: DOMRect;
    try {
      caixa = medida.getBBox();
    } catch {
      return; // sem layout (painel escondido): não destaca
    }
    if (caixa.width === 0 || caixa.height === 0) return;
    const folga = Math.min(caixa.width, caixa.height) * 0.04;
    // O fundo (retângulo) só existe quando a partitura NÃO traz o tempo das notas (pacote antigo): lá ele é o único destaque. Com o tempo das notas,
    // o compasso é mostrado só pela barra dourada à esquerda, e o halo da nota fica sozinho (o fundo o apagava).
    let ancora: Element | null = null;
    if (!porNota) {
      const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      r.setAttribute("class", "destaque-compasso");
      r.setAttribute("x", String(caixa.x - folga));
      r.setAttribute("y", String(caixa.y - folga));
      r.setAttribute("width", String(caixa.width + 2 * folga));
      r.setAttribute("height", String(caixa.height + 2 * folga));
      r.setAttribute("rx", String(folga * 2));
      medida.insertBefore(r, medida.firstChild);
      retangulo = r;
      ancora = r;
    }
    // A barra dourada na esquerda: mostra QUAL compasso é sem encher o fundo (o fundo apagava o halo da nota).
    const b = document.createElementNS("http://www.w3.org/2000/svg", "line");
    b.setAttribute("class", "barra-compasso");
    b.setAttribute("x1", String(caixa.x - folga));
    b.setAttribute("x2", String(caixa.x - folga));
    b.setAttribute("y1", String(caixa.y - folga));
    b.setAttribute("y2", String(caixa.y + caixa.height + folga));
    medida.insertBefore(b, ancora ? ancora.nextSibling : medida.firstChild); // atrás das notas: primeiro filho, ou logo depois do retângulo
    barra = b;
    garantirVisivel(medida);
  }

  // O SVG foi trocado (outra versão, ou lido de novo): o retângulo e o índice guardados eram do DOM antigo.
  $effect(() => {
    void carga;
    void folha;
    untrack(() => {
      retangulo = null;
      barra = null;
      compassoAceso = -1;
      // Os halos e as notas lidas eram do DOM antigo.
      aureolas = [];
      notasAcesas = [];
      indiceNotas = null;
      porNota = false;
    });
  });

  // Enquanto toca, lê o relógio do áudio a cada quadro (o `decorrido` do store só anda a cada 200 ms); parado ou pausado, lê uma vez a cada
  // mudança. Fora da aba, com o karaokê desligado ou sem compassos, não gasta nada e o destaque some.
  $effect(() => {
    const ligado = karaoke && ativa && !!compassos && !!folha && !!carga && "svg" in carga;
    void variante;
    const tocando = reproducao.estado === "tocando";
    void reproducao.atual;
    // Pausado, a posição só muda quando a pessoa arrasta a barra de progresso (o store anda o `decorrido`): relê então. Tocando, o laço de quadros
    // abaixo já lê o relógio do áudio, e depender do `decorrido` (que anda a cada 200 ms) só recriaria o laço à toa.
    if (!tocando) {
      void reproducao.decorrido;
      void reproducao.revisaoDoPonto; // avisa quando o som terminou de ir ao ponto escolhido (o `decorrido` muda antes)
    }
    if (!ligado) {
      untrack(limparDestaque);
      return;
    }
    const atualizar = () => {
      const ponto = reproducao.ponto(numero);
      if (!folha) return;
      // O índice das notas vem ANTES do destaque do compasso: com tempo por nota o compasso não leva o fundo.
      indiceNotas ??= indexarNotas(folha.querySelectorAll("svg g.measure"));
      const tem = temNotas(indiceNotas);
      if (tem !== porNota) {
        porNota = tem;
        limparDestaque(); // trocou o jeito de mostrar o compasso: refaz do zero
      }
      destacar(compassoDoPonto(compassos, ponto));
      destacarNotas(tem ? notasDoPonto(compassos, ponto, indiceNotas) : []);
    };
    untrack(atualizar);
    if (!tocando) return;
    let id = 0;
    const quadro = () => {
      atualizar();
      id = requestAnimationFrame(quadro);
    };
    id = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(id);
  });
</script>

{#if estado !== "tem"}
  <!-- Nenhum pacote com partituras foi importado: a aba existe para dizer isso e levar a quem importa. -->
  <div class="sem-pacote" role="status">
    <h2>{t("partitura.sem_pacote_titulo")}</h2>
    <p>{t("partitura.sem_pacote_texto")}</p>
    <a class="botao primario" href="/ajustes?abrir=partituras">{t("partitura.abrir_ajustes")}</a>
  </div>
{:else}
  <div class="barra-zoom">
    <ControleDeTamanho
      rotulos={{
        grupo: t("partitura.zoom"),
        diminuir: t("partitura.diminuir"),
        restaurar: t("partitura.restaurar", { n: Math.round(ESCALAS_PARTITURA[ZOOM_PADRAO] * 100) }),
        aumentar: t("partitura.aumentar"),
      }}
      podeDiminuir={passo > 0}
      podeAumentar={passo < ESCALAS_PARTITURA.length - 1}
      noPadrao={passo === ZOOM_PADRAO}
      aoDiminuir={() => mudarZoom("menos")}
      aoRestaurar={() => mudarZoom("padrao")}
      aoAumentar={() => mudarZoom("mais")}
    />
  </div>

  {#if carga === null}
    <Estado tipo="carregando" texto={t("partitura.carregando")} />
  {:else if "erro" in carga}
    <Aviso tipo="erro">{t("partitura.erro", { erro: carga.erro })}</Aviso>
    <button class="botao tentar" onclick={() => carregar(variante)}>{t("erro.tentar")}</button>
  {:else}
    {#if escala > 1}<p class="dica">{t("partitura.dica")}</p>{/if}
    <!-- Uma região que rola para os lados precisa receber o foco do teclado (quem não usa toque não alcançaria o resto). -->
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div class="rolagem" role="region" aria-label={t("partitura.rolagem", { numero })} tabindex="0">
      <div class="folha" role="img" aria-label={t("partitura.aria", { numero })} data-variante={variante} style:--zoom={escala} bind:this={folha}>
        <!-- O SVG vem do Rust já limpo (src-tauri/src/svg.rs: lista de permitidos, sem CSS nem script, ids com prefixo). -->
        {@html carga.svg}
      </div>
    </div>
  {/if}
{/if}

<style>
  .sem-pacote { display: flex; flex-direction: column; align-items: center; gap: 0.8rem; padding: 2rem 1rem; text-align: center; }
  .sem-pacote h2 { margin: 0; font-size: 1.15rem; }
  .sem-pacote p { margin: 0; color: var(--suave); line-height: 1.5; }

  /* Barra de zoom: o mesmo controle de tamanho da barra da letra (ControleDeTamanho), à direita. */
  .barra-zoom { display: flex; justify-content: flex-end; margin: 0 0 1rem; }
  .tentar { display: block; margin: 0 auto; }
  .dica { margin: 0 0 0.6rem; font-size: 0.9rem; color: var(--suave); }

  /* A folha é a partitura do tamanho escolhido; passando da largura da tela, rola para os lados. O que o SVG desenha fica dentro
     dela: o <svg> raiz sai do Rust com overflow hidden, e este contêiner também recorta. */
  .rolagem { overflow-x: auto; overflow-y: hidden; background: var(--superficie); border: 0.0625rem solid var(--borda); border-radius: 0.75rem; }
  /* Abaixo de 100% a folha fica mais estreita que a região e centralizada; acima, passa da região (as margens automáticas valem 0 e a região rola). */
  .folha { width: calc(100% * var(--zoom, 1)); margin-inline: auto; color: var(--texto); }

  /* O SVG embutido segue o tema: tudo é desenhado em currentColor (o `color="black"` do arquivo perde para esta regra). As regras
     abaixo são o que o <style> do Verovio fazia e o app descarta na importação (um <style> em SVG embutido valeria para a página
     inteira): negrito, itálico e traço. Escopadas à folha. Conferido: com elas o desenho é o mesmo (docs/FORMATO.md). */
  .folha :global(svg) { display: block; width: 100%; height: auto; color: var(--texto); fill: currentColor; }
  .folha :global(svg path), .folha :global(svg ellipse), .folha :global(svg polygon), .folha :global(svg polyline), .folha :global(svg rect) { stroke: currentColor; }
  .folha :global(svg g.ending), .folha :global(svg g.fing), .folha :global(svg g.reh), .folha :global(svg g.tempo) { font-weight: bold; }
  .folha :global(svg g.dir), .folha :global(svg g.dynam), .folha :global(svg g.mNum) { font-style: italic; }
  .folha :global(svg g.label) { font-weight: normal; }
  .folha :global(svg g.placeholder) { visibility: hidden; }
  /* Karaokê (I-12, fase B): o compasso que toca. Dourado do tema, translúcido e ATRÁS das notas; o contorno tem 0,125 rem na tela em qualquer zoom (em rem, como o resto: acompanha o tamanho da fonte do sistema). Usa só
     cores do tema (no alto contraste, amarelo sobre preto: o contorno carrega o destaque e o preenchimento escurece o fundo, sem apagar as notas). */
  .folha :global(svg rect.destaque-compasso) {
    fill: var(--ouro); fill-opacity: 0.3; stroke: var(--ouro-linha); stroke-width: 0.125rem; vector-effect: non-scaling-stroke; pointer-events: none;
  }
  /* Karaokê por nota (I-26): o halo atrás de cada nota e pausa que soa. A nota fica na cor do tema, por cima. Com o tempo das notas o compasso não leva fundo nem borda
     (só a barra dourada abaixo). No alto contraste (amarelo sobre preto) o preenchimento quase some e o contorno carrega o destaque, para não apagar a nota. */
  .folha :global(svg ellipse.destaque-nota) {
    fill: var(--ouro); fill-opacity: 0.55; stroke: var(--ouro-linha); stroke-width: 0.125rem; vector-effect: non-scaling-stroke; pointer-events: none;
  }
  :global(:root[data-tema="alto-contraste"]) .folha :global(svg ellipse.destaque-nota) { fill-opacity: 0.18; stroke-width: 0.1875rem; }
  /* A barra dourada à esquerda do compasso que toca (como a barra da estrofe da vez na letra): diz qual é o compasso. */
  .folha :global(svg line.barra-compasso) { stroke: var(--ouro-linha); stroke-width: 0.25rem; stroke-linecap: butt; vector-effect: non-scaling-stroke; pointer-events: none; }
</style>
