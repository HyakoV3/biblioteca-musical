// Os registros das gravações guardadas e as peças puras e pequenas que `gravacoes.ts` monta: os tipos do que fica em `meta` e em `sessoes`, os ids, as faixas de pedaços,
// o que entra e sai de cada depósito dentro de uma transação, as mudanças de nome e estrela, e a varredura de um cursor. Nada aqui abre o banco.

import type { ContextoGravacao } from "./contexto";
import { limparTitulo, normalizarMeta } from "./metaGravacao";

/** Campos opcionais: `contexto` (I-38) só existe nas gravações feitas ouvindo o metrônomo ou um hino no fone; `titulo` e `favorita` (I-39) só quando a pessoa renomeia ou marca a estrela. As antigas não os têm (acrescentar campos não muda o banco). */
export type MetaGravacao = { id: string; criadaEm: number; segundos: number; tipo: string; bytes: number; contexto?: ContextoGravacao; titulo?: string; favorita?: boolean };
/** O que a pessoa pode mudar numa gravação: o nome (nulo ou vazio volta ao nome padrão) e a estrela. */
export type Mudancas = { titulo?: string | null; favorita?: boolean };
/** Onde a página anterior terminou: a próxima começa logo depois (da mais nova para a mais antiga). */
export type Posicao = { criadaEm: number; id: string };
export type Pagina = { itens: MetaGravacao[]; temMais: boolean };
export type Resumo = { quantidade: number; bytes: number };

/** Uma gravação que começou e ainda não foi fechada: se o app cair, é o que `recuperarSessoes` transforma em gravação guardada. */
export type SessaoAberta = { id: string; criadaEm: number; tipo: string; contexto?: ContextoGravacao };

export const novoId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Todos os pedaços de uma sessão, do 0 ao último (a chave é `[id da sessão, número do pedaço]`). */
export const faixaDaSessao = (sessao: string): IDBKeyRange => globalThis.IDBKeyRange.bound([sessao, 0], [sessao, Infinity]);

/** Uma gravação inteira entra: os metadados em `meta` e os bytes (com o tipo) em `blobs`. */
export function guardarArquivo(t: IDBTransaction, meta: MetaGravacao, dados: ArrayBuffer): void {
  t.objectStore("meta").put(meta);
  t.objectStore("blobs").put({ dados, tipo: meta.tipo }, meta.id);
}

/** A sessão sai: o registro e todos os pedaços. */
export function removerSessao(t: IDBTransaction, sessao: string): void {
  t.objectStore("sessoes").delete(sessao);
  t.objectStore("pedacos").delete(faixaDaSessao(sessao));
}

export function novaMeta(blob: Blob, tipo: string, segundos: number, contexto?: ContextoGravacao | null): MetaGravacao {
  return {
    id: novoId(),
    criadaEm: Date.now(),
    segundos: Number.isFinite(segundos) && segundos > 0 ? segundos : 0,
    tipo,
    bytes: blob.size,
    ...(contexto ? { contexto } : {}),
  };
}

/** A gravação montada com os pedaços de uma sessão que o app deixou aberta: a duração é estimada (um pedaço por segundo) e o contexto ganha a marca de que mudou durante. */
export function metaRecuperada(s: SessaoAberta, pedacos: number, bytes: number): MetaGravacao {
  return {
    id: novoId(),
    criadaEm: s.criadaEm,
    segundos: pedacos,
    tipo: s.tipo,
    bytes,
    ...(s.contexto ? { contexto: { ...s.contexto, mudouDurante: true } } : {}),
  };
}

function comTitulo(meta: MetaGravacao, titulo: string | null | undefined): void {
  const v = limparTitulo(titulo);
  if (v) meta.titulo = v;
  else delete meta.titulo;
}

function comFavorita(meta: MetaGravacao, favorita: boolean | undefined): void {
  if (favorita) meta.favorita = true;
  else delete meta.favorita;
}

/** O registro com só o que a pessoa mudou aplicado; os outros campos, conhecidos ou não, ficam como estão. */
export function aplicarMudancas(atual: MetaGravacao, mudancas: Mudancas): MetaGravacao {
  const novo: MetaGravacao = { ...atual };
  if ("titulo" in mudancas) comTitulo(novo, mudancas.titulo);
  if ("favorita" in mudancas) comFavorita(novo, mudancas.favorita);
  return normalizarMeta(novo); // grava o que a tela vai mostrar: um título inválido que já estava no banco sai agora
}

/** Percorre um cursor: `passo` recebe cada valor e diz se continua; ao acabar (ou parar), devolve `fim()`. */
export function varrer<T>(r: IDBRequest<IDBCursorWithValue | null>, passo: (valor: unknown) => boolean, fim: () => T): Promise<T> {
  return new Promise<T>((ok, falha) => {
    r.onerror = () => falha(r.error ?? new Error("falha ao ler"));
    r.onsuccess = () => {
      const c = r.result;
      if (!c || !passo(c.value)) return ok(fim());
      c.continue();
    };
  });
}
