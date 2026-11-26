**Português** · [English](MATRIZ-DE-COBERTURA.en.md) · [Español](MATRIZ-DE-COBERTURA.es.md)

# Matriz de cobertura e distribuição das frentes

A matriz evita que diferentes personas abram o **mesmo defeito** com títulos diferentes. A persona indicada como **dona** consolida o achado técnico; as demais adicionam impacto e cenários.

| Área | Dona | Apoio | Evidência mínima |
|---|---|---|---|
| Requisitos e estágio de entrega | 01 | 00, 22 | requisito + implementação + situação documentada |
| Descoberta e aprendizado do app | 02 | 01, 04 | tarefa + observação de usuário ou heurística identificada |
| Fluxo de treino por naipe | 03 | 06, 08 | cenário musical + resultado audível |
| Navegação e estados da UI | 04 | 02, 05 | rota + ação + screenshot/DOM |
| Leitor de tela e inclusão | 05 | 04, 22 | elemento + tecnologia assistiva + impacto |
| Estrutura musical | 06 | 03, 07, 11 | fixture + regra musical + diferença |
| Temporização e seek | 07 | 06, 09 | timeline/estado + passos + logs/teste |
| Som, síntese e samples | 08 | 03, 13 | saída + nota/voz + resultado |
| Letra e karaokê | 09 | 05, 07 | batida + estrofe/linha/sílaba + reprodução |
| Visualização de partituras | 10 | 05, 06, 14 | SVG fictício + orientação + resultado |
| Conversão MuseScore | 11 | 06, 12 | entrada MSCX fictícia + JSON esperado/real |
| Importação e persistência | 12 | 14, 18 | entrada sintética + estado antes/depois |
| Pacotes opcionais offline | 13 | 08, 10, 18 | manifesto + rede/cache + resultado |
| Segurança da aplicação | 14 | 12, 13, 21 | cadeia de entrada → controle → impacto |
| Privacidade, conteúdo e direitos | 15 | 01, 21 | licença/autorização comprovável + contexto |
| i18n e traduções | 16 | 05, 22 | idioma + chave + contexto visível |
| Performance | 17 | 07, 13, 18 | dispositivo + baseline + medições |
| Android e lifecycle | 18 | 04, 13, 17 | build + aparelho + sequência reproduzível |
| Automação/regressão | 19 | Todas | comando/teste + saída + lacuna de cobertura |
| Qualidade de código | 20 | 07, 12, 14 | dependências e consequência concreta |
| CI/CD e APK | 21 | 14, 15, 19 | workflow + commit + artefato ou lacuna |
| Design e documentação | 22 | 04, 05, 16 | token/tela/doc + divergência |

## Critério de escalonamento

- **P0/P1:** coordenador (00) avalia imediatamente o bloqueio do fluxo/versão.
- **Segurança:** relatar por canal privado de `SECURITY.md`, sem divulgar exploração.
- **Autorização de conteúdo:** envolver responsável e jurídico; não distribuir amostra real para testar.
- **Dependente de aparelho:** deixar como `Risco a verificar` até execução em Android apropriado.
- **Pendência planejada:** registrar como requisito futuro, não defeito.

## Entregáveis da rodada

1. Relatório independente por persona.
2. Inventário de riscos e testes não executados.
3. Backlog deduplicado P0–P3 e plano de regressão.
4. Decisão fundamentada de aceite, aceite condicionado, reprovação ou inconclusivo.
