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

mod aplicacao;
mod leitura;

pub use aplicacao::aplicar;
pub use leitura::ler;

#[cfg(test)]
use super::Silaba;
use std::collections::BTreeMap;

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
