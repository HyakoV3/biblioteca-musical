// Preferências por voz, guardadas no aparelho (localStorage): instrumento, volume e silenciar.
// A chave é o tipo da voz (soprano, contralto, tenor, baixo) ou, se não for reconhecido, o nome.
// Tudo é validado ao ler e qualquer falha de armazenamento é ignorada (o app segue com o padrão).

import { INSTRUMENTOS, ORGAOS, PADRAO, instrumentosDaVoz, tipoDaVoz, type InstrumentoId } from "./instrumentos";
import { IDS_REALISTAS, ehRealista } from "./realista";

export type PrefVoz = { instrumento: InstrumentoId; volume: number; muda: boolean };

const CHAVE = "prefs.vozes";

export const padrao = (): PrefVoz => ({ instrumento: PADRAO, volume: 1, muda: false });

const chaveDaVoz = (nome: string) => tipoDaVoz(nome) ?? `nome:${nome.trim().toLowerCase()}`;

function lerTudo(): Record<string, unknown> {
  try {
    const bruto = localStorage.getItem(CHAVE);
    const obj = bruto ? JSON.parse(bruto) : {};
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : {};
  } catch {
    return {};
  }
}

/** Preferência salva para a voz, já validada; instrumento fora da faixa da voz volta ao padrão. */
export function lerVoz(nome: string): PrefVoz {
  const p = padrao();
  const salvo = lerTudo()[chaveDaVoz(nome)];
  if (!salvo || typeof salvo !== "object") return p;
  const s = salvo as Record<string, unknown>;
  const permitidos: string[] = [...ORGAOS, ...instrumentosDaVoz(nome), ...IDS_REALISTAS];
  if (
    typeof s.instrumento === "string" &&
    (s.instrumento in INSTRUMENTOS || ehRealista(s.instrumento)) &&
    permitidos.includes(s.instrumento)
  ) {
    p.instrumento = s.instrumento as InstrumentoId;
  }
  if (typeof s.volume === "number" && Number.isFinite(s.volume)) p.volume = Math.min(1, Math.max(0, s.volume));
  if (typeof s.muda === "boolean") p.muda = s.muda;
  return p;
}

/** Salva as preferências de várias vozes de uma vez (uma gravação). */
export function salvarVozes(lista: { nome: string; pref: PrefVoz }[]) {
  try {
    const tudo = lerTudo();
    for (const { nome, pref } of lista) tudo[chaveDaVoz(nome)] = pref;
    localStorage.setItem(CHAVE, JSON.stringify(tudo));
  } catch {
    /* sem armazenamento: as escolhas valem só nesta sessão */
  }
}
