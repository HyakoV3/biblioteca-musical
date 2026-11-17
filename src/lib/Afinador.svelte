<script lang="ts">
  import Aviso from "./Aviso.svelte";
  import Cartao from "./Cartao.svelte";
  import Icone from "./Icone.svelte";
  import { LA_PADRAO, OITAVA_MAX, OITAVA_MIN, OITAVA_PADRAO, frequenciaDe, limitarOitava, midiDe, nomeDaNota, nomeDaNotaPorExtenso } from "./afinador";
  import { i18n } from "./i18n/index.svelte";
  import { reproducao } from "./reproducao.svelte";
  import { TomSustentado } from "./tom";

  // A aba Afinador (I-13, etapa 1: dar o tom). Toca uma nota de referência SUSTENTADA: o Lá 440 ou uma nota escolhida, até a pessoa apertar de
  // novo. Não usa microfone nem pede permissão. O som tem contexto de áudio próprio (ver `tom.ts`) e é um de cada vez: dar o tom para o hino
  // que estiver tocando, e o hino que começar cala o tom. `ativa` diz se a aba está à vista: ao sair dela o som para e o áudio é devolvido.
  // Sem controle de volume na tela: quem ajusta é o volume de mídia do celular, pelos botões físicos. "Outra nota" fica num cartão fechado:
  // quem quiser a abre, escolhe a nota e a oitava e toca.
  let { ativa }: { ativa: boolean } = $props();

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const tom = new TomSustentado();

  let classe = $state(0); // a nota escolhida (0 = Dó … 11 = Si)
  let oitava = $state(OITAVA_PADRAO);
  /** O cartão "Outra nota" começa fechado e não é lembrado. */
  let outraAberta = $state(false);
  /** O que está soando: o Lá 440, a nota escolhida, ou nada. */
  let tocando = $state<"la" | "nota" | null>(null);
  /** O áudio não pôde iniciar (indisponível ou bloqueado neste aparelho): a tela avisa, em vez de o botão voltar sem explicação. */
  let erroAudio = $state(false);
  /** Numera os pedidos de som: uma falha só apaga o estado se nenhum pedido mais novo (nem uma parada) veio depois dela. */
  let tentativa = 0;

  const midi = $derived(midiDe(classe, oitava));
  const freqNota = $derived(frequenciaDe(midi, LA_PADRAO));
  const nomeNota = $derived(`${nomeDaNota(classe, i18n.idioma)}${oitava}`);
  const hz = (f: number) => new Intl.NumberFormat(i18n.idioma, { maximumFractionDigits: f >= 100 ? 0 : 1 }).format(f);
  const rotuloLa = $derived(t("afinador.la"));
  const grave = $derived(oitava < 3);

  function parar() {
    tentativa++;
    tom.parar();
    tocando = null;
  }

  /** Sai de cena: para o som e DEVOLVE o áudio ao aparelho (fecha o contexto; ligar de novo cria outro). */
  function sair() {
    tentativa++;
    tom.fechar();
    tocando = null;
  }

  /** Pede o som. Nunca rejeita: uma falha vai para o console e para a tela, e só apaga o estado se este ainda é o pedido mais novo. */
  async function soar(qual: "la" | "nota", freq: number) {
    const minha = ++tentativa;
    erroAudio = false;
    tocando = qual;
    try {
      await tom.tocar(freq);
    } catch (e) {
      console.warn("afinador: não foi possível tocar o tom", e);
      if (minha === tentativa) {
        tom.parar(); // uma troca de nota que falha não deixa a nota antiga soando com a tela em "parado"
        tocando = null;
        erroAudio = true;
      }
    }
  }

  /** Liga ou desliga uma das duas notas; ligar uma com a outra soando troca de nota. */
  async function alternar(qual: "la" | "nota") {
    if (tocando === qual) return parar();
    reproducao.parar(); // um som de cada vez: dar o tom para o hino que tocava (ou que ainda estava carregando)
    await soar(qual, qual === "la" ? LA_PADRAO : freqNota);
  }

  function escolherNota(n: number) {
    classe = n;
    if (tocando === "nota") void soar("nota", frequenciaDe(midiDe(n, oitava), LA_PADRAO));
  }

  function mudarOitava(delta: number) {
    const nova = limitarOitava(oitava + delta);
    if (nova === oitava) return;
    oitava = nova;
    if (tocando === "nota") void soar("nota", frequenciaDe(midiDe(classe, nova), LA_PADRAO));
  }

  // O som para ao sair da aba, ao ir para segundo plano e quando o hino começa; ao fechar a tela, o áudio é devolvido ao aparelho.
  $effect(() => {
    if (!ativa) sair();
  });
  $effect(() => {
    if (reproducao.estado === "tocando") parar();
  });
  // Fechar o cartão "Outra nota" com a nota soando a para: o botão de parar fica dentro dele e sumiria com o som ainda saindo.
  $effect(() => {
    if (!outraAberta && tocando === "nota") parar();
  });
  $effect(() => {
    const aoEsconder = () => {
      if (document.hidden) sair();
    };
    document.addEventListener("visibilitychange", aoEsconder);
    return () => {
      document.removeEventListener("visibilitychange", aoEsconder);
      tom.fechar();
    };
  });
</script>

<div class="afinador">
  <p class="meta">{t("afinador.explica")}</p>
  {#if erroAudio}<Aviso tipo="erro">{t("player.erro_audio")}</Aviso>{/if}

  <button class="botao primario grande" aria-pressed={tocando === "la"} onclick={() => alternar("la")}>
    <Icone nome={tocando === "la" ? "stop" : "play"} tamanho={24} />
    {tocando === "la" ? t("audio.parar") : rotuloLa}
  </button>

  <Cartao titulo={t("afinador.outra_nota")} resumo={`${nomeNota} · ${hz(freqNota)} Hz`} bind:aberto={outraAberta} grade>
    <fieldset class="notas" aria-label={t("afinador.outra_nota")}>
      {#each Array.from({ length: 12 }, (_, n) => n) as n (n)}
        <label class:ativo={classe === n}>
          <input
            type="radio"
            name="nota"
            value={n}
            checked={classe === n}
            aria-label={nomeDaNotaPorExtenso(n, i18n.idioma)}
            onchange={() => escolherNota(n)}
          />
          <span>{#if classe === n}<Icone nome="ok" tamanho={16} />{/if}{nomeDaNota(n, i18n.idioma)}</span>
        </label>
      {/each}
    </fieldset>

    <div class="linha">
      <div class="oitava" role="group" aria-label={t("afinador.oitava")}>
        <button class="botao-barra" aria-label={t("afinador.oitava_abaixo")} title={t("afinador.oitava_abaixo")} disabled={oitava <= OITAVA_MIN} onclick={() => mudarOitava(-1)}>
          <Icone nome="menos" tamanho={24} />
        </button>
        <span class="valor-oitava"><span class="meta">{t("afinador.oitava")}</span> <strong>{oitava}</strong></span>
        <button class="botao-barra" aria-label={t("afinador.oitava_acima")} title={t("afinador.oitava_acima")} disabled={oitava >= OITAVA_MAX} onclick={() => mudarOitava(1)}>
          <Icone nome="mais" tamanho={24} />
        </button>
      </div>
      <span class="freq">{nomeNota} · {hz(freqNota)} Hz</span>
    </div>
    {#if grave}<p class="meta">{t("afinador.aviso_grave")}</p>{/if}

    <button class="botao primario grande" aria-pressed={tocando === "nota"} onclick={() => alternar("nota")}>
      <Icone nome={tocando === "nota" ? "stop" : "play"} tamanho={24} />
      {tocando === "nota" ? t("audio.parar") : t("afinador.tocar_nota", { nota: nomeNota })}
    </button>
  </Cartao>

  <!-- Só para o leitor de tela: o que está soando (o texto muda ao ligar, desligar ou trocar de nota). -->
  <p class="so-leitor" role="status">
    {tocando === "la" ? t("afinador.tocando", { nota: nomeDaNota(9, i18n.idioma) + "4", hz: hz(LA_PADRAO) }) : tocando === "nota" ? t("afinador.tocando", { nota: nomeNota, hz: hz(freqNota) }) : ""}
  </p>
</div>

<style>
  .afinador { display: grid; gap: 1rem; }
  .afinador > p { margin: 0; }
  .grande { min-height: 3.5rem; font-size: 1.15rem; gap: 0.5rem; }

  /* As 12 notas: botões de rádio (teclado e leitor de tela de graça); a escolhida leva "✓", negrito e borda de acento (não só cor). */
  .notas { display: grid; grid-template-columns: repeat(auto-fit, minmax(4.5rem, 1fr)); gap: 0.4rem; margin: 0; padding: 0; border: 0; }
  .notas label { position: relative; }
  .notas input { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
  .notas span {
    display: flex; align-items: center; justify-content: center; gap: 0.25rem; min-height: 3rem; box-sizing: border-box;
    padding: 0 0.4rem; border-radius: 0.75rem; font-size: 1rem;
    border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
  .notas .ativo span { border: 0.125rem solid var(--acento); font-weight: 700; }
  .notas input:focus-visible + span { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; }

  .linha { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem 1rem; }
  .oitava { display: flex; align-items: center; gap: 0.5rem; }
  .valor-oitava { min-width: 4.5rem; text-align: center; }
  .freq { font-variant-numeric: tabular-nums; font-weight: 600; }
</style>
