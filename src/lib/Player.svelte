<script lang="ts">
  import type { Hino } from "./biblioteca.svelte";
  import { i18n } from "$lib/i18n/index.svelte";
  import { ORGAOS, instrumentosDaVoz, tipoDaVoz } from "./instrumentos";
  import { padrao, salvarVozes } from "./preferencias";
  import { ANDAMENTO_MAX, ANDAMENTO_MIN, TRANSPOSICAO_MAX, reproducao } from "./reproducao.svelte";
  import { formatarTempo, fracao } from "./tempo";

  let { hino }: { hino: Hino } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  // O pai recria este componente a cada hino com {#key}; os ajustes vivem no módulo de reprodução.
  // svelte-ignore state_referenced_locally
  const cfg = reproducao.config(hino);
  // svelte-ignore state_referenced_locally
  const padraoAndamento = hino.andamento ?? 90;

  // Este hino é o que está tocando (ou pausado)? Se outro hino toca, aqui tudo aparece parado.
  const meu = $derived(reproducao.atual?.numero === hino.numero);
  const estado = $derived(meu ? reproducao.estado : "parado");
  const parado = $derived(estado === "parado");
  const decorrido = $derived(meu ? reproducao.decorrido : 0);
  const duracao = $derived(meu ? reproducao.duracao : 0);

  // Instrumento, volume e silenciar de cada voz são lembrados no aparelho.
  $effect(() => {
    salvarVozes(
      hino.vozes.map((v, i) => ({
        nome: v.nome,
        pref: { instrumento: cfg.instrumentos[i], volume: cfg.volumes[i], muda: cfg.mudas[i] },
      })),
    );
  });

  // Nomes do arquivo como "Soprano"/"Baixo" são traduzidos; outros ("Parte I") ficam como estão.
  const nomeVoz = (nome: string) => {
    const tipo = tipoDaVoz(nome);
    return tipo ? t(`voz.${tipo}`) : nome;
  };

  const rotuloPrincipal = $derived(
    estado === "tocando" ? `❚❚ ${t("audio.pausar")}` : estado === "pausado" ? `▶ ${t("audio.continuar")}` : `▶ ${t("audio.tocar")}`,
  );

  const aoMudarVoz = (i: number) => reproducao.volumeAoVivo(hino.numero, i);

  function redefinirVozes() {
    const p = padrao();
    cfg.instrumentos = hino.vozes.map(() => p.instrumento);
    cfg.volumes = hino.vozes.map(() => p.volume);
    cfg.mudas = hino.vozes.map(() => p.muda);
    hino.vozes.forEach((_, i) => aoMudarVoz(i));
  }

  function restaurarPadrao() {
    cfg.andamento = padraoAndamento;
    cfg.transposicao = 0;
  }

  const passoAndamento = 5;
  const mudarAndamento = (d: number) =>
    (cfg.andamento = Math.min(ANDAMENTO_MAX, Math.max(ANDAMENTO_MIN, cfg.andamento + d * passoAndamento)));
  const mudarTom = (d: number) =>
    (cfg.transposicao = Math.min(TRANSPOSICAO_MAX, Math.max(-TRANSPOSICAO_MAX, cfg.transposicao + d)));
  const sinal = (n: number) => (n > 0 ? `+${n}` : String(n));
</script>

<section class="player" aria-label={t("player.titulo")}>
  <div class="principal">
    <button class="tocar" onclick={() => reproducao.alternar(hino)}>{rotuloPrincipal}</button>
    {#if !parado}
      <button class="parar" onclick={() => reproducao.parar()}>■ {t("audio.parar")}</button>
    {/if}
  </div>

  <div class="progresso-bloco">
    <div
      class="progresso"
      role="progressbar"
      aria-label={t("player.progresso_rotulo")}
      aria-valuemin="0"
      aria-valuemax={Math.round(duracao)}
      aria-valuenow={Math.round(decorrido)}
      aria-valuetext={t("player.progresso", { atual: formatarTempo(decorrido), total: formatarTempo(duracao) })}
    >
      <div class="preenchido" style:width={`${fracao(decorrido, duracao) * 100}%`}></div>
    </div>
    <div class="tempos" aria-hidden="true">
      <span>{formatarTempo(decorrido)}</span>
      <span>{duracao > 0 ? formatarTempo(duracao) : ""}</span>
    </div>
  </div>

  {#if !parado}
    <p class="meta dica" role="status">{t("player.parar_para_alterar")}</p>
  {/if}

  <div class="ajustes">
    <div class="passo-linha">
      <span class="rotulo" id="rot-andamento">{t("player.andamento_rotulo")}</span>
      <div class="passo" role="group" aria-labelledby="rot-andamento">
        <button
          aria-label={t("player.diminuir", { item: t("player.andamento_rotulo").toLowerCase() })}
          disabled={!parado || cfg.andamento <= ANDAMENTO_MIN}
          onclick={() => mudarAndamento(-1)}>−</button
        >
        <output aria-live="polite">{t("player.bpm", { n: cfg.andamento })}</output>
        <button
          aria-label={t("player.aumentar", { item: t("player.andamento_rotulo").toLowerCase() })}
          disabled={!parado || cfg.andamento >= ANDAMENTO_MAX}
          onclick={() => mudarAndamento(1)}>+</button
        >
      </div>
    </div>

    <div class="passo-linha">
      <span class="rotulo" id="rot-tom">{t("player.transposicao")}</span>
      <div class="passo" role="group" aria-labelledby="rot-tom">
        <button
          aria-label={t("player.diminuir", { item: t("player.transposicao").toLowerCase() })}
          disabled={!parado || cfg.transposicao <= -TRANSPOSICAO_MAX}
          onclick={() => mudarTom(-1)}>−</button
        >
        <output aria-live="polite">{t("player.semitons", { n: sinal(cfg.transposicao) })}</output>
        <button
          aria-label={t("player.aumentar", { item: t("player.transposicao").toLowerCase() })}
          disabled={!parado || cfg.transposicao >= TRANSPOSICAO_MAX}
          onclick={() => mudarTom(1)}>+</button
        >
      </div>
    </div>

    <button class="secundario" disabled={!parado} onclick={restaurarPadrao}>{t("player.restaurar_padrao")}</button>
  </div>

  <div class="vozes" role="group" aria-label={t("player.vozes")}>
    {#each hino.vozes as v, i}
      <div class="voz">
        <button
          class="muda"
          aria-pressed={cfg.mudas[i]}
          aria-label={cfg.mudas[i] ? t("player.ativar", { voz: nomeVoz(v.nome) }) : t("player.silenciar", { voz: nomeVoz(v.nome) })}
          onclick={() => {
            cfg.mudas[i] = !cfg.mudas[i];
            aoMudarVoz(i);
          }}
        >
          {cfg.mudas[i] ? "🔇" : "🔊"}
        </button>
        <span class="nome" class:apagada={cfg.mudas[i]}>{nomeVoz(v.nome)}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          aria-label={t("player.volume", { voz: nomeVoz(v.nome) })}
          bind:value={cfg.volumes[i]}
          oninput={() => aoMudarVoz(i)}
        />
        <select
          class="instrumento"
          aria-label={t("player.instrumento", { voz: nomeVoz(v.nome) })}
          bind:value={cfg.instrumentos[i]}
          disabled={!parado}
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
    <button class="secundario" onclick={redefinirVozes}>{t("player.redefinir")}</button>
  </div>
</section>

<style>
  .player { display: grid; gap: 1rem; }
  .principal { display: flex; gap: 0.5rem; }
  .tocar {
    flex: 1; min-height: 56px; font-size: 1.15rem; font-weight: 600; border-radius: 12px;
    border: 1px solid var(--borda); background: var(--superficie); color: inherit; cursor: pointer;
  }
  .parar {
    min-height: 56px; padding: 0 1rem; font-size: 1rem; border-radius: 12px;
    border: 1px solid var(--borda); background: var(--superficie); color: inherit; cursor: pointer;
  }
  .progresso { height: 8px; border-radius: 4px; background: var(--borda); overflow: hidden; }
  .preenchido { height: 100%; background: currentColor; }
  .tempos { display: flex; justify-content: space-between; margin-top: 0.3rem; font-size: 0.85rem; color: var(--suave); font-variant-numeric: tabular-nums; }
  .dica { margin: 0; }
  .ajustes { display: grid; gap: 0.6rem; }
  .passo-linha { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
  .rotulo { font-size: 0.95rem; }
  .passo { display: flex; align-items: center; gap: 0.4rem; }
  .passo button {
    width: 48px; height: 48px; font-size: 1.4rem; border-radius: 12px; line-height: 1;
    border: 1px solid var(--borda); background: var(--superficie); color: inherit; cursor: pointer;
  }
  .passo output { min-width: 6.5rem; text-align: center; font-variant-numeric: tabular-nums; }
  .vozes { display: grid; gap: 0.8rem; }
  .voz { display: grid; grid-template-columns: 48px 6rem 1fr; align-items: center; gap: 0.4rem 0.5rem; }
  .instrumento { grid-column: 1 / -1; }
  .muda {
    min-width: 48px; min-height: 48px; font-size: 1.2rem; border-radius: 12px;
    border: 1px solid var(--borda); background: var(--superficie); color: inherit; cursor: pointer;
  }
  .muda[aria-pressed="true"] { opacity: 0.7; }
  .nome.apagada { opacity: 0.45; text-decoration: line-through; }
  select {
    min-height: 48px; font-size: 1rem; border-radius: 12px; padding: 0 0.5rem;
    border: 1px solid var(--borda); background: var(--superficie); color: inherit;
  }
  input[type="range"] { width: 100%; min-height: 32px; }
  .secundario {
    min-height: 44px; border-radius: 12px; border: 1px solid var(--borda); background: transparent;
    color: inherit; cursor: pointer; font-size: 0.95rem;
  }
  button:disabled, select:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
