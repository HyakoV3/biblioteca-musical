<script lang="ts">
  import Aviso from "./Aviso.svelte";
  import type { Hino } from "./biblioteca.svelte";
  import { i18n } from "$lib/i18n/index.svelte";
  import { ORGAOS, PADRAO, instrumentosDaVoz, tipoDaVoz, type TipoVoz } from "./instrumentos";
  import { lerCartoes, padrao, salvarCartoes, salvarVozes } from "./preferencias";
  import { ehRealista, gravadoEquivalente, realistasDaVoz, sinteticoEquivalente } from "./realista";
  import { sons } from "./sons/pacotes.svelte";
  import { ANDAMENTO_MAX, ANDAMENTO_MIN, TRANSPOSICAO_MAX, reproducao, vezesDoHino } from "./reproducao.svelte";
  import Icone from "./Icone.svelte";
  import type { IconeNome } from "./icones";
  import { rotuloCurtoDaVez, rotuloDaParte } from "./rotulo-vez";
  import { formatarTempo, fracao } from "./tempo";
  import { PAUSA_ENTRE_PARTES_S, partesDoTudo, temFinal, temIntroducao } from "./vezes";

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
  // Andamento, tom e instrumentos mudam parado ou pausado (ao continuar, o som é reagendado); tocando, não.
  const editavel = $derived(estado !== "tocando");
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

  // Um botão por vez (uma por estrofe da letra; a última é a diferente, se o hino tem final) e um para a introdução.
  const comFinalDisponivel = $derived(temFinal(hino));
  const comIntroducao = $derived(temIntroducao(hino));
  const totalVezes = $derived(vezesDoHino(hino));
  const vezes = $derived(Array.from({ length: totalVezes }, (_, i) => i + 1));
  // Só mostra as partes separadas se há o que separar (introdução ou mais de uma vez); senão, um único "Tocar".
  const comPartes = $derived(totalVezes > 1 || comIntroducao);

  type Alvo = "tudo" | "intro" | number;
  // Esta parte foi pedida sozinha e está tocando ou pausada? (Só ela pausa e continua ao ser tocada de novo.)
  const ativa = (parte: Alvo) => meu && !parado && reproducao.atual?.parte === parte;
  // Esta é a parte da música que está soando agora (em "hino todo" o destaque anda de uma para a outra).
  const destacada = (parte: "intro" | number) => meu && !parado && reproducao.parteTocando === parte;
  // O botão da parte que soa vai enchendo de dourado com o tempo (de 0 a 1); ao mudar de parte, o antigo volta ao normal e o
  // novo começa do zero. Recalcula a cada passo do `decorrido` (200 ms) e lê o relógio do áudio, como o karaokê.
  const pontoAgora = $derived.by(() => {
    void decorrido;
    return meu && !parado ? reproducao.ponto(hino.numero) : null;
  });
  const fracaoDaParte = (parte: "intro" | number) =>
    pontoAgora && pontoAgora.parte === parte ? fracao(pontoAgora.batida, pontoAgora.duracao) : 0;
  // pausa: tocando sozinha · música: soando dentro do hino todo (sinal que não depende só da cor) · play: pronta para tocar.
  const icone = (parte: Alvo): IconeNome =>
    ativa(parte) && estado === "tocando" ? "pause" : parte !== "tudo" && destacada(parte) && !ativa(parte) ? "musica" : "play";

  const rotuloTudo = $derived(comPartes ? t("vez.tudo") : t("audio.tocar"));
  // Texto completo para leitor de tela (o botão mostra só "1ª", "Intro"...).
  const dicaDaParte = (parte: "intro" | number) => {
    const nome = rotuloDaParte(parte, typeof parte === "number" && parte === totalVezes && comFinalDisponivel);
    if (!ativa(parte)) return t("vez.tocar", { vez: nome });
    return estado === "tocando" ? t("vez.pausar", { vez: nome }) : t("vez.continuar", { vez: nome });
  };

  // Sons gravados (pacote opcional): só aparecem os que já foram baixados e servem à voz. O alternador troca o modo da
  // voz mantendo o instrumento quando há equivalente (flauta doce sintetizada <-> flauta doce gravada).
  const gravadosDaVoz = (tipo: TipoVoz | null) => realistasDaVoz(tipo).filter((id) => sons.instalado(id));
  function mudarModo(i: number, tipo: TipoVoz | null, gravado: boolean) {
    const atual = cfg.instrumentos[i];
    if (gravado) {
      const lista = gravadosDaVoz(tipo);
      const par = gravadoEquivalente(atual);
      cfg.instrumentos[i] = par && lista.includes(par) ? par : (lista[0] ?? atual);
    } else {
      cfg.instrumentos[i] = ehRealista(atual) ? (sinteticoEquivalente(atual) ?? PADRAO) : atual;
    }
  }
  // Um instrumento gravado que não está (mais) instalado, por exemplo depois de remover o pacote, volta ao sintetizado.
  $effect(() => {
    if (!sons.carregado || !editavel) return;
    cfg.instrumentos.forEach((id, i) => {
      if (ehRealista(id) && !sons.instalado(id)) cfg.instrumentos[i] = sinteticoEquivalente(id) ?? PADRAO;
    });
  });

  // Resumo na seção recolhida: o instrumento comum a todas as vozes, ou "Vários".
  const resumoInstrumentos = $derived(
    new Set(cfg.instrumentos).size === 1 ? t(`inst.${cfg.instrumentos[0]}`) : t("player.instrumentos_varios"),
  );

  const aoMudarVoz = (i: number) => reproducao.volumeAoVivo(hino.numero, i);

  // Só volume e silenciar (valem na hora, até tocando). Os instrumentos têm o seu próprio botão.
  function redefinirVozes() {
    const p = padrao();
    cfg.volumes = hino.vozes.map(() => p.volume);
    cfg.mudas = hino.vozes.map(() => p.muda);
    hino.vozes.forEach((_, i) => aoMudarVoz(i));
  }

  // Só os instrumentos (voltam ao padrão). Só muda parado ou pausado, como a escolha de cada instrumento.
  function redefinirInstrumentos() {
    const p = padrao();
    cfg.instrumentos = hino.vozes.map(() => p.instrumento);
  }

  function restaurarPadrao() {
    cfg.andamento = padraoAndamento;
    cfg.transposicao = 0;
  }

  // Andamento em dois passos: 1 bpm (ajuste fino) e 5 bpm (ajuste grosso).
  const PASSO_FINO = 1;
  const PASSO_GROSSO = 5;
  const mudarAndamento = (bpm: number) =>
    (cfg.andamento = Math.min(ANDAMENTO_MAX, Math.max(ANDAMENTO_MIN, cfg.andamento + bpm)));
  const mudarTom = (d: number) =>
    (cfg.transposicao = Math.min(TRANSPOSICAO_MAX, Math.max(-TRANSPOSICAO_MAX, cfg.transposicao + d)));
  const sinal = (n: number) => (n > 0 ? `+${n}` : String(n));
  const percentual = (v: number) => Math.round(v * 100);

  // Cards recolhíveis: só um fica aberto por vez (abrir um fecha os outros, para economizar tela) e o que está aberto fica
  // lembrado no aparelho. O card "Tocar" é fixo (sem ele, com a música tocando, não haveria como pausar daqui).
  const cartoes = $state(lerCartoes());
  $effect(() => {
    salvarCartoes({ ajustes: cartoes.ajustes, vozes: cartoes.vozes, instrumentos: cartoes.instrumentos });
  });

  // Duração prevista do "hino todo" (introdução, vezes e pausas) no andamento escolhido.
  const duracaoPrevista = $derived.by(() => {
    const pausa = (PAUSA_ENTRE_PARTES_S * cfg.andamento) / 60;
    const fim = partesDoTudo(hino, totalVezes, pausa).at(-1)?.fim ?? 0;
    return (fim * 60) / Math.max(cfg.andamento, 1);
  });
  const resumoAjustes = $derived(
    `${t("player.bpm", { n: cfg.andamento })} · ${i18n.tn("plural.semitons", Math.abs(cfg.transposicao), { n: sinal(cfg.transposicao) })}`,
  );
  const resumoVozes = $derived(`${cfg.mudas.filter((m) => !m).length}/${hino.vozes.length}`);
</script>

<section class="player" aria-label={t("player.titulo")}>
  {#if reproducao.erro}
    <Aviso tipo="erro">{t("player.erro_audio")}</Aviso>
  {/if}

  <!-- Card 1: tocar, vezes e duração. Fixo. -->
  <section class="cartao" aria-labelledby="tit-tocar">
    <div class="cabecalho">
      <span id="tit-tocar">{t("audio.tocar")}</span>
      <span class="resumo">{t("player.duracao_tudo", { tempo: formatarTempo(duracaoPrevista) })}</span>
    </div>
    <div class="corpo">
      <div class="principal">
        <button
          class="botao tocar primario"
          aria-pressed={comPartes ? ativa("tudo") : undefined}
          onclick={() => reproducao.alternar(hino, "tudo")}
        >
          <Icone nome={icone("tudo")} tamanho={24} />
          {rotuloTudo}
        </button>
        {#if !parado}
          <button class="botao parar" onclick={() => reproducao.parar()}><Icone nome="stop" tamanho={22} /> {t("audio.parar")}</button>
        {/if}
      </div>

      {#if comPartes}
        <!-- Cada botão toca só aquela parte, direto. Em "hino todo" o dourado acompanha a parte que está soando, e o botão
             dessa parte vai enchendo de dourado enquanto ela toca. O rótulo é desenhado duas vezes, uma por camada: o da
             camada dourada (recortada na largura do progresso) usa a cor de texto própria do dourado. -->
        {#snippet conteudoParte(parte: "intro" | number)}
          <Icone nome={icone(parte)} />
          {#if parte === "intro"}
            {t("vez.intro_curta")}
          {:else}
            {rotuloCurtoDaVez(parte)}{#if comFinalDisponivel && parte === totalVezes}<span class="flag"><Icone nome="bandeira" tamanho={18} /></span>{/if}
          {/if}
        {/snippet}
        <div class="vezes" role="group" aria-label={t("vez.grupo")}>
          {#if comIntroducao}
            <button
              class="botao vez"
              class:tocando={destacada("intro")}
              aria-pressed={ativa("intro")}
              aria-current={destacada("intro") ? "true" : undefined}
              aria-label={dicaDaParte("intro")}
              onclick={() => reproducao.alternar(hino, "intro")}
            >
              <span class="rotulo-vez">{@render conteudoParte("intro")}</span>
              {#if destacada("intro")}
                <span class="enchimento" aria-hidden="true" style:clip-path={`inset(0 ${(1 - fracaoDaParte("intro")) * 100}% 0 0)`}>
                  <span class="rotulo-vez">{@render conteudoParte("intro")}</span>
                </span>
              {/if}
            </button>
          {/if}
          {#if totalVezes > 1}
            {#each vezes as vez}
              <button
                class="botao vez"
                class:tocando={destacada(vez)}
                aria-pressed={ativa(vez)}
                aria-current={destacada(vez) ? "true" : undefined}
                aria-label={dicaDaParte(vez)}
                onclick={() => reproducao.alternar(hino, vez)}
              >
                <span class="rotulo-vez">{@render conteudoParte(vez)}</span>
                {#if destacada(vez)}
                  <span class="enchimento" aria-hidden="true" style:clip-path={`inset(0 ${(1 - fracaoDaParte(vez)) * 100}% 0 0)`}>
                    <span class="rotulo-vez">{@render conteudoParte(vez)}</span>
                  </span>
                {/if}
              </button>
            {/each}
          {/if}
        </div>
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
        <p class="meta dica" role="status">
          {estado === "tocando" ? t("player.parar_para_alterar") : t("player.mudancas_ao_continuar")}
        </p>
      {/if}
    </div>
  </section>

  <!-- Card 2: andamento e transposição. -->
  <details class="cartao" name="cartoes-ouvir" bind:open={cartoes.ajustes}>
    <summary>
      <span>{t("player.cartao_ajustes")}</span>
      <span class="direita"><span class="resumo">{resumoAjustes}</span><Icone nome={cartoes.ajustes ? "fechar" : "abrir"} tamanho={24} /></span>
    </summary>
    <div class="corpo">
      <!-- Andamento: dois passos de cada lado, −5 −1 [valor] +1 +5. Linha inteira (quatro botões não cabem ao lado do rótulo). -->
      <div class="passo-linha andamento">
        <span class="rotulo" id="rot-andamento">{t("player.andamento_rotulo")}</span>
        <div class="passo" role="group" aria-labelledby="rot-andamento">
          {#each [-PASSO_GROSSO, -PASSO_FINO] as bpm (bpm)}
            <button
              aria-label={t("player.diminuir_n", { item: t("player.andamento_rotulo").toLowerCase(), n: -bpm })}
              disabled={!editavel || cfg.andamento <= ANDAMENTO_MIN}
              onclick={() => mudarAndamento(bpm)}>−{-bpm}</button
            >
          {/each}
          <output aria-live="polite">{t("player.bpm", { n: cfg.andamento })}</output>
          {#each [PASSO_FINO, PASSO_GROSSO] as bpm (bpm)}
            <button
              aria-label={t("player.aumentar_n", { item: t("player.andamento_rotulo").toLowerCase(), n: bpm })}
              disabled={!editavel || cfg.andamento >= ANDAMENTO_MAX}
              onclick={() => mudarAndamento(bpm)}>+{bpm}</button
            >
          {/each}
        </div>
      </div>

      <div class="passo-linha">
        <span class="rotulo" id="rot-tom">{t("player.transposicao")}</span>
        <div class="passo" role="group" aria-labelledby="rot-tom">
          <button
            aria-label={t("player.diminuir", { item: t("player.transposicao").toLowerCase() })}
            disabled={!editavel || cfg.transposicao <= -TRANSPOSICAO_MAX}
            onclick={() => mudarTom(-1)}><Icone nome="menos" tamanho={24} /></button
          >
          <output aria-live="polite">
            {i18n.tn("plural.semitons", Math.abs(cfg.transposicao), { n: sinal(cfg.transposicao) })}
          </output>
          <button
            aria-label={t("player.aumentar", { item: t("player.transposicao").toLowerCase() })}
            disabled={!editavel || cfg.transposicao >= TRANSPOSICAO_MAX}
            onclick={() => mudarTom(1)}><Icone nome="mais" tamanho={24} /></button
          >
        </div>
      </div>

      <button class="botao secundario" disabled={!editavel} onclick={restaurarPadrao}>{t("player.restaurar_padrao")}</button>
    </div>
  </details>

  <!-- Card 3: vozes. Mixer: cada voz tem dois controles distintos. Interruptor = liga/desliga a voz;
       controle deslizante = volume. O instrumento fica no card seguinte. -->
  <details class="cartao" name="cartoes-ouvir" bind:open={cartoes.vozes}>
    <summary>
      <span>{t("player.vozes")}</span>
      <span class="direita"><span class="resumo"><Icone nome="som" tamanho={16} /> {resumoVozes}</span><Icone nome={cartoes.vozes ? "fechar" : "abrir"} tamanho={24} /></span>
    </summary>
    <div class="corpo">
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
              <Icone nome={cfg.mudas[i] ? "mudo" : "som"} tamanho={24} />
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

      <!-- Só volume e silenciar: vale na hora, também tocando. -->
      <button class="botao secundario" onclick={redefinirVozes}>{t("player.redefinir")}</button>
    </div>
  </details>

  <!-- Card 4: instrumentos de cada voz. -->
  <details class="cartao" name="cartoes-ouvir" bind:open={cartoes.instrumentos}>
    <summary>
      <span>{t("player.instrumentos")}</span>
      <span class="direita"><span class="resumo">{resumoInstrumentos}</span><Icone nome={cartoes.instrumentos ? "fechar" : "abrir"} tamanho={24} /></span>
    </summary>
    <div class="corpo">
      {#each hino.vozes as v, i}
        {@const tipo = tipoDaVoz(v.nome)}
        {@const gravados = gravadosDaVoz(tipo)}
        {@const modoGravado = ehRealista(cfg.instrumentos[i])}
        <div class="inst-linha">
          <span id={`inst-voz-${i}`}>{nomeVoz(v.nome)}</span>
          <div class="inst-controles">
            <!-- Com algum som gravado instalado, cada voz escolhe o modo; a lista abaixo mostra só o que é do modo. -->
            {#if gravados.length > 0 || modoGravado}
              <div class="alternador" role="group" aria-labelledby={`inst-voz-${i}`}>
                <button
                  type="button"
                  class="alt"
                  aria-pressed={!modoGravado}
                  disabled={!editavel}
                  onclick={() => mudarModo(i, tipo, false)}
                >
                  {#if !modoGravado}<Icone nome="ok" tamanho={16} />{/if}{t("som.sintetizado")}
                </button>
                <button
                  type="button"
                  class="alt"
                  aria-pressed={modoGravado}
                  disabled={!editavel}
                  onclick={() => mudarModo(i, tipo, true)}
                >
                  {#if modoGravado}<Icone nome="ok" tamanho={16} />{/if}{t("som.gravado")}
                </button>
              </div>
            {/if}
            <select
              aria-label={t("player.instrumento", { voz: nomeVoz(v.nome) })}
              bind:value={cfg.instrumentos[i]}
              disabled={!editavel}
            >
              {#if modoGravado}
                {#each gravados as id}<option value={id}>{t(`inst.${id}`)}</option>{/each}
              {:else}
                <optgroup label={t("grupo.orgaos")}>
                  {#each ORGAOS as id}<option value={id}>{t(`inst.${id}`)}</option>{/each}
                </optgroup>
                <optgroup label={t("grupo.instrumentos")}>
                  {#each instrumentosDaVoz(v.nome) as id}<option value={id}>{t(`inst.${id}`)}</option>{/each}
                </optgroup>
              {/if}
            </select>
          </div>
        </div>
      {/each}

      <button class="botao secundario" disabled={!editavel} onclick={redefinirInstrumentos}>
        {t("player.redefinir_instrumentos")}
      </button>
    </div>
  </details>
</section>

<style>
  .player { display: grid; gap: 1rem; }
  .principal { display: flex; gap: 0.5rem; }
  .principal :global(.botao) { gap: 0.5rem; }
  .tocar { flex: 1; min-height: 56px; font-size: 1.15rem; }
  .parar { min-height: 56px; }
  .progresso { height: 8px; border-radius: 4px; background: var(--borda); overflow: hidden; }
  .preenchido { height: 100%; background: var(--ouro-linha); }
  .tempos { display: flex; justify-content: space-between; margin-top: 0.3rem; font-size: 0.85rem; color: var(--suave); font-variant-numeric: tabular-nums; }
  .dica { margin: 0; }

  .passo-linha { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
  .rotulo { font-size: 0.95rem; }
  .passo { display: flex; align-items: center; gap: 0.4rem; }
  .passo button {
    display: inline-flex; align-items: center; justify-content: center; padding: 0;
    width: 48px; height: 48px; font-size: 1.4rem; border-radius: 12px; line-height: 1; cursor: pointer;
    border: 1px solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
  .passo output { min-width: 6.5rem; text-align: center; font-variant-numeric: tabular-nums; }
  /* Andamento: rótulo em cima e os cinco itens (−5 −1 valor +1 +5) repartindo a largura toda. Botões de texto. */
  .passo-linha.andamento { flex-wrap: wrap; }
  .andamento .passo { flex: 1 1 100%; justify-content: space-between; }
  .andamento .passo button { flex: none; min-width: 48px; width: auto; padding: 0 0.5rem; font-size: 1.05rem; font-weight: 600; }
  .andamento .passo output { flex: 1; min-width: 0; }
  /* Botões compactos ("▶ Intro", "▶ 1ª", "▶ 3ª ⚑") que dividem a linha inteira. O que toca fica em destaque. */
  .vezes { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  /* Cada botão ocupa uma fatia igual da linha (flex: 1 1 0). Com muitas vezes (até 8 + Intro), quebram de linha e
     cada linha também se reparte por inteiro. */
  .vez { flex: 1 1 0; gap: 0.35rem; min-width: 48px; padding: 0 0.4rem; position: relative; overflow: hidden; }
  .rotulo-vez { display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; }
  /* A parte que soa: base normal (a cor do cartão) com borda dourada, e por cima o dourado enchendo da esquerda para a
     direita. As duas camadas têm o mesmo tamanho e o mesmo rótulo, e a de cima é recortada no quanto já passou, então o
     texto troca de cor exatamente na borda do preenchimento (escuro sobre o dourado, normal sobre o resto). */
  .vez.tocando { background: var(--superficie); color: var(--texto); }
  .enchimento {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    background: var(--ouro); color: var(--ouro-sobre); pointer-events: none;
  }

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

  /* Cards: o primeiro (Tocar) é fixo; os outros abrem e fecham. Um resumo na linha de cima mostra o estado fechado. */
  .cartao { border: 1px solid var(--borda-controle); border-radius: 12px; background: var(--superficie); }
  summary, .cabecalho {
    display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; min-height: 48px;
    padding: 0 0.9rem; font-weight: 600;
  }
  summary { cursor: pointer; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  .direita { display: inline-flex; align-items: center; gap: 0.4rem; min-width: 0; }
  .resumo { display: inline-flex; align-items: center; gap: 0.25rem; font-weight: 400; color: var(--suave); font-size: 0.9rem; text-align: end; }
  .corpo { display: grid; gap: 0.8rem; padding: 0.2rem 0.9rem 0.9rem; }
  /* minmax(0, 1fr) + largura limitada: sem isso, o nome mais longo ("Órgão de palhetas gravado (teste)") alarga o
     seletor e ele passa da borda do painel. */
  .inst-linha { display: grid; grid-template-columns: minmax(5.5rem, 8rem) minmax(0, 1fr); align-items: center; gap: 0.5rem; }
  .inst-controles { display: grid; gap: 0.4rem; min-width: 0; }
  /* Alternador Sintetizado | Gravado: o escolhido leva ✓ e negrito, além da cor. */
  .alternador { display: flex; border: 1px solid var(--borda-controle); border-radius: 12px; overflow: hidden; }
  .alt {
    flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; min-height: 44px;
    padding: 0 0.4rem; font-size: 0.95rem; border: 0; background: var(--superficie); color: var(--texto); cursor: pointer;
  }
  .alt + .alt { border-left: 1px solid var(--borda-controle); }
  .alt[aria-pressed="true"] { background: var(--acento); color: var(--acento-texto); font-weight: 700; }
  .alt:disabled { opacity: 0.5; cursor: not-allowed; }
  select {
    width: 100%; min-width: 0; max-width: 100%; text-overflow: ellipsis;
    min-height: 48px; font-size: 1rem; border-radius: 12px; padding: 0 0.5rem;
    border: 1px solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
  .secundario { background: transparent; font-size: 0.95rem; }
  button:disabled, select:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
