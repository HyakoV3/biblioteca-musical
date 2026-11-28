// A chave de busca de cada gravação, calculada UMA vez por registro e guardada num cache que se renova quando a língua da tela muda.
import { formatarData, type MetaGravacao } from "./gravacoes";
import { chaveDeBusca, nomeDaGravacao } from "./organizar";

type Tradutor = (chave: string, p?: Record<string, string | number>) => string;

/** Cria o `chaveDe` da lista: `t` traduz, `idiomaAtual` é lido a cada chamada (e, na tela, é reativo). */
export function criarChaveDe(t: Tradutor, idiomaAtual: () => string): (m: MetaGravacao) => string {
  let cache = new WeakMap<MetaGravacao, string>();
  let idiomaDoCache = idiomaAtual();
  return (m) => {
    const idioma = idiomaAtual();
    if (idiomaDoCache !== idioma) {
      cache = new WeakMap();
      idiomaDoCache = idioma;
    }
    let c = cache.get(m);
    if (c === undefined) {
      const data = formatarData(m.criadaEm, idioma);
      c = chaveDeBusca(m, (x) => nomeDaGravacao(x, t, idioma), () => data);
      cache.set(m, c);
    }
    return c;
  };
}
