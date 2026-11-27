//! Testes do conversor sobre os compassos de cada fluxo de notas.

use crate::testes_apoio::*;

// ---- Compassos de cada fluxo (I-12, fase B: destacar o compasso na partitura) ----

/// Onde as notas de cada compasso caem na régua do fluxo: para cada compasso listado, a nota que começa no instante dele tem de ser a do
/// compasso certo (cada compasso dos hinos de teste tem uma altura própria, que o índice do compasso identifica).
fn altura_do_compasso(i: usize) -> u8 {
    [60, 62, 64, 65, 67, 69][i]
}

#[test]
fn sem_repeticao_cada_compasso_da_partitura_entra_uma_vez_e_em_ordem() {
    let h = converter(&hino_com_asterisco(), 1).unwrap();
    let c = h.compassos.expect("deveria ter compassos");
    assert_eq!(c.normal, vec![(0.0, 0), (4.0, 1)]);
    assert!(
        c.passada_final.is_none(),
        "sem final, sem compassos do final"
    );
}

#[test]
fn introducao_inclui_o_compasso_que_contem_o_asterisco() {
    // O "*" está no meio do compasso 2 (a 6 batidas): o compasso 2 começa antes dele e entra.
    let h = converter(&hino_com_asterisco(), 1).unwrap();
    let c = h.compassos.unwrap();
    assert_eq!(c.introducao, Some(vec![(0.0, 0), (4.0, 1)]));
}

#[test]
fn introducao_que_termina_no_fim_de_um_compasso_nao_inclui_o_seguinte() {
    let marca = "<StaffText><text>*</text></StaffText>";
    let m1 = format!(
        "<Measure><voice>{C44}{}{marca}</voice></Measure>",
        acorde("whole", 60)
    );
    let m2 = comp_marcado("", 62);
    let m3 = comp_marcado("", 64);
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &[m1, m2, m3].concat())), 1).unwrap();
    // o "*" fica no fim do compasso 1 (4 batidas): o compasso 2 começa EM 4, e não antes, então não é da introdução
    let c = h.compassos.unwrap();
    assert_eq!(c.introducao, Some(vec![(0.0, 0)]));
    assert_eq!(c.normal, vec![(0.0, 0), (4.0, 1), (8.0, 2)]);
}

#[test]
fn sem_asterisco_nao_ha_compassos_da_introducao() {
    let h = converter(&hino_com_final(), 1).unwrap();
    assert!(h.compassos.unwrap().introducao.is_none());
}

#[test]
fn com_final_a_passada_normal_e_a_do_final_seguem_o_plano_de_repeticao() {
    let h = converter(&hino_com_final(), 1).unwrap();
    let c = h.compassos.expect("deveria ter compassos");
    // normal: compassos 0, 1 e 2 (até o fim da 1ª casa); final: 0 e 1, pula a 1ª casa (2) e segue com 3, 4 e 5. Os instantes são os da régua
    // de cada passada (4 batidas por compasso, sem buracos).
    assert_eq!(c.normal, vec![(0.0, 0), (4.0, 1), (8.0, 2)]);
    assert_eq!(
        c.passada_final,
        Some(vec![(0.0, 0), (4.0, 1), (8.0, 3), (12.0, 4), (16.0, 5)])
    );
}

#[test]
fn o_instante_de_cada_compasso_e_onde_as_notas_dele_caem_em_cada_passada() {
    let h = converter(&hino_com_final(), 1).unwrap();
    let c = h.compassos.clone().unwrap();
    let normal = notas_de(&h.vozes, 0);
    for &(t, i) in &c.normal {
        let n = normal
            .iter()
            .find(|n| (n.0 - t).abs() < 1e-9)
            .expect("há uma nota começando no compasso");
        assert_eq!(
            n.2,
            altura_do_compasso(i),
            "passada normal, compasso {i} em {t}"
        );
    }
    let final_ = notas_de(h.passada_final.as_ref().unwrap(), 0);
    for &(t, i) in c.passada_final.as_ref().unwrap() {
        let n = final_
            .iter()
            .find(|n| (n.0 - t).abs() < 1e-9)
            .expect("há uma nota começando no compasso");
        assert_eq!(
            n.2,
            altura_do_compasso(i),
            "passada do final, compasso {i} em {t}"
        );
    }
    // e não sobra compasso sem nota nem nota sem compasso: um compasso por nota (cada compasso do teste tem uma semibreve)
    assert_eq!(c.normal.len(), normal.len());
    assert_eq!(c.passada_final.as_ref().unwrap().len(), final_.len());
}

#[test]
fn estrutura_nao_reconhecida_le_a_partitura_uma_vez_em_ordem_tambem_nos_compassos() {
    // um fim de repetição sem as casas de volta que o plano reconhece: a partitura é lida uma vez, como as notas
    let medidas = [
        comp_marcado("<startRepeat/>", 60),
        comp_marcado("<endRepeat>2</endRepeat>", 62),
        comp_marcado("", 64),
    ]
    .concat();
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &medidas)), 1).unwrap();
    let c = h.compassos.unwrap();
    assert_eq!(c.normal, vec![(0.0, 0), (4.0, 1), (8.0, 2)]);
    assert!(c.passada_final.is_none());
}

#[test]
fn anacruse_o_compasso_curto_empurra_os_seguintes_pela_duracao_real() {
    // 1º compasso de 1 batida (len="1/4"), depois dois de 4: os instantes são 0, 1 e 5 (e não 0, 4 e 8)
    let anacruse = format!(
        r#"<Measure len="1/4"><voice>{C44}{}</voice></Measure>"#,
        acorde("quarter", 60)
    );
    let h = converter(
        &doc(
            &parte(1, "S"),
            &pauta(
                1,
                &[anacruse, comp_marcado("", 62), comp_marcado("", 64)].concat(),
            ),
        ),
        1,
    )
    .unwrap();
    assert_eq!(
        h.compassos.unwrap().normal,
        vec![(0.0, 0), (1.0, 1), (5.0, 2)]
    );
}

#[test]
fn o_json_traz_os_compassos_de_cada_fluxo_e_omite_o_que_nao_existe() {
    let j = para_json(&converter(&hino_com_final(), 1).unwrap());
    assert_eq!(
        j["compassos"]["normal"],
        json!([[0.0, 0], [4.0, 1], [8.0, 2]])
    );
    assert_eq!(
        j["compassos"]["final"],
        json!([[0.0, 0], [4.0, 1], [8.0, 3], [12.0, 4], [16.0, 5]])
    );
    assert!(j["compassos"].get("introducao").is_none());
    let j2 = para_json(&converter(&hino_com_asterisco(), 1).unwrap());
    assert_eq!(j2["compassos"]["introducao"], json!([[0.0, 0], [4.0, 1]]));
    assert!(j2["compassos"].get("final").is_none());
}

#[test]
fn final_descartado_nao_deixa_compassos_do_final() {
    // O último compasso (só existe na passada do final) tem um acorde de 2 notas: o final teria 2 vozes e a normal 1, então o final é
    // descartado (ver o aviso). Os compassos do final têm de sumir junto: sem notas do final, o app não tem o que destacar.
    let ultimo = format!(
        "<Measure><voice>{C44}<Chord><durationType>whole</durationType><Note><pitch>69</pitch></Note><Note><pitch>72</pitch></Note></Chord></voice></Measure>"
    );
    let medidas = [
        comp_marcado("<startRepeat/>", 60),
        comp_marcado("", 62),
        comp_marcado(
            r#"<endRepeat>2</endRepeat><Volta id="1"><endings>2</endings></Volta>"#,
            64,
        ),
        comp_marcado(
            r#"<endSpanner id="1"/><Volta id="2"><endings>3</endings></Volta>"#,
            65,
        ),
        comp_marcado(r#"<endSpanner id="2"/>"#, 67),
        ultimo,
    ]
    .concat();
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &medidas)), 1).unwrap();
    assert!(
        h.passada_final.is_none(),
        "o final deveria ter sido descartado: {:?}",
        h.avisos
    );
    assert!(
        h.avisos.iter().any(|a| a.contains("descartado")),
        "{:?}",
        h.avisos
    );
    let c = h.compassos.unwrap();
    assert!(c.passada_final.is_none());
    assert_eq!(
        c.normal,
        vec![
            (0.0, 0),
            (4.0, 1),
            (8.0, 2),
            (12.0, 3),
            (16.0, 4),
            (20.0, 5)
        ],
        "sem o final, a passada normal é a leitura única, com a 2ª casa e o trecho final"
    );
    // As notas acompanham os compassos: a passada normal vai até o último compasso (o de 2 notas), e não para na 1ª casa.
    let fim_das_notas = h
        .vozes
        .iter()
        .flat_map(|v| v.notas.iter())
        .map(|n| n.inicio + n.dur)
        .fold(0.0, f64::max);
    assert_eq!(fim_das_notas, 24.0, "{:?}", h.vozes);
    assert!(
        h.avisos
            .iter()
            .any(|a| a.contains("final descartado") && a.contains("lida uma vez")),
        "{:?}",
        h.avisos
    );
    assert!(
        !h.avisos.iter().any(|a| a.contains("reconhecida")),
        "{:?}",
        h.avisos
    );
    assert!(
        para_json(&converter(&doc(&parte(1, "S"), &pauta(1, &medidas)), 1).unwrap())["compassos"]
            .get("final")
            .is_none()
    );
}
