// Créditos e licenças de terceiros mostrados em Ajustes ("Créditos e licenças"). A fonte de cada dado está em
// docs/licencas-de-terceiros.md. Nomes, autoria e textos de licença ficam no original; só a descrição do uso é traduzida
// (chave `licencas.uso.<id>`).
import { TEXTO_APACHE_2, TEXTO_BSD_3, TEXTO_GENERALUSER, TEXTO_MIT, TEXTO_OFL } from "./licencas-textos";

export type TipoTexto = "mit" | "bsd3" | "apache2" | "generaluser" | "ofl" | "reservado";

export type Credito = {
  id: string;
  nome: string;
  autoria: string;
  /** Rótulo curto da licença, como aparece na lista. */
  licenca: string;
  url?: string;
  /** As licenças que se aplicam, na ordem em que o texto é mostrado. */
  textos: { tipo: TipoTexto; direitos?: string }[];
};

export const CREDITOS: readonly Credito[] = [
  {
    // As transcrições do Enéias, de onde saem as notas, as letras e as partituras dos hinos. O repositório não traz licença: o crédito reconhece a autoria e não diz que há autorização.
    id: "eneias",
    nome: "Hinário 5: transcrições em MuseScore",
    autoria: "Enéias Ramos",
    licenca: "Todos os direitos reservados",
    url: "https://github.com/eneiasramos",
    textos: [
      {
        tipo: "reservado",
        direitos: "Transcrições dos hinos do Hinário 5 em MuseScore, de Enéias Ramos, em github.com/eneiasramos (um repositório por tonalidade).\nTodos os direitos reservados ao autor; os repositórios não trazem licença.",
      },
    ],
  },
  {
    id: "generaluser",
    nome: "GeneralUser GS",
    autoria: "S. Christian Collins",
    licenca: "GeneralUser GS License v2.0",
    url: "https://github.com/mrbumpy409/GeneralUser-GS",
    textos: [{ tipo: "generaluser" }],
  },
  {
    id: "smplr",
    nome: "smplr",
    autoria: "danigb",
    licenca: "MIT",
    url: "https://github.com/danigb/smplr",
    textos: [{ tipo: "mit", direitos: "Author: danigb (as declared in the npm package, which publishes no copyright line)" }],
  },
  {
    id: "icones",
    nome: "Google Material Icons e Material Symbols",
    autoria: "Material Design Authors (Google)",
    licenca: "Apache 2.0",
    url: "https://github.com/google/material-design-icons",
    textos: [{ tipo: "apache2" }],
  },
  {
    id: "fflate",
    nome: "fflate",
    autoria: "Arjun Barrett",
    licenca: "MIT",
    url: "https://github.com/101arrowz/fflate",
    textos: [{ tipo: "mit", direitos: "Copyright (c) 2026 Arjun Barrett" }],
  },
  {
    id: "svelte",
    nome: "Svelte e SvelteKit",
    autoria: "Svelte Contributors",
    licenca: "MIT",
    url: "https://github.com/sveltejs/svelte",
    textos: [{ tipo: "mit", direitos: "Copyright (c) 2016-2025 Svelte Contributors (Svelte)\nCopyright (c) 2020 SvelteKit contributors (SvelteKit)" }],
  },
  {
    id: "leipzig",
    nome: "Leipzig",
    autoria: "Etienne Darbellay, Jean-François Marti, Laurent Pugin",
    licenca: "SIL Open Font License 1.1",
    url: "https://github.com/rism-digital/leipzig",
    textos: [
      {
        tipo: "ofl",
        direitos: "Copyright (c) 2014, Etienne Darbellay, Jean-Francois Marti and Laurent Pugin (info@rism.digital),\nwith Reserved Font Name \"Leipzig\".",
      },
    ],
  },
  {
    id: "pitchy",
    nome: "Pitchy",
    autoria: "Ian Johnson",
    licenca: "MIT",
    url: "https://github.com/ianprime0509/pitchy",
    textos: [{ tipo: "mit", direitos: "Copyright 2018-2021 Ian Johnson" }],
  },
  {
    id: "ruido",
    nome: "web-noise-suppressor",
    autoria: "sapphi-red",
    licenca: "MIT",
    url: "https://github.com/sapphi-red/web-noise-suppressor",
    textos: [{ tipo: "mit", direitos: "Copyright (c) 2022 翠 / green" }],
  },
  {
    id: "rnnoise",
    nome: "RNNoise e rnnoise-wasm",
    autoria: "Jean-Marc Valin, Mozilla, Xiph.Org Foundation; Shiguredo Inc.",
    licenca: "BSD 3-Clause (RNNoise) e Apache 2.0 (rnnoise-wasm)",
    url: "https://github.com/xiph/rnnoise",
    textos: [
      {
        tipo: "bsd3",
        direitos: "Copyright (c) 2017, Mozilla\nCopyright (c) 2007-2017, Jean-Marc Valin\nCopyright (c) 2005-2017, Xiph.Org Foundation\nCopyright (c) 2003-2004, Mark Borgerding",
      },
      { tipo: "apache2" },
    ],
  },
  {
    id: "gtcrn",
    nome: "GTCRN e gtcrn-wasm",
    autoria: "Xiaobin Rong; sapphi-red",
    licenca: "MIT",
    url: "https://github.com/Xiaobin-Rong/gtcrn",
    textos: [{ tipo: "mit", direitos: "Copyright (c) 2024 Xiaobin Rong (GTCRN)\nCopyright (c) sapphi-red (gtcrn-wasm)" }],
  },
  {
    // Os crates do Rust que o app compila dentro do binário (Cargo.toml): leitura do pacote baixado (zip, que a interface manda em base64), do SVG das partituras (roxmltree) e do JSON do hinário (serde). O zip é MIT; os demais, MIT ou Apache 2.0.
    id: "rust",
    nome: "Crates do Rust: zip, roxmltree, base64, serde e serde_json",
    autoria: "Mathijs van de Nes (zip); Yevhenii Reizner (roxmltree); Alice Maz e Marshall Pierce (base64); Erick Tryzelaar e David Tolnay (serde)",
    licenca: "MIT (zip); MIT ou Apache 2.0 (os demais)",
    url: "https://crates.io",
    textos: [
      {
        tipo: "mit",
        direitos:
          "zip: Copyright (c) 2014 Mathijs van de Nes\nroxmltree: Copyright (c) 2018 Yevhenii Reizner\nbase64: Copyright (c) 2025 Alice Maz, Marshall Pierce\nserde: Authors: Erick Tryzelaar, David Tolnay (as declared in the crate, which publishes no copyright line)\nserde_json: the crate declares no author or copyright line",
      },
    ],
  },
  {
    id: "tauri",
    nome: "Tauri e o plugin http",
    autoria: "Tauri Apps Contributors",
    licenca: "MIT ou Apache 2.0",
    url: "https://github.com/tauri-apps/tauri",
    textos: [{ tipo: "mit", direitos: "Copyright (c) 2017 - Present Tauri Apps Contributors" }],
  },
] as const;

/** O crédito não tem licença (só "direitos reservados")? Aí o rótulo e o botão não podem prometer um texto de licença: a tela usa `creditos.reservado` e `creditos.ver_direitos`. */
export function semLicenca(c: Credito): boolean {
  return c.textos.length > 0 && c.textos.every((x) => x.tipo === "reservado");
}

/** Como cada tipo vira texto: recebe a linha de direitos (vazia quando não há). Um tipo novo entra aqui, sem mexer em `textoDaLicenca`. */
const MONTAR_TEXTO: Record<TipoTexto, (direitos: string) => string> = {
  mit: (direitos) => `MIT License\n\n${direitos}\n\n${TEXTO_MIT}`,
  bsd3: (direitos) => `${direitos}\n\n${TEXTO_BSD_3}`,
  apache2: () => TEXTO_APACHE_2,
  generaluser: () => TEXTO_GENERALUSER,
  ofl: (direitos) => `${direitos}\n\n${TEXTO_OFL}`,
  reservado: (direitos) => direitos,
};

/** O texto de uma licença para um crédito (com a linha de direitos autorais, quando há). */
export function textoDaLicenca(t: Credito["textos"][number]): string {
  return MONTAR_TEXTO[t.tipo](t.direitos ?? "");
}
