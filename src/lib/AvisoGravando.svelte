<script lang="ts">
  import { emCurso } from "./gravacaoEmCurso.svelte";
  import { formatarTempo } from "./gravador";
  import { i18n } from "./i18n/index.svelte";

  // O aviso "● Gravando 0:34 · Parar" fora da aba Gravador: a gravação segue em outra aba (gravar com o metrônomo no fone) ou com a tela de um hino aberta (o serviço do Android a mantém), e a pessoa
  // precisa ver que o microfone está aberto, com o Parar à mão. O tempo é só visual; o leitor de tela ouve apenas que há uma gravação em curso (nada de anunciar segundo a segundo).
  // `oculto`: a tela que já mostra a própria gravação (a aba Gravador) não repete o aviso.
  let { oculto = false }: { oculto?: boolean } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);
</script>

{#if emCurso.gravando && !oculto}
  <div id="gravando-aviso" class="gravando-aviso" role="status">
    <span class="ponto" aria-hidden="true"></span>
    <span class="texto">{t("gravador.em_curso")} <span aria-hidden="true">{formatarTempo(emCurso.decorrido)}</span></span>
    <button class="botao" onclick={() => void emCurso.parar()}>{t("gravador.parar")}</button>
  </div>
{/if}

<style>
  /* Uma faixa com o ponto, o texto e o Parar (o ponto é só enfeite: o texto diz "Gravando"). */
  .gravando-aviso { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 0.75rem; margin-bottom: 0.75rem; border: 0.0625rem solid var(--ouro-linha); border-radius: var(--raio); background: var(--superficie); }
  .gravando-aviso .ponto { width: 0.9rem; height: 0.9rem; border-radius: 50%; background: currentColor; flex: none; }
  .gravando-aviso .texto { flex: 1; min-width: 0; font-variant-numeric: tabular-nums; }
  .gravando-aviso button { min-height: var(--toque); }
</style>
