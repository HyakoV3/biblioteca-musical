<script lang="ts">
  import { page } from "$app/state";
  import Abas from "$lib/Abas.svelte";
  import Aviso from "$lib/Aviso.svelte";
  import Barra from "$lib/Barra.svelte";
  import { biblioteca } from "$lib/biblioteca.svelte";
  import Estado from "$lib/Estado.svelte";
  import { i18n } from "$lib/i18n/index.svelte";
  import { estrofes } from "$lib/letra";
  import { usarVoltar } from "$lib/navegacao";
  import Player from "$lib/Player.svelte";
  import { reproducao } from "$lib/reproducao.svelte";

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
      <div lang={idiomaConteudo}>
        {#each partes as e}
          <div class="estrofe">
            {#if e.numero !== null}<h2 lang={i18n.idioma}>{t("hino.estrofe", { n: e.numero })}</h2>{/if}
            {#each e.linhas as linha}<p>{linha}</p>{/each}
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
  .estrofe { margin-bottom: 1.4rem; }
  .estrofe h2 { margin: 0 0 0.3rem; font-size: 0.8rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--suave); }
  .estrofe p { margin: 0; font-size: 1.15rem; line-height: 1.7; overflow-wrap: anywhere; }
</style>
