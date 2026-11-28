// O que mandar à ponte do serviço de reprodução para o estado do hino (I-22, I-47). Pura, sem a ponte, para testar.

export type PassoDoServico = "ligar" | "pausar" | "parar" | "nada";

/** O estado do hino que o app mostra, e o que o serviço já sabe dele (o título com que foi ligado e se já está pausado). */
export type SituacaoDoServico = { tocando: boolean; pausado: boolean; titulo: string; ligadoCom: string | null; jaPausado: boolean };

/**
 * `ligar` ao tocar (ou ao trocar de hino, ou ao voltar de uma pausa), `pausar` ao pausar (a notificação fica com o botão "Tocar"), `parar` ao parar
 * ou terminar, e `nada` quando o estado não mudou.
 */
export function passoDoServico(s: SituacaoDoServico): PassoDoServico {
  if (s.tocando) return s.ligadoCom !== s.titulo || s.jaPausado ? "ligar" : "nada";
  if (s.ligadoCom === null) return "nada";
  if (s.pausado) return s.jaPausado ? "nada" : "pausar";
  return "parar";
}
