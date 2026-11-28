// Erros do lado Rust (src-tauri/src/hinario.rs) chegam como um JSON `["codigo", "argumento", ...]`: um código estável e os dados,
// sem frase pronta, para a interface traduzir no idioma da pessoa. É JSON, e não texto separado por delimitador, porque os
// argumentos podem vir de dados importados (nomes de voz) e conter qualquer caractere. Texto que não for um desses JSON, ou
// cujo código não seja conhecido, é devolvido como está.
import type { Chave } from "./i18n/pt";

type Tradutor = (c: Chave, p?: Record<string, string | number>) => string;

/** Código -> nomes dos argumentos, na ordem em que o Rust os envia (são os `{nomes}` do texto `erro.rust.<codigo>`). */
export const ERROS_DO_RUST: Readonly<Record<string, readonly string[]>> = {
  json_invalido: ["detalhe"],
  versao: ["versao", "esperado"],
  vozes_final: ["hino", "outras", "normal"],
  vozes_intro: ["hino", "outras", "normal"],
  nota_invalida: ["hino", "voz"],
  andamento_invalido: ["hino", "andamento"],
  grande_demais: [],
  vazio: [],
  repetido: ["numero"],
  gravar: ["detalhe"],
  ler: ["detalhe"],
  remover: ["detalhe"],
  zip_invalido: ["detalhe"],
  zip_grande_demais: [],
  zip_muitos_arquivos: [],
  zip_descompactado_grande: [],
  zip_inesperado: ["nome"],
  zip_repetido: [],
  partituras_nenhuma: [],
  partituras_sem_hinario: [],
  sem_partitura: ["numero"],
  partitura_invalida: ["numero", "motivo"],
  partituras_gravar: ["detalhe"],
  partituras_ler: ["detalhe"],
  partituras_remover: ["detalhe"],
  // Motivos de recusar uma partitura (svg.rs e pacote.rs): chegam como argumento de `partitura_invalida` e nas recusadas do pacote.
  svg_xml: ["detalhe"],
  svg_comentario: [],
  svg_instrucao: [],
  svg_raiz: ["nome"],
  svg_use_encadeado: ["id"],
  svg_fundo: [],
  svg_espaco: ["nome"],
  svg_elemento: ["nome"],
  svg_atributo_espaco: ["atributo", "nome"],
  svg_atributo: ["atributo", "nome"],
  svg_atributo_raiz: ["atributo"],
  svg_valor: ["atributo", "nome", "motivo"],
  svg_valor_id: [],
  svg_valor_tempo: [],
  svg_valor_href: [],
  svg_valor_proibido: ["trecho"],
  svg_texto: ["nome"],
  svg_paisagem: ["motivo"],
  pacote_sem_hino: [],
  pacote_sem_retrato: [],
  pacote_svg_grande: ["mib"],
  pacote_utf8: [],
};

/** `["codigo", "arg", ...]` decodificado, ou null se o texto não tiver esse formato. */
function decodificar(texto: string): string[] | null {
  if (!texto.startsWith("[")) return null;
  try {
    const v: unknown = JSON.parse(texto);
    return Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string") ? v : null;
  } catch {
    return null;
  }
}

/** O erro de um download de pacote (hinário ou partituras) já traduzido: pelo código do pacote (rede ou arquivo) ou, vindo do Rust, pelo texto bruto. Vazio se não há erro. */
export function traduzirErroDoDownload(erro: { codigo: string } | { bruto: string } | null, t: Tradutor): string {
  if (!erro) return "";
  if ("codigo" in erro) return t(erro.codigo === "rede" ? "sons.erro_rede" : "sons.erro_arquivo");
  return traduzirErro(erro.bruto, t);
}

export function traduzirErro(texto: string, t: Tradutor): string {
  const partes = decodificar(texto);
  if (!partes || !Object.hasOwn(ERROS_DO_RUST, partes[0])) return texto;
  const [codigo, ...args] = partes;
  const params: Record<string, string> = {};
  // Um argumento pode ser, ele mesmo, um erro codificado (o motivo de recusar a partitura, dentro de `partitura_invalida`): traduz-se por dentro.
  ERROS_DO_RUST[codigo].forEach((nome, k) => {
    params[nome] = traduzirErro(args[k] ?? "", t);
  });
  return t(`erro.rust.${codigo}` as Chave, params);
}
