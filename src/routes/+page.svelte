<script lang="ts">
  import { invoke } from "@tauri-apps/api/core";
  import { onMount } from "svelte";
  import { pushState } from "$app/navigation";
  import { page } from "$app/state";
  import Player from "$lib/Player.svelte";
  import type { Voz } from "$lib/sintetizador";

  type Hino = {
    numero: number;
    titulo: string;
    tonalidade?: string | null;
    letra: string[];
    partitura?: string | null;
    andamento?: number | null;
    vozes: Voz[];
  };
  type Pacote = {
    hinario: { versao: number; hinario: { id: string; nome: string }; hinos: Hino[] };
    exemplo: boolean;
  };

  let pacote = $state<Pacote | null>(null);
  let erro = $state("");
  let busca = $state("");
  let aviso = $state("");
  let confirmandoRemocao = $state(false);

  // O hino aberto vive no histórico (roteamento raso): assim o botão "voltar" do Android
  // e o gesto de voltar do iOS fecham o hino em vez de sair do app.
  const aberto = $derived(pacote?.hinario.hinos.find((h) => h.numero === page.state.hino) ?? null);
  const abrir = (h: Hino) => {
    pushState("", { hino: h.numero });
    window.scrollTo(0, 0);
  };
  const voltar = () => history.back();

  onMount(async () => {
    try {
      pacote = await invoke<Pacote>("carregar_hinario");
    } catch (e) {
      erro = String(e);
    }
  });

  async function importar(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const arquivo = input.files?.[0];
    input.value = ""; // permite escolher o mesmo arquivo de novo
    if (!arquivo) return;
    aviso = "";
    try {
      pacote = await invoke<Pacote>("importar_hinario", { json: await arquivo.text() });
      busca = "";
      aviso = `Importado: ${pacote.hinario.hinos.length} hinos de "${pacote.hinario.hinario.nome}".`;
    } catch (err) {
      aviso = `Não foi possível importar: ${err}`;
    }
  }

  async function removerConteudo() {
    if (!confirmandoRemocao) {
      confirmandoRemocao = true;
      return;
    }
    confirmandoRemocao = false;
    try {
      pacote = await invoke<Pacote>("remover_conteudo");
      aviso = "Conteúdo importado removido. Mostrando o pacote de exemplo.";
    } catch (err) {
      aviso = `Não foi possível remover: ${err}`;
    }
  }

  // Busca sem diferenciar maiúsculas/minúsculas nem acentos.
  const normalizar = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  const hinos = $derived.by(() => {
    const todos = pacote?.hinario.hinos ?? [];
    const q = normalizar(busca);
    if (!q) return todos;
    return todos.filter((h) => String(h.numero) === q || normalizar(h.titulo).includes(q));
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
    <button class="voltar" onclick={voltar}>← Voltar</button>
    <article>
      <h2>{aberto.numero}. {aberto.titulo}</h2>
      {#if aberto.tonalidade}<p class="meta">Tonalidade: {aberto.tonalidade}</p>{/if}
      {#if aberto.vozes.length}
        {#key aberto.numero}
          <Player vozes={aberto.vozes} andamentoInicial={aberto.andamento ?? 90} />
        {/key}
      {/if}
      <div class="letra">
        {#each aberto.letra as linha}<p>{linha}</p>{:else}<p class="meta">Sem letra neste pacote.</p>{/each}
      </div>
    </article>
  {:else}
    <p class="meta">
      {pacote.hinario.hinario.nome}
      {#if pacote.exemplo}— <strong>pacote de exemplo</strong>{/if}
    </p>
    <input
      type="search"
      inputmode="search"
      placeholder="Buscar por número ou título"
      aria-label="Buscar hino"
      bind:value={busca}
    />
    <div class="importar">
      <label class="botao">
        Importar hinário (.json)
        <input type="file" accept=".json,application/json" onchange={importar} hidden />
      </label>
      {#if !pacote.exemplo}
        <button class="secundario" onclick={removerConteudo}>
          {confirmandoRemocao ? "Confirmar remoção" : "Remover conteúdo importado"}
        </button>
      {/if}
    </div>
    {#if aviso}<p class="meta" role="status">{aviso}</p>{/if}
    <ul>
      {#each hinos as h (h.numero)}
        <li>
          <button onclick={() => abrir(h)}>
            <span class="num">{h.numero}</span>
            <span class="titulo">{h.titulo}</span>
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
  :global(body) { margin: 0; -webkit-text-size-adjust: 100%; }
  /* Respeita o recorte da câmera e a barra de gestos (viewport-fit=cover). */
  .container {
    max-width: 640px;
    margin: 0 auto;
    padding: max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right))
      max(1.5rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));
  }
  h1 { font-size: 1.4rem; margin: 0; }
  .aviso, .meta { color: #666; font-size: 0.9rem; }
  input[type="search"] {
    width: 100%; box-sizing: border-box; min-height: 48px; padding: 0.7rem 0.9rem; margin: 0.5rem 0 0.8rem;
    font-size: 1rem; border: 1px solid #ccc; border-radius: 12px;
  }
  .importar { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.8rem; }
  .botao, .secundario, .voltar {
    display: inline-flex; align-items: center; min-height: 44px; box-sizing: border-box;
    padding: 0 1rem; font-size: 0.95rem; border-radius: 12px; border: 1px solid #ccc;
    background: #fff; color: inherit; cursor: pointer;
  }
  .voltar { margin: 0.8rem 0; }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.4rem; }
  li > button {
    width: 100%; min-height: 52px; display: flex; align-items: center; gap: 0.8rem; text-align: left;
    padding: 0.5rem 0.9rem; font-size: 1rem; background: #fff; color: inherit;
    border: 1px solid #ddd; border-radius: 12px; cursor: pointer;
  }
  li > button:hover { border-color: #888; }
  .num { font-weight: 700; min-width: 2.4rem; }
  .titulo { flex: 1; }
  small { color: #666; }
  .letra { margin-top: 1rem; }
  .letra p { line-height: 1.6; margin: 0; font-size: 1.05rem; }
  .letra p:empty { min-height: 1em; } /* linha vazia separa as estrofes */
  .erro { color: #b00020; }
  @media (prefers-color-scheme: dark) {
    :root { color: #eee; background: #1b1b1d; }
    input[type="search"], li > button, .botao, .secundario, .voltar { background: #2a2a2d; color: #eee; border-color: #444; }
    .aviso, .meta, small { color: #aaa; }
  }
</style>
