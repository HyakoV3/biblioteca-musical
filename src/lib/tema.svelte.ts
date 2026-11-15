// Preferência de aparência: Automático (padrão, segue o sistema), Claro ou Escuro.
// "sistema" não define data-tema e deixa o CSS seguir prefers-color-scheme.
// O app.html aplica a escolha salva antes da primeira pintura, para não piscar.

export const TEMAS = ["sistema", "claro", "escuro"] as const;
export type Tema = (typeof TEMAS)[number];

const CHAVE = "tema";

const ehTema = (x: unknown): x is Tema => typeof x === "string" && (TEMAS as readonly string[]).includes(x);

function inicial(): Tema {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (ehTema(salvo)) return salvo;
  } catch {
    /* sem armazenamento: segue o sistema */
  }
  return "sistema";
}

/** Aplica o tema ao documento (chamado pelo layout sempre que a escolha muda). */
export function aplicarTema(t: Tema) {
  if (t === "sistema") delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = t;
}

let atual = $state<Tema>(inicial());

export const tema = {
  get atual(): Tema {
    return atual;
  },
  set atual(v: Tema) {
    atual = v;
    try {
      localStorage.setItem(CHAVE, v);
    } catch {
      /* preferência não salva */
    }
  },
};
