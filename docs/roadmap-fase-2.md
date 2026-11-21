# Roadmap da fase 2: do protótipo ao uso real

Continua o [`roadmap-uxui-inicial.md`](roadmap-uxui-inicial.md) (fase 1, fechada em 2026-11-14: 5 etapas de UX
validadas e APK de teste aprovado). Ideias abertas: [`roadmap-ideas.md`](roadmap-ideas.md); ideias já implementadas, com
onde está cada uma: [`archive/roadmap-implementadas.md`](archive/roadmap-implementadas.md).

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
- [x] **Avançar e retroceder pela barra de progresso** (pedido do responsável após testar o zip 010: a barra era só de
      leitura). Na aba Ouvir e no miniplayer a barra agora é um `<input type="range">` (`src/lib/Busca.svelte`): arrasta,
      toca ou usa as setas (1 s por passo) e, ao soltar, `reproducao.irPara()` reposiciona o som e a letra, tocando ou
      pausado, e continua no mesmo estado. Enquanto arrasta, mostra o ponto escolhido e só reposiciona ao soltar. Coberto
      pelo e2e (`tests/e2e/karaoke.mjs`). **Falta ver no celular** (toque e arraste).
- [ ] **Aplicar o roteiro de teste** (`docs/teste-de-uso.md`) com 3 a 5 músicos, com o APK de teste
      (`docs/apk-de-teste.md`). **(depende do responsável)**
- [ ] Corrigir o que dois ou mais músicos repetirem: bloqueios primeiro, depois o que atrapalha.
- [x] **Ícones em SVG local (I-11)**: feito com o conjunto `ic` (Google Material Icons), hoje 20 ícones (4,4 KB), com tamanhos em
      `rem`. Prévia em `design/icones/previa-icones.png`.
- [x] **Tamanho e alinhamento da letra (I-04)**: barra na aba Letra, 6 passos de 85% a 160%, esquerda, direita e justificado,
      salvos no aparelho. **Falta ver no celular** e o justificado com hinos reais (abre espaços em versos que quebram).
- [ ] Opcionais, conforme o retorno: favoritos e histórico (D4).

**Pronto quando:** a I-10 estiver validada no celular e os problemas que bloqueiam o uso, resolvidos.

## Etapa 2 — Som mais realista (I-07)

- [x] Pesquisar bibliotecas de SoundFont/amostras (SpessaSynth, smplr, WebAudioFont): licença, tamanho, desempenho
      no celular. **Feita em 2026-11-14**, registrada na I-07 (`archive/ideias-implementadas.md`), com o que foi lido na fonte e o
      que ficou sem confirmar. Provisório: smplr + FluidR3_GM (MIT) hospedado no app; plano B, SpessaSynth; WebAudioFont
      descartada (GPL-3.0).
- [ ] Conferir **na documentação oficial** do Android o que o sistema oferece de MIDI (a pesquisa usou só buscas e
      código-fonte do AOSP; a página oficial não foi lida).
- [x] **Protótipo** com 3 instrumentos (smplr + FluidR3_GM): órgão, flauta e clarinete gravados como opção por voz.
      O responsável aprovou: "bem mais real", e o órgão soa como o de igreja da CCB. **Decisão:** a síntese continua
      sendo o padrão e os sons gravados viram **pacote opcional baixado sob demanda** (detalhes e números na I-07).
- [x] Ler o `LICENSE` do repositório do smplr e a licença das amostras do Gleitzman: o smplr declara MIT e não publica arquivo de
      licença; as amostras do Gleitzman saíram do app (`docs/licencas-de-terceiros.md`).
- [x] `tools/preparar-sons.py`: um arquivo por instrumento, cortado à faixa dos hinos (30 a 86), no mesmo formato que o
      smplr já lê (sem carregador novo), mais `manifesto.json` com o SHA-256 de cada um. Medido: **órgão de tirantes
      1,64 MB** (era 2,55); os outros 1,93 a 1,95 MB; os cinco juntos 9,4 MB. Saída em `dist-sons/` (fora do Git).
- [x] Ajustes, "Sons gravados": lista com tamanhos, baixar, remover; armazenamento no app, uso offline; alternador
      Sintetizado | Gravado por voz (`docs/pacote-de-sons.md`). **Testado em aparelho pelo responsável** (zips 004 a 012).
- [ ] Hospedar os arquivos nós mesmos (depende de o repositório ser público) e carregar do armazenamento do app.
- [x] **Troca do banco dos gravados: FluidR3 → GeneralUser GS** (decisão do responsável após comparar os 16 de ouvido), com
      os ganhos recalculados para o mesmo nível médio. Ver `docs/pacote-de-sons.md`. O pacote novo está no servidor desde 2026-11-15
      (pasta `BibliotecaMusicalSons/` do File Browser, que se chamava `BibliotecaMusical/` até 2026-11-16) e vale do APK 010 em diante (`docs/apk-de-teste.md`).
- [x] Créditos e licenças: card fechado em Ajustes (GeneralUser GS com a licença do autor na íntegra, smplr, ícones, fflate,
      Svelte e Tauri), com o texto de cada licença. O FluidR3 saiu do card em 2026-11-15 (nenhuma amostra dele está no app);
      a origem das medições do timbre sintético fica registrada em `docs/licencas-de-terceiros.md`.
- [x] Comparar de ouvido os órgãos do banco (igreja, palhetas e tirantes): o responsável escolheu o de **tirantes**
      (`drawbar_organ`), o mais parecido com o da igreja.
- [ ] **Flugelhorn e bombardino gravados:** nenhum banco livre os tem (General MIDI não inclui os dois). Hoje são só
      sintetizados, por mistura de instrumentos medidos, aprovada de ouvido pelo responsável.
- [x] Testar 4 vozes gravadas ao mesmo tempo no celular do responsável: **feito, "ficou bom"** (2026-11-15).
- [x] **Timbres sintetizados** de trompete, trombone, tuba, fagote, oboé e dos saxes alto e tenor, que o responsável
      achou ruins no teste (I-15). Feito: tabelas de harmônicos por altura medidas nas amostras gravadas, distância
      espectral à gravação de 9,3 para 1,7 dB. **Falta o responsável ouvir** (prévias em `tools/previas-timbres.mjs`).

**Pronto quando:** o pacote de sons baixa, funciona offline e se remove pelos Ajustes; 4 vozes gravadas tocam no celular
sem estalos; a licença de cada som está registrada; e o app base não cresceu.

## Etapa 3 — Partitura no hino (I-08)

- [x] Primeiro teste: `tools/gerar-partituras.py` gera o SVG (MuseScore 4 → MusicXML → Verovio) e o timemap de cada hino; medido
      nos 5 hinos de amostra (~400 KB cada, ~36 MB num zip de 480). Decisões do responsável em
      [`archive/roadmap-implementadas.md`](archive/roadmap-implementadas.md), I-08. **A aba está na PR 3.**
- [x] Pacote de **vários arquivos** (`.zip`) na importação, no lugar do JSON único (limite atual de 20 MB). **Feito (PR 2):
      `hinario.json` + `partituras/hino-N.svg`, com limpeza do SVG, nomes exatos e limites. Depois (2026-11-16) o zip passou a ser só de
      partituras e a importação manual saiu: o card Partituras em Ajustes baixa o pacote (ver `pacote-de-partituras.md`).**
- [x] Aba **Partitura** com zoom e rolagem, nos temas claro, escuro e alto contraste; só nos hinos que têm partitura, e, sem
      pacote importado, com um aviso e um botão para Ajustes. **Feito (PR 3), falta ver no celular (APK, PR 4).**
- [x] **Karaokê (I-12), fase A:** a **letra** acompanhando a música, com botão ligar/desligar na aba Letra (campo
      `sincronia` no formato, conversor e leitor). **Feito, falta ver no celular.**
- [x] **Karaokê (I-12), fase B:** o compasso que toca e, depois, o cursor **por nota** (I-26) e a luz da ligadura. **Feito e testado no celular** (APKs 025 a 045).

**Pronto quando:** a partitura de um hino de amostra aparece nítida no emulador e no celular, e o pacote importa
sem ir para o Git.

## Etapa 4 — Distribuição

- [ ] **Chave de assinatura própria**, criada e guardada pelo responsável (a de depuração só serve para teste).
- [x] Publicar o **código** no GitHub: <https://github.com/HyakoV3/biblioteca-musical> (público, 2026-11-14; o
      conteúdo continua fora do Git). CI/CD, proteções e revisão de código: [`roadmap-pendencias.md`](roadmap-pendencias.md).
- [ ] Avaliar **iOS** (o CI compila em máquina macOS do GitHub, mas instalar em iPhone ou publicar exige o Apple
      Developer Program) ou uma **versão web instalável (PWA)**.
- [x] Mensagens de erro da importação traduzidas pela interface (códigos do Rust + `src/lib/erros.ts`; ver `docs/TRADUCOES.md`).
- [ ] Áudio com a tela apagada no celular: validar antes de prometer (primeiro teste no celular do responsável pendente).

**Pronto quando:** um APK assinado com chave própria pode ser baixado, e o código está público sem conteúdo de hinos.

## Etapa 5 — Conteúdo completo (por último)

- [ ] **Autorização do autor das transcrições** para usar as transcrições do Hinário 5. **Sem ela, não baixar mais nada.**
- [ ] Converter os 480 hinos (e decidir sobre os coros 1 a 6, hoje ignorados pelo conversor).
- [ ] Revisar com arquivo real o que só foi testado com partituras fictícias: ligaduras, repetições, quiálteras,
      estruturas de final diferentes da do 457.
- [ ] Letras com erros da partitura: o **arquivo de correções** existe (I-05, [`correcoes-da-letra.md`](correcoes-da-letra.md)); falta
      escrevê-lo para os hinos reais, conforme aparecem os defeitos.
- [ ] Confirmar direitos de letras e partituras com a CCB ou os titulares antes de distribuir.

**Pronto quando:** o hinário 5 completo está convertido e validado, com a autorização registrada.

---

## Ideias sem etapa ainda

Entram conforme o retorno dos testes: gravador de áudio (I-03, com fone toca o hino no ouvido e grava; sem fone só
grava), afinador (I-13, dá o tom e mostra num medidor se a nota está baixa ou alta),
e as ideias novas I-16 (repetir um trecho em laço), I-17 (lembrar o último hino), I-18 (pular uma parte
inteira) e I-20 (metrônomo embutido); a I-19 (letra) e a I-22 (tela bloqueada) já estão feitas. As abertas estão em [`roadmap-ideas.md`](roadmap-ideas.md).
Gravador e afinador dividem a detecção de fone e a permissão de microfone: convém decidir os dois juntos. As ideias **já
implementadas** (estilos de cor, botão da parte que enche de dourado e outras) estão em
[`archive/roadmap-implementadas.md`](archive/roadmap-implementadas.md).
