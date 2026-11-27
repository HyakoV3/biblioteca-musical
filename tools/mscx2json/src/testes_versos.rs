//! Testes do conversor sobre a quebra de linha da letra por verso (nomes reverenciais).

use crate::testes_apoio::*;

#[test]
fn respiracao_no_meio_do_verso_nao_quebra_a_linha() {
    // "Alfa beta | gama delta;" é um verso só; "Épsilon zeta | eta teta." é outro. As respirações antes de "gama" e de "eta"
    // seguem minúscula (continuam o verso); a antes de "Épsilon" e a antes de "Iota" seguem maiúscula (verso novo).
    let (silabas, respiracoes) = estrofe_com_respiracoes(
        &[
            "Alfa", "beta", "gama", "delta;", "Épsilon", "zeta", "eta", "teta.", "Iota", "kapa",
        ],
        &[2, 4, 6, 8],
    );
    let (letra, _) = montar_letra(silabas, respiracoes);
    assert_eq!(
        letra,
        vec![
            "1. Alfa beta gama delta;",
            "Épsilon zeta eta teta.",
            "Iota kapa"
        ]
    );
}

#[test]
fn nome_reverencial_sem_pontuacao_antes_continua_o_verso() {
    // "Alfa beta | Jesus gama;": "Jesus" é maiúsculo por reverência, e o trecho anterior não tem pontuação.
    let (silabas, respiracoes) = estrofe_com_respiracoes(
        &[
            "Alfa", "beta;", "Gama", "delta", "Jesus", "eta;", "Teta", "iota.",
        ],
        &[2, 4, 6],
    );
    let (letra, _) = montar_letra(silabas, respiracoes);
    assert_eq!(
        letra,
        vec!["1. Alfa beta;", "Gama delta Jesus eta;", "Teta iota."]
    );
}

#[test]
fn nome_reverencial_depois_de_pontuacao_comeca_verso() {
    // "Alfa beta, | Rei gama,": o trecho anterior termina em vírgula, então "Rei" abre um verso novo.
    let (silabas, respiracoes) =
        estrofe_com_respiracoes(&["Alfa", "beta,", "Rei", "gama,", "Delta", "eta."], &[2, 4]);
    let (letra, _) = montar_letra(silabas, respiracoes);
    assert_eq!(letra, vec!["1. Alfa beta,", "Rei gama,", "Delta eta."]);
}

#[test]
fn palavra_reverencial_em_varias_silabas_tambem_vale() {
    // "Je" + "sus": a palavra inteira é que decide, não a primeira sílaba.
    let silabas = vec![
        silaba_de(0.0, "Alfa", false),
        silaba_de(1.0, "beta", false),
        silaba_de(2.0, "Gama", false),
        silaba_de(3.0, "delta", false),
        silaba_de(4.0, "Je", true),
        silaba_de(5.0, "sus", false),
        silaba_de(6.0, "eta;", false),
        silaba_de(7.0, "Teta", false),
        silaba_de(8.0, "iota.", false),
    ];
    let (letra, _) = montar_letra(silabas, vec![1.5, 3.5, 6.5]);
    assert_eq!(
        letra,
        vec!["1. Alfa beta", "Gama delta Jesus eta;", "Teta iota."]
    );
}

#[test]
fn sem_maiuscula_depois_das_respiracoes_vale_a_quebra_em_toda_respiracao() {
    // O autor escreveu tudo em minúscula: não há pista, e fica o comportamento de sempre.
    let (silabas, respiracoes) =
        estrofe_com_respiracoes(&["alfa", "beta", "gama", "delta", "eta", "teta"], &[2, 4]);
    let (letra, _) = montar_letra(silabas, respiracoes);
    assert_eq!(letra, vec!["1. alfa beta", "gama delta", "eta teta"]);
}

#[test]
fn nome_reverencial_nao_conta_como_pista_para_ligar_a_regra() {
    // Estrofe em minúsculo, com duas respirações antes de nomes reverenciais (sem pontuação antes): não há pista de verso,
    // e vale a quebra a cada respiração, e não uma linha só.
    let (silabas, respiracoes) = estrofe_com_respiracoes(
        &[
            "alfa", "beta", "Jesus", "gama", "delta", "Senhor", "eta", "teta",
        ],
        &[2, 5],
    );
    let (letra, _) = montar_letra(silabas, respiracoes);
    assert_eq!(
        letra,
        vec!["1. alfa beta", "Jesus gama delta", "Senhor eta teta"]
    );
}

#[test]
fn outros_nomes_reverenciais_tambem_continuam_o_verso() {
    let (silabas, respiracoes) = estrofe_com_respiracoes(
        &[
            "Alfa", "beta;", "Gama", "delta", "Filho", "eta;", "Teta", "iota", "Jeová", "kapa.",
        ],
        &[2, 4, 6, 8],
    );
    let (letra, _) = montar_letra(silabas, respiracoes);
    assert_eq!(
        letra,
        vec![
            "1. Alfa beta;",
            "Gama delta Filho eta;",
            "Teta iota Jeová kapa."
        ]
    );
}
