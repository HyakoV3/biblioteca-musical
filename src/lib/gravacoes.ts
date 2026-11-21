// As gravações guardadas do Gravador (I-03): ficam no IndexedDB da própria WebView, só neste aparelho (nada sai dele) e sobrevivem a fechar o app; somem
// quando a pessoa as apaga ou limpa os dados do app. Dois depósitos: `meta` (nome, data, duração, tamanho: leve, é o que a lista lê, página por página)
// e `blobs` (o arquivo de áudio, lido só quando a pessoa toca em "Ouvir"). Sem limite de quantidade: a lista pagina e a tela mostra o espaço usado.

import { rastro } from "./gravador";

export type MetaGravacao = { id: string; criadaEm: number; segundos: number; tipo: string; bytes: number };
/** Onde a página anterior terminou: a próxima começa logo depois (da mais nova para a mais antiga). */
export type Posicao = { criadaEm: number; id: string };
export type Pagina = { itens: MetaGravacao[]; temMais: boolean };
export type Resumo = { quantidade: number; bytes: number };

/** Quantas gravações a lista carrega por vez. */
export const TAMANHO_DA_PAGINA = 10;

export const BANCO = "bm-gravacoes";
const VERSAO = 1;

/** "17/11 10:46" (dia e mês na ordem do idioma, mais hora e minuto). */
export function formatarData(criadaEm: number, idioma: string): string {
  if (!Number.isFinite(criadaEm)) return "";
  return new Intl.DateTimeFormat(idioma, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(criadaEm));
}

const pedido = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((ok, falha) => {
    r.onsuccess = () => ok(r.result);
    r.onerror = () => falha(r.error ?? new Error("falha no armazenamento"));
  });

/** Roda `fn` numa transação e devolve o que ela devolver DEPOIS de a transação terminar de verdade (confirmada); qualquer erro ou cota estourada rejeita. */
function transacao<T>(banco: IDBDatabase, lojas: string[], modo: IDBTransactionMode, fn: (t: IDBTransaction) => Promise<T> | T): Promise<T> {
  return new Promise((ok, falha) => {
    let resultado: T;
    const t = banco.transaction(lojas, modo);
    t.oncomplete = () => ok(resultado);
    t.onerror = () => falha(t.error ?? new Error("falha no armazenamento"));
    t.onabort = () => falha(t.error ?? new Error("transação cancelada"));
    const desistir = (e: unknown) => {
      falha(e);
      try {
        t.abort(); // desfaz tudo o que a transação já pediu: ou entra tudo ou nada
      } catch {
        /* já terminou */
      }
    };
    let devolvido: Promise<T> | T;
    try {
      devolvido = fn(t);
    } catch (e) {
      return desistir(e); // um erro síncrono no meio (um valor que não pode ser guardado) também desfaz o que já foi pedido
    }
    Promise.resolve(devolvido).then((r) => (resultado = r), desistir);
  });
}

/** Quanto se espera cada tentativa de abrir o banco (ms) e quantas se fazem: três vezes 3 s cabem folgadas no limite de 10 s para guardar. */
export const ESPERA_AO_ABRIR_MS = 3000;
export const TENTATIVAS_DE_ABRIR = 3;
const MOTIVO_SEM_RESPOSTA = "o armazenamento não respondeu a esta tentativa de abrir";

/** Quanto se espera o armazenamento guardar uma gravação antes de desistir e deixá-la na tela (ms). */
export const LIMITE_PARA_GUARDAR_MS = 10000;

/**
 * Espera `promessa`, mas rejeita com `motivo` se ela não terminar em `ms`. Uma escrita no IndexedDB que nunca confirma (visto só no CI) deixaria a tela esperando para
 * sempre, sem erro e sem a gravação; assim a tela mostra o erro e deixa a gravação ao alcance (ouvir e enviar). O temporizador é desfeito quando a promessa termina.
 */
export function comLimite<T>(promessa: Promise<T>, ms: number, motivo: string): Promise<T> {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const estouro = new Promise<never>((_, falha) => {
    relogio = setTimeout(() => falha(new Error(motivo)), ms);
  });
  return Promise.race([promessa, estouro]).finally(() => clearTimeout(relogio));
}

export class Gravacoes {
  private abrindo: Promise<IDBDatabase> | null = null;

  /** `fabrica` devolve o IndexedDB (um falso nos testes). */
  constructor(private readonly fabrica: () => IDBFactory | undefined = () => (typeof indexedDB === "undefined" ? undefined : indexedDB)) {}

  /** Uma tentativa de abrir o banco. Se o navegador não responder (nem sucesso, nem erro, nem bloqueio), a promessa fica pendente: quem chama põe o limite. */
  private abrirUma(idb: IDBFactory): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((ok, falha) => {
      const r = idb.open(BANCO, VERSAO);
      r.onupgradeneeded = () => {
        rastro("armazenamento: criando o banco");
        const b = r.result;
        const meta = b.createObjectStore("meta", { keyPath: "id" });
        meta.createIndex("porData", ["criadaEm", "id"]); // da mais nova para a mais antiga, com o id desempatando
        b.createObjectStore("blobs");
      };
      r.onsuccess = () => {
        const b = r.result;
        rastro("armazenamento: banco aberto");
        // Se o navegador fechar a conexão (dados limpos, erro de disco) ou outra versão pedir para fechá-la, esquece-a: a próxima chamada reabre. Sem isso, toda
        // transação passaria a lançar `InvalidStateError` até reiniciar o app.
        b.onclose = () => {
          this.abrindo = null;
        };
        b.onversionchange = () => {
          b.close();
          this.abrindo = null;
        };
        ok(b);
      };
      r.onerror = () => falha(r.error ?? new Error("não abriu o armazenamento"));
      r.onblocked = () => {
        rastro("armazenamento: abertura bloqueada por outra conexão");
        falha(new Error("armazenamento bloqueado"));
      };
    });
  }

  private banco(): Promise<IDBDatabase> {
    if (this.abrindo) return this.abrindo;
    const idb = this.fabrica();
    if (!idb) return Promise.reject(new Error("armazenamento indisponível"));
    // No Chrome de um runner lento (CI) o `open()` às vezes NUNCA responde: sem sucesso, sem erro, sem bloqueio, e a tela ficava esperando para sempre. Cada tentativa tem um limite curto; se
    // estoura, abandona aquela solicitação (se ela chegar depois, a conexão é fechada) e pede de novo. Depois de `TENTATIVAS_DE_ABRIR` sem resposta, falha com uma mensagem clara.
    const aberto = (async () => {
      for (let i = 1; i <= TENTATIVAS_DE_ABRIR; i++) {
        const tentativa = this.abrirUma(idb);
        try {
          return await comLimite(tentativa, ESPERA_AO_ABRIR_MS, MOTIVO_SEM_RESPOSTA);
        } catch (e) {
          if (!(e instanceof Error && e.message === MOTIVO_SEM_RESPOSTA)) throw e;
          tentativa.then((b) => b.close(), () => {}); // abandonada: se abrir tarde, não deixa a conexão pendurada
          rastro(`armazenamento: sem resposta ao abrir (tentativa ${i} de ${TENTATIVAS_DE_ABRIR})`);
          if (i === TENTATIVAS_DE_ABRIR) throw new Error("o armazenamento não respondeu ao abrir");
        }
      }
      throw new Error("o armazenamento não respondeu ao abrir");
    })();
    // Uma falha ao abrir não fica guardada: a próxima chamada tenta de novo.
    this.abrindo = aberto.catch((e) => {
      this.abrindo = null;
      throw e;
    });
    return this.abrindo;
  }

  /**
   * Guarda uma gravação (metadados e arquivo, numa transação só: ou entram os dois ou nenhum). O arquivo entra como **bytes** (`ArrayBuffer`) e não como `Blob`:
   * no CI, o `put` de um Blob feito pelo MediaRecorder nunca confirmava (o gravador entregava o arquivo e o armazenamento ficava mudo). A leitura entende os
   * dois formatos, então o que já estava guardado como Blob continua tocando.
   */
  async salvar(blob: Blob, tipo: string, segundos: number): Promise<MetaGravacao> {
    const comeco = performance.now();
    rastro(`lendo os ${blob.size} bytes do arquivo`);
    const dados = await blob.arrayBuffer();
    rastro(`bytes lidos em ${Math.round(performance.now() - comeco)} ms; abrindo o armazenamento`);
    const banco = await this.banco();
    rastro(`armazenamento pronto em ${Math.round(performance.now() - comeco)} ms`);
    const meta: MetaGravacao = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      criadaEm: Date.now(),
      segundos: Number.isFinite(segundos) && segundos > 0 ? segundos : 0,
      tipo,
      bytes: blob.size,
    };
    await transacao(banco, ["meta", "blobs"], "readwrite", (t) => {
      t.objectStore("meta").put(meta);
      t.objectStore("blobs").put({ dados, tipo }, meta.id);
    });
    rastro(`transação confirmada em ${Math.round(performance.now() - comeco)} ms`);
    return meta;
  }

  /** Uma página da lista, da mais nova para a mais antiga, começando depois de `antes` (ou do começo). `temMais` diz se há outra página. */
  async listar(limite: number = TAMANHO_DA_PAGINA, antes?: Posicao): Promise<Pagina> {
    const banco = await this.banco();
    return transacao(banco, ["meta"], "readonly", (t) => {
      const faixa = antes ? globalThis.IDBKeyRange.upperBound([antes.criadaEm, antes.id], true) : undefined;
      const coletadas: MetaGravacao[] = [];
      return new Promise<Pagina>((ok, falha) => {
        const r = t.objectStore("meta").index("porData").openCursor(faixa, "prev");
        r.onerror = () => falha(r.error ?? new Error("falha ao ler"));
        r.onsuccess = () => {
          const c = r.result;
          if (!c || coletadas.length > limite) return ok({ itens: coletadas.slice(0, limite), temMais: coletadas.length > limite });
          coletadas.push(c.value as MetaGravacao);
          c.continue();
        };
      });
    });
  }

  /** O arquivo de áudio de uma gravação, ou nulo se não existe mais. */
  async blob(id: string): Promise<Blob | null> {
    const banco = await this.banco();
    return transacao(banco, ["blobs"], "readonly", async (t) => {
      const v = (await pedido(t.objectStore("blobs").get(id))) as Blob | { dados: ArrayBuffer; tipo: string } | undefined;
      if (!v) return null;
      return v instanceof Blob ? v : new Blob([v.dados], { type: v.tipo }); // o formato antigo era o Blob inteiro
    });
  }

  async apagar(id: string): Promise<void> {
    const banco = await this.banco();
    await transacao(banco, ["meta", "blobs"], "readwrite", (t) => {
      t.objectStore("meta").delete(id);
      t.objectStore("blobs").delete(id);
    });
  }

  async apagarTodas(): Promise<void> {
    const banco = await this.banco();
    await transacao(banco, ["meta", "blobs"], "readwrite", (t) => {
      t.objectStore("meta").clear();
      t.objectStore("blobs").clear();
    });
  }

  /** Quantas gravações há e quanto espaço ocupam (soma dos tamanhos dos arquivos). */
  async resumo(): Promise<Resumo> {
    const banco = await this.banco();
    return transacao(banco, ["meta"], "readonly", (t) => {
      let quantidade = 0;
      let bytes = 0;
      return new Promise<Resumo>((ok, falha) => {
        const r = t.objectStore("meta").openCursor();
        r.onerror = () => falha(r.error ?? new Error("falha ao ler"));
        r.onsuccess = () => {
          const c = r.result;
          if (!c) return ok({ quantidade, bytes });
          quantidade++;
          bytes += (c.value as MetaGravacao).bytes;
          c.continue();
        };
      });
    });
  }

  /** Fecha a conexão (nos testes, para recomeçar do zero). */
  async fechar(): Promise<void> {
    const b = await this.abrindo?.catch(() => null);
    b?.close();
    this.abrindo = null;
  }
}

export const gravacoes = new Gravacoes();
