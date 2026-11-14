// Idiomas da interface. Para adicionar um idioma: crie <codigo>.ts (copie pt.ts, traduza os
// valores e mantenha as chaves) e registre em IDIOMAS abaixo. Veja docs/TRADUCOES.md.
import { pt, type Chave, type Dicionario } from "./pt";
import { es } from "./es";
import { en } from "./en";

export const IDIOMAS = {
  pt: { nome: "Português", dic: pt as Dicionario },
  es: { nome: "Español", dic: es },
  en: { nome: "English", dic: en },
} satisfies Record<string, { nome: string; dic: Dicionario }>;

export type Idioma = keyof typeof IDIOMAS;
const CHAVE = "idioma";

const ehIdioma = (x: unknown): x is Idioma => typeof x === "string" && x in IDIOMAS;

function inicial(): Idioma {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (ehIdioma(salvo)) return salvo;
  } catch {
    /* sem armazenamento: usa o idioma do sistema */
  }
  const sistema = (typeof navigator !== "undefined" ? navigator.language : "pt").slice(0, 2).toLowerCase();
  return ehIdioma(sistema) ? sistema : "pt";
}

let atual = $state<Idioma>(inicial());

export const i18n = {
  get idioma(): Idioma {
    return atual;
  },
  set idioma(v: Idioma) {
    atual = v;
    try {
      localStorage.setItem(CHAVE, v);
    } catch {
      /* preferência não salva */
    }
  },
  /** Texto na língua atual; `{nome}` é substituído pelos parâmetros. Falta de chave cai no português. */
  t(chave: Chave, params?: Record<string, string | number>): string {
    let s: string = IDIOMAS[atual].dic[chave] ?? pt[chave];
    if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  },
};
