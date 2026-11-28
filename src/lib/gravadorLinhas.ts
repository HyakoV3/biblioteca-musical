// O que a lista de gravações desenha, em funções PURAS: os destaques do topo, as linhas (cabeçalhos de dia e itens) e o nome de cada grupo.
import type { MetaGravacao } from "./gravacoes";
import type { Grupo } from "./organizar";

export type Marca = "nova" | "tocando";
export type Fixada = { meta: MetaGravacao; marca?: Marca };
export type Linha = { chave: string; tipo: "grupo"; grupo: Grupo } | { chave: string; tipo: "item"; meta: MetaGravacao; marca?: Marca };

export type DadosDosDestaques = {
  novaId: string | null;
  tocandoId: string | null;
  todas: readonly MetaGravacao[];
  idsNaJanela: ReadonlySet<string>;
  idsFiltradas: ReadonlySet<string>;
};

/** Por que um destaque está fora do filtro: a que toca, ou a recém-gravada. Dentro do filtro, nenhuma marca. */
const marcaDe = (id: string, d: DadosDosDestaques): Marca | undefined => (d.idsFiltradas.has(id) ? undefined : id === d.tocandoId ? "tocando" : "nova");

/** Em destaque, no topo, fora dos grupos: a recém-gravada e a que toca, quando a janela não as mostra. Fora do filtro levam uma marca que explica por que estão ali. */
export function calcularFixadas(d: DadosDosDestaques): Fixada[] {
  const lista: Fixada[] = [];
  for (const id of [d.novaId, d.tocandoId]) {
    if (!id || d.idsNaJanela.has(id) || lista.some((f) => f.meta.id === id)) continue;
    const meta = d.todas.find((m) => m.id === id);
    if (meta) lista.push({ meta, marca: marcaDe(id, d) });
  }
  return lista;
}

/** As linhas da lista, na ordem da tela: os destaques, e depois cada grupo por dia com o seu cabeçalho. A chave do item é só o id: ele não é recriado ao mudar de lugar. */
export function montarLinhas(fixadas: readonly Fixada[], grupos: readonly Grupo[]): Linha[] {
  const linhas: Linha[] = fixadas.map((f) => ({ chave: `i:${f.meta.id}`, tipo: "item", meta: f.meta, marca: f.marca }));
  for (const g of grupos) {
    linhas.push({ chave: `g:${g.chave}`, tipo: "grupo", grupo: g });
    for (const meta of g.itens) linhas.push({ chave: `i:${meta.id}`, tipo: "item", meta });
  }
  return linhas;
}

/** Os ids na ordem da tela: os destaques e depois a janela. */
export const ordemDaTela = (fixadas: readonly Fixada[], naJanela: readonly MetaGravacao[]): string[] => [...fixadas.map((f) => f.meta.id), ...naJanela.map((m) => m.id)];

/** "novembro de 2026" em pt e es sai em minúscula, entre "Hoje" e "Ontem" com maiúscula: o grupo do mês também começa por maiúscula. */
const inicialMaiuscula = (s: string, idioma: string) => s.charAt(0).toLocaleUpperCase(idioma) + s.slice(1);

type Rotulos = { hoje: string; ontem: string; semana: string };

/** O cabeçalho de um grupo por dia: os três recentes vêm traduzidos de fora; o mês é escrito no idioma da tela. */
export function rotuloDoGrupo(g: Grupo, rotulos: Rotulos, idioma: string): string {
  if (g.tipo !== "mes") return rotulos[g.tipo];
  return inicialMaiuscula(new Intl.DateTimeFormat(idioma, { month: "long", year: "numeric" }).format(new Date(g.ano, g.mes, 1)), idioma);
}
