# Roadmap da fase 2: do protótipo ao uso real

Continua o [`roadmap-uxui-inicial.md`](roadmap-uxui-inicial.md) (fase 1, fechada em 2026-11-14: 5 etapas de UX
validadas e APK de teste aprovado). Ideias detalhadas: [`roadmap-ideas.md`](roadmap-ideas.md).

Legenda: `[x]` feito · `[ ]` a fazer · **(depende de ...)** o que bloqueia o item.

**Decisão do responsável (2026-11-14):** o **conteúdo completo** (os 480 hinos) fica por **último**. Antes dele, o app
é melhorado com os 5 hinos de amostra e o teste com músicos.

---

## Etapa 1 — Ajustes do primeiro teste

Objetivo: tirar os atritos que já apareceram e os que os músicos apontarem.

- [x] **I-10 — Trocar instrumento, andamento e tom com a música pausada** (pedido do responsável). Ao continuar, o
      app reagenda as notas a partir da posição atual com os ajustes novos. **Falta validar no celular.**
      Achado no teste do APK 004: nas vozes **gravadas**, as notas do andamento antigo seguiam disparando (a fila do
      agendador do smplr não era esvaziada ao parar); corrigido no zip 005. No sintetizado puro, a medição não
      mostrou atraso nem desvio: se reaparecer, anotar voz, modo, hino e se foi pausar ou parar.
- [x] Andamento de 1 em 1 e de 5 em 5 (`−5 −1 +1 +5`) e abas Ouvir | Letra embaixo, ou à esquerda com o celular
      deitado (zip 005). **Falta ver no celular.**
- [ ] **Aplicar o roteiro de teste** (`docs/teste-de-uso.md`) com 3 a 5 músicos, com o APK de teste
      (`docs/apk-de-teste.md`). **(depende do responsável)**
- [ ] Corrigir o que dois ou mais músicos repetirem: bloqueios primeiro, depois o que atrapalha.
- [x] **Ícones em SVG local (I-11)**: feito com o conjunto `ic` (1,9 KB). Texto original:: trocar emojis e símbolos por um subset local de ícones (~11 KB), reaproveitando a
      ideia de outro projeto do responsável. Item pequeno. **Prévia feita** (`design/icones/previa-icones.png`); recomendação: conjunto `ic`.
      **(depende de o responsável escolher o conjunto)**
- [ ] Opcionais, conforme o retorno: tamanho e alinhamento da letra (I-04), favoritos e histórico (D4).

**Pronto quando:** a I-10 estiver validada no celular e os problemas que bloqueiam o uso, resolvidos.

## Etapa 2 — Som mais realista (I-07)

- [x] Pesquisar bibliotecas de SoundFont/amostras (SpessaSynth, smplr, WebAudioFont): licença, tamanho, desempenho
      no celular. **Feita em 2026-11-14**, registrada na I-07 de `roadmap-ideas.md`, com o que foi lido na fonte e o
      que ficou sem confirmar. Provisório: smplr + FluidR3_GM (MIT) hospedado no app; plano B, SpessaSynth; WebAudioFont
      descartada (GPL-3.0).
- [ ] Conferir **na documentação oficial** do Android o que o sistema oferece de MIDI (a pesquisa usou só buscas e
      código-fonte do AOSP; a página oficial não foi lida).
- [x] **Protótipo** com 3 instrumentos (smplr + FluidR3_GM): órgão, flauta e clarinete gravados como opção por voz.
      O responsável aprovou: "bem mais real", e o órgão soa como o de igreja da CCB. **Decisão:** a síntese continua
      sendo o padrão e os sons gravados viram **pacote opcional baixado sob demanda** (detalhes e números na I-07).
- [ ] Ler o `LICENSE` do repositório do smplr (o pacote no npm declara MIT) e a licença das amostras do Gleitzman.
- [x] `tools/preparar-sons.py`: um arquivo por instrumento, cortado à faixa dos hinos (30 a 86), no mesmo formato que o
      smplr já lê (sem carregador novo), mais `manifesto.json` com o SHA-256 de cada um. Medido: **órgão de tirantes
      1,64 MB** (era 2,55); os outros 1,93 a 1,95 MB; os cinco juntos 9,4 MB. Saída em `dist-sons/` (fora do Git).
- [x] Ajustes, "Sons gravados": lista com tamanhos, baixar, remover; armazenamento no app, uso offline; alternador
      Sintetizado | Gravado por voz. **Implementado na 0.3.0, falta testar em aparelho** (`docs/pacote-de-sons.md`).
- [ ] Hospedar os arquivos nós mesmos (depende de o repositório ser público) e carregar do armazenamento do app.
- [ ] Página de créditos e licenças das amostras (aviso de copyright do FluidR3).
- [ ] Comparar de ouvido os órgãos do banco: `church_organ`, `reed_organ` (palhetas) e `drawbar_organ` (tirantes), os
      três já no APK de comparação (baixados em 2026-11-14, ~3 MB cada). Escolher o mais parecido com o da igreja e
      decidir o substituto do flugelhorn. **(depende do responsável)**
- [ ] Testar 4 vozes gravadas ao mesmo tempo no celular do responsável (estalos, atraso, memória).
      **(depende do responsável, com o APK de comparação)**

**Pronto quando:** o pacote de sons baixa, funciona offline e se remove pelos Ajustes; 4 vozes gravadas tocam no celular
sem estalos; a licença de cada som está registrada; e o app base não cresceu.

## Etapa 3 — Partitura no hino (I-08)

- [ ] Primeiro teste: gerar o SVG de **um** hino e mostrá-lo numa aba simples. **(depende de instalar o MuseScore, ou
      de avaliar a alternativa sem instalar)**
- [ ] Pacote de **vários arquivos** (`.zip`) na importação, no lugar do JSON único (limite atual de 20 MB).
- [ ] Aba **Partitura** com zoom e rolagem, nos temas claro, escuro e (futuro) baixa visão.
- [ ] **Karaokê (I-12):** fase A, a **letra** acompanhando a música (não depende da partitura: o conversor já lê o
      tempo de cada sílaba); fase B, cursor ou compasso na partitura, junto da I-08.

**Pronto quando:** a partitura de um hino de amostra aparece nítida no emulador e no celular, e o pacote importa
sem ir para o Git.

## Etapa 4 — Distribuição

- [ ] **Chave de assinatura própria**, criada e guardada pelo responsável (a de depuração só serve para teste).
- [ ] Publicar o **código** no GitHub (o repositório ainda não tem remote; conteúdo continua fora do Git).
- [ ] Avaliar **iOS** (exige Mac com Xcode e Apple Developer Program) ou uma **versão web instalável (PWA)**.
- [ ] Mensagens de erro da importação traduzidas pela interface (hoje vêm do Rust em português).
- [ ] Áudio com a tela apagada no celular: validar antes de prometer (primeiro teste no celular do responsável pendente).

**Pronto quando:** um APK assinado com chave própria pode ser baixado, e o código está público sem conteúdo de hinos.

## Etapa 5 — Conteúdo completo (por último)

- [ ] **Autorização do autor das transcrições** para usar as transcrições do Hinário 5. **Sem ela, não baixar mais nada.**
- [ ] Converter os 480 hinos (e decidir sobre os coros 1 a 6, hoje ignorados pelo conversor).
- [ ] Revisar com arquivo real o que só foi testado com partituras fictícias: ligaduras, repetições, quiálteras,
      estruturas de final diferentes da do 457.
- [ ] Letras com erros da partitura: decidir entre o arquivo de correções (I-05) e corrigir na fonte.
- [ ] Confirmar direitos de letras e partituras com a CCB ou os titulares antes de distribuir.

**Pronto quando:** o hinário 5 completo está convertido e validado, com a autorização registrada.

---

## Ideias sem etapa ainda

Entram conforme o retorno dos testes: gravador de áudio (I-03), variante "pergaminho" (I-02), modo de baixa visão
(I-06), correção de letras (I-05).
