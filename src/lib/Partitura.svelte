<script lang="ts">
  import "./partitura.css";
  import { untrack } from "svelte";
  import Aviso from "./Aviso.svelte";
  import { biblioteca, type Compassos } from "./biblioteca.svelte";
  import { compassoDoPonto } from "./compassos";
  import { acesasDoPonto, indexarNotas, mesmasNotas, temNotas, type Acesa, type NotaDoDesenho } from "./notas";
  import { reproducao } from "./reproducao.svelte";
  import Estado from "./Estado.svelte";
  import { traduzirErro } from "./erros";
  import { i18n } from "./i18n/index.svelte";
  import { CONSULTA_PAISAGEM, ESCALAS_PARTITURA, ZOOM_PADRAO, escalaDoZoom, limitarZoom, varianteDaTela, type EstadoPartitura, type Variante } from "./partitura";
  import { lerZoomPartitura, salvarZoomPartitura } from "./preferencias";
  import ControleDeTamanho from "./ControleDeTamanho.svelte";
  import { andarCurva, criarCurva, removerCurva, type CurvaAcesa } from "./partituraCurva";
  import { aCadaQuadro, criarBarra, criarHalo, criarRetangulo, garantirVisivel, medirCaixa } from "./partituraDestaque";

  // O painel da aba Partitura (I-08). Com a partitura do hino instalada, mostra o SVG que o Rust entrega (já conferido na
  // importação e de novo na leitura) embutido na página, para seguir o tema; sem nenhuma partitura instalada, avisa e leva a Ajustes.
  // `compassos` e `karaoke` (I-12, fase B): com o karaokê ligado e o hino tocando, o compasso que toca fica destacado e a partitura rola até ele.
  let { numero, estado, ativa, compassos = null, karaoke = false }: { numero: number; estado: EstadoPartitura; ativa: boolean; compassos?: Compassos | null; karaoke?: boolean } = $props();

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  /** Só o pacote de exemplo está instalado (nenhum hinário baixado). */
  const exemplo = $derived(biblioteca.pacote?.exemplo ?? false);

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
  async function lerCarga(v: Variante): Promise<Carga> {
    try {
      return { svg: await biblioteca.lerPartitura(numero, v === "paisagem") };
    } catch (e) {
      return { erro: traduzirErro(String(e), t) };
    }
  }
  async function carregar(v: Variante) {
    if (lendo[v]) return;
    lendo[v] = true;
    cargas[v] = null; // volta ao "Carregando..."
    try {
      cargas[v] = await lerCarga(v);
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
  // N-ésimo do SVG: a ordem escrita, a mesma dos índices que o conversor emite), então vale em qualquer tema: as notas ficam por cima.
  // Os elementos SVG em si são feitos em `partituraDestaque.ts`; aqui fica o que está aceso e quando limpar. ---
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
  let curvasAcesas: CurvaAcesa[] = [];
  let curvasPedidas: NotaDoDesenho<Element>[] = []; // as curvas da última chamada, mesmo as que não puderam ser desenhadas (senão uma ignorada refaria tudo a cada quadro)
  const reduzirMovimento = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function limparCurvas() {
    for (const c of curvasAcesas) removerCurva(c);
    curvasAcesas = [];
    curvasPedidas = [];
  }

  function limparNotas() {
    limparCurvas();
    limparHalos();
  }

  function limparHalos() {
    for (const a of aureolas) a.remove();
    aureolas = [];
    notasAcesas = [];
  }

  function limparMarcas() {
    retangulo?.remove();
    retangulo = null;
    barra?.remove();
    barra = null;
  }

  function limparDestaque() {
    limparMarcas();
    compassoAceso = -1;
    limparNotas();
  }

  /** Põe o halo nas notas que soam agora e tira o das que pararam; a luz da ligadura anda a cada chamada. Só recria o desenho quando o conjunto muda. */
  function destacarNotas(acesas: Acesa<Element>[]) {
    destacarCurvas(acesas.filter((a) => a.n.ligadura));
    const novas = acesas.filter((a) => !a.n.ligadura).map((a) => a.n);
    if (mesmasNotas(novas, notasAcesas)) return;
    limparHalos();
    notasAcesas = novas;
    for (const { el } of novas) {
      const halo = criarHalo(el);
      if (halo) aureolas.push(halo);
    }
  }

  function destacarCurvas(curvas: Acesa<Element>[]) {
    const mesmas = curvas.length === curvasPedidas.length && curvas.every((c, i) => c.n === curvasPedidas[i]);
    if (!mesmas) {
      limparCurvas();
      curvasPedidas = curvas.map((c) => c.n);
      for (const { n } of curvas) {
        const nova = criarCurva(n);
        if (nova) curvasAcesas.push(nova);
      }
    }
    for (const c of curvasAcesas) andarCurva(c, curvas.find((x) => x.n === c.n)?.local ?? c.n.f, reduzirMovimento);
  }

  /** Marca o compasso: o fundo (só sem o tempo das notas) e a barra dourada, ambos atrás das notas. */
  function marcarCompasso(medida: SVGGElement, caixa: DOMRect) {
    const folga = Math.min(caixa.width, caixa.height) * 0.04;
    // O fundo (retângulo) só existe quando a partitura NÃO traz o tempo das notas (pacote antigo): lá ele é o único destaque. Com o tempo das notas,
    // o compasso é mostrado só pela barra dourada à esquerda, e o halo da nota fica sozinho (o fundo o apagava).
    let ancora: Element | null = null;
    if (!porNota) {
      retangulo = criarRetangulo(caixa, folga);
      medida.insertBefore(retangulo, medida.firstChild);
      ancora = retangulo;
    }
    barra = criarBarra(caixa, folga);
    medida.insertBefore(barra, ancora ? ancora.nextSibling : medida.firstChild); // atrás das notas: primeiro filho, ou logo depois do retângulo
  }

  function destacar(indice: number | null) {
    const alvo = indice ?? -1;
    if (alvo === compassoAceso) return;
    limparMarcas();
    compassoAceso = alvo;
    if (indice === null || !folha) return;
    const medida = folha.querySelectorAll<SVGGElement>("svg g.measure")[indice];
    const caixa = medida ? medirCaixa(medida) : null; // sem o compasso (índice fora do desenho) ou sem layout (painel escondido): não destaca
    if (!medida || !caixa || caixa.width === 0 || caixa.height === 0) return;
    marcarCompasso(medida, caixa);
    garantirVisivel(medida, folha.parentElement);
  }

  // O SVG foi trocado (outra versão, ou lido de novo): o retângulo e o índice guardados eram do DOM antigo.
  $effect(() => {
    void carga;
    void folha;
    untrack(() => {
      retangulo = null;
      barra = null;
      compassoAceso = -1;
      // Os halos, as curvas e as notas lidas eram do DOM antigo.
      aureolas = [];
      curvasAcesas = [];
      curvasPedidas = [];
      notasAcesas = [];
      indiceNotas = null;
      porNota = false;
    });
  });

  /** Relê onde o hino está e põe o destaque do compasso e das notas nesse ponto. */
  function atualizarKaraoke() {
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
    destacarNotas(tem ? acesasDoPonto(compassos, ponto, indiceNotas) : []);
  }

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
    untrack(atualizarKaraoke);
    if (tocando) return aCadaQuadro(atualizarKaraoke);
  });
</script>

{#if estado !== "tem"}
  <!-- Nenhum pacote com partituras foi importado: a aba existe para dizer isso e levar a quem importa. -->
  <div class="sem-pacote" role="status">
    <h2>{t("partitura.sem_pacote_titulo")}</h2>
    <!-- Com só o pacote de exemplo as partituras não têm onde entrar (o Baixar delas fica desabilitado em Ajustes): manda baixar o hinário antes. -->
    <p>{t(exemplo ? "partitura.sem_hinario_texto" : "partitura.sem_pacote_texto")}</p>
    <a class="botao primario" href={exemplo ? "/ajustes?abrir=hinario" : "/ajustes?abrir=partituras"}>{t("partitura.abrir_ajustes")}</a>
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

  /* Barra de zoom: o mesmo controle de tamanho da barra da letra (ControleDeTamanho), à esquerda como lá. */
  .barra-zoom { display: flex; justify-content: flex-start; margin: 0 0 1rem; }
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
  /* A marca de andamento que o autor escreveu na partitura ("♩ = 112 - 144") é sujeira no desenho: o andamento de verdade está no botão do topo (e na aba Ouvir). */
  .folha :global(svg g.tempo) { display: none; }
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
  /* A ligadura: a faixa larga e translúcida ATRÁS da curva (a folga de luz, como o halo da nota), o traço dourado fino por cima e o ponto brilhante na
     ponta, tudo recortado da esquerda para a direita conforme a primeira nota soa. Largura de 0,6 rem na tela em qualquer zoom. */
  .folha :global(svg path.faixa-ligadura) {
    fill: var(--ouro); stroke: var(--ouro); stroke-width: 0.6rem; stroke-linejoin: round; stroke-linecap: round; opacity: 0.5;
    vector-effect: non-scaling-stroke; pointer-events: none;
  }
  :global(:root[data-tema="alto-contraste"]) .folha :global(svg path.faixa-ligadura) { opacity: 0.3; }
  .folha :global(svg circle.ponto-ligadura) { fill: var(--ouro); stroke: var(--ouro-linha); stroke-width: 0.125rem; vector-effect: non-scaling-stroke; pointer-events: none; }
  .folha :global(svg path.destaque-ligadura) {
    fill: var(--ouro); fill-opacity: 0.9; stroke: var(--ouro-linha); stroke-width: 0.125rem; vector-effect: non-scaling-stroke; pointer-events: none;
  }
  /* A barra dourada à esquerda do compasso que toca (como a barra da estrofe da vez na letra): diz qual é o compasso. */
  .folha :global(svg line.barra-compasso) { stroke: var(--ouro-linha); stroke-width: 0.25rem; stroke-linecap: butt; vector-effect: non-scaling-stroke; pointer-events: none; }
</style>
