<script lang="ts">
  // Uma linha de conteúdo que se instala e se remove (partituras, sons gravados e, em Ajustes, o hinário): o título, um detalhe (tamanho e
  // estado) e a ação do momento. A LÓGICA de baixar, conferir e instalar não é daqui: fica nas lojas de estado (`sons/pacotes.svelte.ts`,
  // `partituras/partituras.svelte.ts`); esta linha só desenha o que elas informam.
  import { tick } from "svelte";
  import { progressoTotal } from "./pacote";
  import { i18n } from "./i18n/index.svelte";
  type Fase = "baixando" | "conferindo" | "instalando" | "ocioso";
  let {
    titulo,
    detalhe,
    fase = "ocioso",
    progresso = 0,
    textoBaixando = "",
    textoConferindo = "",
    textoInstalando = "",
    instalado = false,
    rotuloRemover = "",
    aoRemover,
    rotuloBaixar,
    aoBaixar,
    desabilitarBaixar = false,
    desabilitarRemover = false,
    confirmarRemocao,
  }: {
    titulo: string;
    detalhe: string;
    fase?: Fase;
    /** Andamento do download, de 0 a 1. */
    progresso?: number;
    /** Os textos do andamento já prontos (traduzidos e com o número), um por fase. */
    textoBaixando?: string;
    textoConferindo?: string;
    textoInstalando?: string;
    instalado?: boolean;
    rotuloRemover?: string;
    aoRemover?: () => void;
    /** Sem rótulo, não há botão de baixar (por exemplo, nenhum pacote publicado). */
    rotuloBaixar?: string;
    aoBaixar?: () => void;
    /** Outro conteúdo está sendo instalado agora: o botão Baixar fica desabilitado até acabar. */
    desabilitarBaixar?: boolean;
    /** Outro conteúdo está sendo instalado agora: remover o hinário ou as partituras no meio mudaria o chão do que está sendo instalado. */
    desabilitarRemover?: boolean;
    /** Com isto, Remover não apaga na hora: pede a confirmação aqui mesmo, na linha (o título e o texto do que será apagado). Sem isto, `aoRemover` roda direto. */
    confirmarRemocao?: { titulo: string; texto: string };
  } = $props();

  // A confirmação em linha (UX-008): a mesma para o hinário, as partituras e os sons. O foco vai para Cancelar (a saída segura) e volta para Remover ao fechar.
  const uid = $props.id();
  let confirmando = $state(false);
  let botaoRemover = $state<HTMLButtonElement>();
  let botaoCancelar = $state<HTMLButtonElement>();
  async function pedir() {
    if (!confirmarRemocao) return aoRemover?.();
    confirmando = true;
    await tick();
    botaoCancelar?.focus();
  }
  async function cancelar() {
    confirmando = false;
    await tick();
    botaoRemover?.focus();
  }
  function confirmar() {
    confirmando = false;
    aoRemover?.();
  }
  // Se a linha deixa de estar instalada (ou uma instalação começa) com a pergunta aberta, ela não tem mais sentido.
  $effect(() => {
    if (!instalado || fase !== "ocioso") confirmando = false;
  });
</script>

<div class="pacote">
  <div class="pacote-info">
    <strong>{titulo}</strong>
    <span class="meta">{detalhe}</span>
  </div>
  {#if fase === "baixando" || fase === "conferindo" || fase === "instalando"}
    <!-- Uma barra só: o download é 90% dela, a conferência e a instalação o resto (progressoTotal). -->
    <progress value={progressoTotal(fase, progresso)} max="1" aria-label={fase === "baixando" ? textoBaixando : fase === "conferindo" ? textoConferindo : textoInstalando}></progress>
    <span class="meta" role={fase === "baixando" ? undefined : "status"}>{fase === "baixando" ? textoBaixando : fase === "conferindo" ? textoConferindo : textoInstalando}</span>
  {:else if instalado}
    <button class="botao" bind:this={botaoRemover} disabled={desabilitarRemover} onclick={pedir}>{rotuloRemover}</button>
    {#if confirmando && confirmarRemocao}
      <div class="confirma" role="alertdialog" aria-labelledby={`${uid}-titulo`} aria-describedby={`${uid}-texto`}>
        <h3 id={`${uid}-titulo`}>{confirmarRemocao.titulo}</h3>
        <p id={`${uid}-texto`}>{confirmarRemocao.texto}</p>
        <div class="acoes">
          <button class="botao" bind:this={botaoCancelar} onclick={cancelar}>{i18n.t("ajustes.cancelar")}</button>
          <button class="botao perigo" onclick={confirmar}>{rotuloRemover}</button>
        </div>
      </div>
    {/if}
  {:else if rotuloBaixar}
    <button class="botao primario" disabled={desabilitarBaixar} onclick={aoBaixar}>{rotuloBaixar}</button>
  {/if}
</div>

<style>
  .pacote { display: grid; gap: 0.5rem; margin: 0.6rem 0; padding: 0.8rem 0.9rem; border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie); }
  .pacote-info { display: grid; gap: 0.15rem; }
  .pacote progress { width: 100%; height: 0.625rem; accent-color: var(--acento); }
  .confirma { padding: 0.8rem 0.9rem; border: 0.0625rem solid var(--perigo); border-radius: 0.75rem; background: var(--fundo); }
  .confirma h3 { margin: 0 0 0.4rem; font-size: 1.05rem; }
  .confirma p { margin: 0 0 0.6rem; line-height: 1.5; }
  .acoes { display: flex; flex-wrap: wrap; gap: 0.5rem; }
</style>
