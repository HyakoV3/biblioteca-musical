// Guarda os sons baixados no Cache do navegador interno do app (funciona offline depois de baixado) e entrega os arquivos
// ao smplr. Chaves virtuais `/sons/<arquivo>`: nunca são buscadas na rede.
import type { Storage as ArmazenamentoSmplr } from "smplr";

const NOME = "sons-gravados-v1";
const chave = (arquivo: string) => `/sons/${arquivo}`;
const arquivoDaChave = (url: string) => decodeURIComponent(new URL(url, "http://x").pathname.replace(/^\/sons\//, ""));

/** O aparelho oferece o Cache API? */
export const disponivel = (): boolean => typeof caches !== "undefined";

/** Pede ao sistema para não apagar os sons quando faltar espaço (o navegador interno pode negar; não é obrigatório). */
export async function pedirPersistencia(): Promise<void> {
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* sem persistência garantida: o pacote pode ser baixado de novo */
  }
}

export async function guardar(arquivo: string, dados: Uint8Array): Promise<void> {
  const cache = await caches.open(NOME);
  await cache.put(chave(arquivo), new Response(new Blob([dados as BlobPart]), { headers: { "content-type": "text/javascript" } }));
}

/** Nomes dos arquivos guardados. */
export async function listar(): Promise<string[]> {
  if (!disponivel()) return [];
  const cache = await caches.open(NOME);
  return (await cache.keys()).map((r) => arquivoDaChave(r.url));
}

export async function apagar(arquivos: string[]): Promise<void> {
  const cache = await caches.open(NOME);
  for (const a of arquivos) await cache.delete(chave(a));
}

/** Armazenamento que o smplr usa para ler o arquivo de um instrumento: só do Cache, sem rede. */
export const armazenamentoDoSmplr: ArmazenamentoSmplr = {
  async fetch(url: string) {
    const cache = await caches.open(NOME);
    const resposta = await cache.match(url);
    if (!resposta) throw new Error(`som não instalado: ${url}`);
    return resposta;
  },
};
