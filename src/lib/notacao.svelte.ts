// A escolha dos nomes das notas (sílabas, letras ou automático), lembrada neste aparelho. Ver `notacao.ts`.
import { CHAVE_NOTACAO, ehNotacao, type Notacao } from "./notacao";

function inicial(): Notacao {
  try {
    const salvo = typeof localStorage === "undefined" ? null : localStorage.getItem(CHAVE_NOTACAO);
    return ehNotacao(salvo) ? salvo : "auto";
  } catch {
    return "auto"; // sem armazenamento: automático
  }
}

let atual = $state<Notacao>(inicial());

export const notacao = {
  get atual() {
    return atual;
  },
  set atual(n: Notacao) {
    if (!ehNotacao(n)) return;
    atual = n;
    try {
      localStorage.setItem(CHAVE_NOTACAO, n);
    } catch {
      // sem armazenamento: vale só nesta abertura
    }
  },
};
