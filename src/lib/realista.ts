// PROTÓTIPO da I-07: instrumentos "gravados" (amostras do banco FluidR3_GM, licença MIT) tocados com a biblioteca
// smplr, em vez da síntese. Só três instrumentos, para comparar o som com o atual. Os arquivos ficam em
// static/sons/FluidR3_GM/ (fora do Git; ver docs/roadmap-ideas.md, I-07) e vêm do repositório
// midi-js-soundfonts, de Benjamin Gleitzman.

/**
 * `ganho`: multiplicador de volume que iguala o som gravado ao da síntese equivalente. As amostras do banco vêm bem
 * mais baixas que a síntese. Medido em 2026-11-14 (RMS de três notas, com a mesma cadeia de áudio): órgãos contra o
 * "orgao_principal" (0,109), flauta contra "flauta_doce" (0,216) e clarinete contra "clarinete" (0,125); gravados:
 * 0,052 / 0,047 / 0,040 / 0,050 / 0,065. Ganho = volume da síntese ÷ volume do gravado.
 */
export const REALISTAS = {
  real_orgao: { arquivo: "church_organ", ganho: 2.1 },
  real_orgao_palheta: { arquivo: "reed_organ", ganho: 2.3 },
  real_orgao_tirantes: { arquivo: "drawbar_organ", ganho: 2.7 },
  real_flauta: { arquivo: "flute", ganho: 4.3 },
  real_clarinete: { arquivo: "clarinet", ganho: 1.9 },
} as const;

export type RealistaId = keyof typeof REALISTAS;
export const IDS_REALISTAS = Object.keys(REALISTAS) as RealistaId[];

export const ehRealista = (id: string): id is RealistaId => Object.hasOwn(REALISTAS, id);

/** Endereço do arquivo de amostras, dentro do próprio app (funciona sem rede). */
export const urlDoRealista = (id: RealistaId) => `/sons/FluidR3_GM/${REALISTAS[id].arquivo}-mp3.js`;

let verificados: Promise<RealistaId[]> | null = null;

/**
 * Quais instrumentos gravados existem neste app: só os que têm o arquivo de amostras. Sem o pacote de sons, a lista
 * vem vazia e a tela nem mostra a opção. Um endereço que não existe cai no `index.html` do app (SPA), então não basta
 * a resposta ser "ok": o tipo do conteúdo não pode ser HTML.
 */
export function realistasDisponiveis(): Promise<RealistaId[]> {
  verificados ??= Promise.all(
    IDS_REALISTAS.map(async (id) => {
      try {
        const r = await fetch(urlDoRealista(id), { method: "HEAD" });
        return r.ok && !(r.headers.get("content-type") ?? "").includes("text/html") ? id : null;
      } catch {
        return null;
      }
    }),
  ).then((lista) => lista.filter((id): id is RealistaId => id !== null));
  return verificados;
}
