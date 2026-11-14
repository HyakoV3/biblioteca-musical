// PROTÓTIPO da I-07: instrumentos "gravados" (amostras do banco FluidR3_GM, licença MIT) tocados com a biblioteca
// smplr, em vez da síntese. Só três instrumentos, para comparar o som com o atual. Os arquivos ficam em
// static/sons/FluidR3_GM/ (fora do Git; ver docs/roadmap-ideas.md, I-07) e vêm do repositório
// midi-js-soundfonts, de Benjamin Gleitzman.

export const REALISTAS = {
  real_orgao: { arquivo: "church_organ" },
  real_flauta: { arquivo: "flute" },
  real_clarinete: { arquivo: "clarinet" },
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
