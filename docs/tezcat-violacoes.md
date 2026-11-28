# Catálogo de violações do Tezcat (perfil strict)

**Gerado em 2026-11-27** com `tzt . --profile strict --no-baseline` na `main` (`539dcbd` mais a #236). É a dívida inteira, **sem o baseline**: ela bate com as **671** entradas de `tezcat-baseline.json` (as 672 violações aqui colapsam em 671 chaves, porque a chave `arquivo::unidade::princípio::método` junta duas). Ficam de fora os scripts de `content/hinario-480/pipeline/`, que o Git ignora e o Tezcat varre mesmo assim.

**Meta (2026-11-27):** resolver **todas as violações FAIL** e as **WARN que valem a pena**, em Kotlin, Svelte/TypeScript e Rust, nos princípios **SRP, OCP e Clean Code**, até a nota média de cada linguagem passar de 90. Python (as ferramentas em `tools/`) fica fora da meta, mas está catalogado.

**Quem faz a refatoração:** o **Claude (Anthropic)** escreve as mudanças, em pull requests pequenas (uma por arquivo), com testes de caracterização e sem mudar o comportamento. O responsável do projeto revisa, mescla e responde pelo app; a revisão automática (vandame) comenta cada PR. O que só se prova num aparelho (áudio, microfone, Android) fica como risco a verificar.

**Como a nota funciona (conferido no código do `tzt` 0.4.0, `scoring.py`):**
- A nota vai de 0 a 100 **por unidade** (classe, módulo, `test` ou `receiver`; não por arquivo), com **piso em 0**, e a média da linguagem é a **média simples** das unidades, incluindo as limpas (nota 100) e as de teste. Não há nota por princípio, só a contagem de violações.
- **Dividir só para inflar o denominador não vale:** unidades novas com 100 sobem a média sem melhorar o código. A divisão só conta quando tira uma violação de verdade.
- **O piso em 0 faz o `main.rs` do Rust valer −182 (bruto) e o `pacote.rs` −2:** corrigir FAIL soltos neles não mexe na nota; só dividir em módulos resolve.
- **Penalidade invisível no Rust:** `unwrap` em teste não aparece como violação (`rules.py:261` o trata como idiomático), mas **a nota o desconta mesmo assim** (`hinario::testes` −60, `pacote::testes` −92, `main::testes` −82, `svg::testes` −14). Trocar por `-> Result<…>` com `?` recupera esses pontos.
- **Limiar:** as regras usam `>=` (WARN/FAIL ao atingir o limite), mas a nota só desconta acima dele. Um WARN **exatamente no limiar** (nesting 2, 3 parâmetros, 4 ramos, 8 métodos) vale 0 ponto, e um FAIL exatamente no limiar custa só o desconto de WARN. Contagem aproximada de WARN neutros: Kotlin 6 de 15, Rust 65 de 104, Svelte/TS cerca de 126 de 238.
- `Clean/Tamanho` de módulo TS conta o arquivo inteiro: `gravacoes.ts` paga 397 linhas no módulo **e** 273 na classe (em dobro). No Svelte o tamanho é só do `<script>`.
- **Falso positivo de DIP:** `DetectorDeSom` (4 linhas) herda o DIP do `gravador.ts` inteiro, e `Intl.NumberFormat` conta como dependência concreta.

## Resumo

| Linguagem | Unidades com violação (arquivos) | FAIL | WARN | Nota média (strict) |
|---|---:|---:|---:|---:|
| Kotlin | 4 | 5 | 15 | 83,6 |
| Rust | 13 (8) | 50 | 104 | 67,0 |
| Svelte/TypeScript | 77 (68) | 76 | 238 | 92,1 (**88,4** sem as 66 unidades de teste, quase todas com 100) |
| Python (ferramentas) | 31 | 52 | 132 | — |
| **Total** | | **183** | **489** | |

### Por princípio (FAIL / WARN)

| Linguagem | SRP | OCP | Clean Code | DIP | Outros |
|---|---:|---:|---:|---:|---:|
| Kotlin | 1 / 2 | 1 / 1 | 3 / 12 | 0 / 0 | 0 |
| Rust | 1 / 2 | 13 / 5 | 36 / 96 | 0 / 0 | 1 |
| Svelte/TypeScript | 10 / 11 | 11 / 28 | 52 / 193 | 3 / 6 | 0 |
| Python (ferramentas) | 1 / 2 | 27 / 24 | 24 / 106 | 0 / 0 | 0 |

## Como ler os WARN: quais valem a pena

**Critério revisado (pela avaliação do Opus):** um WARN **vale a pena** quando **custa ponto** (está acima do limiar) e, se for neutro (exatamente no limiar), só quando o arquivo já está aberto para um FAIL. **Nesting e Params** em código de áudio e de gravação valem pela testabilidade, mesmo sem custar nota. Ficam para depois: o `Clean/Tamanho` de arquivo sem FAIL e os WARN neutros isolados.

**Arquivos de dados (`pt.ts`, `en.ts`, `es.ts`, ~555 linhas cada):** são dados, não código. O caminho legítimo não é afrouxar o limiar do projeto inteiro (isso esconderia dívida), e sim um `tezcat.toml` com `[scan] skip_files` para esses três, com o motivo escrito. Não levam a marca [junto].

Cada arquivo abaixo leva a marca **[junto]** quando seus WARN entram na mesma PR dos FAIL, e **[avaliar]** quando o arquivo não tem FAIL (exceto os de dados i18n, que não entram na meta).


---

## Kotlin

| Nota | Arquivo | Tipo | FAIL | WARN |
|---:|---|---|---:|---:|
| 60 | `src-tauri/gen/android/app/src/main/java/br/pro/bibliotecamusical/PonteServico.kt` (PonteServico) | class | 2 | 4 |
| 68 | `src-tauri/gen/android/app/src/main/java/br/pro/bibliotecamusical/PonteCompartilhar.kt` (PonteCompartilhar) | class | 1 | 4 |
| 68 | `src-tauri/gen/android/app/src/main/java/br/pro/bibliotecamusical/ServicoAudio.kt` (ServicoAudio) | class | 2 | 4 |
| 89 | `src-tauri/gen/android/buildSrc/src/main/java/br/pro/bibliotecamusical/kotlin/BuildTask.kt` (BuildTask) | class | 0 | 3 |

### Detalhe, arquivo por arquivo

#### `src-tauri/gen/android/app/src/main/java/br/pro/bibliotecamusical/PonteServico.kt` — PonteServico (class), nota 60, 2 FAIL, 4 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'ligar': 31 linhas (limite: 30). Extraia sub-métodos.
  - `SRP`: 13 métodos (limite: 12). Classe provavelmente faz coisas demais.
- **WARN**
  - `Clean/Nesting`: Método 'rotaDeSaida': nesting 2.
  - `Clean/Nesting`: Método 'temFone': nesting 2.
  - `Clean/Tamanho`: 227 linhas (aviso: 150).
  - `OCP`: Método 'ligar': 4 branches (aviso: 4).

#### `src-tauri/gen/android/app/src/main/java/br/pro/bibliotecamusical/PonteCompartilhar.kt` — PonteCompartilhar (class), nota 68, 1 FAIL, 4 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'enviarComTexto': 41 linhas (limite: 30). Extraia sub-métodos.
- **WARN**
  - `Clean/Método`: Método 'comecar': 21 linhas.
  - `Clean/Nesting`: Método 'enviarComTexto': nesting 2.
  - `Clean/Tamanho`: 158 linhas (aviso: 150).
  - `SRP`: 9 métodos (aviso: 8). Considere extrair responsabilidades.

#### `src-tauri/gen/android/app/src/main/java/br/pro/bibliotecamusical/ServicoAudio.kt` — ServicoAudio (class), nota 68, 2 FAIL, 4 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'onStartCommand': 51 linhas (limite: 30). Extraia sub-métodos.
  - `OCP`: Método 'onStartCommand': 9 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Método`: Método 'montarNotificacao': 26 linhas.
  - `Clean/Params`: Método 'onStartCommand': 3 parâmetros.
  - `Clean/Tamanho`: 221 linhas (aviso: 150).
  - `SRP`: 8 métodos (aviso: 8). Considere extrair responsabilidades.

#### `src-tauri/gen/android/buildSrc/src/main/java/br/pro/bibliotecamusical/kotlin/BuildTask.kt` — BuildTask (class), nota 89, 0 FAIL, 3 WARN [avaliar]

- **WARN**
  - `Clean/Método`: Método 'assemble': 28 linhas.
  - `Clean/Método`: Método 'runTauriCli': 21 linhas.
  - `Clean/Nesting`: Método 'assemble': nesting 3.


---

## Rust

| Nota | Arquivo | Tipo | FAIL | WARN |
|---:|---|---|---:|---:|
| 0 | `src-tauri/src/pacote.rs` (pacote) | module | 7 | 19 |
| 0 | `src-tauri/src/pacote.rs` (pacote::testes) | test | 1 | 3 |
| 0 | `tools/mscx2json/src/main.rs` (main) | module | 27 | 42 |
| 0 | `tools/mscx2json/src/main.rs` (main::testes) | test | 2 | 9 |
| 15 | `src-tauri/src/hinario.rs` (hinario::testes) | test | 1 | 0 |
| 42 | `tools/mscx2json/src/correcoes.rs` (correcoes) | module | 5 | 8 |
| 43 | `src-tauri/src/svg.rs` (svg) | module | 3 | 11 |
| 47 | `src-tauri/src/hinario.rs` (hinario) | module | 4 | 4 |
| 73 | `src-tauri/src/svg.rs` (svg::testes) | test | 0 | 2 |
| 90 | `tools/mscx2json/src/correcoes.rs` (correcoes::testes) | test | 0 | 2 |
| 98 | `src-tauri/build.rs` (build) | module | 0 | 1 |
| 100 | `src-tauri/src/exemplo.rs` (exemplo) | module | 0 | 1 |
| 100 | `src-tauri/src/lib.rs` (lib) | module | 0 | 2 |

### Detalhe, arquivo por arquivo

#### `src-tauri/src/pacote.rs` — pacote (module), nota 0, 7 FAIL, 19 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'importar_zip_com_progresso': 105 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'ler_variante': 30 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'preparar': 76 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Params`: Método 'preparar': 7 parâmetros (limite: 5). Use um objeto de comando/DTO.
  - `Clean/Tamanho`: 522 linhas (limite: 250). Arquivo muito extenso.
  - `OCP`: Método 'importar_zip_com_progresso': 11 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'preparar': 10 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Método`: Método 'classificar': 22 linhas.
  - `Clean/Método`: Método 'ler_partitura': 28 linhas.
  - `Clean/Método`: Método 'numeros': 24 linhas.
  - `Clean/Nesting`: Método 'classificar': nesting 2.
  - `Clean/Nesting`: Método 'importar_zip_com_progresso': nesting 2.
  - `Clean/Nesting`: Método 'ler_partitura': nesting 2.
  - `Clean/Nesting`: Método 'numeros': nesting 2.
  - `Clean/Nesting`: Método 'preparar': nesting 3.
  - `Clean/Params`: Método 'importar_base64_com': 3 parâmetros.
  - `Clean/Params`: Método 'importar_base64_com_progresso': 4 parâmetros.
  - `Clean/Params`: Método 'importar_base64_progresso': 3 parâmetros.
  - `Clean/Params`: Método 'importar_zip_com': 3 parâmetros.
  - `Clean/Params`: Método 'importar_zip_com_progresso': 4 parâmetros.
  - `Clean/Params`: Método 'ler_entrada': 3 parâmetros.
  - `Clean/Params`: Método 'ler_partitura': 3 parâmetros.
  - `Clean/Params`: Método 'ler_variante': 3 parâmetros.
  - `OCP`: Método 'ler_partitura': 4 branches (aviso: 4).
  - `OCP`: Método 'ler_variante': 4 branches (aviso: 4).
  - `SRP`: Módulo com 21 funções (aviso: 15).

#### `src-tauri/src/pacote.rs` — pacote::testes (test), nota 0, 1 FAIL, 3 WARN [junto]

- **FAIL**
  - `Clean/Tamanho`: 1381 linhas (limite: 500). Arquivo muito extenso.
- **WARN**
  - `Clean/Método`: Método 'classifica_so_os_nomes_exatos': 76 linhas.
  - `Clean/Nesting`: Método 'arquivos': nesting 3.
  - `Clean/Nesting`: Método 'conteudo_real': nesting 3.

#### `tools/mscx2json/src/main.rs` — main (module), nota 0, 27 FAIL, 42 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'converter_com': 390 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'corrigir_silabas': 50 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'dividir_em_vozes': 106 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'executar_conversao': 129 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'ler_armadura': 30 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'montar_letra': 126 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'para_json': 47 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'percorrer': 108 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'registrar_marcas': 30 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'separar_o_coro': 59 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'separar_o_final': 33 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'validar': 58 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Nesting`: Método 'converter_com': nesting 4 (limite: 4). Aplique guard-clauses / extraia métodos.
  - `Clean/Nesting`: Método 'percorrer': nesting 4 (limite: 4). Aplique guard-clauses / extraia métodos.
  - `Clean/Nesting`: Método 'validar': nesting 4 (limite: 4). Aplique guard-clauses / extraia métodos.
  - `Clean/Params`: Método 'nome_da_voz': 5 parâmetros (limite: 5). Use um objeto de comando/DTO.
  - `Clean/Params`: Método 'registrar': 6 parâmetros (limite: 5). Use um objeto de comando/DTO.
  - `Clean/Tamanho`: 2117 linhas (limite: 250). Arquivo muito extenso.
  - `OCP`: Método 'converter_com': 30 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'corrigir_silabas': 6 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'dividir_em_vozes': 9 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'executar_conversao': 9 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'montar_letra': 14 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'para_json': 10 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'percorrer': 12 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'validar': 7 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `SRP`: Módulo com 61 funções (limite: 22). Considere dividir em módulos menores.
- **WARN**
  - `Clean/Método`: Método 'estrofes_da_passada': 29 linhas.
  - `Clean/Método`: Método 'modo_pelo_baixo': 21 linhas.
  - `Clean/Método`: Método 'plano_passadas': 20 linhas.
  - `Clean/Método`: Método 'recortar_inicio': 23 linhas.
  - `Clean/Método`: Método 'refrao_com_estrofe_trocada': 29 linhas.
  - `Clean/Método`: Método 'selecionar': 21 linhas.
  - `Clean/Método`: Método 'texto_de_estilo': 20 linhas.
  - `Clean/Nesting`: Método 'compassos_da_passada': nesting 2.
  - `Clean/Nesting`: Método 'corrigir_silabas': nesting 3.
  - `Clean/Nesting`: Método 'cortar_ligaduras_do_segmento': nesting 3.
  - `Clean/Nesting`: Método 'dividir_em_vozes': nesting 3.
  - `Clean/Nesting`: Método 'estrofes_da_passada': nesting 3.
  - `Clean/Nesting`: Método 'executar_conversao': nesting 3.
  - `Clean/Nesting`: Método 'fecha_asterisco': nesting 2.
  - `Clean/Nesting`: Método 'fecha_asteriscos_na_respiracao': nesting 2.
  - `Clean/Nesting`: Método 'instante_na_passada': nesting 2.
  - `Clean/Nesting`: Método 'liga_fim': nesting 2.
  - `Clean/Nesting`: Método 'liga_inicio': nesting 2.
  - `Clean/Nesting`: Método 'modo_pelo_baixo': nesting 2.
  - `Clean/Nesting`: Método 'montar_letra': nesting 3.
  - `Clean/Nesting`: Método 'nomes_satb': nesting 2.
  - `Clean/Nesting`: Método 'palavra_a_partir': nesting 2.
  - `Clean/Nesting`: Método 'para_json': nesting 2.
  - `Clean/Nesting`: Método 'registrar': nesting 2.
  - `Clean/Nesting`: Método 'registrar_marcas': nesting 3.
  - `Clean/Nesting`: Método 'relatorio_de_avisos': nesting 2.
  - `Clean/Nesting`: Método 'selecionar': nesting 2.
  - `Clean/Nesting`: Método 'separar_o_coro': nesting 2.
  - `Clean/Nesting`: Método 'separar_o_final': nesting 2.
  - `Clean/Nesting`: Método 'texto_completo': nesting 3.
  - `Clean/Nesting`: Método 'texto_de_estilo': nesting 3.
  - `Clean/Params`: Método 'cabecalho': 3 parâmetros.
  - `Clean/Params`: Método 'converter_com': 3 parâmetros.
  - `Clean/Params`: Método 'estrofes_da_passada': 3 parâmetros.
  - `Clean/Params`: Método 'fecha_asterisco': 3 parâmetros.
  - `Clean/Params`: Método 'fecha_asteriscos_na_respiracao': 3 parâmetros.
  - `Clean/Params`: Método 'instante_na_passada': 3 parâmetros.
  - `Clean/Params`: Método 'modo_pelo_baixo': 3 parâmetros.
  - `Clean/Params`: Método 'percorrer': 3 parâmetros.
  - `Clean/Params`: Método 'registrar_marcas': 3 parâmetros.
  - `Clean/Params`: Método 'selecionar': 3 parâmetros.
  - `OCP`: Método 'separar_o_coro': 5 branches (aviso: 4).

#### `tools/mscx2json/src/main.rs` — main::testes (test), nota 0, 2 FAIL, 9 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'final_descartado_refaz_a_letra_e_nao_deixa_aviso_do_plano': 88 linhas (limite: 80). Extraia sub-métodos.
  - `Clean/Tamanho`: 2548 linhas (limite: 500). Arquivo muito extenso.
- **WARN**
  - `Clean/Método`: Método 'final_descartado_nao_deixa_compassos_do_final': 68 linhas.
  - `Clean/Nesting`: Método 'letra_por_estrofe_com_silabas_e_quebra_na_respiracao': nesting 3.
  - `Clean/Nesting`: Método 'sincronia_marca_a_posicao_na_linha_e_o_instante_de_cada_silaba': nesting 3.
  - `Clean/Params`: Método 'comp_com_silaba': 3 parâmetros.
  - `Clean/Params`: Método 'comp_ligado': 3 parâmetros.
  - `Clean/Params`: Método 'hino_com_nota': 3 parâmetros.
  - `Clean/Params`: Método 'nota_acorde': 3 parâmetros.
  - `Clean/Params`: Método 'silaba_de': 3 parâmetros.
  - `Clean/Params`: Método 'silaba_em': 3 parâmetros.

#### `src-tauri/src/hinario.rs` — hinario::testes (test), nota 15, 1 FAIL, 0 WARN [junto]

- **FAIL**
  - `Clean/Tamanho`: 605 linhas (limite: 500). Arquivo muito extenso.

#### `tools/mscx2json/src/correcoes.rs` — correcoes (module), nota 42, 5 FAIL, 8 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'aplicar': 67 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'ler': 77 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Nesting`: Método 'ler': nesting 4 (limite: 4). Aplique guard-clauses / extraia métodos.
  - `Clean/Tamanho`: 263 linhas (limite: 250). Arquivo muito extenso.
  - `OCP`: Método 'ler': 6 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Método`: Método 'sequencia': 23 linhas.
  - `Clean/Nesting`: Método 'aplicar': nesting 3.
  - `Clean/Nesting`: Método 'sequencia': nesting 2.
  - `Clean/Params`: Método 'aplicar': 3 parâmetros.
  - `Clean/Params`: Método 'duas_ou_mais': 3 parâmetros.
  - `Clean/Params`: Método 'inteiro_positivo': 3 parâmetros.
  - `Clean/Params`: Método 'palavras': 3 parâmetros.
  - `OCP`: Método 'aplicar': 4 branches (aviso: 4).

#### `src-tauri/src/svg.rs` — svg (module), nota 43, 3 FAIL, 11 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'escrever': 77 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Tamanho`: 317 linhas (limite: 250). Arquivo muito extenso.
  - `OCP`: Método 'escrever': 13 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Método`: Método 'limpar_com': 24 linhas.
  - `Clean/Método`: Método 'sem_use_encadeado': 20 linhas.
  - `Clean/Método`: Método 'valor_final': 23 linhas.
  - `Clean/Nesting`: Método 'escapar': nesting 2.
  - `Clean/Nesting`: Método 'escrever': nesting 3.
  - `Clean/Nesting`: Método 'limpar_com': nesting 2.
  - `Clean/Nesting`: Método 'sem_use_encadeado': nesting 2.
  - `Clean/Nesting`: Método 'valor_final': nesting 2.
  - `Clean/Params`: Método 'escapar': 3 parâmetros.
  - `Clean/Params`: Método 'escrever': 3 parâmetros.
  - `OCP`: Método 'valor_final': 5 branches (aviso: 4).

#### `src-tauri/src/hinario.rs` — hinario (module), nota 47, 4 FAIL, 4 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'ler': 74 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Nesting`: Método 'ler': nesting 4 (limite: 4). Aplique guard-clauses / extraia métodos.
  - `Clean/Tamanho`: 415 linhas (limite: 250). Arquivo muito extenso.
  - `OCP`: Método 'ler': 9 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Método`: Método 'carregar': 29 linhas.
  - `Clean/Nesting`: Método 'carregar': nesting 3.
  - `Clean/Nesting`: Método 'remover': nesting 2.
  - `SRP`: Módulo com 15 funções (aviso: 15).

#### `src-tauri/src/svg.rs` — svg::testes (test), nota 73, 0 FAIL, 2 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'svgs_gerados_passam_na_limpeza': nesting 4.
  - `Clean/Tamanho`: 497 linhas (aviso: 300).

#### `tools/mscx2json/src/correcoes.rs` — correcoes::testes (test), nota 90, 0 FAIL, 2 WARN [avaliar]

- **WARN**
  - `Clean/Params`: Método 's': 3 parâmetros.
  - `Clean/Tamanho`: 341 linhas (aviso: 300).

#### `src-tauri/build.rs` — build (module), nota 98, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Rust/Unwrap`: Método 'main': 2 unwrap()/expect() (aviso: 2).

#### `src-tauri/src/exemplo.rs` — exemplo (module), nota 100, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Params`: Método 'ler_partitura_do_app': 3 parâmetros.

#### `src-tauri/src/lib.rs` — lib (module), nota 100, 0 FAIL, 2 WARN [avaliar]

- **WARN**
  - `Clean/Params`: Método 'importar_partituras': 3 parâmetros.
  - `Clean/Params`: Método 'ler_partitura': 3 parâmetros.


---

## Svelte/TypeScript

| Nota | Arquivo | Tipo | FAIL | WARN |
|---:|---|---|---:|---:|
| 0 | `src/lib/gravacoes.ts` (Gravacoes) | class | 9 | 16 |
| 7 | `src/lib/Partitura.svelte` (Partitura) | module | 6 | 7 |
| 25 | `src/lib/gravador.ts` (Gravador) | class | 5 | 7 |
| 25 | `src/lib/reproducao.svelte.ts` (reproducao.svelte) | module | 4 | 6 |
| 26 | `src/lib/Gravador.svelte` (Gravador) | module | 5 | 9 |
| 42 | `src/lib/gravacaoEmCurso.svelte.ts` (GravacaoEmCurso) | class | 3 | 9 |
| 46 | `src/lib/contexto.ts` (contexto) | module | 6 | 7 |
| 55 | `src/lib/busca-hinos.ts` (busca-hinos) | module | 2 | 5 |
| 55 | `src/lib/preferencias.ts` (preferencias) | module | 2 | 6 |
| 57 | `src/lib/sintetizador.ts` (sintetizador) | module | 3 | 0 |
| 63 | `src/lib/metronomo.ts` (Metronomo) | class | 1 | 7 |
| 65 | `src/lib/gravacoes.ts` (gravacoes) | module | 1 | 6 |
| 68 | `src/lib/gravacaoEmCurso.svelte.ts` (gravacaoEmCurso.svelte) | module | 1 | 3 |
| 69 | `src/lib/QualNota.svelte` (QualNota) | module | 2 | 3 |
| 71 | `src/routes/hino/[numero]/+page.svelte` (hino/[numero]/+page) | module | 0 | 9 |
| 72 | `src/lib/metronomo.ts` (metronomo) | module | 1 | 2 |
| 72 | `src/lib/timbres.ts` (timbres) | module | 1 | 5 |
| 73 | `src/lib/compartilhar.ts` (compartilhar) | module | 3 | 2 |
| 75 | `src/lib/gravador.ts` (gravador) | module | 1 | 2 |
| 75 | `src/lib/i18n/en.ts` (en) | module | 1 | 0 |
| 75 | `src/lib/i18n/es.ts` (es) | module | 1 | 0 |
| 75 | `src/lib/i18n/pt.ts` (pt) | module | 1 | 0 |
| 75 | `src/lib/sons/baixar.ts` (baixar) | module | 2 | 4 |
| 75 | `tests/gravacoes.test.ts` (gravacoes.test) | test | 1 | 1 |
| 78 | `src/lib/ItemGravacao.svelte` (ItemGravacao) | module | 0 | 9 |
| 78 | `src/lib/escuta.ts` (Escuta) | class | 2 | 2 |
| 79 | `src/lib/webm.ts` (webm) | module | 2 | 1 |
| 79 | `src/routes/ajustes/+page.svelte` (ajustes/+page) | module | 0 | 4 |
| 80 | `src/lib/ogg.ts` (ogg) | module | 2 | 3 |
| 82 | `src/lib/Afinador.svelte` (Afinador) | module | 0 | 3 |
| 82 | `src/lib/Player.svelte` (Player) | module | 0 | 4 |
| 82 | `src/lib/licencas.ts` (licencas) | module | 1 | 1 |
| 82 | `src/lib/servico.ts` (servico) | module | 0 | 3 |
| 82 | `src/lib/sintetizador.ts` (Sintetizador) | class | 0 | 5 |
| 85 | `src/lib/gravador.ts` (DetectorDeSom) | class | 1 | 0 |
| 87 | `src/lib/suavizador.ts` (SuavizadorDeCents) | class | 2 | 1 |
| 90 | `src/lib/detector.ts` (Estabilizador) | class | 1 | 2 |
| 90 | `src/lib/hinario/hinario.svelte.ts` (hinario.svelte) | module | 0 | 3 |
| 90 | `src/lib/partituras/partituras.svelte.ts` (partituras.svelte) | module | 0 | 4 |
| 90 | `tests/busca-hinos.test.ts` (busca-hinos.test) | test | 0 | 1 |
| 90 | `tests/gravacaoEmCurso.test.ts` (gravacaoEmCurso.test) | test | 0 | 1 |
| 90 | `tests/gravador.test.ts` (gravador.test) | test | 0 | 3 |
| 90 | `tests/metronomo.test.ts` (metronomo.test) | test | 0 | 2 |
| 92 | `src/lib/instrumentos.ts` (instrumentos) | module | 1 | 0 |
| 92 | `src/lib/metronomo.svelte.ts` (EstadoMetronomo) | class | 1 | 1 |
| 93 | `src/lib/sons/armazenamento.ts` (armazenamento) | module | 0 | 4 |
| 93 | `src/lib/sons/extrair.ts` (extrair) | module | 0 | 3 |
| 93 | `src/lib/sons/pacotes.svelte.ts` (pacotes.svelte) | module | 0 | 3 |
| 94 | `src/lib/gravacoes.ts` (LimiteEstourado) | class | 0 | 1 |
| 94 | `src/lib/karaoke.ts` (karaoke) | module | 0 | 2 |
| 94 | `src/lib/notas.ts` (notas) | module | 0 | 6 |
| 94 | `src/lib/organizar.ts` (organizar) | module | 1 | 4 |
| 94 | `src/lib/partituras/baixar.ts` (baixar) | module | 0 | 3 |
| 94 | `src/lib/sons/extrair.ts` (ErroPacote) | class | 0 | 1 |
| 94 | `src/lib/sons/extrair.ts` (SemWorker) | class | 0 | 1 |
| 96 | `src/lib/saidaAudio.ts` (saidaAudio) | module | 0 | 3 |
| 96 | `src/lib/tom.ts` (TomSustentado) | class | 0 | 3 |
| 97 | `src/lib/Abas.svelte` (Abas) | module | 0 | 1 |
| 97 | `src/lib/afinador.ts` (afinador) | module | 0 | 3 |
| 97 | `src/lib/cabem.ts` (cabem) | module | 0 | 1 |
| 97 | `src/lib/i18n/index.svelte.ts` (index.svelte) | module | 0 | 3 |
| 97 | `src/lib/letra.ts` (letra) | module | 0 | 2 |
| 97 | `src/lib/metronomoPrefs.ts` (metronomoPrefs) | module | 0 | 2 |
| 97 | `tests/amostras.ts` (amostras) | module | 0 | 2 |
| 97 | `tests/detector.test.ts` (detector.test) | test | 0 | 1 |
| 100 | `src/lib/afinadorPrefs.ts` (afinadorPrefs) | module | 0 | 2 |
| 100 | `src/lib/biblioteca.svelte.ts` (biblioteca.svelte) | module | 0 | 1 |
| 100 | `src/lib/contagem.ts` (Contagem) | class | 0 | 1 |
| 100 | `src/lib/hinario/texto.ts` (texto) | module | 0 | 1 |
| 100 | `src/lib/metaGravacao.ts` (metaGravacao) | module | 0 | 1 |
| 100 | `src/lib/notacao.ts` (notacao) | module | 0 | 2 |
| 100 | `src/lib/ruido.ts` (ruido) | module | 0 | 1 |
| 100 | `src/lib/vezes.ts` (vezes) | module | 0 | 7 |
| 100 | `tests/estilos.test.ts` (estilos.test) | test | 0 | 1 |
| 100 | `tests/sintetizador.test.ts` (FakeCtx) | test | 0 | 1 |
| 100 | `tests/sons-baixar.test.ts` (sons-baixar.test) | test | 0 | 1 |
| 100 | `tests/timbres.test.ts` (timbres.test) | test | 0 | 1 |

### Detalhe, arquivo por arquivo

#### `src/lib/gravacoes.ts` — Gravacoes (class), nota 0, 9 FAIL, 16 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'abrirUma': 36 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'recuperarUma': 31 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Nesting`: Método 'abrirUma': nesting 4 (limite: 4). Aplique guard-clauses / extraia métodos.
  - `Clean/Nesting`: Método 'banco': nesting 4 (limite: 4). Aplique guard-clauses / extraia métodos.
  - `Clean/Nesting`: Método 'listar': nesting 4 (limite: 4). Aplique guard-clauses / extraia métodos.
  - `Clean/Nesting`: Método 'resumo': nesting 4 (limite: 4). Aplique guard-clauses / extraia métodos.
  - `Clean/Params`: Método 'salvar': 5 parâmetros (limite: 5). Use um objeto de comando/DTO.
  - `Clean/Tamanho`: 273 linhas (limite: 250). Arquivo muito extenso.
  - `SRP`: 21 métodos (limite: 12). Classe provavelmente faz coisas demais.
- **WARN**
  - `Clean/Método`: Método 'atualizar': 23 linhas.
  - `Clean/Método`: Método 'banco': 27 linhas.
  - `Clean/Método`: Método 'salvar': 28 linhas.
  - `Clean/Nesting`: Método 'aberto': nesting 3.
  - `Clean/Nesting`: Método 'abrirSessao': nesting 2.
  - `Clean/Nesting`: Método 'atualizar': nesting 2.
  - `Clean/Nesting`: Método 'blob': nesting 2.
  - `Clean/Nesting`: Método 'guardarPedaco': nesting 2.
  - `Clean/Nesting`: Método 'recuperarSessoes': nesting 2.
  - `Clean/Nesting`: Método 'recuperarUma': nesting 3.
  - `Clean/Nesting`: Método 'salvar': nesting 2.
  - `Clean/Params`: Método 'guardarPedaco': 3 parâmetros.
  - `DIP`: Instancia 3 tipos concretos: LimiteEstourado, Intl.DateTimeFormat, Gravacoes.
  - `OCP`: Método 'abrirUma': 4 branches (aviso: 4).
  - `OCP`: Método 'atualizar': 5 branches (aviso: 4).
  - `OCP`: Método 'banco': 4 branches (aviso: 4).

#### `src/lib/Partitura.svelte` — Partitura (module), nota 7, 6 FAIL, 7 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método '$effect@L360': 38 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'destacar': 45 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'destacarCurvas': 82 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Nesting`: Método 'destacarCurvas': nesting 5 (limite: 4). Aplique guard-clauses / extraia métodos.
  - `Clean/Tamanho`: 398 linhas (limite: 250). Arquivo muito extenso.
  - `SRP`: Módulo com 24 funções (limite: 22). Considere dividir em módulos menores.
- **WARN**
  - `Clean/Método`: Método 'destacarNotas': 26 linhas.
  - `Clean/Nesting`: Método '$effect@L360': nesting 2.
  - `Clean/Nesting`: Método 'carregar': nesting 2.
  - `Clean/Nesting`: Método 'destacarNotas': nesting 2.
  - `OCP`: Método '$effect@L360': 5 branches (aviso: 4).
  - `OCP`: Método 'destacar': 5 branches (aviso: 4).
  - `OCP`: Método 'destacarCurvas': 4 branches (aviso: 4).

#### `src/lib/gravador.ts` — Gravador (class), nota 25, 5 FAIL, 7 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'ligarFiltro': 43 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'parar': 35 linhas (limite: 30). Extraia sub-métodos.
  - `DIP`: Instancia 6 tipos concretos diretamente: Float32Array, Intl.NumberFormat, DOMException, MediaRecorder, Contexto. Prefira injeção de dependência.
  - `OCP`: Método 'parar': 6 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `SRP`: 15 métodos (limite: 12). Classe provavelmente faz coisas demais.
- **WARN**
  - `Clean/Método`: Método 'soltar': 29 linhas.
  - `Clean/Nesting`: Método 'abrirMedidor': nesting 2.
  - `Clean/Nesting`: Método 'ligarFiltro': nesting 2.
  - `Clean/Nesting`: Método 'parar': nesting 2.
  - `Clean/Nesting`: Método 'soltar': nesting 2.
  - `Clean/Tamanho`: 183 linhas (aviso: 150).
  - `OCP`: Método 'ligarFiltro': 5 branches (aviso: 4).

#### `src/lib/reproducao.svelte.ts` — reproducao.svelte (module), nota 25, 4 FAIL, 6 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'reagendar': 44 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'tocar': 63 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Tamanho`: 413 linhas (limite: 250). Arquivo muito extenso.
  - `SRP`: Módulo com 28 funções (limite: 22). Considere dividir em módulos menores.
- **WARN**
  - `Clean/Método`: Método 'irPara': 22 linhas.
  - `Clean/Nesting`: Método 'reagendar': nesting 2.
  - `Clean/Nesting`: Método 'tocar': nesting 3.
  - `OCP`: Método 'continuar': 5 branches (aviso: 4).
  - `OCP`: Método 'irPara': 4 branches (aviso: 4).
  - `OCP`: Método 'tocar': 4 branches (aviso: 4).

#### `src/lib/Gravador.svelte` — Gravador (module), nota 26, 5 FAIL, 9 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'aoTerminar': 30 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'atualizarUma': 37 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Tamanho`: 410 linhas (limite: 250). Arquivo muito extenso.
  - `OCP`: Método 'atualizarUma': 7 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `SRP`: Módulo com 35 funções (limite: 22). Considere dividir em módulos menores.
- **WARN**
  - `Clean/Método`: Método 'apagarTodas': 27 linhas.
  - `Clean/Nesting`: Método '$effect@L374': nesting 2.
  - `Clean/Nesting`: Método 'aoTerminar': nesting 3.
  - `Clean/Nesting`: Método 'atualizarUma': nesting 2.
  - `Clean/Nesting`: Método 'carregarTudo': nesting 2.
  - `Clean/Nesting`: Método 'fixadas': nesting 2.
  - `Clean/Nesting`: Método 'linhas': nesting 2.
  - `OCP`: Método 'aoTerminar': 4 branches (aviso: 4).
  - `OCP`: Método 'recuperarFoco': 4 branches (aviso: 4).

#### `src/lib/gravacaoEmCurso.svelte.ts` — GravacaoEmCurso (class), nota 42, 3 FAIL, 9 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'iniciar': 53 linhas (limite: 30). Extraia sub-métodos.
  - `OCP`: Método 'iniciar': 8 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `SRP`: 16 métodos (limite: 12). Classe provavelmente faz coisas demais.
- **WARN**
  - `Clean/Método`: Método 'guardar': 20 linhas.
  - `Clean/Método`: Método 'parar': 22 linhas.
  - `Clean/Nesting`: Método 'alternar': nesting 2.
  - `Clean/Nesting`: Método 'guardar': nesting 2.
  - `Clean/Nesting`: Método 'iniciar': nesting 2.
  - `Clean/Nesting`: Método 'parar': nesting 2.
  - `Clean/Params`: Método 'guardar': 3 parâmetros.
  - `Clean/Tamanho`: 196 linhas (aviso: 150).
  - `DIP`: Instancia 3 tipos concretos: Gravador, GravacaoEmCurso, DetectorDeSom.

#### `src/lib/contexto.ts` — contexto (module), nota 46, 6 FAIL, 7 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'linhasDoContexto': 33 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'montarContexto': 37 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Nesting`: Método 'linhasDoContexto': nesting 4 (limite: 4). Aplique guard-clauses / extraia métodos.
  - `Clean/Nesting`: Método 'montarContexto': nesting 4 (limite: 4). Aplique guard-clauses / extraia métodos.
  - `Clean/Params`: Método 'linhasDoContexto': 5 parâmetros (limite: 5). Use um objeto de comando/DTO.
  - `OCP`: Método 'linhasDoContexto': 7 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Método`: Método 'contextoValido': 25 linhas.
  - `Clean/Nesting`: Método 'lista': nesting 2.
  - `Clean/Nesting`: Método 'marcarMudanca': nesting 2.
  - `Clean/Nesting`: Método 'resumoDoContexto': nesting 2.
  - `Clean/Params`: Método 'textoDoContexto': 4 parâmetros.
  - `Clean/Tamanho`: 217 linhas (aviso: 150).
  - `OCP`: Método 'contextoValido': 4 branches (aviso: 4).

#### `src/lib/busca-hinos.ts` — busca-hinos (module), nota 55, 2 FAIL, 5 WARN [junto]

- **FAIL**
  - `Clean/Tamanho`: 371 linhas (limite: 250). Arquivo muito extenso.
  - `SRP`: Módulo com 34 funções (limite: 22). Considere dividir em módulos menores.
- **WARN**
  - `Clean/Nesting`: Método 'buscarNumero': nesting 2.
  - `Clean/Nesting`: Método 'indexar': nesting 2.
  - `Clean/Params`: Método 'buscarNumero': 3 parâmetros.
  - `Clean/Params`: Método 'destacar': 3 parâmetros.
  - `Clean/Params`: Método 'pontuar': 3 parâmetros.

#### `src/lib/preferencias.ts` — preferencias (module), nota 55, 2 FAIL, 6 WARN [junto]

- **FAIL**
  - `Clean/Tamanho`: 272 linhas (limite: 250). Arquivo muito extenso.
  - `SRP`: Módulo com 28 funções (limite: 22). Considere dividir em módulos menores.
- **WARN**
  - `Clean/Nesting`: Método 'lerAjustes': nesting 2.
  - `Clean/Nesting`: Método 'lerCartoes': nesting 2.
  - `Clean/Nesting`: Método 'lerTudo': nesting 2.
  - `Clean/Nesting`: Método 'salvarAjustes': nesting 2.
  - `Clean/Nesting`: Método 'salvarZoomPartitura': nesting 2.
  - `OCP`: Método 'lerVoz': 4 branches (aviso: 4).

#### `src/lib/sintetizador.ts` — sintetizador (module), nota 57, 3 FAIL, 0 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'agendarNota': 52 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Params`: Método 'agendarNota': 8 parâmetros (limite: 5). Use um objeto de comando/DTO.
  - `Clean/Tamanho`: 320 linhas (limite: 250). Arquivo muito extenso.

#### `src/lib/metronomo.ts` — Metronomo (class), nota 63, 1 FAIL, 7 WARN [junto]

- **FAIL**
  - `SRP`: 18 métodos (limite: 12). Classe provavelmente faz coisas demais.
- **WARN**
  - `Clean/Método`: Método 'iniciar': 28 linhas.
  - `Clean/Método`: Método 'olharAdiante': 20 linhas.
  - `Clean/Nesting`: Método 'cancelarAgendados': nesting 2.
  - `Clean/Nesting`: Método 'fechar': nesting 2.
  - `Clean/Nesting`: Método 'iniciar': nesting 2.
  - `Clean/Tamanho`: 152 linhas (aviso: 150).
  - `OCP`: Método 'iniciar': 5 branches (aviso: 4).

#### `src/lib/gravacoes.ts` — gravacoes (module), nota 65, 1 FAIL, 6 WARN [junto]

- **FAIL**
  - `Clean/Tamanho`: 397 linhas (limite: 250). Arquivo muito extenso.
- **WARN**
  - `Clean/Método`: Método 'transacao': 24 linhas.
  - `Clean/Nesting`: Método 'formatarData': nesting 2.
  - `Clean/Nesting`: Método 'transacao': nesting 3.
  - `Clean/Params`: Método 'comLimite': 3 parâmetros.
  - `Clean/Params`: Método 'formatarData': 3 parâmetros.
  - `Clean/Params`: Método 'transacao': 4 parâmetros.

#### `src/lib/gravacaoEmCurso.svelte.ts` — gravacaoEmCurso.svelte (module), nota 68, 1 FAIL, 3 WARN [junto]

- **FAIL**
  - `Clean/Tamanho`: 362 linhas (limite: 250). Arquivo muito extenso.
- **WARN**
  - `Clean/Método`: Método 'lerContextoReal': 23 linhas.
  - `Clean/Nesting`: Método 'guardarComPrazo': nesting 2.
  - `Clean/Nesting`: Método 'lerContextoReal': nesting 3.

#### `src/lib/QualNota.svelte` — QualNota (module), nota 69, 2 FAIL, 3 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'iniciar': 37 linhas (limite: 30). Extraia sub-métodos.
  - `OCP`: Método 'iniciar': 6 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Nesting`: Método 'iniciar': nesting 2.
  - `Clean/Tamanho`: 172 linhas (aviso: 150).
  - `SRP`: Módulo com 17 funções (aviso: 15).

#### `src/routes/hino/[numero]/+page.svelte` — hino/[numero]/+page (module), nota 71, 0 FAIL, 9 WARN [avaliar]

- **WARN**
  - `Clean/Método`: Método '$effect@L117': 26 linhas.
  - `Clean/Método`: Método '$effect@L167': 25 linhas.
  - `Clean/Nesting`: Método '$effect@L117': nesting 2.
  - `Clean/Nesting`: Método '$effect@L167': nesting 2.
  - `Clean/Tamanho`: 229 linhas (aviso: 150).
  - `OCP`: Método '$effect@L117': 4 branches (aviso: 4).
  - `OCP`: Método '$effect@L167': 5 branches (aviso: 4).
  - `OCP`: Método 'atualizarKaraoke': 4 branches (aviso: 4).
  - `SRP`: Módulo com 18 funções (aviso: 15).

#### `src/lib/metronomo.ts` — metronomo (module), nota 72, 1 FAIL, 2 WARN [junto]

- **FAIL**
  - `Clean/Tamanho`: 370 linhas (limite: 250). Arquivo muito extenso.
- **WARN**
  - `Clean/Params`: Método 'posicaoDoPendulo': 3 parâmetros.
  - `Clean/Params`: Método 'progressoNoCompasso': 4 parâmetros.

#### `src/lib/timbres.ts` — timbres (module), nota 72, 1 FAIL, 5 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'harmonicosEm': 32 linhas (limite: 30). Extraia sub-métodos.
- **WARN**
  - `Clean/Nesting`: Método 'harmonicosEm': nesting 2.
  - `Clean/Nesting`: Método 'perfilDaNota': nesting 2.
  - `Clean/Tamanho`: 172 linhas (aviso: 150).
  - `OCP`: Método 'harmonicosEm': 4 branches (aviso: 4).
  - `SRP`: Módulo com 16 funções (aviso: 15).

#### `src/lib/compartilhar.ts` — compartilhar (module), nota 73, 3 FAIL, 2 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'enviarAgora': 40 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Nesting`: Método 'enviarAgora': nesting 5 (limite: 4). Aplique guard-clauses / extraia métodos.
  - `OCP`: Método 'enviarAgora': 6 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Params`: Método 'compartilharGravacao': 4 parâmetros.
  - `Clean/Params`: Método 'enviarAgora': 4 parâmetros.

#### `src/lib/gravador.ts` — gravador (module), nota 75, 1 FAIL, 2 WARN [junto]

- **FAIL**
  - `Clean/Tamanho`: 427 linhas (limite: 250). Arquivo muito extenso.
- **WARN**
  - `Clean/Nesting`: Método 'corrigirDuracao': nesting 2.
  - `SRP`: Módulo com 15 funções (aviso: 15).

#### `src/lib/i18n/en.ts` — en (module), nota 75, 1 FAIL, 0 WARN [dados: fora da meta]

- **FAIL**
  - `Clean/Tamanho`: 555 linhas (limite: 250). Arquivo muito extenso.

#### `src/lib/i18n/es.ts` — es (module), nota 75, 1 FAIL, 0 WARN [dados: fora da meta]

- **FAIL**
  - `Clean/Tamanho`: 555 linhas (limite: 250). Arquivo muito extenso.

#### `src/lib/i18n/pt.ts` — pt (module), nota 75, 1 FAIL, 0 WARN [dados: fora da meta]

- **FAIL**
  - `Clean/Tamanho`: 558 linhas (limite: 250). Arquivo muito extenso.

#### `src/lib/sons/baixar.ts` — baixar (module), nota 75, 2 FAIL, 4 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'baixarComControle': 51 linhas (limite: 30). Extraia sub-métodos.
  - `OCP`: Método 'baixarComControle': 8 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Método`: Método 'baixarZip': 23 linhas.
  - `Clean/Nesting`: Método 'baixarComControle': nesting 3.
  - `Clean/Params`: Método 'baixarComControle': 3 parâmetros.
  - `Clean/Params`: Método 'baixarZip': 3 parâmetros.

#### `tests/gravacoes.test.ts` — gravacoes.test (test), nota 75, 1 FAIL, 1 WARN [junto]

- **FAIL**
  - `Clean/Tamanho`: 522 linhas (limite: 500). Arquivo muito extenso.
- **WARN**
  - `Clean/Nesting`: Método 'fabricaMuda': nesting 3.

#### `src/lib/ItemGravacao.svelte` — ItemGravacao (module), nota 78, 0 FAIL, 9 WARN [avaliar]

- **WARN**
  - `Clean/Método`: Método 'ouvir': 20 linhas.
  - `Clean/Método`: Método 'player': 22 linhas.
  - `Clean/Nesting`: Método 'alternarFavorita': nesting 2.
  - `Clean/Nesting`: Método 'ouvir': nesting 2.
  - `Clean/Nesting`: Método 'player': nesting 2.
  - `Clean/Tamanho`: 229 linhas (aviso: 150).
  - `OCP`: Método 'enviar': 4 branches (aviso: 4).
  - `OCP`: Método 'ouvir': 4 branches (aviso: 4).
  - `SRP`: Módulo com 21 funções (aviso: 15).

#### `src/lib/escuta.ts` — Escuta (class), nota 78, 2 FAIL, 2 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'iniciar': 45 linhas (limite: 30). Extraia sub-métodos.
  - `DIP`: Instancia 4 tipos concretos diretamente: Contexto, DOMException, Medidor, Float32Array. Prefira injeção de dependência.
- **WARN**
  - `Clean/Nesting`: Método 'iniciar': nesting 3.
  - `OCP`: Método 'iniciar': 5 branches (aviso: 4).

#### `src/lib/webm.ts` — webm (module), nota 79, 2 FAIL, 1 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'lerOpusDoWebm': 65 linhas (limite: 30). Extraia sub-métodos.
  - `OCP`: Método 'lerOpusDoWebm': 18 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Nesting`: Método 'lerOpusDoWebm': nesting 3.

#### `src/routes/ajustes/+page.svelte` — ajustes/+page (module), nota 79, 0 FAIL, 4 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'remover': nesting 3.
  - `Clean/Tamanho`: 199 linhas (aviso: 150).
  - `Clean/Template`: Template com 292 linhas (aviso: 250) — avalie extrair sub-componentes.
  - `SRP`: Módulo com 17 funções (aviso: 15).

#### `src/lib/ogg.ts` — ogg (module), nota 80, 2 FAIL, 3 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'escreverOgg': 31 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Params`: Método 'pagina': 5 parâmetros (limite: 5). Use um objeto de comando/DTO.
- **WARN**
  - `Clean/Método`: Método 'pagina': 25 linhas.
  - `Clean/Params`: Método 'escreverOgg': 4 parâmetros.
  - `OCP`: Método 'escreverOgg': 4 branches (aviso: 4).

#### `src/lib/Afinador.svelte` — Afinador (module), nota 82, 0 FAIL, 3 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'soar': nesting 2.
  - `Clean/Tamanho`: 169 linhas (aviso: 150).
  - `SRP`: Módulo com 16 funções (aviso: 15).

#### `src/lib/Player.svelte` — Player (module), nota 82, 0 FAIL, 4 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método '$effect@L42': nesting 2.
  - `Clean/Params`: Método 'mudarModo': 3 parâmetros.
  - `Clean/Tamanho`: 166 linhas (aviso: 150).
  - `SRP`: Módulo com 21 funções (aviso: 15).

#### `src/lib/licencas.ts` — licencas (module), nota 82, 1 FAIL, 1 WARN [junto]

- **FAIL**
  - `OCP`: Método 'textoDaLicenca': 7 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Tamanho`: 172 linhas (aviso: 150).

#### `src/lib/servico.ts` — servico (module), nota 82, 0 FAIL, 3 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'sincronizarServico': nesting 2.
  - `Clean/Tamanho`: 161 linhas (aviso: 150).
  - `SRP`: Módulo com 18 funções (aviso: 15).

#### `src/lib/sintetizador.ts` — Sintetizador (class), nota 82, 0 FAIL, 5 WARN [avaliar]

- **WARN**
  - `Clean/Método`: Método 'parar': 29 linhas.
  - `Clean/Nesting`: Método 'parar': nesting 2.
  - `Clean/Nesting`: Método 'real': nesting 3.
  - `Clean/Params`: Método 'real': 4 parâmetros.
  - `SRP`: 10 métodos (aviso: 8). Considere extrair responsabilidades.

#### `src/lib/gravador.ts` — DetectorDeSom (class), nota 85, 1 FAIL, 0 WARN [junto]

- **FAIL**
  - `DIP`: Instancia 6 tipos concretos diretamente: Float32Array, Intl.NumberFormat, DOMException, MediaRecorder, Contexto. Prefira injeção de dependência.

#### `src/lib/suavizador.ts` — SuavizadorDeCents (class), nota 87, 2 FAIL, 1 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'entrar': 31 linhas (limite: 30). Extraia sub-métodos.
  - `OCP`: Método 'entrar': 6 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Nesting`: Método 'entrar': nesting 2.

#### `src/lib/detector.ts` — Estabilizador (class), nota 90, 1 FAIL, 2 WARN [junto]

- **FAIL**
  - `Clean/Nesting`: Método 'entrar': nesting 4 (limite: 4). Aplique guard-clauses / extraia métodos.
- **WARN**
  - `Clean/Método`: Método 'entrar': 26 linhas.
  - `OCP`: Método 'entrar': 5 branches (aviso: 4).

#### `src/lib/hinario/hinario.svelte.ts` — hinario.svelte (module), nota 90, 0 FAIL, 3 WARN [avaliar]

- **WARN**
  - `Clean/Método`: Método 'baixar': 29 linhas.
  - `Clean/Nesting`: Método 'baixar': nesting 3.
  - `Clean/Nesting`: Método 'remover': nesting 3.

#### `src/lib/partituras/partituras.svelte.ts` — partituras.svelte (module), nota 90, 0 FAIL, 4 WARN [avaliar]

- **WARN**
  - `Clean/Método`: Método 'baixar': 24 linhas.
  - `Clean/Nesting`: Método 'baixar': nesting 3.
  - `Clean/Nesting`: Método 'remover': nesting 3.
  - `OCP`: Método 'baixar': 4 branches (aviso: 4).

#### `tests/busca-hinos.test.ts` — busca-hinos.test (test), nota 90, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Tamanho`: 369 linhas (aviso: 300).

#### `tests/gravacaoEmCurso.test.ts` — gravacaoEmCurso.test (test), nota 90, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Tamanho`: 308 linhas (aviso: 300).

#### `tests/gravador.test.ts` — gravador.test (test), nota 90, 0 FAIL, 3 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'preparar': nesting 3.
  - `Clean/Nesting`: Método 'preparar': nesting 3.
  - `Clean/Tamanho`: 491 linhas (aviso: 300).

#### `tests/metronomo.test.ts` — metronomo.test (test), nota 90, 0 FAIL, 2 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'ganhoFalso': nesting 3.
  - `Clean/Tamanho`: 403 linhas (aviso: 300).

#### `src/lib/instrumentos.ts` — instrumentos (module), nota 92, 1 FAIL, 0 WARN [junto]

- **FAIL**
  - `OCP`: Método 'tipoDaVoz': 8 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.

#### `src/lib/metronomo.svelte.ts` — EstadoMetronomo (class), nota 92, 1 FAIL, 1 WARN [junto]

- **FAIL**
  - `SRP`: 12 métodos (limite: 12). Classe provavelmente faz coisas demais.
- **WARN**
  - `DIP`: Instancia 2 tipos concretos: EstadoMetronomo, Metronomo.

#### `src/lib/sons/armazenamento.ts` — armazenamento (module), nota 93, 0 FAIL, 4 WARN [avaliar]

- **WARN**
  - `Clean/Método`: Método 'listar': 21 linhas.
  - `Clean/Nesting`: Método 'guardar': nesting 2.
  - `Clean/Nesting`: Método 'listar': nesting 3.
  - `Clean/Params`: Método 'guardar': 3 parâmetros.

#### `src/lib/sons/extrair.ts` — extrair (module), nota 93, 0 FAIL, 3 WARN [avaliar]

- **WARN**
  - `Clean/Método`: Método 'descompactar': 23 linhas.
  - `Clean/Nesting`: Método 'descompactar': nesting 3.
  - `Clean/Params`: Método 'conferir': 3 parâmetros.

#### `src/lib/sons/pacotes.svelte.ts` — pacotes.svelte (module), nota 93, 0 FAIL, 3 WARN [avaliar]

- **WARN**
  - `Clean/Método`: Método 'baixar': 27 linhas.
  - `Clean/Nesting`: Método 'baixar': nesting 3.
  - `Clean/Nesting`: Método 'remover': nesting 2.

#### `src/lib/gravacoes.ts` — LimiteEstourado (class), nota 94, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `DIP`: Instancia 3 tipos concretos: LimiteEstourado, Intl.DateTimeFormat, Gravacoes.

#### `src/lib/karaoke.ts` — karaoke (module), nota 94, 0 FAIL, 2 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'confere': nesting 3.
  - `Clean/Nesting`: Método 'marcasDaVez': nesting 3.

#### `src/lib/notas.ts` — notas (module), nota 94, 0 FAIL, 6 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'acesasEm': nesting 3.
  - `Clean/Nesting`: Método 'indexarNotas': nesting 3.
  - `Clean/Params`: Método 'acesasDoPonto': 3 parâmetros.
  - `Clean/Params`: Método 'acesasEm': 3 parâmetros.
  - `Clean/Params`: Método 'notasDoPonto': 3 parâmetros.
  - `Clean/Params`: Método 'notasEm': 3 parâmetros.

#### `src/lib/organizar.ts` — organizar (module), nota 94, 1 FAIL, 4 WARN [junto]

- **FAIL**
  - `Clean/Params`: Método 'mesclar': 5 parâmetros (limite: 5). Use um objeto de comando/DTO.
- **WARN**
  - `Clean/Nesting`: Método 'agrupar': nesting 2.
  - `Clean/Nesting`: Método 'filtrar': nesting 2.
  - `Clean/Params`: Método 'filtrar': 3 parâmetros.
  - `Clean/Params`: Método 'nomeDaGravacao': 4 parâmetros.

#### `src/lib/partituras/baixar.ts` — baixar (module), nota 94, 0 FAIL, 3 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'extrairDaPastaReal': nesting 2.
  - `Clean/Params`: Método 'baixarEInstalar': 4 parâmetros.
  - `Clean/Params`: Método 'zipConferido': 4 parâmetros.

#### `src/lib/sons/extrair.ts` — ErroPacote (class), nota 94, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `DIP`: Instancia 3 tipos concretos: SemWorker, ErroPacote, Uint8Array.

#### `src/lib/sons/extrair.ts` — SemWorker (class), nota 94, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `DIP`: Instancia 3 tipos concretos: SemWorker, ErroPacote, Uint8Array.

#### `src/lib/saidaAudio.ts` — saidaAudio (module), nota 96, 0 FAIL, 3 WARN [avaliar]

- **WARN**
  - `Clean/Método`: Método 'criarContexto': 21 linhas.
  - `Clean/Nesting`: Método 'criarContexto': nesting 2.
  - `Clean/Nesting`: Método 'lerModos': nesting 2.

#### `src/lib/tom.ts` — TomSustentado (class), nota 96, 0 FAIL, 3 WARN [avaliar]

- **WARN**
  - `Clean/Método`: Método 'tocar': 27 linhas.
  - `Clean/Nesting`: Método 'sonda': nesting 2.
  - `SRP`: 8 métodos (aviso: 8). Considere extrair responsabilidades.

#### `src/lib/Abas.svelte` — Abas (module), nota 97, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `OCP`: Método 'teclas': 5 branches (aviso: 4).

#### `src/lib/afinador.ts` — afinador (module), nota 97, 0 FAIL, 3 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'leituraComHisterese': nesting 2.
  - `Clean/Params`: Método 'leituraComHisterese': 4 parâmetros.
  - `OCP`: Método 'leituraComHisterese': 4 branches (aviso: 4).

#### `src/lib/cabem.ts` — cabem (module), nota 97, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Params`: Método 'quantosCabem': 4 parâmetros.

#### `src/lib/i18n/index.svelte.ts` — index.svelte (module), nota 97, 0 FAIL, 3 WARN [avaliar]

- **WARN**
  - `Clean/Params`: Método 'preencher': 3 parâmetros.
  - `Clean/Params`: Método 't': 3 parâmetros.
  - `Clean/Params`: Método 'tn': 4 parâmetros.

#### `src/lib/letra.ts` — letra (module), nota 97, 0 FAIL, 2 WARN [avaliar]

- **WARN**
  - `Clean/Método`: Método 'estrofes': 20 linhas.
  - `Clean/Nesting`: Método 'estrofes': nesting 3.

#### `src/lib/metronomoPrefs.ts` — metronomoPrefs (module), nota 97, 0 FAIL, 2 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'normalizarPref': nesting 2.
  - `OCP`: Método 'normalizarPref': 5 branches (aviso: 4).

#### `tests/amostras.ts` — amostras (module), nota 97, 0 FAIL, 2 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'hinoComFinal': nesting 2.
  - `Clean/Params`: Método 'escada': 4 parâmetros.

#### `tests/detector.test.ts` — detector.test (test), nota 97, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Params`: Método 'som': 4 parâmetros.

#### `src/lib/afinadorPrefs.ts` — afinadorPrefs (module), nota 100, 0 FAIL, 2 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'lerAfinador': nesting 2.
  - `Clean/Nesting`: Método 'normalizarPref': nesting 2.

#### `src/lib/biblioteca.svelte.ts` — biblioteca.svelte (module), nota 100, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'importarPartituras': nesting 2.

#### `src/lib/contagem.ts` — Contagem (class), nota 100, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'iniciar': nesting 2.

#### `src/lib/hinario/texto.ts` — texto (module), nota 100, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'textoDoHinario': nesting 2.

#### `src/lib/metaGravacao.ts` — metaGravacao (module), nota 100, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'normalizarMeta': nesting 2.

#### `src/lib/notacao.ts` — notacao (module), nota 100, 0 FAIL, 2 WARN [avaliar]

- **WARN**
  - `Clean/Params`: Método 'nomeDaNotaPorExtenso': 3 parâmetros.
  - `Clean/Params`: Método 'nomeDaTonalidade': 3 parâmetros.

#### `src/lib/ruido.ts` — ruido (module), nota 100, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'criarFiltro': nesting 2.

#### `src/lib/vezes.ts` — vezes (module), nota 100, 0 FAIL, 7 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'montarTudo': nesting 2.
  - `Clean/Nesting`: Método 'partesDoTudo': nesting 2.
  - `Clean/Params`: Método 'ehFinal': 3 parâmetros.
  - `Clean/Params`: Método 'montarTudo': 3 parâmetros.
  - `Clean/Params`: Método 'parteNaBatida': 3 parâmetros.
  - `Clean/Params`: Método 'partesDoTudo': 3 parâmetros.
  - `Clean/Params`: Método 'vozesDaVez': 3 parâmetros.

#### `tests/estilos.test.ts` — estilos.test (test), nota 100, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'executar': nesting 3.

#### `tests/sintetizador.test.ts` — FakeCtx (test), nota 100, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'createBiquadFilter': nesting 3.

#### `tests/sons-baixar.test.ts` — sons-baixar.test (test), nota 100, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'corpo': nesting 3.

#### `tests/timbres.test.ts` — timbres.test (test), nota 100, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Params`: Método 'mix': 3 parâmetros.


---

## Python (ferramentas)

| Nota | Arquivo | Tipo | FAIL | WARN |
|---:|---|---|---:|---:|
| 0 | `tools/analisar-timbres.py` (analisar-timbres) | module | 13 | 20 |
| 0 | `tools/gerar-partituras.py` (gerar-partituras) | module | 13 | 18 |
| 51 | `tools/contraste.py` (contraste) | module | 5 | 2 |
| 67 | `tools/gerar-icone-do-app.py` (gerar-icone-do-app) | module | 3 | 10 |
| 67 | `tools/montar-manifesto-sons.py` (montar-manifesto-sons) | module | 3 | 4 |
| 67 | `tools/test_gerar_partituras.py` (test_gerar_partituras) | test | 2 | 1 |
| 73 | `tools/verificar-compassos.py` (verificar-compassos) | module | 2 | 6 |
| 76 | `tools/exemplo/lilypond.py` (lilypond) | module | 0 | 12 |
| 79 | `tools/montar-pacote.py` (montar-pacote) | module | 2 | 2 |
| 82 | `tools/preparar-sons.py` (preparar-sons) | module | 2 | 1 |
| 82 | `tools/verificar-movimento.py` (verificar-movimento) | module | 3 | 4 |
| 85 | `tools/verificar-traducoes.py` (verificar-traducoes) | module | 2 | 1 |
| 87 | `tools/gerar-exemplo.py` (gerar-exemplo) | module | 0 | 7 |
| 88 | `tools/exemplo/musicxml.py` (musicxml) | module | 0 | 11 |
| 88 | `tools/montar-manifesto-hinario.py` (montar-manifesto-hinario) | module | 1 | 1 |
| 93 | `tools/baixar-sons-gm.py` (baixar-sons-gm) | module | 0 | 3 |
| 94 | `tools/exemplo/letra.py` (Alinhador) | class | 0 | 3 |
| 94 | `tools/exemplo/mscx.py` (mscx) | module | 0 | 7 |
| 97 | `tools/exemplo/montagem.py` (montagem) | module | 0 | 1 |
| 97 | `tools/test_gerar_partituras.py` (MscxParaMusicxml) | test | 0 | 1 |
| 97 | `tools/test_gerar_partituras.py` (GerarHino) | test | 1 | 3 |
| 100 | `tools/exemplo/compassos.py` (_Divisor) | class | 0 | 1 |
| 100 | `tools/exemplo/compassos.py` (compassos) | module | 0 | 3 |
| 100 | `tools/exemplo/letra.py` (letra) | module | 0 | 1 |
| 100 | `tools/exemplo/lilypond.py` (_Leitor) | class | 0 | 1 |
| 100 | `tools/test_gerar_icone_do_app.py` (Principal) | test | 0 | 1 |
| 100 | `tools/test_gerar_partituras.py` (Gravar) | test | 0 | 1 |
| 100 | `tools/test_montar_manifesto_hinario.py` (test_montar_manifesto_hinario) | test | 0 | 1 |
| 100 | `tools/test_montar_manifesto_sons.py` (test_montar_manifesto_sons) | test | 0 | 2 |
| 100 | `tools/test_montar_pacote.py` (Zip) | test | 0 | 1 |
| 100 | `tools/test_montar_pacote.py` (Manifesto) | test | 0 | 2 |

### Detalhe, arquivo por arquivo

#### `tools/analisar-timbres.py` — analisar-timbres (module), nota 0, 13 FAIL, 20 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'analisar_nota': 44 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'comparar_niveis': 33 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'comparar_orgaos': 46 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'main': 59 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Tamanho`: 515 linhas (limite: 250). Arquivo muito extenso.
  - `OCP`: Método 'analisar_nota': 8 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'calibrar': 6 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'comparar_niveis': 9 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'comparar_orgaos': 14 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'interpolar': 8 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'main': 17 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'nivel_do_instrumento': 6 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `SRP`: Módulo com 23 funções (limite: 22). Considere dividir em módulos menores.
- **WARN**
  - `Clean/Método`: Método 'calibrar': 26 linhas.
  - `Clean/Método`: Método 'corte_de_abertura': 21 linhas.
  - `Clean/Método`: Método 'espectro_harmonico': 26 linhas.
  - `Clean/Método`: Método 'medir_distancia': 28 linhas.
  - `Clean/Método`: Método 'nivel_do_instrumento': 21 linhas.
  - `Clean/Nesting`: Método 'analisar_nota': nesting 2.
  - `Clean/Nesting`: Método 'calibrar': nesting 2.
  - `Clean/Nesting`: Método 'comparar_orgaos': nesting 2.
  - `Clean/Nesting`: Método 'corte_de_abertura': nesting 2.
  - `Clean/Nesting`: Método 'espectro_harmonico': nesting 2.
  - `Clean/Nesting`: Método 'main': nesting 3.
  - `Clean/Nesting`: Método 'medir_distancia': nesting 3.
  - `Clean/Nesting`: Método 'nivel_do_instrumento': nesting 2.
  - `Clean/Params`: Método 'amplitudes_em': 3 parâmetros.
  - `Clean/Params`: Método 'corte_de_abertura': 3 parâmetros.
  - `Clean/Params`: Método 'espectro_harmonico': 3 parâmetros.
  - `Clean/Params`: Método 'nivel_do_instrumento': 3 parâmetros.
  - `Clean/Params`: Método 'rms_janelas': 3 parâmetros.
  - `OCP`: Método 'espectro_harmonico': 5 branches (aviso: 4).
  - `OCP`: Método 'medir_distancia': 5 branches (aviso: 4).

#### `tools/gerar-partituras.py` — gerar-partituras (module), nota 0, 13 FAIL, 18 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'gerar_hino': 38 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'marcar_notas': 65 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'principal': 44 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Nesting`: Método 'tempos_no_compasso': nesting 4 (limite: 4). Aplique guard-clauses / extraia métodos.
  - `Clean/Params`: Método 'gerar_hino': 9 parâmetros (limite: 5). Use um objeto de comando/DTO.
  - `Clean/Params`: Método 'processar': 8 parâmetros (limite: 5). Use um objeto de comando/DTO.
  - `Clean/Tamanho`: 429 linhas (limite: 250). Arquivo muito extenso.
  - `OCP`: Método 'gerar_hino': 10 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'marcar_notas': 13 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'principal': 9 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'processar': 8 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'tempos_do_desenho': 8 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'tempos_no_compasso': 7 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Método`: Método 'tempos_do_desenho': 24 linhas.
  - `Clean/Método`: Método 'tempos_no_compasso': 23 linhas.
  - `Clean/Nesting`: Método 'achar_musescore': nesting 2.
  - `Clean/Nesting`: Método 'gerar_hino': nesting 3.
  - `Clean/Nesting`: Método 'gravar': nesting 2.
  - `Clean/Nesting`: Método 'inicios_absolutos': nesting 3.
  - `Clean/Nesting`: Método 'marcar_notas': nesting 3.
  - `Clean/Nesting`: Método 'principal': nesting 2.
  - `Clean/Nesting`: Método 'processar': nesting 2.
  - `Clean/Nesting`: Método 'tempos_do_desenho': nesting 3.
  - `Clean/Params`: Método 'achar_musescore': 3 parâmetros.
  - `Clean/Params`: Método 'marcar_notas': 3 parâmetros.
  - `Clean/Params`: Método 'mscx_para_musicxml': 4 parâmetros.
  - `Clean/Params`: Método 'tempos_do_desenho': 3 parâmetros.
  - `OCP`: Método 'achar_musescore': 5 branches (aviso: 4).
  - `OCP`: Método 'gravar': 4 branches (aviso: 4).
  - `OCP`: Método 'mscx_para_musicxml': 4 branches (aviso: 4).
  - `SRP`: Módulo com 21 funções (aviso: 15).

#### `tools/contraste.py` — contraste (module), nota 51, 5 FAIL, 2 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'ler_tokens': 36 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Método`: Método 'main': 86 linhas (limite: 30). Extraia sub-métodos.
  - `Clean/Nesting`: Método 'main': nesting 4 (limite: 4). Aplique guard-clauses / extraia métodos.
  - `OCP`: Método 'ler_tokens': 7 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'main': 32 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Nesting`: Método 'ler_tokens': nesting 2.
  - `Clean/Tamanho`: 186 linhas (aviso: 150).

#### `tools/gerar-icone-do-app.py` — gerar-icone-do-app (module), nota 67, 3 FAIL, 10 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'gerar': 33 linhas (limite: 30). Extraia sub-métodos.
  - `OCP`: Método 'principal': 6 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'separar_camadas': 6 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Método`: Método 'principal': 20 linhas.
  - `Clean/Método`: Método 'separar_camadas': 22 linhas.
  - `Clean/Nesting`: Método 'gerar': nesting 2.
  - `Clean/Nesting`: Método 'principal': nesting 2.
  - `Clean/Nesting`: Método 'raio_maximo': nesting 3.
  - `Clean/Nesting`: Método 'sem_alfa': nesting 2.
  - `Clean/Params`: Método 'desenhar': 3 parâmetros.
  - `Clean/Params`: Método 'gerar': 3 parâmetros.
  - `Clean/Tamanho`: 227 linhas (aviso: 150).
  - `OCP`: Método 'desenhar': 4 branches (aviso: 4).

#### `tools/montar-manifesto-sons.py` — montar-manifesto-sons (module), nota 67, 3 FAIL, 4 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'main': 46 linhas (limite: 30). Extraia sub-métodos.
  - `OCP`: Método 'main': 13 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'montar_pacotes': 12 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Método`: Método 'montar_pacotes': 27 linhas.
  - `Clean/Nesting`: Método 'main': nesting 3.
  - `Clean/Nesting`: Método 'montar_pacotes': nesting 2.
  - `Clean/Params`: Método 'montar_pacotes': 3 parâmetros.

#### `tools/test_gerar_partituras.py` — test_gerar_partituras (test), nota 67, 2 FAIL, 1 WARN [junto]

- **FAIL**
  - `Clean/Params`: Método 'falso': 9 parâmetros (limite: 5). Use um objeto de comando/DTO.
  - `Clean/Tamanho`: 630 linhas (limite: 500). Arquivo muito extenso.
- **WARN**
  - `Clean/Params`: Método 'run': 3 parâmetros.

#### `tools/verificar-compassos.py` — verificar-compassos (module), nota 73, 2 FAIL, 6 WARN [junto]

- **FAIL**
  - `OCP`: Método 'ler_svgs': 7 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'verificar': 12 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Método`: Método 'main': 22 linhas.
  - `Clean/Método`: Método 'verificar': 25 linhas.
  - `Clean/Nesting`: Método 'ler_svgs': nesting 2.
  - `Clean/Nesting`: Método 'main': nesting 2.
  - `Clean/Nesting`: Método 'verificar': nesting 3.
  - `OCP`: Método 'main': 4 branches (aviso: 4).

#### `tools/exemplo/lilypond.py` — lilypond (module), nota 76, 0 FAIL, 12 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método '_bloco': nesting 3.
  - `Clean/Nesting`: Método '_comando': nesting 2.
  - `Clean/Nesting`: Método '_resolver_ligaduras': nesting 2.
  - `Clean/Params`: Método '_comando': 3 parâmetros.
  - `Clean/Params`: Método '_fechar_arco': 3 parâmetros.
  - `Clean/Params`: Método '_marca_solta': 3 parâmetros.
  - `Clean/Params`: Método '_nota': 4 parâmetros.
  - `Clean/Tamanho`: 247 linhas (aviso: 150).
  - `OCP`: Método '_bloco': 4 branches (aviso: 4).
  - `OCP`: Método '_nota': 4 branches (aviso: 4).
  - `OCP`: Método '_resolver_ligaduras': 4 branches (aviso: 4).
  - `SRP`: Módulo com 17 funções (aviso: 15).

#### `tools/montar-pacote.py` — montar-pacote (module), nota 79, 2 FAIL, 2 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'principal': 31 linhas (limite: 30). Extraia sub-métodos.
  - `OCP`: Método 'principal': 9 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Nesting`: Método 'escrever_zip': nesting 3.
  - `Clean/Nesting`: Método 'principal': nesting 2.

#### `tools/preparar-sons.py` — preparar-sons (module), nota 82, 2 FAIL, 1 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'main': 52 linhas (limite: 30). Extraia sub-métodos.
  - `OCP`: Método 'main': 12 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Nesting`: Método 'main': nesting 2.

#### `tools/verificar-movimento.py` — verificar-movimento (module), nota 82, 3 FAIL, 4 WARN [junto]

- **FAIL**
  - `Clean/Método`: Método 'main': 30 linhas (limite: 30). Extraia sub-métodos.
  - `OCP`: Método 'main': 10 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
  - `OCP`: Método 'verificar_movimento_css': 6 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Nesting`: Método 'blocos': nesting 2.
  - `Clean/Nesting`: Método 'main': nesting 2.
  - `Clean/Nesting`: Método 'verificar_movimento_css': nesting 3.
  - `OCP`: Método 'blocos': 4 branches (aviso: 4).

#### `tools/verificar-traducoes.py` — verificar-traducoes (module), nota 85, 2 FAIL, 1 WARN [junto]

- **FAIL**
  - `Clean/Nesting`: Método 'main': nesting 4 (limite: 4). Aplique guard-clauses / extraia métodos.
  - `OCP`: Método 'main': 16 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Método`: Método 'main': 29 linhas.

#### `tools/gerar-exemplo.py` — gerar-exemplo (module), nota 87, 0 FAIL, 7 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'com_titulos': nesting 2.
  - `Clean/Nesting`: Método 'converter': nesting 2.
  - `Clean/Nesting`: Método 'gravar': nesting 2.
  - `Clean/Tamanho`: 171 linhas (aviso: 150).
  - `OCP`: Método 'gerar_svg': 5 branches (aviso: 4).
  - `OCP`: Método 'gravar': 4 branches (aviso: 4).
  - `OCP`: Método 'principal': 4 branches (aviso: 4).

#### `tools/exemplo/musicxml.py` — musicxml (module), nota 88, 0 FAIL, 11 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método '_nota': nesting 2.
  - `Clean/Params`: Método '_compasso': 3 parâmetros.
  - `Clean/Params`: Método '_liga': 3 parâmetros.
  - `Clean/Params`: Método '_nota': 3 parâmetros.
  - `Clean/Params`: Método '_pausa': 4 parâmetros.
  - `Clean/Params`: Método '_vigas_da_nota': 3 parâmetros.
  - `Clean/Params`: Método '_vizinho': 4 parâmetros.
  - `Clean/Params`: Método 'montar': 3 parâmetros.
  - `OCP`: Método '_liga': 5 branches (aviso: 4).
  - `OCP`: Método '_vigas': 5 branches (aviso: 4).
  - `OCP`: Método '_vigas_da_nota': 4 branches (aviso: 4).

#### `tools/montar-manifesto-hinario.py` — montar-manifesto-hinario (module), nota 88, 1 FAIL, 1 WARN [junto]

- **FAIL**
  - `OCP`: Método 'montar': 7 branches (limite: 6). Substitua condicionais por polimorfismo/estratégia.
- **WARN**
  - `Clean/Método`: Método 'montar': 23 linhas.

#### `tools/baixar-sons-gm.py` — baixar-sons-gm (module), nota 93, 0 FAIL, 3 WARN [avaliar]

- **WARN**
  - `Clean/Método`: Método 'main': 24 linhas.
  - `Clean/Nesting`: Método 'main': nesting 2.
  - `OCP`: Método 'main': 5 branches (aviso: 4).

#### `tools/exemplo/letra.py` — Alinhador (class), nota 94, 0 FAIL, 3 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'estrofe': nesting 2.
  - `Clean/Params`: Método '_marca': 4 parâmetros.
  - `OCP`: Método 'estrofe': 5 branches (aviso: 4).

#### `tools/exemplo/mscx.py` — mscx (module), nota 94, 0 FAIL, 7 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método '_figura': nesting 2.
  - `Clean/Params`: Método '_ligacao': 3 parâmetros.
  - `Clean/Params`: Método '_medida': 4 parâmetros.
  - `Clean/Params`: Método '_pauta': 3 parâmetros.
  - `Clean/Params`: Método 'montar': 3 parâmetros.
  - `OCP`: Método '_figura': 4 branches (aviso: 4).
  - `OCP`: Método '_medida': 5 branches (aviso: 4).

#### `tools/exemplo/montagem.py` — montagem (module), nota 97, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `OCP`: Método 'vozes_do_hino': 5 branches (aviso: 4).

#### `tools/test_gerar_partituras.py` — MscxParaMusicxml (test), nota 97, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Params`: Método 'falso': 4 parâmetros.

#### `tools/test_gerar_partituras.py` — GerarHino (test), nota 97, 1 FAIL, 3 WARN [junto]

- **FAIL**
  - `Clean/Params`: Método 'roda': 5 parâmetros (limite: 5). Use um objeto de comando/DTO.
- **WARN**
  - `Clean/Nesting`: Método 'roda': nesting 3.
  - `Clean/Nesting`: Método 'roda_sobre': nesting 3.
  - `Clean/Params`: Método 'roda_sobre': 3 parâmetros.

#### `tools/exemplo/compassos.py` — _Divisor (class), nota 100, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'evento': nesting 2.

#### `tools/exemplo/compassos.py` — compassos (module), nota 100, 0 FAIL, 3 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'figuras': nesting 2.
  - `Clean/Params`: Método 'dividir': 3 parâmetros.
  - `OCP`: Método 'figuras': 4 branches (aviso: 4).

#### `tools/exemplo/letra.py` — letra (module), nota 100, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Params`: Método '_lirica': 3 parâmetros.

#### `tools/exemplo/lilypond.py` — _Leitor (class), nota 100, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `OCP`: Método 'passo': 4 branches (aviso: 4).

#### `tools/test_gerar_icone_do_app.py` — Principal (test), nota 100, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'test_svg_que_nao_e_o_esperado_sai_com_codigo_2': nesting 3.

#### `tools/test_gerar_partituras.py` — Gravar (test), nota 100, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'test_falha_na_escrita_no_meio_nao_deixa_arquivo_nem_temporario': nesting 3.

#### `tools/test_montar_manifesto_hinario.py` — test_montar_manifesto_hinario (test), nota 100, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Params`: Método '_hinario': 3 parâmetros.

#### `tools/test_montar_manifesto_sons.py` — test_montar_manifesto_sons (test), nota 100, 0 FAIL, 2 WARN [avaliar]

- **WARN**
  - `Clean/Params`: Método '_rodar': 3 parâmetros.
  - `Clean/Params`: Método 'test_zip_mal_formado_e_recusado': 3 parâmetros.

#### `tools/test_montar_pacote.py` — Zip (test), nota 100, 0 FAIL, 1 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'test_sem_nenhum_svg_ou_pasta_inexistente_da_erro_sem_criar_o_zip': nesting 3.

#### `tools/test_montar_pacote.py` — Manifesto (test), nota 100, 0 FAIL, 2 WARN [avaliar]

- **WARN**
  - `Clean/Nesting`: Método 'test_erro_nao_escreve_nada': nesting 3.
  - `Clean/Nesting`: Método 'test_link_ruim_e_arquivo_que_nao_e_zip_dao_erro': nesting 3.


---

## Plano em fatias (revisado pela avaliação do Opus)

A ordem muda: o Rust de `src-tauri` primeiro (tem teste e não tem risco de aparelho), o Kotlin e o motor de áudio por último.

1. **Rust:** `hinario.rs` e `svg.rs` (incluindo os testes: `unwrap` para `-> Result<…>` com `?`, que recupera os pontos escondidos).
2. **Rust:** `pacote.rs`.
3. **Rust:** `correcoes.rs`.
4. **Rust:** `main.rs` do `mscx2json`, em 6 a 8 módulos, em várias PRs (nota bruta −182: só dividir resolve). *A decidir: o `tools/mscx2json` entra na meta? Só o app tem média 74,9 em 17 unidades.*
5. **Kotlin:** `PonteServico.kt`, `PonteCompartilhar.kt`, `ServicoAudio.kt`. Só corrigir FAIL dá uns +35 e a média fica ~88,6; é preciso dividir (tamanho abaixo de 150 e até 8 métodos).
6. **Svelte/TypeScript**, do pior para o melhor, com áudio e gravação por último e teste no aparelho. `Gravacoes` (21 métodos), `Partitura.destacarCurvas` (82 linhas, nesting 5) e `Gravador.svelte` (35 funções) exigem redesenho; no Svelte o caminho é mover lógica para `.svelte.ts`.

**Em lote e baratos:** `unwrap` nos testes Rust, parâmetros para struct (`preparar` com 7) e FAIL exatamente no limiar (uma linha).

**Cuidados:** (a) a catraca: um módulo extraído tem chave nova no baseline e precisa nascer sem FAIL, e renomear um método que ainda viola conta como violação nova, então PRs pequenas, uma por arquivo; (b) o e2e (`tests/e2e/karaoke.mjs`) depende de seletores CSS (`.estrela`, `.renomear-botao`, `#conteudo .pacote`), então extrair componentes pode quebrá-lo; (c) funções puras de DSP longas e lineares não devem ser picadas só para caber na régua; (d) cada PR **paga** a dívida e regrava o baseline **menor** (`tools/tezcat.sh --baseline`).
