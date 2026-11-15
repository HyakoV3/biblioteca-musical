// Dados FICTÍCIOS para os testes. Nenhum hino real entra no repositório: estas notas e letras são inventadas.
import type { Voz } from "../src/lib/sintetizador";

/** Notas de uma voz: uma nota por `passo` batidas, de 0 até `fim` (exclusive), alternando duas alturas. */
export function escada(nome: string, fim: number, passo = 4, base = 60): Voz {
  const notas: Voz["notas"] = [];
  for (let t = 0, i = 0; t < fim; t += passo, i++) notas.push([t, passo, base + (i % 2) * 2]);
  return { nome, notas };
}

/**
 * Um hino fictício com a mesma estrutura de um hino com final: introdução de 11 batidas, passada normal de 48 e
 * passada do final de 96. Duas vozes (Soprano e Baixo).
 */
export function hinoComFinal() {
  return {
    vozes: [escada("Soprano", 48), escada("Baixo", 48, 4, 48)],
    final: { vozes: [escada("Soprano", 96), escada("Baixo", 96, 4, 48)] },
    introducao: { vozes: [escada("Soprano", 11, 1, 72), escada("Baixo", 11, 1, 40)] },
  };
}

/** Hino fictício sem final nem introdução (uma passada de 24 batidas). */
export function hinoSimples() {
  return { vozes: [escada("Soprano", 24), escada("Baixo", 24, 4, 48)] };
}
