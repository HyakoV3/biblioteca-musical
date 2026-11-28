// O estado da lista de gravações guardadas (a aba Gravador): ler tudo, inserir, apagar, renomear/favoritar e "Apagar todas", com o foco devolvido a um lugar sensato. A tela só mostra isto.
import { apagarCopiasEnviadas } from "./compartilhar";
import { gravacoes, type MetaGravacao, type Mudancas } from "./gravacoes";
import { focarVizinhoOuTitulo, itemTemOFoco, recuperarFoco, vizinhoNaOrdem } from "./gravadorFoco";
import { PAGINA, mesclar } from "./organizar";
import { ConfirmacaoComPrazo } from "./confirmacaoComPrazo.svelte";
import { tick } from "svelte";

/** O tempo para confirmar "Apagar todas" antes de o botão voltar ao normal. */
export const ESPERA_DA_CONFIRMACAO_MS = 4000;

/**
 * O que mudou enquanto a leitura completa corria: o que foi SALVO e o que foi APAGADO desde o início dela. Ao chegar, a leitura é mesclada com isso (`mesclar`), em vez de substituir a lista
 * (senão uma gravação feita durante a leitura sumiria, e uma apagada voltaria).
 */
type Registro = { salvas: MetaGravacao[]; apagadas: Set<string>; alteradas: Map<string, MetaGravacao> };
const novoRegistro = (): Registro => ({ salvas: [], apagadas: new Set<string>(), alteradas: new Map<string, MetaGravacao>() });

export class ListaDeGravacoes {
  /** Todas as gravações guardadas (só os metadados; o áudio fica no banco), da mais nova para a mais antiga. `$state.raw`: a lista é trocada por inteira, por cópia, sem um proxy por registro. */
  todas = $state.raw<MetaGravacao[]>([]);
  listaPronta = $state(false);
  /** A leitura da lista falhou: aparece o aviso com "Tentar de novo". */
  erroCarga = $state(false);
  /** Apagar ou mudar falhou. */
  erroAcao = $state(false);
  /** Quantas gravações a lista mostra (cresce de PAGINA em PAGINA com "Mostrar mais"). */
  mostrando = $state(PAGINA);
  /** A gravação que acabou de ser feita: aparece sempre, mesmo fora do filtro, até a próxima troca de filtro ou busca. */
  novaId = $state<string | null>(null);
  /** Qual gravação da lista está tocando (só uma por vez). */
  tocandoId = $state<string | null>(null);
  /** O primeiro toque em "Apagar todas" pede confirmação, que expira. */
  readonly confirmacao = new ConfirmacaoComPrazo(ESPERA_DA_CONFIRMACAO_MS);
  /** O componente foi desmontado: o que chegar depois (a leitura atrasada, a escrita atrasada de uma gravação) não pode mexer no que já não existe. */
  destruida = false;

  #registro: Registro | null = null; // nulo fora de uma leitura
  /** Numera as leituras: "Apagar todas" ou uma leitura mais nova descarta a anterior. */
  #carga = 0;
  /** Os ids na ordem da tela (destaques e janela), para saber para onde o foco vai. */
  readonly #ordem: () => string[];

  constructor(ordem: () => string[]) {
    this.#ordem = ordem;
  }

  /** Põe uma gravação recém-guardada no topo da lista (e a marca como "nova", para ela não sumir de um filtro que não a inclui). */
  inserir(meta: MetaGravacao): void {
    this.#registro?.salvas.push(meta);
    this.todas = mesclar(this.todas, [meta], new Set());
    this.novaId = meta.id;
  }

  /** Tira da lista (e do que tocava e do "novo") o que já não existe. */
  #remover(ids: readonly string[]): void {
    for (const id of ids) this.#registro?.apagadas.add(id);
    const fora = new Set(ids);
    this.todas = this.todas.filter((m) => !fora.has(m.id));
    if (this.tocandoId !== null && fora.has(this.tocandoId)) this.tocandoId = null;
    if (this.novaId !== null && fora.has(this.novaId)) this.novaId = null;
  }

  /** Lê todos os metadados de uma vez e os mescla com o que mudou durante a leitura. */
  async carregarTudo(): Promise<void> {
    const minha = ++this.#carga;
    const meu = (this.#registro = novoRegistro());
    try {
      const lidas = await gravacoes.listarTodas();
      this.#receber(minha, meu, lidas);
    } catch (e) {
      console.warn("gravador: não foi possível ler as gravações", e);
      if (minha === this.#carga) this.erroCarga = true;
    } finally {
      if (minha === this.#carga) {
        this.#registro = null;
        this.listaPronta = true;
      }
    }
  }

  #receber(minha: number, meu: Registro, lidas: MetaGravacao[]): void {
    if (this.destruida || minha !== this.#carga) return; // "Apagar todas" ou uma leitura mais nova aconteceu no meio: esta é do passado
    this.todas = mesclar(lidas, meu.salvas, meu.apagadas, meu.alteradas);
    this.erroCarga = false;
  }

  /** Muda o nome ou a estrela de uma gravação. Se ela já não existe (apagada em outro lugar), sai da lista. Devolve se deu certo. */
  async atualizarUma(id: string, mudancas: Mudancas): Promise<boolean> {
    // O foco não pode se perder quando a mudança TIRA o item da lista (tirar a estrela com o filtro "Favoritas"), nem quando o MOVE (da janela para o destaque: o navegador tira o foco
    // de um nó movido): vai ao item seguinte, ao próprio item ou, sem nenhum, ao título.
    const vizinho = vizinhoNaOrdem(this.#ordem(), id);
    const tinhaFoco = itemTemOFoco(id);
    try {
      const novo = await gravacoes.atualizar(id, mudancas);
      if (novo) this.#aplicar(id, novo);
      else this.#remover([id]); // apagada em outro lugar: sai da lista como em `apagarUma`
      await recuperarFoco(id, vizinho, tinhaFoco);
      return true;
    } catch (e) {
      console.warn("gravador: não foi possível salvar a alteração", e);
      return false;
    }
  }

  #aplicar(id: string, novo: MetaGravacao): void {
    this.#registro?.alteradas.set(id, novo);
    this.todas = this.todas.map((m) => (m.id === id ? novo : m));
    this.erroAcao = false;
  }

  async apagarUma(id: string): Promise<void> {
    // Para onde vai o foco: o item seguinte da tela (ou o anterior); sem nenhum, o título da lista.
    const vizinho = vizinhoNaOrdem(this.#ordem(), id);
    try {
      await gravacoes.apagar(id);
      this.#remover([id]);
      this.erroAcao = false;
      await tick();
      focarVizinhoOuTitulo(vizinho);
    } catch (e) {
      console.warn("gravador: não foi possível apagar", e);
      this.erroAcao = true;
    }
  }

  /** O primeiro toque pede confirmação (que expira); o segundo apaga tudo. */
  async apagarTodas(): Promise<void> {
    if (!this.confirmacao.pedida) {
      this.confirmacao.pedir();
      return;
    }
    this.confirmacao.cancelar();
    try {
      await gravacoes.apagarTodas();
      // As cópias que o "Enviar" deixou no cache do Android também saem. Se alguma não sair, as gravações do app já foram apagadas: fica só o registro no console.
      if (!apagarCopiasEnviadas()) console.warn("gravador: não consegui apagar todas as cópias enviadas do cache do aparelho");
      this.#zerar();
    } catch (e) {
      console.warn("gravador: não foi possível apagar tudo", e);
      this.erroAcao = true;
    }
  }

  /** Tudo apagado: uma leitura em andamento é descartada (traria gravações que já não existem); se apagar falhar, ela segue. */
  #zerar(): void {
    this.#carga++;
    this.#registro = null;
    this.todas = [];
    this.listaPronta = true; // sabemos o que há: nada
    this.tocandoId = null;
    this.novaId = null;
    this.mostrando = PAGINA;
    this.erroAcao = false;
    this.erroCarga = false;
  }

  destruir(): void {
    this.destruida = true;
    this.confirmacao.cancelar();
  }
}
