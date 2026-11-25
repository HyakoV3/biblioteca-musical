<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { compartilharGravacao, nomeDoArquivo, podeCompartilhar, tipoSemCodec } from "./compartilhar";
  import { contextoValido, linhasDoContexto, resumoDoContexto, textoDoContexto } from "./contexto";
  import { corrigirDuracao, formatarTamanho, formatarTempo, nomeDoFormato } from "./gravador";
  import { gravacoes, type MetaGravacao, type Mudancas } from "./gravacoes";
  import { i18n } from "./i18n/index.svelte";
  import { TITULO_MAX, cortarGrafemas } from "./metaGravacao";
  import { nomeDaGravacao } from "./organizar";

  // Uma gravação da lista: nome (data e hora), duração, tamanho e formato, "Ouvir", "Enviar" (folha de compartilhamento do sistema) e "Apagar". O arquivo de áudio só é lido do armazenamento quando a pessoa toca
  // em "Ouvir" (a lista carrega só os metadados). Apagar pede confirmação: o primeiro toque muda o botão para "Apagar mesmo?" e o segundo apaga; sem o segundo toque em
  // 4 s o botão volta. Só uma gravação toca de cada vez (`tocandoId`); `aoTocar` avisa a lista e `aoApagar` pede para tirá-la.
  let {
    meta,
    tocandoId,
    aoTocar,
    aoApagar,
    aoParar,
    aoAtualizar,
    marca,
  }: {
    meta: MetaGravacao;
    tocandoId: string | null;
    aoTocar: (id: string) => void;
    aoApagar: (id: string) => void;
    /** O áudio pausou ou terminou: a lista deixa de considerá-la "tocando" (senão um filtro que a esconda a fixaria no topo sem som). */
    aoParar: (id: string) => void;
    /** Muda o nome ou a estrela (a lista grava e atualiza); devolve se deu certo. */
    aoAtualizar: (id: string, mudancas: Mudancas) => Promise<boolean>;
    marca?: "nova" | "tocando";
  } = $props();

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  let url = $state<string | null>(null);
  let carregando = $state(false);
  let falhou = $state(false);
  let confirmando = $state(false);
  let relogio: ReturnType<typeof setTimeout> | null = null;
  let audio = $state<HTMLAudioElement | null>(null);
  let destruido = false;

  const tr = (c: string, p?: Record<string, string | number>) => t(c as Parameters<typeof i18n.t>[0], p);
  /** O nome mostrado: o da pessoa, ou o padrão (com o hino ou o metrônomo e a data), derivado na hora. */
  const nome = $derived(nomeDaGravacao(meta, tr, i18n.idioma));
  const nomePadrao = $derived(nomeDaGravacao({ ...meta, titulo: undefined }, tr, i18n.idioma));

  // Renomear e favoritar (I-39).
  let editando = $state(false);
  let rascunho = $state("");
  let salvandoNome = $state(false);
  let erroAtualizar = $state(false);
  let botaoRenomear = $state<HTMLButtonElement | null>(null);
  function focar(el: HTMLInputElement) {
    el.focus();
    el.select();
  }
  function comecarRenomear() {
    rascunho = meta.titulo ?? "";
    erroAtualizar = false;
    editando = true;
  }
  /** Fecha a edição (Cancelar e Esc). Com um salvamento em andamento não fecha: o nome seria salvo mesmo depois de cancelar. */
  async function cancelarRenomear() {
    if (salvandoNome) return;
    erroAtualizar = false;
    await fechar();
  }
  async function fechar() {
    editando = false;
    await tick();
    botaoRenomear?.focus(); // o foco volta ao botão que abriu a edição
  }
  async function salvarNome() {
    if (salvandoNome) return;
    salvandoNome = true;
    erroAtualizar = false;
    const ok = await aoAtualizar(meta.id, { titulo: rascunho });
    salvandoNome = false;
    if (destruido) return;
    if (ok) await fechar();
    else erroAtualizar = true; // a edição segue aberta, com o aviso
  }
  /** O campo aceita no máximo `TITULO_MAX` caracteres visíveis: o que passar é cortado na hora, e a pessoa vê o corte (e não só ao salvar). */
  function aoDigitar(e: Event & { currentTarget: HTMLInputElement }) {
    const v = cortarGrafemas(e.currentTarget.value);
    if (v !== e.currentTarget.value) e.currentTarget.value = v;
    rascunho = v;
  }
  /** Enquanto a estrela grava, outro toque é ignorado: o valor novo vem do registro de agora, e dois toques rápidos pediriam o mesmo valor. */
  let salvandoEstrela = false;
  async function alternarFavorita() {
    if (salvandoEstrela) return;
    salvandoEstrela = true;
    erroAtualizar = false;
    try {
      const ok = await aoAtualizar(meta.id, { favorita: meta.favorita !== true });
      if (!ok && !destruido) erroAtualizar = true;
    } finally {
      salvandoEstrela = false;
    }
  }

  async function ouvir() {
    if (carregando) return;
    if (url) {
      void audio?.play().catch(() => {});
      return;
    }
    carregando = true;
    falhou = false;
    try {
      const blob = await gravacoes.blob(meta.id);
      if (destruido) return;
      if (!blob) throw new Error("sem arquivo");
      url = URL.createObjectURL(blob);
    } catch (e) {
      console.warn("gravador: não foi possível abrir a gravação", e);
      falhou = true;
    } finally {
      carregando = false;
    }
  }

  let enviando = $state(false);
  let falhouEnvio = $state(false);
  const sePodeEnviar = podeCompartilhar();
  const contexto = $derived(contextoValido(meta.contexto));
  const textoDoEnvio = $derived(contexto ? textoDoContexto(contexto, tr, i18n.idioma) : "");
  /** O resumo de uma linha no card e as linhas completas ao abrir (as mesmas do texto enviado, sem a formatação). */
  const resumo = $derived(contexto ? resumoDoContexto(contexto, tr) : "");
  const linhasContexto = $derived(contexto ? linhasDoContexto(contexto, tr, i18n.idioma) : []);
  /** O diálogo de envio só existe no DOM enquanto está aberto (com muitas gravações, um `<dialog>` por item pesaria à toa). */
  let dialogoAberto = $state(false);
  let dialogo = $state<HTMLDialogElement | null>(null);
  function modal(el: HTMLDialogElement) {
    el.showModal();
  }
  /** Fecha com `close()` (e não tirando o diálogo do DOM): só assim o navegador devolve o foco ao botão "Enviar". O `onclose` desmonta o diálogo. */
  function fecharDialogo() {
    if (dialogo) dialogo.close();
    else dialogoAberto = false;
  }

  /** Com contexto, pergunta antes (modal): enviar com o texto do que a pessoa ouvia, ou só o áudio. Sem contexto, envia direto. */
  function pedirEnvio() {
    if (enviando) return;
    if (contexto) dialogoAberto = true;
    else void enviar(false);
  }

  /** Abre a folha de compartilhamento do sistema com o arquivo desta gravação (lido do armazenamento só agora). */
  async function enviar(comContexto: boolean) {
    fecharDialogo();
    if (enviando) return;
    enviando = true;
    falhouEnvio = false;
    try {
      const blob = await gravacoes.blob(meta.id);
      if (!blob) throw new Error("sem arquivo");
      const r = await compartilharGravacao(blob, nomeDoArquivo(meta.criadaEm, meta.tipo), t("gravador.enviar_titulo"), comContexto ? textoDoEnvio : undefined);
      if (!destruido) falhouEnvio = r === "erro";
    } catch (e) {
      console.warn("gravador: não foi possível enviar a gravação", e);
      if (!destruido) falhouEnvio = true;
    } finally {
      enviando = false;
    }
  }

  function apagar() {
    if (!confirmando) {
      confirmando = true;
      relogio = setTimeout(() => (confirmando = false), 4000);
      return;
    }
    if (relogio !== null) clearTimeout(relogio);
    relogio = null;
    confirmando = false;
    aoApagar(meta.id);
  }

  /** O arquivo não toca (gravação quase vazia, corrompida, formato que a WebView não decodifica): explica e devolve o botão "Ouvir" para tentar de novo. */
  function aoFalhar() {
    falhou = true;
    if (url) URL.revokeObjectURL(url);
    url = null;
  }

  /**
   * Ação do <audio>: corrige a duração de um WebM sem ela, toca ao aparecer (a pessoa acabou de tocar em "Ouvir") e avisa a lista quando começa. Avisa a lista
   * ANTES de tocar: o evento "play" só chega numa tarefa depois, e nesse intervalo o `$effect` abaixo (que pausa quem não é o `tocandoId`) pausaria este áudio.
   */
  function player(el: HTMLAudioElement) {
    const desfazer = corrigirDuracao(el);
    const aoComecar = () => aoTocar(meta.id); // o usuário apertou play nos controles do player
    const aoPausar = () => aoParar(meta.id);
    el.addEventListener("play", aoComecar);
    el.addEventListener("pause", aoPausar);
    el.addEventListener("ended", aoPausar);
    el.addEventListener("error", aoFalhar);
    aoTocar(meta.id);
    void el.play().catch((e) => {
      if (e instanceof DOMException && e.name === "NotSupportedError") aoFalhar();
    });
    return {
      destroy() {
        desfazer();
        el.removeEventListener("play", aoComecar);
        el.removeEventListener("pause", aoPausar);
        el.removeEventListener("ended", aoPausar);
        el.removeEventListener("error", aoFalhar);
      },
    };
  }

  // Outra gravação passou a tocar (ou a aba saiu de cena): esta para.
  $effect(() => {
    if (tocandoId !== meta.id && audio && !audio.paused) audio.pause();
  });

  onDestroy(() => {
    destruido = true;
    if (relogio !== null) clearTimeout(relogio);
    if (url) URL.revokeObjectURL(url);
  });
</script>

<li class="gravacao-item" data-id={meta.id}>
  <div class="topo">
    {#if editando}
      <form
        class="renomear"
        onsubmit={(e) => {
          e.preventDefault();
          void salvarNome();
        }}
      >
        <label>
          <span class="meta">{t("gravador.nome_campo")} ({t("gravador.nome_limite", { n: TITULO_MAX })})</span>
          <input use:focar type="text" readonly={salvandoNome} placeholder={nomePadrao} value={rascunho} oninput={aoDigitar} onkeydown={(e) => e.key === "Escape" && void cancelarRenomear()} />
        </label>
        <div class="botoes-nome">
          <button type="submit" class="botao primario">{t("gravador.salvar_nome")}</button>
          <button type="button" class="botao" disabled={salvandoNome} onclick={cancelarRenomear}>{t("gravador.cancelar")}</button>
        </div>
      </form>
    {:else}
      <div class="linha-nome">
        <strong class="nome">{nome}</strong>
        <button
          class="estrela"
          aria-pressed={meta.favorita === true}
          aria-label={`${t("gravador.favorita")}: ${nome}`}
          onclick={alternarFavorita}>{meta.favorita ? "★" : "☆"}</button
        >
      </div>
    {/if}
    {#if marca}<span class="marca">{t(marca === "nova" ? "gravador.marca_nova" : "gravador.marca_tocando")}</span>{/if}
    <span class="info meta">{formatarTempo(meta.segundos)} · {formatarTamanho(meta.bytes, i18n.idioma)} · {nomeDoFormato(meta.tipo)}</span>
  </div>
  {#if url}
    <audio bind:this={audio} controls src={url} use:player aria-label={nome}></audio>
  {/if}
  {#if falhou}<p class="meta erro-item" role="alert">{t("gravador.erro_abrir")}</p>{/if}
  {#if falhouEnvio}<p class="meta erro-item" role="alert">{t("gravador.erro_enviar")}</p>{/if}
  {#if erroAtualizar}<p class="meta erro-item" role="alert">{t("gravador.erro_atualizar")}</p>{/if}
  {#if resumo}
    <details class="contexto">
      <summary class="meta">{t("gravador.tem_contexto", { resumo })}</summary>
      <ul class="linhas-contexto">
        {#each linhasContexto as l, i (i)}<li>{l.texto}{#if l.nota} ({l.nota}){/if}</li>{/each}
      </ul>
      {#if contexto?.mudouDurante}<p class="meta">{t("ctx.mudou")}</p>{/if}
    </details>
  {/if}
  <div class="acoes">
    {#if !url}
      <button class="botao ouvir" onclick={ouvir} disabled={carregando} aria-label={`${t("gravador.ouvir")}: ${nome}`}>{t("gravador.ouvir")}</button>
    {/if}
    <button class="botao renomear-botao" bind:this={botaoRenomear} disabled={editando} onclick={comecarRenomear} aria-label={`${t("gravador.renomear")}: ${nome}`}>{t("gravador.renomear")}</button>
    {#if sePodeEnviar}
      <button class="botao enviar" onclick={pedirEnvio} disabled={enviando} aria-label={`${t("gravador.enviar")}: ${nome}`}>{t("gravador.enviar")}</button>
    {/if}
    <button class="botao apagar" class:perigo={confirmando} onclick={apagar} aria-label={`${confirmando ? t("gravador.apagar_mesmo") : t("gravador.apagar")}: ${nome}`}>
      {confirmando ? t("gravador.apagar_mesmo") : t("gravador.apagar")}
    </button>
  </div>

  {#if dialogoAberto}
  <dialog bind:this={dialogo} use:modal onclose={() => (dialogoAberto = false)} class="envio-contexto" aria-labelledby={`envio-${meta.id}`}>
    <h2 id={`envio-${meta.id}`}>{t("gravador.contexto_titulo")}</h2>
    <p>{t("gravador.contexto_explica")}</p>
    <pre class="previa">{textoDoEnvio}</pre>
    <div class="botoes">
      <button class="botao primario" onclick={() => enviar(true)}>{t("gravador.enviar_com")}</button>
      <button class="botao" onclick={() => enviar(false)}>{t("gravador.enviar_sem")}</button>
      <button class="botao" onclick={fecharDialogo}>{t("gravador.cancelar")}</button>
    </div>
  </dialog>
  {/if}
</li>

<style>
  .gravacao-item { display: grid; gap: 0.5rem; padding: 0.8rem 0.9rem; border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie); list-style: none; }
  .topo { display: grid; gap: 0.15rem; }
  .nome { font-size: 1rem; }
  .marca { justify-self: start; padding: 0.1rem 0.5rem; border: 0.125rem solid var(--acento); border-radius: 0.75rem; font-size: 0.85rem; font-weight: 700; }
  .info, .erro-item { margin: 0; font-variant-numeric: tabular-nums; }
  audio { width: 100%; }
  .acoes { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .acoes .botao { flex: 1 1 5.5rem; min-height: 2.75rem; }
  /* Confirmando: borda e texto em destaque (não só a cor: o texto do botão muda para "Apagar mesmo?"). */
  .linha-nome { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
  .estrela { flex: none; min-width: 2.75rem; min-height: 2.75rem; font-size: 1.5rem; line-height: 1; border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie); color: var(--texto); cursor: pointer; }
  .estrela[aria-pressed="true"] { border: 0.125rem solid var(--acento); }
  .renomear { display: grid; gap: 0.5rem; }
  .renomear label { display: grid; gap: 0.25rem; }
  .renomear input { box-sizing: border-box; width: 100%; min-height: 3rem; padding: 0 0.75rem; font: inherit; border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie); color: var(--texto); }
  .botoes-nome { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .botoes-nome .botao { flex: 1 1 5.5rem; min-height: 2.75rem; }
  .contexto summary { cursor: pointer; min-height: 2.75rem; display: flex; align-items: center; }
  .linhas-contexto { margin: 0 0 0.25rem; padding-left: 1.25rem; }
  .envio-contexto { box-sizing: border-box; width: min(32rem, calc(100% - 2rem)); margin: auto; padding: 1.25rem; border: 0.0625rem solid var(--borda-controle); border-radius: 1rem; background: var(--fundo); color: var(--texto); }
  .envio-contexto::backdrop { background: rgb(0 0 0 / 0.55); }
  .envio-contexto h2 { margin: 0 0 0.5rem; font-size: 1.1rem; }
  .previa { margin: 0.5rem 0 0.8rem; padding: 0.6rem 0.7rem; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; font-size: 0.95rem; border: 0.0625rem solid var(--borda-controle); border-radius: 0.5rem; }
  .botoes { display: grid; gap: 0.5rem; }
  .botoes .botao { min-height: 2.75rem; }
  .perigo { border-width: 0.125rem; border-color: var(--perigo); font-weight: 700; }
</style>
