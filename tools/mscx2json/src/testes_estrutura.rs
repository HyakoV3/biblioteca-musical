//! Testes do conversor sobre o plano de repetição, o final e a introdução.

use crate::testes_apoio::*;

#[test]
fn introducao_inclui_a_nota_que_leva_o_asterisco() {
    let h = converter(&hino_com_asterisco(), 1).unwrap();
    // O "*" está sobre a 2ª mínima do compasso 2 (começa em 6): a introdução vai até o FIM dela, 6 + 2 = 8 batidas.
    let intro = h.introducao.as_ref().expect("deveria ter introdução");
    assert_eq!(
        notas_de(intro, 0),
        vec![(0.0, 4.0, 60), (4.0, 2.0, 62), (6.0, 2.0, 64)]
    );
    // A passada normal continua inteira.
    assert_eq!(notas(&h, 0).len(), 3);
    assert!(
        h.avisos
            .iter()
            .any(|a| a.contains("introdução") && a.contains("8")),
        "{:?}",
        h.avisos
    );
    let json = para_json(&h);
    assert_eq!(
        json["introducao"]["vozes"][0]["notas"],
        json!([[0.0, 4.0, 60], [4.0, 2.0, 62], [6.0, 2.0, 64]])
    );
}

/// O caso de 413 dos 480 hinos do Dó: "*", a última nota da introdução e a respiração que a fecha; depois a música continua.
#[test]
fn introducao_termina_junto_da_respiracao_e_nao_corta_a_ultima_nota() {
    let marca = "<StaffText><text>*</text></StaffText>";
    let m = format!(
        "<Measure><voice>{C44}{}{marca}{}<Breath/>{}</voice></Measure>",
        acorde("half", 62),
        acorde("quarter", 64),
        acorde("quarter", 65)
    );
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &m)), 1).unwrap();
    // 62 (0 a 2), "*" sobre o 64 (2 a 3), respiração aos 3 e o 65 já é da música.
    assert_eq!(
        notas_de(h.introducao.as_ref().expect("introdução"), 0),
        vec![(0.0, 2.0, 62), (2.0, 1.0, 64)]
    );
}

#[test]
fn asterisco_sobre_uma_pausa_vai_ate_o_fim_dela() {
    let marca = "<StaffText><text>*</text></StaffText>";
    let m = format!(
        "<Measure><voice>{C44}{}{marca}<Rest><durationType>quarter</durationType></Rest>{}</voice></Measure>",
        acorde("half", 62),
        acorde("quarter", 64)
    );
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &m)), 1).unwrap();
    // a pausa (2 a 3) entra na introdução, mas não tem nota: só o 62 aparece, e o 64 (em 3) fica de fora
    assert_eq!(
        notas_de(h.introducao.as_ref().expect("introdução"), 0),
        vec![(0.0, 2.0, 62)]
    );
    assert!(
        h.avisos
            .iter()
            .any(|a| a.contains("introdução") && a.contains("3")),
        "{:?}",
        h.avisos
    );
}

/// Revisão do Vandame (#89): um texto de pauta e uma cifra "*" antes da mesma nota fecham os dois no fim dela; nenhum fica com o começo da nota.
#[test]
fn dois_asteriscos_antes_da_mesma_nota_fecham_os_dois() {
    let m = format!(
        "<Measure><voice>{C44}{}<StaffText><text>*</text></StaffText><Harmony><name>*</name></Harmony>{}<Breath/>{}</voice></Measure>",
        acorde("half", 62),
        acorde("quarter", 64),
        acorde("quarter", 65)
    );
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &m)), 1).unwrap();
    assert_eq!(
        notas_de(h.introducao.as_ref().expect("introdução"), 0),
        vec![(0.0, 2.0, 62), (2.0, 1.0, 64)]
    );
}

/// Como no hino 250: o "*" vem depois de uma pausa invisível, um `tick` leva o tempo adiante e só então vem a respiração. A introdução termina na
/// respiração, e não no "*" (que fica antes dela). O `tick` só vale na leitura por plano, então a regra é testada direto.
#[test]
fn respiracao_depois_do_asterisco_fecha_a_introducao_nela() {
    let mut asteriscos = vec![11.0, 20.0];
    let mut pendentes = vec![0usize, 1];
    fecha_asteriscos_na_respiracao(&mut asteriscos, &mut pendentes, 12.0);
    // o "*" de 11 fecha na respiração (12); o de 20 ainda é do futuro e continua esperando a sua nota
    assert_eq!(asteriscos, vec![12.0, 20.0]);
    assert_eq!(pendentes, vec![1]);
}

#[test]
fn asterisco_logo_antes_da_respiracao_termina_onde_ela_esta() {
    let marca = "<StaffText><text>*</text></StaffText>";
    let m = format!(
        "<Measure><voice>{C44}{}{marca}<Breath/>{}</voice></Measure>",
        acorde("half", 62),
        acorde("half", 64)
    );
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &m)), 1).unwrap();
    assert_eq!(
        notas_de(h.introducao.as_ref().expect("introdução"), 0),
        vec![(0.0, 2.0, 62)]
    );
}

#[test]
fn asterisco_como_cifra_harmony_tambem_vale() {
    let marca = "<Harmony><name>*</name></Harmony>";
    let m = format!(
        "<Measure><voice>{C44}{}{marca}{}</voice></Measure>",
        acorde("half", 62),
        acorde("half", 64)
    );
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &m)), 1).unwrap();
    assert_eq!(
        notas_de(h.introducao.as_ref().expect("deveria ter introdução"), 0),
        vec![(0.0, 2.0, 62), (2.0, 2.0, 64)]
    );
}

#[test]
fn sem_asterisco_nao_ha_introducao() {
    let h = converter(&hino_com_final(), 1).unwrap();
    assert!(h.introducao.is_none());
    assert!(para_json(&h).get("introducao").is_none());
}

#[test]
fn recortar_inicio_encurta_a_nota_que_atravessa_o_corte() {
    let v = |notas: Vec<(f64, f64, u8)>| Voz {
        nome: "S".into(),
        notas: notas
            .into_iter()
            .map(|(inicio, dur, midi)| Evento { inicio, dur, midi })
            .collect(),
    };
    let r = recortar_inicio(
        &[v(vec![(0.0, 3.0, 60), (2.0, 4.0, 62), (5.0, 1.0, 64)])],
        5.0,
    )
    .unwrap();
    assert_eq!(notas_de(&r, 0), vec![(0.0, 3.0, 60), (2.0, 3.0, 62)]);
    // sem nenhuma nota antes do corte não há introdução
    assert!(recortar_inicio(&[v(vec![(6.0, 1.0, 60)])], 5.0).is_none());
}

#[test]
fn nomes_satb_tambem_vale_para_a_introducao() {
    let voz = |n: &str| Voz {
        nome: n.to_string(),
        notas: vec![],
    };
    let mut h = converter(&hino_com_asterisco(), 1).unwrap();
    h.vozes = vec![voz("Parte I")];
    h.introducao = Some(vec![voz("Parte I")]);
    nomes_satb(&mut h);
    assert_eq!(h.vozes[0].nome, "Soprano");
    assert_eq!(h.introducao.unwrap()[0].nome, "Soprano");
}

#[test]
fn reconhece_o_padrao_de_final_e_gera_as_duas_passadas() {
    let h = converter(&hino_com_final(), 1).unwrap();
    // Passada normal: compassos 1 a 3 (até o fim da 1ª casa).
    assert_eq!(
        notas(&h, 0),
        vec![(0.0, 4.0, 60), (4.0, 4.0, 62), (8.0, 4.0, 64)]
    );
    // Passada do final: 1 e 2, pula a 1ª casa (3), toca a 2ª casa (4) e o trecho final (5 e 6),
    // sem buracos no tempo.
    let f = h
        .passada_final
        .as_ref()
        .expect("deveria ter passada do final");
    assert_eq!(
        notas_de(f, 0),
        vec![
            (0.0, 4.0, 60),
            (4.0, 4.0, 62),
            (8.0, 4.0, 65),
            (12.0, 4.0, 67),
            (16.0, 4.0, 69)
        ]
    );
    assert!(
        h.avisos
            .iter()
            .any(|a| a.contains("estrutura de repetição reconhecida")),
        "{:?}",
        h.avisos
    );
    assert!(!h.avisos.iter().any(|a| a.contains("não reconhecida")));
}

#[test]
fn passada_final_vai_para_o_json_e_mantem_as_vozes_na_mesma_ordem() {
    let h = converter(&hino_com_final(), 1).unwrap();
    let j = para_json(&h);
    assert_eq!(j["vozes"][0]["notas"].as_array().unwrap().len(), 3);
    assert_eq!(j["final"]["vozes"][0]["notas"].as_array().unwrap().len(), 5);
    assert_eq!(j["final"]["vozes"][0]["nome"], j["vozes"][0]["nome"]);
}

#[test]
fn hino_sem_repeticao_nao_tem_passada_final() {
    let c = format!("{C44}{}", acorde("whole", 60));
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso(&c))), 1).unwrap();
    assert!(h.passada_final.is_none());
    assert!(para_json(&h).get("final").is_none());
}

#[test]
fn estrutura_nao_reconhecida_le_em_ordem_e_avisa_em_vez_de_adivinhar() {
    // Só fim de repetição, sem casas de volta: não é o padrão confirmado.
    let medidas = [
        comp_marcado("<startRepeat/>", 60),
        comp_marcado("<endRepeat>2</endRepeat>", 62),
        comp_marcado("", 64),
    ]
    .concat();
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &medidas)), 1).unwrap();
    assert!(h.passada_final.is_none());
    assert_eq!(notas(&h, 0).len(), 3); // lido uma vez, em ordem
    assert!(
        h.avisos.iter().any(|a| a.contains("não reconhecida")),
        "{:?}",
        h.avisos
    );

    // Três casas de volta também não é o padrão confirmado.
    let tres = [
        comp_marcado(r#"<startRepeat/><Volta id="1"><endings>1</endings></Volta>"#, 60),
        comp_marcado(r#"<endSpanner id="1"/><endRepeat>2</endRepeat><Volta id="2"><endings>2</endings></Volta>"#, 62),
        comp_marcado(r#"<endSpanner id="2"/><Volta id="3"><endings>3</endings></Volta>"#, 64),
        comp_marcado(r#"<endSpanner id="3"/>"#, 65),
    ]
    .concat();
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &tres)), 1).unwrap();
    assert!(h.passada_final.is_none());
}
