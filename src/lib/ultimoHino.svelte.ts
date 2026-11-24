// O último hino aberto (I-17): marca o hino na lista de hinos (borda própria) e alimenta o atalho "Continuar de onde parou". Lembrado no aparelho
// (`prefs.ultimo-hino`), então vale também depois de fechar o app. Só o número: o hino em si vem do hinário instalado (se ele não tem esse número, nada aparece).
import { lerUltimoHino, salvarUltimoHino } from "./preferencias";

let atual = $state<number | null>(lerUltimoHino());

export const ultimoHino = {
  get numero() {
    return atual;
  },
  definir(numero: number) {
    if (atual === numero) return;
    atual = numero;
    salvarUltimoHino(numero);
  },
};
