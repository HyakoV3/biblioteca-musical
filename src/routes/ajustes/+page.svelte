<script lang="ts">
  import Barra from "$lib/Barra.svelte";
  import { biblioteca } from "$lib/biblioteca.svelte";
  import { IDIOMAS, i18n, type Idioma } from "$lib/i18n/index.svelte";
  import { usarVoltar } from "$lib/navegacao";
  import { reproducao } from "$lib/reproducao.svelte";

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const voltar = usarVoltar();

  let aviso = $state("");
  let confirmando = $state(false);

  async function importar(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const arquivo = input.files?.[0];
    input.value = ""; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    aviso = "";
    try {
      const p = await biblioteca.importar(await arquivo.text());
      reproducao.limpar(); // o conteúdo mudou: para o som e esquece os ajustes dos hinos antigos
      aviso = t("importar.ok", { n: p.hinario.hinos.length, nome: p.hinario.hinario.nome });
    } catch (err) {
      aviso = t("importar.erro", { erro: String(err) });
    }
  }

  async function remover() {
    confirmando = false;
    try {
      await biblioteca.remover();
      reproducao.limpar();
      aviso = t("remover.ok");
    } catch (err) {
      aviso = t("remover.erro", { erro: String(err) });
    }
  }
</script>

<Barra titulo={t("ajustes.titulo")} {voltar} rotuloVoltar={t("nav.voltar")} />

<main class="coluna conteudo">
  <section>
    <h2>{t("ajustes.idioma")}</h2>
    <select
      aria-label={t("ajustes.idioma")}
      value={i18n.idioma}
      onchange={(e) => (i18n.idioma = e.currentTarget.value as Idioma)}
    >
      {#each Object.entries(IDIOMAS) as [id, l]}<option value={id}>{l.nome}</option>{/each}
    </select>
  </section>

  <section>
    <h2>{t("ajustes.biblioteca")}</h2>
    {#if biblioteca.pacote}
      <p class="meta">
        {#if biblioteca.pacote.exemplo}
          {t("biblioteca.aviso_exemplo")}
        {:else}
          {t("ajustes.fonte_atual", { nome: biblioteca.pacote.hinario.hinario.nome, n: biblioteca.pacote.hinario.hinos.length })}
        {/if}
      </p>
    {/if}

    <div class="acoes">
      <label class="botao">
        {t("importar.botao")}
        <input type="file" accept=".json,application/json" onchange={importar} hidden />
      </label>
      {#if biblioteca.pacote && !biblioteca.pacote.exemplo}
        <button class="botao perigo" onclick={() => (confirmando = true)}>{t("importar.remover")}</button>
      {/if}
    </div>

    {#if confirmando}
      <div class="confirma" role="alertdialog" aria-labelledby="confirma-titulo" aria-describedby="confirma-texto">
        <h3 id="confirma-titulo">{t("ajustes.remover_titulo")}</h3>
        <p id="confirma-texto">{t("ajustes.remover_texto")}</p>
        <div class="acoes">
          <button class="botao" onclick={() => (confirmando = false)}>{t("ajustes.cancelar")}</button>
          <button class="botao perigo" onclick={remover}>{t("ajustes.confirmar_remocao")}</button>
        </div>
      </div>
    {/if}

    {#if aviso}<p class="meta" role="status">{aviso}</p>{/if}
  </section>

  <section>
    <h2>{t("ajustes.sobre")}</h2>
    <p>{t("app.aviso")}</p>
    <p class="meta">BibliotecaMusical CCB · MIT</p>
  </section>
</main>

<style>
  section { margin-bottom: 1.8rem; }
  h2 { margin: 0 0 0.6rem; font-size: 0.85rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--suave); }
  select {
    min-height: 48px; font-size: 1rem; padding: 0 0.6rem; border-radius: 12px;
    border: 1px solid var(--borda); background: var(--superficie); color: inherit;
  }
  .acoes { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.6rem 0; }
  .confirma { margin: 0.8rem 0; padding: 1rem; border: 1px solid var(--perigo); border-radius: 12px; background: var(--superficie); }
  .confirma h3 { margin: 0 0 0.4rem; font-size: 1.05rem; }
  .confirma p { margin: 0 0 0.6rem; line-height: 1.5; }
</style>
