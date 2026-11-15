<script lang="ts">
  import { page } from "$app/state";
  import Abas from "$lib/Abas.svelte";
  import Aviso from "$lib/Aviso.svelte";
  import Barra from "$lib/Barra.svelte";
  import { biblioteca } from "$lib/biblioteca.svelte";
  import Estado from "$lib/Estado.svelte";
  import { i18n } from "$lib/i18n/index.svelte";
  import { estrofes } from "$lib/letra";
  import { marcaEm, marcasDaVez, sincroniaCombina, type Marca } from "$lib/karaoke";
  import { usarVoltar } from "$lib/navegacao";
  import Player from "$lib/Player.svelte";
  import { lerKaraoke, salvarKaraoke } from "$lib/preferencias";
  import { reproducao } from "$lib/reproducao.svelte";
  import { untrack } from "svelte";

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const voltar = usarVoltar();

  type Aba = "letra" | "ouvir";
  const ABAS: Aba[] = ["ouvir", "letra"];

  const numero = $derived(Number(page.params.numero));
  const hino = $derived(biblioteca.hino(numero));
  const partes = $derived(hino ? estrofes(hino.letra) : []);
  const temAudio = $derived((hino?.vozes.length ?? 0) > 0);
  // Idioma do conteúdo (título e letra), quando o hinário o declara; a interface pode estar em outra língua.
  const idiomaConteudo = $derived(biblioteca.pacote?.hinario.hinario.idioma ?? undefined);
  // Linha de apoio sob o título: tonalidade e autoria, quando existirem.
  const subtitulo = $derived.by(() => {
    if (!hino) return undefined;
    const partes = [
      hino.tonalidade ? t("hino.tonalidade", { tom: hino.tonalidade }) : null,
      hino.autoria ? t("hino.autoria", { nome: hino.autoria }) : null,
    ].filter(Boolean);
    return partes.length ? partes.join(" · ") : undefined;
  });
  const tituloPagina = $derived(hino ? `${hino.numero} · ${hino.titulo}` : t("biblioteca.titulo"));

  // --- Karaokê da letra: acende a estrofe da vez, a linha e o trecho (sílaba) que está soando. ---
  // Só existe se o hino traz a sincronia e ela combina com a letra (se a letra foi editada, fica desligado).
  const sincroniaOk = $derived(!!hino && temAudio && sincroniaCombina(hino.letra, hino.sincronia));
  let karaoke = $state(lerKaraoke());
  const karaokeAtivo = $derived(karaoke && sincroniaOk);
  type Aceso = { estrofe: number; linha: number; de: number; ate: number };
  let aceso = $state<Aceso | null>(null);

  // As marcas de cada vez, calculadas uma vez por (passada, estrofe) e guardadas até trocar de hino.
  let marcasPorVez = new Map<string, Marca[]>();
  $effect(() => {
    void hino;
    marcasPorVez = new Map();
  });

  /** Lê onde a música está agora e atualiza o trecho aceso (só mexe no estado se mudou). */
  function atualizarKaraoke() {
    const sinc = hino?.sincronia;
    const p = karaokeAtivo && hino && sinc ? reproducao.ponto(hino.numero) : null;
    if (!p || p.parte === "intro" || !sinc) {
      if (aceso !== null) aceso = null;
      return;
    }
    const usaFinal = p.final && !!sinc.final;
    const chave = `${usaFinal ? "f" : "n"}${p.parte}`;
    let marcas = marcasPorVez.get(chave);
    if (!marcas) {
      marcas = marcasDaVez(usaFinal ? sinc.final! : sinc.normal, p.parte);
      marcasPorVez.set(chave, marcas);
    }
    const m = marcaEm(marcas, p.batida);
    const novo: Aceso | null = m ? { estrofe: m.estrofe, linha: m.linha, de: m.de, ate: m.ate } : null;
    const a = aceso;
    if (novo?.estrofe !== a?.estrofe || novo?.linha !== a?.linha || novo?.de !== a?.de || novo?.ate !== a?.ate) aceso = novo;
  }

  // Enquanto toca, lê o relógio do áudio a cada quadro (o `decorrido` do store só anda a cada 200 ms). Parado ou
  // pausado, lê uma vez a cada mudança. Fora da aba Letra não gasta nada.
  $effect(() => {
    const vendo = karaokeAtivo && aba === "letra";
    void hino;
    const estado = reproducao.estado;
    void reproducao.atual;
    if (!vendo) {
      untrack(() => {
        if (aceso !== null) aceso = null;
      });
      return;
    }
    untrack(atualizarKaraoke);
    if (estado !== "tocando") return;
    let id = 0;
    const quadro = () => {
      atualizarKaraoke();
      id = requestAnimationFrame(quadro);
    };
    id = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(id);
  });

  // Rola até a linha só quando ela muda e só se não estiver à vista (entre a barra de cima e as de baixo). A rolagem
  // é suave só se a pessoa não pediu menos movimento (regra `scroll-behavior` em movimento.css).
  let ultimaLinha = "";
  $effect(() => {
    const a = aceso;
    if (!a) {
      ultimaLinha = "";
      return;
    }
    const chave = `${a.estrofe}-${a.linha}`;
    if (chave === ultimaLinha) return;
    ultimaLinha = chave;
    const el = document.getElementById(`linha-${chave}`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const topo = (document.querySelector("header")?.getBoundingClientRect().bottom ?? 0) + 8;
    const css = getComputedStyle(document.documentElement);
    const reservado = (parseFloat(css.getPropertyValue("--altura-miniplayer")) || 0) + (parseFloat(css.getPropertyValue("--altura-navegacao")) || 0);
    if (r.top < topo || r.bottom > window.innerHeight - reservado - 8) el.scrollIntoView({ block: "center" });
  });

  function alternarKaraoke() {
    karaoke = !karaoke;
    salvarKaraoke(karaoke);
  }

  let aba = $state<Aba>("letra");
  // Ao abrir um hino: Ouvir primeiro (se houver notas para tocar); sem notas, só existe a Letra.
  $effect(() => {
    aba = hino && hino.vozes.length > 0 ? "ouvir" : "letra";
  });

  // Avisa o miniplayer quando o painel Ouvir deste hino está na tela (ele some para não duplicar controles).
  $effect(() => {
    reproducao.painelNumero = aba === "ouvir" && temAudio && hino ? hino.numero : null;
    return () => {
      reproducao.painelNumero = null;
    };
  });

</script>

<!-- O título do documento é o que leitores de tela anunciam a cada troca de tela. -->
<svelte:head><title>{tituloPagina} · Biblioteca Musical CCB</title></svelte:head>

{#if biblioteca.erro}
  <Barra titulo={t("biblioteca.titulo")} {voltar} rotuloVoltar={t("nav.voltar")} />
  <main class="coluna conteudo"><Aviso tipo="erro">{t("erro.carregar", { erro: biblioteca.erro })}</Aviso></main>
{:else if !biblioteca.pacote}
  <Barra titulo={t("biblioteca.titulo")} {voltar} rotuloVoltar={t("nav.voltar")} />
  <main class="coluna conteudo"><Estado tipo="carregando" texto={t("carregando")} /></main>
{:else if !hino}
  <Barra titulo={t("biblioteca.titulo")} {voltar} rotuloVoltar={t("nav.voltar")} />
  <main class="coluna conteudo">
    <Estado tipo="vazio" texto={t("hino.nao_encontrado")}>
      {#snippet acao()}<a class="botao" href="/">{t("biblioteca.titulo")}</a>{/snippet}
    </Estado>
  </main>
{:else}
  <Barra
    titulo={`${hino.numero} · ${hino.titulo}`}
    subtitulo={subtitulo}
    lang={idiomaConteudo}
    {voltar}
    rotuloVoltar={t("nav.voltar")}
  />

  <main class="coluna conteudo">
    <!-- Os dois painéis ficam montados (só um visível): o som não para ao trocar de aba. -->
    <div role="tabpanel" id="painel-letra" aria-labelledby={temAudio ? "aba-letra" : undefined} hidden={aba !== "letra"}>
      {#if !temAudio}
        <Aviso tipo="info">{t("hino.sem_audio")}</Aviso>
      {/if}
      {#if sincroniaOk}
        <!-- Karaokê: a letra acompanha a música. O estado aparece em texto, não só na cor. -->
        <div class="karaoke">
          <button class="botao chave-karaoke" aria-pressed={karaoke} onclick={alternarKaraoke}>
            <span>{t("hino.karaoke")}</span>
            <span class="estado-karaoke">{karaoke ? `✓ ${t("hino.karaoke_ligado")}` : t("hino.karaoke_desligado")}</span>
          </button>
          <span class="meta">{t("hino.karaoke_ajuda")}</span>
        </div>
      {/if}
      <div lang={idiomaConteudo}>
        {#each partes as e}
          <div class="estrofe" class:da-vez={aceso !== null && aceso.estrofe === e.numero}>
            {#if e.numero !== null}<h2 lang={i18n.idioma}>{t("hino.estrofe", { n: e.numero })}</h2>{/if}
            {#each e.linhas as linha, i}
              {@const acesa = aceso !== null && aceso.estrofe === e.numero && aceso.linha === i}
              <p id={`linha-${e.numero}-${i}`} class:acesa>
                {#if acesa && aceso}{linha.slice(0, aceso.de)}<span class="trecho">{linha.slice(aceso.de, aceso.ate)}</span>{linha.slice(aceso.ate)}{:else}{linha}{/if}
              </p>
            {/each}
          </div>
        {:else}
          <Estado tipo="vazio" texto={t("hino.sem_letra")} />
        {/each}
      </div>
    </div>

    {#if temAudio}
      <div role="tabpanel" id="painel-ouvir" aria-labelledby="aba-ouvir" hidden={aba !== "ouvir"}>
        {#key hino.numero}
          <Player {hino} />
        {/key}
      </div>
    {/if}
  </main>

  <!-- As abas ficam embaixo (ao alcance do polegar); com o celular deitado, numa barra lateral à esquerda. -->
  {#if temAudio}
    <Abas
      abas={ABAS.map((id) => ({ id, rotulo: t(id === "ouvir" ? "hino.aba_ouvir" : "hino.aba_letra") }))}
      selecionada={aba}
      aoSelecionar={(id) => (aba = id as Aba)}
      rotulo={t("hino.abas")}
    />
  {/if}
{/if}

<style>
  .karaoke { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem 0.75rem; margin-bottom: 1rem; }
  .chave-karaoke { gap: 0.6rem; }
  .estado-karaoke { font-weight: 600; }
  .chave-karaoke[aria-pressed="true"] { border: 2px solid var(--ouro-linha); }
  .karaoke .meta { flex: 1 1 12rem; margin: 0; }
  /* A estrofe que soa leva uma barra dourada na borda (o recuo negativo mantém o texto no mesmo lugar). */
  .estrofe { margin-bottom: 1.4rem; margin-left: -1rem; padding-left: calc(1rem - 4px); border-left: 4px solid transparent; }
  .estrofe.da-vez { border-left-color: var(--ouro-linha); }
  /* Tocando o karaokê, as outras linhas da estrofe esmaecem; a linha atual fica normal e o trecho que soa, em
     destaque dourado com sublinhado (sem mudar o tamanho do texto, para nada "pular"). */
  .estrofe.da-vez p:not(.acesa) { color: var(--suave); }
  .trecho {
    background: var(--ouro); color: var(--ouro-sobre); border-radius: 4px; box-shadow: 0 0 0 2px var(--ouro);
    text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 3px;
  }
  .estrofe h2 { margin: 0 0 0.3rem; font-size: 0.8rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--suave); }
  .estrofe p { margin: 0; font-size: 1.15rem; line-height: 1.7; overflow-wrap: anywhere; }
</style>
