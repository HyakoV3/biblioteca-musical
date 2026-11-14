# Roadmap

Projeto **não oficial**, gratuito e de código aberto (MIT). Sem vínculo com a Congregação Cristã no Brasil.
Este documento é a referência de prioridades. Atualize-o ao concluir uma etapa ou mudar uma decisão.

Legenda: `[x]` feito · `[ ]` a fazer · **(a validar)** decisão ainda não confirmada pelo responsável.

---

## 1. Já feito

- [x] Esqueleto Tauri 2 + SvelteKit (SPA) + Svelte 5, licença MIT.
- [x] Leitor do pacote de dados `hinario.json` em Rust, com validação e testes (`docs/FORMATO.md`).
- [x] Importador de conteúdo (gravação atômica, remoção, limite de tamanho).
- [x] Lista de hinos com busca por número ou título (sem diferenciar acentos).
- [x] Player por **síntese** (Web Audio), sem gravações: notas por voz, andamento, transposição.
- [x] Quatro vozes (Soprano, Contralto, Tenor, Baixo) com volume, silenciar ao vivo e instrumento por voz
      (3 órgãos e 16 instrumentos sintetizados). Preferências por voz lembradas no aparelho.
- [x] `tools/mscx2json`: converte partituras MuseScore (`.mscx`, versões 2 e 3) em notas, letra e vozes.
- [x] Letra por estrofe, ordenada pelo tempo das notas.
- [x] Interface em português, espanhol e inglês, pronta para novos idiomas (`docs/TRADUCOES.md`).
- [x] Projeto Android gerado; app instalado e testado no emulador (importar, tocar, voltar).

## 2. Redesenho de UX/UI

Princípio: a pessoa deve achar um hino, ler a letra ou ouvi-lo sem entender como o app foi feito.

### Diagnóstico (resumo)

| Prio. | Problema | Direção |
|---|---|---|
| P0 | A letra fica abaixo de todo o player | Letra como área principal, em aba própria |
| P0 | Leitura, mixer e ajustes na mesma rolagem | Separar **Letra** e **Ouvir** no mesmo hino |
| P1 | Importar e remover na tela inicial | Mover para **Ajustes → Biblioteca** |
| P1 | Idioma ocupa a tela inicial | Mover para **Ajustes** |
| P1 | Cabeçalho alto (título, aviso e idioma) | Barra de topo de uma linha |
| P1 | Tema único, cores soltas | Tokens semânticos; Claro, Escuro e Sistema |
| P2 | Número "1." gravado dentro da primeira linha da estrofe | Letra estruturada em estrofes |

### Mapa de navegação alvo

```
Biblioteca ──[engrenagem]──▶ Ajustes
   │                           ├─ Aparência: Sistema | Claro | Escuro
   ▼                           ├─ Idioma da interface
Detalhe do hino                ├─ Leitura: tamanho da letra
  ├─ aba Letra                 ├─ Biblioteca: importar .json / remover
  ├─ aba Ouvir (player+mixer)  └─ Sobre: aviso de não vínculo, créditos
  └─ aba Partitura (se houver)
  + miniplayer fixo (se houver áudio)
```

### Etapas

**Etapa 1 — Navegação e separação das funções** (sem mexer em cores) — *implementada em 2026-11-14; falta validar no aparelho*
- [x] Barra de topo de uma linha; Biblioteca enxuta (busca com botão limpar + lista).
- [x] Tela **Ajustes** com idioma, importar e remover (confirmação explicando o impacto) e Sobre.
- [x] Detalhe do hino (rota `/hino/<número>`) com abas **Letra** e **Ouvir**; aba Letra sem nenhum controle de áudio.
- [x] Voltar preserva busca e posição da lista (estado da biblioteca compartilhado entre telas).
- [x] Estrofes com rótulo "Estrofe N" (o número sai do verso; sem mudar o formato dos dados).
- [x] Abas acessíveis (papéis tablist/tab/tabpanel, estado selecionado, setas do teclado).
- [x] Os dois painéis ficam montados: trocar de aba não interrompe o som (sair do hino ainda interrompe; etapa 2).
- [ ] **Teste no emulador/aparelho** dos critérios abaixo (só foram verificados tipos, build e o parser de estrofes).
- Aceitação: da tela inicial à letra em no máximo 2 toques · nenhuma ação destrutiva na tela inicial ·
  o botão voltar do Android continua fechando o hino e não o app · voltar da letra devolve a lista com a
  busca e a posição de rolagem.

**Etapa 2 — Player global e miniplayer**
- [ ] Sintetizador em módulo único (hoje morre ao sair da tela do hino).
- [ ] Pausar/retomar; miniplayer refletindo o estado real; progresso sem arrastar.
- [ ] Andamento e tom como valores numéricos com − e +; "Restaurar padrão".
- Aceitação: trocar de aba ou voltar à lista não interrompe a reprodução · miniplayer correto após parar/pausar.

**Etapa 3 — Componentes e tema**
- [ ] Tokens semânticos; temas Claro, Escuro e Sistema (padrão).
- [ ] Estados: vazio, carregando, erro, importação concluída, áudio indisponível.
- [ ] Mixer compacto: ligar/desligar, volume e instrumento como três ações visualmente distintas;
      instrumentos em seção recolhida.
- Aceitação: contraste AA verificado em todos os estados · silenciar não depende só de cor.
- Atenção: na paleta de partida, **as bordas falham** o contraste de componente (1,27:1 no claro e
  1,59:1 no escuro, meta 3:1). Ajustar antes de adotar.

**Etapa 4 — Acessibilidade e internacionalização**
- [ ] Nome, papel e valor em cada controle (ex.: "Volume do soprano, 80 por cento").
- [ ] Abas com estado anunciado; áreas de toque ≥ 48 dp; fonte ampliada sem corte; movimento reduzido.
- [ ] Teste com TalkBack no emulador.
- [ ] Plurais e novas chaves de tradução (abas, Ajustes); separar idioma da interface do idioma do conteúdo.

**Etapa 5 — Polimento**
- [ ] Ícone e identidade visual (o ícone atual é o padrão do Tauri).
- [ ] Animações discretas; teste de uso com músicos reais (tarefas: achar hino, ler, ouvir só uma voz).

### Decisões a validar

| # | Decisão | Proposta atual | Situação |
|---|---|---|---|
| D1 | Abas **Letra \| Ouvir** no hino, ou tela única com mixer em painel inferior | Abas | **(a validar)** |
| D2 | Miniplayer só no hino ou global (continua ao voltar à lista) | Global, na etapa 2 | **(a validar)** |
| D3 | Letra estruturada em estrofes (`{numero, linhas}`) no formato e no conversor | Sim; invalida JSONs já gerados, que são regeneráveis | **(a validar)** |
| D4 | Favoritos e histórico | Fora desta fase | **(a validar)** |

## 3. Conteúdo e direitos (bloqueia distribuição)

- [ ] **Autorização do autor das transcrições** para usar as transcrições `.mscx` do Hinário 5. Pedido feito em 2026-11-14; aguardando
      resposta. **Não baixar mais arquivos dele enquanto isso.**
- [ ] Se autorizado: converter os 480 hinos (e decidir sobre os coros 1–6, hoje ignorados pelo conversor).
- [ ] Decidir se o conteúdo entra no repositório ou só no app (padrão atual: **fora do Git**, em `content/`).
- [ ] Hinários 1 a 4: nenhuma fonte encontrada.
- [ ] Validar com arquivo real o que só foi testado com partituras fictícias: ligaduras, repetições, quiálteras.
- [ ] Letras e partituras: confirmar direitos com a CCB ou os titulares antes de distribuir.

## 4. Plataformas e distribuição

- [x] Desktop (Linux) e Android (emulador).
- [ ] Teste em celular Android real; gerar APK (`npm run tauri android build`).
- [ ] Verificar comportamento do áudio com a tela apagada (Android). **Não prometer** áudio em segundo plano
      sem validar.
- [ ] iOS: exige Mac com Xcode (ou CI com macOS); distribuição exige Apple Developer Program.
      Alternativa a avaliar: versão web instalável (PWA).
- [ ] Publicar o código no GitHub (repositório ainda sem remote).
- [ ] Mensagens de erro da importação vêm do Rust em português; trocar por códigos traduzidos pela interface.

## 5. Melhorias de áudio (depois do redesenho)

- [ ] Ajustar níveis de volume entre instrumentos (ajuste fino por ouvido).
- [ ] SoundFont opcional para timbres mais realistas (aumenta o tamanho do app).
- [ ] Editar notas dentro do app (hoje: editar o `hinario.json` e importar de novo).

## 6. Registro de decisões

| Data | Decisão |
|---|---|
| 2026-11-14 | App novo, escrito do zero (clean room), em Rust + Tauri 2 + Svelte; licença MIT. |
| 2026-11-14 | Áudio por síntese a partir de notas, sem gravações, como o app de referência. |
| 2026-11-14 | Conteúdo de hinos fora do repositório público até haver autorização. |
| 2026-11-14 | Vozes nomeadas Soprano, Contralto, Tenor e Baixo (de "Parte I a IV"). |
| 2026-11-14 | Redesenho começa por navegação e separação de funções, antes de cores. |
