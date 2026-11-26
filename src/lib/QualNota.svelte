<script lang="ts">
  import { onMount } from "svelte";
  import Aviso from "./Aviso.svelte";
  import Cartao from "./Cartao.svelte";
  import Icone from "./Icone.svelte";
  import { DESLOCAMENTO_ESCRITO, classeDe, palavraDeAfinacao, posicaoNaTrilha, type Transposicao } from "./afinador";
  import { lerInstrumento, salvarInstrumento } from "./afinadorPrefs";
  import { Estabilizador, type Estado } from "./detector";
  import { SuavizadorDeCents, type Suave } from "./suavizador";
  import { Escuta } from "./escuta";
  import { emCurso } from "./gravacaoEmCurso.svelte";
  import { i18n } from "./i18n/index.svelte";
  import { nomeDaNota, nomeDaNotaPorExtenso } from "./notacao";
  import { notacao } from "./notacao.svelte";
  import { reproducao } from "./reproducao.svelte";

  // "Qual nota é essa?" (I-35): o app ouve o microfone e diz a nota que está soando, com os cents e as duas vizinhas (a de baixo e a de cima). O microfone só abre no toque em "Ouvir" e fecha
  // ao parar, ao sair da aba, ao ir para segundo plano, quando um hino começa, quando o Gravador começa a gravar e depois de 2 minutos sem som. Nada é gravado e nada sai do aparelho. Um som de cada vez:
  // ouvir cala o tom de referência (`aoComecar`) e o tom, ao começar, desliga esta escuta (o pai muda `ouvindo`). Instrumento que transpõe: a nota mostrada é a que a pessoa LÊ na partitura
  // (a trompete em Si♭ que soa Sol lê Lá); a que soa fica numa linha pequena.
  let { ativa, ouvindo = $bindable(false), aoComecar }: { ativa: boolean; ouvindo?: boolean; aoComecar: () => void } = $props();

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const SEM_SOM_MAX_MS = 120_000;
  /** Os 4 botões de tom, na ordem da tela (2 por linha): a nota de cada um (Dó, Si♭, Mi♭, Fá) e o que cada uma é. */
  const TONS: { id: Transposicao; classe: number }[] = [
    { id: "concerto", classe: 0 },
    { id: "si_bemol", classe: 10 },
    { id: "mi_bemol", classe: 3 },
    { id: "fa", classe: 5 },
  ];

  const escuta = new Escuta();
  const estabilizador = new Estabilizador();
  /** A posição da bola e o número calmos (I-41): o `estabilizador` diz qual nota é, este acalma onde a bola fica. */
  const suavizador = new SuavizadorDeCents();
  /** Começa fechado, como os outros cartões da aba (o resumo mostra a nota enquanto ouve). */
  let aberto = $state(false);
  let estado = $state<Estado>({ tipo: "silencio" });
  let suave = $state<Suave | null>(null);
  let erro = $state<"negada" | "sem_microfone" | "falhou" | "gravando" | null>(null);
  let instrumento = $state<Transposicao>("concerto");
  /** Os instrumentos do tom escolhido (só informativos: o app guarda o tom, e não o instrumento), um por linha, em duas colunas quando cabe. */
  const instrumentosDoTom = $derived(t(`afinador.lista_${instrumento}`).split("|"));
  let ultimoSom = 0;
  let tentativa = 0;

  onMount(() => {
    instrumento = lerInstrumento();
  });

  function parar() {
    tentativa++;
    escuta.parar();
    estabilizador.reiniciar();
    suavizador.reiniciar();
    estado = { tipo: "silencio" };
    suave = null;
    ouvindo = false;
  }

  async function iniciar() {
    if (emCurso.gravando) {
      erro = "gravando"; // dois microfones abertos ao mesmo tempo esbarram no WebView: na v1 não se ouve enquanto grava
      return;
    }
    const minha = ++tentativa;
    erro = null;
    reproducao.parar();
    aoComecar();
    estabilizador.reiniciar();
    suavizador.reiniciar();
    ultimoSom = performance.now();
    ouvindo = true;
    try {
      await escuta.iniciar(
        (bruta) => {
          const agora = performance.now();
          estado = estabilizador.entrar(agora, bruta);
          suave = suavizador.entrar(agora, estado);
          if (estado.tipo !== "silencio") ultimoSom = agora;
          else if (agora - ultimoSom > SEM_SOM_MAX_MS) parar(); // esquecida ligada: solta o microfone
        },
        () => {
          // o sistema tirou o microfone: não fica "ouvindo" sem ouvir
          if (minha !== tentativa) return;
          parar();
          erro = "falhou";
        },
      );
      if (minha === tentativa) ultimoSom = performance.now(); // o relógio dos 2 min começa quando o microfone abre, e não no pedido de permissão
    } catch (e) {
      console.warn("afinador: não foi possível ouvir", e);
      if (minha !== tentativa) return;
      parar();
      erro = e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "negada" : e instanceof DOMException && (e.name === "NotFoundError" || e.name === "NotSupportedError") ? "sem_microfone" : "falhou";
    }
  }

  // O microfone fecha ao sair da aba, ao ir para segundo plano, quando um hino começa e quando o Gravador começa.
  $effect(() => {
    if (!ativa && ouvindo) parar();
  });
  $effect(() => {
    if (ouvindo && reproducao.estado === "tocando") parar();
  });
  $effect(() => {
    if (ouvindo && emCurso.gravando) {
      parar();
      erro = "gravando";
    }
  });
  // `ouvindo` desligado (o pai, porque o tom de referência começou, ou esta tela): solta o microfone. Sempre, e não só com a escuta já ligada: `parar()` é idempotente e cancela um
  // pedido que ainda espera a permissão (senão o microfone abriria depois, com a tela em "Ouvir").
  $effect(() => {
    if (!ouvindo) parar();
  });
  $effect(() => {
    const aoEsconder = () => {
      if (document.hidden && ouvindo) parar();
    };
    document.addEventListener("visibilitychange", aoEsconder);
    return () => {
      document.removeEventListener("visibilitychange", aoEsconder);
      escuta.parar();
    };
  });

  const oitavaDe = (m: number) => Math.floor(m / 12) - 1;
  const nome = (m: number) => `${nomeDaNota(classeDe(m), i18n.idioma, notacao.atual)}${oitavaDe(m)}`;
  const porExtenso = (m: number) => `${nomeDaNotaPorExtenso(classeDe(m), i18n.idioma, notacao.atual)} ${oitavaDe(m)}`;
  // Com um tom que transpõe a pessoa lê o NOME da nota: o número da oitava mudaria de instrumento para instrumento (o sax tenor lê uma oitava abaixo do trompete), então some. Em Dó (concerto) fica.
  const nomeEscrito = (m: number) => (instrumento === "concerto" ? nome(m) : nomeDaNota(classeDe(m), i18n.idioma, notacao.atual));
  const extensoEscrito = (m: number) => (instrumento === "concerto" ? porExtenso(m) : nomeDaNotaPorExtenso(classeDe(m), i18n.idioma, notacao.atual));
  const hz = (f: number) => new Intl.NumberFormat(i18n.idioma, { maximumFractionDigits: f >= 100 ? 0 : 1 }).format(f);

  const lida = $derived(estado.tipo === "silencio" ? null : estado);
  const desl = $derived(DESLOCAMENTO_ESCRITO[instrumento]);
  /** A nota que a pessoa lê (a que soa, somada à transposição do instrumento). */
  const escrita = $derived(lida ? lida.leitura.midi + desl : null);
  // O número, a palavra, o `aria-valuenow` e o `aria-valuetext` vêm TODOS do valor calmo (o mesmo que a tela mostra); só a bola usa o suave contínuo.
  const cents = $derived(suave ? suave.mostrado : 0);
  const palavra = $derived(lida && suave ? palavraDeAfinacao(suave.mostrado) : null);
  const posicao = $derived(suave ? posicaoNaTrilha(suave.suave) : 0);
  const textoCents = $derived(lida ? `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${Math.abs(cents)} ${t("afinador.cents")}` : "");
  const resumo = $derived(ouvindo ? (escrita !== null ? nomeEscrito(escrita) : t("afinador.escutando")) : "");

  // O leitor de tela: o nome por extenso e a palavra, no máximo uma vez por segundo e só quando mudam.
  let anuncio = $state("");
  let anunciadoEm = 0;
  $effect(() => {
    const novo = escrita !== null && palavra ? `${extensoEscrito(escrita)}, ${t(`afinador.${palavra}`)}` : "";
    if (!novo) {
      if (!ouvindo) anuncio = "";
      return;
    }
    if (novo === anuncio) return;
    // No máximo uma vez por segundo, e o ÚLTIMO valor sempre chega: o anúncio é adiado pelo tempo que falta, em vez de ser perdido.
    const espera = Math.max(0, 1000 - (performance.now() - anunciadoEm));
    const id = setTimeout(() => {
      anuncio = novo;
      anunciadoEm = performance.now();
    }, espera);
    return () => clearTimeout(id);
  });
</script>

<Cartao titulo={t("afinador.qual_nota")} {resumo} bind:aberto grade>
  <button class="botao primario ouvir" aria-pressed={ouvindo} onclick={() => (ouvindo ? parar() : iniciar())}>
    <Icone nome={ouvindo ? "stop" : "play"} tamanho={24} />
    {ouvindo ? t("audio.parar") : t("afinador.ouvir")}
  </button>
  {#if erro}<Aviso tipo="erro">{t(`afinador.erro_${erro}`)}</Aviso>{/if}

  {#if ouvindo}
    <div class="leitura" class:esmaecida={estado.tipo !== "nota"}>
      <div class="nome" aria-hidden="true">{escrita !== null ? nomeEscrito(escrita) : "—"}</div>
      {#if lida && instrumento !== "concerto"}<div class="soa meta">{t("afinador.soa", { nota: nome(lida.leitura.midi) })}</div>{/if}
      <div
        class="medidor"
        role="meter"
        aria-label={t("afinador.qual_nota")}
        aria-valuemin={-50}
        aria-valuemax={50}
        aria-valuenow={lida ? Math.max(-50, Math.min(50, cents)) : undefined}
        aria-valuetext={lida && escrita !== null ? t("afinador.valor_texto", { cents: textoCents, nota: extensoEscrito(escrita) }) : t("afinador.toque")}
      >
        <div class="vizinhas" aria-hidden="true">
          <span>{escrita !== null ? nomeEscrito(escrita - 1) : ""}</span>
          <span>{escrita !== null ? nomeEscrito(escrita + 1) : ""}</span>
        </div>
        <div class="trilha" aria-hidden="true">
          <span class="faixa"></span>
          {#if lida}<span class="bola bola-afinador" style:left={`${50 + posicao * 50}%`}></span>{/if}
        </div>
      </div>
      <div class="detalhe" aria-hidden="true">
        {#if lida && palavra}<strong>{t(`afinador.${palavra}`)}</strong> · {textoCents} · {hz(lida.freq)} Hz{:else}{t("afinador.toque")}{/if}
      </div>
    </div>
    <p class="meta">{t("afinador.microfone_ligado")}</p>
  {/if}

  <fieldset class="instrumentos">
    <legend class="meta">{t("afinador.instrumento")}</legend>
    <div class="tons">
      {#each TONS as tom (tom.id)}
        <label class:ativo={instrumento === tom.id}>
          <input
            type="radio"
            name="instrumento"
            value={tom.id}
            checked={instrumento === tom.id}
            aria-label={nomeDaNotaPorExtenso(tom.classe, i18n.idioma, notacao.atual)}
            onchange={() => {
              instrumento = tom.id;
              salvarInstrumento(tom.id);
            }}
          />
          <span>{#if instrumento === tom.id}<Icone nome="ok" tamanho={16} />{/if}{nomeDaNota(tom.classe, i18n.idioma, notacao.atual)}</span>
        </label>
      {/each}
    </div>
    <ul class="lista-instrumentos" aria-label={t("afinador.neste_tom")}>
      {#each instrumentosDoTom as item (item)}
        {@const clave = item.match(/^(.*?) \[(fa|sol)\]$/)}
        <li>{clave ? clave[1] : item}{#if clave} <span class="clave" role="img" aria-label={t(`afinador.clave_${clave[2]}` as "afinador.clave_fa")}>{clave[2] === "fa" ? "\uE062" : "\uE050"}</span>{/if}</li>
      {/each}
    </ul>
  </fieldset>

  <p class="so-leitor" aria-live="polite">{anuncio}</p>
</Cartao>

<style>
  .ouvir { min-height: 3.5rem; font-size: 1.15rem; gap: 0.5rem; }
  .leitura { display: grid; gap: 0.5rem; text-align: center; }
  .esmaecida { opacity: 0.55; }
  .nome { font-size: 3.5rem; font-weight: 700; line-height: 1.1; font-variant-numeric: tabular-nums; }
  .soa { margin: 0; }
  .vizinhas { display: flex; justify-content: space-between; font-size: 1.1rem; }
  .trilha { position: relative; height: 2.5rem; }
  .trilha::before { content: ""; position: absolute; left: 0; right: 0; top: calc(50% - 0.0625rem); height: 0.125rem; background: var(--borda); }
  /* A faixa "afinado" (±5 cents de ±50): uma faixa mais grossa no centro (a forma diz "aqui", e não só a cor). */
  .faixa { position: absolute; left: 45%; width: 10%; top: calc(50% - 0.5rem); height: 1rem; border: 0.125rem solid var(--acento); border-radius: 0.25rem; box-sizing: border-box; }
  .bola { position: absolute; top: calc(50% - 0.75rem); width: 1.5rem; height: 1.5rem; margin-left: -0.75rem; box-sizing: border-box; border-radius: 50%; background: var(--ouro-linha); border: 0.125rem solid var(--texto); }
  .detalhe { font-variant-numeric: tabular-nums; }
  .instrumentos { display: grid; gap: 0.6rem; margin: 0; padding: 0; border: 0; }
  /* Os 4 tons em 2 por linha: [Dó] [Si♭] / [Mi♭] [Fá]. */
  .tons { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; }
  /* A lista de instrumentos do tom: uma por linha, em até 3 colunas (cada uma com pelo menos 9,5 rem): uma coluna em tela estreita ou com fonte grande, duas no celular em pé e três deitado. */
  .lista-instrumentos { margin: 0; padding: 0 0 0 1.1rem; columns: 9.5rem 3; column-gap: 1rem; }
  /* A clave vem da Leipzig (SMuFL: E050 = clave de sol, E062 = clave de fá), a mesma fonte das partituras; o @font-face aqui garante que ela carregue na tela inicial. */
  @font-face { font-family: "Leipzig"; src: url("./fonts/Leipzig.woff2") format("woff2"); font-display: swap; }
  .clave { font-family: "Leipzig", serif; font-size: 1.35em; line-height: 1; vertical-align: -0.15em; margin-left: 0.25em; }
  .lista-instrumentos li { break-inside: avoid; padding: 0.15rem 0; line-height: 1.3; }
  .instrumentos label { position: relative; }
  .instrumentos input { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
  .instrumentos span { display: flex; align-items: center; justify-content: center; gap: 0.25rem; min-height: 3rem; box-sizing: border-box; padding: 0.3rem 0.75rem; border-radius: 0.75rem; border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto); line-height: 1.25; }
  .instrumentos .ativo span { border: 0.125rem solid var(--acento); font-weight: 700; }
  .instrumentos input:focus-visible + span { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; }
</style>
