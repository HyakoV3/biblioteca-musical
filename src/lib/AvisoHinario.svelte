<script lang="ts">
  import Aviso from "./Aviso.svelte";
  import { biblioteca } from "./biblioteca.svelte";
  import { avisoDispensado, deveAvisar, dispensarAviso } from "./hinario/aviso";
  import { hinario } from "./hinario/hinario.svelte";
  import { instalando } from "./instalando.svelte";
  import { i18n } from "./i18n/index.svelte";
  import { traduzirErro } from "./erros";
  import { formatarMB } from "./sons/formato";

  // O aviso do primeiro acesso: com só o pacote de exemplo, oferece baixar o hinário (o texto e a música dos hinos não vão dentro do app). "Agora não" o dispensa,
  // e o mesmo botão segue em Ajustes → Conteúdo. É um diálogo modal nativo (`<dialog>`): o foco fica nele e o Esc o dispensa.
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  let dispensado = $state(avisoDispensado());
  let janela = $state<HTMLDialogElement | null>(null);
  const aberto = $derived(deveAvisar(biblioteca.pacote, hinario.disponivel, dispensado));
  const baixando = $derived(["baixando", "conferindo", "instalando"].includes(hinario.andamento.fase));

  $effect(() => {
    if (!janela) return;
    if (aberto && !janela.open) janela.showModal();
    else if (!aberto && janela.open) janela.close();
  });

  function dispensar() {
    dispensarAviso();
    dispensado = true;
  }

  const textoDoErro = $derived.by(() => {
    const e = hinario.andamento.erro;
    if (!e) return "";
    if ("codigo" in e) return t(e.codigo === "rede" ? "sons.erro_rede" : "sons.erro_arquivo");
    return traduzirErro(e.bruto, t);
  });
</script>

<dialog bind:this={janela} class="aviso-hinario" aria-labelledby="aviso-hinario-titulo" oncancel={(e) => (e.preventDefault(), dispensar())}>
  <h2 id="aviso-hinario-titulo">{t("hinario.aviso_titulo")}</h2>
  <p>{t("hinario.aviso_texto")}</p>
  <p class="meta">{t("hinario.aviso_depois")}</p>

  {#if baixando}
    <progress value={hinario.andamento.progresso} max="1" aria-label={t("hinario.baixando", { n: Math.round(hinario.andamento.progresso * 100) })}></progress>
    <p class="meta" role="status">
      {hinario.andamento.fase === "baixando"
        ? t("hinario.baixando", { n: Math.round(hinario.andamento.progresso * 100) })
        : hinario.andamento.fase === "conferindo"
          ? t("hinario.conferindo")
          : t("hinario.instalando")}
    </p>
  {/if}
  {#if hinario.andamento.fase === "erro"}<Aviso tipo="erro">{textoDoErro}</Aviso>{/if}

  <div class="acoes">
    <button class="botao" id="hinario-agora-nao" onclick={dispensar}>{t("hinario.aviso_agora_nao")}</button>
    <button class="botao primario" id="hinario-baixar" disabled={baixando || instalando.ocupado} onclick={() => hinario.baixar()}>
      {t("hinario.baixar", { tamanho: formatarMB(hinario.bytes, i18n.idioma) })}
    </button>
  </div>
</dialog>

<style>
  .aviso-hinario {
    max-width: min(32rem, calc(100vw - 2rem)); padding: 1.25rem; border: 0.0625rem solid var(--borda-controle); border-radius: 1rem;
    background: var(--fundo); color: var(--texto);
  }
  .aviso-hinario::backdrop { background: rgb(0 0 0 / 0.55); }
  h2 { margin: 0 0 0.75rem; font-size: 1.2rem; }
  p { margin: 0 0 0.75rem; }
  progress { width: 100%; height: 0.625rem; accent-color: var(--acento); margin-bottom: 0.5rem; }
  .acoes { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 0.5rem; margin-top: 0.5rem; }
  .acoes .botao { min-height: 3rem; }
</style>
