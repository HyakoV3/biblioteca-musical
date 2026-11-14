# Traduções (idiomas da interface)

A interface está em **português** (referência), **espanhol** e **inglês**. O idioma inicial segue o
idioma do aparelho (se for um dos disponíveis) e a escolha do usuário fica salva no aparelho.

## Adicionar um idioma

1. Copie `src/lib/i18n/pt.ts` para `src/lib/i18n/<codigo>.ts` (por exemplo `fr.ts`).
2. Troque o cabeçalho por `import type { Dicionario } from "./pt";` e declare
   `export const fr: Dicionario = { ... }`, traduzindo **só os valores**. Não mude as chaves.
3. Registre o idioma em `src/lib/i18n/index.svelte.ts`:
   `import { fr } from "./fr";` e, em `IDIOMAS`, `fr: { nome: "Français", dic: fr },`.

O TypeScript (`npm run check`) acusa chave faltando ou sobrando. Os trechos entre chaves, como
`{n}`, `{nome}` e `{voz}`, são preenchidos pelo app: mantenha-os no texto traduzido, na posição
que fizer sentido na sua língua.

## O que não é traduzido (ainda)

- **O conteúdo dos hinos** (título e letra) vem do arquivo `hinario.json` e fica na língua em que foi
  escrito. Um hinário em outra língua é só outro arquivo.
- **Mensagens de erro da importação** vêm do código em Rust, em português. Está nos planos trocá-las
  por códigos de erro que a interface traduz.
- Nomes de voz do arquivo como "Soprano", "Contralto", "Tenor" e "Baixo" são reconhecidos e traduzidos;
  outros nomes ("Parte I") aparecem como estão no arquivo.
