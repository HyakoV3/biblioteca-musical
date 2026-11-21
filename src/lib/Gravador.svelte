<script lang="ts">
  import { onDestroy, onMount, untrack } from "svelte";
  import Aviso from "./Aviso.svelte";
  import Icone from "./Icone.svelte";
  import ItemGravacao from "./ItemGravacao.svelte";
  import { DetectorDeSom, Gravador, corrigirDuracao, formatarTamanho, formatarTempo, motivoDoErro, nivelParaBarra, nomeDoFormato, rastro, suavizarBarra, type Gravacao, type MotivoDoErro } from "./gravador";
  import { LIMITE_PARA_GUARDAR_MS, TAMANHO_DA_PAGINA, comLimite, gravacoes, type MetaGravacao, type Resumo } from "./gravacoes";
  import { i18n } from "./i18n/index.svelte";
  import { emCurso } from "./gravacaoEmCurso.svelte";
  import { metronomo } from "./metronomo.svelte";
  import { reproducao } from "./reproducao.svelte";
  import { aoFalharServicoDeGravacao, aoPararGravacaoPelaNotificacao, desligarServicoDeGravacao, foneConectado, ligarServicoDeGravacao } from "./servico";

  // A aba Gravador (I-03, primeira versão): grava o microfone, ouve de volta e descarta. Nada sai do aparelho. A permissão de microfone é pedida só
  // ao tocar em "Gravar". Gravar para o hino que estiver tocando (o alto-falante entraria no microfone). O microfone é devolvido ao aparelho ao parar,
  // ao sair da aba e ao esconder o app. `ativa` diz se a aba está à vista.
  let { ativa }: { ativa: boolean } = $props();

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const gravador = new Gravador();
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
  /** A lista das gravações guardadas (da mais nova para a mais antiga), carregada por páginas conforme a pessoa rola. */
  let itens = $state<MetaGravacao[]>([]);
  let temMais = $state(false);
  let carregandoLista = $state(false);
  let listaPronta = $state(false);
  let resumo = $state<Resumo>({ quantidade: 0, bytes: 0 });
  /** A leitura da lista falhou: aparece o aviso com "Tentar de novo" (a paginação NÃO é encerrada, para uma falha passageira não esconder as outras páginas). */
  let erroCarga = $state(false);
  /** Apagar falhou. */
  let erroAcao = $state(false);
  let erroGuardar = $state(false);
  /** O resumo (quantidade e espaço) veio do armazenamento: se a primeira leitura falhou, ele é relido na próxima oportunidade em vez de seguir contando às cegas. */
  let resumoLido = false;
  /** Sobe a cada "Apagar todas": uma página que estava sendo lida antes dele traz dados que já não existem e é descartada. */
  let geracao = 0;
  /** Ids apagados enquanto uma página era lida (a transação de leitura já tinha começado e ainda os traz). */
  const apagadasNaCarga = new Set<string>();
  /** Qual gravação da lista está tocando (só uma por vez). */
  let tocandoId = $state<string | null>(null);
  let confirmandoTudo = $state(false);
  let relogioTudo: ReturnType<typeof setTimeout> | null = null;
  let fim = $state<HTMLElement | null>(null);
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
    await guardar(nova);
  }

  /** Guarda a gravação na lista (no topo). Se não der (cota cheia, armazenamento indisponível), ela fica na tela para a pessoa ouvir e a tela explica. */
  async function guardar(nova: Gravacao) {
    erroGuardar = false;
    rastro(`guardando ${nova.bytes} bytes`);
    const comeco = performance.now();
    const salvando = gravacoes.salvar(nova.blob, nova.tipo, nova.segundos);
    try {
      const meta = await comLimite(salvando, LIMITE_PARA_GUARDAR_MS, "o armazenamento demorou demais para guardar a gravação");
      rastro(`guardada em ${Math.round(performance.now() - comeco)} ms`);
      URL.revokeObjectURL(nova.url); // o arquivo já está no armazenamento; a lista o lê de lá quando a pessoa tocar em Ouvir
      if (destruido) return;
      itens = [meta, ...itens];
      void atualizarResumo(); // relê do armazenamento (não conta às cegas: o número que a confirmação de "Apagar todas" mostra tem de ser o verdadeiro)
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
            itens = [meta, ...itens];
            erroGuardar = false;
            descartar();
            void atualizarResumo();
          } else {
            void gravacoes.apagar(meta.id).catch(() => {});
          }
        },
        () => {},
      );
    }
  }

  async function carregarLista() {
    if (carregandoLista) return;
    carregandoLista = true;
    const minhaGeracao = geracao;
    try {
      const ultima = itens[itens.length - 1];
      const p = await gravacoes.listar(TAMANHO_DA_PAGINA, ultima ? { criadaEm: ultima.criadaEm, id: ultima.id } : undefined);
      if (destruido || minhaGeracao !== geracao) return; // "Apagar todas" aconteceu no meio: esta página é do passado
      const jaTem = new Set(itens.map((m) => m.id));
      itens = [...itens, ...p.itens.filter((m) => !jaTem.has(m.id) && !apagadasNaCarga.has(m.id))];
      temMais = p.temMais;
      erroCarga = false;
      if (!resumoLido) void atualizarResumo();
    } catch (e) {
      // Não encerra a paginação (`temMais` fica como estava): o aviso traz "Tentar de novo".
      console.warn("gravador: não foi possível ler as gravações", e);
      erroCarga = true;
    } finally {
      carregandoLista = false;
      listaPronta = true;
      apagadasNaCarga.clear();
    }
  }

  async function atualizarResumo() {
    try {
      resumo = await gravacoes.resumo();
      resumoLido = true;
    } catch (e) {
      console.warn("gravador: não foi possível ler o resumo das gravações", e);
    }
  }

  /** Uma gravação da lista começou a tocar: só ela toca, o hino cala e uma gravação em andamento PARA (o alto-falante entraria nela). */
  function aoTocarItem(id: string) {
    tocandoId = id;
    reproducao.parar();
    if (gravando) void parar();
  }

  async function apagarUma(id: string) {
    try {
      if (carregandoLista) apagadasNaCarga.add(id);
      await gravacoes.apagar(id);
      itens = itens.filter((m) => m.id !== id);
      if (tocandoId === id) tocandoId = null;
      erroAcao = false;
      void atualizarResumo();
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
      geracao++; // uma página em leitura agora é descartada (traria gravações que vão deixar de existir)
      await gravacoes.apagarTodas();
      itens = [];
      temMais = false;
      tocandoId = null;
      erroAcao = false;
      erroCarga = false;
      void atualizarResumo();
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
  // Paginação: quando o fim da lista chega perto da tela (600 px antes), carrega a próxima página. O observador é refeito a cada página, porque, se o fim
  // continua à vista depois de carregar (tela alta, página curta), o navegador só avisaria de uma MUDANÇA e a lista ficaria parada.
  $effect(() => {
    void itens.length;
    if (!fim || !temMais || !ativa) return;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) void carregarLista();
      },
      { rootMargin: "0px 0px 600px 0px" },
    );
    observador.observe(fim);
    return () => observador.disconnect();
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
    void carregarLista();
    void atualizarResumo();
    return () => {
      soltarAviso();
      soltarFalha();
      emCurso.parar = null;
    };
  });
  /** A tela inicial se foi (a pessoa abriu um hino) com a gravação seguindo em outra aba: para, GUARDA o que foi gravado e devolve o microfone. */
  const MOTIVO_DEMORA = "o armazenamento demorou demais para guardar a gravação";

  async function pararEGuardarAoSair() {
    try {
      // `parar()` já tem o seu limite (entrega o que foi gravado se o `stop` não vier): sem um segundo, mais curto ou igual, que descartaria a entrega parcial.
      const nova = await gravador.parar();
      if (!nova) {
        // Gravação vazia (nada chegou do microfone): não há o que guardar e nada falhou, então sem aviso de erro.
        console.warn("gravador: nada foi gravado ao sair da tela");
        return;
      }
      URL.revokeObjectURL(nova.url);
      const salvando = gravacoes.salvar(nova.blob, nova.tipo, nova.segundos);
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
  <p class="meta">{t("gravador.explica")}</p>
  {#if erro}<Aviso tipo="erro">{t(textoErro[erro])}</Aviso>{/if}
  {#if erroGuardar}<Aviso tipo="erro">{t("gravador.erro_guardar")}</Aviso>{/if}

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
      <h2 id="titulo-guardadas">{t("gravador.guardadas")}</h2>
      {#if resumo.quantidade > 0}
        <span class="meta" id="resumo-gravacoes">{i18n.tn("plural.gravacoes", resumo.quantidade)} · {formatarTamanho(resumo.bytes, i18n.idioma)}</span>
      {/if}
    </div>
    {#if erroAcao}<Aviso tipo="erro">{t("gravador.erro_lista")}</Aviso>{/if}
    {#if erroCarga}
      <Aviso tipo="erro">{t("gravador.erro_ler")}</Aviso>
      <button id="tentar-lista" class="botao" onclick={carregarLista}>{t("erro.tentar")}</button>
    {/if}
    {#if itens.length > 0}
      <ul class="lista" id="lista-gravacoes">
        {#each itens as m (m.id)}
          <ItemGravacao meta={m} {tocandoId} aoTocar={aoTocarItem} aoApagar={apagarUma} />
        {/each}
      </ul>
      {#if temMais}
        <div bind:this={fim} id="fim-lista" class="fim-lista"><span class="meta">{t("gravador.carregando_mais")}</span></div>
      {/if}
      <button id="apagar-todas" class="botao" class:perigo={confirmandoTudo} onclick={apagarTodas}>
        {confirmandoTudo ? t("gravador.apagar_todas_mesmo", { n: resumo.quantidade }) : t("gravador.apagar_todas")}
      </button>
    {:else if listaPronta && !erroCarga && !erroAcao}
      <p class="meta" id="lista-vazia">{t("gravador.nenhuma")}</p>
    {/if}
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
  .fim-lista { display: grid; place-items: center; min-height: 2.5rem; }
  .perigo { border-width: 0.125rem; border-color: var(--perigo); font-weight: 700; }
</style>
