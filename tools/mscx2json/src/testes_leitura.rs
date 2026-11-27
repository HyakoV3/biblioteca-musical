//! Testes do conversor sobre a leitura das notas, das pausas, das ligaduras e das vozes do MuseScore 2.

use crate::testes_apoio::*;

#[test]
fn notas_simples_titulo_e_andamento() {
    let corpo = format!(
        "{C44}<Tempo><tempo>1.5</tempo></Tempo>{}{}{}{}",
        acorde("quarter", 72),
        acorde("quarter", 74),
        acorde("quarter", 76),
        acorde("quarter", 77)
    );
    let h = converter(&doc(&parte(1, "Soprano"), &pauta(1, &compasso(&corpo))), 7).unwrap();
    assert_eq!(
        (h.numero, h.titulo.as_str(), h.andamento),
        (7, "Título fictício", Some(90))
    );
    assert_eq!(h.vozes[0].nome, "Soprano");
    assert_eq!(
        notas(&h, 0),
        vec![
            (0.0, 1.0, 72),
            (1.0, 1.0, 74),
            (2.0, 1.0, 76),
            (3.0, 1.0, 77)
        ]
    );
}

#[test]
fn pontuada_pausa_e_segundo_compasso() {
    let c1 = format!(
        "{C44}<Chord><durationType>quarter</durationType><dots>1</dots><Note><pitch>60</pitch></Note></Chord>{}<Rest><durationType>half</durationType></Rest>",
        acorde("eighth", 62)
    );
    let c2 = acorde("whole", 64);
    let h = converter(
        &doc(&parte(1, "S"), &pauta(1, &(compasso(&c1) + &compasso(&c2)))),
        1,
    )
    .unwrap();
    assert_eq!(
        notas(&h, 0),
        vec![(0.0, 1.5, 60), (1.5, 0.5, 62), (4.0, 4.0, 64)]
    );
}

#[test]
fn pausa_de_compasso_inteiro_usa_o_tamanho_do_compasso() {
    let c1 =
        format!("{C44}<Rest><durationType>measure</durationType><duration>4/4</duration></Rest>");
    let c2 = acorde("quarter", 60);
    let h = converter(
        &doc(&parte(1, "S"), &pauta(1, &(compasso(&c1) + &compasso(&c2)))),
        1,
    )
    .unwrap();
    assert_eq!(notas(&h, 0), vec![(4.0, 1.0, 60)]);
}

#[test]
fn anacruse_com_len() {
    let c1 = format!(
        r#"<Measure len="1/4"><voice>{C44}{}</voice></Measure>"#,
        acorde("quarter", 60)
    );
    let c2 = compasso(&acorde("whole", 62));
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &(c1 + &c2))), 1).unwrap();
    assert_eq!(notas(&h, 0), vec![(0.0, 1.0, 60), (1.0, 4.0, 62)]);
}

#[test]
fn tercina_estilo_marcador_e_aninhado() {
    let tupla = "<Tuplet><normalNotes>2</normalNotes><actualNotes>3</actualNotes></Tuplet>";
    let tres = format!(
        "{}{}{}",
        acorde("eighth", 60),
        acorde("eighth", 62),
        acorde("eighth", 64)
    );
    let plano = format!("{C44}{tupla}{tres}<endTuplet/>{}", acorde("quarter", 65));
    let aninhado = format!(
        "{C44}<Tuplet><normalNotes>2</normalNotes><actualNotes>3</actualNotes>{tres}</Tuplet>{}",
        acorde("quarter", 65)
    );
    for corpo in [plano, aninhado] {
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso(&corpo))), 1).unwrap();
        let n = notas(&h, 0);
        assert!((n[1].0 - 1.0 / 3.0).abs() < 1e-3 && (n[1].1 - 1.0 / 3.0).abs() < 1e-3);
        assert!(
            (n[3].0 - 1.0).abs() < 1e-3,
            "a nota depois da tercina começa em 1: {n:?}"
        );
    }
}

#[test]
fn endspanner_de_outro_spanner_nao_encerra_a_ligadura() {
    // um glissando (id 9) fecha com <endSpanner id="9"/> numa nota de mesma altura de uma ligadura aberta (id 2): não une
    let inicio = r#"<Chord><durationType>quarter</durationType><Note><Tie id="2"></Tie><pitch>60</pitch></Note></Chord>"#;
    let outro = r#"<Chord><durationType>quarter</durationType><Note><endSpanner id="9"/><pitch>60</pitch></Note></Chord>"#;
    let c = format!("{C44}{inicio}{outro}");
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso(&c))), 1).unwrap();
    assert_eq!(notas(&h, 0), vec![(0.0, 1.0, 60), (1.0, 1.0, 60)]);
}

#[test]
fn ligadura_do_musescore_2_une_as_notas() {
    // início: <Tie id> dentro da nota; fim: <endSpanner id> dentro da nota seguinte (formato do MuseScore 2, o dos .mscx do hinário)
    let inicio = r#"<Chord><durationType>half</durationType><Note><Tie id="2"></Tie><pitch>60</pitch></Note></Chord>"#;
    let fim = r#"<Chord><durationType>quarter</durationType><Note><endSpanner id="2"/><pitch>60</pitch></Note></Chord>"#;
    let c = format!("{C44}{inicio}{fim}{}", acorde("quarter", 62));
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso(&c))), 1).unwrap();
    assert_eq!(notas(&h, 0), vec![(0.0, 3.0, 60), (3.0, 1.0, 62)]);
}

#[test]
fn ligadura_une_as_notas() {
    let inicio = r#"<Chord><durationType>half</durationType><Note><Spanner type="Tie"><Tie/><next><location><fractions>1/2</fractions></location></next></Spanner><pitch>60</pitch></Note></Chord>"#;
    let fim = r#"<Chord><durationType>quarter</durationType><Note><Spanner type="Tie"><prev><location><fractions>-1/2</fractions></location></prev></Spanner><pitch>60</pitch></Note></Chord>"#;
    let c = format!("{C44}{inicio}{fim}{}", acorde("quarter", 62));
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso(&c))), 1).unwrap();
    assert_eq!(notas(&h, 0), vec![(0.0, 3.0, 60), (3.0, 1.0, 62)]);
}

#[test]
fn acorde_com_duas_notas_e_apojatura_ignorada() {
    let ac = "<Chord><durationType>half</durationType><Note><pitch>64</pitch></Note><Note><pitch>60</pitch></Note></Chord>";
    let graca = "<Chord><acciaccatura/><durationType>eighth</durationType><Note><pitch>70</pitch></Note></Chord>";
    let c = format!("{C44}{graca}{ac}");
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso(&c))), 1).unwrap();
    // A nota mais aguda vira a primeira voz, a mais grave a segunda.
    let nomes: Vec<_> = h.vozes.iter().map(|v| v.nome.as_str()).collect();
    assert_eq!(nomes, vec!["S (1)", "S (2)"]);
    assert_eq!(notas(&h, 0), vec![(0.0, 2.0, 64)]);
    assert_eq!(notas(&h, 1), vec![(0.0, 2.0, 60)]);
}

#[test]
fn musescore_2_voz_solta_no_compasso() {
    let corpo = format!(
        "{C44}<Tempo><tempo>1</tempo></Tempo>{}{}",
        acorde("half", 60),
        acorde("half", 62)
    );
    let extra = format!("<voice>{}</voice>", acorde("whole", 55));
    let h = converter(
        &doc(&parte(1, "S"), &pauta(1, &compasso_ms2(&corpo, &extra))),
        1,
    )
    .unwrap();
    assert_eq!(h.andamento, Some(60));
    let nomes: Vec<_> = h.vozes.iter().map(|v| v.nome.as_str()).collect();
    assert_eq!(nomes, vec!["S (1)", "S (2)"]);
    assert_eq!(notas(&h, 0), vec![(0.0, 2.0, 60), (2.0, 2.0, 62)]);
    assert_eq!(notas(&h, 1), vec![(0.0, 4.0, 55)]); // nota longa continua uma só
}

#[test]
fn musescore_2_vozes_soltas_com_tick_e_track() {
    // Voz 1: duas mínimas. Depois <tick>0 e a voz 2 (track 1): semibreve.
    // Em seguida <tick>960 (batida 2) e a voz 3 (track 2): mínima.
    let corpo = format!(
        "{C44}{}{}<tick>0</tick><Chord><track>1</track><durationType>whole</durationType><Note><pitch>55</pitch></Note></Chord>\
         <tick>960</tick><Chord><track>2</track><durationType>half</durationType><Note><pitch>48</pitch></Note></Chord>",
        acorde("half", 60),
        acorde("half", 62)
    );
    let h = converter(
        &doc(&parte(1, "S"), &pauta(1, &compasso_ms2(&corpo, ""))),
        1,
    )
    .unwrap();
    let nomes: Vec<_> = h.vozes.iter().map(|v| v.nome.as_str()).collect();
    assert_eq!(nomes, vec!["S (1)", "S (2)", "S (3)"]);
    assert_eq!(notas(&h, 0), vec![(0.0, 2.0, 60), (2.0, 2.0, 62)]);
    assert_eq!(notas(&h, 1), vec![(0.0, 4.0, 55)]);
    // Entre 0 e 2 só soam duas notas: a 3ª voz repete a última (uníssono).
    assert_eq!(notas(&h, 2), vec![(0.0, 2.0, 55), (2.0, 2.0, 48)]);
}

#[test]
fn limita_vozes_ao_nome_da_pauta_e_avisa() {
    let tres = "<Chord><durationType>whole</durationType><Note><pitch>60</pitch></Note><Note><pitch>64</pitch></Note><Note><pitch>67</pitch></Note></Chord>";
    let c = format!("{C44}{tres}");
    let h = converter(
        &doc(&parte(1, "Parte I e II"), &pauta(1, &compasso_ms2(&c, ""))),
        1,
    )
    .unwrap();
    let nomes: Vec<_> = h.vozes.iter().map(|v| v.nome.as_str()).collect();
    assert_eq!(nomes, vec!["Parte I", "Parte II"]);
    assert_eq!(notas(&h, 0), vec![(0.0, 4.0, 67)]); // mais aguda
    assert_eq!(notas(&h, 1), vec![(0.0, 4.0, 60)]); // mais grave
    assert!(
        h.avisos
            .iter()
            .any(|a| a.contains("notas do meio omitidas")),
        "{:?}",
        h.avisos
    );
}

#[test]
fn letra_por_estrofe_com_silabas_e_quebra_na_respiracao() {
    let ac = |sil: &[(&str, Option<u32>, &str)], pitch: u8| {
        let ls: String = sil
            .iter()
            .map(|(sy, no, t)| {
                let no = no.map(|n| format!("<no>{n}</no>")).unwrap_or_default();
                let sy = if sy.is_empty() {
                    String::new()
                } else {
                    format!("<syllabic>{sy}</syllabic>")
                };
                format!("<Lyrics>{no}{sy}<text>{t}</text></Lyrics>")
            })
            .collect();
        format!(
            "<Chord><durationType>quarter</durationType>{ls}<Note><pitch>{pitch}</pitch></Note></Chord>"
        )
    };
    let c = format!(
        "{C44}{}{}<Breath/>{}",
        ac(&[("begin", None, "ba"), ("", Some(1), "la")], 60),
        ac(&[("end", None, "la"), ("", Some(1), "lá")], 62),
        ac(&[("", None, "um"), ("", Some(1), "dois")], 64),
    );
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso_ms2(&c, ""))), 1).unwrap();
    assert_eq!(h.letra, vec!["1. bala", "um", "", "2. la lá", "dois"]);
    assert!(para_json(&h)["letra"].is_array());
}

#[test]
fn letra_segue_o_tempo_e_nao_a_ordem_no_arquivo() {
    // Voz 1: pausa de mínima e, na batida 2, "c". Depois <tick>0 e a camada 2 traz "a" (t=0)
    // e "b" (t=1): no arquivo vêm DEPOIS de "c", mas no tempo vêm antes.
    let l = |t: &str| format!("<Lyrics><text>{t}</text></Lyrics>");
    let ch = |t: &str, p: u8, extra: &str| {
        format!(
            "<Chord>{extra}<durationType>quarter</durationType>{}<Note><pitch>{p}</pitch></Note></Chord>",
            l(t)
        )
    };
    let c = format!(
        "{C44}<Rest><durationType>half</durationType></Rest>{}<tick>0</tick>{}{}",
        ch("c", 60, ""),
        ch("a", 62, "<track>1</track>"),
        ch("b", 64, "<track>1</track>"),
    );
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso_ms2(&c, ""))), 1).unwrap();
    assert_eq!(h.letra, vec!["1. a b c"]);
}
