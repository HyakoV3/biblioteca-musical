<script lang="ts">
  import { page } from "$app/state";
  import { nomeDaTonalidade } from "#lib/notacao";
  import { notacao } from "#lib/notacao.svelte";
  import Abas from "#lib/Abas.svelte";
  import Aviso from "#lib/Aviso.svelte";
  import Barra from "#lib/Barra.svelte";
  import { biblioteca } from "#lib/biblioteca.svelte";
  import Estado from "#lib/Estado.svelte";
  import Icone from "#lib/Icone.svelte";
  import { traduzirErro } from "#lib/erros";
  import { i18n } from "#lib/i18n/index.svelte";
  import AndamentoDoTopo from "#lib/AndamentoDoTopo.svelte";
  import { estrofes } from "#lib/letra";
  import { marcaEm, marcasDaVez, sincroniaCombina, type Marca } from "#lib/karaoke";
  import { usarVoltar } from "#lib/navegacao";
  import Partitura from "#lib/Partitura.svelte";
  import { estadoDaPartitura, temAbaPartitura } from "#lib/partitura";
  import Player from "#lib/Player.svelte";
  import { ESCALAS_LETRA, PASSO_PADRAO, escalaDoPasso, limitarPasso, type Alinhamento } from "#lib/leitura";
  import ControleDeTamanho from "#lib/ControleDeTamanho.svelte";
  import { telaLigada } from "#lib/telaLigada.svelte";
  import { lerKaraoke, lerLeitura, salvarKaraoke, salvarLeitura } from "#lib/preferencias";
  import { reproducao } from "#lib/reproducao.svelte";
  import { ultimoHino } from "#lib/ultimoHino.svelte";
  import { untrack } from "svelte";

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const voltar = usarVoltar();

  type Aba = "letra" | "ouvir" | "partitura";

  const numero = $derived(Number(page.params.numero));
  const hino = $derived(biblioteca.hino(numero));
  const partes = $derived(hino ? estrofes(hino.letra) : []);
  const temAudio = $derived((hino?.vozes.length ?? 0) > 0);
  // Partitura (I-08): a aba existe nos hinos que têm partitura importada e, enquanto nenhum pacote com partituras foi importado,
  // em todos (com um aviso e um botão para Ajustes). Num pacote que tem partituras, não aparece nos hinos que não têm.
  const estadoPartitura = $derived(estadoDaPartitura(biblioteca.pacote?.partituras ?? [], numero));
  const temPartitura = $derived(temAbaPartitura(estadoPartitura));
  // As abas deste hino, na ordem da barra. Com só a Letra não há barra.
  const abas = $derived<Aba[]>([...(temAudio ? (["ouvir"] as const) : []), "letra", ...(temPartitura ? (["partitura"] as const) : [])]);
  const ROTULOS = { ouvir: "hino.aba_ouvir", letra: "hino.aba_letra", partitura: "hino.aba_partitura" } as const;
  // Idioma do conteúdo (título e letra), quando o hinário o declara; a interface pode estar em outra língua.
  const idiomaConteudo = $derived(biblioteca.pacote?.hinario.hinario.idioma ?? undefined);
  // Linhas de apoio sob o título: tonalidade e autoria, cada uma na sua linha, quando existirem.
  const subtitulo = $derived.by(() => {
    if (!hino) return undefined;
    const partes = [
      hino.tonalidade ? t("hino.tonalidade", { tom: nomeDaTonalidade(hino.tonalidade, i18n.idioma, notacao.atual) }) : null,
      hino.autoria ? t("hino.autoria", { nome: hino.autoria }) : null,
    ].filter(Boolean);
    return partes.length ? (partes as string[]) : undefined;
  });
  // O hino aberto vira o "último hino" (I-17): a lista de hinos o marca e oferece "Continuar de onde parou". Só se o hino existe no hinário.
  $effect(() => {
    if (hino) ultimoHino.definir(hino.numero);
  });
  const tituloPagina = $derived(hino ? `${hino.numero} · ${hino.titulo}` : t("biblioteca.titulo"));

  // --- Aparência da letra (I-04): tamanho e alinhamento, lembrados no aparelho e iguais em todos os hinos. ---
  const leituraSalva = lerLeitura();
  let passoLetra = $state(leituraSalva.passo);
  let alinhamento = $state<Alinhamento>(leituraSalva.alinhamento);
  const escalaLetra = $derived(escalaDoPasso(passoLetra));
  function tamanhoLetra(acao: "menos" | "padrao" | "mais") {
    passoLetra = acao === "padrao" ? PASSO_PADRAO : limitarPasso(passoLetra + (acao === "mais" ? 1 : -1));
    salvarLeitura({ passo: passoLetra, alinhamento });
  }
  function alinharLetra(a: Alinhamento) {
    alinhamento = a;
    salvarLeitura({ passo: passoLetra, alinhamento });
  }

  // --- Karaokê da letra: acende a estrofe da vez, a linha e o trecho (sílaba) que está soando. ---
  // Só existe se o hino traz a sincronia e ela combina com a letra (se a letra foi editada, fica desligado).
  const sincroniaOk = $derived(!!hino && temAudio && sincroniaCombina(hino.letra, hino.sincronia));
  let karaoke = $state(lerKaraoke());
  const karaokeAtivo = $derived(karaoke && sincroniaOk);
  // Karaokê da partitura (I-12, fase B): o hino traz os compassos (o conversor os emite) e há o que tocar. O liga/desliga é o MESMO da letra.
  const compassosOk = $derived(!!hino?.compassos && temAudio);
  type Aceso = { estrofe: number; linha: number; de: number; ate: number };
  let aceso = $state<Aceso | null>(null);

  // As marcas de cada vez, calculadas uma vez por (passada, estrofe) e guardadas até trocar de hino.
  let marcasPorVez = new Map<string, Marca[]>();
  $effect(() => {
    void hino;
    marcasPorVez = new Map();
  });

  /** Lê onde a música está agora e atualiza o trecho aceso (só mexe no estado se mudou). */
  function atualizarKaraoke() {
    const sinc = hino?.sincronia;
    const p = karaokeAtivo && hino && sinc ? reproducao.ponto(hino.numero) : null;
    if (!p || p.parte === "intro" || !sinc) {
      if (aceso !== null) aceso = null;
      return;
    }
    const usaFinal = p.final && !!sinc.final;
    const chave = `${usaFinal ? "f" : "n"}${p.parte}`;
    let marcas = marcasPorVez.get(chave);
    if (!marcas) {
      marcas = marcasDaVez(usaFinal ? sinc.final! : sinc.normal, p.parte);
      marcasPorVez.set(chave, marcas);
    }
    const m = marcaEm(marcas, p.batida);
    const novo: Aceso | null = m ? { estrofe: m.estrofe, linha: m.linha, de: m.de, ate: m.ate } : null;
    const a = aceso;
    if (novo?.estrofe !== a?.estrofe || novo?.linha !== a?.linha || novo?.de !== a?.de || novo?.ate !== a?.ate) aceso = novo;
  }

  // Enquanto toca, lê o relógio do áudio a cada quadro (o `decorrido` do store só anda a cada 200 ms). Parado ou
  // pausado, lê uma vez a cada mudança. Fora da aba Letra não gasta nada.
  $effect(() => {
    const vendo = karaokeAtivo && aba === "letra";
    void hino;
    const estado = reproducao.estado;
    void reproducao.atual;
    if (!vendo) {
      untrack(() => {
        if (aceso !== null) aceso = null;
      });
      return;
    }
    untrack(atualizarKaraoke);
    if (estado !== "tocando") return;
    let id = 0;
    const quadro = () => {
      atualizarKaraoke();
      id = requestAnimationFrame(quadro);
    };
    id = requestAnimationFrame(quadro);
    return () => cancelAnimationFrame(id);
  });

  // Rola até a linha só quando ela muda e só se não estiver à vista (entre a barra de cima e as de baixo). A rolagem
  // é suave só se a pessoa não pediu menos movimento (regra `scroll-behavior` em movimento.css).
  let ultimaLinha = "";
  $effect(() => {
    const a = aceso;
    if (!a) {
      ultimaLinha = "";
      return;
    }
    const chave = `${a.estrofe}-${a.linha}`;
    if (chave === ultimaLinha) return;
    ultimaLinha = chave;
    const el = document.getElementById(`linha-${chave}`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const topo = (document.querySelector("header")?.getBoundingClientRect().bottom ?? 0) + 8;
    const css = getComputedStyle(document.documentElement);
    const reservado = (parseFloat(css.getPropertyValue("--altura-miniplayer")) || 0) + (parseFloat(css.getPropertyValue("--altura-navegacao")) || 0);
    if (r.top < topo || r.bottom > window.innerHeight - reservado - 8) el.scrollIntoView({ block: "center" });
  });

  function alternarKaraoke() {
    karaoke = !karaoke;
    salvarKaraoke(karaoke);
  }

  let aba = $state<Aba>("letra");
  // O botão do karaokê só aparece onde o destaque acontece: na aba Letra, em hino que traz a sincronia, e na aba Partitura, em hino que traz os compassos.
  // O andamento só tem o que mexer num hino com som, nas abas que mostram a música andando (Letra e Partitura; na Ouvir ele já está na tela).
  const mostrarAndamento = $derived(temAudio && (aba === "letra" || (aba === "partitura" && temPartitura)));
  const mostrarKaraoke = $derived((sincroniaOk && aba === "letra") || (compassosOk && temPartitura && aba === "partitura"));
  // Ao abrir um hino: Ouvir primeiro (se houver notas para tocar); sem notas, só existe a Letra.
  $effect(() => {
    aba = hino && hino.vozes.length > 0 ? "ouvir" : "letra";
  });

  // Avisa o miniplayer quando o painel Ouvir deste hino está na tela (ele some para não duplicar controles).
  $effect(() => {
    reproducao.painelNumero = aba === "ouvir" && temAudio && hino ? hino.numero : null;
    return () => {
      reproducao.painelNumero = null;
    };
  });

</script>

<!-- O título do documento é o que leitores de tela anunciam a cada troca de tela. -->
<svelte:head><title>{tituloPagina} · Biblioteca Musical</title></svelte:head>

<!-- Karaokê: botão só de ícone no cabeçalho (marca-texto vazado = desligado, cheio = ligado, e o ligado leva borda dourada,
     então o estado não depende só da cor; o microfone fica para o gravador e o afinador). O nome e a explicação vão no rótulo de acessibilidade e na dica; `aria-pressed` diz o estado ao leitor de tela. -->
{#snippet botaoKaraoke()}
  <button
    class="botao botao-icone chave-karaoke"
    aria-pressed={karaoke}
    aria-label={t("hino.karaoke")}
    title={`${t("hino.karaoke")}: ${karaoke ? t("hino.karaoke_ligado") : t("hino.karaoke_desligado")}. ${t("hino.karaoke_ajuda")}`}
    onclick={alternarKaraoke}
  >
    <Icone nome={karaoke ? "karaoke_ligado" : "karaoke"} tamanho={26} />
  </button>
{/snippet}

<!-- Manter a tela ligada: o olho (vazado = desligado, cheio = ligado, com borda dourada). Vale para o hino que toca, em qualquer aba; ao pausar, parar ou terminar a tela volta ao tempo do sistema. -->
{#snippet botaoTela()}
  <button
    class="botao botao-icone chave-tela"
    id="manter-tela"
    aria-pressed={telaLigada.manter}
    aria-label={t("hino.tela")}
    title={`${t("hino.tela")}: ${telaLigada.manter ? t("hino.tela_ligada") : t("hino.tela_desligada")}. ${t("hino.tela_ajuda")}`}
    onclick={() => telaLigada.alternar()}
  >
    <Icone nome={telaLigada.manter ? "tela_ligada" : "tela"} tamanho={26} />
  </button>
{/snippet}

<!-- O topo das abas Letra e Partitura: o andamento (o mesmo controle da aba Ouvir) e o karaokê. -->
{#snippet acoesDoTopo()}
  <span class="acoes-do-topo">
    {#if mostrarAndamento && hino}{#key hino.numero}<AndamentoDoTopo {hino} />{/key}{/if}
    {#if mostrarKaraoke}{@render botaoKaraoke()}{/if}
    {#if temAudio}{@render botaoTela()}{/if}
  </span>
{/snippet}

{#if biblioteca.erro}
  <Barra titulo={t("biblioteca.titulo")} {voltar} rotuloVoltar={t("nav.voltar")} />
  <main class="coluna conteudo"><Aviso tipo="erro">{t("erro.carregar", { erro: traduzirErro(biblioteca.erro, t) })}</Aviso></main>
{:else if !biblioteca.pacote}
  <Barra titulo={t("biblioteca.titulo")} {voltar} rotuloVoltar={t("nav.voltar")} />
  <main class="coluna conteudo"><Estado tipo="carregando" texto={t("carregando")} /></main>
{:else if !hino}
  <Barra titulo={t("biblioteca.titulo")} {voltar} rotuloVoltar={t("nav.voltar")} />
  <main class="coluna conteudo">
    <Estado tipo="vazio" texto={t("hino.nao_encontrado")}>
      {#snippet acao()}<a class="botao" href="/">{t("biblioteca.titulo")}</a>{/snippet}
    </Estado>
  </main>
{:else}
  <Barra
    titulo={`${hino.numero} · ${hino.titulo}`}
    subtitulo={subtitulo}
    lang={idiomaConteudo}
    {voltar}
    rotuloVoltar={t("nav.voltar")}
    acao={mostrarAndamento || mostrarKaraoke || temAudio ? acoesDoTopo : undefined}
  />

  <!-- Na aba Partitura a coluna perde o limite de 40rem (até 64rem): numa tela larga (celular deitado, tablet) a partitura de paisagem usa a
       largura toda, em vez de uma faixa estreita no meio. -->
  <main class="coluna conteudo" class:partitura-larga={aba === "partitura"}>
    <!-- Os dois painéis ficam montados (só um visível): o som não para ao trocar de aba. -->
    <div role="tabpanel" id="painel-letra" aria-labelledby={abas.length > 1 ? "aba-letra" : undefined} hidden={aba !== "letra"}>
      {#if !temAudio}
        <Aviso tipo="info">{t("hino.sem_audio")}</Aviso>
      {/if}
      {#if partes.length > 0}
        <div class="barra-letra" role="group" aria-label={t("letra.aparencia")}>
          <ControleDeTamanho
            rotulos={{
              grupo: t("letra.tamanho"),
              diminuir: t("letra.diminuir"),
              restaurar: t("letra.restaurar", { n: Math.round(ESCALAS_LETRA[PASSO_PADRAO] * 100) }),
              aumentar: t("letra.aumentar"),
            }}
            podeDiminuir={passoLetra > 0}
            podeAumentar={passoLetra < ESCALAS_LETRA.length - 1}
            noPadrao={passoLetra === PASSO_PADRAO}
            aoDiminuir={() => tamanhoLetra("menos")}
            aoRestaurar={() => tamanhoLetra("padrao")}
            aoAumentar={() => tamanhoLetra("mais")}
          />
          <div class="grupo" role="group" aria-label={t("letra.alinhamento")}>
            <button class="botao-barra" aria-label={t("letra.alinhar_esquerda")} aria-pressed={alinhamento === "esquerda"} onclick={() => alinharLetra("esquerda")}>
              <Icone nome="alinhar_esquerda" tamanho={24} />
            </button>
            <button class="botao-barra" aria-label={t("letra.alinhar_direita")} aria-pressed={alinhamento === "direita"} onclick={() => alinharLetra("direita")}>
              <Icone nome="alinhar_direita" tamanho={24} />
            </button>
            <button class="botao-barra" aria-label={t("letra.justificar")} aria-pressed={alinhamento === "justificado"} onclick={() => alinharLetra("justificado")}>
              <Icone nome="justificar" tamanho={24} />
            </button>
          </div>
        </div>
      {/if}
      <div lang={idiomaConteudo} class={`letra alinha-${alinhamento}`} style:--escala-letra={escalaLetra}>
        {#each partes as e}
          <div class="estrofe" class:da-vez={aceso !== null && aceso.estrofe === e.numero} class:coro-final={e.coro || e.final}>
            {#if e.coro}<h2 lang={i18n.idioma}>{t("hino.coro")}</h2>{:else if e.final}<h2 lang={i18n.idioma}>{t("hino.final")}</h2>{:else if e.numero !== null}<h2 lang={i18n.idioma}>{t("hino.estrofe", { n: e.numero })}</h2>{/if}
            {#each e.linhas as linha, i}
              {@const acesa = aceso !== null && aceso.estrofe === e.numero && aceso.linha === i}
              <p id={`linha-${e.numero}-${i}`} class:acesa>
                {#if acesa && aceso}{linha.slice(0, aceso.de)}<span class="trecho">{linha.slice(aceso.de, aceso.ate)}</span>{linha.slice(aceso.ate)}{:else}{linha}{/if}
              </p>
            {/each}
          </div>
        {:else}
          <Estado tipo="vazio" texto={t("hino.sem_letra")} />
        {/each}
      </div>
    </div>

    {#if temAudio}
      <div role="tabpanel" id="painel-ouvir" aria-labelledby="aba-ouvir" hidden={aba !== "ouvir"}>
        {#key hino.numero}
          <Player {hino} />
        {/key}
      </div>
    {/if}

    {#if temPartitura}
      <div role="tabpanel" id="painel-partitura" aria-labelledby="aba-partitura" hidden={aba !== "partitura"}>
        {#key hino.numero}
          <Partitura numero={hino.numero} estado={estadoPartitura} ativa={aba === "partitura"} compassos={hino.compassos ?? null} karaoke={karaoke && compassosOk} />
        {/key}
      </div>
    {/if}
  </main>

  <!-- As abas ficam embaixo (ao alcance do polegar); com o celular deitado, numa barra lateral à esquerda. -->
  {#if abas.length > 1}
    <Abas
      abas={abas.map((id) => ({ id, rotulo: t(ROTULOS[id]) }))}
      selecionada={aba}
      aoSelecionar={(id) => (aba = id as Aba)}
      rotulo={t("hino.abas")}
    />
  {/if}
{/if}

<style>
  main.partitura-larga { max-width: 64rem; }
  .botao-icone { min-width: 3rem; padding: 0; }
  .acoes-do-topo { display: inline-flex; align-items: center; gap: 0.25rem; }
  .chave-karaoke[aria-pressed="true"], .chave-tela[aria-pressed="true"] { border: 0.125rem solid var(--ouro-linha); }
  /* A estrofe que soa leva uma barra dourada na borda (o recuo negativo mantém o texto no mesmo lugar). */
  .estrofe { margin-bottom: 1.4rem; margin-left: -1rem; padding-left: calc(1rem - 0.25rem); border-left: 0.25rem solid transparent; }
  .estrofe.da-vez { border-left-color: var(--ouro-linha); }
  /* O coro e o final em negrito, como no hinário impresso (I-33). O negrito já vale antes de acender, então o destaque da sílaba não muda a largura do texto. */
  .estrofe.coro-final p { font-weight: 700; }
  /* Tocando o karaokê, as outras linhas da estrofe esmaecem; a linha atual fica normal e o trecho que soa, em
     destaque dourado com sublinhado (sem mudar o tamanho do texto, para nada "pular"). */
  .estrofe.da-vez p:not(.acesa) { color: var(--suave); }
  .trecho {
    background: var(--ouro); color: var(--ouro-sobre); border-radius: 0.25rem; box-shadow: 0 0 0 0.125rem var(--ouro);
    text-decoration: underline; text-decoration-thickness: 0.125rem; text-underline-offset: 0.1875rem;
  }
  .estrofe h2 { margin: 0 0 0.3rem; font-size: 0.8rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--suave); }
  /* O tamanho multiplica o de base (em rem, que já segue a fonte do sistema), e não o substitui. */
  .estrofe p { margin: 0; font-size: calc(1.15rem * var(--escala-letra, 1)); line-height: 1.7; overflow-wrap: anywhere; }
  .alinha-direita { text-align: right; }
  .alinha-justificado { text-align: justify; hyphens: auto; }

  /* Barra de tamanho e alinhamento da letra (os botões são o `.botao-barra` global). */
  .barra-letra { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.5rem 1rem; margin: 0 0 1.2rem; }
  .barra-letra .grupo { display: flex; gap: 0.4rem; }
</style>
