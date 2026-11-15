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

## Plurais

Frases com número usam **chaves de plural**: uma chave por forma, com o mesmo prefixo, por exemplo
`plural.hinos.um` ("{n} hino") e `plural.hinos.outros` ("{n} hinos"). O app escolhe a forma pela regra
de plural do idioma (`Intl.PluralRules`) e, no código, usa `i18n.tn("plural.hinos", n)`.

Sufixos aceitos: `.zero`, `.um`, `.dois`, `.poucos`, `.muitos` e `.outros`. **`.outros` é obrigatório**
(é a forma de reserva); as demais só são necessárias se a língua as usar. O verificador de chaves exige
`.outros` em toda chave plural. Português e inglês só precisam de `.um` e `.outros`; o `.zero` existe para
"0 semitons", porque no português do CLDR o zero seria tratado como singular.

## Idioma do conteúdo

O idioma da **interface** (esta tradução) é separado do idioma dos **hinos**. Um hinário declara o seu em
`hinario.idioma` (ver `FORMATO.md`). Títulos e letras nunca são traduzidos automaticamente.

## O que não é traduzido (ainda)

- **O conteúdo dos hinos** (título e letra) vem do arquivo `hinario.json` e fica na língua em que foi
  escrito. Um hinário em outra língua é só outro arquivo.
- **Mensagens de erro da importação e do carregamento** são traduzidas pela interface: o Rust devolve um JSON com um código
  estável e os dados (`["versao","2","1"]`, `["repetido","5"]`, `["vazio"]`...; JSON porque os dados podem vir do arquivo
  importado e conter qualquer caractere) e `src/lib/erros.ts` o transforma no texto `erro.rust.<codigo>` do idioma escolhido. Ao criar um erro novo no Rust, acrescente o código em `ERROS_DO_RUST` e o texto nos três idiomas (um teste confere).
  O detalhe de sistema que algumas mensagens carregam (por exemplo, "permissão negada") continua como o sistema o devolve.
- Nomes de voz do arquivo como "Soprano", "Contralto", "Tenor" e "Baixo" são reconhecidos e traduzidos;
  outros nomes ("Parte I") aparecem como estão no arquivo.
