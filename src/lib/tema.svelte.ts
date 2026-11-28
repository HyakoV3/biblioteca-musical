// Preferência de aparência: Automático (padrão, segue o sistema), Claro, Escuro ou Alto contraste (I-06, baixa visão).
// "sistema" não define data-tema e deixa o CSS seguir prefers-color-scheme. O Automático NÃO liga o alto contraste sozinho
// (prefers-contrast): não se sabe se a WebView repassa essa preferência, e mudar a cor de quem não escolheu surpreenderia.
// O app.html aplica a escolha salva antes da primeira pintura, para não piscar.

import { CHAVE_ESTILO, ESTILOS, ehEstilo, type Estilo } from "./estilos";

export { ESTILOS, type Estilo };

export const TEMAS = ["sistema", "claro", "escuro", "alto-contraste"] as const;
export type Tema = (typeof TEMAS)[number];

const CHAVE = "tema";

const ehTema = (x: unknown): x is Tema => typeof x === "string" && (TEMAS as readonly string[]).includes(x);

/** Lê a preferência salva; sem armazenamento, ou com valor que não vale, devolve o padrão. */
function lerSalvo<T extends string>(chave: string, vale: (x: unknown) => x is T, padrao: T): T {
  try {
    const salvo = localStorage.getItem(chave);
    if (vale(salvo)) return salvo;
  } catch {
    /* sem armazenamento: fica o padrão */
  }
  return padrao;
}

/** Grava a preferência; se não der, ela só vale nesta sessão. */
function gravar(chave: string, valor: string) {
  try {
    localStorage.setItem(chave, valor);
  } catch {
    /* preferência não salva */
  }
}

/** Define o atributo `data-<nome>` do <html>, ou o remove quando o valor é o padrão do CSS. */
function aplicarAtributo(nome: "tema" | "estilo", valor: string, padrao: string) {
  if (valor === padrao) delete document.documentElement.dataset[nome];
  else document.documentElement.dataset[nome] = valor;
}

const inicial = (): Tema => lerSalvo(CHAVE, ehTema, "sistema");

/** Aplica o tema ao documento (chamado pelo layout sempre que a escolha muda). */
export function aplicarTema(t: Tema) {
  aplicarAtributo("tema", t, "sistema");
}

// --- Estilo de cor (normal, pergaminho, marinho), independente do modo acima ---
const estiloInicial = (): Estilo => lerSalvo(CHAVE_ESTILO, ehEstilo, "normal");

/** Aplica o estilo ao documento. O normal é o padrão do CSS, então não leva atributo. */
export function aplicarEstilo(e: Estilo) {
  aplicarAtributo("estilo", e, "normal");
}

let estiloAtual = $state<Estilo>(estiloInicial());

export const estilo = {
  get atual(): Estilo {
    return estiloAtual;
  },
  set atual(v: Estilo) {
    estiloAtual = v;
    gravar(CHAVE_ESTILO, v);
  },
};

let atual = $state<Tema>(inicial());

export const tema = {
  get atual(): Tema {
    return atual;
  },
  set atual(v: Tema) {
    atual = v;
    gravar(CHAVE, v);
  },
};
