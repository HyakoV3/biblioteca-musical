// Tipos globais do SvelteKit.
declare global {
  namespace App {
    // Estado do roteamento "raso": qual hino está aberto (para o botão voltar do celular).
    interface PageState {
      hino?: number;
    }
  }
}

export {};
