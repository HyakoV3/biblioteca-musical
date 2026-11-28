<script lang="ts">
  import { onMount, untrack } from "svelte";
  import Aviso from "./Aviso.svelte";
  import Cartao from "./Cartao.svelte";
  import Icone from "./Icone.svelte";
  import ListaRecentes from "./ListaRecentes.svelte";
  import QualNota from "./QualNota.svelte";
  import { LA_PADRAO, OITAVA_MAX, OITAVA_MIN, OITAVA_PADRAO, frequenciaDe, limitarOitava, midiDe, type Transposicao } from "./afinador";
  import { nomeDaNota, nomeDaNotaPorExtenso } from "./notacao";
  import { notacao } from "./notacao.svelte";
  import { adicionarNota, lerAfinador, salvarAfinador, type NotaRecente } from "./afinadorPrefs";
  import Segmentado from "./Segmentado.svelte";
  import { Contagem, LIMITES, fracaoFeita, type Limite } from "./contagem";
  import { i18n } from "./i18n/index.svelte";
  import { reproducao } from "./reproducao.svelte";
  import { TomSustentado } from "./tom";

  // A aba Afinador (I-13, etapa 1: dar o tom). Toca uma nota de referência SUSTENTADA: o Lá 440 ou uma nota escolhida, até a pessoa apertar de
  // novo. Não usa microfone nem pede permissão. O som tem contexto de áudio próprio (ver `tom.ts`) e é um de cada vez: dar o tom para o hino
  // que estiver tocando, e o hino que começar cala o tom. `ativa` diz se a aba está à vista: ao sair dela o som para e o áudio é devolvido.
  // Sem controle de volume na tela: quem ajusta é o volume de mídia do celular, pelos botões físicos. "Outra nota" fica num cartão fechado:
  // quem quiser a abre e escolhe a nota e a oitava; o Play dela fica na ponta da linha (a "pílula"), sempre à vista, e fechar o cartão não para o som. O cartão "Temporizador" (fechado, não lembrado) faz o tom parar sozinho depois de 10, 20 ou
  // 30 segundos; o padrão é "até parar", o de sempre. Vale para o Lá e para a outra nota, e a contagem recomeça a cada nota nova.
  let { ativa }: { ativa: boolean } = $props();

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const tom = new TomSustentado();

  let classe = $state(0); // a nota escolhida (0 = Dó … 11 = Si)
  let oitava = $state(OITAVA_PADRAO);
  /** O cartão "Outra nota" começa fechado e não é lembrado. */
  let outraAberta = $state(false);
  /** O tom do instrumento escolhido em "Qual nota é essa?" (ligado ao cartão dele). Se transpõe (Si♭, Mi♭ ou Fá), o tom de "Outra nota" é o som real (concerto), e não a nota escrita no instrumento. */
  let instrumento = $state<Transposicao>("concerto");
  const instrumentoTranspoe = $derived(instrumento !== "concerto");
  /** O cartão "Temporizador" começa fechado e não é lembrado; o TEMPO escolhido (até parar, 10, 20 ou 30 s) é lembrado neste aparelho. */
  let temporizadorAberto = $state(false);
  let limite = $state<Limite>(0);
  /** Segundos que faltam para o tom parar sozinho, ou nulo sem contagem (até parar, ou nada tocando). */
  let restante = $state<number | null>(null);
  /** O último tom parou por causa do temporizador: o leitor de tela é avisado (a tela já voltou ao botão de tocar). */
  let encerrou = $state(false);
  const contagem = new Contagem(
    (r) => (restante = r),
    () => {
      encerrou = true;
      parar();
    },
  );
  /** O que está soando: o Lá 440, a nota escolhida, ou nada. */
  let tocando = $state<"la" | "nota" | null>(null);
  /** A escuta do microfone ("Qual nota é essa?") está ligada. Um som de cada vez: tocar um tom a desliga, e ouvir cala o tom. */
  let ouvindo = $state(false);
  /** As últimas notas dadas em "Outra nota" (a mais recente no topo), lembradas neste aparelho. */
  let recentes = $state<NotaRecente[]>([]);
  onMount(() => {
    const p = lerAfinador();
    recentes = p.recentes;
    limite = p.limite;
  });
  function registrarNota() {
    recentes = adicionarNota(recentes, { classe, oitava });
    salvarAfinador({ recentes, limite });
  }
  /** Toca uma nota da lista de recentes: escolhe a nota e a oitava e liga o tom (um som de cada vez, como no botão da pílula). */
  async function usarRecente(n: NotaRecente) {
    classe = n.classe;
    oitava = n.oitava;
    registrarNota();
    reproducao.parar();
    ouvindo = false;
    await soar("nota", frequenciaDe(midiDe(n.classe, n.oitava), LA_PADRAO));
  }
  const rotuloRecente = (n: NotaRecente) => `${nomeDaNota(n.classe, i18n.idioma, notacao.atual)}${n.oitava} · ${hz(frequenciaDe(midiDe(n.classe, n.oitava), LA_PADRAO))} Hz`;

  /** O áudio não pôde iniciar (indisponível ou bloqueado neste aparelho): a tela avisa, em vez de o botão voltar sem explicação. */
  let erroAudio = $state(false);
  /** Numera os pedidos de som: uma falha só apaga o estado se nenhum pedido mais novo (nem uma parada) veio depois dela. */
  let tentativa = 0;

  const midi = $derived(midiDe(classe, oitava));
  const freqNota = $derived(frequenciaDe(midi, LA_PADRAO));
  const nomeNota = $derived(`${nomeDaNota(classe, i18n.idioma, notacao.atual)}${oitava}`);
  const hz = (f: number) => new Intl.NumberFormat(i18n.idioma, { maximumFractionDigits: f >= 100 ? 0 : 1 }).format(f);
  const rotuloLa = $derived(`${nomeDaNota(9, i18n.idioma, notacao.atual)} ${hz(LA_PADRAO)} Hz`);
  const grave = $derived(oitava < 3);

  function parar() {
    tentativa++;
    contagem.cancelar();
    tom.parar();
    tocando = null;
  }

  /** Sai de cena: para o som e DEVOLVE o áudio ao aparelho (fecha o contexto; ligar de novo cria outro). */
  function sair() {
    tentativa++;
    contagem.cancelar();
    tom.fechar();
    tocando = null;
  }

  /** Pede o som. Nunca rejeita: uma falha vai para o console e para a tela, e só apaga o estado se este ainda é o pedido mais novo. */
  async function soar(qual: "la" | "nota", freq: number) {
    const minha = ++tentativa;
    erroAudio = false;
    encerrou = false;
    contagem.cancelar(); // a contagem da nota anterior não pode terminar no meio da troca
    tocando = qual;
    try {
      await tom.tocar(freq);
      if (minha === tentativa) contagem.iniciar(limite); // a contagem começa quando o tom começa de fato, e recomeça a cada nota nova
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
    ouvindo = false; // e a escuta do microfone não ouviria o próprio tom
    if (qual === "nota") registrarNota(); // só entra nos recentes a nota pedida de propósito (como no metrônomo): trocar de nota ou de oitava com o tom soando não registra
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

  // Mudar o tempo com o tom soando vale a partir de agora ("até parar" cancela a contagem).
  $effect(() => {
    void limite;
    untrack(() => {
      if (tocando) contagem.iniciar(limite);
    });
  });
  // O som para ao sair da aba, ao ir para segundo plano e quando o hino começa; ao fechar a tela, o áudio é devolvido ao aparelho.
  $effect(() => {
    if (!ativa) sair();
  });
  $effect(() => {
    if (reproducao.estado === "tocando") parar();
  });
  $effect(() => {
    const aoEsconder = () => {
      if (document.hidden) sair();
    };
    document.addEventListener("visibilitychange", aoEsconder);
    return () => {
      document.removeEventListener("visibilitychange", aoEsconder);
      contagem.cancelar();
      tom.fechar();
    };
  });
</script>

{#snippet rotuloParar()}
  <!-- Um só trecho de texto (sem os espaços que o Svelte tira do começo de um <span>): "Parar · faltam 14 s". A contagem fica escondida do leitor de tela
       (o nome do botão segue sendo "Parar" e a contagem não é lida segundo a segundo); só o fim é avisado, no texto de status. -->
  <span>{t("audio.parar")}{#if restante !== null}<span aria-hidden="true">{` · ${t("afinador.faltam", { n: restante })}`}</span>{/if}</span>
  <!-- A barra de progresso: um fio na borda de baixo do botão que cresce da esquerda para a direita, em passos de 1 s (só `width`, sem transição: assim
       já respeita "reduzir movimento"). Decorativa: o leitor de tela não a lê. -->
  {#if restante !== null}<span class="barra" aria-hidden="true" style:width={`${fracaoFeita(limite, restante) * 100}%`}></span>{/if}
{/snippet}

<div class="afinador">
  <button class="botao primario grande" aria-pressed={tocando === "la"} onclick={() => alternar("la")}>
    <Icone nome={tocando === "la" ? "stop" : "play"} tamanho={24} />
    {#if tocando === "la"}{@render rotuloParar()}{:else}{rotuloLa}{/if}
  </button>
  {#if erroAudio}<Aviso tipo="erro">{t("player.erro_audio")}</Aviso>{/if}

  <!-- A pílula: o cartão "Outra nota" (nota e frequência na linha de cima) e, na ponta dela, o Play da nota escolhida. O Play fica sempre à vista, com o
       cartão aberto ou fechado: quem usa muito uma nota que não é o Lá a deixa marcada aqui e toca com um toque. -->
  <div class="pilula">
  <Cartao titulo={t("afinador.outra_nota")} resumo={`${nomeNota} · ${hz(freqNota)} Hz`} bind:aberto={outraAberta} grade>
    {#if instrumentoTranspoe}<p class="meta som-real" id="som-real">{t("afinador.som_real")}</p>{/if}
    <fieldset class="opcoes" aria-label={t("afinador.outra_nota")}>
      {#each Array.from({ length: 12 }, (_, n) => n) as n (n)}
        <label class:ativo={classe === n}>
          <input
            type="radio"
            name="nota"
            value={n}
            checked={classe === n}
            aria-label={nomeDaNotaPorExtenso(n, i18n.idioma, notacao.atual)}
            onchange={() => escolherNota(n)}
          />
          <span>{#if classe === n}<Icone nome="ok" tamanho={16} />{/if}{nomeDaNota(n, i18n.idioma, notacao.atual)}</span>
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
  </Cartao>
    <button
      class="tocar-pilula"
      class:fechada={!outraAberta}
      aria-pressed={tocando === "nota"}
      aria-label={tocando === "nota" ? t("audio.parar") : t("afinador.tocar_nota", { nota: nomeNota })}
      title={tocando === "nota" ? t("audio.parar") : t("afinador.tocar_nota", { nota: nomeNota })}
      onclick={() => alternar("nota")}
    >
      <Icone nome={tocando === "nota" ? "stop" : "play"} tamanho={24} />
      {#if tocando === "nota" && restante !== null}<span class="resta" aria-hidden="true">{restante} s</span>{/if}
      {#if tocando === "nota" && restante !== null}<span class="barra" aria-hidden="true" style:width={`${fracaoFeita(limite, restante) * 100}%`}></span>{/if}
    </button>
  </div>

  <Cartao id="cartao-temporizador" titulo={t("afinador.temporizador")} resumo={limite === 0 ? t("afinador.desligado") : `${limite} s`} bind:aberto={temporizadorAberto} grade>
    <p class="meta" id="rotulo-limite">{t("afinador.parar_sozinho")}</p>
    <fieldset class="tempos" aria-labelledby="rotulo-limite">
      <Segmentado
        nome="limite"
        valor={limite}
        opcoes={LIMITES.map((l) => ({ valor: l, rotulo: l === 0 ? t("afinador.desligado") : `${l} s`, aria: l === 0 ? t("afinador.ate_parar") : t("afinador.segundos", { n: l }) }))}
        aoEscolher={(l) => {
          limite = l;
          salvarAfinador({ recentes, limite });
        }}
      />
    </fieldset>
    <p class="meta">{t("afinador.temporizador_vale")}</p>
  </Cartao>

  <QualNota {ativa} bind:ouvindo bind:instrumento aoComecar={parar} />

  <ListaRecentes
    titulo={t("afinador.recentes")}
    itens={recentes}
    rotulo={rotuloRecente}
    atual={(n) => n.classe === classe && n.oitava === oitava}
    aoEscolher={usarRecente}
    {ativa}
  />

  <!-- Só para o leitor de tela: o que está soando (o texto muda ao ligar, desligar ou trocar de nota). -->
  <p class="so-leitor" role="status">
    {#if tocando === "la"}{t("afinador.tocando", { nota: nomeDaNota(9, i18n.idioma, notacao.atual) + "4", hz: hz(LA_PADRAO) })}{:else if tocando === "nota"}{t("afinador.tocando", { nota: nomeNota, hz: hz(freqNota) })}{:else if encerrou}{t("afinador.encerrou")}{/if}
  </p>
</div>

<style>
  .afinador { display: grid; gap: var(--espaco-g); }
  .afinador > p { margin: 0; }
  .grande { position: relative; overflow: hidden; min-height: var(--toque-grande); font-size: 1.15rem; gap: var(--espaco); }
  /* O fio de progresso do temporizador, na borda de baixo do botão (a cor do texto do botão, um pouco apagada). */
  .barra { position: absolute; left: 0; bottom: 0; height: 0.3125rem; background: var(--acento-texto); opacity: 0.75; }

  /* As 12 notas e as 4 opções de tempo: botões de rádio (teclado e leitor de tela de graça); a escolhida leva "✓", negrito e borda de acento (não só cor). */
  .opcoes { display: grid; grid-template-columns: repeat(auto-fit, minmax(var(--minimo, 4.5rem), 1fr)); gap: 0.4rem; margin: 0; padding: 0; border: 0; }
  .tempos { margin: 0; padding: 0; border: 0; min-width: 0; }
  .opcoes label { position: relative; }
  .opcoes input { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
  .opcoes span {
    display: flex; align-items: center; justify-content: center; gap: var(--espaco-p); min-height: var(--toque); box-sizing: border-box;
    padding: 0 0.4rem; border-radius: var(--raio); font-size: 1rem;
    border: var(--borda-padrao); background: var(--superficie); color: var(--texto);
  }
  .opcoes .ativo span { border: var(--borda-destaque); font-weight: 700; }
  .opcoes input:focus-visible + span { outline: var(--anel-foco); outline-offset: var(--anel-foco-recuo); }

  /* A pílula: o Play fica na ponta da linha de cima do cartão; o título fica à esquerda da divisória e o sinal de abrir e fechar vem antes dela. O botão COBRE a borda do cartão nesse trecho
     (começa em 0, e não a 1px dentro dela) e leva a MESMA borda e o MESMO raio externo (0,75rem): assim ele encosta no topo, na direita e na divisória em qualquer densidade de tela e tamanho de
     letra. Antes ele ficava a 0,0625rem da borda, e em alguns aparelhos esse 1px e a borda arredondavam para valores diferentes, deixando uma faixa clara entre os dois. */
  .pilula { position: relative; }
  .pilula :global(summary) { padding-inline-end: 4.75rem; }
  .tocar-pilula {
    position: absolute; inset: 0 0 auto auto; width: calc(4.5rem + 0.0625rem); height: calc(3rem + 0.0625rem); box-sizing: border-box; overflow: hidden;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.05rem; padding: 0;
    border: var(--borda-padrao); border-bottom: 0; border-radius: 0 0.75rem 0 0;
    background: var(--acento); color: var(--acento-texto); cursor: pointer; font: inherit;
  }
  /* O triângulo do Play ocupa de 8 a 19 na caixa de 24 do ícone: o centro dele cai 1,5 px à direita do centro da caixa. Recuar 1 px o põe no meio do botão. */
  .tocar-pilula :global(.icone) { translate: -0.0625rem 0; }
  /* Fechado, o botão cobre a altura toda do cartão (a borda de baixo também). */
  .tocar-pilula.fechada { height: calc(3rem + 0.125rem); border-bottom: 0.0625rem solid var(--borda-controle); border-radius: 0 0.75rem 0.75rem 0; }
  .tocar-pilula:focus-visible { outline: var(--anel-foco); outline-offset: -0.25rem; }
  .resta { font-size: 0.75rem; line-height: 1; font-variant-numeric: tabular-nums; }

  .linha { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem 1rem; }
  .oitava { display: flex; align-items: center; gap: var(--espaco); }
  .valor-oitava { min-width: 4.5rem; text-align: center; }
  .freq { font-variant-numeric: tabular-nums; font-weight: 600; }
</style>
