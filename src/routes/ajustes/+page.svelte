<script lang="ts">
  import { onMount, tick } from "svelte";
  import { page } from "$app/state";
  import Icone from "#lib/Icone.svelte";
  import type { Chave } from "#lib/i18n/pt";
  import { sons } from "#lib/sons/pacotes.svelte";
  import { formatarMB } from "#lib/sons/formato";
  import { bytesDoPacote, bytesParaBaixar } from "#lib/sons/tipos";
  import Aviso from "#lib/Aviso.svelte";
  import Cartao from "#lib/Cartao.svelte";
  import LinhaPacote from "#lib/LinhaPacote.svelte";
  import Barra from "#lib/Barra.svelte";
  import { biblioteca } from "#lib/biblioteca.svelte";
  import { IDIOMAS, i18n, type Idioma } from "#lib/i18n/index.svelte";
  import { usarVoltar } from "#lib/navegacao";
  import { reproducao } from "#lib/reproducao.svelte";
  import { ESTILOS, TEMAS, estilo, tema } from "#lib/tema.svelte";
  import { CREDITOS, semLicenca, textoDaLicenca } from "#lib/licencas";
  import { traduzirErro } from "#lib/erros";
  import { listaCurta, porcentagemTotal } from "#lib/pacote";
  import { hinario } from "#lib/hinario/hinario.svelte";
  import { NOTACOES } from "#lib/notacao";
  import { notacao } from "#lib/notacao.svelte";
  import { MODOS, aoMedir, lerModo, rotaAtual, salvarModo, ultimaMedida, type Modo } from "#lib/saidaAudio";
  import { instalando } from "#lib/instalando.svelte";
  import { partituras } from "#lib/partituras/partituras.svelte";
  import { lerAjustes, lerCiente, salvarAjustes, salvarCiente } from "#lib/preferencias";
  // O aviso "app independente e não oficial": fica na tela até a pessoa dizer "Concordo"; aí some e a escolha é guardada.
  let ciente = $state(lerCiente());
  function concordar() {
    salvarCiente();
    ciente = true;
  }

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
  const voltar = usarVoltar();

  let resultado = $state<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  let confirmando = $state(false);
  // Cada bloco é um cartão recolhível, fechado de saída: a linha de resumo ao lado do título mostra o estado sem abrir. Aparência, Idioma e
  // Conteúdo lembram se a pessoa os deixou abertos (`prefs.ajustes`); Sobre e Créditos abrem sempre fechados.
  const lembrado = lerAjustes();
  let aparenciaAberta = $state(lembrado.aparencia);
  let idiomaAberto = $state(lembrado.idioma);
  let conteudoAberto = $state(lembrado.conteudo);
  /** Grava só o que a PESSOA escolheu: o `Cartao` chama isto no clique, e não quando o programa abre um cartão (o link da aba Partitura). */
  const lembrar = (cartao: keyof typeof lembrado) => (aberto: boolean) => {
    lembrado[cartao] = aberto;
    salvarAjustes(lembrado);
  };

  // O botão "Abrir Ajustes" da aba Partitura traz `?abrir=partituras`: abre o Conteúdo e rola até as partituras. Essa abertura NÃO é lembrada. Não conto
  // com a abertura automática do <details> ao seguir um #hash (depende da versão da WebView): o cartão é aberto por aqui.
  onMount(async () => {
    if (page.url.searchParams.get("abrir") !== "partituras") return;
    conteudoAberto = true;
    await tick();
    document.getElementById("partituras")?.scrollIntoView({ block: "start" });
  });
  // --- Saída de áudio: o modo do AudioContext, guardado POR rota (alto-falante, fio, USB-C, Bluetooth). A rota é relida ao abrir o cartão e ao voltar ao app
  // (a pessoa pode ligar o fone com o app aberto); as medidas vêm do último contexto criado (hino, metrônomo ou afinador). ---
  let saidaAberta = $state(false);
  const rotaInicial = rotaAtual();
  let rotaDeSaida = $state(rotaInicial);
  let modoDeSaida = $state<Modo>(lerModo(rotaInicial));
  let medidaDeSaida = $state(ultimaMedida());
  const reler = () => {
    rotaDeSaida = rotaAtual();
    modoDeSaida = lerModo(rotaDeSaida);
    medidaDeSaida = ultimaMedida();
  };
  onMount(() => {
    const cancelar = aoMedir(() => (medidaDeSaida = ultimaMedida()));
    const aoVoltar = () => document.visibilityState === "visible" && reler();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      cancelar();
      document.removeEventListener("visibilitychange", aoVoltar);
    };
  });
  const escolherModo = (m: Modo) => {
    modoDeSaida = m;
    salvarModo(rotaDeSaida, m);
  };
  const aviso = (v: number | null) => (v === null ? t("saida.nao_informa") : `${v} ms`);
  const textoDaMedida = $derived(
    medidaDeSaida
      ? `${t("saida.medida_modo", { rota: t(`saida.rota_curta.${medidaDeSaida.rota}`), modo: t(`saida.${medidaDeSaida.modo}`) })} ${t("saida.medida", { taxa: medidaDeSaida.taxa, base: aviso(medidaDeSaida.base), saida: aviso(medidaDeSaida.saida) })}`
      : t("saida.sem_medida"),
  );

  // O texto do "Sobre o app" é longo: fica num card fechado, que a pessoa abre se quiser ler.
  let sobreAberto = $state(false);
  // Os créditos também ficam num card fechado: é informação de licença, que quase ninguém precisa ler no dia a dia.
  let creditosAberto = $state(false);

  // Código do erro do download -> texto traduzido.
  const erroDoSom = (codigo: string): Chave =>
    codigo === "rede" ? "sons.erro_rede"
    : codigo === "armazenamento" ? "sons.erro_armazenamento"
    : codigo === "outro" ? "sons.erro_outro"
    : "sons.erro_arquivo";

  // --- Hinário: baixar do servidor (o texto e a música dos hinos não vão dentro do app) e remover, no molde das partituras. ---
  const hinarioInstalado = $derived(biblioteca.pacote !== null && !biblioteca.pacote.exemplo);
  const estadoHinario = $derived.by(() => {
    const estado = hinarioInstalado ? t("hinario.instalado") : hinario.disponivel ? t("hinario.nao_instalado") : t("hinario.indisponivel");
    return hinario.disponivel ? `${formatarMB(hinario.bytes, i18n.idioma)} · ${estado}` : estado;
  });
  const erroDoHinario = $derived.by(() => {
    const e = hinario.andamento.erro;
    if (!e) return "";
    if ("codigo" in e) return t(e.codigo === "rede" ? "sons.erro_rede" : "sons.erro_arquivo");
    return traduzirErro(e.bruto, t);
  });

  // --- Partituras (I-08): baixar do servidor e remover, no molde dos sons gravados. ---
  const instaladas = $derived(biblioteca.pacote?.partituras.length ?? 0);
  // "0,2 MB · Não instaladas" (o tamanho só aparece quando há pacote publicado).
  const estadoPartituras = $derived.by(() => {
    const estado =
      instaladas > 0
        ? t("partituras.instaladas", { total: i18n.tn("plural.partituras", instaladas) })
        : partituras.disponivel
          ? t("partituras.nao_instaladas")
          : t("partituras.indisponivel");
    return partituras.disponivel ? `${formatarMB(partituras.bytes, i18n.idioma)} · ${estado}` : estado;
  });
  // O erro do download: código do pacote (rede, integridade...) ou texto do Rust (JSON de códigos), traduzido.
  const erroDasPartituras = $derived.by(() => {
    const e = partituras.andamento.erro;
    if (!e) return "";
    if ("codigo" in e) {
      return t(e.codigo === "rede" ? "sons.erro_rede" : "sons.erro_arquivo");
    }
    return traduzirErro(e.bruto, t);
  });

  // --- Resumos dos cartões fechados. ---
  const resumoAparencia = $derived(
    // O Alto contraste tem paleta própria e ignora o estilo: só ele aparece.
    tema.atual === "alto-contraste" ? t("tema.alto-contraste") : `${t(`tema.${tema.atual}`)} · ${t(`estilo.${estilo.atual}`)}`,
  );
  // O resumo do Conteúdo: o hinário, as partituras e os sons. Durante um download ou depois de um erro, mostra isso (com ícone no erro),
  // porque o progresso e o aviso ficam DENTRO do cartão e não se veriam com ele fechado.
  const resumoConteudo = $derived.by((): { texto: string; alerta: boolean } => {
    const sonsAndamento = sons.pacotes.map((p) => sons.andamento(p.id));
    if (partituras.andamento.fase === "erro" || sonsAndamento.some((a) => a.fase === "erro")) {
      return { texto: t("ajustes.resumo_erro"), alerta: true };
    }
    const np = porcentagemTotal(partituras.andamento.fase, partituras.andamento.progresso);
    if (partituras.andamento.fase === "baixando") return { texto: `${t("partituras.titulo")}: ${t("partituras.baixando", { n: np })}`, alerta: false };
    if (partituras.andamento.fase === "conferindo") return { texto: `${t("partituras.titulo")}: ${t("partituras.conferindo")}`, alerta: false };
    if (partituras.andamento.fase === "instalando") return { texto: `${t("partituras.titulo")}: ${t("partituras.instalando")}`, alerta: false };
    const ativo = sonsAndamento.find((a) => a.fase === "baixando" || a.fase === "conferindo" || a.fase === "instalando");
    if (ativo) {
      const texto = ativo.fase === "baixando" ? t("sons.baixando", { n: porcentagemTotal(ativo.fase, ativo.progresso) }) : ativo.fase === "conferindo" ? t("sons.conferindo") : t("sons.instalando");
      return { texto: `${t("sons.titulo")}: ${texto}`, alerta: false };
    }
    const hinario = !biblioteca.pacote ? "…" : biblioteca.pacote.exemplo ? t("ajustes.resumo_exemplo") : biblioteca.pacote.hinario.hinario.nome;
    const parts = instaladas > 0 ? i18n.tn("plural.partituras", instaladas) : t("ajustes.resumo_sem_partituras");
    const algumSom = sons.pacotes.some((p) => sons.pacoteInstalado(p));
    return { texto: `${hinario} · ${parts} · ${algumSom ? t("ajustes.resumo_sons") : t("ajustes.resumo_sem_sons")}`, alerta: false };
  });

  async function remover() {
    confirmando = false;
    try {
      await biblioteca.remover();
      reproducao.limpar();
      resultado = { tipo: "sucesso", texto: t("remover.ok") };
    } catch (err) {
      resultado = { tipo: "erro", texto: t("remover.erro", { erro: String(err) }) };
    }
  }
</script>

<svelte:head><title>{t("ajustes.titulo")} · Biblioteca Musical</title></svelte:head>

<!-- "Em nome do Senhor Jesus": ao lado do título quando cabe e, se não couber (tela estreita, letra grande), na linha de baixo, à direita (`quebra`): o título não quebra no meio da palavra. -->
<Barra titulo={t("ajustes.titulo")} {voltar} rotuloVoltar={t("nav.voltar")} quebra>
  {#snippet acao()}<span class="nome-senhor">{t("sobre.nome_titulo")}</span>{/snippet}
</Barra>

<main class="coluna conteudo">
  <!-- Aviso: o app não tem ligação com a CCB. Vem antes do "Sobre", em destaque. -->
  <!-- Some depois do "Concordo" (a escolha fica guardada no aparelho). -->
  {#if !ciente}
    <section id="aviso-independente">
      <Aviso tipo="info">
        <strong>{t("sobre.aviso_titulo")}</strong><br />{t("sobre.aviso")}
        {#snippet acao()}<button class="botao primario" id="aviso-concordo" onclick={concordar}>{t("sobre.aviso_concordo")}</button>{/snippet}
      </Aviso>
    </section>
  {/if}

  <section>
    <Cartao id="cartao-aparencia" titulo={t("ajustes.aparencia")} resumo={resumoAparencia} bind:aberto={aparenciaAberta} aoAlternar={lembrar("aparencia")}>
      <!-- Duas escolhas que se combinam: o modo (claro ou escuro) e o estilo de cor. O próprio rótulo visível dá o nome
           ao grupo (aria-labelledby), então texto visível e nome acessível são sempre o mesmo. -->
      <p class="rotulo-grupo" id="rotulo-modo">{t("ajustes.modo")}</p>
      <fieldset class="segmentos modo" aria-labelledby="rotulo-modo">
        {#each TEMAS as id}
          <label class:ativo={tema.atual === id}>
            <input type="radio" name="tema" value={id} checked={tema.atual === id} onchange={() => (tema.atual = id)} />
            <span class="opcao-tema">{#if tema.atual === id}<Icone nome="ok" tamanho={18} />{/if}{t(`tema.${id}`)}</span>
          </label>
        {/each}
      </fieldset>
      <p class="rotulo-grupo" id="rotulo-estilo">{t("ajustes.estilo")}</p>
      <!-- O Alto contraste tem paleta própria: com ele o estilo não vale, então o grupo fica desativado e uma nota diz por quê. -->
      <fieldset class="segmentos" aria-labelledby="rotulo-estilo" disabled={tema.atual === "alto-contraste"}>
        {#each ESTILOS as id}
          <label class:ativo={estilo.atual === id}>
            <input type="radio" name="estilo" value={id} checked={estilo.atual === id} onchange={() => (estilo.atual = id)} />
            <span class="opcao-tema">{#if estilo.atual === id}<Icone nome="ok" tamanho={18} />{/if}{t(`estilo.${id}`)}</span>
          </label>
        {/each}
      </fieldset>
      {#if tema.atual === "alto-contraste"}<p class="meta">{t("ajustes.estilo_alto_contraste")}</p>{/if}
    </Cartao>
  </section>

  <section>
    <Cartao id="cartao-idioma" titulo={t("ajustes.idioma")} resumo={IDIOMAS[i18n.idioma].nome} bind:aberto={idiomaAberto} aoAlternar={lembrar("idioma")}>
      <select
        aria-label={t("ajustes.idioma")}
        value={i18n.idioma}
        onchange={(e) => (i18n.idioma = e.currentTarget.value as Idioma)}
      >
        <!-- Cada nome está na própria língua: o lang faz o leitor de tela pronunciar certo. -->
        {#each Object.entries(IDIOMAS) as [id, l]}<option value={id} lang={id}>{l.nome}</option>{/each}
      </select>
      <!-- Os nomes das notas (Afinador e tonalidade dos hinos): em sílabas (Dó, Ré, Mi… e Si♭), em letras (C, D, E… e B♭) ou automático (segue o idioma). -->
      <p class="rotulo-grupo" id="rotulo-notas">{t("ajustes.notas")}</p>
      <fieldset class="segmentos" aria-labelledby="rotulo-notas">
        {#each NOTACOES as id}
          <label class:ativo={notacao.atual === id}>
            <input type="radio" name="notacao" value={id} checked={notacao.atual === id} onchange={() => (notacao.atual = id)} />
            <span class="opcao-tema">{#if notacao.atual === id}<Icone nome="ok" tamanho={18} />{/if}{t(`notacao.${id}`)}</span>
          </label>
        {/each}
      </fieldset>
    </Cartao>
  </section>

  <!-- Saída de áudio: de onde o som sai e o modo do AudioContext para essa saída (o fone USB-C estala diferente do alto-falante). -->
  <section>
    <Cartao id="cartao-saida" titulo={t("ajustes.saida")} resumo={t(`saida.rota_curta.${rotaDeSaida}`)} bind:aberto={saidaAberta} aoAlternar={(a) => a && reler()}>
      <p class="meta">{t("saida.explica")}</p>
      <p class="rotulo-grupo" id="rotulo-saida">{t("saida.agora", { rota: t(`saida.rota.${rotaDeSaida}`) })}</p>
      <fieldset class="segmentos" aria-labelledby="rotulo-saida">
        {#each MODOS as m}
          <label class:ativo={modoDeSaida === m}>
            <input type="radio" name="modo-saida" value={m} checked={modoDeSaida === m} onchange={() => escolherModo(m)} />
            <span class="opcao-tema">{#if modoDeSaida === m}<Icone nome="ok" tamanho={18} />{/if}{t(`saida.${m}`)}</span>
          </label>
        {/each}
      </fieldset>
      <p class="meta" id="saida-descricao">{t(`saida.desc.${modoDeSaida}`)}</p>
      <p class="meta">{t("saida.vale_so")}</p>
      <p class="meta" id="saida-medida">{textoDaMedida}</p>
    </Cartao>
  </section>

  <!-- Conteúdo: o hinário, as partituras e os sons gravados no mesmo desenho de linha (LinhaPacote). -->
  <section>
    <Cartao id="conteudo" titulo={t("ajustes.conteudo")} bind:aberto={conteudoAberto} aoAlternar={lembrar("conteudo")}>
      {#snippet resumo()}{#if resumoConteudo.alerta}<Icone nome="alerta" tamanho={16} /> {/if}{resumoConteudo.texto}{/snippet}
      <h3 class="sub primeiro">{t("ajustes.hinario")}</h3>
      <p class="hinario-info">
        <strong>{!biblioteca.pacote ? "…" : biblioteca.pacote.exemplo ? t("ajustes.hinario_exemplo") : biblioteca.pacote.hinario.hinario.nome}</strong>
        <span class="meta">{!biblioteca.pacote ? "" : biblioteca.pacote.exemplo ? t("biblioteca.aviso_exemplo") : i18n.tn("plural.hinos", biblioteca.pacote.hinario.hinos.length)}</span>
      </p>
      <p class="meta">{t("hinario.explica")}</p>
      <LinhaPacote
        titulo={t("hinario.pacote")}
        detalhe={estadoHinario}
        fase={hinario.andamento.fase === "baixando" || hinario.andamento.fase === "conferindo" || hinario.andamento.fase === "instalando" ? hinario.andamento.fase : "ocioso"}
        progresso={hinario.andamento.progresso}
        textoBaixando={t("hinario.baixando", { n: porcentagemTotal(hinario.andamento.fase, hinario.andamento.progresso) })}
        textoConferindo={t("hinario.conferindo")}
        textoInstalando={t("hinario.instalando")}
        instalado={hinarioInstalado}
        rotuloRemover={t("hinario.remover")}
        aoRemover={() => (confirmando = true)}
        rotuloBaixar={hinario.disponivel ? t("hinario.baixar", { tamanho: formatarMB(hinario.bytes, i18n.idioma) }) : undefined}
        aoBaixar={() => hinario.baixar()}
        desabilitarBaixar={instalando.ocupado}
      />
      {#if hinario.andamento.fase === "erro"}
        <Aviso tipo="erro">{erroDoHinario}</Aviso>
      {/if}
      {#if confirmando}
        <div class="confirma" role="alertdialog" aria-labelledby="confirma-titulo" aria-describedby="confirma-texto">
          <h3 id="confirma-titulo">{t("ajustes.remover_titulo")}</h3>
          <p id="confirma-texto">{t("ajustes.remover_texto")}</p>
          <div class="acoes">
            <button class="botao" onclick={() => (confirmando = false)}>{t("ajustes.cancelar")}</button>
            <button class="botao perigo" onclick={remover}>{t("ajustes.confirmar_remocao")}</button>
          </div>
        </div>
      {/if}

      {#if resultado}<Aviso tipo={resultado.tipo}>{resultado.texto}</Aviso>{/if}

      <div id="partituras">
        <h3 class="sub">{t("partituras.titulo")}</h3>
        <p class="meta">{t("partituras.explica")}</p>
        <LinhaPacote
          titulo={t("partituras.pacote")}
          detalhe={estadoPartituras}
          fase={partituras.andamento.fase === "baixando" || partituras.andamento.fase === "conferindo" || partituras.andamento.fase === "instalando" ? partituras.andamento.fase : "ocioso"}
          progresso={partituras.andamento.progresso}
          textoBaixando={t("partituras.baixando", { n: porcentagemTotal(partituras.andamento.fase, partituras.andamento.progresso) })}
          textoConferindo={t("partituras.conferindo")}
          textoInstalando={t("partituras.instalando")}
          instalado={instaladas > 0}
          rotuloRemover={t("partituras.remover")}
          aoRemover={() => partituras.remover()}
          rotuloBaixar={partituras.disponivel ? t("partituras.baixar", { tamanho: formatarMB(partituras.bytes, i18n.idioma) }) : undefined}
          aoBaixar={() => partituras.baixar()}
          desabilitarBaixar={instalando.ocupado || !hinarioInstalado}
        />
        {#if !hinarioInstalado && instaladas === 0 && partituras.disponivel}
          <!-- Sem o hinário completo as partituras não têm onde entrar: o botão Baixar fica desabilitado até o hinário ser baixado. -->
          <p class="meta" id="partituras-precisa-hinario">{t("partituras.precisa_hinario")}</p>
        {/if}
        {#if partituras.andamento.fase === "erro"}
          <Aviso tipo="erro">{erroDasPartituras}</Aviso>
        {/if}
        {#if partituras.recusadas.length > 0}
          <Aviso tipo="info">
            {t("partituras.recusadas", {
              total: partituras.recusadas.length,
              lista: listaCurta(partituras.recusadas.map((x) => x.numero)),
              motivo: partituras.recusadas[0].motivo,
            })}
          </Aviso>
        {/if}
      </div>

      <div>
        <h3 class="sub">{t("sons.titulo")}</h3>
        <p class="meta">{t("sons.explica")}</p>
        {#each sons.pacotes as p (p.id)}
          {@const and = sons.andamento(p.id)}
          {@const instalado = sons.pacoteInstalado(p)}
          {@const tamanho = formatarMB(bytesDoPacote(p), i18n.idioma)}
          <LinhaPacote
            titulo={t(`sons.pacote_${p.id}` as Chave)}
            detalhe={`${tamanho} · ${instalado ? t("sons.instalado") : t("sons.nao_instalado")}`}
            fase={and.fase === "baixando" || and.fase === "conferindo" || and.fase === "instalando" ? and.fase : "ocioso"}
            progresso={and.progresso}
            textoBaixando={t("sons.baixando", { n: porcentagemTotal(and.fase, and.progresso) })}
            textoConferindo={t("sons.conferindo")}
            textoInstalando={t("sons.instalando")}
            {instalado}
            rotuloRemover={t("sons.remover")}
            aoRemover={() => sons.remover(p.id)}
            rotuloBaixar={t("sons.baixar", { tamanho: formatarMB(bytesParaBaixar(p), i18n.idioma) })}
            aoBaixar={() => sons.baixar(p.id)}
          />
          {#if and.fase === "erro"}
            <Aviso tipo="erro">{t(erroDoSom(and.erro))}</Aviso>
          {/if}
        {/each}
      </div>
    </Cartao>
  </section>

  <section>
    <Cartao titulo={t("ajustes.sobre")} bind:aberto={sobreAberto}>
      <div class="sobre">
        <!-- O aviso de app não oficial também mora aqui, fixo: o destaque do topo some depois do "Concordo", mas quem abre o Sobre sempre o encontra. -->
        <p id="aviso-sobre"><strong>{t("sobre.aviso_titulo")}.</strong> {t("sobre.aviso")}</p>
        <p>{t("sobre.intro")}</p>

        <h3>{t("sobre.fazer_titulo")}</h3>
        <ul>
          <li>{t("sobre.fazer_1")}</li>
          <li>{t("sobre.fazer_2")}</li>
          <li>{t("sobre.fazer_3")}</li>
          <li>{t("sobre.fazer_4")}</li>
          <li>{t("sobre.fazer_5")}</li>
          <li>{t("sobre.fazer_6")}</li>
        </ul>

        <h3>{t("sobre.como_titulo")}</h3>
        <p>{t("sobre.como")}</p>

        <h3>{t("sobre.privacidade_titulo")}</h3>
        <p>{t("sobre.privacidade")}</p>

        <h3>{t("sobre.codigo_titulo")}</h3>
        <p>{t("sobre.codigo")}</p>
      </div>
    </Cartao>
  </section>

  <section>
    <Cartao titulo={t("ajustes.creditos")} bind:aberto={creditosAberto}>
      <div class="sobre">
        <p>{t("creditos.intro")}</p>
        <ul class="creditos">
          {#each CREDITOS as c (c.id)}
            <li>
              <strong>{c.nome}</strong>
              <span class="meta">{t("creditos.por", { autor: c.autoria })}</span>
              <span>{t(`creditos.uso.${c.id}` as Chave)}</span>
              <span class="meta">{t("creditos.licenca", { licenca: semLicenca(c) ? t("creditos.reservado") : c.licenca })}</span>
              {#if c.url}<span class="meta url">{c.url}</span>{/if}
              <details class="licenca">
                <summary>{t(semLicenca(c) ? "creditos.ver_direitos" : "creditos.ver")}</summary>
                {#each c.textos as tx}
                  <pre>{textoDaLicenca(tx)}</pre>
                {/each}
              </details>
            </li>
          {/each}
        </ul>
      </div>
    </Cartao>
  </section>

  <!-- A versão fica sozinha no fim, centralizada, fora do card. -->
  <p class="meta versao">{t("ajustes.versao", { v: `${__APP_VERSAO__} (${__APP_COMMIT__})` })}</p>
</main>

<style>
  /* "Em nome do Senhor Jesus": numa linha só, com o tamanho acompanhando a largura da tela. Se não couber ao lado do título, a própria barra o põe na linha de baixo (`quebra`). */
  #aviso-concordo { min-height: 3rem; }
  .nome-senhor { display: block; white-space: nowrap; font-size: clamp(0.7rem, 3.4vw, 1rem); font-weight: 600; color: var(--suave); text-align: end; }
  section { margin-bottom: 0.9rem; }
  .versao { margin: 0 0 1.5rem; text-align: center; }
  .sobre p, .sobre li { line-height: 1.5; }
  .sobre h3 { margin: 1.1rem 0 0.3rem; font-size: 0.95rem; }
  .sobre ul { margin: 0; padding-left: 1.2rem; }
  .sobre ul.creditos { padding-left: 0; list-style: none; }
  .creditos li { display: grid; gap: 0.15rem; padding: 0.7rem 0; border-top: 0.0625rem solid var(--borda-controle); }
  .creditos li:first-child { border-top: 0; }
  .creditos .url { overflow-wrap: anywhere; }
  .licenca summary {
    display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; cursor: pointer; list-style: none;
    min-height: 2.75rem; padding: 0; font-weight: 500; color: var(--acento);
  }
  .licenca summary::-webkit-details-marker { display: none; }
  .licenca pre { margin: 0.4rem 0 0.8rem; font: 0.78rem/1.45 ui-monospace, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
  .sub { margin: 1.1rem 0 0.2rem; font-size: 0.85rem; letter-spacing: 0.05em; text-transform: uppercase; color: var(--suave); }
  .sub.primeiro { margin-top: 0.4rem; }
  select {
    width: 100%; box-sizing: border-box; /* ocupa toda a largura, como as opções de aparência */
    min-height: 3rem; font-size: 1rem; padding: 0 0.6rem; border-radius: 0.75rem;
    border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
  /* Aparência: três opções lado a lado; a escolhida tem "✓", negrito e borda de acento (não só cor). */
  .rotulo-grupo { margin: 0.9rem 0 0.35rem; font-size: 0.9rem; color: var(--suave); }
  .rotulo-grupo:first-of-type { margin-top: 0.4rem; }
  .segmentos { display: flex; gap: 0.4rem; margin: 0; padding: 0; border: 0; }
  /* O modo tem quatro opções: 2 por linha no celular em pé e 4 por linha numa janela larga (o rem acompanha a fonte do sistema). */
  .segmentos.modo { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); }
  .segmentos:disabled { opacity: 0.6; }
  .segmentos:disabled input { cursor: not-allowed; }
  .segmentos label { position: relative; flex: 1; }
  .segmentos input { position: absolute; opacity: 0; inset: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
  .segmentos span {
    display: flex; align-items: center; justify-content: center; min-height: 3rem; box-sizing: border-box;
    padding: 0 0.5rem; text-align: center; border-radius: 0.75rem; font-size: 0.95rem;
    border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
  .opcao-tema { display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; }
  .segmentos .ativo span { border: 0.125rem solid var(--acento); font-weight: 700; }
  .segmentos input:focus-visible + span { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; }
  .acoes { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.6rem 0; }
  /* Os botões do hinário ficam sempre lado a lado, cada um com metade da linha; o texto quebra em duas linhas quando não cabe. */
  .hinario-info { display: grid; gap: 0.15rem; margin: 0.2rem 0 0.4rem; }
  .confirma { margin: 0.8rem 0; padding: 1rem; border: 0.0625rem solid var(--perigo); border-radius: 0.75rem; background: var(--superficie); }
  .confirma h3 { margin: 0 0 0.4rem; font-size: 1.05rem; }
  .confirma p { margin: 0 0 0.6rem; line-height: 1.5; }
</style>
