<script lang="ts" generics="T extends string | number">
  // Escolha única em uma pílula só (controle segmentado): as opções ficam lado a lado dentro de um contorno com o canto do app (0.75rem), e a selecionada é um retângulo arredondado
  // próprio, preenchido e com anel (o formato diz "esta", e não só a cor). São botões de rádio de verdade: setas, Tab e leitor de tela funcionam como num grupo de rádio.
  // O grupo é de quem usa (um <fieldset> com legenda); aqui só estão as opções.
  let {
    nome,
    valor,
    opcoes,
    aoEscolher,
  }: {
    /** O `name` dos botões de rádio. */
    nome: string;
    valor: T;
    opcoes: { valor: T; rotulo: string; aria?: string }[];
    aoEscolher: (v: T) => void;
  } = $props();
</script>

<div class="segmentado">
  {#each opcoes as o (o.valor)}
    <label class:ativo={valor === o.valor}>
      <input class="radio-oculto" type="radio" name={nome} value={o.valor} checked={valor === o.valor} aria-label={o.aria} onchange={() => aoEscolher(o.valor)} />
      <span>{o.rotulo}</span>
    </label>
  {/each}
</div>

<style>
  .segmentado { display: flex; flex-wrap: wrap; gap: 0.15rem; padding: 0.2rem; border: var(--borda-padrao); border-radius: var(--raio); background: var(--superficie); }
  label { position: relative; flex: 1 1 0; min-width: min-content; }
  /* Cada opção tem o seu canto (0.55rem = o da pílula menos o respiro de dentro): a selecionada é um retângulo arredondado inteiro, e não um bloco de cantos retos. */
  span { display: flex; align-items: center; justify-content: center; min-height: var(--toque-minimo); box-sizing: border-box; padding: 0 0.4rem; border-radius: 0.55rem; text-align: center; line-height: 1.2; overflow-wrap: break-word; color: var(--texto); }
  .ativo span { background: color-mix(in srgb, var(--acento) 18%, var(--superficie)); box-shadow: inset 0 0 0 0.125rem var(--acento); font-weight: 700; }
  input:focus-visible + span { outline: var(--anel-foco); outline-offset: 0.0625rem; }
  input:disabled + span { opacity: 0.6; }
</style>
