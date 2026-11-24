<script lang="ts">
  import { tick } from "svelte";
  import Abas from "$lib/Abas.svelte";
  import Afinador from "$lib/Afinador.svelte";
  import Gravador from "$lib/Gravador.svelte";
  import Metronomo from "$lib/Metronomo.svelte";
  import Aviso from "$lib/Aviso.svelte";
  import AvisoHinario from "$lib/AvisoHinario.svelte";
  import Barra from "$lib/Barra.svelte";
  import { biblioteca } from "$lib/biblioteca.svelte";
  import { reproducao } from "$lib/reproducao.svelte";
  import { nomeDaTonalidade } from "$lib/notacao";
  import { notacao } from "$lib/notacao.svelte";
  import Icone from "$lib/Icone.svelte";
  import Estado from "$lib/Estado.svelte";
  import { traduzirErro } from "$lib/erros";
  import { i18n } from "$lib/i18n/index.svelte";
  import { casaComNumero, zerosAEsquerda } from "$lib/numero";
  import { emCurso } from "$lib/gravacaoEmCurso.svelte";
  import { formatarTempo } from "$lib/gravador";
  import { inicio, type AbaInicio } from "$lib/inicio.svelte";
  import { ultimoHino } from "$lib/ultimoHino.svelte";

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  // As abas da tela inicial (I-28): a lista de hinos e as ferramentas. A rolagem é da página (não de um contêiner): ao trocar de aba, ela guarda a
  // posição da que sai e restaura a da que entra, senão a aba curta cortaria a rolagem da lista longa.
  const ABAS: AbaInicio[] = ["hinos", "afinador", "gravador", "metronomo"];
  const ROTULOS = { hinos: "inicio.aba_hinos", afinador: "inicio.aba_afinador", gravador: "inicio.aba_gravador", metronomo: "inicio.aba_metronomo" } as const;
  async function trocarAba(id: string) {
    const nova = id as AbaInicio;
    if (nova === inicio.aba) return;
    inicio.rolagem[inicio.aba] = window.scrollY;
    inicio.aba = nova;
    await tick();
    window.scrollTo(0, inicio.rolagem[nova]);
  }

  // Busca sem diferenciar maiúsculas/minúsculas nem acentos.
  const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  // O último hino aberto (I-17), só se o hinário instalado o tem: marca a linha na lista e dá o atalho "Continuar de onde parou".
  const ultimo = $derived(ultimoHino.numero === null ? undefined : biblioteca.hino(ultimoHino.numero));

  const hinos = $derived.by(() => {
    const todos = biblioteca.pacote?.hinario.hinos ?? [];
    const q = normalizar(biblioteca.busca);
    if (!q) return todos;
    return todos.filter((h) => casaComNumero(q, h.numero) || normalizar(h.titulo).includes(q));
  });
</script>

<!-- O título do documento é o que leitores de tela anunciam a cada troca de tela. -->
<svelte:head><title>{t("biblioteca.titulo")} · Biblioteca Musical</title></svelte:head>

<Barra titulo={t("app.nome_curto")} logo="/favicon.png">
  {#snippet acao()}
    <!-- Botão só de ícone (engrenagem); o nome "Ajustes" vai no rótulo de acessibilidade e na dica. -->
    <a class="botao botao-icone" href="/ajustes" aria-label={t("nav.ajustes")} title={t("nav.ajustes")}>
      <Icone nome="ajustes" tamanho={26} />
    </a>
  {/snippet}
</Barra>

<AvisoHinario />

<main class="coluna conteudo">
  <!-- A gravação segue em outra aba (gravar com o metrônomo no fone): o aviso fica à vista fora da aba Gravador, com o Parar. O tempo é só visual; o leitor de tela
       ouve apenas que há uma gravação em curso (nada de anunciar segundo a segundo). -->
  {#if emCurso.perdida}
    <Aviso tipo="erro"><span id="gravacao-perdida">{t(emCurso.perdida === "incerta" ? "gravador.perdida_incerta" : "gravador.perdida")}</span></Aviso>
    <button class="botao" onclick={() => (emCurso.perdida = null)}>{t("gravador.fechar_aviso")}</button>
  {/if}
  {#if emCurso.gravando && inicio.aba !== "gravador"}
    <div id="gravando-aviso" class="gravando-aviso" role="status">
      <span class="ponto" aria-hidden="true"></span>
      <span class="texto">{t("gravador.em_curso")} <span aria-hidden="true">{formatarTempo(emCurso.decorrido)}</span></span>
      <button class="botao" onclick={() => emCurso.parar?.()}>{t("gravador.parar")}</button>
    </div>
  {/if}
  <!-- Os dois painéis ficam montados (só um visível): a busca e a rolagem da lista não se perdem ao trocar de aba. A aba Afinador não depende
       do hinário carregado. -->
  <div role="tabpanel" id="painel-hinos" aria-labelledby="aba-hinos" hidden={inicio.aba !== "hinos"}>
  {#if biblioteca.erro}
    <Aviso tipo="erro">{t("erro.carregar", { erro: traduzirErro(biblioteca.erro, t) })}</Aviso>
    <button class="botao" onclick={() => biblioteca.carregar()}>{t("erro.tentar")}</button>
  {:else if !biblioteca.pacote}
    <Estado tipo="carregando" texto={t("carregando")} />
  {:else}
    <div class="busca">
      <input
        type="search"
        inputmode="search"
        enterkeyhint="search"
        placeholder={t("lista.buscar")}
        aria-label={t("lista.buscar_aria")}
        bind:value={biblioteca.busca}
      />
      {#if biblioteca.busca}
        <button class="limpar" aria-label={t("biblioteca.limpar_busca")} onclick={() => (biblioteca.busca = "")}>✕</button>
      {/if}
    </div>

    {#if ultimo && !biblioteca.busca}
      <a class="continuar" href={`/hino/${ultimo.numero}`}>
        <span class="continuar-rotulo">{t("biblioteca.continuar")}</span>
        <span class="continuar-hino">{ultimo.numero} · {ultimo.titulo}</span>
      </a>
    {/if}

    {#if hinos.length}
      <ul>
        {#each hinos as h (h.numero)}
          {@const estado = reproducao.atual?.numero === h.numero ? reproducao.estado : "parado"}
          <li>
            <a href={`/hino/${h.numero}`} class:tocando={estado === "tocando"} class:pausado={estado === "pausado"} class:ultimo={ultimo?.numero === h.numero} aria-current={ultimo?.numero === h.numero ? "true" : undefined}>
              <span class="num"><span aria-hidden="true" class="zeros">{zerosAEsquerda(h.numero)}</span>{h.numero}</span>
              <span class="titulo">
                <span>{h.titulo}</span>
                {#if h.autoria}<span class="autoria">{h.autoria}</span>{/if}
              </span>
              {#if estado !== "parado"}
                <!-- O hino que está tocando (ou pausado) leva a borda de destaque E um ícone (não só a cor); o leitor de tela ouve o estado. -->
                <span class="estado"><Icone nome={estado === "tocando" ? "som" : "pause"} tamanho={18} /><span class="so-leitor">{t(estado === "tocando" ? "biblioteca.tocando" : "biblioteca.pausado")}</span></span>
              {/if}
              {#if ultimo?.numero === h.numero && estado === "parado"}<span class="so-leitor">{t("biblioteca.ultimo")}</span>{/if}
              {#if h.tonalidade}<small>{nomeDaTonalidade(h.tonalidade, i18n.idioma, notacao.atual)}</small>{/if}
            </a>
          </li>
        {/each}
      </ul>
    {:else}
      <Estado tipo="vazio" texto={t("biblioteca.sem_resultado", { termo: biblioteca.busca })}>
        {#snippet acao()}
          <button class="botao" onclick={() => (biblioteca.busca = "")}>{t("biblioteca.limpar_busca")}</button>
        {/snippet}
      </Estado>
    {/if}

    <p class="fonte meta">
      {#if biblioteca.pacote.exemplo}
        {t("biblioteca.aviso_exemplo")} <a href="/ajustes">{t("nav.ajustes")}</a>
      {:else}
        {t("biblioteca.fonte", {
          nome: biblioteca.pacote.hinario.hinario.nome,
          total: i18n.tn("plural.hinos", biblioteca.pacote.hinario.hinos.length),
        })}
      {/if}
    </p>
  {/if}
  </div>
  <div role="tabpanel" id="painel-afinador" aria-labelledby="aba-afinador" hidden={inicio.aba !== "afinador"}>
    <Afinador ativa={inicio.aba === "afinador"} />
  </div>
  <div role="tabpanel" id="painel-gravador" aria-labelledby="aba-gravador" hidden={inicio.aba !== "gravador"}>
    <Gravador ativa={inicio.aba === "gravador"} />
  </div>
  <div role="tabpanel" id="painel-metronomo" aria-labelledby="aba-metronomo" hidden={inicio.aba !== "metronomo"}>
    <Metronomo ativa={inicio.aba === "metronomo"} />
  </div>
</main>

<!-- As abas ficam embaixo (ao alcance do polegar); com o celular deitado, numa barra lateral à esquerda. -->
<Abas
  abas={ABAS.map((id) => ({ id, rotulo: t(ROTULOS[id]) }))}
  selecionada={inicio.aba}
  aoSelecionar={trocarAba}
  rotulo={t("inicio.abas")}
/>

<style>
  .busca { position: relative; margin-bottom: 0.8rem; }
  input[type="search"] {
    width: 100%; box-sizing: border-box; min-height: 3rem; padding: 0.7rem 3rem 0.7rem 0.9rem;
    font-size: 1rem; color: var(--texto); background: var(--superficie);
    border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem;
    -webkit-appearance: none; appearance: none;
  }
  input[type="search"]::placeholder { color: var(--suave); opacity: 1; }
  input[type="search"]::-webkit-search-cancel-button { display: none; }
  .limpar {
    position: absolute; right: 0; top: 0; width: 3rem; height: 3rem; font-size: 1.1rem;
    background: transparent; border: 0; color: var(--suave); cursor: pointer;
  }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.4rem; }
  li > a {
    min-height: 3.5rem; box-sizing: border-box; display: flex; align-items: center; gap: 0.8rem;
    padding: 0.5rem 0.9rem; text-decoration: none; color: var(--texto);
    background: var(--superficie); border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem;
  }
  /* O hino que toca: borda na cor de destaque (um fio a mais por fora, sem mexer no tamanho da caixa) e o ícone de som; pausado, a borda fica mais fraca e o ícone é o de pausa. */
  li > a.tocando { border-color: var(--acento); box-shadow: 0 0 0 0.0625rem var(--acento); }
  li > a.pausado { border-color: color-mix(in srgb, var(--acento) 55%, var(--borda-controle)); }
  /* O último hino aberto: um anel dourado de 2 px por fora (o formato diz "este", e não só a cor; sem mexer no tamanho da caixa). Vem DEPOIS das regras de tocando e pausado (mesma especificidade); por isso as duas combinações `.ultimo.tocando` e `.ultimo.pausado` repetem a cor delas, que manda quando o hino soa ou está pausado. */
  li > a.ultimo { border-color: var(--ouro-linha); box-shadow: 0 0 0 0.125rem var(--ouro-linha); }
  li > a.ultimo.tocando { border-color: var(--acento); box-shadow: 0 0 0 0.125rem var(--acento); }
  li > a.ultimo.pausado { border-color: color-mix(in srgb, var(--acento) 55%, var(--borda-controle)); box-shadow: 0 0 0 0.125rem color-mix(in srgb, var(--acento) 55%, var(--borda-controle)); }
  .continuar {
    display: flex; flex-direction: column; gap: 0.1rem; min-height: 3rem; box-sizing: border-box; padding: 0.5rem 0.9rem; margin-bottom: 0.8rem;
    text-decoration: none; color: var(--texto); background: var(--superficie); border: 0.0625rem solid var(--ouro-linha); border-radius: 0.75rem;
  }
  .continuar-rotulo { font-size: 0.85rem; color: var(--suave); }
  .continuar-hino { font-weight: 700; overflow-wrap: anywhere; }
  .estado { flex: none; display: inline-flex; color: var(--acento); }
  /* Três dígitos com zeros à esquerda e algarismos de mesma largura: os números alinham em coluna. */
  .botao-icone { min-width: 3rem; padding: 0; }
  .num { font-weight: 700; min-width: 2.8rem; font-variant-numeric: tabular-nums; }
  .zeros { color: var(--suave); font-weight: 400; }
  .titulo { flex: 1; min-width: 0; overflow-wrap: anywhere; display: flex; flex-direction: column; }
  .autoria { font-size: 0.85rem; color: var(--suave); }
  small { color: var(--suave); }
  .fonte { margin-top: 1.2rem; }
  /* O aviso de gravação em curso nas outras abas: uma faixa com o ponto, o texto e o Parar (o ponto é só enfeite: o texto diz "Gravando"). */
  .gravando-aviso { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; margin-bottom: 0.75rem; border: 0.0625rem solid var(--ouro-linha); border-radius: 0.75rem; background: var(--superficie); }
  .gravando-aviso .ponto { width: 0.9rem; height: 0.9rem; border-radius: 50%; background: currentColor; flex: none; }
  .gravando-aviso .texto { flex: 1; min-width: 0; font-variant-numeric: tabular-nums; }
  .gravando-aviso button { min-height: 3rem; }
</style>
