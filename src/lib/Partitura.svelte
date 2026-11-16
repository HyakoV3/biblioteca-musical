<script lang="ts">
  import "./partitura.css";
  import Aviso from "./Aviso.svelte";
  import { biblioteca } from "./biblioteca.svelte";
  import Estado from "./Estado.svelte";
  import { traduzirErro } from "./erros";
  import { i18n } from "./i18n/index.svelte";
  import { CONSULTA_PAISAGEM, ESCALAS_PARTITURA, ZOOM_PADRAO, escalaDoZoom, limitarZoom, varianteDaTela, type EstadoPartitura, type Variante } from "./partitura";
  import { lerZoomPartitura, salvarZoomPartitura } from "./preferencias";

  // O painel da aba Partitura (I-08). Com a partitura do hino instalada, mostra o SVG que o Rust entrega (já conferido na
  // importação e de novo na leitura) embutido na página, para seguir o tema; sem nenhuma partitura instalada, avisa e leva a Ajustes.
  let { numero, estado, ativa }: { numero: number; estado: EstadoPartitura; ativa: boolean } = $props();

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
</script>

{#if estado !== "tem"}
  <!-- Nenhum pacote com partituras foi importado: a aba existe para dizer isso e levar a quem importa. -->
  <div class="sem-pacote" role="status">
    <h2>{t("partitura.sem_pacote_titulo")}</h2>
    <p>{t("partitura.sem_pacote_texto")}</p>
    <a class="botao primario" href="/ajustes">{t("partitura.abrir_ajustes")}</a>
  </div>
{:else}
  <div class="barra-zoom" role="group" aria-label={t("partitura.zoom")}>
    <button aria-label={t("partitura.diminuir")} disabled={passo <= 0} onclick={() => mudarZoom("menos")}>−</button>
    <button
      aria-label={t("partitura.restaurar", { n: Math.round(ESCALAS_PARTITURA[ZOOM_PADRAO] * 100) })}
      disabled={passo === ZOOM_PADRAO}
      onclick={() => mudarZoom("padrao")}>{Math.round(escala * 100)}%</button
    >
    <button aria-label={t("partitura.aumentar")} disabled={passo >= ESCALAS_PARTITURA.length - 1} onclick={() => mudarZoom("mais")}>+</button>
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
      <div class="folha" role="img" aria-label={t("partitura.aria", { numero })} data-variante={variante} style:--zoom={escala}>
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

  /* Barra de zoom: os mesmos botões da barra da letra. */
  .barra-zoom { display: flex; justify-content: flex-end; gap: 0.4rem; margin: 0 0 1rem; }
  .barra-zoom button {
    display: inline-flex; align-items: center; justify-content: center; padding: 0 0.5rem; min-width: 3rem; height: 3rem;
    font-size: 1.1rem; font-weight: 600; border-radius: 0.75rem; line-height: 1; cursor: pointer;
    border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
  .barra-zoom button:disabled { opacity: 0.5; cursor: default; }
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
</style>
