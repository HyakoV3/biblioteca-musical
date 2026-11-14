# Ideias e pedidos para o futuro

Este arquivo guarda ideias, reclamações e pedidos que ainda **não** entraram no plano das etapas
([`roadmap-uxui-inicial.md`](roadmap-uxui-inicial.md)). Ele existe para nada se perder. Uma ideia só vira
trabalho depois de ser avaliada e priorizada.

Como usar: cada ideia tem um código (`I-01`, `I-02`…), a origem, o problema, o que se deseja e as perguntas
em aberto. Ao implementar, mude o status e aponte para a etapa ou o commit.

Status possíveis: **anotada** · **em análise** · **planejada** · **feita** · **descartada**.

---

## I-01 — Tocar o hino com a passada do final

- **Status:** anotada
- **Origem:** reclamação do responsável, 2026-11-14, sobre o aplicativo de referência (CCB Virtual Plus).
- **Prioridade:** a definir

### O problema (nas palavras do responsável)

Quando um hino é tocado em várias passadas do início ao fim e todas são iguais, funciona. Mas vários
hinos **não têm coro** e são cantados em **duas ou três passadas normais e uma última com final** (uma
conclusão diferente). No aplicativo de referência não existe a opção de tocar o hino com essa **passada do
final**, então não dá para ouvir como o hino realmente termina.

### O que se deseja

Poder tocar o hino do jeito que ele é cantado: várias passadas e, na última, o **final**.

### Ideia de comportamento (a validar)

Na aba **Ouvir**, um controle simples antes de tocar, por exemplo:

- **Passadas:** quantas vezes tocar o hino do início ao fim (1, 2, 3, 4…).
- **Terminar com o final:** liga ou desliga. Ligado, a última passada usa o final do hino.
- Valores iniciais sensatos: uma passada, sem final; e, nos hinos que tiverem final, sugerir o número de
  passadas igual ao de estrofes da letra (a confirmar).

O progresso e o miniplayer passariam a considerar a duração total (todas as passadas somadas).

### Perguntas em aberto

1. **Como o final está representado nos dados?** Nos 3 hinos de amostra (1, 283 e 398) **não há marcas de
   repetição, volta ou salto** (ritornelo, volta 1/2, coda, D.C./D.S.), então não sabemos como um hino com
   final aparece nos arquivos do MuseScore. Precisamos de pelo menos um hino com final como amostra, o que
   depende da autorização do autor das transcrições para baixar mais arquivos.

   **Observação nos arquivos (verificada em 2026-11-14):** os três hinos têm um marcador de texto **`*`**
   sempre no **compasso 5** (hino 1: 5 de 11 compassos; hino 283: 5 de 18; hino 398: 5 de 56), e os hinos 283
   e 398 têm também o rótulo **"Coro"** (compassos 11 e 28). **Hipótese não confirmada:** o `*` pode marcar o
   ponto onde o hino termina na passada do final. Faltam duas respostas do responsável: o que o `*` significa
   no hinário impresso, e se ele aparece nos hinos que não têm coro e que têm a passada do final.
2. **O final é um trecho a mais no fim da partitura, ou uma volta alternativa (volta 1/2) que substitui o
   fim da passada?** Muda como o conversor precisa tratar.
3. **O número de passadas é sempre igual ao de estrofes?** Há hinos com refrão, em que a estrofe 1
   inclui o refrão (como nos hinos 283 e 398), e outros sem.
4. **A letra deve acompanhar a passada?** Ex.: ao tocar duas passadas, mostrar a estrofe correspondente.
   Hoje a aba Letra é independente do player.

### Impacto técnico (hipóteses, não verificadas)

- **Conversor (`tools/mscx2json`):** hoje **não expande repetições nem saltos** (só avisa). Teria de
  entender a estrutura de repetições e voltas do MuseScore e produzir as notas de uma passada normal e as do
  final, separadamente.
- **Formato de dados (`docs/FORMATO.md`):** precisa de um jeito de dizer "esta é a passada normal" e "este é o
  final". Alternativas a avaliar: campos como `passada` e `final` dentro de cada voz, ou uma lista de seções.
  Qualquer mudança precisa continuar compatível com os `hinario.json` já gerados, ou ter migração.
- **Reprodução (`src/lib/reproducao.svelte.ts` e `sintetizador.ts`):** o sintetizador agenda todas as notas de
  uma vez, então várias passadas viram o mesmo trecho agendado em deslocamentos diferentes, seguido do final.
- **Relação com o roadmap:** é parente do item "repetições e saltos não são expandidos" (seção 3, conteúdo e
  direitos) e da etapa 2 (player e progresso).

### Critérios de aceitação (propostos)

- Para um hino com final, é possível tocar N passadas e terminar com o final, e o som bate com o que o
  responsável espera do aplicativo de referência.
- Hinos sem final continuam tocando como hoje, sem controle extra confuso.
- Progresso, tempo total e miniplayer refletem todas as passadas.

---

## Modelo para novas ideias

```markdown
## I-NN — Título curto

- **Status:** anotada
- **Origem:** quem pediu e quando
- **Prioridade:** a definir

### O problema
### O que se deseja
### Perguntas em aberto
### Impacto técnico (hipóteses)
### Critérios de aceitação (propostos)
```
