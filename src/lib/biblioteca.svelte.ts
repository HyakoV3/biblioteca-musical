// Estado compartilhado da biblioteca: o conteúdo carregado e a busca sobrevivem à navegação entre
// telas (assim voltar do hino devolve a lista como estava) e o Rust é chamado uma vez só.
import { Channel, invoke } from "@tauri-apps/api/core";
import type { Sincronia } from "./karaoke";
import { LIMITE_ZIP_BYTES, bytesParaBase64 } from "./pacote";
import type { Voz } from "./sintetizador";

export type Hino = {
  numero: number;
  titulo: string;
  autoria?: string | null;
  tonalidade?: string | null;
  letra: string[];
  partitura?: string | null;
  andamento?: number | null;
  /** Uma passada normal do hino. */
  vozes: Voz[];
  /** Última passada, quando o hino tem final (mesmas vozes, na mesma ordem). */
  final?: { vozes: Voz[] } | null;
  /** Do começo até o fim da nota marcada com "*" (mesmas vozes, na mesma ordem). */
  introducao?: { vozes: Voz[] } | null;
  /** Tempo de cada sílaba da letra, para o karaokê (opcional). */
  sincronia?: Sincronia | null;
  /** Em que instante cada compasso da partitura começa, em cada fluxo de notas, para destacá-lo na partitura (opcional). */
  compassos?: Compassos | null;
};

/** `[inicio_em_batidas, indice_do_compasso]`: o índice conta os compassos escritos da partitura, a partir de 0 (a ordem dos `g.measure` do SVG). */
export type InicioDeCompasso = [number, number];
/** Os compassos de cada fluxo de notas; o tempo está na régua do próprio fluxo (a mesma das notas). */
export type Compassos = { normal: InicioDeCompasso[]; final?: InicioDeCompasso[] | null; introducao?: InicioDeCompasso[] | null };

export type Pacote = {
  hinario: { versao: number; hinario: { id: string; nome: string; idioma?: string | null }; hinos: Hino[] };
  exemplo: boolean;
  /** Números dos hinos com partitura (SVG) importada, em ordem. Vazio sem pacote .zip importado. */
  partituras: number[];
};

/** Uma partitura do .zip que não entrou (não passou na verificação do SVG) e o motivo, em texto do Rust. */
export type Recusada = { numero: number; motivo: string };

/** Resposta da importação de um pacote .zip. */
export type Importacao = { pacote: Pacote; partituras: number; recusadas: Recusada[] };

let pacote = $state<Pacote | null>(null);
let erro = $state("");
let busca = $state("");
let carregando = false;

export const biblioteca = {
  get pacote() {
    return pacote;
  },
  get erro() {
    return erro;
  },
  get busca() {
    return busca;
  },
  set busca(v: string) {
    busca = v;
  },

  /** Carrega uma vez; chamar de novo só tenta outra vez se a anterior falhou. */
  async carregar() {
    if (pacote || carregando) return;
    carregando = true;
    erro = "";
    try {
      pacote = await invoke<Pacote>("carregar_hinario");
    } catch (e) {
      erro = String(e);
    } finally {
      carregando = false;
    }
  },

  /** Lança erro (texto vindo do Rust) se o arquivo for inválido; o conteúdo atual não muda. */
  async importar(json: string) {
    pacote = await invoke<Pacote>("importar_hinario", { json });
    busca = "";
    return pacote;
  },

  /** Instala o pacote de partituras (zip só com os SVG, já baixado e conferido). Os bytes vão em **base64** (texto): corpo binário não chega
   *  ao Rust no Android. Lança erro (texto do Rust) se o pacote for recusado; o conteúdo atual não muda. */
  async importarPartituras(bytes: Uint8Array, aoProgredir?: (fracao: number) => void) {
    if (bytes.length > LIMITE_ZIP_BYTES) throw JSON.stringify(["zip_grande_demais"]); // o mesmo erro do Rust, sem montar o texto
    // O Rust avisa quantas partituras já foram tratadas (o canal é o jeito do Tauri de mandar eventos durante um comando).
    const canal = new Channel<{ feito: number; total: number }>();
    // As mensagens do canal e o retorno do `invoke` seguem caminhos diferentes: uma mensagem pode chegar DEPOIS de a chamada terminar. Passado o fim,
    // elas são ignoradas, para não religar a fase "instalando" depois de o chamador já ter voltado ao ocioso ou ao erro.
    let ativo = true;
    canal.onmessage = (m) => {
      if (ativo) aoProgredir?.(m.total > 0 ? m.feito / m.total : 0);
    };
    let r: Importacao;
    try {
      r = await invoke<Importacao>("importar_partituras", { zip: bytesParaBase64(bytes), aoProgresso: canal });
    } finally {
      ativo = false;
    }
    pacote = r.pacote;
    return r;
  },

  /** Apaga só as partituras; o hinário fica. */
  async removerPartituras() {
    pacote = await invoke<Pacote>("remover_partituras");
    return pacote;
  },

  /** O SVG (já conferido no Rust) da partitura do hino, na versão da tela (`paisagem` pede a larga; sem ela no pacote vale o retrato).
   *  Lança erro se o hino não tiver partitura. */
  lerPartitura(numero: number, paisagem: boolean) {
    return invoke<string>("ler_partitura", { numero, paisagem });
  },

  async remover() {
    pacote = await invoke<Pacote>("remover_conteudo");
    busca = "";
    return pacote;
  },

  hino(numero: number): Hino | null {
    return pacote?.hinario.hinos.find((h) => h.numero === numero) ?? null;
  },
};
