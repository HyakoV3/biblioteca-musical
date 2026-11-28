<script lang="ts">
  import { corrigirDuracao, formatarTamanho, formatarTempo, nomeDoFormato, type Gravacao } from "./gravador";
  import { i18n } from "./i18n/index.svelte";

  // Só aparece quando a gravação NÃO pôde ser guardada: a pessoa a ouve antes de perdê-la.
  let { gravacao, aoDescartar }: { gravacao: Gravacao; aoDescartar: () => void } = $props();

  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  /** Ação do <audio>: corrige a duração de um WebM sem ela (ver `corrigirDuracao`). */
  function duracaoReal(audio: HTMLAudioElement) {
    const desfazer = corrigirDuracao(audio);
    return { destroy: desfazer };
  }
</script>

<section class="resultado" aria-labelledby="titulo-gravacao">
  <h2 id="titulo-gravacao">{t("gravador.sua_gravacao")}</h2>
  <audio id="ouvir-gravacao" controls src={gravacao.url} use:duracaoReal></audio>
  <p class="meta" id="info-gravacao">
    {formatarTempo(gravacao.segundos)} · {formatarTamanho(gravacao.bytes, i18n.idioma)} · {nomeDoFormato(gravacao.tipo)}
  </p>
  <button id="descartar" class="botao" onclick={aoDescartar}>{t("gravador.descartar")}</button>
</section>

<style>
  .resultado { display: grid; gap: 0.6rem; padding: 0.9rem; border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie); }
  .resultado h2 { margin: 0; font-size: 1rem; }
  .resultado audio { width: 100%; }
  .resultado p { margin: 0; }
</style>
