// Número do hino na lista: três dígitos ("001"), para os números ficarem alinhados em coluna.

const DIGITOS = 3;

/** Os zeros que faltam à esquerda (só visuais: a tela os esconde do leitor de tela, que lê "1" e não "zero zero um"). */
export const zerosAEsquerda = (n: number): string => "0".repeat(Math.max(0, DIGITOS - String(n).length));

/** A busca "1", "01" ou "001" acha o hino 1; texto que não é só dígitos não casa com número. */
export const casaComNumero = (busca: string, numero: number): boolean => /^\d+$/.test(busca) && Number(busca) === numero;
