<script lang="ts">
  import { onDestroy } from "svelte";
  import Aviso from "./Aviso.svelte";
  import Icone from "./Icone.svelte";
  import { Gravador, formatarTamanho, formatarTempo, motivoDoErro, nomeDoFormato, type Gravacao, type MotivoDoErro } from "./gravador";
  import { i18n } from "./i18n/index.svelte";
  import { reproducao } from "./reproducao.svelte";

  // A aba Gravador (I-03, primeira versão): grava o microfone, ouve de volta e descarta. Nada sai do aparelho. A permissão de microfone é pedida só
  // ao tocar em "Gravar". Gravar para o hino que estiver tocando (o alto-falante entraria no microfone). O microfone é devolvido ao aparelho ao parar,
  // ao sair da aba e ao esconder o app. `ativa` diz se a aba está à vista.
  let { ativa }: { ativa: boolean } = $props();

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const gravador = new Gravador();

  let gravando = $state(false);
  /** Segundos gravados até agora (a tela só mostra; o tempo certo da gravação é o medido ao parar). */
  let decorrido = $state(0);
  let relogio: ReturnType<typeof setInterval> | null = null;
  let gravacao = $state<Gravacao | null>(null);
  let erro = $state<MotivoDoErro | null>(null);
  /** Numera os pedidos: uma resposta tardia do microfone não vale se a pessoa já mandou parar ou saiu da aba. */
  let tentativa = 0;

  const textoErro: Record<MotivoDoErro, Parameters<typeof i18n.t>[0]> = {
    negada: "gravador.erro_negada",
    sem_microfone: "gravador.erro_sem_microfone",
    indisponivel: "gravador.erro_indisponivel",
    falhou: "gravador.erro_falhou",
  };

  function pararRelogio() {
    if (relogio !== null) clearInterval(relogio);
    relogio = null;
  }

  function descartar() {
    if (gravacao) URL.revokeObjectURL(gravacao.url);
    gravacao = null;
  }

  async function iniciar() {
    const minha = ++tentativa;
    erro = null;
    descartar();
    reproducao.parar(); // um som de cada vez: o hino que tocava calaria dentro da gravação
    try {
      await gravador.iniciar();
    } catch (e) {
      if (minha === tentativa) erro = motivoDoErro(e);
      console.warn("gravador: não foi possível gravar", e);
      return;
    }
    if (minha !== tentativa) {
      gravador.soltar(); // a pessoa já saiu ou mandou parar enquanto o aparelho liberava o microfone
      return;
    }
    gravando = true;
    decorrido = 0;
    const comeco = performance.now();
    relogio = setInterval(() => (decorrido = (performance.now() - comeco) / 1000), 250);
  }

  async function parar() {
    tentativa++;
    pararRelogio();
    gravando = false;
    gravacao = await gravador.parar();
    if (!gravacao) erro = "falhou";
  }

  /** Sai de cena (outra aba): cancela um pedido de microfone que esperava, ou para a gravação, e DEVOLVE o microfone. O que já foi gravado fica. */
  async function sair() {
    if (!gravando) {
      tentativa++;
      gravador.soltar();
      return;
    }
    await parar();
  }

  async function alternar() {
    if (gravando) await parar();
    else await iniciar();
  }

  $effect(() => {
    if (!ativa) void sair();
  });
  // Um hino que começa a tocar com a gravação em curso: para a gravação (o alto-falante entraria nela).
  $effect(() => {
    if (reproducao.estado === "tocando" && gravando) void parar();
  });
  // App em segundo plano: para uma gravação EM CURSO e devolve o microfone. Um pedido de permissão que ainda espera NÃO é cancelado: o próprio
  // diálogo de permissão do Android esconde a página por um instante, e cancelar ali jogava fora o microfone que a pessoa acabava de permitir
  // (e a mensagem de "permissão negada").
  $effect(() => {
    const aoEsconder = () => {
      if (document.hidden && gravando) void parar();
    };
    document.addEventListener("visibilitychange", aoEsconder);
    return () => document.removeEventListener("visibilitychange", aoEsconder);
  });
  onDestroy(() => {
    pararRelogio();
    gravador.soltar();
    descartar();
  });
</script>

<div class="gravador">
  <p class="meta">{t("gravador.explica")}</p>
  {#if erro}<Aviso tipo="erro">{t(textoErro[erro])}</Aviso>{/if}

  <button id="gravar" class="botao primario grande" aria-pressed={gravando} onclick={alternar}>
    {#if gravando}
      <Icone nome="stop" tamanho={24} />
      <span>{t("gravador.parar")} · <span class="tempo" aria-hidden="true">{formatarTempo(decorrido)}</span></span>
    {:else}
      <span class="bolinha" aria-hidden="true"></span>
      <span>{t("gravador.gravar")}</span>
    {/if}
  </button>

  <!-- Só para o leitor de tela: começou e terminou (não anuncia o tempo segundo a segundo). -->
  <p class="so-leitor" role="status">{#if gravando}{t("gravador.gravando")}{:else if gravacao}{t("gravador.pronta", { tempo: formatarTempo(gravacao.segundos) })}{/if}</p>

  {#if gravacao}
    <section class="resultado" aria-labelledby="titulo-gravacao">
      <h2 id="titulo-gravacao">{t("gravador.sua_gravacao")}</h2>
      <audio id="ouvir-gravacao" controls src={gravacao.url}></audio>
      <p class="meta" id="info-gravacao">
        {formatarTempo(gravacao.segundos)} · {formatarTamanho(gravacao.bytes, i18n.idioma)} · {nomeDoFormato(gravacao.tipo)}
      </p>
      <button id="descartar" class="botao" onclick={descartar}>{t("gravador.descartar")}</button>
    </section>
  {/if}
  <p class="meta">{t("gravador.privacidade")}</p>
</div>

<style>
  .gravador { display: grid; gap: 1rem; }
  .gravador > p { margin: 0; }
  .grande { min-height: 3.5rem; font-size: 1.15rem; gap: 0.5rem; }
  /* O círculo de "gravar": desenhado em CSS (o conjunto de ícones do app não tem um); a cor não é o único sinal, o botão diz "Gravar". */
  .bolinha { width: 1.1rem; height: 1.1rem; border-radius: 50%; background: currentColor; flex: none; }
  .tempo { font-variant-numeric: tabular-nums; }
  .resultado { display: grid; gap: 0.6rem; padding: 0.9rem; border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie); }
  .resultado h2 { margin: 0; font-size: 1rem; }
  .resultado audio { width: 100%; }
  .resultado p { margin: 0; }
</style>
