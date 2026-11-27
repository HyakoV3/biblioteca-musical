//! Leitura e validação do arquivo de correções (JSON).

use super::{Acao, Correcao, Correcoes};
use serde_json::{Map, Value};

const CHAVES: &[&str] = &[
    "estrofe",
    "juntar",
    "separar",
    "trocar",
    "por",
    "quebrar_antes",
    "ocorrencia",
    "comentario",
];

const VERBOS: [&str; 4] = ["juntar", "separar", "trocar", "quebrar_antes"];

/// Um item da lista de correções de um hino, com o texto que localiza o item nas mensagens de erro.
struct Item<'a> {
    valor: &'a Value,
    objeto: &'a Map<String, Value>,
    onde: String,
}

impl Item<'_> {
    fn palavras(&self, chave: &str) -> Result<Vec<String>, String> {
        let onde = &self.onde;
        let s = self
            .valor
            .get(chave)
            .and_then(Value::as_str)
            .ok_or_else(|| format!("{onde}: \"{chave}\" deve ser um texto"))?;
        // Cada palavra separada por espaço é UMA sílaba; "_" é um espaço dentro da sílaba (a elisão, como "sobre_a" no hinário impresso).
        let p: Vec<String> = s.split_whitespace().map(|t| t.replace('_', " ")).collect();
        if p.is_empty() {
            return Err(format!("{onde}: \"{chave}\" está vazio"));
        }
        Ok(p)
    }

    /// `juntar` e `separar` mexem na ligação ENTRE sílabas: com uma só, não teriam efeito e o aviso mentiria.
    fn duas_ou_mais(&self, chave: &str) -> Result<Vec<String>, String> {
        let p = self.palavras(chave)?;
        if p.len() < 2 {
            return Err(format!(
                "{}: \"{chave}\" precisa de pelo menos 2 sílabas (a ligação é entre sílabas vizinhas)",
                self.onde
            ));
        }
        Ok(p)
    }

    fn inteiro_positivo(&self, chave: &str) -> Result<u64, String> {
        match self.valor.get(chave).map(Value::as_u64) {
            Some(Some(n)) if n >= 1 => Ok(n),
            _ => Err(format!(
                "{}: \"{chave}\" deve ser um número inteiro a partir de 1",
                self.onde
            )),
        }
    }

    fn rejeitar_chave_desconhecida(&self) -> Result<(), String> {
        match self.objeto.keys().find(|k| !CHAVES.contains(&k.as_str())) {
            Some(k) => Err(format!(
                "{}: chave desconhecida \"{k}\" (use: {})",
                self.onde,
                CHAVES.join(", ")
            )),
            None => Ok(()),
        }
    }

    fn acao(&self) -> Result<Acao, String> {
        let verbos: Vec<&str> = VERBOS
            .into_iter()
            .filter(|v| self.objeto.contains_key(*v))
            .collect();
        match verbos.as_slice() {
            ["juntar"] => Ok(Acao::Juntar(self.duas_ou_mais("juntar")?)),
            ["separar"] => Ok(Acao::Separar(self.duas_ou_mais("separar")?)),
            ["quebrar_antes"] => Ok(Acao::QuebrarAntes(self.palavras("quebrar_antes")?)),
            ["trocar"] => self.trocar(),
            _ => Err(format!(
                "{}: use exatamente um entre \"juntar\", \"separar\", \"trocar\" e \"quebrar_antes\"",
                self.onde
            )),
        }
    }

    fn trocar(&self) -> Result<Acao, String> {
        let de = self.palavras("trocar")?;
        let por = self.palavras("por")?;
        if de.len() != por.len() {
            return Err(format!(
                "{}: \"trocar\" tem {} sílaba(s) e \"por\" tem {}; precisam ter o mesmo número (cada palavra separada por espaço é uma sílaba)",
                self.onde,
                de.len(),
                por.len()
            ));
        }
        Ok(Acao::Trocar { de, por })
    }

    fn ocorrencia(&self) -> Result<Option<usize>, String> {
        if !self.objeto.contains_key("ocorrencia") {
            return Ok(None);
        }
        let n = usize::try_from(self.inteiro_positivo("ocorrencia")?)
            .map_err(|_| format!("{}: \"ocorrencia\" grande demais", self.onde))?;
        Ok(Some(n))
    }

    fn correcao(&self) -> Result<Correcao, String> {
        self.rejeitar_chave_desconhecida()?;
        let estrofe = u32::try_from(self.inteiro_positivo("estrofe")?)
            .map_err(|_| format!("{}: \"estrofe\" grande demais", self.onde))?;
        let acao = self.acao()?;
        if self.objeto.contains_key("por") && !matches!(acao, Acao::Trocar { .. }) {
            return Err(format!(
                "{}: \"por\" só vale junto de \"trocar\"",
                self.onde
            ));
        }
        let ocorrencia = self.ocorrencia()?;
        Ok(Correcao {
            estrofe,
            acao,
            ocorrencia,
        })
    }
}

fn ler_item(numero: u32, i: usize, item: &Value) -> Result<Correcao, String> {
    let onde = format!("hino {numero}, correção {}", i + 1);
    let objeto = item
        .as_object()
        .ok_or_else(|| format!("{onde}: deve ser um objeto"))?;
    Item {
        valor: item,
        objeto,
        onde,
    }
    .correcao()
}

fn ler_hino(chave: &str, lista: &Value) -> Result<(u32, Vec<Correcao>), String> {
    let numero: u32 = chave
        .parse()
        .map_err(|_| format!("\"{chave}\" não é número de hino"))?;
    let itens = lista
        .as_array()
        .ok_or_else(|| format!("hino {numero}: deve ser uma lista de correções"))?;
    let correcoes = itens
        .iter()
        .enumerate()
        .map(|(i, item)| ler_item(numero, i, item))
        .collect::<Result<Vec<_>, _>>()?;
    Ok((numero, correcoes))
}

/// Lê o arquivo de correções. Qualquer deslize (chave desconhecida, dois verbos numa correção, `trocar` com número diferente de
/// sílabas...) é um erro, para o arquivo do responsável não falhar em silêncio.
pub fn ler(texto: &str) -> Result<Correcoes, String> {
    let raiz: Value = serde_json::from_str(texto).map_err(|e| format!("JSON inválido: {e}"))?;
    if let Some(v) = raiz.get("versao")
        && v.as_u64() != Some(1)
    {
        return Err("só a \"versao\" 1 é suportada".into());
    }
    let hinos = raiz
        .get("hinos")
        .and_then(Value::as_object)
        .ok_or("falta \"hinos\" (um objeto: número do hino -> lista de correções)")?;
    let mut saida = Correcoes::new();
    for (chave, lista) in hinos {
        let (numero, correcoes) = ler_hino(chave, lista)?;
        if !correcoes.is_empty() {
            saida.entry(numero).or_default().extend(correcoes);
        }
    }
    Ok(saida)
}
