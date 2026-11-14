<script lang="ts">
  import { onDestroy } from "svelte";
  import { Sintetizador, type Voz } from "./sintetizador";

  let { vozes, andamentoInicial = 90 }: { vozes: Voz[]; andamentoInicial?: number } = $props();

  const sint = new Sintetizador();
  let tocando = $state(false);
  // Valores iniciais: o pai recria o player a cada hino com {#key}.
  // svelte-ignore state_referenced_locally
  let andamento = $state(andamentoInicial);
  let transposicao = $state(0);
  // svelte-ignore state_referenced_locally
  let ativas = $state(vozes.map(() => true));

  async function alternar() {
    if (tocando) {
      sint.parar();
      tocando = false;
      return;
    }
    tocando = true;
    await sint.tocar(vozes, { andamento, transposicao, vozesAtivas: ativas }, () => (tocando = false));
  }

  onDestroy(() => sint.parar());
</script>

<section class="player" aria-label="Player">
  <button onclick={alternar}>{tocando ? "■ Parar" : "▶ Tocar"}</button>

  <label>
    Andamento: {andamento} bpm
    <input type="range" min="40" max="160" bind:value={andamento} disabled={tocando} />
  </label>

  <label>
    Transposição:
    <select bind:value={transposicao} disabled={tocando}>
      {#each Array.from({ length: 13 }, (_, i) => i - 6) as s}
        <option value={s}>{s > 0 ? `+${s}` : s} semitons</option>
      {/each}
    </select>
  </label>

  <fieldset disabled={tocando}>
    <legend>Vozes</legend>
    {#each vozes as v, i}
      <label class="voz"><input type="checkbox" bind:checked={ativas[i]} /> {v.nome}</label>
    {/each}
  </fieldset>
</section>

<style>
  .player { display: grid; gap: 0.7rem; margin: 1rem 0; padding: 0.9rem; border: 1px solid #ddd; border-radius: 10px; }
  button { padding: 0.6rem 1rem; font-size: 1rem; border-radius: 10px; border: 1px solid #888; background: #fff; color: inherit; cursor: pointer; }
  label { display: grid; gap: 0.3rem; font-size: 0.9rem; }
  .voz { display: inline-flex; align-items: center; gap: 0.4rem; margin-right: 1rem; }
  fieldset { border: 1px solid #ddd; border-radius: 8px; }
  @media (prefers-color-scheme: dark) {
    .player, fieldset { border-color: #444; }
    button { background: #2a2a2d; }
  }
</style>
