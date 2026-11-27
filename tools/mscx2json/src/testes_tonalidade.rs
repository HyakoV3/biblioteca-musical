//! Testes do conversor sobre a tonalidade: armadura, modo e nome.

use crate::testes_apoio::*;

// ---- Tonalidade (I-13): armadura, modo e nome ----
fn com_armadura(ks: &str, baixo: &[u8]) -> Hino {
    let corpo_s = format!("{C44}{ks}{}", acorde("whole", 72));
    let corpo_b: String = baixo.iter().map(|&p| acorde("quarter", p)).collect();
    let pautas = format!(
        "{}{}",
        pauta(1, &compasso(&corpo_s)),
        pauta(2, &compasso(&format!("{C44}{corpo_b}")))
    );
    let partes = format!("{}{}", parte(1, "Soprano"), parte(2, "Baixo"));
    converter(&doc(&partes, &pautas), 1).unwrap()
}

fn ks(n: i8) -> String {
    format!("<KeySig><accidental>{n}</accidental></KeySig>")
}

#[test]
fn tonica_e_nome_de_todas_as_armaduras() {
    // (armadura, tônica maior, nome maior, tônica menor, nome menor)
    let t = [
        (-7, 11, "Dó♭", 8, "Lá♭"),
        (-6, 6, "Sol♭", 3, "Mi♭"),
        (-5, 1, "Ré♭", 10, "Si♭"),
        (-4, 8, "Lá♭", 5, "Fá"),
        (-3, 3, "Mi♭", 0, "Dó"),
        (-2, 10, "Si♭", 7, "Sol"),
        (-1, 5, "Fá", 2, "Ré"),
        (0, 0, "Dó", 9, "Lá"),
        (1, 7, "Sol", 4, "Mi"),
        (2, 2, "Ré", 11, "Si"),
        (3, 9, "Lá", 6, "Fá♯"),
        (4, 4, "Mi", 1, "Dó♯"),
        (5, 11, "Si", 8, "Sol♯"),
        (6, 6, "Fá♯", 3, "Ré♯"),
        (7, 1, "Dó♯", 10, "Lá♯"),
    ];
    for (a, pm, nm, pn, nn) in t {
        assert_eq!(tonica_pc(a, false), pm, "maior {a}");
        assert_eq!(tonica_pc(a, true), pn, "menor {a}");
        assert_eq!(nome_da_tonalidade(a, "maior"), format!("{nm} maior"));
        assert_eq!(nome_da_tonalidade(a, "menor"), format!("{nn} menor"));
    }
}

#[test]
fn armadura_e_modo_maior_pelo_baixo() {
    let h = com_armadura(&ks(-3), &[51, 55, 58, 51]); // Mi♭ no fim
    assert_eq!((h.armadura, h.modo), (-3, "maior"));
    let j = para_json(&h);
    assert_eq!(
        (
            j["armadura"].clone(),
            j["modo"].clone(),
            j["tonalidade"].clone()
        ),
        (json!(-3), json!("maior"), json!("Mi♭ maior"))
    );
    assert!(!h.avisos.iter().any(|a| a.contains("tonalidade")));
}

#[test]
fn hino_menor_pelo_baixo() {
    let h = com_armadura(&ks(-3), &[48, 55, 51, 48]); // Dó no fim
    assert_eq!((h.armadura, h.modo), (-3, "menor"));
    assert_eq!(para_json(&h)["tonalidade"], json!("Dó menor"));
}

#[test]
fn sem_keysig_a_armadura_e_zero() {
    let h = com_armadura("", &[48, 55, 48]);
    assert_eq!((h.armadura, h.modo), (0, "maior"));
    let h = com_armadura("", &[57, 52, 57]); // Lá no fim
    assert_eq!((h.armadura, h.modo), (0, "menor"));
}

#[test]
fn baixo_que_nao_bate_usa_a_primeira_nota_e_depois_assume_maior_com_aviso() {
    // fim em Ré (nada), primeira em Dó (maior de armadura 0)
    let h = com_armadura("", &[48, 55, 50]);
    assert_eq!(h.modo, "maior");
    assert!(!h.avisos.iter().any(|a| a.contains("tonalidade")));
    // nem o fim nem o começo batem
    let h = com_armadura("", &[50, 55, 53]);
    assert_eq!(h.modo, "maior");
    assert!(
        h.avisos.iter().any(|a| a.contains("tonalidade")),
        "{:?}",
        h.avisos
    );
}

#[test]
fn modo_escrito_no_arquivo_vale_mais_que_o_baixo() {
    let k = "<KeySig><accidental>-3</accidental><mode>minor</mode></KeySig>";
    let h = com_armadura(k, &[51, 55, 51]);
    assert_eq!(h.modo, "menor");
}

#[test]
fn armadura_invalida_vira_zero_com_aviso_e_so_o_primeiro_keysig_vale() {
    let h = com_armadura(&ks(9), &[48, 48]);
    assert_eq!(h.armadura, 0);
    assert!(
        h.avisos.iter().any(|a| a.contains("armadura inválida (9)")),
        "{:?}",
        h.avisos
    );
    let h = com_armadura("<KeySig><accidental>x</accidental></KeySig>", &[48, 48]);
    assert!(h.avisos.iter().any(|a| a.contains("armadura inválida (x)")));
    // KeySig sem número (o 0 pode vir omitido): Dó, sem aviso.
    let h = com_armadura("<KeySig></KeySig>", &[48, 48]);
    assert_eq!(h.armadura, 0);
    assert!(!h.avisos.iter().any(|a| a.contains("armadura")));
    let dois = format!("{}{}", ks(1), ks(-2));
    let h = com_armadura(&dois, &[55, 55]);
    assert_eq!((h.armadura, h.modo), (1, "maior"));
}
