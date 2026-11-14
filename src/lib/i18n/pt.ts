// Português: idioma de referência. Os outros idiomas precisam ter exatamente as mesmas chaves
// (o TypeScript acusa chave faltando). Veja docs/TRADUCOES.md.
export const pt = {
  "app.aviso": "App não oficial, sem vínculo com a Congregação Cristã no Brasil.",
  "app.idioma": "Idioma",
  carregando: "Carregando…",
  "erro.carregar": "Erro ao carregar o hinário: {erro}",

  "lista.exemplo": "pacote de exemplo",
  "lista.buscar": "Buscar por número ou título",
  "lista.buscar_aria": "Buscar hino",
  "lista.vazio": "Nenhum hino encontrado.",

  "importar.botao": "Importar hinário (.json)",
  "importar.remover": "Remover conteúdo importado",
  "importar.confirmar": "Confirmar remoção",
  "importar.ok": "Importado: {n} hinos de “{nome}”.",
  "importar.erro": "Não foi possível importar: {erro}",
  "remover.ok": "Conteúdo importado removido. Mostrando o pacote de exemplo.",
  "remover.erro": "Não foi possível remover: {erro}",

  "hino.voltar": "← Voltar",
  "hino.tonalidade": "Tonalidade: {tom}",
  "hino.sem_letra": "Sem letra neste pacote.",

  "player.titulo": "Player",
  "player.tocar": "▶ Tocar",
  "player.parar": "■ Parar",
  "player.vozes": "Vozes",
  "player.silenciar": "Silenciar {voz}",
  "player.ativar": "Ativar {voz}",
  "player.volume": "Volume de {voz}",
  "player.instrumento": "Instrumento de {voz}",
  "player.andamento": "Andamento: {bpm} bpm",
  "player.transposicao": "Transposição",
  "player.semitons": "{n} semitons",
  "grupo.orgaos": "Órgãos",
  "grupo.instrumentos": "Instrumentos",

  "voz.soprano": "Soprano",
  "voz.contralto": "Contralto",
  "voz.tenor": "Tenor",
  "voz.baixo": "Baixo",

  "inst.orgao_suave": "Órgão suave (flauta 8')",
  "inst.orgao_principal": "Órgão principal",
  "inst.orgao_pleno": "Órgão pleno",
  "inst.flauta_doce": "Flauta doce",
  "inst.violino": "Violino",
  "inst.clarinete": "Clarinete",
  "inst.trompete": "Trompete",
  "inst.sax_alto": "Sax alto",
  "inst.flugelhorn": "Flugelhorn",
  "inst.oboe": "Oboé",
  "inst.viola": "Viola",
  "inst.sax_tenor": "Sax tenor",
  "inst.trombone": "Trombone",
  "inst.trompa": "Trompa",
  "inst.violoncelo": "Violoncelo",
  "inst.tuba": "Tuba",
  "inst.bombardino": "Bombardino",
  "inst.fagote": "Fagote",
  "inst.contrabaixo": "Contrabaixo",
};

export type Chave = keyof typeof pt;
export type Dicionario = Record<Chave, string>;
