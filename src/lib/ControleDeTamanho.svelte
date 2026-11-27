<script lang="ts">
  import Icone from "./Icone.svelte";

  // Controle de tamanho: o MESMO visual na letra e na partitura (diminuir, voltar ao tamanho normal, aumentar). É só apresentação:
  // cada aba mantém a sua lógica (passos, limites, o que salvar: leitura.ts e partitura.ts) e diz aqui o que pode e o que acontece
  // em cada clique. Os botões levam `data-acao` ("menos", "padrao", "mais") para os testes não dependerem da ordem na tela.
  type Rotulos = { grupo: string; diminuir: string; restaurar: string; aumentar: string };
  let {
    rotulos,
    podeDiminuir,
    podeAumentar,
    noPadrao,
    aoDiminuir,
    aoRestaurar,
    aoAumentar,
  }: {
    rotulos: Rotulos;
    podeDiminuir: boolean;
    podeAumentar: boolean;
    /** Já está no tamanho normal: não há o que restaurar. */
    noPadrao: boolean;
    aoDiminuir: () => void;
    aoRestaurar: () => void;
    aoAumentar: () => void;
  } = $props();
</script>

<div class="controle-tamanho" role="group" aria-label={rotulos.grupo}>
  <button class="botao-barra" data-acao="mais" aria-label={rotulos.aumentar} title={rotulos.aumentar} disabled={!podeAumentar} onclick={aoAumentar}>
    <Icone nome="mais" tamanho={24} />
  </button>
  <button class="botao-barra" data-acao="padrao" aria-label={rotulos.restaurar} title={rotulos.restaurar} disabled={noPadrao} onclick={aoRestaurar}>
    <Icone nome="restaurar" tamanho={24} />
  </button>
  <button class="botao-barra" data-acao="menos" aria-label={rotulos.diminuir} title={rotulos.diminuir} disabled={!podeDiminuir} onclick={aoDiminuir}>
    <Icone nome="menos" tamanho={24} />
  </button>
</div>

<style>
  .controle-tamanho { display: flex; gap: 0.2rem; }
</style>
