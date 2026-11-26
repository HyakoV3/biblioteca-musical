// Guarda os sons baixados no Cache do navegador interno do app (funciona offline depois de baixado) e entrega os arquivos
// ao smplr. Chaves virtuais `/sons/<arquivo>`: nunca são buscadas na rede.
import type { Storage as ArmazenamentoSmplr } from "smplr";

import { sha256Hex } from "./extrair";

const NOME = "sons-gravados-v1";
const CABECALHO_SHA = "x-sha256";
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

/** Guarda o arquivo junto do SHA-256 dele (cabeçalho `x-sha256`), para depois conferir o que está guardado com o manifesto. */
export async function guardar(arquivo: string, dados: Uint8Array, sha256: string): Promise<void> {
  const cache = await caches.open(NOME);
  await cache.put(chave(arquivo), new Response(new Blob([dados as BlobPart]), { headers: { "content-type": "text/javascript", [CABECALHO_SHA]: sha256 } }));
}

/** Um arquivo guardado e o SHA-256 dele. Guardado por uma versão antiga do app (sem o cabeçalho), o SHA é calculado do conteúdo. */
export type Guardado = { arquivo: string; sha256: string };

export async function listar(): Promise<Guardado[]> {
  if (!disponivel()) return [];
  const cache = await caches.open(NOME);
  return Promise.all(
    (await cache.keys()).map(async (r) => {
      const resposta = await cache.match(r);
      const gravado = resposta?.headers.get(CABECALHO_SHA);
      const sha256 = gravado ?? (resposta ? await sha256Hex(new Uint8Array(await resposta.arrayBuffer())) : "");
      return { arquivo: arquivoDaChave(r.url), sha256 };
    }),
  );
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
