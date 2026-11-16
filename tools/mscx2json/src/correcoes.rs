//! Arquivo de correções da letra (I-05): trocas EXPLÍCITAS, escritas pelo responsável, aplicadas às sílabas lidas do `.mscx` antes de
//! montar as linhas (assim as marcas do karaokê já nascem do texto certo). Nada é corrigido por heurística: o texto de um hino nunca muda
//! sem estar listado aqui, e cada correção aplicada (ou que não achou o que procurava) vira um aviso.
//!
//! Formato (ver `docs/correcoes-da-letra.md`):
//! ```json
//! { "versao": 1,
//!   "hinos": { "7": [ { "estrofe": 1, "juntar": "al fa" },
//!                     { "estrofe": 2, "trocar": "bta", "por": "beta" },
//!                     { "estrofe": 2, "quebrar_antes": "gama delta" } ] } }
//! ```

use super::{Silaba, sem_numero_inicial};
use serde_json::Value;
use std::collections::BTreeMap;

const EPS: f64 = 1e-6;

#[derive(Debug, PartialEq)]
pub enum Acao {
    /// Troca o texto de cada sílaba (mesmo número de sílabas antes e depois).
    Trocar { de: Vec<String>, por: Vec<String> },
    /// Faz as sílabas formarem uma palavra só (falta o marcador de continuação no arquivo do autor).
    Juntar(Vec<String>),
    /// O contrário: as sílabas viram palavras separadas (o autor marcou continuação onde não devia).
    Separar(Vec<String>),
    /// Força uma quebra de linha antes das sílabas (dois versos colados, sem respiração na partitura).
    QuebrarAntes(Vec<String>),
}

#[derive(Debug, PartialEq)]
pub struct Correcao {
    /// Número da estrofe como no arquivo de partitura (1 = a primeira, o `<no>` 0 do MuseScore).
    pub estrofe: u32,
    pub acao: Acao,
    /// Qual das ocorrências do texto na estrofe (1 = a primeira). Sem isso, vale a primeira e, se houver mais de uma, avisa.
    pub ocorrencia: Option<usize>,
}

/// Correções por número de hino.
pub type Correcoes = BTreeMap<u32, Vec<Correcao>>;

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

fn palavras(v: &Value, onde: &str, chave: &str) -> Result<Vec<String>, String> {
    let s = v
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
fn duas_ou_mais(v: &Value, onde: &str, chave: &str) -> Result<Vec<String>, String> {
    let p = palavras(v, onde, chave)?;
    if p.len() < 2 {
        return Err(format!(
            "{onde}: \"{chave}\" precisa de pelo menos 2 sílabas (a ligação é entre sílabas vizinhas)"
        ));
    }
    Ok(p)
}

fn inteiro_positivo(v: &Value, onde: &str, chave: &str) -> Result<u64, String> {
    match v.get(chave).map(Value::as_u64) {
        Some(Some(n)) if n >= 1 => Ok(n),
        _ => Err(format!(
            "{onde}: \"{chave}\" deve ser um número inteiro a partir de 1"
        )),
    }
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
        let numero: u32 = chave
            .parse()
            .map_err(|_| format!("\"{chave}\" não é número de hino"))?;
        let itens = lista
            .as_array()
            .ok_or_else(|| format!("hino {numero}: deve ser uma lista de correções"))?;
        for (i, item) in itens.iter().enumerate() {
            let onde = format!("hino {numero}, correção {}", i + 1);
            let obj = item
                .as_object()
                .ok_or_else(|| format!("{onde}: deve ser um objeto"))?;
            if let Some(k) = obj.keys().find(|k| !CHAVES.contains(&k.as_str())) {
                return Err(format!(
                    "{onde}: chave desconhecida \"{k}\" (use: {})",
                    CHAVES.join(", ")
                ));
            }
            let estrofe = u32::try_from(inteiro_positivo(item, &onde, "estrofe")?)
                .map_err(|_| format!("{onde}: \"estrofe\" grande demais"))?;
            let verbos: Vec<&str> = ["juntar", "separar", "trocar", "quebrar_antes"]
                .into_iter()
                .filter(|v| obj.contains_key(*v))
                .collect();
            let acao = match verbos.as_slice() {
                ["juntar"] => Acao::Juntar(duas_ou_mais(item, &onde, "juntar")?),
                ["separar"] => Acao::Separar(duas_ou_mais(item, &onde, "separar")?),
                ["quebrar_antes"] => Acao::QuebrarAntes(palavras(item, &onde, "quebrar_antes")?),
                ["trocar"] => {
                    let de = palavras(item, &onde, "trocar")?;
                    let por = palavras(item, &onde, "por")?;
                    if de.len() != por.len() {
                        return Err(format!(
                            "{onde}: \"trocar\" tem {} sílaba(s) e \"por\" tem {}; precisam ter o mesmo número (cada palavra separada por espaço é uma sílaba)",
                            de.len(),
                            por.len()
                        ));
                    }
                    Acao::Trocar { de, por }
                }
                _ => {
                    return Err(format!(
                        "{onde}: use exatamente um entre \"juntar\", \"separar\", \"trocar\" e \"quebrar_antes\""
                    ));
                }
            };
            if obj.contains_key("por") && !matches!(acao, Acao::Trocar { .. }) {
                return Err(format!("{onde}: \"por\" só vale junto de \"trocar\""));
            }
            let ocorrencia = match obj.contains_key("ocorrencia") {
                true => Some(
                    usize::try_from(inteiro_positivo(item, &onde, "ocorrencia")?)
                        .map_err(|_| format!("{onde}: \"ocorrencia\" grande demais"))?,
                ),
                false => None,
            };
            saida.entry(numero).or_default().push(Correcao {
                estrofe,
                acao,
                ocorrencia,
            });
        }
    }
    Ok(saida)
}

/// Os índices das sílabas de uma estrofe, em ordem de tempo e sem a cópia da mesma sílaba vinda de outra camada
/// (como `montar_letra` faz).
fn sequencia(silabas: &[Silaba], verso: u32) -> Vec<usize> {
    let mut idx: Vec<usize> = (0..silabas.len())
        .filter(|&i| silabas[i].verso == verso)
        .collect();
    idx.sort_by(|&a, &b| {
        silabas[a]
            .t
            .total_cmp(&silabas[b].t)
            .then(silabas[a].voz.cmp(&silabas[b].voz))
    });
    let mut seq: Vec<usize> = vec![];
    for i in idx {
        if let Some(&u) = seq.last()
            && (silabas[i].t - silabas[u].t).abs() < EPS
            && silabas[i].voz != silabas[u].voz
            && silabas[i].texto == silabas[u].texto
        {
            continue;
        }
        seq.push(i);
    }
    seq
}

/// Aplica as correções de UM hino às sílabas dele e devolve os avisos (um por correção, aplicada ou não). As estrofes são as do
/// arquivo de partitura, antes de qualquer reordenação do conversor; o texto procurado é o da sílaba como está no `.mscx`
/// (sem o "N." do começo da estrofe).
pub fn aplicar(silabas: &mut [Silaba], numero: u32, correcoes: &[Correcao]) -> Vec<String> {
    let mut avisos = vec![];
    for c in correcoes {
        let seq = sequencia(silabas, c.estrofe - 1);
        let (procurado, descricao) = match &c.acao {
            Acao::Trocar { de, por } => (
                de,
                format!("trocar \"{}\" por \"{}\"", de.join(" "), por.join(" ")),
            ),
            Acao::Juntar(p) => (p, format!("juntar \"{}\"", p.join(" "))),
            Acao::Separar(p) => (p, format!("separar \"{}\"", p.join(" "))),
            Acao::QuebrarAntes(p) => (p, format!("quebrar antes de \"{}\"", p.join(" "))),
        };
        let n = procurado.len();
        let achados: Vec<usize> = (0..(seq.len() + 1).saturating_sub(n))
            .filter(|&p| {
                (0..n)
                    .all(|j| sem_numero_inicial(&silabas[seq[p + j]].texto).trim() == procurado[j])
            })
            .collect();
        let quem = format!("hino {numero}, estrofe {}", c.estrofe);
        if achados.is_empty() {
            avisos.push(format!(
                "correção NÃO aplicada ({quem}): não achei as sílabas \"{}\"; confira o texto no arquivo de partitura (é o texto da sílaba, antes de qualquer conserto)",
                procurado.join(" ")
            ));
            continue;
        }
        let escolhida = c.ocorrencia.unwrap_or(1);
        let Some(&inicio) = achados.get(escolhida - 1) else {
            avisos.push(format!(
                "correção NÃO aplicada ({quem}): pedi a ocorrência {escolhida} de \"{}\", mas há só {}",
                procurado.join(" "),
                achados.len()
            ));
            continue;
        };
        match &c.acao {
            Acao::Trocar { por, .. } => {
                for j in 0..n {
                    silabas[seq[inicio + j]].texto = por[j].clone();
                }
            }
            Acao::Juntar(_) => {
                for j in 0..n - 1 {
                    silabas[seq[inicio + j]].continua = true;
                }
            }
            Acao::Separar(_) => {
                for j in 0..n - 1 {
                    silabas[seq[inicio + j]].continua = false;
                }
            }
            Acao::QuebrarAntes(_) => silabas[seq[inicio]].quebra_antes = true,
        }
        let extra = if c.ocorrencia.is_none() && achados.len() > 1 {
            format!(
                "; havia {} lugares e valeu o primeiro (use \"ocorrencia\" para escolher)",
                achados.len()
            )
        } else {
            String::new()
        };
        avisos.push(format!("correção aplicada ({quem}): {descricao}{extra}"));
    }
    avisos
}

#[cfg(test)]
mod testes {
    use super::*;
    use crate::montar_letra;

    fn s(t: f64, verso: u32, texto: &str) -> Silaba {
        Silaba {
            t,
            voz: 0,
            verso,
            continua: false,
            quebra_antes: false,
            texto: texto.to_string(),
        }
    }

    fn corr(estrofe: u32, acao: Acao) -> Correcao {
        Correcao {
            estrofe,
            acao,
            ocorrencia: None,
        }
    }

    fn p(texto: &str) -> Vec<String> {
        // Igual ao leitor do arquivo: "_" é um espaço dentro da sílaba.
        texto
            .split_whitespace()
            .map(|t| t.replace('_', " "))
            .collect()
    }

    fn letra(mut sil: Vec<Silaba>, c: Vec<Correcao>) -> (Vec<String>, Vec<String>) {
        let avisos = aplicar(&mut sil, 7, &c);
        (montar_letra(sil, vec![]).0, avisos)
    }

    #[test]
    fn ler_aceita_os_tres_verbos_e_o_comentario() {
        let c = ler(r#"{ "versao": 1, "hinos": { "7": [
                { "estrofe": 1, "juntar": "al fa", "comentario": "falta o marcador" },
                { "estrofe": 2, "trocar": "bta", "por": "beta", "ocorrencia": 2 },
                { "estrofe": 2, "quebrar_antes": "gama delta" } ] } }"#)
        .unwrap();
        let l = &c[&7];
        assert_eq!(l.len(), 3);
        assert_eq!(l[0], corr(1, Acao::Juntar(p("al fa"))));
        assert_eq!(l[1].ocorrencia, Some(2));
        assert_eq!(l[2].acao, Acao::QuebrarAntes(p("gama delta")));
    }

    #[test]
    fn ler_recusa_o_que_pode_falhar_em_silencio() {
        let erro = |json: &str| ler(json).unwrap_err();
        let com = |item: &str| format!(r#"{{ "hinos": {{ "7": [ {item} ] }} }}"#);
        assert!(erro("{").contains("JSON inválido"));
        assert!(erro(r#"{ "versao": 2, "hinos": {} }"#).contains("versao"));
        assert!(erro("{}").contains("hinos"));
        assert!(erro(r#"{ "hinos": { "x": [] } }"#).contains("número de hino"));
        assert!(
            erro(&com(r#"{ "estrofe": 1, "juntar": "a b", "juntr": "x" }"#))
                .contains("chave desconhecida")
        );
        assert!(erro(&com(r#"{ "estrofe": 1 }"#)).contains("exatamente um"));
        assert!(
            erro(&com(
                r#"{ "estrofe": 1, "juntar": "a b", "trocar": "a", "por": "b" }"#
            ))
            .contains("exatamente um")
        );
        assert!(erro(&com(r#"{ "estrofe": 1, "trocar": "a" }"#)).contains("\"por\""));
        assert!(
            erro(&com(r#"{ "estrofe": 1, "trocar": "a b", "por": "ab" }"#))
                .contains("mesmo número")
        );
        assert!(
            erro(&com(r#"{ "estrofe": 1, "juntar": "a b", "por": "x" }"#))
                .contains("só vale junto")
        );
        assert!(erro(&com(r#"{ "estrofe": 0, "juntar": "a b" }"#)).contains("a partir de 1"));
        assert!(erro(&com(r#"{ "juntar": "a b" }"#)).contains("estrofe"));
        assert!(
            erro(&com(
                r#"{ "estrofe": 1, "juntar": "a b", "ocorrencia": 0 }"#
            ))
            .contains("a partir de 1")
        );
        assert!(erro(&com(r#"{ "estrofe": 1, "juntar": "  " }"#)).contains("vazio"));
    }

    #[test]
    fn numero_grande_demais_e_recusado_em_vez_de_truncar() {
        let com = |item: &str| format!(r#"{{ "hinos": {{ "7": [ {item} ] }} }}"#);
        // 4294967297 = 2^32 + 1: com `as u32` viraria a estrofe 1.
        let e = ler(&com(r#"{ "estrofe": 4294967297, "juntar": "a b" }"#)).unwrap_err();
        assert!(e.contains("grande demais"), "{e}");
        assert!(ler(&com(r#"{ "estrofe": 4294967295, "juntar": "a b" }"#)).is_ok());
    }

    #[test]
    fn juntar_e_separar_exigem_pelo_menos_duas_silabas() {
        let com = |item: &str| format!(r#"{{ "hinos": {{ "7": [ {item} ] }} }}"#);
        for verbo in ["juntar", "separar"] {
            let e = ler(&com(&format!(r#"{{ "estrofe": 1, "{verbo}": "al" }}"#))).unwrap_err();
            assert!(e.contains("pelo menos 2 sílabas"), "{e}");
        }
        // Os outros verbos aceitam uma sílaba só.
        assert!(ler(&com(r#"{ "estrofe": 1, "quebrar_antes": "al" }"#)).is_ok());
        assert!(ler(&com(r#"{ "estrofe": 1, "trocar": "al", "por": "bl" }"#)).is_ok());
    }

    #[test]
    fn juntar_forma_uma_palavra() {
        let sil = vec![s(0.0, 0, "al"), s(1.0, 0, "fa"), s(2.0, 0, "beta")];
        let (letra, avisos) = letra(sil, vec![corr(1, Acao::Juntar(p("al fa")))]);
        assert_eq!(letra, vec!["1. alfa beta"]);
        assert_eq!(avisos.len(), 1);
        assert!(avisos[0].contains("correção aplicada") && avisos[0].contains("hino 7, estrofe 1"));
    }

    #[test]
    fn separar_desfaz_uma_continuacao_errada() {
        let mut a = s(0.0, 0, "al");
        a.continua = true;
        let sil = vec![a, s(1.0, 0, "fa"), s(2.0, 0, "beta")];
        let (antes, _) = letra(sil, vec![]);
        assert_eq!(antes, vec!["1. alfa beta"]);
        let mut a = s(0.0, 0, "al");
        a.continua = true;
        let sil = vec![a, s(1.0, 0, "fa"), s(2.0, 0, "beta")];
        let (depois, avisos) = letra(sil, vec![corr(1, Acao::Separar(p("al fa")))]);
        assert_eq!(depois, vec!["1. al fa beta"]);
        assert!(avisos[0].contains("separar"));
    }

    #[test]
    fn juntar_e_separar_juntos_na_mesma_correcao_sao_recusados() {
        let r =
            ler(r#"{ "hinos": { "7": [ { "estrofe": 1, "juntar": "a b", "separar": "a b" } ] } }"#);
        assert!(r.unwrap_err().contains("exatamente um"));
    }

    #[test]
    fn sublinhado_e_um_espaco_dentro_da_silaba() {
        // A elisão vira um espaço DENTRO da sílaba ("go, ao"): ela se escreve "go,_ao" no arquivo de correções.
        let mut a = s(0.0, 0, "go, ao");
        a.continua = true;
        let sil = vec![a, s(1.0, 0, "ceu")];
        let c = vec![corr(1, Acao::Separar(p("go,_ao ceu")))];
        let (letra, avisos) = letra(sil, c);
        assert_eq!(letra, vec!["1. go, ao ceu"]);
        assert!(avisos[0].contains("aplicada"), "{avisos:?}");
        let c = ler(r#"{ "hinos": { "7": [ { "estrofe": 1, "trocar": "x_y", "por": "z_w" } ] } }"#)
            .unwrap();
        assert_eq!(
            c[&7][0].acao,
            Acao::Trocar {
                de: vec!["x y".into()],
                por: vec!["z w".into()]
            }
        );
    }

    #[test]
    fn juntar_tres_silabas() {
        let sil = vec![
            s(0.0, 0, "al"),
            s(1.0, 0, "fa"),
            s(2.0, 0, "be"),
            s(3.0, 0, "ta"),
        ];
        let (letra, _) = letra(sil, vec![corr(1, Acao::Juntar(p("al fa be")))]);
        assert_eq!(letra, vec!["1. alfabe ta"]);
    }

    #[test]
    fn trocar_troca_o_texto_da_silaba() {
        let sil = vec![s(0.0, 0, "al"), s(1.0, 0, "bta"), s(2.0, 0, "gama")];
        let c = corr(
            1,
            Acao::Trocar {
                de: p("bta"),
                por: p("beta"),
            },
        );
        let (letra, _) = letra(sil, vec![c]);
        assert_eq!(letra, vec!["1. al beta gama"]);
    }

    #[test]
    fn trocar_pode_pedir_espaco_ou_hifen_dentro_da_silaba() {
        let sil = vec![s(0.0, 0, "alfa"), s(1.0, 0, "betagama")];
        let c = corr(
            1,
            Acao::Trocar {
                de: p("betagama"),
                por: p("beta-gama"),
            },
        );
        let (letra, _) = letra(sil, vec![c]);
        assert_eq!(letra, vec!["1. alfa beta-gama"]);
    }

    #[test]
    fn quebrar_antes_separa_dois_versos_colados() {
        let sil = vec![
            s(0.0, 0, "alfa"),
            s(1.0, 0, "beta."),
            s(2.0, 0, "Gama"),
            s(3.0, 0, "delta"),
        ];
        let (letra, _) = letra(sil, vec![corr(1, Acao::QuebrarAntes(p("Gama delta")))]);
        assert_eq!(letra, vec!["1. alfa beta.", "Gama delta"]);
    }

    #[test]
    fn quebrar_antes_nao_duplica_a_quebra_que_ja_existe() {
        // Já há respiração antes de "gama": a quebra forçada não abre uma linha vazia.
        let mut sil = vec![s(0.0, 0, "alfa"), s(1.0, 0, "beta"), s(2.0, 0, "gama")];
        aplicar(&mut sil, 7, &[corr(1, Acao::QuebrarAntes(p("gama")))]);
        let (letra, _) = montar_letra(sil, vec![1.5]);
        assert_eq!(letra, vec!["1. alfa beta", "gama"]);
    }

    #[test]
    fn a_estrofe_certa_e_a_unica_mexida() {
        let sil = vec![
            s(0.0, 0, "al"),
            s(1.0, 0, "fa"),
            s(0.0, 1, "al"),
            s(1.0, 1, "fa"),
        ];
        let (letra, _) = letra(sil, vec![corr(2, Acao::Juntar(p("al fa")))]);
        assert_eq!(letra, vec!["1. al fa", "", "2. alfa"]);
    }

    #[test]
    fn ignora_o_numero_da_estrofe_escrito_na_primeira_silaba() {
        let sil = vec![s(0.0, 0, "1. al"), s(1.0, 0, "fa")];
        let (letra, avisos) = letra(sil, vec![corr(1, Acao::Juntar(p("al fa")))]);
        assert_eq!(letra, vec!["1. alfa"]);
        assert!(avisos[0].contains("aplicada"));
    }

    #[test]
    fn texto_nao_encontrado_vira_aviso_e_nada_muda() {
        let sil = vec![s(0.0, 0, "al"), s(1.0, 0, "fa")];
        let (letra, avisos) = letra(sil, vec![corr(1, Acao::Juntar(p("al xx")))]);
        assert_eq!(letra, vec!["1. al fa"]);
        assert_eq!(avisos.len(), 1);
        assert!(avisos[0].contains("NÃO aplicada") && avisos[0].contains("al xx"));
    }

    #[test]
    fn estrofe_que_nao_existe_vira_aviso() {
        let sil = vec![s(0.0, 0, "al"), s(1.0, 0, "fa")];
        let (_, avisos) = letra(sil, vec![corr(3, Acao::Juntar(p("al fa")))]);
        assert!(avisos[0].contains("NÃO aplicada") && avisos[0].contains("estrofe 3"));
    }

    #[test]
    fn varias_ocorrencias_valem_a_primeira_e_avisam() {
        let sil = vec![
            s(0.0, 0, "al"),
            s(1.0, 0, "fa"),
            s(2.0, 0, "al"),
            s(3.0, 0, "fa"),
        ];
        let (letra, avisos) = letra(sil, vec![corr(1, Acao::Juntar(p("al fa")))]);
        assert_eq!(letra, vec!["1. alfa al fa"]);
        assert!(avisos[0].contains("havia 2 lugares"), "{avisos:?}");
    }

    #[test]
    fn ocorrencia_escolhe_qual() {
        let sil = vec![
            s(0.0, 0, "al"),
            s(1.0, 0, "fa"),
            s(2.0, 0, "al"),
            s(3.0, 0, "fa"),
        ];
        let c = Correcao {
            estrofe: 1,
            acao: Acao::Juntar(p("al fa")),
            ocorrencia: Some(2),
        };
        let (letra, avisos) = letra(sil, vec![c]);
        assert_eq!(letra, vec!["1. al fa alfa"]);
        assert!(!avisos[0].contains("havia"));
    }

    #[test]
    fn ocorrencia_que_nao_existe_vira_aviso() {
        let sil = vec![s(0.0, 0, "al"), s(1.0, 0, "fa")];
        let c = Correcao {
            estrofe: 1,
            acao: Acao::Juntar(p("al fa")),
            ocorrencia: Some(2),
        };
        let (letra, avisos) = letra(sil, vec![c]);
        assert_eq!(letra, vec!["1. al fa"]);
        assert!(avisos[0].contains("NÃO aplicada") && avisos[0].contains("ocorrência 2"));
    }

    #[test]
    fn a_copia_da_mesma_silaba_em_outra_camada_nao_atrapalha_a_busca() {
        let mut copia = s(0.0, 0, "al");
        copia.voz = 1;
        let sil = vec![s(0.0, 0, "al"), copia, s(1.0, 0, "fa")];
        let (letra, avisos) = letra(sil, vec![corr(1, Acao::Juntar(p("al fa")))]);
        assert_eq!(letra, vec!["1. alfa"]);
        assert!(avisos[0].contains("aplicada"));
    }

    #[test]
    fn as_marcas_do_karaoke_seguem_o_texto_corrigido() {
        let mut sil = vec![s(0.0, 0, "al"), s(1.0, 0, "fa"), s(2.0, 0, "bta")];
        aplicar(
            &mut sil,
            7,
            &[
                corr(1, Acao::Juntar(p("al fa"))),
                corr(
                    1,
                    Acao::Trocar {
                        de: p("bta"),
                        por: p("beta"),
                    },
                ),
            ],
        );
        let (letra, marcas) = montar_letra(sil, vec![]);
        assert_eq!(letra, vec!["1. alfa beta"]);
        let linha: Vec<u16> = "alfa beta".encode_utf16().collect();
        let trechos: Vec<String> = marcas
            .iter()
            .map(|m| String::from_utf16(&linha[m.de..m.ate]).unwrap())
            .collect();
        assert_eq!(trechos, vec!["al", "fa", "beta"]);
    }
}
