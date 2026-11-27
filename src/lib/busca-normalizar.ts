// Normalização de texto da busca de hinos: sem acentos, minúsculas, pontuação virando espaço. Pura.


/** Texto sem acentos e em minúsculas, com tudo que não é letra ou algarismo virando espaço, e o índice, no original, de cada caractere do resultado. */
export function normalizarComMapa(texto: string): { n: string; mapa: number[] } {
  let n = "";
  const mapa: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    const limpo = texto[i]!.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    for (const c of limpo) {
      n += /[a-z0-9]/.test(c) ? c : " ";
      mapa.push(i);
    }
  }
  return { n, mapa };
}

/** Sem acentos, em minúsculas, pontuação e hífen viram espaço; espaços repetidos viram um só. */
export function normalizar(texto: string): string {
  return normalizarComMapa(texto).n.replace(/ +/g, " ").trim();
}

export const palavrasDe = (n: string): string[] => n.split(" ").filter(Boolean);
