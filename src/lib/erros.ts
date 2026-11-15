// Erros do lado Rust (src-tauri/src/hinario.rs) chegam como `codigo|argumento|argumento`: um código estável e os dados, sem
// frase pronta, para a interface traduzir no idioma da pessoa. O último argumento recebe todo o resto (um detalhe de sistema
// pode conter "|"). Texto que não começa por um código conhecido é devolvido como está.
import type { Chave } from "./i18n/pt";

type Tradutor = (c: Chave, p?: Record<string, string | number>) => string;

/** Código -> nomes dos argumentos, na ordem em que o Rust os envia (são os `{nomes}` do texto `erro.rust.<codigo>`). */
export const ERROS_DO_RUST: Readonly<Record<string, readonly string[]>> = {
  json_invalido: ["detalhe"],
  versao: ["versao", "esperado"],
  vozes_final: ["hino", "outras", "normal"],
  vozes_intro: ["hino", "outras", "normal"],
  grande_demais: [],
  vazio: [],
  repetido: ["numero"],
  gravar: ["detalhe"],
  ler: ["detalhe"],
  remover: ["detalhe"],
};

export function traduzirErro(texto: string, t: Tradutor): string {
  const corte = texto.indexOf("|");
  const codigo = corte < 0 ? texto : texto.slice(0, corte);
  if (!Object.hasOwn(ERROS_DO_RUST, codigo)) return texto;
  const nomes = ERROS_DO_RUST[codigo];
  const partes = corte < 0 ? [] : texto.slice(corte + 1).split("|");
  const params: Record<string, string> = {};
  nomes.forEach((nome, k) => {
    params[nome] = k === nomes.length - 1 ? partes.slice(k).join("|") : (partes[k] ?? "");
  });
  return t(`erro.rust.${codigo}` as Chave, params);
}
