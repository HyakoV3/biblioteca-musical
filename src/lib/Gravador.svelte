<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import Aviso from "./Aviso.svelte";
  import Icone from "./Icone.svelte";
  import ItemGravacao from "./ItemGravacao.svelte";
  import RuidoGravador from "./RuidoGravador.svelte";
  import FiltrosGravacoes from "./FiltrosGravacoes.svelte";
  import GravacaoNaoGuardada from "./GravacaoNaoGuardada.svelte";
  import { formatarTamanho, formatarTempo, type Gravacao, type MotivoDoErro } from "./gravador";
  import { gravacoes, type MetaGravacao } from "./gravacoes";
  import { PAGINA, SEM_FILTRO, agrupar, filtrar, janela, resumir, type Consulta, type Grupo } from "./organizar";
  import { i18n } from "./i18n/index.svelte";
  import { emCurso, type Resultado } from "./gravacaoEmCurso.svelte";
  import { reproducao } from "./reproducao.svelte";
  import { type FiltroDeRuido } from "./filtroDeRuido";
  import { lerFiltroDeRuido, salvarFiltroDeRuido } from "./preferencias";
  import { criarChaveDe } from "./gravadorChave";
  import { focarItem } from "./gravadorFoco";
  import { ListaDeGravacoes } from "./gravadorLista.svelte";
  import { calcularFixadas, montarLinhas, ordemDaTela, rotuloDoGrupo, type Fixada } from "./gravadorLinhas";

  // A aba Gravador (I-03, primeira versão): grava o microfone, ouve de volta e descarta. Nada sai do aparelho. A permissão de microfone é pedida só
  // ao tocar em "Gravar". Gravar para o hino que estiver tocando (o alto-falante entraria no microfone). O microfone é devolvido ao aparelho ao parar,
  // ao sair da aba e ao esconder o app. `ativa` diz se a aba está à vista.
  let { ativa }: { ativa: boolean } = $props();

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  // O ciclo de vida da gravação mora em `gravacaoEmCurso.svelte.ts` (ele segue vivo mesmo sem esta tela); aqui só se mostra o estado dele.
  const gravando = $derived(emCurso.gravando);
  const decorrido = $derived(emCurso.decorrido);
  const nivel = $derived(emCurso.nivel);
  const ouviu = $derived(emCurso.ouviu);
  const semSom = $derived(emCurso.semSom);
  // "Reduzir ruído" (I-29): desligado, o filtro do Android ou uma rede neural (RNNoise, GTCRN); desligado por padrão e lembrado. Vale na PRÓXIMA gravação (o microfone é aberto com ele).
  let filtro = $state<FiltroDeRuido>(lerFiltroDeRuido());
  /** O filtro escolhido não pôde ser ligado na última gravação e ela foi feita sem filtro: a tela avisa. */
  let filtroFalhou = $state<FiltroDeRuido | null>(null);
  /** Só existe quando a gravação NÃO pôde ser guardada (cota cheia, armazenamento indisponível): fica na tela para a pessoa ouvir antes de perder. */
  let gravacao = $state<Gravacao | null>(null);
  /** A sessão de recuperação da gravação que está na tela sem ter sido guardada (some se a pessoa a descarta). */
  let sessaoDaGravacao: Promise<string | null> | null = null;
  let erroGuardar = $state(false);
  let erro = $state<MotivoDoErro | null>(null);
  /** Busca e filtro de origem (limpos ao sair e ao reabrir: não são lembrados). */
  let consulta = $state<Consulta>({ ...SEM_FILTRO });
  /** O painel dos filtros (busca e "Com metrônomo"): fica aqui, e não no subcomponente, para sobreviver à lista esvaziar (a busca continua valendo). */
  let filtrosAbertos = $state(false);
  /** O "agora" dos grupos por dia (Hoje, Ontem...): renovado ao voltar à aba e a cada minuto, para "Hoje" não ficar errado depois da meia-noite. */
  let agora = $state(Date.now());

  const textoErro: Record<MotivoDoErro, Parameters<typeof i18n.t>[0]> = {
    negada: "gravador.erro_negada",
    sem_microfone: "gravador.erro_sem_microfone",
    indisponivel: "gravador.erro_indisponivel",
    falhou: "gravador.erro_falhou",
  };

  // ---- achar, filtrar e paginar (I-39) ----
  // O estado e as ações da lista moram em `gravadorLista.svelte.ts`; a ordem da tela (para o foco) vem das linhas derivadas abaixo.
  const lista: ListaDeGravacoes = new ListaDeGravacoes(() => ordemDaTela(fixadas, naJanela));
  /** Quantidade e espaço, derivados da lista na memória (e não de um cursor no banco a cada mudança). */
  const resumo = $derived(resumir(lista.todas));
  const chaveDe = criarChaveDe((k, p) => t(k as Parameters<typeof t>[0], p), () => i18n.idioma);
  const filtradas = $derived(filtrar(lista.todas, consulta, chaveDe));
  const idsFiltradas = $derived(new Set(filtradas.map((m) => m.id)));
  const naJanela = $derived(janela(filtradas, lista.mostrando));
  const idsNaJanela = $derived(new Set(naJanela.map((m) => m.id)));
  const grupos = $derived(agrupar(naJanela, agora));
  const fixadas: Fixada[] = $derived(calcularFixadas({ novaId: lista.novaId, tocandoId: lista.tocandoId, todas: lista.todas, idsNaJanela, idsFiltradas }));
  const linhas = $derived(montarLinhas(fixadas, grupos));
  const consultaAtiva = $derived(consulta.filtro !== "todas" || consulta.busca.trim() !== "");
  const rotulo = (g: Grupo) => rotuloDoGrupo(g, { hoje: t("gravador.grupo_hoje"), ontem: t("gravador.grupo_ontem"), semana: t("gravador.grupo_semana") }, i18n.idioma);

  function descartar() {
    if (gravacao) URL.revokeObjectURL(gravacao.url);
    gravacao = null;
    sessaoDaGravacao = null;
    erroGuardar = false; // o aviso de "não pôde guardar" era sobre esta gravação
  }

  /** A PESSOA descartou a gravação que não pôde ser guardada (o botão, ou começar outra): a sessão de recuperação dela também sai, senão a gravação voltaria na próxima abertura do app. */
  function descartarPorEscolha() {
    emCurso.esquecerSessao(sessaoDaGravacao);
    descartar();
  }

  /** Começar ou parar: o ciclo de vida da gravação mora em `emCurso`; aqui se limpa a tela antes de começar e se mostra o que ele conta. */
  async function alternar() {
    if (emCurso.ocupado) return;
    if (!emCurso.gravando) {
      erro = null;
      filtroFalhou = null;
      descartarPorEscolha();
      lista.tocandoId = null; // uma gravação da lista que tocava também: o alto-falante entraria na nova
    }
    const r = await emCurso.alternar(filtro);
    if (r && !r.cancelada) {
      erro = r.erro;
      filtroFalhou = r.filtroFalhou;
    }
  }

  function escolherRuido(f: FiltroDeRuido) {
    filtro = f;
    salvarFiltroDeRuido(f);
    filtroFalhou = null;
  }

  /** Como a gravação terminou: guardada (entra no topo da lista), vazia (erro) ou não guardada (fica na tela para a pessoa ouvir antes de perder). */
  function aoTerminar(r: Resultado) {
    descartar(); // uma gravação não guardada anterior, se ainda estava na tela, não fica com a URL presa
    if (r.tipo === "vazia") erro = "falhou";
    else if (r.tipo === "guardada") lista.inserir(r.meta);
    else manterNaTela(r);
  }

  /** A gravação não coube no armazenamento: fica na tela para ouvir, e a escrita atrasada, se terminar, a leva para a lista. */
  function manterNaTela(r: Extract<Resultado, { tipo: "nao-guardada" }>) {
    const nova = r.gravacao;
    erroGuardar = true;
    gravacao = nova;
    sessaoDaGravacao = r.sessao;
    void r.depois.then(
      (meta) => aoGuardarDepois(nova, meta),
      () => {},
    );
  }

  /** Se a escrita terminar depois do limite, a gravação JÁ está guardada: a lista e a contagem precisam saber (ou, se a pessoa já a descartou, ela é apagada de volta). */
  function aoGuardarDepois(nova: Gravacao, meta: MetaGravacao) {
    console.warn("gravador: a gravação foi guardada depois do limite de espera");
    if (lista.destruida) return;
    if (gravacao !== nova) {
      void gravacoes.apagar(meta.id).catch(() => {});
      return;
    }
    lista.inserir(meta);
    erroGuardar = false;
    descartar();
  }

  /** Mudou a busca ou o filtro: volta à primeira página e a "nova" deixa de ser fixada. */
  function mudarConsulta(parcial: Partial<Consulta>) {
    consulta = { ...consulta, ...parcial };
    lista.mostrando = PAGINA;
    lista.novaId = null;
  }

  /** Mostra mais PAGINA gravações e leva o foco ao primeiro item novo (o botão some quando chega a última leva, e o foco cairia no começo da página). */
  async function mostrarMais() {
    const primeiro = filtradas[naJanela.length]?.id;
    lista.mostrando += PAGINA;
    await tick();
    focarItem(primeiro);
  }

  // Um só anúncio ao leitor de tela (quantos resultados e quantos aparecem), com atraso, e não a cada tecla.
  let anuncio = $state("");
  $effect(() => {
    if (!lista.listaPronta || (!consultaAtiva && lista.mostrando <= PAGINA)) {
      anuncio = "";
      return;
    }
    const n = filtradas.length;
    const texto = naJanela.length < n ? `${i18n.tn("plural.gravacoes", n)}. ${t("gravador.mostrando", { a: naJanela.length, b: n })}` : i18n.tn("plural.gravacoes", n);
    const id = setTimeout(() => (anuncio = texto), 600);
    return () => clearTimeout(id);
  });

  /** Uma gravação da lista pausou ou terminou: deixa de ser a "que toca" (só se ainda era ela). */
  function aoPararItem(id: string) {
    if (lista.tocandoId === id) lista.tocandoId = null;
  }

  /** Uma gravação da lista começou a tocar: só ela toca, o hino cala e uma gravação em andamento PARA (o alto-falante entraria nela). */
  function aoTocarItem(id: string) {
    lista.tocandoId = id;
    reproducao.parar();
    if (emCurso.gravando) void emCurso.parar();
  }

  $effect(() => {
    if (ativa) return;
    // Com o serviço do Android assumindo a gravação, ela SEGUE ao trocar de aba (gravar com o metrônomo no fone); o aviso das outras abas tem o Parar.
    if (!untrack(() => emCurso.gravando && emCurso.protegida)) void emCurso.sair(); // cancela um pedido de microfone que esperava, ou para a gravação, e DEVOLVE o microfone: o que já foi gravado fica
    lista.tocandoId = null; // a aba saiu de cena: nenhuma gravação da lista segue tocando
  });
  // Os grupos por dia usam o "agora": renova ao voltar à aba e a cada minuto.
  $effect(() => {
    const renovar = () => (agora = Date.now());
    const id = setInterval(renovar, 60_000);
    document.addEventListener("visibilitychange", renovar);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", renovar);
    };
  });
  onMount(() => {
    emCurso.aoTerminar = aoTerminar;
    // As gravações que ficaram pela metade (o app caiu no meio) viram gravações guardadas ANTES de a lista ser lida.
    void emCurso
      .recuperar()
      .catch((e) => console.warn("gravador: não foi possível recuperar gravações pela metade", e))
      .then(() => lista.carregarTudo());
  });

  onDestroy(() => {
    lista.destruir();
    emCurso.aoDesmontarATela(); // com o serviço do Android a gravação SEGUE; sem ele, para e guarda
    descartar();
  });
</script>

<div class="gravador">
  <button id="gravar" class="botao primario grande" aria-pressed={gravando} data-nivel={nivel.toFixed(2)} onclick={alternar}>
    <!-- O medidor: uma barra atrás do texto que cresce da esquerda para a direita com o som que entra no microfone (só a largura muda, sem animação,
         então já respeita "reduzir movimento"). Decorativa: o leitor de tela é avisado só de que o som chegou ou de que não há som. -->
    {#if gravando}<span class="nivel" aria-hidden="true" style:width={`${nivel * 100}%`}></span>{/if}
    {#if gravando}
      <Icone nome="stop" tamanho={24} />
      <span>{t("gravador.parar")} · <span class="tempo" aria-hidden="true">{formatarTempo(decorrido)}</span></span>
    {:else}
      <span class="bolinha" aria-hidden="true"></span>
      <span>{t("gravador.gravar")}</span>
    {/if}
  </button>

  <RuidoGravador {filtro} {gravando} aoEscolher={escolherRuido} />
  {#if filtroFalhou}<Aviso tipo="info">{t("gravador.erro_filtro", { filtro: t(`gravador.ruido_tec_${filtroFalhou}`) })}</Aviso>{/if}

  {#if erro}<Aviso tipo="erro">{t(textoErro[erro])}</Aviso>{/if}
  {#if erroGuardar}<Aviso tipo="erro">{t("gravador.erro_guardar")}</Aviso>{/if}

  <!-- Só para o leitor de tela: começou e terminou (não anuncia o tempo segundo a segundo). -->
  {#if gravando && semSom}<Aviso tipo="info"><span id="sem-som">{t("gravador.sem_som")}</span></Aviso>{/if}
  <p class="so-leitor" role="status">{#if gravando}{ouviu ? t("gravador.recebendo") : t("gravador.gravando")}{:else if gravacao}{t("gravador.pronta", { tempo: formatarTempo(gravacao.segundos) })}{/if}</p>

  {#if gravacao}<GravacaoNaoGuardada {gravacao} aoDescartar={descartarPorEscolha} />{/if}

  <section class="guardadas" aria-labelledby="titulo-guardadas">
    <div class="cabeca">
      <h2 id="titulo-guardadas" tabindex="-1">{t("gravador.guardadas")}</h2>
      {#if resumo.quantidade > 0}
        <span class="meta" id="resumo-gravacoes">{i18n.tn("plural.gravacoes", resumo.quantidade)} · {formatarTamanho(resumo.bytes, i18n.idioma)}</span>
      {/if}
    </div>
    {#if lista.erroAcao}<Aviso tipo="erro">{t("gravador.erro_lista")}</Aviso>{/if}
    {#if lista.erroCarga}
      <Aviso tipo="erro">{t("gravador.erro_ler")}</Aviso>
      <button id="tentar-lista" class="botao" onclick={() => lista.carregarTudo()}>{t("erro.tentar")}</button>
    {/if}
    {#if lista.todas.length > 0}
      <FiltrosGravacoes {consulta} aoMudar={mudarConsulta} bind:filtrosAbertos />
      <!-- UMA lista só, com chave por item: a gravação que toca muda de lugar (da janela para o destaque, de "Hoje" para "Ontem") sem ser desmontada, e o áudio segue. Os cabeçalhos de dia são
           linhas da lista (`<li>` com `<h3>`), para a navegação por títulos continuar. -->
      <ul class="lista" id="lista-gravacoes">
        {#each linhas as l (l.chave)}
          {#if l.tipo === "grupo"}
            <li class="grupo" role="presentation"><h3 class="titulo-grupo">{rotulo(l.grupo)}</h3></li>
          {:else}
            <ItemGravacao meta={l.meta} marca={l.marca} tocandoId={lista.tocandoId} aoTocar={aoTocarItem} aoApagar={(id) => lista.apagarUma(id)} aoParar={aoPararItem} aoAtualizar={(id, m) => lista.atualizarUma(id, m)} />
          {/if}
        {/each}
      </ul>
      {#if filtradas.length === 0}
        <p class="meta" id="sem-resultado">{t("gravador.nenhuma_filtro")}</p>
        <button id="limpar-filtros" class="botao" onclick={() => mudarConsulta(SEM_FILTRO)}>{t("gravador.limpar_filtros")}</button>
      {/if}
      {#if naJanela.length < filtradas.length}
        <p class="meta" id="contador-gravacoes">{t("gravador.mostrando", { a: naJanela.length, b: filtradas.length })}</p>
        <button id="mostrar-mais" class="botao" onclick={mostrarMais}>{t("gravador.mostrar_mais", { n: Math.min(PAGINA, filtradas.length - naJanela.length) })}</button>
      {/if}
      {#if lista.listaPronta && !lista.erroCarga}
        <!-- Só com a lista completa conhecida: "Apagar todas" apaga TUDO o que está guardado, e o número da confirmação tem de ser o verdadeiro. -->
        <button id="apagar-todas" class="botao" class:perigo={lista.confirmacao.pedida} onclick={() => lista.apagarTodas()}>
          {lista.confirmacao.pedida ? i18n.tn("plural.apagar_todas", resumo.quantidade) : t("gravador.apagar_todas")}
        </button>
      {/if}
    {:else if lista.listaPronta && !lista.erroCarga && !lista.erroAcao}
      <p class="meta" id="lista-vazia">{t("gravador.nenhuma")}</p>
    {/if}
    <p class="so-leitor" aria-live="polite">{anuncio}</p>
  </section>
</div>

<style>
  .gravador { display: grid; gap: 1rem; }
  .gravador > p { margin: 0; }
  .grande { position: relative; overflow: hidden; min-height: 3.5rem; font-size: 1.15rem; gap: 0.5rem; }
  /* A barra do medidor, atrás do texto: a cor do texto do botão, bem clara, para o texto seguir legível. */
  .nivel { position: absolute; left: 0; right: 0; margin-inline: auto; top: 0; bottom: 0; background: var(--acento-texto); opacity: 0.22; pointer-events: none; }
  .grande > :not(.nivel) { position: relative; }
  /* O círculo de "gravar": desenhado em CSS (o conjunto de ícones do app não tem um); a cor não é o único sinal, o botão diz "Gravar". */
  .bolinha { width: 1.1rem; height: 1.1rem; border-radius: 50%; background: currentColor; flex: none; }
  .tempo { font-variant-numeric: tabular-nums; }
  .guardadas { display: grid; gap: 0.7rem; }
  .cabeca { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.25rem 1rem; }
  .cabeca h2 { margin: 0; font-size: 1rem; }
  .lista { display: grid; gap: 0.7rem; margin: 0; padding: 0; }
  .grupo { list-style: none; }
  .titulo-grupo { margin: 0.4rem 0 0; font-size: 0.95rem; }
  .perigo { border-width: 0.125rem; border-color: var(--perigo); font-weight: 700; }
</style>
