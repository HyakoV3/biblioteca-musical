// A aba aberta da tela inicial (I-28) e onde estava a rolagem de cada uma. Fica fora do componente porque a tela inicial é desmontada quando a pessoa
// abre um hino: ao voltar, reabre a aba em que estava, no mesmo ponto. Vale durante o uso do app: ao abri-lo de novo, começa em Hinos.
export type AbaInicio = "hinos" | "afinador" | "gravador" | "metronomo";

export const inicio = $state<{ aba: AbaInicio; rolagem: Record<AbaInicio, number> }>({
  aba: "hinos",
  rolagem: { hinos: 0, afinador: 0, gravador: 0, metronomo: 0 },
});
