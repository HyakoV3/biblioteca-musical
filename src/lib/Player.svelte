<script lang="ts">
  import { onDestroy } from "svelte";
  import { Sintetizador, TIMBRES, type Timbre, type Voz } from "./sintetizador";

  let { vozes, andamentoInicial = 90 }: { vozes: Voz[]; andamentoInicial?: number } = $props();

  const sint = new Sintetizador();
  let tocando = $state(false);
  // Valores iniciais: o pai recria o player a cada hino com {#key}.
  // svelte-ignore state_referenced_locally
  let andamento = $state(andamentoInicial);
  let transposicao = $state(0);
  let timbre = $state<Timbre>("orgao");
  // svelte-ignore state_referenced_locally
  let volumes = $state(vozes.map(() => 1));
  // svelte-ignore state_referenced_locally
  let mudas = $state(vozes.map(() => false));

  const efetivo = (i: number) => (mudas[i] ? 0 : volumes[i]);

  async function alternar() {
    if (tocando) {
      sint.parar();
      tocando = false;
      return;
    }
    tocando = true;
    await sint.tocar(
      vozes,
      { andamento, transposicao, timbre, volumes: vozes.map((_, i) => efetivo(i)) },
      () => (tocando = false),
    );
  }

  // Volume e silenciar valem ao vivo, durante a execução.
  const aoMudarVoz = (i: number) => sint.volume(i, efetivo(i));

  onDestroy(() => sint.parar());
</script>

<section class="player" aria-label="Player">
  <button class="tocar" onclick={alternar}>{tocando ? "■ Parar" : "▶ Tocar"}</button>

  <div class="vozes" role="group" aria-label="Vozes">
    {#each vozes as v, i}
      <div class="voz">
        <button
          class="muda"
          aria-pressed={mudas[i]}
          aria-label={mudas[i] ? `Ativar ${v.nome}` : `Silenciar ${v.nome}`}
          onclick={() => {
            mudas[i] = !mudas[i];
            aoMudarVoz(i);
          }}
        >
          {mudas[i] ? "🔇" : "🔊"}
        </button>
        <span class="nome" class:apagada={mudas[i]}>{v.nome}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          aria-label={`Volume de ${v.nome}`}
          bind:value={volumes[i]}
          oninput={() => aoMudarVoz(i)}
        />
      </div>
    {/each}
  </div>

  <label>
    Timbre
    <select bind:value={timbre} disabled={tocando}>
      {#each Object.entries(TIMBRES) as [id, t]}
        <option value={id}>{t.nome}</option>
      {/each}
    </select>
  </label>

  <label>
    Andamento: {andamento} bpm
    <input type="range" min="40" max="160" bind:value={andamento} disabled={tocando} />
  </label>

  <label>
    Transposição
    <select bind:value={transposicao} disabled={tocando}>
      {#each Array.from({ length: 13 }, (_, i) => i - 6) as s}
        <option value={s}>{s > 0 ? `+${s}` : s} semitons</option>
      {/each}
    </select>
  </label>
</section>

<style>
  .player { display: grid; gap: 0.9rem; margin: 1rem 0; padding: 0.9rem; border: 1px solid #ddd; border-radius: 12px; }
  .tocar { min-height: 52px; font-size: 1.1rem; font-weight: 600; border-radius: 12px; border: 1px solid #888; background: #fff; color: inherit; cursor: pointer; }
  .vozes { display: grid; gap: 0.4rem; }
  .voz { display: grid; grid-template-columns: 44px 5.5rem 1fr; align-items: center; gap: 0.5rem; }
  .muda { min-width: 44px; min-height: 44px; font-size: 1.2rem; border-radius: 10px; border: 1px solid #ccc; background: #fff; cursor: pointer; }
  .muda[aria-pressed="true"] { background: #eee; }
  .nome.apagada { opacity: 0.45; text-decoration: line-through; }
  label { display: grid; gap: 0.3rem; font-size: 0.95rem; }
  select { min-height: 44px; font-size: 1rem; border-radius: 10px; padding: 0 0.5rem; }
  input[type="range"] { width: 100%; min-height: 32px; }
  @media (prefers-color-scheme: dark) {
    .player { border-color: #444; }
    .tocar, .muda { background: #2a2a2d; color: inherit; border-color: #555; }
    .muda[aria-pressed="true"] { background: #3a3a3d; }
  }
</style>
