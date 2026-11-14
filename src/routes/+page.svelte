<script lang="ts">
  import Barra from "$lib/Barra.svelte";
  import { biblioteca } from "$lib/biblioteca.svelte";
  import { i18n } from "$lib/i18n/index.svelte";

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  // Busca sem diferenciar maiúsculas/minúsculas nem acentos.
  const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  const hinos = $derived.by(() => {
    const todos = biblioteca.pacote?.hinario.hinos ?? [];
    const q = normalizar(biblioteca.busca);
    if (!q) return todos;
    return todos.filter((h) => String(h.numero) === q || normalizar(h.titulo).includes(q));
  });
</script>

<Barra titulo={t("biblioteca.titulo")}>
  {#snippet acao()}<a class="botao" href="/ajustes">{t("nav.ajustes")}</a>{/snippet}
</Barra>

<main class="coluna conteudo">
  {#if biblioteca.erro}
    <p class="erro" role="alert">{t("erro.carregar", { erro: biblioteca.erro })}</p>
    <button class="botao" onclick={() => biblioteca.carregar()}>{t("erro.tentar")}</button>
  {:else if !biblioteca.pacote}
    <p>{t("carregando")}</p>
  {:else}
    <div class="busca">
      <input
        type="search"
        inputmode="search"
        enterkeyhint="search"
        placeholder={t("lista.buscar")}
        aria-label={t("lista.buscar_aria")}
        bind:value={biblioteca.busca}
      />
      {#if biblioteca.busca}
        <button class="limpar" aria-label={t("biblioteca.limpar_busca")} onclick={() => (biblioteca.busca = "")}>✕</button>
      {/if}
    </div>

    {#if hinos.length}
      <ul>
        {#each hinos as h (h.numero)}
          <li>
            <a href={`/hino/${h.numero}`}>
              <span class="num">{h.numero}</span>
              <span class="titulo">{h.titulo}</span>
              {#if h.tonalidade}<small>{h.tonalidade}</small>{/if}
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="meta" role="status">{t("biblioteca.sem_resultado", { termo: biblioteca.busca })}</p>
      <button class="botao" onclick={() => (biblioteca.busca = "")}>{t("biblioteca.limpar_busca")}</button>
    {/if}

    <p class="fonte meta">
      {#if biblioteca.pacote.exemplo}
        {t("biblioteca.aviso_exemplo")} <a href="/ajustes">{t("nav.ajustes")}</a>
      {:else}
        {t("biblioteca.fonte", { nome: biblioteca.pacote.hinario.hinario.nome, n: biblioteca.pacote.hinario.hinos.length })}
      {/if}
    </p>
  {/if}
</main>

<style>
  .busca { position: relative; margin-bottom: 0.8rem; }
  input[type="search"] {
    width: 100%; box-sizing: border-box; min-height: 48px; padding: 0.7rem 3rem 0.7rem 0.9rem;
    font-size: 1rem; color: inherit; background: var(--superficie); border: 1px solid var(--borda); border-radius: 12px;
    -webkit-appearance: none; appearance: none;
  }
  input[type="search"]::-webkit-search-cancel-button { display: none; }
  .limpar {
    position: absolute; right: 0; top: 0; width: 48px; height: 48px; font-size: 1.1rem;
    background: transparent; border: 0; color: var(--suave); cursor: pointer;
  }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.4rem; }
  li > a {
    min-height: 56px; box-sizing: border-box; display: flex; align-items: center; gap: 0.8rem;
    padding: 0.5rem 0.9rem; text-decoration: none; color: inherit;
    background: var(--superficie); border: 1px solid var(--borda); border-radius: 12px;
  }
  .num { font-weight: 700; min-width: 2.4rem; }
  .titulo { flex: 1; }
  small { color: var(--suave); }
  .fonte { margin-top: 1.2rem; }
  .fonte a { color: inherit; }
</style>
