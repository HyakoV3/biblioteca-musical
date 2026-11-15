<script lang="ts">
  import Aviso from "$lib/Aviso.svelte";
  import Barra from "$lib/Barra.svelte";
  import { biblioteca } from "$lib/biblioteca.svelte";
  import Icone from "$lib/Icone.svelte";
  import Estado from "$lib/Estado.svelte";
  import { traduzirErro } from "$lib/erros";
  import { i18n } from "$lib/i18n/index.svelte";
  import { casaComNumero, zerosAEsquerda } from "$lib/numero";

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  // Busca sem diferenciar maiúsculas/minúsculas nem acentos.
  const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  const hinos = $derived.by(() => {
    const todos = biblioteca.pacote?.hinario.hinos ?? [];
    const q = normalizar(biblioteca.busca);
    if (!q) return todos;
    return todos.filter((h) => casaComNumero(q, h.numero) || normalizar(h.titulo).includes(q));
  });
</script>

<!-- O título do documento é o que leitores de tela anunciam a cada troca de tela. -->
<svelte:head><title>{t("biblioteca.titulo")} · Biblioteca Musical CCB</title></svelte:head>

<Barra titulo={t("app.nome_curto")} logo="/favicon.png">
  {#snippet acao()}
    <!-- Botão só de ícone (engrenagem); o nome "Ajustes" vai no rótulo de acessibilidade e na dica. -->
    <a class="botao botao-icone" href="/ajustes" aria-label={t("nav.ajustes")} title={t("nav.ajustes")}>
      <Icone nome="ajustes" tamanho={26} />
    </a>
  {/snippet}
</Barra>

<main class="coluna conteudo">
  {#if biblioteca.erro}
    <Aviso tipo="erro">{t("erro.carregar", { erro: traduzirErro(biblioteca.erro, t) })}</Aviso>
    <button class="botao" onclick={() => biblioteca.carregar()}>{t("erro.tentar")}</button>
  {:else if !biblioteca.pacote}
    <Estado tipo="carregando" texto={t("carregando")} />
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
              <span class="num"><span aria-hidden="true" class="zeros">{zerosAEsquerda(h.numero)}</span>{h.numero}</span>
              <span class="titulo">
                <span>{h.titulo}</span>
                {#if h.autoria}<span class="autoria">{h.autoria}</span>{/if}
              </span>
              {#if h.tonalidade}<small>{h.tonalidade}</small>{/if}
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <Estado tipo="vazio" texto={t("biblioteca.sem_resultado", { termo: biblioteca.busca })}>
        {#snippet acao()}
          <button class="botao" onclick={() => (biblioteca.busca = "")}>{t("biblioteca.limpar_busca")}</button>
        {/snippet}
      </Estado>
    {/if}

    <p class="fonte meta">
      {#if biblioteca.pacote.exemplo}
        {t("biblioteca.aviso_exemplo")} <a href="/ajustes">{t("nav.ajustes")}</a>
      {:else}
        {t("biblioteca.fonte", {
          nome: biblioteca.pacote.hinario.hinario.nome,
          total: i18n.tn("plural.hinos", biblioteca.pacote.hinario.hinos.length),
        })}
      {/if}
    </p>
  {/if}
</main>

<style>
  .busca { position: relative; margin-bottom: 0.8rem; }
  input[type="search"] {
    width: 100%; box-sizing: border-box; min-height: 48px; padding: 0.7rem 3rem 0.7rem 0.9rem;
    font-size: 1rem; color: var(--texto); background: var(--superficie);
    border: 1px solid var(--borda-controle); border-radius: 12px;
    -webkit-appearance: none; appearance: none;
  }
  input[type="search"]::placeholder { color: var(--suave); opacity: 1; }
  input[type="search"]::-webkit-search-cancel-button { display: none; }
  .limpar {
    position: absolute; right: 0; top: 0; width: 48px; height: 48px; font-size: 1.1rem;
    background: transparent; border: 0; color: var(--suave); cursor: pointer;
  }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.4rem; }
  li > a {
    min-height: 56px; box-sizing: border-box; display: flex; align-items: center; gap: 0.8rem;
    padding: 0.5rem 0.9rem; text-decoration: none; color: var(--texto);
    background: var(--superficie); border: 1px solid var(--borda-controle); border-radius: 12px;
  }
  /* Três dígitos com zeros à esquerda e algarismos de mesma largura: os números alinham em coluna. */
  .botao-icone { min-width: 48px; padding: 0; }
  .num { font-weight: 700; min-width: 2.8rem; font-variant-numeric: tabular-nums; }
  .zeros { color: var(--suave); font-weight: 400; }
  .titulo { flex: 1; min-width: 0; overflow-wrap: anywhere; display: flex; flex-direction: column; }
  .autoria { font-size: 0.85rem; color: var(--suave); }
  small { color: var(--suave); }
  .fonte { margin-top: 1.2rem; }
</style>
