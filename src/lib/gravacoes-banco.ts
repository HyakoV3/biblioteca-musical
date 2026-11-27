// A conexão com o IndexedDB das gravações guardadas (I-03): o esquema do banco, a transação com confirmação de verdade, o limite de espera e a abertura com tentativas.
// É só o encanamento: quem sabe o que cada depósito guarda é `gravacoes.ts`. O formato do banco (nome, versão, depósitos, chaves, índice) não pode mudar: é o que está no aparelho.

import { rastro } from "./gravador";

export const BANCO = "bm-gravacoes";
// Versão 2 (AND-002): `sessoes` e `pedacos`, onde a gravação em curso vai sendo guardada, um pedaço por vez, para sobreviver à queda do app.
const VERSAO = 2;

/** Quanto se espera cada tentativa de abrir o banco (ms) e quantas se fazem: três vezes 3 s cabem folgadas no limite de 10 s para guardar. */
export const ESPERA_AO_ABRIR_MS = 3000;
export const TENTATIVAS_DE_ABRIR = 3;
const MOTIVO_SEM_RESPOSTA = "o armazenamento não respondeu a esta tentativa de abrir";

/** Quanto se espera o armazenamento guardar uma gravação antes de desistir e deixá-la na tela (ms). */
export const LIMITE_PARA_GUARDAR_MS = 10000;

export const pedido = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((ok, falha) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => falha(r.error ?? new Error("falha no armazenamento"));
  });

/** Desfaz tudo o que a transação já pediu (ou entra tudo ou nada) e rejeita com `e`. */
function desistir(t: IDBTransaction, falha: (e: unknown) => void, e: unknown): void {
  falha(e);
  try {
    t.abort();
  } catch {
    /* já terminou */
  }
}

/** Roda `fn` numa transação e devolve o que ela devolver DEPOIS de a transação terminar de verdade (confirmada); qualquer erro ou cota estourada rejeita. */
export function transacao<T>(banco: IDBDatabase, lojas: string[], modo: IDBTransactionMode, fn: (t: IDBTransaction) => Promise<T> | T): Promise<T> {
  return new Promise((ok, falha) => {
    let resultado: T;
    const t = banco.transaction(lojas, modo);
    t.oncomplete = () => ok(resultado);
    t.onerror = () => falha(t.error ?? new Error("falha no armazenamento"));
    t.onabort = () => falha(t.error ?? new Error("transação cancelada"));
    let devolvido: Promise<T> | T;
    try {
      devolvido = fn(t);
    } catch (e) {
      return desistir(t, falha, e); // um erro síncrono no meio (um valor que não pode ser guardado) também desfaz o que já foi pedido
    }
    Promise.resolve(devolvido).then(
      (r) => (resultado = r),
      (e) => desistir(t, falha, e),
    );
  });
}

/** O prazo de `comLimite` acabou (a escrita pode ainda terminar): um erro próprio, para quem trata não precisar comparar o texto da mensagem. */
export class LimiteEstourado extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = "LimiteEstourado";
  }
}

/**
 * Espera `promessa`, mas rejeita com `motivo` se ela não terminar em `ms`. Uma escrita no IndexedDB que nunca confirma (visto só no CI) deixaria a tela esperando para
 * sempre, sem erro e sem a gravação; assim a tela mostra o erro e deixa a gravação ao alcance (ouvir e enviar). O temporizador é desfeito quando a promessa termina.
 */
export function comLimite<T>(promessa: Promise<T>, ms: number, motivo: string): Promise<T> {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const estouro = new Promise<never>((_, falha) => {
    relogio = setTimeout(() => falha(new LimiteEstourado(motivo)), ms);
  });
  return Promise.race([promessa, estouro]).finally(() => clearTimeout(relogio));
}

/** Cria os depósitos que faltam: o mesmo código cria o banco do zero (versão 2) e atualiza o da versão 1, sem tocar nas gravações que já estão lá. */
function criarDepositos(b: IDBDatabase): void {
  if (!b.objectStoreNames.contains("meta")) {
    const meta = b.createObjectStore("meta", { keyPath: "id" });
    meta.createIndex("porData", ["criadaEm", "id"]); // da mais nova para a mais antiga, com o id desempatando
  }
  if (!b.objectStoreNames.contains("blobs")) b.createObjectStore("blobs");
  if (!b.objectStoreNames.contains("sessoes")) b.createObjectStore("sessoes", { keyPath: "id" });
  if (!b.objectStoreNames.contains("pedacos")) b.createObjectStore("pedacos"); // chave: [id da sessão, número do pedaço]
}

/**
 * Se o navegador fechar a conexão (dados limpos, erro de disco) ou outra versão pedir para fechá-la, `esquecer` é chamado: a próxima chamada reabre. Sem isso, toda
 * transação passaria a lançar `InvalidStateError` até reiniciar o app.
 */
function vigiarConexao(b: IDBDatabase, esquecer: () => void): void {
  b.onclose = () => esquecer();
  b.onversionchange = () => {
    b.close();
    esquecer();
  };
}

/** Uma tentativa de abrir o banco. Se o navegador não responder (nem sucesso, nem erro, nem bloqueio), a promessa fica pendente: quem chama põe o limite. */
function abrirUma(idb: IDBFactory, esquecer: () => void): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((ok, falha) => {
    const r = idb.open(BANCO, VERSAO);
    r.onupgradeneeded = () => {
      rastro("armazenamento: criando ou atualizando o banco");
      criarDepositos(r.result);
    };
    r.onsuccess = () => {
      rastro("armazenamento: banco aberto");
      vigiarConexao(r.result, esquecer);
      ok(r.result);
    };
    r.onerror = () => falha(r.error ?? new Error("não abriu o armazenamento"));
    r.onblocked = () => {
      rastro("armazenamento: abertura bloqueada por outra conexão");
      falha(new Error("armazenamento bloqueado"));
    };
  });
}

/** Uma tentativa com limite: o banco, ou nulo se não respondeu a tempo (aí a solicitação é abandonada: se abrir tarde, a conexão é fechada). Qualquer outro erro sobe. */
async function tentarAbrir(idb: IDBFactory, esquecer: () => void, numero: number): Promise<IDBDatabase | null> {
  const tentativa = abrirUma(idb, esquecer);
  try {
    return await comLimite(tentativa, ESPERA_AO_ABRIR_MS, MOTIVO_SEM_RESPOSTA);
  } catch (e) {
    if (!(e instanceof Error && e.message === MOTIVO_SEM_RESPOSTA)) throw e;
    tentativa.then((b) => b.close(), () => {}); // abandonada: se abrir tarde, não deixa a conexão pendurada
    rastro(`armazenamento: sem resposta ao abrir (tentativa ${numero} de ${TENTATIVAS_DE_ABRIR})`);
    return null;
  }
}

/**
 * Abre o banco com até `TENTATIVAS_DE_ABRIR` tentativas, cada uma com limite curto. No Chrome de um runner lento (CI) o `open()` às vezes NUNCA responde: sem sucesso, sem erro,
 * sem bloqueio, e a tela ficava esperando para sempre. Sem resposta em todas, falha com uma mensagem clara.
 */
export async function abrirComTentativas(idb: IDBFactory, esquecer: () => void): Promise<IDBDatabase> {
  for (let i = 1; i <= TENTATIVAS_DE_ABRIR; i++) {
    const banco = await tentarAbrir(idb, esquecer, i);
    if (banco) return banco;
  }
  throw new Error("o armazenamento não respondeu ao abrir");
}
