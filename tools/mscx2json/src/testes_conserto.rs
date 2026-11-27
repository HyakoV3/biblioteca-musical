//! Testes do conversor sobre o final com plano, as correções do arquivo e o conserto das sílabas.

use crate::testes_apoio::*;

#[test]
fn correcoes_do_arquivo_valem_na_conversao_e_viram_avisos() {
    // "al" + "fa" sem marcador de continuação, "bta" digitado errado, e dois versos colados (sem respiração) em "Gama".
    let c = format!(
        "{C44}{}{}{}{}{}",
        acorde_letra(60, &sil("", "al")),
        acorde_letra(62, &sil("", "fa")),
        acorde_letra(64, &sil("", "bta.")),
        acorde_letra(65, &sil("", "Gama")),
        acorde_letra(67, &sil("", "delta")),
    );
    let xml = doc(&parte(1, "S"), &pauta(1, &compasso_ms2(&c, "")));
    let texto = r#"{ "hinos": { "1": [
        { "estrofe": 1, "juntar": "al fa" },
        { "estrofe": 1, "trocar": "bta.", "por": "beta." },
        { "estrofe": 1, "quebrar_antes": "Gama delta" } ] } }"#;
    let c = correcoes::ler(texto).unwrap();
    let h = converter_com(&xml, 1, &c[&1]).unwrap();
    assert_eq!(h.letra, vec!["1. alfa beta.", "Gama delta"]);
    let aplicadas = h
        .avisos
        .iter()
        .filter(|a| a.contains("correção aplicada"))
        .count();
    assert_eq!(aplicadas, 3, "{:?}", h.avisos);
    // Sem o arquivo, o texto fica como o autor escreveu.
    let sem = converter(&xml, 1).unwrap();
    assert_eq!(sem.letra, vec!["1. al fa bta. Gama delta"]);
}

#[test]
fn correcoes_de_um_hino_sem_letra_avisam_em_vez_de_sumir() {
    // Partitura sem <Lyrics>: nenhuma correção pode ser tentada, e o responsável tem de saber.
    let c =
        correcoes::ler(r#"{ "hinos": { "1": [ { "estrofe": 1, "juntar": "al fa" } ] } }"#).unwrap();
    let h = converter_com(&hino_com_final(), 1, &c[&1]).unwrap();
    assert!(h.letra.is_empty());
    assert!(
        h.avisos
            .iter()
            .any(|a| a.contains("NÃO aplicada") && a.contains("não tem letra")),
        "{:?}",
        h.avisos
    );
    // Sem correções listadas, nada a avisar.
    let sem = converter_com(&hino_com_final(), 1, &[]).unwrap();
    assert!(
        !sem.avisos.iter().any(|a| a.contains("correç")),
        "{:?}",
        sem.avisos
    );
}

#[test]
fn correcoes_sem_o_caminho_do_arquivo_e_erro() {
    let args = ["--id", "x", "--nome", "y", "--correcoes"]
        .map(String::from)
        .to_vec();
    let e = executar(args).unwrap_err();
    assert!(e.contains("--correcoes precisa do caminho"), "{e}");
}

#[test]
fn uma_unica_maiuscula_nao_basta_para_ligar_a_regra() {
    let (silabas, respiracoes) =
        estrofe_com_respiracoes(&["alfa", "beta", "Gama", "delta", "eta", "teta"], &[2, 4]);
    let (letra, _) = montar_letra(silabas, respiracoes);
    assert_eq!(letra, vec!["1. alfa beta", "Gama delta", "eta teta"]);
}

#[test]
fn as_marcas_do_karaoke_continuam_batendo_com_o_texto_da_linha() {
    // A sincronia aponta para posições dentro da linha pronta: se uma respiração deixa de quebrar, as posições seguem certas.
    let (silabas, respiracoes) = estrofe_com_respiracoes(
        &[
            "Alfa", "beta", "gama", "delta;", "Épsilon", "zeta", "eta", "teta.", "Iota", "kapa",
        ],
        &[2, 4, 6, 8],
    );
    let textos: Vec<String> = silabas.iter().map(|x| x.texto.clone()).collect();
    let (letra, marcas) = montar_letra(silabas, respiracoes);
    let linhas: Vec<String> = letra
        .iter()
        .enumerate()
        .map(|(i, l)| {
            if i == 0 {
                l.trim_start_matches("1. ").to_string()
            } else {
                l.clone()
            }
        })
        .collect();
    assert_eq!(marcas.len(), textos.len());
    for (m, esperado) in marcas.iter().zip(&textos) {
        let utf16: Vec<u16> = linhas[m.linha].encode_utf16().collect();
        assert_eq!(
            &String::from_utf16(&utf16[m.de..m.ate]).unwrap(),
            esperado,
            "marca {m:?}"
        );
    }
}

#[test]
fn pronome_colado_ao_verbo_acentuado_ganha_hifen() {
    // "cantá" + "lo": o autor esqueceu o hífen; "I" maiúsculo no lugar de "l" também é consertado.
    let silabas = vec![
        silaba_de(0.0, "can", true),
        silaba_de(1.0, "tá", true),
        silaba_de(2.0, "lo,", false),
        silaba_de(3.0, "dê", true),
        silaba_de(4.0, "Ihe", false),
        silaba_de(5.0, "ba", true),
        silaba_de(6.0, "la.", false),
    ];
    let (letra, _) = montar_letra(silabas, vec![]);
    // "ba" + "la" não é pronome: "ba" não termina em vogal acentuada.
    assert_eq!(letra, vec!["1. cantá-lo, dê-lhe bala."]);
}

#[test]
fn palavra_com_la_ou_lo_final_sem_acento_antes_nao_ganha_hifen() {
    let silabas = vec![
        silaba_de(0.0, "es", true),
        silaba_de(1.0, "tre", true),
        silaba_de(2.0, "la", false),
        silaba_de(3.0, "só", false),
        silaba_de(4.0, "lo", false),
    ];
    let (letra, _) = montar_letra(silabas, vec![]);
    // "só" e "lo" são duas palavras (a primeira não continua): sem hífen.
    assert_eq!(letra, vec!["1. estrela só lo"]);
}

#[test]
fn til_literal_vira_espaco_e_o_que_e_ambiguo_fica_como_esta() {
    // "~" literal é a elisão: vira espaço. Já "mãc" poderia ser "mão" ou "mãe" e "Iba" no meio da palavra, "lba" ou "iba":
    // sem uma só leitura possível, o conversor não adivinha (isso é com o arquivo de correções).
    let silabas = vec![
        silaba_de(0.0, "a,~al", false),
        silaba_de(1.0, "mãc", false),
        silaba_de(2.0, "ca", true),
        silaba_de(3.0, "Iba", false),
    ];
    let (letra, _) = montar_letra(silabas, vec![]);
    assert_eq!(letra, vec!["1. a, al mãc caIba"]);
}

#[test]
fn as_marcas_seguem_o_texto_corrigido() {
    let silabas = vec![
        silaba_de(0.0, "can", true),
        silaba_de(1.0, "tá", true),
        silaba_de(2.0, "lo", false),
    ];
    let (letra, marcas) = montar_letra(silabas, vec![]);
    assert_eq!(letra, vec!["1. cantá-lo"]);
    let u: Vec<u16> = "cantá-lo".encode_utf16().collect();
    assert_eq!(
        marcas
            .last()
            .map(|m| String::from_utf16(&u[m.de..m.ate]).unwrap()),
        Some("-lo".to_string())
    );
}

#[test]
fn letra_duplicada_em_duas_camadas_vale_uma_vez() {
    let l = |t: &str| format!("<Lyrics><text>{t}</text></Lyrics>");
    let ch = |t: &str, p: u8, extra: &str| {
        format!(
            "<Chord>{extra}<durationType>quarter</durationType>{}<Note><pitch>{p}</pitch></Note></Chord>",
            l(t)
        )
    };
    let c = format!(
        "{C44}{}<tick>0</tick>{}",
        ch("la", 60, ""),
        ch("la", 55, "<track>1</track>")
    );
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso_ms2(&c, ""))), 1).unwrap();
    assert_eq!(h.letra, vec!["1. la"]);
}
