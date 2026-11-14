<script lang="ts">
  import { page } from "$app/state";
  import Barra from "$lib/Barra.svelte";
  import { biblioteca } from "$lib/biblioteca.svelte";
  import { i18n } from "$lib/i18n/index.svelte";
  import { estrofes } from "$lib/letra";
  import { usarVoltar } from "$lib/navegacao";
  import Player from "$lib/Player.svelte";

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const voltar = usarVoltar();

  type Aba = "letra" | "ouvir";

  const numero = $derived(Number(page.params.numero));
  const hino = $derived(biblioteca.hino(numero));
  const partes = $derived(hino ? estrofes(hino.letra) : []);
  const temAudio = $derived((hino?.vozes.length ?? 0) > 0);

  let aba = $state<Aba>("letra");
  // Ao abrir um hino: Ouvir primeiro (se houver notas para tocar); sem notas, só existe a Letra.
  $effect(() => {
    aba = hino && hino.vozes.length > 0 ? "ouvir" : "letra";
  });

  // Setas esquerda/direita trocam de aba (padrão de abas acessíveis).
  function teclas(e: KeyboardEvent) {
    if (!temAudio || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return;
    e.preventDefault();
    aba = aba === "letra" ? "ouvir" : "letra";
    document.getElementById(`aba-${aba}`)?.focus();
  }
</script>

{#if biblioteca.erro}
  <Barra titulo={t("biblioteca.titulo")} {voltar} rotuloVoltar={t("nav.voltar")} />
  <main class="coluna conteudo"><p class="erro" role="alert">{t("erro.carregar", { erro: biblioteca.erro })}</p></main>
{:else if !biblioteca.pacote}
  <Barra titulo={t("biblioteca.titulo")} {voltar} rotuloVoltar={t("nav.voltar")} />
  <main class="coluna conteudo"><p>{t("carregando")}</p></main>
{:else if !hino}
  <Barra titulo={t("biblioteca.titulo")} {voltar} rotuloVoltar={t("nav.voltar")} />
  <main class="coluna conteudo">
    <p role="alert">{t("hino.nao_encontrado")}</p>
    <a class="botao" href="/">{t("biblioteca.titulo")}</a>
  </main>
{:else}
  <Barra
    titulo={`${hino.numero} · ${hino.titulo}`}
    subtitulo={hino.tonalidade ? t("hino.tonalidade", { tom: hino.tonalidade }) : undefined}
    {voltar}
    rotuloVoltar={t("nav.voltar")}
  />

  {#if temAudio}
    <div class="abas-faixa">
      <div class="coluna abas" role="tablist" aria-label={t("hino.abas")} tabindex="-1" onkeydown={teclas}>
        <button
          role="tab"
          id="aba-ouvir"
          aria-selected={aba === "ouvir"}
          aria-controls="painel-ouvir"
          tabindex={aba === "ouvir" ? 0 : -1}
          onclick={() => (aba = "ouvir")}>{t("hino.aba_ouvir")}</button
        >
        <button
          role="tab"
          id="aba-letra"
          aria-selected={aba === "letra"}
          aria-controls="painel-letra"
          tabindex={aba === "letra" ? 0 : -1}
          onclick={() => (aba = "letra")}>{t("hino.aba_letra")}</button
        >
      </div>
    </div>
  {/if}

  <main class="coluna conteudo">
    <!-- Os dois painéis ficam montados (só um visível): o som não para ao trocar de aba. -->
    <div role="tabpanel" id="painel-letra" aria-labelledby={temAudio ? "aba-letra" : undefined} hidden={aba !== "letra"}>
      {#each partes as e}
        <div class="estrofe">
          {#if e.numero !== null}<h2>{t("hino.estrofe", { n: e.numero })}</h2>{/if}
          {#each e.linhas as linha}<p>{linha}</p>{/each}
        </div>
      {:else}
        <p class="meta">{t("hino.sem_letra")}</p>
      {/each}
    </div>

    {#if temAudio}
      <div role="tabpanel" id="painel-ouvir" aria-labelledby="aba-ouvir" hidden={aba !== "ouvir"}>
        {#key hino.numero}
          <Player vozes={hino.vozes} andamentoInicial={hino.andamento ?? 90} />
        {/key}
      </div>
    {/if}
  </main>
{/if}

<style>
  .abas-faixa { position: sticky; top: calc(56px + env(safe-area-inset-top)); z-index: 9; background: var(--fundo); border-bottom: 1px solid var(--borda); }
  .abas { display: flex; gap: 0.25rem; }
  [role="tab"] {
    flex: 1; min-height: 48px; font-size: 1rem; background: transparent; color: var(--suave);
    border: 0; border-bottom: 3px solid transparent; cursor: pointer;
  }
  [role="tab"][aria-selected="true"] { color: var(--texto); font-weight: 600; border-bottom-color: currentColor; }
  .estrofe { margin-bottom: 1.4rem; }
  .estrofe h2 { margin: 0 0 0.3rem; font-size: 0.8rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--suave); }
  .estrofe p { margin: 0; font-size: 1.15rem; line-height: 1.7; }
</style>
