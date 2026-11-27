// As gravações guardadas do Gravador (I-03): ficam no IndexedDB da própria WebView, só neste aparelho (nada sai dele) e sobrevivem a fechar o app; somem
// quando a pessoa as apaga ou limpa os dados do app. Dois depósitos: `meta` (nome, data, duração, tamanho: leve, é o que a lista lê, página por página)
// e `blobs` (o arquivo de áudio, lido só quando a pessoa toca em "Ouvir"). Sem limite de quantidade: a lista pagina e a tela mostra o espaço usado.
// A conexão, o esquema do banco e a transação ficam em `gravacoes-banco.ts`; os registros e as peças puras, em `gravacoes-registros.ts`; este arquivo reexporta o que é público deles.

import type { ContextoGravacao } from "./contexto";
import { rastro } from "./gravador";
import { abrirComTentativas, pedido, transacao } from "./gravacoes-banco";
import { aplicarMudancas, faixaDaSessao, guardarArquivo, metaRecuperada, novaMeta, novoId, removerSessao, varrer } from "./gravacoes-registros";
import type { MetaGravacao, Mudancas, Pagina, Posicao, Resumo, SessaoAberta } from "./gravacoes-registros";
import { normalizarMeta } from "./metaGravacao";

export type { MetaGravacao, Mudancas, Pagina, Posicao, Resumo, SessaoAberta } from "./gravacoes-registros";
export { BANCO, ESPERA_AO_ABRIR_MS, LIMITE_PARA_GUARDAR_MS, LimiteEstourado, TENTATIVAS_DE_ABRIR, comLimite } from "./gravacoes-banco";

/** Quantas gravações a lista carrega por vez. */
export const TAMANHO_DA_PAGINA = 10;

/** "17/11 10:46" (dia e mês na ordem do idioma, mais hora e minuto); com `comAno`, "17/11/2025 10:46". */
export function formatarData(criadaEm: number, idioma: string, comAno = false): string {
  if (!Number.isFinite(criadaEm)) return "";
  const opcoes: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };
  if (comAno) opcoes.year = "numeric";
  return new Intl.DateTimeFormat(idioma, opcoes).format(new Date(criadaEm));
}

export class Gravacoes {
  private abrindo: Promise<IDBDatabase> | null = null;
  /** Sessões já fechadas ou descartadas: um pedaço que chega atrasado para elas não é escrito (ficaria órfão e viraria uma gravação falsa na recuperação). */
  private readonly encerradas = new Set<string>();

  /** `fabrica` devolve o IndexedDB (um falso nos testes). */
  constructor(private readonly fabrica: () => IDBFactory | undefined = () => (typeof indexedDB === "undefined" ? undefined : indexedDB)) {}

  private banco(): Promise<IDBDatabase> {
    if (this.abrindo) return this.abrindo;
    const idb = this.fabrica();
    if (!idb) return Promise.reject(new Error("armazenamento indisponível"));
    // Uma falha ao abrir não fica guardada: a próxima chamada tenta de novo.
    this.abrindo = abrirComTentativas(idb, () => {
      this.abrindo = null;
    }).catch((e) => {
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
  async salvar(blob: Blob, tipo: string, segundos: number, contexto?: ContextoGravacao | null, sessao?: string | null): Promise<MetaGravacao> {
    const comeco = performance.now();
    rastro(`lendo os ${blob.size} bytes do arquivo`);
    const dados = await blob.arrayBuffer();
    rastro(`bytes lidos em ${Math.round(performance.now() - comeco)} ms; abrindo o armazenamento`);
    const banco = await this.banco();
    rastro(`armazenamento pronto em ${Math.round(performance.now() - comeco)} ms`);
    const meta = novaMeta(blob, tipo, segundos, contexto);
    // Com `sessao` (a gravação que veio dos pedaços), a sessão sai NA MESMA transação: se o app cair entre uma coisa e outra, a próxima abertura não recupera uma segunda cópia do que já está guardado.
    if (sessao) this.encerradas.add(sessao);
    await transacao(banco, sessao ? ["meta", "blobs", "sessoes", "pedacos"] : ["meta", "blobs"], "readwrite", (t) => {
      guardarArquivo(t, meta, dados);
      if (sessao) removerSessao(t, sessao);
    });
    rastro(`transação confirmada em ${Math.round(performance.now() - comeco)} ms`);
    return meta;
  }

  /** Abre uma sessão de gravação (AND-002): daqui em diante os pedaços entram por `guardarPedaco`. Devolve o id da sessão. */
  async abrirSessao(tipo: string, contexto?: ContextoGravacao | null): Promise<string> {
    const banco = await this.banco();
    const sessao: SessaoAberta = { id: novoId(), criadaEm: Date.now(), tipo, ...(contexto ? { contexto } : {}) };
    await transacao(banco, ["sessoes"], "readwrite", (t) => {
      t.objectStore("sessoes").put(sessao);
    });
    return sessao.id;
  }

  /** Guarda o pedaço `indice` de uma sessão aberta (como bytes, pelo mesmo motivo de `salvar`). Pedaço para uma sessão já encerrada é ignorado. */
  async guardarPedaco(sessao: string, indice: number, pedaco: Blob): Promise<void> {
    const dados = await pedaco.arrayBuffer();
    if (this.encerradas.has(sessao)) return;
    const banco = await this.banco();
    if (this.encerradas.has(sessao)) return; // conferido de novo: a espera pelo banco pode ter passado do fechamento
    await transacao(banco, ["pedacos"], "readwrite", (t) => {
      t.objectStore("pedacos").put({ dados }, [sessao, indice]);
    });
  }

  /** Encerra uma sessão sem fazer dela uma gravação (a gravação inteira já foi guardada pelo caminho normal): apaga os pedaços e o registro. */
  async descartarSessao(sessao: string): Promise<void> {
    this.encerradas.add(sessao);
    const banco = await this.banco();
    await transacao(banco, ["sessoes", "pedacos"], "readwrite", (t) => removerSessao(t, sessao));
  }

  /**
   * Na abertura do app: toda sessão que ficou aberta (o app caiu no meio da gravação) vira uma gravação guardada, montada com os pedaços que chegaram, na ordem. `excluir` é o que está
   * gravando agora (não é uma sobra). A duração é estimada (um pedaço por segundo). Sessão sem nenhum pedaço é só apagada. Devolve as gravações recuperadas.
   */
  async recuperarSessoes(excluir: readonly string[] = []): Promise<MetaGravacao[]> {
    const banco = await this.banco();
    const sessoes = (await transacao(banco, ["sessoes"], "readonly", (t) => pedido(t.objectStore("sessoes").getAll()))) as SessaoAberta[];
    const recuperadas: MetaGravacao[] = [];
    for (const s of sessoes) {
      if (excluir.includes(s.id) || this.encerradas.has(s.id)) continue;
      const meta = await this.tentarRecuperar(banco, s);
      if (meta) recuperadas.push(meta);
    }
    return recuperadas;
  }

  /** Uma sessão que não dá para recuperar (pouco espaço: a cópia inteira precisa de mais lugar que os pedaços) NÃO impede as outras: fica como está e a próxima abertura tenta de novo. */
  private async tentarRecuperar(banco: IDBDatabase, s: SessaoAberta): Promise<MetaGravacao | null> {
    try {
      return await this.recuperarUma(banco, s);
    } catch (e) {
      console.warn(`gravador: não foi possível recuperar a gravação ${s.id}`, e);
      return null;
    }
  }

  private async recuperarUma(banco: IDBDatabase, s: SessaoAberta): Promise<MetaGravacao | null> {
    const faixa = faixaDaSessao(s.id);
    const pedacos = (await transacao(banco, ["pedacos"], "readonly", (t) => pedido(t.objectStore("pedacos").getAll(faixa)))) as { dados: ArrayBuffer }[];
    const blob = new Blob(
      pedacos.map((p) => p.dados),
      { type: s.tipo },
    );
    const meta = blob.size > 0 ? metaRecuperada(s, pedacos.length, blob.size) : null;
    const dados = meta ? await blob.arrayBuffer() : null;
    // Numa transação só: a gravação entra e a sessão sai (ou nada muda, e a próxima abertura tenta de novo).
    await transacao(banco, ["meta", "blobs", "sessoes", "pedacos"], "readwrite", (t) => {
      if (meta && dados) guardarArquivo(t, meta, dados);
      removerSessao(t, s.id);
    });
    this.encerradas.add(s.id);
    return meta;
  }

  /** Uma página da lista, da mais nova para a mais antiga, começando depois de `antes` (ou do começo). `temMais` diz se há outra página. */
  async listar(limite: number = TAMANHO_DA_PAGINA, antes?: Posicao): Promise<Pagina> {
    const banco = await this.banco();
    return transacao(banco, ["meta"], "readonly", (t) => {
      const faixa = antes ? globalThis.IDBKeyRange.upperBound([antes.criadaEm, antes.id], true) : undefined;
      const coletadas: MetaGravacao[] = [];
      const cursor = t.objectStore("meta").index("porData").openCursor(faixa, "prev");
      // Lê uma a mais que o limite: é assim que se sabe se há outra página.
      const passo = (valor: unknown): boolean => {
        if (coletadas.length > limite) return false;
        coletadas.push(valor as MetaGravacao);
        return true;
      };
      return varrer(cursor, passo, () => ({ itens: coletadas.slice(0, limite), temMais: coletadas.length > limite }));
    });
  }

  /** Todos os metadados, da mais nova para a mais antiga (o áudio fica de fora: `meta` é leve). Uma leitura só, pelo índice `porData`, no lugar de um cursor por página. */
  async listarTodas(): Promise<MetaGravacao[]> {
    const banco = await this.banco();
    return transacao(banco, ["meta"], "readonly", async (t) => {
      const lidas = (await pedido(t.objectStore("meta").index("porData").getAll())) as MetaGravacao[];
      return lidas.reverse().map(normalizarMeta); // o índice vai da mais antiga para a mais nova; nome e estrela lidos do banco são validados
    });
  }

  /**
   * Muda o nome ou a estrela de uma gravação. O `get` e o `put` vão na MESMA transação de `meta`: duas mudanças seguidas (favoritar e renomear) não perdem uma à outra, e uma gravação
   * apagada no meio NÃO é recriada (sem registro, não grava nada e devolve nulo). Os outros campos do registro, conhecidos ou não, ficam como estão; o áudio não é tocado.
   */
  async atualizar(id: string, mudancas: Mudancas): Promise<MetaGravacao | null> {
    const banco = await this.banco();
    // CUIDADO: dentro desta função só se pode esperar pedidos do IndexedDB. Qualquer outro `await` (um `tick`, um `fetch`, um `setTimeout`) deixa a transação terminar sozinha,
    // e o `put` abaixo daria `TransactionInactiveError`.
    return transacao(banco, ["meta"], "readwrite", async (t) => {
      const loja = t.objectStore("meta");
      const atual = (await pedido(loja.get(id))) as MetaGravacao | undefined;
      if (!atual) return null;
      const final = aplicarMudancas(atual, mudancas);
      loja.put(final);
      return final;
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
      const passo = (valor: unknown): boolean => {
        quantidade++;
        bytes += (valor as MetaGravacao).bytes;
        return true;
      };
      return varrer(t.objectStore("meta").openCursor(), passo, () => ({ quantidade, bytes }));
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
