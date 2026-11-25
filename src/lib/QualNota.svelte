<script lang="ts">
  import { onMount } from "svelte";
  import Aviso from "./Aviso.svelte";
  import Cartao from "./Cartao.svelte";
  import Icone from "./Icone.svelte";
  import { DESLOCAMENTO_ESCRITO, classeDe, palavraDeAfinacao, posicaoNaTrilha, type Transposicao } from "./afinador";
  import { lerInstrumento, salvarInstrumento } from "./afinadorPrefs";
  import { Estabilizador, type Estado } from "./detector";
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
  const INSTRUMENTOS: Transposicao[] = ["concerto", "si_bemol", "mi_bemol", "fa"];

  const escuta = new Escuta();
  const estabilizador = new Estabilizador();
  /** Começa fechado, como os outros cartões da aba (o resumo mostra a nota enquanto ouve). */
  let aberto = $state(false);
  let estado = $state<Estado>({ tipo: "silencio" });
  let erro = $state<"negada" | "sem_microfone" | "falhou" | "gravando" | null>(null);
  let instrumento = $state<Transposicao>("concerto");
  let ultimoSom = 0;
  let tentativa = 0;

  onMount(() => {
    instrumento = lerInstrumento();
  });

  function parar() {
    tentativa++;
    escuta.parar();
    estabilizador.reiniciar();
    estado = { tipo: "silencio" };
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
    ultimoSom = performance.now();
    ouvindo = true;
    try {
      await escuta.iniciar((bruta) => {
        const agora = performance.now();
        estado = estabilizador.entrar(agora, bruta);
        if (estado.tipo !== "silencio") ultimoSom = agora;
        else if (agora - ultimoSom > SEM_SOM_MAX_MS) parar(); // esquecida ligada: solta o microfone
      });
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
  // O pai desligou `ouvindo` (o tom de referência começou): solta o microfone.
  $effect(() => {
    if (!ouvindo && escuta.ligada) parar();
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
  const hz = (f: number) => new Intl.NumberFormat(i18n.idioma, { maximumFractionDigits: f >= 100 ? 0 : 1 }).format(f);

  const lida = $derived(estado.tipo === "silencio" ? null : estado);
  const desl = $derived(DESLOCAMENTO_ESCRITO[instrumento]);
  /** A nota que a pessoa lê (a que soa, somada à transposição do instrumento). */
  const escrita = $derived(lida ? lida.leitura.midi + desl : null);
  const cents = $derived(lida ? Math.round(lida.leitura.cents) : 0);
  const palavra = $derived(lida ? palavraDeAfinacao(lida.leitura.cents) : null);
  const posicao = $derived(lida ? posicaoNaTrilha(lida.leitura.cents) : 0);
  const textoCents = $derived(lida ? `${cents > 0 ? "+" : cents < 0 ? "−" : ""}${Math.abs(cents)} ${t("afinador.cents")}` : "");
  const resumo = $derived(ouvindo ? (escrita !== null ? nome(escrita) : t("afinador.escutando")) : "");

  // O leitor de tela: o nome por extenso e a palavra, no máximo uma vez por segundo e só quando mudam.
  let anuncio = $state("");
  let anunciadoEm = 0;
  $effect(() => {
    const novo = escrita !== null && palavra ? `${porExtenso(escrita)}, ${t(`afinador.${palavra}`)}` : "";
    const agora = performance.now();
    if (novo && novo !== anuncio && agora - anunciadoEm >= 1000) {
      anuncio = novo;
      anunciadoEm = agora;
    }
    if (!novo && !ouvindo) anuncio = "";
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
      <div class="nome" aria-hidden="true">{escrita !== null ? nome(escrita) : "—"}</div>
      {#if lida && instrumento !== "concerto"}<div class="soa meta">{t("afinador.soa", { nota: nome(lida.leitura.midi) })}</div>{/if}
      <div
        class="medidor"
        role="meter"
        aria-label={t("afinador.qual_nota")}
        aria-valuemin={-50}
        aria-valuemax={50}
        aria-valuenow={lida ? Math.max(-50, Math.min(50, cents)) : undefined}
        aria-valuetext={lida && escrita !== null ? t("afinador.valor_texto", { cents: textoCents, nota: porExtenso(escrita) }) : t("afinador.toque")}
      >
        <div class="vizinhas" aria-hidden="true">
          <span>{escrita !== null ? nome(escrita - 1) : ""}</span>
          <span>{escrita !== null ? nome(escrita + 1) : ""}</span>
        </div>
        <div class="trilha" aria-hidden="true">
          <span class="faixa"></span>
          {#if lida}<span class="bola" style:left={`${50 + posicao * 50}%`}></span>{/if}
        </div>
      </div>
      <div class="detalhe" aria-hidden="true">
        {#if lida && palavra}<strong>{t(`afinador.${palavra}`)}</strong> · {textoCents} · {hz(lida.freq)} Hz{:else}{t("afinador.toque")}{/if}
      </div>
    </div>
    <p class="meta">{t("afinador.microfone_ligado")}</p>
  {:else}
    <p class="meta">{t("afinador.privacidade")}</p>
  {/if}

  <fieldset class="instrumentos">
    <legend class="meta">{t("afinador.instrumento")}</legend>
    {#each INSTRUMENTOS as i (i)}
      <label class:ativo={instrumento === i}>
        <input
          type="radio"
          name="instrumento"
          value={i}
          checked={instrumento === i}
          onchange={() => {
            instrumento = i;
            salvarInstrumento(i);
          }}
        />
        <span>{#if instrumento === i}<Icone nome="ok" tamanho={16} />{/if}{t(`afinador.inst_${i}`)}</span>
      </label>
    {/each}
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
  .instrumentos { display: grid; gap: 0.4rem; margin: 0; padding: 0; border: 0; }
  .instrumentos label { position: relative; }
  .instrumentos input { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
  .instrumentos span { display: flex; align-items: center; gap: 0.25rem; min-height: 3rem; box-sizing: border-box; padding: 0.3rem 0.75rem; border-radius: 0.75rem; border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto); line-height: 1.25; }
  .instrumentos .ativo span { border: 0.125rem solid var(--acento); font-weight: 700; }
  .instrumentos input:focus-visible + span { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; }
</style>
