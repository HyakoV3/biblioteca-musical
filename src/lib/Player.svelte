<script lang="ts">
  import Aviso from "./Aviso.svelte";
  import type { Hino } from "./biblioteca.svelte";
  import { i18n } from "$lib/i18n/index.svelte";
  import { ORGAOS, instrumentosDaVoz, tipoDaVoz } from "./instrumentos";
  import { padrao, salvarVozes } from "./preferencias";
  import { ANDAMENTO_MAX, ANDAMENTO_MIN, TRANSPOSICAO_MAX, reproducao, vezesDoHino } from "./reproducao.svelte";
  import { rotuloDaVez } from "./rotulo-vez";
  import { formatarTempo, fracao } from "./tempo";
  import { temFinal } from "./vezes";

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

  // Hino com final tem várias vezes (a última é a diferente) e botões para cada uma; os outros têm um só "Tocar".
  const comFinalDisponivel = $derived(temFinal(hino));
  const totalVezes = $derived(vezesDoHino(hino));
  const vezes = $derived(Array.from({ length: totalVezes }, (_, i) => i + 1));

  // Esta parte (o hino todo ou uma vez) é a que está tocando ou pausada?
  const ativa = (parte: "tudo" | number) => meu && !parado && reproducao.atual?.parte === parte;
  const icone = (parte: "tudo" | number) => (ativa(parte) && estado === "tocando" ? "❚❚" : "▶");

  const rotuloTudo = $derived(comFinalDisponivel ? t("vez.tudo") : t("audio.tocar"));
  const dicaDaVez = (vez: number) => {
    const nome = rotuloDaVez(vez, vez === totalVezes);
    return ativa(vez) ? (estado === "tocando" ? t("vez.pausar", { vez: nome }) : t("vez.continuar", { vez: nome })) : t("vez.tocar", { vez: nome });
  };

  // Resumo na seção recolhida: o instrumento comum a todas as vozes, ou "Vários".
  const resumoInstrumentos = $derived(
    new Set(cfg.instrumentos).size === 1 ? t(`inst.${cfg.instrumentos[0]}`) : t("player.instrumentos_varios"),
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
  const percentual = (v: number) => Math.round(v * 100);
</script>

<section class="player" aria-label={t("player.titulo")}>
  {#if reproducao.erro}
    <Aviso tipo="erro">{t("player.erro_audio")}</Aviso>
  {/if}

  <div class="principal">
    <button
      class="botao tocar"
      class:primario={ativa("tudo") || !comFinalDisponivel}
      aria-pressed={comFinalDisponivel ? ativa("tudo") : undefined}
      onclick={() => reproducao.alternar(hino, "tudo")}
    >
      {icone("tudo")}
      {rotuloTudo}
    </button>
    {#if !parado}
      <button class="botao parar" onclick={() => reproducao.parar()}>■ {t("audio.parar")}</button>
    {/if}
  </div>

  {#if comFinalDisponivel}
    <!-- Cada botão toca só aquela vez, direto. A última é a diferente (o final). -->
    <div class="vezes" role="group" aria-label={t("vez.grupo")}>
      {#each vezes as vez}
        <button
          class="botao vez"
          class:primario={ativa(vez)}
          aria-pressed={ativa(vez)}
          aria-label={dicaDaVez(vez)}
          onclick={() => reproducao.alternar(hino, vez)}
        >
          <span aria-hidden="true">{icone(vez)}</span>
          {rotuloDaVez(vez, vez === totalVezes)}
        </button>
      {/each}
    </div>
    <p class="meta dica">{t("vez.dica")}</p>
  {/if}

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
        <output aria-live="polite">
          {i18n.tn("plural.semitons", Math.abs(cfg.transposicao), { n: sinal(cfg.transposicao) })}
        </output>
        <button
          aria-label={t("player.aumentar", { item: t("player.transposicao").toLowerCase() })}
          disabled={!parado || cfg.transposicao >= TRANSPOSICAO_MAX}
          onclick={() => mudarTom(1)}>+</button
        >
      </div>
    </div>

    <button class="botao secundario" disabled={!parado} onclick={restaurarPadrao}>{t("player.restaurar_padrao")}</button>
  </div>

  <!-- Mixer: cada voz tem três controles distintos. Interruptor = liga/desliga a voz;
       controle deslizante = volume; instrumento fica na seção recolhida abaixo. -->
  <div class="vozes" role="group" aria-label={t("player.vozes")}>
    {#each hino.vozes as v, i}
      <div class="voz" class:silenciada={cfg.mudas[i]}>
        <button
          class="chave"
          role="switch"
          aria-checked={!cfg.mudas[i]}
          aria-label={t("player.voz_rotulo", { voz: nomeVoz(v.nome) })}
          onclick={() => {
            cfg.mudas[i] = !cfg.mudas[i];
            aoMudarVoz(i);
          }}
        >
          {cfg.mudas[i] ? "🔇" : "🔊"}
        </button>
        <div class="identidade">
          <span class="nome">{nomeVoz(v.nome)}</span>
          <span class="estado-voz">{cfg.mudas[i] ? t("player.silenciada") : `${percentual(cfg.volumes[i])}%`}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          aria-label={t("player.volume", { voz: nomeVoz(v.nome) })}
          aria-valuetext={t("player.volume_valor", { n: percentual(cfg.volumes[i]) })}
          bind:value={cfg.volumes[i]}
          oninput={() => aoMudarVoz(i)}
        />
      </div>
    {/each}
  </div>

  <details class="instrumentos">
    <summary>
      <span>{t("player.instrumentos")}</span>
      <span class="resumo">{resumoInstrumentos}</span>
    </summary>
    <div class="lista-instrumentos">
      {#each hino.vozes as v, i}
        <label class="inst-linha">
          <span>{nomeVoz(v.nome)}</span>
          <select
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
        </label>
      {/each}
    </div>
  </details>

  <button class="botao secundario" onclick={redefinirVozes}>{t("player.redefinir")}</button>
</section>

<style>
  .player { display: grid; gap: 1rem; }
  .principal { display: flex; gap: 0.5rem; }
  .tocar { flex: 1; min-height: 56px; font-size: 1.15rem; }
  .parar { min-height: 56px; }
  .progresso { height: 8px; border-radius: 4px; background: var(--borda); overflow: hidden; }
  .preenchido { height: 100%; background: var(--acento); }
  .tempos { display: flex; justify-content: space-between; margin-top: 0.3rem; font-size: 0.85rem; color: var(--suave); font-variant-numeric: tabular-nums; }
  .dica { margin: 0; }

  .ajustes { display: grid; gap: 0.6rem; }
  .passo-linha { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
  .rotulo { font-size: 0.95rem; }
  .passo { display: flex; align-items: center; gap: 0.4rem; }
  .passo button {
    width: 48px; height: 48px; font-size: 1.4rem; border-radius: 12px; line-height: 1; cursor: pointer;
    border: 1px solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
  .passo output { min-width: 6.5rem; text-align: center; font-variant-numeric: tabular-nums; }
  /* Uma vez por botão, empilhados (os nomes são longos, como "Terceira vez · final"). A que toca fica em destaque. */
  .vezes { display: grid; gap: 0.5rem; }
  .vez { justify-content: flex-start; gap: 0.6rem; min-height: 52px; text-align: left; }

  .vozes { display: grid; gap: 0.5rem; }
  .voz { display: grid; grid-template-columns: 48px minmax(5.5rem, 8rem) 1fr; align-items: center; gap: 0.5rem; }
  .chave {
    min-width: 48px; min-height: 48px; font-size: 1.2rem; border-radius: 12px; cursor: pointer;
    border: 1px solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
  /* Voz silenciada: rótulo "silenciada", nome riscado e interruptor tracejado (não depende só de cor). */
  .voz.silenciada .chave { border-style: dashed; opacity: 0.75; }
  .voz.silenciada .nome { text-decoration: line-through; }
  .identidade { display: flex; flex-direction: column; min-width: 0; }
  .nome { font-weight: 600; overflow-wrap: anywhere; }
  .estado-voz { font-size: 0.8rem; color: var(--suave); font-variant-numeric: tabular-nums; }
  input[type="range"] { width: 100%; min-height: 48px; accent-color: var(--acento); }

  .instrumentos { border: 1px solid var(--borda-controle); border-radius: 12px; background: var(--superficie); }
  summary {
    display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; min-height: 48px;
    padding: 0 0.9rem; cursor: pointer; font-weight: 600;
  }
  .resumo { font-weight: 400; color: var(--suave); font-size: 0.9rem; }
  .lista-instrumentos { display: grid; gap: 0.6rem; padding: 0.2rem 0.9rem 0.9rem; }
  .inst-linha { display: grid; grid-template-columns: minmax(5.5rem, 8rem) 1fr; align-items: center; gap: 0.5rem; }
  select {
    min-height: 48px; font-size: 1rem; border-radius: 12px; padding: 0 0.5rem;
    border: 1px solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
  .secundario { background: transparent; font-size: 0.95rem; }
  button:disabled, select:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
