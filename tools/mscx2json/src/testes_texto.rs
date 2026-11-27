//! Testes do conversor sobre o texto da letra, os nomes das partes e o formato do JSON.

use crate::testes_apoio::*;

fn letra_de(chords: &[String]) -> Vec<String> {
    let c = format!("{C44}{}", chords.concat());
    converter(&doc(&parte(1, "S"), &pauta(1, &compasso_ms2(&c, ""))), 1)
        .unwrap()
        .letra
}

#[test]
fn elisao_vira_espaco_e_nao_perde_as_letras() {
    // Elisão do MuseScore: <text>to<sym>lyricsElisionWide</sym>a</text> = "to a" numa nota só.
    let letra = letra_de(&[
        acorde_letra(60, &sil("begin", "Ba")),
        acorde_letra(62, &sil("middle", "ra")),
        acorde_letra(64, &sil("middle", "to<sym>lyricsElisionWide</sym>a")),
        acorde_letra(65, &sil("end", "li")),
    ]);
    assert_eq!(letra, vec!["1. Barato ali"]);
}

#[test]
fn numero_de_estrofe_escrito_na_primeira_silaba_nao_duplica() {
    // A primeira sílaba traz o número da estrofe: "1. Pa".
    let letra = letra_de(&[
        acorde_letra(60, &sil("", "1. Pa")),
        acorde_letra(62, &sil("", "ra,")),
        acorde_letra(64, &sil("", "meu")),
    ]);
    assert_eq!(letra, vec!["1. Pa ra, meu"]);
}

#[test]
fn duas_silabas_diferentes_no_mesmo_instante_ficam_so_a_repetida_de_outra_camada_sai() {
    // mesma camada, mesmo instante, textos diferentes: as duas ficam
    let duas = format!("{}{}", sil("", "a"), sil("", "b"));
    assert_eq!(letra_de(&[acorde_letra(60, &duas)]), vec!["1. a b"]);
    // textos diferentes em camadas diferentes no mesmo instante também ficam (não é duplicata)
    let c = format!(
        "{C44}{}<tick>0</tick><Chord><track>1</track><durationType>quarter</durationType>{}<Note><pitch>55</pitch></Note></Chord>",
        acorde_letra(60, &sil("", "a")),
        sil("", "b")
    );
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso_ms2(&c, ""))), 1).unwrap();
    assert_eq!(h.letra, vec!["1. a b"]);
}

#[test]
fn so_o_nome_de_simbolo_comum_e_ignorado_e_o_titulo_tambem_entende_elisao() {
    let m = format!(
        "<VBox>{}</VBox>",
        texto_moldura(
            "Title",
            "a<sym>lyricsElisionWide</sym>b e c<sym>fermataAbove</sym>d"
        )
    );
    let h = converter(&doc_com_moldura(&m), 1).unwrap();
    assert_eq!(h.titulo, "a b e cd"); // elisão vira espaço; outro símbolo some sem deixar o nome
}

#[test]
fn sem_numero_inicial_so_tira_numero_seguido_de_ponto() {
    assert_eq!(sem_numero_inicial("1. Pa"), "Pa");
    assert_eq!(sem_numero_inicial("  12.Pa"), "Pa");
    assert_eq!(sem_numero_inicial("1."), "");
    assert_eq!(sem_numero_inicial("Pa"), "Pa");
    assert_eq!(sem_numero_inicial("3 meu"), "3 meu"); // sem ponto: é texto
    assert_eq!(sem_numero_inicial("a1. b"), "a1. b");
}

#[test]
fn nomes_de_partes() {
    assert_eq!(nome_da_parte(&["Parte I", "II"], 1), "Parte II");
    assert_eq!(nome_da_parte(&["Parte III", "IV"], 1), "Parte IV");
    assert_eq!(nome_da_parte(&["Soprano", "Contralto"], 1), "Contralto");
}

#[test]
fn parte_i_e_ii_vira_duas_vozes_com_unissono() {
    let duas = |a: u8, b: u8| {
        format!(
            "<Chord><durationType>half</durationType><Note><pitch>{b}</pitch></Note><Note><pitch>{a}</pitch></Note></Chord>"
        )
    };
    let c = format!("{C44}{}{}", duas(60, 67), acorde("half", 65)); // 2º acorde: uníssono
    let h = converter(
        &doc(&parte(1, "Parte I e II"), &pauta(1, &compasso_ms2(&c, ""))),
        1,
    )
    .unwrap();
    let nomes: Vec<_> = h.vozes.iter().map(|v| v.nome.as_str()).collect();
    assert_eq!(nomes, vec!["Parte I", "Parte II"]);
    assert_eq!(notas(&h, 0), vec![(0.0, 2.0, 67), (2.0, 2.0, 65)]);
    assert_eq!(notas(&h, 1), vec![(0.0, 2.0, 60), (2.0, 2.0, 65)]);
}

#[test]
fn duas_pautas_e_duas_vozes_viram_vozes_separadas() {
    let partes = parte(1, "Soprano") + &parte(2, "Baixo");
    let v1 = acorde("whole", 72);
    let v2 = acorde("whole", 60);
    let s1 = pauta(
        1,
        &format!("<Measure><voice>{C44}{v1}</voice><voice>{v2}</voice></Measure>"),
    );
    let s2 = pauta(2, &compasso(&format!("{C44}{}", acorde("whole", 48))));
    let h = converter(&doc(&partes, &(s1 + &s2)), 1).unwrap();
    let nomes: Vec<_> = h.vozes.iter().map(|v| v.nome.as_str()).collect();
    assert_eq!(nomes, vec!["Soprano (1)", "Soprano (2)", "Baixo"]);
    assert_eq!(notas(&h, 0), vec![(0.0, 4.0, 72)]);
    assert_eq!(notas(&h, 1), vec![(0.0, 4.0, 60)]);
    assert_eq!(notas(&h, 2), vec![(0.0, 4.0, 48)]);
}

#[test]
fn avisa_sobre_repeticoes_e_rejeita_arquivo_errado() {
    let c = format!(
        "<Measure><startRepeat/><voice>{C44}{}</voice></Measure>",
        acorde("whole", 60)
    );
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &c)), 1).unwrap();
    assert!(h.avisos[0].contains("repetições"));
    assert!(converter("<x/>", 1).unwrap_err().contains("falta <Score>"));
    assert!(
        converter("{ não é xml", 1)
            .unwrap_err()
            .contains("XML inválido")
    );
    assert!(
        converter(&doc("", &pauta(1, &compasso(C44))), 1)
            .unwrap_err()
            .contains("nenhuma nota")
    );
}

#[test]
fn json_no_formato_do_app() {
    let c = format!("{C44}{}", acorde("whole", 60));
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso(&c))), 3).unwrap();
    let j = para_json(&h);
    assert_eq!(j["numero"], 3);
    assert_eq!(j["vozes"][0]["notas"][0], json!([0.0, 4.0, 60]));
    assert!(j.get("andamento").is_none());
}

#[test]
fn numero_vem_do_nome_do_arquivo() {
    assert_eq!(numero_do_arquivo(Path::new("x/hino-42.mscx")), Some(42));
    assert_eq!(numero_do_arquivo(Path::new("coro-1.mscx")), None);
}
