//! Testes do conversor sobre o final descartado e as ligaduras no recorte das passadas.

use crate::testes_apoio::*;

#[test]
fn final_descartado_refaz_a_letra_e_nao_deixa_aviso_do_plano() {
    // Mesma estrutura do teste acima (o último compasso tem 2 notas e o final é descartado), agora com duas estrofes e texto do final escrito
    // sob a estrofe 1 ("amém", depois da última sílaba da estrofe 2). Com o plano, esse texto virava o bloco "Final". Com o final descartado a letra
    // volta ao caminho sem plano: sem o bloco "Final" e sem o aviso "final separado".
    let ly = |v1: &str, v2: &str| {
        let a = if v1.is_empty() {
            String::new()
        } else {
            format!("<Lyrics><text>{v1}</text></Lyrics>")
        };
        let b = if v2.is_empty() {
            String::new()
        } else {
            format!("<Lyrics><no>1</no><text>{v2}</text></Lyrics>")
        };
        format!("{a}{b}")
    };
    let comp = |extra: &str, pitch: u8, v1: &str, v2: &str| {
        format!(
            "<Measure>{extra}<voice>{C44}<Chord>{}<durationType>whole</durationType><Note><pitch>{pitch}</pitch></Note></Chord></voice></Measure>",
            ly(v1, v2)
        )
    };
    let ultimo = format!(
        "<Measure><voice>{C44}<Chord><durationType>whole</durationType><Note><pitch>69</pitch></Note><Note><pitch>72</pitch></Note></Chord></voice></Measure>"
    );
    let medidas = [
        comp("<startRepeat/>", 60, "um", "UM"),
        comp("", 62, "dois", "DOIS"),
        comp(
            r#"<endRepeat>2</endRepeat><Volta id="1"><endings>2</endings></Volta>"#,
            64,
            "três",
            "",
        ),
        comp(
            r#"<endSpanner id="1"/><Volta id="2"><endings>3</endings></Volta>"#,
            65,
            "fecho",
            "BIS",
        ),
        comp(r#"<endSpanner id="2"/>"#, 67, "amém", ""),
        ultimo,
    ]
    .concat();
    // Controle: se o final fosse aceito, o texto sob a estrofe 1 viraria o bloco Final (a mesma partitura, sem o compasso de 2 notas).
    let com_final = converter(
        &doc(
            &parte(1, "S"),
            &pauta(1, &medidas.replace("<Note><pitch>72</pitch></Note>", "")),
        ),
        1,
    )
    .unwrap();
    assert!(com_final.passada_final.is_some(), "{:?}", com_final.avisos);
    assert!(
        com_final.letra.iter().any(|l| l.starts_with("Final")),
        "{:?}",
        com_final.letra
    );
    assert!(
        com_final
            .avisos
            .iter()
            .any(|a| a.contains("final separado")),
        "{:?}",
        com_final.avisos
    );

    let h = converter(&doc(&parte(1, "S"), &pauta(1, &medidas)), 1).unwrap();
    assert!(h.passada_final.is_none(), "{:?}", h.avisos);
    assert!(
        !h.avisos.iter().any(|a| a.contains("final separado")),
        "{:?}",
        h.avisos
    );
    assert!(
        !h.avisos.iter().any(|a| a.contains("(passada do final)")),
        "{:?}",
        h.avisos
    );
    assert!(
        !h.letra.iter().any(|l| l.starts_with("Final")),
        "a letra não pode ter o bloco Final sem o final: {:?}",
        h.letra
    );
    assert!(h.letra.iter().any(|l| l.contains("amém")), "{:?}", h.letra);
}

/// Compasso de uma semibreve com `extra` antes da voz e `liga` dentro da nota (`<Tie/>` abre, `<endTie/>` fecha).
fn comp_ligado(extra: &str, pitch: u8, liga: &str) -> String {
    format!(
        "<Measure>{extra}<voice>{C44}<Chord><durationType>whole</durationType><Note>{liga}<pitch>{pitch}</pitch></Note></Chord></voice></Measure>"
    )
}

/// A estrutura do hino com final, com `extra` na 1ª casa e a nota `p1` ligada do compasso antes da 1ª casa para dentro dela.
fn estrutura_com_ligadura_na_1a_casa() -> String {
    [
        comp_marcado("<startRepeat/>", 60),
        comp_ligado("", 64, "<Tie/>"),
        format!(
            r#"<Measure><endRepeat>2</endRepeat><Volta id="1"><endings>2</endings></Volta><voice>{C44}<Chord><durationType>whole</durationType><Note><endTie/><pitch>64</pitch></Note></Chord></voice></Measure>"#
        ),
        comp_ligado(
            r#"<endSpanner id="1"/><Volta id="2"><endings>3</endings></Volta>"#,
            64,
            "<Tie/>",
        ),
        comp_ligado(r#"<endSpanner id="2"/>"#, 64, "<endTie/>"),
        comp_marcado("", 69),
    ]
    .concat()
}

#[test]
fn ligadura_que_entra_na_1a_casa_nao_engole_a_nota_da_2a_casa_na_passada_do_final() {
    let h = converter(
        &doc(
            &parte(1, "S"),
            &pauta(1, &estrutura_com_ligadura_na_1a_casa()),
        ),
        1,
    )
    .unwrap();
    // Passada normal (compassos 1 a 3): a ligadura junta o 2º e o 3º compasso, numa nota de 8 batidas.
    assert_eq!(notas(&h, 0), vec![(0.0, 4.0, 60), (4.0, 8.0, 64)]);
    // Passada do final (1, 2, 4, 5, 6): a ligadura sai do 2º compasso para a 1ª casa, que não toca. A ligadura da 2ª casa para o compasso
    // seguinte (mesma altura) é outra e NÃO pode ser fechada pela ligadura cortada, que ficaria esperando e a engoliria.
    let f = h
        .passada_final
        .as_ref()
        .expect("o final deveria ser aceito");
    assert_eq!(
        notas_de(f, 0),
        vec![
            (0.0, 4.0, 60),
            (4.0, 4.0, 64),
            (8.0, 8.0, 64),
            (16.0, 4.0, 69)
        ]
    );
}

#[test]
fn cortar_ligaduras_do_segmento_mantem_as_que_continuam_dentro_do_segmento() {
    let a = |inicio: f64, notas: Vec<(u8, bool, bool)>| Acorde {
        inicio,
        dur: 1.0,
        notas,
    };
    let mut v = vec![
        a(0.0, vec![(60, false, true)]),
        a(1.0, vec![(60, true, true), (64, false, true)]),
        a(2.0, vec![(60, true, false)]),
    ];
    cortar_ligaduras_do_segmento(&mut v);
    // 60 → 60 → 60 continua; o 64 do acorde do meio não tem continuação no acorde seguinte e perde a marca.
    assert_eq!(v[0].notas, vec![(60, false, true)]);
    assert_eq!(v[1].notas, vec![(60, true, true), (64, false, false)]);
    // Última nota do segmento com marca de início: a ligadura não tem para onde ir.
    let mut u = vec![a(0.0, vec![(62, false, true)])];
    cortar_ligaduras_do_segmento(&mut u);
    assert_eq!(u[0].notas, vec![(62, false, false)]);
}

#[test]
fn mais_de_uma_repeticao_ou_um_salto_nao_reconhece_o_padrao_de_final() {
    let com = |extra_no_2: &str| {
        [
            comp_marcado("<startRepeat/>", 60),
            comp_marcado(extra_no_2, 62),
            comp_marcado(
                r#"<endRepeat>2</endRepeat><Volta id="1"><endings>2</endings></Volta>"#,
                64,
            ),
            comp_marcado(
                r#"<endSpanner id="1"/><Volta id="2"><endings>3</endings></Volta>"#,
                65,
            ),
            comp_marcado(r#"<endSpanner id="2"/>"#, 67),
            comp_marcado("", 69),
        ]
        .concat()
    };
    let ok = converter(&doc(&parte(1, "S"), &pauta(1, &com(""))), 1).unwrap();
    assert!(
        ok.passada_final.is_some(),
        "o padrão simples segue aceito: {:?}",
        ok.avisos
    );
    for (nome, extra) in [
        ("2º início de repetição", "<startRepeat/>"),
        ("2º fim de repetição", "<endRepeat>2</endRepeat>"),
        ("salto", "<Jump><jumpTo>start</jumpTo></Jump>"),
        ("marca", "<Marker><label>fine</label></Marker>"),
    ] {
        let h = converter(&doc(&parte(1, "S"), &pauta(1, &com(extra))), 1).unwrap();
        assert!(
            h.passada_final.is_none(),
            "{nome}: não deveria reconhecer o final"
        );
        assert!(
            h.avisos
                .iter()
                .any(|a| a.contains("estrutura não reconhecida")),
            "{nome}: {:?}",
            h.avisos
        );
    }
}
