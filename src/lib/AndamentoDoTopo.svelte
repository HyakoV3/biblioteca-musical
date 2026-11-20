<script lang="ts">
  import ControleAndamento from "./ControleAndamento.svelte";
  import type { Hino } from "./biblioteca.svelte";
  import { i18n } from "$lib/i18n/index.svelte";
  import { reproducao } from "./reproducao.svelte";

  // O andamento no topo das abas Letra e Partitura: um botão com o valor de agora que abre um painelzinho com o mesmo controle da aba Ouvir.
  // Vale a mesma regra: parado ou pausado dá para mudar; tocando, o controle fica desabilitado (o som é reagendado ao continuar).
  let { hino }: { hino: Hino } = $props();
  const t = (c: Parameters<typeof i18n.t>[0], p?: Record<string, string | number>) => i18n.t(c, p);

  // O pai recria este componente a cada hino; os ajustes vivem no módulo de reprodução (os mesmos da aba Ouvir).
  // svelte-ignore state_referenced_locally
  const cfg = reproducao.config(hino);
  const editavel = $derived(!(reproducao.atual?.numero === hino.numero && reproducao.estado === "tocando"));
  const idPainel = "painel-andamento-topo";
</script>

<button class="botao andamento" popovertarget={idPainel} aria-label={t("hino.andamento_botao", { n: cfg.andamento })} title={t("hino.andamento_botao", { n: cfg.andamento })}>
  <span class="valor">{cfg.andamento}</span><span class="un">bpm</span>
</button>
<div id={idPainel} popover="auto" class="painel" role="group" aria-label={t("player.andamento_rotulo")}>
  <p class="titulo">{t("player.andamento_rotulo")}</p>
  <ControleAndamento {cfg} {editavel} />
  {#if !editavel}<p class="dica" role="status">{t("hino.andamento_pausar")}</p>{/if}
</div>

<style>
  .andamento { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; min-width: 3rem; min-height: 3rem; padding: 0 0.5rem; line-height: 1.05; }
  .valor { font-size: 1.05rem; font-weight: 600; font-variant-numeric: tabular-nums; }
  .un { font-size: 0.7rem; color: var(--suave); }
  /* O painel abre logo abaixo da barra, à direita, na camada de cima (fecha ao tocar fora ou no Esc). */
  .painel {
    position: fixed; inset: auto; top: calc(env(safe-area-inset-top) + 3.75rem); right: 0.5rem; left: auto; margin: 0;
    width: min(22rem, calc(100vw - 1rem)); padding: 0.75rem; box-sizing: border-box;
    background: var(--fundo); color: var(--texto); border: 0.0625rem solid var(--borda); border-radius: 0.75rem;
  }
  .painel:not(:popover-open) { display: none; }
  .titulo { margin: 0 0 0.5rem; font-size: 0.95rem; }
  .dica { margin: 0.5rem 0 0; font-size: 0.85rem; color: var(--suave); }
</style>
