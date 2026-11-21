<script lang="ts">
  // Uma linha de conteúdo que se instala e se remove (partituras, sons gravados e, em Ajustes, o hinário): o título, um detalhe (tamanho e
  // estado) e a ação do momento. A LÓGICA de baixar, conferir e instalar não é daqui: fica nas lojas de estado (`sons/pacotes.svelte.ts`,
  // `partituras/partituras.svelte.ts`); esta linha só desenha o que elas informam.
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
  } = $props();
</script>

<div class="pacote">
  <div class="pacote-info">
    <strong>{titulo}</strong>
    <span class="meta">{detalhe}</span>
  </div>
  {#if fase === "baixando"}
    <progress value={progresso} max="1" aria-label={textoBaixando}></progress>
    <span class="meta">{textoBaixando}</span>
  {:else if fase === "conferindo"}
    <span class="meta" role="status">{textoConferindo}</span>
  {:else if fase === "instalando"}
    <span class="meta" role="status">{textoInstalando}</span>
  {:else if instalado}
    <button class="botao" onclick={aoRemover}>{rotuloRemover}</button>
  {:else if rotuloBaixar}
    <button class="botao primario" disabled={desabilitarBaixar} onclick={aoBaixar}>{rotuloBaixar}</button>
  {/if}
</div>

<style>
  .pacote { display: grid; gap: 0.5rem; margin: 0.6rem 0; padding: 0.8rem 0.9rem; border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie); }
  .pacote-info { display: grid; gap: 0.15rem; }
  .pacote progress { width: 100%; height: 0.625rem; accent-color: var(--acento); }
</style>
