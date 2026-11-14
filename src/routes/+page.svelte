<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { onMount } from "svelte";

  type Hino = {
    numero: number;
    titulo: string;
    tonalidade?: string | null;
    letra: string[];
    partitura?: string | null;
    audio?: string | null;
  };
  type Pacote = {
    hinario: { versao: number; hinario: { id: string; nome: string }; hinos: Hino[] };
    exemplo: boolean;
  };

  let pacote = $state<Pacote | null>(null);
  let erro = $state("");
  let busca = $state("");
  let aberto = $state<Hino | null>(null);

  onMount(async () => {
    try {
      pacote = await invoke<Pacote>("carregar_hinario");
    } catch (e) {
      erro = String(e);
    }
  });

  // Busca sem diferenciar maiúsculas/minúsculas nem acentos.
  const normalizar = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  const hinos = $derived.by(() => {
    const todos = pacote?.hinario.hinos ?? [];
    const q = normalizar(busca);
    if (!q) return todos;
    return todos.filter(
      (h) => String(h.numero) === q || normalizar(h.titulo).includes(q),
    );
  });
</script>

<main class="container">
  <header>
    <h1>BibliotecaMusical CCB</h1>
    <p class="aviso">App não oficial, sem vínculo com a Congregação Cristã no Brasil.</p>
  </header>

  {#if erro}
    <p class="erro" role="alert">Erro ao carregar o hinário: {erro}</p>
  {:else if !pacote}
    <p>Carregando…</p>
  {:else if aberto}
    <button class="voltar" onclick={() => (aberto = null)}>← Voltar</button>
    <article>
      <h2>{aberto.numero}. {aberto.titulo}</h2>
      {#if aberto.tonalidade}<p class="meta">Tonalidade: {aberto.tonalidade}</p>{/if}
      {#each aberto.letra as linha}<p>{linha}</p>{:else}<p class="meta">Sem letra neste pacote.</p>{/each}
    </article>
  {:else}
    <p class="meta">
      {pacote.hinario.hinario.nome}
      {#if pacote.exemplo}— <strong>pacote de exemplo</strong>{/if}
    </p>
    <input
      type="search"
      placeholder="Buscar por número ou título"
      aria-label="Buscar hino"
      bind:value={busca}
    />
    <ul>
      {#each hinos as h (h.numero)}
        <li>
          <button onclick={() => (aberto = h)}>
            <span class="num">{h.numero}</span>
            <span>{h.titulo}</span>
            {#if h.tonalidade}<small>{h.tonalidade}</small>{/if}
          </button>
        </li>
      {:else}
        <li class="meta">Nenhum hino encontrado.</li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  :root {
    font-family: system-ui, sans-serif;
    color: #1d1d1f;
    background: #f6f6f6;
  }
  .container { max-width: 640px; margin: 0 auto; padding: 1rem; }
  h1 { font-size: 1.4rem; margin: 0; }
  .aviso, .meta { color: #666; font-size: 0.9rem; }
  input {
    width: 100%; box-sizing: border-box; padding: 0.7rem 0.9rem; margin: 0.5rem 0 1rem;
    font-size: 1rem; border: 1px solid #ccc; border-radius: 10px;
  }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.4rem; }
  li > button {
    width: 100%; display: flex; align-items: center; gap: 0.8rem; text-align: left;
    padding: 0.7rem 0.9rem; font-size: 1rem; background: #fff; color: inherit;
    border: 1px solid #ddd; border-radius: 10px; cursor: pointer;
  }
  li > button:hover { border-color: #888; }
  .num { font-weight: 700; min-width: 2.2rem; }
  small { margin-left: auto; color: #666; }
  .voltar { margin: 0.8rem 0; padding: 0.5rem 0.9rem; border-radius: 10px; border: 1px solid #ccc; background: #fff; cursor: pointer; }
  article p { line-height: 1.6; }
  .erro { color: #b00020; }
  @media (prefers-color-scheme: dark) {
    :root { color: #eee; background: #1b1b1d; }
    input, li > button, .voltar { background: #2a2a2d; color: #eee; border-color: #444; }
    .aviso, .meta, small { color: #aaa; }
  }
</style>
