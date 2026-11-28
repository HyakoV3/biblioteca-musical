// Props do ControleDeTamanho derivadas do passo atual: letra e partitura usam a mesma regra (limites e tamanho normal),
// então ela mora aqui em vez de repetida nas duas telas.
export type AcaoTamanho = "menos" | "padrao" | "mais";

export function propsControleTamanho(passo: number, passos: number, padrao: number, aoMudar: (acao: AcaoTamanho) => void) {
  return {
    podeDiminuir: passo > 0,
    podeAumentar: passo < passos - 1,
    noPadrao: passo === padrao,
    aoDiminuir: () => aoMudar("menos"),
    aoRestaurar: () => aoMudar("padrao"),
    aoAumentar: () => aoMudar("mais"),
  };
}

/** Rótulos do controle: mesma montagem nas duas telas, só mudam as chaves de tradução. `escalaNormal` é a escala do passo padrão (1 = 100%). */
export function rotulosControleTamanho<C extends string>(
  t: (chave: C, params?: Record<string, string | number>) => string,
  chaves: { grupo: C; diminuir: C; restaurar: C; aumentar: C },
  escalaNormal: number,
) {
  return {
    grupo: t(chaves.grupo),
    diminuir: t(chaves.diminuir),
    restaurar: t(chaves.restaurar, { n: Math.round(escalaNormal * 100) }),
    aumentar: t(chaves.aumentar),
  };
}
