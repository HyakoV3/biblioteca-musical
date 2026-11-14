<script lang="ts">
  import { onDestroy } from "svelte";
  import { i18n } from "$lib/i18n/index.svelte";
  import { ORGAOS, instrumentosDaVoz, tipoDaVoz, type InstrumentoId } from "./instrumentos";
  import { lerVoz, padrao, salvarVozes } from "./preferencias";
  import { Sintetizador, type Voz } from "./sintetizador";

  let { vozes, andamentoInicial = 90 }: { vozes: Voz[]; andamentoInicial?: number } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  const sint = new Sintetizador();
  let tocando = $state(false);
  // Valores iniciais: o pai recria o player a cada hino com {#key}.
  // svelte-ignore state_referenced_locally
  let andamento = $state(andamentoInicial);
  let transposicao = $state(0);
  // As escolhas de cada voz (instrumento, volume, silenciar) são lembradas no aparelho.
  // svelte-ignore state_referenced_locally
  const salvas = vozes.map((v) => lerVoz(v.nome));
  let instrumentos = $state<InstrumentoId[]>(salvas.map((p) => p.instrumento));
  let volumes = $state(salvas.map((p) => p.volume));
  let mudas = $state(salvas.map((p) => p.muda));

  $effect(() => {
    salvarVozes(
      vozes.map((v, i) => ({ nome: v.nome, pref: { instrumento: instrumentos[i], volume: volumes[i], muda: mudas[i] } })),
    );
  });

  function redefinir() {
    const p = padrao();
    instrumentos = vozes.map(() => p.instrumento);
    volumes = vozes.map(() => p.volume);
    mudas = vozes.map(() => p.muda);
    // Com o hino tocando, o volume e o silêncio voltam na hora; o instrumento vale na próxima vez.
    vozes.forEach((_, i) => sint.volume(i, p.volume));
  }

  const efetivo = (i: number) => (mudas[i] ? 0 : volumes[i]);
  // Nomes do arquivo como "Soprano"/"Baixo" são traduzidos; outros ("Parte I") ficam como estão.
  const nomeVoz = (nome: string) => {
    const tipo = tipoDaVoz(nome);
    return tipo ? t(`voz.${tipo}`) : nome;
  };

  async function alternar() {
    if (tocando) {
      sint.parar();
      tocando = false;
      return;
    }
    tocando = true;
    await sint.tocar(
      vozes,
      { andamento, transposicao, instrumentos: [...instrumentos], volumes: vozes.map((_, i) => efetivo(i)) },
      () => (tocando = false),
    );
  }

  // Volume e silenciar valem ao vivo, durante a execução.
  const aoMudarVoz = (i: number) => sint.volume(i, efetivo(i));

  onDestroy(() => sint.parar());
</script>

<section class="player" aria-label={t("player.titulo")}>
  <button class="tocar" onclick={alternar}>{tocando ? t("player.parar") : t("player.tocar")}</button>

  <div class="vozes" role="group" aria-label={t("player.vozes")}>
    {#each vozes as v, i}
      <div class="voz">
        <button
          class="muda"
          aria-pressed={mudas[i]}
          aria-label={mudas[i] ? t("player.ativar", { voz: nomeVoz(v.nome) }) : t("player.silenciar", { voz: nomeVoz(v.nome) })}
          onclick={() => {
            mudas[i] = !mudas[i];
            aoMudarVoz(i);
          }}
        >
          {mudas[i] ? "🔇" : "🔊"}
        </button>
        <span class="nome" class:apagada={mudas[i]}>{nomeVoz(v.nome)}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          aria-label={t("player.volume", { voz: nomeVoz(v.nome) })}
          bind:value={volumes[i]}
          oninput={() => aoMudarVoz(i)}
        />
        <select
          class="instrumento"
          aria-label={t("player.instrumento", { voz: nomeVoz(v.nome) })}
          bind:value={instrumentos[i]}
          disabled={tocando}
        >
          <optgroup label={t("grupo.orgaos")}>
            {#each ORGAOS as id}<option value={id}>{t(`inst.${id}`)}</option>{/each}
          </optgroup>
          <optgroup label={t("grupo.instrumentos")}>
            {#each instrumentosDaVoz(v.nome) as id}<option value={id}>{t(`inst.${id}`)}</option>{/each}
          </optgroup>
        </select>
      </div>
    {/each}
  </div>

  <button class="redefinir" onclick={redefinir}>{t("player.redefinir")}</button>

  <label>
    {t("player.andamento", { bpm: andamento })}
    <input type="range" min="40" max="160" bind:value={andamento} disabled={tocando} />
  </label>

  <label>
    {t("player.transposicao")}
    <select bind:value={transposicao} disabled={tocando}>
      {#each Array.from({ length: 13 }, (_, i) => i - 6) as s}
        <option value={s}>{t("player.semitons", { n: s > 0 ? `+${s}` : s })}</option>
      {/each}
    </select>
  </label>
</section>

<style>
  .player { display: grid; gap: 0.9rem; margin: 1rem 0; padding: 0.9rem; border: 1px solid #ddd; border-radius: 12px; }
  .tocar { min-height: 52px; font-size: 1.1rem; font-weight: 600; border-radius: 12px; border: 1px solid #888; background: #fff; color: inherit; cursor: pointer; }
  .vozes { display: grid; gap: 0.8rem; }
  .voz { display: grid; grid-template-columns: 44px 6rem 1fr; align-items: center; gap: 0.4rem 0.5rem; }
  .instrumento { grid-column: 1 / -1; }
  .muda { min-width: 44px; min-height: 44px; font-size: 1.2rem; border-radius: 10px; border: 1px solid #ccc; background: #fff; cursor: pointer; }
  .muda[aria-pressed="true"] { background: #eee; }
  .redefinir { min-height: 40px; border-radius: 10px; border: 1px solid #ccc; background: transparent; color: inherit; cursor: pointer; font-size: 0.9rem; }
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
