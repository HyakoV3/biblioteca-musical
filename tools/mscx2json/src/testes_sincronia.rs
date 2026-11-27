//! Testes do conversor sobre a sincronia da letra, os nomes das partes e o título e a autoria.

use crate::testes_apoio::*;

/// Compasso de uma semibreve com uma sílaba (estrofe 1) na nota, para os testes da sincronia.
fn comp_com_silaba(extra: &str, pitch: u8, silaba: &str) -> String {
    format!(
        "<Measure>{extra}<voice>{C44}<Chord><durationType>whole</durationType><Lyrics><text>{silaba}</text></Lyrics>\
         <Note><pitch>{pitch}</pitch></Note></Chord></voice></Measure>"
    )
}

#[test]
fn sincronia_marca_a_posicao_na_linha_e_o_instante_de_cada_silaba() {
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
    let s = h.sincronia.expect("deveria ter sincronia");
    assert!(s.passada_final.is_none());
    // Estrofe 1: "bala" (ba=0..2 em t0, la=2..4 em t1) e "um" na linha seguinte (t2).
    assert_eq!(s.normal[0].estrofe, 1);
    assert_eq!(
        s.normal[0].linhas,
        vec![vec![(0.0, 0, 2), (1.0, 2, 4)], vec![(2.0, 0, 2)]]
    );
    // Estrofe 2: "la lá" (a posição do "lá" conta o espaço: 3..5) e "dois".
    assert_eq!(s.normal[1].estrofe, 2);
    assert_eq!(
        s.normal[1].linhas,
        vec![vec![(0.0, 0, 2), (1.0, 3, 5)], vec![(2.0, 0, 4)]]
    );
}

#[test]
fn sincronia_da_passada_do_final_pula_a_1a_casa_e_fica_sem_buracos() {
    // Mesma estrutura do hino com final (6 compassos): normal = 1 a 3; final = 1, 2, 4, 5 e 6.
    let medidas = [
        comp_com_silaba("<startRepeat/>", 60, "a"),
        comp_com_silaba("", 62, "b"),
        comp_com_silaba(
            r#"<endRepeat>2</endRepeat><Volta id="1"><endings>2</endings></Volta>"#,
            64,
            "c",
        ),
        comp_com_silaba(
            r#"<endSpanner id="1"/><Volta id="2"><endings>3</endings></Volta>"#,
            65,
            "d",
        ),
        comp_com_silaba(r#"<endSpanner id="2"/>"#, 67, "e"),
        comp_com_silaba("", 69, "f"),
    ]
    .concat();
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &medidas)), 1).unwrap();
    assert_eq!(h.letra, vec!["1. a b c d e f"]);
    let s = h.sincronia.expect("deveria ter sincronia");
    // Passada normal: só a, b, c (compassos 1 a 3), nos tempos da partitura.
    assert_eq!(
        s.normal[0].linhas,
        vec![vec![(0.0, 0, 1), (4.0, 2, 3), (8.0, 4, 5)]]
    );
    // Passada do final: "c" (1ª casa) não toca; d, e, f entram no lugar dele, colados, na régua das notas do final.
    let f = s.passada_final.expect("deveria ter sincronia do final");
    assert_eq!(
        f[0].linhas,
        vec![vec![
            (0.0, 0, 1),
            (4.0, 2, 3),
            (8.0, 6, 7),
            (12.0, 8, 9),
            (16.0, 10, 11)
        ]]
    );
    // Confere com as notas do final: o "d" cai na nota de 8 batidas (pitch 65), como a sílaba.
    let nf = h.passada_final.as_ref().unwrap();
    assert!(nf[0].notas.iter().any(|n| n.inicio == 8.0 && n.midi == 65));
}

#[test]
fn sincronia_vai_para_o_json_e_some_sem_letra() {
    let medidas = [comp_com_silaba("", 60, "la"), comp_com_silaba("", 62, "lá")].concat();
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &medidas)), 1).unwrap();
    let j = para_json(&h);
    assert_eq!(j["sincronia"]["normal"][0]["estrofe"], 1);
    assert_eq!(
        j["sincronia"]["normal"][0]["linhas"][0],
        json!([[0.0, 0, 2], [4.0, 3, 5]])
    );
    assert!(
        j["sincronia"].get("final").is_none(),
        "sem final, sem sincronia do final"
    );

    let c = format!("{C44}{}", acorde("whole", 60));
    let sem = converter(&doc(&parte(1, "S"), &pauta(1, &compasso(&c))), 1).unwrap();
    assert!(sem.sincronia.is_none() && para_json(&sem).get("sincronia").is_none());
}

#[test]
fn sem_letra_nao_gera_campo() {
    let c = format!("{C44}{}", acorde("whole", 60));
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso(&c))), 1).unwrap();
    assert!(h.letra.is_empty() && para_json(&h).get("letra").is_none());
}

#[test]
fn renomeia_partes_para_vozes_do_coro() {
    let mut h = Hino {
        numero: 1,
        titulo: "T".into(),
        autoria: None,
        passada_final: None,
        introducao: None,
        andamento: None,
        armadura: 0,
        modo: "maior",
        vozes: ["Parte I", "Parte II", "Parte III", "Parte IV", "Outra"]
            .iter()
            .map(|n| Voz {
                nome: n.to_string(),
                notas: vec![],
            })
            .collect(),
        letra: vec![],
        sincronia: None,
        compassos: None,
        avisos: vec![],
    };
    nomes_satb(&mut h);
    let nomes: Vec<_> = h.vozes.iter().map(|v| v.nome.as_str()).collect();
    assert_eq!(
        nomes,
        vec!["Soprano", "Contralto", "Tenor", "Baixo", "Outra"]
    );
}

#[test]
fn titulo_e_autoria_vem_dos_textos_de_moldura() {
    let moldura = format!(
        "<VBox>{}{}{}</VBox>",
        texto_moldura("Title", "Título real"),
        texto_moldura("Composer", "Fulana de Tal"),
        texto_moldura("Instrument Name (Part)", "7"),
    );
    let h = converter(&doc_com_moldura(&moldura), 7).unwrap();
    assert_eq!(h.titulo, "Título real");
    assert_eq!(h.autoria.as_deref(), Some("Fulana de Tal"));
    assert_eq!(para_json(&h)["autoria"], "Fulana de Tal");
}

#[test]
fn sem_moldura_o_titulo_cai_no_metadado_e_depois_em_hino_n() {
    // doc() traz <metaTag name="workTitle">Título fictício</metaTag>
    let c = format!("{C44}{}", acorde("whole", 60));
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso(&c))), 1).unwrap();
    assert_eq!(h.titulo, "Título fictício");
    assert_eq!(h.autoria, None);
    assert!(para_json(&h).get("autoria").is_none());

    let h = converter(&doc_com_moldura(""), 5).unwrap();
    assert_eq!(h.titulo, "Hino 5");
}

#[test]
fn autoria_junta_letrista_e_compositor_sem_repetir() {
    let m = format!(
        "<VBox>{}{}{}</VBox>",
        texto_moldura("Composer", "B"),
        texto_moldura("Lyricist", "A"),
        texto_moldura("Composer", "B"),
    );
    let h = converter(&doc_com_moldura(&m), 1).unwrap();
    assert_eq!(h.autoria.as_deref(), Some("A · B")); // letrista primeiro, sem repetir

    let m = format!(
        "<VBox>{}{}</VBox>",
        texto_moldura("Lyricist", "A"),
        texto_moldura("Composer", "A")
    );
    let h = converter(&doc_com_moldura(&m), 1).unwrap();
    assert_eq!(h.autoria.as_deref(), Some("A")); // mesma pessoa nos dois papéis
}

#[test]
fn titulo_com_formatacao_e_espacos_repetidos_sai_limpo() {
    let m = format!(
        "<VBox>{}</VBox>",
        texto_moldura("Title", "Canta, <i>ó</i>   Mundo\n  Hoje")
    );
    let h = converter(&doc_com_moldura(&m), 1).unwrap();
    assert_eq!(h.titulo, "Canta, ó Mundo Hoje");
}

#[test]
fn cabecalho_so_leva_idioma_quando_informado() {
    assert_eq!(
        cabecalho("a", "A", Some("pt-BR")),
        json!({"id":"a","nome":"A","idioma":"pt-BR"})
    );
    assert_eq!(cabecalho("a", "A", None), json!({"id":"a","nome":"A"}));
    assert_eq!(
        cabecalho("a", "A", Some("  ")),
        json!({"id":"a","nome":"A"})
    );
}
