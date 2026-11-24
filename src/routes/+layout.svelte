<script lang="ts">
  import "#lib/tema.css";
  import "#lib/movimento.css";
  import { onMount } from "svelte";
  import { biblioteca } from "#lib/biblioteca.svelte";
  import { i18n } from "#lib/i18n/index.svelte";
  import Miniplayer from "#lib/Miniplayer.svelte";
  import { reproducao } from "#lib/reproducao.svelte";
  import { aoPararPelaNotificacao, manterTelaLigada, sincronizarServico } from "#lib/servico";
  import { limparEscolhaAntigaDoFormato } from "#lib/preferencias";
  import { telaLigada } from "#lib/telaLigada.svelte";
  import { metronomo } from "#lib/metronomo.svelte";
  import { sons } from "#lib/sons/pacotes.svelte";
  import { aplicarEstilo, aplicarTema, estilo, tema } from "#lib/tema.svelte";

  let { children } = $props();

  // O conteúdo é carregado uma vez, para todas as telas.
  onMount(() => {
    biblioteca.carregar();
    limparEscolhaAntigaDoFormato(); // o interruptor .webm | .weba saiu
    sons.atualizar(); // quais sons gravados já estão instalados
    aoPararPelaNotificacao(() => reproducao.parar()); // o botão "Parar" da notificação do Android (I-22)
  });

  // No Android, o serviço em primeiro plano segura o app vivo enquanto um hino toca (I-22); fora dele a ponte não existe e isto não faz nada.
  $effect(() => {
    sincronizarServico(reproducao.estado === "tocando", reproducao.atual?.titulo ?? "");
  });

  // Com "manter a tela ligada" escolhido, a tela não apaga enquanto o hino toca; ao parar (ou ao desligar a opção) volta ao tempo do sistema.
  $effect(() => {
    manterTelaLigada(telaLigada.manter && reproducao.estado === "tocando");
  });

  // Um hino que começa a tocar cala o metrônomo (um som de cada vez).
  $effect(() => {
    if (reproducao.estado === "tocando") metronomo.parar();
  });

  // Mantém o atributo lang do documento em sintonia com o idioma escolhido.
  $effect(() => {
    document.documentElement.lang = i18n.idioma;
  });

  // Aplica a aparência escolhida: o modo (Automático, Claro ou Escuro) e o estilo de cor (normal, pergaminho, marinho).
  $effect(() => {
    aplicarTema(tema.atual);
    aplicarEstilo(estilo.atual);
  });
</script>

{@render children()}
<Miniplayer />

<style>
  :global(:root) {
    font-family: system-ui, sans-serif;
    color: var(--texto);
    background: var(--fundo);
  }
  /* --largura-trilho: a barra lateral de abas (celular deitado) ocupa o lado esquerdo; a página inteira se afasta dela. */
  :global(body) { margin: 0; -webkit-text-size-adjust: 100%; padding-left: var(--largura-trilho, 0rem); }
  /* Anel de foco visível para teclado e leitores de tela com navegação por foco. */
  :global(:focus-visible) { outline: 0.1875rem solid var(--foco); outline-offset: 0.125rem; }
  :global(a) { color: var(--acento); }
  /* Alto contraste (I-06): foco e bordas mais grossos e links sempre sublinhados, para nada depender só de cor. */
  :global(:root[data-tema="alto-contraste"] :focus-visible) { outline-width: 0.25rem; }
  :global(:root[data-tema="alto-contraste"] .botao) { border-width: 0.125rem; }
  :global(:root[data-tema="alto-contraste"] a) { text-decoration: underline; }
  /* Coluna central; respeita o recorte da câmera e a barra de gestos (viewport-fit=cover). */
  :global(.coluna) {
    max-width: 40rem; margin: 0 auto; box-sizing: border-box;
    padding-left: max(1rem, env(safe-area-inset-left)); padding-right: max(1rem, env(safe-area-inset-right));
  }
  :global(.conteudo) {
    padding-top: 1rem;
    /* --altura-miniplayer e --altura-navegacao (barra de abas) são definidas por quem as mostra. */
    padding-bottom: calc(
      var(--altura-miniplayer, 0rem) + var(--altura-navegacao, 0rem) + max(1.5rem, env(safe-area-inset-bottom))
    );
  }
  :global(.meta) { color: var(--suave); font-size: 0.9rem; }
  /* Texto só para leitores de tela. */
  :global(.so-leitor) {
    position: absolute; width: 0.0625rem; height: 0.0625rem; margin: -0.0625rem; padding: 0; overflow: hidden;
    clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
  :global(.botao) {
    display: inline-flex; align-items: center; justify-content: center; min-height: 3rem; box-sizing: border-box;
    padding: 0 1rem; font-size: 1rem; text-decoration: none; border-radius: 0.75rem;
    border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto); cursor: pointer;
  }
  :global(.botao.primario) { background: var(--acento); color: var(--acento-texto); border-color: var(--acento); font-weight: 600; }
  /* A parte do hino que está tocando: dourado. O contorno escuro dá contraste também no tema claro. */
  :global(.botao.tocando) { background: var(--ouro); color: var(--ouro-sobre); border: 0.125rem solid var(--ouro-linha); font-weight: 600; }
  :global(.bandeira-final) { color: var(--ouro-linha); font-weight: 700; }
  :global(.botao.tocando .bandeira-final) { color: inherit; }
  :global(.botao.perigo) { color: var(--perigo); border-color: var(--perigo); }
  :global(.botao:disabled) { opacity: 0.5; cursor: not-allowed; }
  /* Cartão: a moldura dos cartões do player e de Ajustes (Cartao.svelte e o cartão fixo "Tocar"). */
  :global(.cartao) { border: 0.0625rem solid var(--borda-controle); border-radius: 0.75rem; background: var(--superficie); }
  /* Botão quadrado das barras de controle (tamanho e alinhamento da letra, tamanho da partitura): 3 rem, só ícone; o que está
     ligado (aria-pressed) leva borda dourada. */
  :global(.botao-barra) {
    display: inline-flex; align-items: center; justify-content: center; padding: 0; min-width: 3rem; height: 3rem;
    border-radius: 0.75rem; line-height: 1; cursor: pointer;
    border: 0.0625rem solid var(--borda-controle); background: var(--superficie); color: var(--texto);
  }
  :global(.botao-barra:disabled) { opacity: 0.5; cursor: default; }
  :global(.botao-barra[aria-pressed="true"]) { border: 0.125rem solid var(--ouro-linha); }
</style>
