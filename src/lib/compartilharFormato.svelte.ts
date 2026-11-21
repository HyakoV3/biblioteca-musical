// A escolha do formato do arquivo enviado (".webm" ou ".weba"), compartilhada por todas as gravações da lista e lembrada no aparelho.
import { lerFormatoWebm, salvarFormatoWebm, type FormatoWebm } from "./compartilharPrefs";

let atual = $state<FormatoWebm>(lerFormatoWebm());

export const formatoEnviado = {
  get atual() {
    return atual;
  },
  mudar(f: FormatoWebm) {
    atual = f;
    salvarFormatoWebm(f);
  },
};
