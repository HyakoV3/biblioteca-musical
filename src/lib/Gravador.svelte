<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import Segmentado from "./Segmentado.svelte";
  import Aviso from "./Aviso.svelte";
  import Icone from "./Icone.svelte";
  import ItemGravacao from "./ItemGravacao.svelte";
  import { corrigirDuracao, formatarTamanho, formatarTempo, nomeDoFormato, type Gravacao, type MotivoDoErro } from "./gravador";
  import { formatarData, gravacoes, type MetaGravacao, type Mudancas } from "./gravacoes";
  import { PAGINA, SEM_FILTRO, agrupar, chaveDeBusca, filtrar, janela, mesclar, nomeDaGravacao, resumir, type Consulta, type Filtro, type Grupo } from "./organizar";
  import { i18n } from "./i18n/index.svelte";
  import { apagarCopiasEnviadas } from "./compartilhar";
  import { emCurso, type Resultado } from "./gravacaoEmCurso.svelte";
  import { reproducao } from "./reproducao.svelte";
  import { FILTROS_DE_RUIDO, type FiltroDeRuido } from "./filtroDeRuido";
  import { lerFiltroDeRuido, salvarFiltroDeRuido } from "./preferencias";
  
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
  /** Todas as gravações guardadas (só os metadados; o áudio fica no banco), da mais nova para a mais antiga. `$state.raw`: a lista é trocada por inteira, por cópia, sem um proxy por registro. */
  let todas = $state.raw<MetaGravacao[]>([]);
  let listaPronta = $state(false);
  /** Quantidade e espaço, derivados da lista na memória (e não de um cursor no banco a cada mudança). */
  const resumo = $derived(resumir(todas));
  /** A leitura da lista falhou: aparece o aviso com "Tentar de novo". */
  let erroCarga = $state(false);
  /** Apagar falhou. */
  let erroAcao = $state(false);
  let erroGuardar = $state(false);
  /**
   * O que mudou enquanto a leitura completa corria: o que foi SALVO e o que foi APAGADO desde o início dela. Ao chegar, a leitura é mesclada com isso (`mesclar`), em vez de substituir a lista
   * (senão uma gravação feita durante a leitura sumiria, e uma apagada voltaria). Nulo fora de uma leitura.
   */
  let registro: { salvas: MetaGravacao[]; apagadas: Set<string>; alteradas: Map<string, MetaGravacao> } | null = null;
  /** Numera as leituras: "Apagar todas" ou uma leitura mais nova descarta a anterior. */
  let carga = 0;
  /** Busca e filtro de origem (limpos ao sair e ao reabrir: não são lembrados). */
  let consulta = $state<Consulta>({ ...SEM_FILTRO });
  /** Quantas gravações a lista mostra (cresce de PAGINA em PAGINA com "Mostrar mais"). */
  let mostrando = $state(PAGINA);
  /** A gravação que acabou de ser feita: aparece sempre, mesmo fora do filtro, até a próxima troca de filtro ou busca. */
  let novaId = $state<string | null>(null);
  /** O "agora" dos grupos por dia (Hoje, Ontem...): renovado ao voltar à aba e a cada minuto, para "Hoje" não ficar errado depois da meia-noite. */
  let agora = $state(Date.now());
  /** Qual gravação da lista está tocando (só uma por vez). */
  let tocandoId = $state<string | null>(null);
  let confirmandoTudo = $state(false);
  let relogioTudo: ReturnType<typeof setTimeout> | null = null;
  let erro = $state<MotivoDoErro | null>(null);
  /** O componente foi desmontado: o que chegar depois (a escrita atrasada de uma gravação) não pode mexer no que já não existe. */
  let destruido = false;

  const textoErro: Record<MotivoDoErro, Parameters<typeof i18n.t>[0]> = {
    negada: "gravador.erro_negada",
    sem_microfone: "gravador.erro_sem_microfone",
    indisponivel: "gravador.erro_indisponivel",
    falhou: "gravador.erro_falhou",
  };

  /** Ação do <audio>: corrige a duração de um WebM sem ela (ver `corrigirDuracao`). */
  function duracaoReal(audio: HTMLAudioElement) {
    const desfazer = corrigirDuracao(audio);
    return { destroy: desfazer };
  }

  function descartar() {
    if (gravacao) URL.revokeObjectURL(gravacao.url);
    gravacao = null;
    erroGuardar = false; // o aviso de "não pôde guardar" era sobre esta gravação
  }

  /** Começar ou parar: o ciclo de vida da gravação mora em `emCurso`; aqui se limpa a tela antes de começar e se mostra o que ele conta. */
  async function alternar() {
    if (emCurso.ocupado) return;
    if (!emCurso.gravando) {
      erro = null;
      filtroFalhou = null;
      descartar();
      tocandoId = null; // uma gravação da lista que tocava também: o alto-falante entraria na nova
    }
    const r = await emCurso.alternar(filtro);
    if (r && !r.cancelada) {
      erro = r.erro;
      filtroFalhou = r.filtroFalhou;
    }
  }

  /** Como a gravação terminou: guardada (entra no topo da lista), vazia (erro) ou não guardada (fica na tela para a pessoa ouvir antes de perder). */
  function aoTerminar(r: Resultado) {
    descartar(); // uma gravação não guardada anterior, se ainda estava na tela, não fica com a URL presa
    if (r.tipo === "vazia") {
      erro = "falhou";
      return;
    }
    if (r.tipo === "guardada") {
      inserir(r.meta);
      return;
    }
    const nova = r.gravacao;
    erroGuardar = true;
    gravacao = nova;
    // Se a escrita terminar depois do limite, a gravação JÁ está guardada: a lista e a contagem precisam saber (ou, se a pessoa já a descartou, ela é apagada de volta).
    void r.depois.then(
      (meta) => {
        console.warn("gravador: a gravação foi guardada depois do limite de espera");
        if (destruido) return;
        if (gravacao === nova) {
          inserir(meta);
          erroGuardar = false;
          descartar();
        } else {
          void gravacoes.apagar(meta.id).catch(() => {});
        }
      },
      () => {},
    );
  }

  /** Põe uma gravação recém-guardada no topo da lista (e a marca como "nova", para ela não sumir de um filtro que não a inclui). */
  function inserir(meta: MetaGravacao) {
    registro?.salvas.push(meta);
    todas = mesclar(todas, [meta], new Set());
    novaId = meta.id;
  }

  function remover(ids: readonly string[]) {
    for (const id of ids) registro?.apagadas.add(id);
    const fora = new Set(ids);
    todas = todas.filter((m) => !fora.has(m.id));
  }

  /** Lê todos os metadados de uma vez e os mescla com o que mudou durante a leitura. */
  async function carregarTudo() {
    const minha = ++carga;
    const meu = (registro = { salvas: [], apagadas: new Set<string>(), alteradas: new Map<string, MetaGravacao>() });
    try {
      const lidas = await gravacoes.listarTodas();
      if (destruido || minha !== carga) return; // "Apagar todas" ou uma leitura mais nova aconteceu no meio: esta é do passado
      todas = mesclar(lidas, meu.salvas, meu.apagadas, meu.alteradas);
      erroCarga = false;
    } catch (e) {
      console.warn("gravador: não foi possível ler as gravações", e);
      if (minha === carga) erroCarga = true;
    } finally {
      if (minha === carga) {
        registro = null;
        listaPronta = true;
      }
    }
  }

  // ---- achar, filtrar e paginar (I-39) ----
  let cacheDeChaves = new WeakMap<MetaGravacao, string>();
  let idiomaDoCache = i18n.idioma;
  /** A chave de busca de uma gravação, calculada UMA vez por registro (e de novo se a língua da tela mudar). */
  function chaveDe(m: MetaGravacao): string {
    if (idiomaDoCache !== i18n.idioma) {
      cacheDeChaves = new WeakMap();
      idiomaDoCache = i18n.idioma;
    }
    let c = cacheDeChaves.get(m);
    if (c === undefined) {
      const data = formatarData(m.criadaEm, i18n.idioma);
      c = chaveDeBusca(m, (x) => nomeDaGravacao(x, (k, p) => t(k as Parameters<typeof t>[0], p), i18n.idioma), () => data);
      cacheDeChaves.set(m, c);
    }
    return c;
  }
  const filtradas = $derived(filtrar(todas, consulta, chaveDe));
  const idsFiltradas = $derived(new Set(filtradas.map((m) => m.id)));
  const naJanela = $derived(janela(filtradas, mostrando));
  const idsNaJanela = $derived(new Set(naJanela.map((m) => m.id)));
  const grupos = $derived(agrupar(naJanela, agora));
  /** Em destaque, no topo, fora dos grupos: a recém-gravada e a que toca, quando a janela não as mostra. Fora do filtro levam uma marca que explica por que estão ali. */
  const fixadas = $derived.by(() => {
    const lista: { meta: MetaGravacao; marca?: "nova" | "tocando" }[] = [];
    for (const id of [novaId, tocandoId]) {
      if (!id || idsNaJanela.has(id) || lista.some((f) => f.meta.id === id)) continue;
      const meta = todas.find((m) => m.id === id);
      if (meta) lista.push({ meta, marca: idsFiltradas.has(id) ? undefined : id === tocandoId ? "tocando" : "nova" });
    }
    return lista;
  });
  type Linha = { chave: string; tipo: "grupo"; grupo: Grupo } | { chave: string; tipo: "item"; meta: MetaGravacao; marca?: "nova" | "tocando" };
  /** As linhas da lista, na ordem da tela: os destaques, e depois cada grupo por dia com o seu cabeçalho. A chave do item é só o id: ele não é recriado ao mudar de lugar. */
  const linhas = $derived.by(() => {
    const l: Linha[] = fixadas.map((f) => ({ chave: `i:${f.meta.id}`, tipo: "item", meta: f.meta, marca: f.marca }));
    for (const g of grupos) {
      l.push({ chave: `g:${g.chave}`, tipo: "grupo", grupo: g });
      for (const meta of g.itens) l.push({ chave: `i:${meta.id}`, tipo: "item", meta });
    }
    return l;
  });
  const consultaAtiva = $derived(consulta.filtro !== "todas" || consulta.busca.trim() !== "");
  const FILTROS_RAPIDOS: Filtro[] = ["todas", "favoritas", "hino"];
  /** O painel dos filtros (busca e "Com metrônomo"): começa fechado; fechado, um ponto no chevron avisa que há filtro escondido. */
  let filtrosAbertos = $state(false);
  let buscaEl = $state<HTMLInputElement>();
  const filtroEscondido = $derived(consulta.busca.trim() !== "" || consulta.filtro === "metronomo");
  async function alternarFiltros() {
    filtrosAbertos = !filtrosAbertos;
    if (filtrosAbertos) {
      await tick();
      buscaEl?.focus();
    }
  }

  function mudouConsulta() {
    mostrando = PAGINA;
    novaId = null;
  }
  function escolherFiltro(f: Filtro) {
    consulta.filtro = f;
    mudouConsulta();
  }
  function aoBuscar(v: string) {
    consulta.busca = v;
    mudouConsulta();
  }
  function limparFiltros() {
    consulta = { ...SEM_FILTRO };
    mudouConsulta();
  }
  const focarItem = (id: string | undefined) => (id ? (document.querySelector(`[data-id="${CSS.escape(id)}"] button`) as HTMLElement | null) : null)?.focus();
  /** Mostra mais PAGINA gravações e leva o foco ao primeiro item novo (o botão some quando chega a última leva, e o foco cairia no começo da página). */
  async function mostrarMais() {
    const primeiro = filtradas[naJanela.length]?.id;
    mostrando += PAGINA;
    await tick();
    focarItem(primeiro);
  }
  const rotuloDoGrupo = (g: Grupo) =>
    g.tipo === "hoje" ? t("gravador.grupo_hoje") : g.tipo === "ontem" ? t("gravador.grupo_ontem") : g.tipo === "semana" ? t("gravador.grupo_semana") : inicialMaiuscula(new Intl.DateTimeFormat(i18n.idioma, { month: "long", year: "numeric" }).format(new Date(g.ano, g.mes, 1)));
  /** "novembro de 2026" em pt e es sai em minúscula, entre "Hoje" e "Ontem" com maiúscula: o grupo do mês também começa por maiúscula. */
  const inicialMaiuscula = (s: string) => s.charAt(0).toLocaleUpperCase(i18n.idioma) + s.slice(1);

  // Um só anúncio ao leitor de tela (quantos resultados e quantos aparecem), com atraso, e não a cada tecla.
  let anuncio = $state("");
  $effect(() => {
    if (!listaPronta || (!consultaAtiva && mostrando <= PAGINA)) {
      anuncio = "";
      return;
    }
    const n = filtradas.length;
    const texto = naJanela.length < n ? `${i18n.tn("plural.gravacoes", n)}. ${t("gravador.mostrando", { a: naJanela.length, b: n })}` : i18n.tn("plural.gravacoes", n);
    const id = setTimeout(() => (anuncio = texto), 600);
    return () => clearTimeout(id);
  });

  /** Muda o nome ou a estrela de uma gravação. Se ela já não existe (apagada em outro lugar), sai da lista. Devolve se deu certo. */
  async function atualizarUma(id: string, mudancas: Mudancas): Promise<boolean> {
    // O foco não pode se perder quando a mudança TIRA o item da lista (tirar a estrela com o filtro "Favoritas"), nem quando o MOVE (da janela para o destaque: o navegador tira o foco
    // de um nó movido): vai ao item seguinte, ao próprio item ou, sem nenhum, ao título.
    const ordem = [...fixadas.map((f) => f.meta.id), ...naJanela.map((m) => m.id)];
    const i = ordem.indexOf(id);
    const proximo = ordem[i + 1] ?? ordem[i - 1];
    const tinhaFoco = document.activeElement?.closest("[data-id]")?.getAttribute("data-id") === id;
    const recuperarFoco = async () => {
      await tick();
      if (!tinhaFoco) return;
      const ativo = document.activeElement;
      if (ativo && ativo !== document.body) return; // o foco está em algum lugar: não mexe
      const doItem = document.querySelector(`[data-id="${CSS.escape(id)}"] .estrela`) as HTMLElement | null;
      if (doItem) doItem.focus();
      else if (proximo && document.querySelector(`[data-id="${CSS.escape(proximo)}"]`)) focarItem(proximo);
      else document.getElementById("titulo-guardadas")?.focus();
    };
    try {
      const novo = await gravacoes.atualizar(id, mudancas);
      if (!novo) {
        // Apagada em outro lugar: sai da lista como em `apagarUma` (e deixa de ser a que toca).
        remover([id]);
        if (tocandoId === id) tocandoId = null;
        if (novaId === id) novaId = null;
        await recuperarFoco();
        return true;
      }
      registro?.alteradas.set(id, novo);
      todas = todas.map((m) => (m.id === id ? novo : m));
      erroAcao = false;
      await recuperarFoco();
      return true;
    } catch (e) {
      console.warn("gravador: não foi possível salvar a alteração", e);
      return false;
    }
  }

  /** Uma gravação da lista pausou ou terminou: deixa de ser a "que toca" (só se ainda era ela). */
  function aoPararItem(id: string) {
    if (tocandoId === id) tocandoId = null;
  }

  /** Uma gravação da lista começou a tocar: só ela toca, o hino cala e uma gravação em andamento PARA (o alto-falante entraria nela). */
  function aoTocarItem(id: string) {
    tocandoId = id;
    reproducao.parar();
    if (emCurso.gravando) void emCurso.parar();
  }

  async function apagarUma(id: string) {
    // Para onde vai o foco: o item seguinte da tela (ou o anterior); sem nenhum, o título da lista.
    const ordem = [...fixadas.map((f) => f.meta.id), ...naJanela.map((m) => m.id)];
    const i = ordem.indexOf(id);
    const proximo = ordem[i + 1] ?? ordem[i - 1];
    try {
      await gravacoes.apagar(id);
      remover([id]);
      if (tocandoId === id) tocandoId = null;
      if (novaId === id) novaId = null;
      erroAcao = false;
      await tick();
      if (proximo && document.querySelector(`[data-id="${CSS.escape(proximo)}"]`)) focarItem(proximo);
      else document.getElementById("titulo-guardadas")?.focus();
    } catch (e) {
      console.warn("gravador: não foi possível apagar", e);
      erroAcao = true;
    }
  }

  async function apagarTodas() {
    if (!confirmandoTudo) {
      confirmandoTudo = true;
      relogioTudo = setTimeout(() => (confirmandoTudo = false), 4000);
      return;
    }
    if (relogioTudo !== null) clearTimeout(relogioTudo);
    relogioTudo = null;
    confirmandoTudo = false;
    try {
      await gravacoes.apagarTodas();
      // As cópias que o "Enviar" deixou no cache do Android também saem. Se alguma não sair, as gravações do app já foram apagadas: fica só o registro no console.
      if (!apagarCopiasEnviadas()) console.warn("gravador: não consegui apagar todas as cópias enviadas do cache do aparelho");
      carga++; // só agora, que apagou: uma leitura em andamento é descartada (traria gravações que já não existem); se apagar falhar, ela segue
      registro = null;
      todas = [];
      listaPronta = true; // sabemos o que há: nada
      tocandoId = null;
      novaId = null;
      mostrando = PAGINA;
      erroAcao = false;
      erroCarga = false;
    } catch (e) {
      console.warn("gravador: não foi possível apagar tudo", e);
      erroAcao = true;
    }
  }

  $effect(() => {
    if (!ativa) {
      // Com o serviço do Android assumindo a gravação, ela SEGUE ao trocar de aba (gravar com o metrônomo no fone); o aviso das outras abas tem o Parar.
      if (untrack(() => emCurso.gravando && emCurso.protegida)) {
        tocandoId = null;
        return;
      }
      void emCurso.sair(); // cancela um pedido de microfone que esperava, ou para a gravação, e DEVOLVE o microfone: o que já foi gravado fica
      tocandoId = null; // a aba saiu de cena: nenhuma gravação da lista segue tocando
    }
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
      .then(carregarTudo);
  });

  onDestroy(() => {
    destruido = true;
    if (relogioTudo !== null) clearTimeout(relogioTudo);
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

  <!-- A pílula do filtro de ruído: um grupo de escolha única, de um controle só (Desligado, Baixo, Médio, Alto), travado enquanto grava. O nome técnico do filtro escolhido vem numa linha miúda embaixo. -->
  <fieldset class="ruido" id="filtro-de-ruido" disabled={gravando}>
    <legend class="meta">{t("gravador.reduzir_ruido")}</legend>
    <Segmentado
      nome="filtro-de-ruido"
      valor={filtro}
      opcoes={FILTROS_DE_RUIDO.map((f) => ({ valor: f, rotulo: t(`gravador.ruido_${f}`) }))}
      aoEscolher={(f) => {
        filtro = f;
        salvarFiltroDeRuido(f);
        filtroFalhou = null;
      }}
    />
    <p class="meta ruido-tecnico" id="ruido-tecnico">{t(`gravador.ruido_tec_${filtro}`)}</p>
    {#if filtro === "rnnoise" || filtro === "gtcrn"}<p class="meta" id="ruido-aviso">{t("gravador.ruido_aviso")}</p>{/if}
  </fieldset>
  {#if filtroFalhou}<Aviso tipo="info">{t("gravador.erro_filtro", { filtro: t(`gravador.ruido_tec_${filtroFalhou}`) })}</Aviso>{/if}

  {#if erro}<Aviso tipo="erro">{t(textoErro[erro])}</Aviso>{/if}
  {#if erroGuardar}<Aviso tipo="erro">{t("gravador.erro_guardar")}</Aviso>{/if}

  <!-- Só para o leitor de tela: começou e terminou (não anuncia o tempo segundo a segundo). -->
  {#if gravando && semSom}<Aviso tipo="info"><span id="sem-som">{t("gravador.sem_som")}</span></Aviso>{/if}
  <p class="so-leitor" role="status">{#if gravando}{ouviu ? t("gravador.recebendo") : t("gravador.gravando")}{:else if gravacao}{t("gravador.pronta", { tempo: formatarTempo(gravacao.segundos) })}{/if}</p>

  <!-- Só aparece quando a gravação NÃO pôde ser guardada: a pessoa a ouve antes de perdê-la. -->
  {#if gravacao}
    <section class="resultado" aria-labelledby="titulo-gravacao">
      <h2 id="titulo-gravacao">{t("gravador.sua_gravacao")}</h2>
      <audio id="ouvir-gravacao" controls src={gravacao.url} use:duracaoReal></audio>
      <p class="meta" id="info-gravacao">
        {formatarTempo(gravacao.segundos)} · {formatarTamanho(gravacao.bytes, i18n.idioma)} · {nomeDoFormato(gravacao.tipo)}
      </p>
      <button id="descartar" class="botao" onclick={descartar}>{t("gravador.descartar")}</button>
    </section>
  {/if}

  <section class="guardadas" aria-labelledby="titulo-guardadas">
    <div class="cabeca">
      <h2 id="titulo-guardadas" tabindex="-1">{t("gravador.guardadas")}</h2>
      {#if resumo.quantidade > 0}
        <span class="meta" id="resumo-gravacoes">{i18n.tn("plural.gravacoes", resumo.quantidade)} · {formatarTamanho(resumo.bytes, i18n.idioma)}</span>
      {/if}
    </div>
    {#if erroAcao}<Aviso tipo="erro">{t("gravador.erro_lista")}</Aviso>{/if}
    {#if erroCarga}
      <Aviso tipo="erro">{t("gravador.erro_ler")}</Aviso>
      <button id="tentar-lista" class="botao" onclick={carregarTudo}>{t("erro.tentar")}</button>
    {/if}
    {#if todas.length > 0}
      <!-- Os filtros no título (I-39): os três mais usados ficam à mão, e o chevron abre a busca e o filtro "Com metrônomo". Tudo é UM grupo de escolha única (os quatro botões de rádio têm o mesmo nome). -->
      <div class="controles">
        <fieldset class="filtros" id="filtro-gravacoes">
          <legend class="so-leitor">{t("gravador.filtro_legenda")}</legend>
          <div class="linha-filtros">
            <div class="filtros-rapidos">
              <Segmentado
                nome="filtro-gravacoes"
                valor={consulta.filtro}
                opcoes={FILTROS_RAPIDOS.map((f) => ({ valor: f, rotulo: t(`gravador.filtro_${f}`) }))}
                aoEscolher={escolherFiltro}
              />
            </div>
            <button
              type="button"
              id="mais-filtros"
              class="mais-filtros"
              class:escondido={!filtrosAbertos && filtroEscondido}
              aria-expanded={filtrosAbertos}
              aria-controls={filtrosAbertos ? "painel-filtros" : undefined}
              title={t("gravador.mais_filtros")}
              onclick={alternarFiltros}
            >
              <Icone nome={filtrosAbertos ? "fechar" : "abrir"} tamanho={22} />
              <!-- O nome do botão vem do conteúdo (um aria-label o substituiria e o aviso do filtro escondido nunca seria lido). -->
              <span class="so-leitor">{t("gravador.mais_filtros")}{#if !filtrosAbertos && filtroEscondido}{" — "}{t("gravador.filtro_escondido")}{/if}</span>
            </button>
          </div>
          {#if filtrosAbertos}
            <div class="painel-filtros" id="painel-filtros">
              <label class="so-metronomo" class:ativo={consulta.filtro === "metronomo"}>
                <input type="radio" name="filtro-gravacoes" value="metronomo" checked={consulta.filtro === "metronomo"} onchange={() => escolherFiltro("metronomo")} />
                <span>{#if consulta.filtro === "metronomo"}<Icone nome="ok" tamanho={16} />{/if}{t("gravador.filtro_metronomo")}</span>
              </label>
              <label class="busca">
                <span class="meta">{t("gravador.buscar")}</span>
                <input id="buscar-gravacoes" bind:this={buscaEl} type="search" autocomplete="off" enterkeyhint="search" value={consulta.busca} oninput={(e) => aoBuscar(e.currentTarget.value)} />
              </label>
            </div>
          {/if}
        </fieldset>
      </div>
      <!-- UMA lista só, com chave por item: a gravação que toca muda de lugar (da janela para o destaque, de "Hoje" para "Ontem") sem ser desmontada, e o áudio segue. Os cabeçalhos de dia são
           linhas da lista (`<li>` com `<h3>`), para a navegação por títulos continuar. -->
      <ul class="lista" id="lista-gravacoes">
        {#each linhas as l (l.chave)}
          {#if l.tipo === "grupo"}
            <li class="grupo" role="presentation"><h3 class="titulo-grupo">{rotuloDoGrupo(l.grupo)}</h3></li>
          {:else}
            <ItemGravacao meta={l.meta} marca={l.marca} {tocandoId} aoTocar={aoTocarItem} aoApagar={apagarUma} aoParar={aoPararItem} aoAtualizar={atualizarUma} />
          {/if}
        {/each}
      </ul>
      {#if filtradas.length === 0}
        <p class="meta" id="sem-resultado">{t("gravador.nenhuma_filtro")}</p>
        <button id="limpar-filtros" class="botao" onclick={limparFiltros}>{t("gravador.limpar_filtros")}</button>
      {/if}
      {#if naJanela.length < filtradas.length}
        <p class="meta" id="contador-gravacoes">{t("gravador.mostrando", { a: naJanela.length, b: filtradas.length })}</p>
        <button id="mostrar-mais" class="botao" onclick={mostrarMais}>{t("gravador.mostrar_mais", { n: Math.min(PAGINA, filtradas.length - naJanela.length) })}</button>
      {/if}
      {#if listaPronta && !erroCarga}
        <!-- Só com a lista completa conhecida: "Apagar todas" apaga TUDO o que está guardado, e o número da confirmação tem de ser o verdadeiro. -->
        <button id="apagar-todas" class="botao" class:perigo={confirmandoTudo} onclick={apagarTodas}>
          {confirmandoTudo ? i18n.tn("plural.apagar_todas", resumo.quantidade) : t("gravador.apagar_todas")}
        </button>
      {/if}
    {:else if listaPronta && !erroCarga && !erroAcao}
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
  .resultado { display: grid; gap: 0.6rem; padding: 0.9rem; border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie); }
  .resultado h2 { margin: 0; font-size: 1rem; }
  .resultado audio { width: 100%; }
  .resultado p { margin: 0; }
  .guardadas { display: grid; gap: 0.7rem; }
  .cabeca { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.25rem 1rem; }
  .cabeca h2 { margin: 0; font-size: 1rem; }
  .lista { display: grid; gap: 0.7rem; margin: 0; padding: 0; }
  .grupo { list-style: none; }
  .titulo-grupo { margin: 0.4rem 0 0; font-size: 0.95rem; }
  .controles { display: grid; gap: 0.6rem; }
  .busca { display: grid; gap: 0.25rem; }
  .busca input { box-sizing: border-box; width: 100%; min-height: 3rem; padding: 0 0.75rem; font: inherit; border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie); color: var(--texto); }
  .filtros { margin: 0; padding: 0; border: 0; min-width: 0; }
  .linha-filtros { display: flex; gap: 0.4rem; align-items: stretch; }
  .filtros-rapidos { flex: 1; min-width: 0; }
  .filtros label { position: relative; flex: 1 1 auto; }
  .filtros input[type="radio"] { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
  .filtros label > span:not(.meta) { display: flex; align-items: center; justify-content: center; gap: 0.25rem; min-height: 3rem; box-sizing: border-box; padding: 0 0.5rem; border-radius: 0.75rem; border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto); }
  .filtros label.ativo > span:not(.meta) { border: 0.125rem solid var(--acento); font-weight: 700; }
  .filtros input[type="radio"]:focus-visible + span { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; }
  .mais-filtros { position: relative; flex: 0 0 3rem; min-height: 3rem; display: flex; align-items: center; justify-content: center; border-radius: 0.75rem; border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto); cursor: pointer; }
  .mais-filtros:focus-visible { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; }
  /* O ponto: há busca ou "Com metrônomo" ligados com o painel fechado. */
  .mais-filtros.escondido { border: 0.125rem solid var(--acento); }
  .mais-filtros.escondido::after { content: ""; position: absolute; top: 0.3rem; right: 0.3rem; width: 0.6rem; height: 0.6rem; border-radius: 50%; background: var(--acento); }
  .painel-filtros { display: grid; gap: 0.6rem; margin-top: 0.6rem; }
  .so-metronomo { display: block; }
  .perigo { border-width: 0.125rem; border-color: var(--perigo); font-weight: 700; }
  /* "Reduzir ruído": uma linha com a caixa e o texto (alvo de toque de 3 rem), e a dica embaixo. */
  /* A pílula do filtro de ruído: 4 opções de escolha única, que quebram de linha em tela estreita. */
  .ruido { margin: 0 0 0.75rem; padding: 0; border: 0; min-width: 0; }
  .ruido legend { padding: 0; margin-bottom: 0.25rem; }
  .ruido-tecnico { margin: 0.35rem 0 0; font-size: 0.8rem; text-align: center; min-height: 1.1rem; }
</style>
