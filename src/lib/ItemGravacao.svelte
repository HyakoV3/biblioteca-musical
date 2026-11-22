<script lang="ts">
  import { onDestroy } from "svelte";
  import { compartilharGravacao, nomeDoArquivo, podeCompartilhar, tipoSemCodec } from "./compartilhar";
  import { corrigirDuracao, formatarTamanho, formatarTempo, nomeDoFormato } from "./gravador";
  import { formatarData, gravacoes, type MetaGravacao } from "./gravacoes";
  import { i18n } from "./i18n/index.svelte";

  // Uma gravação da lista: nome (data e hora), duração, tamanho e formato, "Ouvir", "Enviar" (folha de compartilhamento do sistema) e "Apagar". O arquivo de áudio só é lido do armazenamento quando a pessoa toca
  // em "Ouvir" (a lista carrega só os metadados). Apagar pede confirmação: o primeiro toque muda o botão para "Apagar mesmo?" e o segundo apaga; sem o segundo toque em
  // 4 s o botão volta. Só uma gravação toca de cada vez (`tocandoId`); `aoTocar` avisa a lista e `aoApagar` pede para tirá-la.
  let {
    meta,
    tocandoId,
    aoTocar,
    aoApagar,
  }: { meta: MetaGravacao; tocandoId: string | null; aoTocar: (id: string) => void; aoApagar: (id: string) => void } = $props();

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  let url = $state<string | null>(null);
  let carregando = $state(false);
  let falhou = $state(false);
  let confirmando = $state(false);
  let relogio: ReturnType<typeof setTimeout> | null = null;
  let audio = $state<HTMLAudioElement | null>(null);
  let destruido = false;

  const nome = $derived(t("gravador.nome", { data: formatarData(meta.criadaEm, i18n.idioma) }));

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
  /** Abre a folha de compartilhamento do sistema com o arquivo desta gravação (lido do armazenamento só agora). */
  async function enviar() {
    if (enviando) return;
    enviando = true;
    falhouEnvio = false;
    try {
      const blob = await gravacoes.blob(meta.id);
      if (!blob) throw new Error("sem arquivo");
      const r = await compartilharGravacao(blob, nomeDoArquivo(meta.criadaEm, meta.tipo), t("gravador.enviar_titulo"));
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
    el.addEventListener("play", aoComecar);
    el.addEventListener("error", aoFalhar);
    aoTocar(meta.id);
    void el.play().catch((e) => {
      if (e instanceof DOMException && e.name === "NotSupportedError") aoFalhar();
    });
    return {
      destroy() {
        desfazer();
        el.removeEventListener("play", aoComecar);
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
    <strong class="nome">{nome}</strong>
    <span class="info meta">{formatarTempo(meta.segundos)} · {formatarTamanho(meta.bytes, i18n.idioma)} · {nomeDoFormato(meta.tipo)}</span>
  </div>
  {#if url}
    <audio bind:this={audio} controls src={url} use:player aria-label={nome}></audio>
  {/if}
  {#if falhou}<p class="meta erro-item" role="alert">{t("gravador.erro_abrir")}</p>{/if}
  {#if falhouEnvio}<p class="meta erro-item" role="alert">{t("gravador.erro_enviar")}</p>{/if}
  <div class="acoes">
    {#if !url}
      <button class="botao ouvir" onclick={ouvir} disabled={carregando} aria-label={`${t("gravador.ouvir")}: ${nome}`}>{t("gravador.ouvir")}</button>
    {/if}
    {#if sePodeEnviar}
      <button class="botao enviar" onclick={enviar} disabled={enviando} aria-label={`${t("gravador.enviar")}: ${nome}`}>{t("gravador.enviar")}</button>
    {/if}
    <button class="botao apagar" class:perigo={confirmando} onclick={apagar} aria-label={`${confirmando ? t("gravador.apagar_mesmo") : t("gravador.apagar")}: ${nome}`}>
      {confirmando ? t("gravador.apagar_mesmo") : t("gravador.apagar")}
    </button>
  </div>
</li>

<style>
  .gravacao-item { display: grid; gap: 0.5rem; padding: 0.8rem 0.9rem; border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie); list-style: none; }
  .topo { display: grid; gap: 0.15rem; }
  .nome { font-size: 1rem; }
  .info, .erro-item { margin: 0; font-variant-numeric: tabular-nums; }
  audio { width: 100%; }
  .acoes { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .acoes .botao { flex: 1 1 5.5rem; min-height: 2.75rem; }
  /* Confirmando: borda e texto em destaque (não só a cor: o texto do botão muda para "Apagar mesmo?"). */
  .perigo { border-width: 0.125rem; border-color: var(--perigo); font-weight: 700; }
</style>
