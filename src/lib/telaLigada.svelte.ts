// "Manter a tela ligada" (tela do hino): com a opção ligada, a tela não apaga enquanto um hino ou trecho toca; ao pausar, parar ou terminar, ela volta ao tempo
// do sistema (que vence se for maior). O efeito que aplica isso vive no layout, para valer também com o hino tocando em outra tela.
import { lerManterTela, salvarManterTela } from "./preferencias";

class TelaLigada {
  manter = $state(lerManterTela());

  alternar() {
    this.manter = !this.manter;
    salvarManterTela(this.manter);
  }
}

export const telaLigada = new TelaLigada();
