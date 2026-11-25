// Organizar muitas gravações (I-39): busca, filtro, agrupar por dia, "mostrar mais" e a mesclagem da leitura completa com o que mudou durante ela. Tudo PURO (sem tela e sem banco), para se
// testar no Vitest com milhares de registros. A lista inteira de `meta` fica na memória (o áudio fica fora, em outra loja); só o que se desenha é paginado.
import { numeroDaConsulta, normalizar } from "./busca-hinos";
import { contextoValido } from "./contexto";
import type { MetaGravacao, Resumo } from "./gravacoes";

/** Quantas gravações aparecem por vez (e quantas mais cada "Mostrar mais" traz). */
export const PAGINA = 20;

export type Filtro = "todas" | "hino" | "metronomo";
export type Consulta = { filtro: Filtro; busca: string };
export const SEM_FILTRO: Consulta = { filtro: "todas", busca: "" };

/** Da mais nova para a mais antiga; empata pelo id (a mesma ordem do índice `porData`). */
export const maisNovaPrimeiro = (a: MetaGravacao, b: MetaGravacao): number => b.criadaEm - a.criadaEm || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

/**
 * O que a lista mostra depois de uma leitura completa que começou antes de mudanças: o que foi LIDO e não foi apagado desde o início, mais o que foi SALVO desde o início e a leitura
 * não trouxe. Quem foi salvo e também foi lido entra uma vez só. A ordem é da mais nova para a mais antiga.
 */
export function mesclar(lidas: readonly MetaGravacao[], salvas: readonly MetaGravacao[], apagadas: ReadonlySet<string>): MetaGravacao[] {
  const porId = new Map<string, MetaGravacao>();
  for (const m of lidas) if (!apagadas.has(m.id)) porId.set(m.id, m);
  for (const m of salvas) if (!apagadas.has(m.id)) porId.set(m.id, m); // a versão salva vale (é a mais nova)
  return [...porId.values()].sort(maisNovaPrimeiro);
}

/** Quantidade e espaço de uma lista (o resumo do cabeçalho, derivado da memória em vez de um cursor no banco). */
export function resumir(lista: readonly MetaGravacao[]): Resumo {
  let bytes = 0;
  for (const m of lista) bytes += Number.isFinite(m.bytes) ? m.bytes : 0;
  return { quantidade: lista.length, bytes };
}

/**
 * O texto onde a busca procura, já normalizado (sem acento, minúsculas): o nome mostrado, o hino do contexto (número e título) ou o metrônomo, e a data. `nomeDe` devolve o nome na
 * língua da tela. Calcular UMA vez por registro (quem chama guarda), e não a cada tecla.
 */
export function chaveDeBusca(m: MetaGravacao, nomeDe: (m: MetaGravacao) => string, dataDe: (m: MetaGravacao) => string): string {
  const c = contextoValido(m.contexto);
  const contexto = c?.origem === "hino" && c.hino ? `hino ${c.hino.numero} ${c.hino.titulo}` : c?.origem === "metronomo" && c.metronomo ? `metronomo ${c.metronomo.bpm} bpm` : "";
  return normalizar(`${nomeDe(m)} ${contexto} ${dataDe(m)}`);
}

/** A gravação entra no filtro de origem? */
export function passaNoFiltro(m: MetaGravacao, filtro: Filtro): boolean {
  if (filtro === "todas") return true;
  return contextoValido(m.contexto)?.origem === filtro;
}

/**
 * As gravações que passam no filtro e na busca. Busca só de número ("10", "hino 10") vale como NÚMERO DE HINO (e não casa com a data "10/11" nem com "0:10"); senão, cada palavra da
 * busca tem de aparecer na chave (nome, hino, data). `chaveDe` devolve a chave já normalizada de cada registro.
 */
export function filtrar(lista: readonly MetaGravacao[], c: Consulta, chaveDe: (m: MetaGravacao) => string): MetaGravacao[] {
  const busca = normalizar(c.busca);
  const numero = busca ? numeroDaConsulta(c.busca) : null;
  const palavras = busca && numero === null ? busca.split(" ").filter(Boolean) : [];
  return lista.filter((m) => {
    if (!passaNoFiltro(m, c.filtro)) return false;
    if (numero !== null) {
      const x = contextoValido(m.contexto);
      return x?.origem === "hino" && x.hino?.numero === numero;
    }
    if (palavras.length === 0) return true;
    const chave = chaveDe(m);
    return palavras.every((p) => chave.includes(p));
  });
}

/** As primeiras `quantas` (a janela que se desenha). */
export const janela = <T>(lista: readonly T[], quantas: number): T[] => lista.slice(0, Math.max(0, Math.floor(quantas)));

// ---------- agrupar por dia ----------

/** O dia civil LOCAL de um instante, como um número de dias (as componentes locais; subtrair dois deles dá a diferença certa mesmo na mudança de horário de verão). */
export function diaCivil(ms: number): number {
  const d = new Date(ms);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

export type TipoDeGrupo = "hoje" | "ontem" | "semana" | "mes";
export type Grupo = { chave: string; tipo: TipoDeGrupo; ano: number; mes: number; itens: MetaGravacao[] };

/** Em que grupo cai um instante, em relação a `agora`: hoje, ontem, os 5 dias antes (completando os últimos 7 dias) e depois o mês. Instante no futuro vale "hoje". */
export function grupoDe(criadaEm: number, agora: number): { chave: string; tipo: TipoDeGrupo; ano: number; mes: number } {
  const dias = diaCivil(agora) - diaCivil(criadaEm);
  const d = new Date(criadaEm);
  if (dias <= 0) return { chave: "hoje", tipo: "hoje", ano: d.getFullYear(), mes: d.getMonth() };
  if (dias === 1) return { chave: "ontem", tipo: "ontem", ano: d.getFullYear(), mes: d.getMonth() };
  if (dias < 7) return { chave: "semana", tipo: "semana", ano: d.getFullYear(), mes: d.getMonth() };
  return { chave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, tipo: "mes", ano: d.getFullYear(), mes: d.getMonth() };
}

/** Junta, em ordem, as gravações seguidas do mesmo grupo (a lista já vem da mais nova para a mais antiga, então cada grupo é um trecho só). */
export function agrupar(lista: readonly MetaGravacao[], agora: number): Grupo[] {
  const grupos: Grupo[] = [];
  for (const m of lista) {
    const g = grupoDe(m.criadaEm, agora);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.chave === g.chave) ultimo.itens.push(m);
    else grupos.push({ ...g, itens: [m] });
  }
  return grupos;
}
