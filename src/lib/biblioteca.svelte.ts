// Estado compartilhado da biblioteca: o conteúdo carregado e a busca sobrevivem à navegação entre
// telas (assim voltar do hino devolve a lista como estava) e o Rust é chamado uma vez só.
import { invoke } from "@tauri-apps/api/core";
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
};

export type Pacote = {
  hinario: { versao: number; hinario: { id: string; nome: string; idioma?: string | null }; hinos: Hino[] };
  exemplo: boolean;
};

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

  async remover() {
    pacote = await invoke<Pacote>("remover_conteudo");
    busca = "";
    return pacote;
  },

  hino(numero: number): Hino | null {
    return pacote?.hinario.hinos.find((h) => h.numero === numero) ?? null;
  },
};
