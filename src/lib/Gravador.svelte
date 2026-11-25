<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from "svelte";
  import Aviso from "./Aviso.svelte";
  import Icone from "./Icone.svelte";
  import ItemGravacao from "./ItemGravacao.svelte";
  import { DetectorDeSom, Gravador, corrigirDuracao, formatarTamanho, formatarTempo, motivoDoErro, nivelParaBarra, nomeDoFormato, rastro, suavizarBarra, type Gravacao, type MotivoDoErro } from "./gravador";
  import { LIMITE_PARA_GUARDAR_MS, comLimite, formatarData, gravacoes, type MetaGravacao, type Mudancas } from "./gravacoes";
  import { PAGINA, SEM_FILTRO, agrupar, chaveDeBusca, filtrar, janela, mesclar, nomeDaGravacao, resumir, type Consulta, type Filtro, type Grupo } from "./organizar";
  import { i18n } from "./i18n/index.svelte";
  import { emCurso } from "./gravacaoEmCurso.svelte";
  import { biblioteca } from "./biblioteca.svelte";
  import { marcarMudanca, montarContexto, type ContextoGravacao } from "./contexto";
  import { metronomo } from "./metronomo.svelte";
  import { reproducao } from "./reproducao.svelte";
  import { FILTROS_DE_RUIDO, type FiltroDeRuido } from "./filtroDeRuido";
  import { lerFiltroDeRuido, salvarFiltroDeRuido } from "./preferencias";
  import { aoFalharServicoDeGravacao, aoPararGravacaoPelaNotificacao, desligarServicoDeGravacao, foneConectado, ligarServicoDeGravacao } from "./servico";

  // A aba Gravador (I-03, primeira versão): grava o microfone, ouve de volta e descarta. Nada sai do aparelho. A permissão de microfone é pedida só
  // ao tocar em "Gravar". Gravar para o hino que estiver tocando (o alto-falante entraria no microfone). O microfone é devolvido ao aparelho ao parar,
  // ao sair da aba e ao esconder o app. `ativa` diz se a aba está à vista.
  let { ativa }: { ativa: boolean } = $props();

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const gravador = new Gravador();
  // "Reduzir ruído" (I-29): desligado, o filtro do Android ou uma rede neural (RNNoise, GTCRN); desligado por padrão e lembrado. Vale na PRÓXIMA gravação (o microfone é aberto com ele).
  let filtro = $state<FiltroDeRuido>(lerFiltroDeRuido());
  /** O filtro escolhido não pôde ser ligado na última gravação e ela foi feita sem filtro: a tela avisa. */
  let filtroFalhou = $state<FiltroDeRuido | null>(null);
  // A gravação parou sozinha (o sistema tirou o microfone, o gravador falhou): guarda o que já foi gravado, em vez de a tela seguir "gravando".
  gravador.aoInterromper = () => {
    if (gravando) void parar();
  };

  let gravando = $state(false);
  /** No Android o serviço em primeiro plano (microfone) assumiu a gravação: ela segue com a tela bloqueada e o app em segundo plano. */
  let protegida = false;
  /** Segundos gravados até agora (a tela só mostra; o tempo certo da gravação é o medido ao parar). */
  let decorrido = $state(0);
  let relogio: ReturnType<typeof setInterval> | null = null;
  /** O medidor de som: lê o nível do microfone várias vezes por segundo e o mostra como uma barra no botão. */
  let medidor: ReturnType<typeof setInterval> | null = null;
  const detector = new DetectorDeSom();
  /** Nível de 0 a 1 que a barra mostra: sobe na hora e desce devagar (senão a barra tremeria a cada sílaba). */
  let nivel = $state(0);
  /** Já entrou som nesta gravação (avisa o leitor de tela uma vez). */
  let ouviu = $state(false);
  /** Faz tempo demais sem som: o microfone pode estar tapado, mudo ou sem permissão de verdade. */
  let semSom = $state(false);
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
  /** Numera os pedidos: uma resposta tardia do microfone não vale se a pessoa já mandou parar ou saiu da aba. */
  let tentativa = 0;
  /** Um pedido de microfone ou uma parada está em andamento: os toques em "Gravar" e "Parar" são ignorados até acabar (dois pedidos juntos deixavam um microfone órfão). */
  let ocupado = false;
  /** O componente foi desmontado: o que chegar depois não pode criar nada que fique para trás. */
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

  function pararRelogio() {
    if (relogio !== null) clearInterval(relogio);
    relogio = null;
    if (medidor !== null) clearInterval(medidor);
    medidor = null;
    nivel = 0;
    ouviu = false;
    semSom = false;
  }

  function descartar() {
    if (gravacao) URL.revokeObjectURL(gravacao.url);
    gravacao = null;
    erroGuardar = false; // o aviso de "não pôde guardar" era sobre esta gravação
  }

  /** O que a pessoa ouve no fone agora (metrônomo ou hino), para guardar com a gravação (I-38). Nulo sem fone ou sem nada tocando. */
  function lerContexto(): ContextoGravacao | null {
    const atual = reproducao.atual;
    const hino = atual && reproducao.estado === "tocando" ? biblioteca.pacote?.hinario.hinos.find((h) => h.numero === atual.numero) : undefined;
    const c = hino ? reproducao.config(hino) : null;
    return montarContexto({
      fone: foneConectado(),
      metronomo: { ligado: metronomo.ligado, bpm: metronomo.bpm, compasso: metronomo.compasso },
      hino:
        atual && hino && c
          ? {
              tocando: true,
              numero: atual.numero,
              titulo: atual.titulo,
              tonalidade: hino.tonalidade,
              transposicao: c.transposicao,
              andamento: c.andamento,
              andamentoOriginal: hino.andamento,
              parte: atual.parte,
              vozes: hino.vozes.map((v, i) => ({ nome: v.nome, muda: c.mudas[i] ?? false })),
            }
          : null,
    });
  }
  /** O contexto do instante em que a gravação começou; no instante de parar (lido ANTES de qualquer espera), vira o contexto guardado, com a marca de que algo mudou, se mudou. */
  let contextoDoInicio: ContextoGravacao | null = null;
  const contextoAoParar = () => marcarMudanca(contextoDoInicio, lerContexto());

  async function iniciar() {
    const minha = ++tentativa;
    erro = null;
    emCurso.perdida = null;
    descartar();
    // Sem fone, um som de cada vez: o hino que tocava calaria dentro da gravação. Com fone, o hino segue e o microfone só ouve a pessoa.
    if (!foneConectado()) {
      reproducao.parar();
      metronomo.parar(); // o clique do alto-falante entraria na gravação
    }
    tocandoId = null; // e uma gravação da lista que tocava também: o alto-falante entraria na nova
    try {
      filtroFalhou = null;
      const aplicado = await gravador.iniciar({ filtro });
      if (aplicado !== filtro && minha === tentativa) filtroFalhou = filtro; // o filtro neural não carregou: a gravação segue sem filtro
    } catch (e) {
      if (minha === tentativa) erro = motivoDoErro(e);
      console.warn("gravador: não foi possível gravar", e);
      return;
    }
    if (minha !== tentativa) {
      gravador.soltar(); // a pessoa já saiu ou mandou parar enquanto o aparelho liberava o microfone
      return;
    }
    contextoDoInicio = lerContexto();
    gravando = true;
    protegida = ligarServicoDeGravacao();
    decorrido = 0;
    const comeco = performance.now();
    relogio = setInterval(() => (decorrido = (performance.now() - comeco) / 1000), 250);
    detector.reiniciar(performance.now());
    medidor = setInterval(() => {
      const atual = gravador.nivel();
      nivel = suavizarBarra(nivel, nivelParaBarra(atual));
      const r = detector.atualizar(atual, performance.now());
      if (r.comSom) ouviu = true;
      // Sem medidor (sem AudioContext, ou o navegador o deixou suspenso), o nível é sempre 0: isso não prova que não há som, então não avisa.
      semSom = gravador.medidorAtivo && r.semSom;
    }, 80);
    // O app já estava em segundo plano quando o microfone chegou (a permissão já estava dada e a pessoa saiu antes): o evento de esconder já passou.
    // Espera um instante antes de parar, porque o diálogo de permissão do Android também esconde a página por um momento.
    if (document.hidden && !protegida) setTimeout(() => (gravando && document.hidden ? void parar() : undefined), 1000);
  }

  async function parar() {
    if (!gravando) return; // outra parada já está em andamento
    const contexto = contextoAoParar(); // antes de qualquer espera: o que mudar enquanto o arquivo fecha não conta
    tentativa++;
    pararRelogio();
    gravando = false;
    protegida = false;
    desligarServicoDeGravacao();
    const nova = await gravador.parar();
    if (destruido) {
      if (nova) URL.revokeObjectURL(nova.url); // o componente se foi durante a parada: ninguém vai usar esta gravação
      return;
    }
    descartar(); // uma gravação não guardada anterior, se ainda estava na tela, não fica com a URL presa
    if (!nova) {
      erro = "falhou";
      return;
    }
    await guardar(nova, contexto);
  }

  /** Guarda a gravação na lista (no topo). Se não der (cota cheia, armazenamento indisponível), ela fica na tela para a pessoa ouvir e a tela explica. */
  async function guardar(nova: Gravacao, contexto: ContextoGravacao | null) {
    erroGuardar = false;
    rastro(`guardando ${nova.bytes} bytes`);
    const comeco = performance.now();
    const salvando = gravacoes.salvar(nova.blob, nova.tipo, nova.segundos, contexto);
    try {
      const meta = await comLimite(salvando, LIMITE_PARA_GUARDAR_MS, "o armazenamento demorou demais para guardar a gravação");
      rastro(`guardada em ${Math.round(performance.now() - comeco)} ms`);
      URL.revokeObjectURL(nova.url); // o arquivo já está no armazenamento; a lista o lê de lá quando a pessoa tocar em Ouvir
      if (destruido) return;
      inserir(meta);
    } catch (e) {
      console.warn("gravador: não foi possível guardar a gravação", e);
      if (destruido) {
        URL.revokeObjectURL(nova.url);
        return;
      }
      erroGuardar = true;
      gravacao = nova;
      // Se a escrita terminar depois do limite, a gravação JÁ está guardada: a lista e a contagem precisam saber (ou, se a pessoa já a descartou, ela é apagada de volta).
      void salvando.then(
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
  const FILTROS: Filtro[] = ["todas", "favoritas", "hino", "metronomo"];

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
    g.tipo === "hoje" ? t("gravador.grupo_hoje") : g.tipo === "ontem" ? t("gravador.grupo_ontem") : g.tipo === "semana" ? t("gravador.grupo_semana") : new Intl.DateTimeFormat(i18n.idioma, { month: "long", year: "numeric" }).format(new Date(g.ano, g.mes, 1));

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
    if (gravando) void parar();
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
    if (ocupado) return;
    ocupado = true;
    try {
      if (gravando) await parar();
      else await iniciar();
    } finally {
      ocupado = false;
    }
  }

  // Espelha a gravação para fora da aba (o aviso das outras abas).
  $effect(() => {
    emCurso.gravando = gravando;
    emCurso.decorrido = decorrido;
  });
  // O metrônomo ligou com a gravação em curso: sem fone, o clique do alto-falante entraria nela, então a gravação para; com fone, os dois seguem.
  $effect(() => {
    if (metronomo.ligado && gravando && !foneConectado()) void parar();
  });

  $effect(() => {
    if (!ativa) {
      // Com o serviço do Android assumindo a gravação, ela SEGUE ao trocar de aba (gravar com o metrônomo no fone); o aviso das outras abas tem o Parar.
      if (untrack(() => gravando && protegida)) {
        tocandoId = null;
        return;
      }
      void sair();
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
  // Um hino que começa a tocar com a gravação em curso: sem fone, para a gravação (o alto-falante entraria nela); com fone, os dois seguem.
  $effect(() => {
    if (reproducao.estado === "tocando" && gravando && !foneConectado()) void parar();
  });
  // App em segundo plano: para uma gravação EM CURSO e devolve o microfone, a menos que o Android a tenha assumido com o serviço em primeiro plano
  // (`protegida`): aí ela segue, mesmo com a tela bloqueada, até a pessoa tocar em "Parar" (no app ou na notificação). Um pedido de permissão que ainda espera NÃO é cancelado: o próprio
  // diálogo de permissão do Android esconde a página por um instante, e cancelar ali jogava fora o microfone que a pessoa acabava de permitir
  // (e a mensagem de "permissão negada").
  $effect(() => {
    const aoEsconder = () => {
      if (document.hidden && gravando && !protegida) void parar();
    };
    document.addEventListener("visibilitychange", aoEsconder);
    return () => document.removeEventListener("visibilitychange", aoEsconder);
  });
  onMount(() => {
    emCurso.parar = () => void parar();
    const soltarAviso = aoPararGravacaoPelaNotificacao(() => {
      if (gravando) void parar();
    });
    // O serviço do Android não subiu (a ponte avisa depois de já ter dito que sim): sem ele a gravação não está protegida. Com a página escondida o
    // microfone já se foi, então para e guarda o que houver, em vez de seguir "gravando" em silêncio.
    const soltarFalha = aoFalharServicoDeGravacao(() => {
      protegida = false;
      if (gravando && document.hidden) void parar();
    });
    void carregarTudo();
    return () => {
      soltarAviso();
      soltarFalha();
      emCurso.parar = null;
    };
  });
  /** A tela inicial se foi (a pessoa abriu um hino) com a gravação seguindo em outra aba: para, GUARDA o que foi gravado e devolve o microfone. */
  const MOTIVO_DEMORA = "o armazenamento demorou demais para guardar a gravação";

  async function pararEGuardarAoSair() {
    const contexto = contextoAoParar(); // antes do primeiro await: parar o hino ou o metrônomo durante a espera não conta como mudança
    try {
      // `parar()` já tem o seu limite (entrega o que foi gravado se o `stop` não vier): sem um segundo, mais curto ou igual, que descartaria a entrega parcial.
      const nova = await gravador.parar();
      if (!nova) {
        // Gravação vazia (nada chegou do microfone): não há o que guardar e nada falhou, então sem aviso de erro.
        console.warn("gravador: nada foi gravado ao sair da tela");
        return;
      }
      URL.revokeObjectURL(nova.url);
      const salvando = gravacoes.salvar(nova.blob, nova.tipo, nova.segundos, contexto);
      try {
        // Com o mesmo limite de espera de `guardar()`: um armazenamento lento não deixa a espera pendente para sempre.
        await comLimite(salvando, LIMITE_PARA_GUARDAR_MS, MOTIVO_DEMORA);
      } catch (e) {
        if (!(e instanceof Error && e.message === MOTIVO_DEMORA)) throw e;
        // Só demorou: a escrita segue e pode terminar. O aviso diz que é incerto, e some se ela terminar bem (ou vira "falhou" se ela falhar).
        emCurso.perdida = "incerta";
        console.warn("gravador: o armazenamento demorou para guardar a gravação ao sair da tela");
        salvando.then(
          () => {
            if (emCurso.perdida === "incerta") emCurso.perdida = null;
          },
          () => {
            emCurso.perdida = "falhou";
          },
        );
      }
    } catch (e) {
      // A tela do Gravador já se foi: o aviso vai por um estado global, que a tela inicial mostra quando a pessoa voltar a ela.
      emCurso.perdida = "falhou";
      console.warn("gravador: não foi possível guardar a gravação ao sair da tela", e);
    } finally {
      gravador.soltar();
    }
  }

  onDestroy(() => {
    const estavaGravando = gravando;
    destruido = true;
    protegida = false;
    gravando = false;
    emCurso.gravando = false;
    emCurso.parar = null;
    desligarServicoDeGravacao();
    if (relogioTudo !== null) clearTimeout(relogioTudo);
    tentativa++; // um pedido de microfone que ainda espera é jogado fora quando chegar
    pararRelogio();
    if (estavaGravando) void pararEGuardarAoSair();
    else gravador.soltar();
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

  <!-- A pílula do filtro de ruído: um grupo de escolha única (Desligado, Android, RNNoise, GTCRN), travado enquanto grava. -->
  <fieldset class="ruido" id="filtro-de-ruido" disabled={gravando}>
    <legend class="meta">{t("gravador.reduzir_ruido")}</legend>
    <div class="opcoes-ruido">
      {#each FILTROS_DE_RUIDO as f (f)}
        <label class:ativo={filtro === f}>
          <input
            type="radio"
            name="filtro-de-ruido"
            value={f}
            checked={filtro === f}
            onchange={() => {
              filtro = f;
              salvarFiltroDeRuido(f);
              filtroFalhou = null;
            }}
          />
          <span>{#if filtro === f}<Icone nome="ok" tamanho={16} />{/if}{t(`gravador.ruido_${f}`)}</span>
        </label>
      {/each}
    </div>
  </fieldset>
  {#if filtroFalhou}<Aviso tipo="info">{t("gravador.erro_filtro", { filtro: t(`gravador.ruido_${filtroFalhou}`) })}</Aviso>{/if}

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
      <div class="controles">
        <label class="busca">
          <span class="meta">{t("gravador.buscar")}</span>
          <input id="buscar-gravacoes" type="search" autocomplete="off" enterkeyhint="search" value={consulta.busca} oninput={(e) => aoBuscar(e.currentTarget.value)} />
        </label>
        <fieldset class="filtros" id="filtro-gravacoes">
          <legend class="meta">{t("gravador.filtro_legenda")}</legend>
          {#each FILTROS as f (f)}
            <label class:ativo={consulta.filtro === f}>
              <input type="radio" name="filtro-gravacoes" value={f} checked={consulta.filtro === f} onchange={() => escolherFiltro(f)} />
              <span>{#if consulta.filtro === f}<Icone nome="ok" tamanho={16} />{/if}{t(`gravador.filtro_${f}`)}</span>
            </label>
          {/each}
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
          {confirmandoTudo ? t("gravador.apagar_todas_mesmo", { n: resumo.quantidade }) : t("gravador.apagar_todas")}
        </button>
      {/if}
    {:else if listaPronta && !erroCarga && !erroAcao}
      <p class="meta" id="lista-vazia">{t("gravador.nenhuma")}</p>
    {/if}
    <p class="so-leitor" aria-live="polite">{anuncio}</p>
  </section>
  <p class="meta">{t("gravador.privacidade")}</p>
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
  .filtros { display: flex; flex-wrap: wrap; gap: 0.4rem; margin: 0; padding: 0; border: 0; }
  .filtros legend { padding: 0; margin-bottom: 0.25rem; }
  .filtros label { position: relative; flex: 1 1 auto; }
  .filtros input { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
  .filtros span { display: flex; align-items: center; justify-content: center; gap: 0.25rem; min-height: 3rem; box-sizing: border-box; padding: 0 0.75rem; border-radius: 0.75rem; border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto); }
  .filtros .ativo span { border: 0.125rem solid var(--acento); font-weight: 700; }
  .filtros input:focus-visible + span { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; }
  .perigo { border-width: 0.125rem; border-color: var(--perigo); font-weight: 700; }
  /* "Reduzir ruído": uma linha com a caixa e o texto (alvo de toque de 3 rem), e a dica embaixo. */
  /* A pílula do filtro de ruído: 4 opções de escolha única, que quebram de linha em tela estreita. */
  .ruido { margin: 0 0 0.75rem; padding: 0; border: 0; min-width: 0; }
  .ruido legend { padding: 0; margin-bottom: 0.25rem; }
  .opcoes-ruido { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .opcoes-ruido label { position: relative; flex: 1 1 auto; }
  .opcoes-ruido input { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
  .opcoes-ruido span { display: flex; align-items: center; justify-content: center; gap: 0.25rem; min-height: 3rem; box-sizing: border-box; padding: 0 0.75rem; border-radius: 0.75rem; border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto); }
  .opcoes-ruido .ativo span { border: 0.125rem solid var(--acento); font-weight: 700; }
  .opcoes-ruido input:focus-visible + span { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; }
  .ruido:disabled .opcoes-ruido span { opacity: 0.6; }
</style>
