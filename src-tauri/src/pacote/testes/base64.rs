//! Testes do pacote: o pacote em base64 (a forma como a interface manda o zip).

use super::apoio::*;
use crate::pacote::*;

// ---- base64 (a forma como a interface manda o zip) ----

#[test]
fn importa_o_zip_em_base64() {
    let d = dir_com_hinario("base64_ok");
    let texto = STANDARD.encode(pacote_ok());
    let r = importar_base64(&d, &texto).unwrap();
    assert_eq!(r.partituras, 2);
    assert_eq!(r.pacote.partituras, vec![1, 283]);
    assert_eq!(
        hinario::carregar(Some(&d)).unwrap().partituras,
        vec![1, 283]
    );
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn base64_aceita_espaco_nas_pontas_e_recusa_o_que_nao_e_base64() {
    let d = dir_com_hinario("base64_forma");
    let texto = STANDARD.encode(pacote_ok());
    assert!(importar_base64(&d, &format!("  {texto}\n")).is_ok());
    for ruim in [
        "@@@@",
        "abc",
        "YWJj ZGVm",
        "Zm9v!",
        "\u{e9}\u{e9}\u{e9}\u{e9}",
    ] {
        let e = importar_base64(&dir_com_hinario("base64_ruim"), ruim).unwrap_err();
        assert_eq!(codigo(&e), "zip_invalido", "{ruim:?} -> {e}");
    }
    // vazio decodifica para zero bytes, que não são um zip
    assert_eq!(
        codigo(&importar_base64(&d, "").unwrap_err()),
        "zip_invalido"
    );
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn base64_confere_o_tamanho_do_texto_antes_de_decodificar() {
    let d = dir_com_hinario("base64_tamanho");
    let lim = Limites {
        zip: 10,
        ..Limites::default()
    };
    // 200 caracteres que NÃO são base64: se decodificasse primeiro, o erro seria zip_invalido
    let e = importar_base64_com(&d, &"@".repeat(200), &lim).unwrap_err();
    assert_eq!(codigo(&e), "zip_grande_demais");
    assert_eq!(arquivos(&d), ["hinario.json"], "nada é tocado");
}

#[test]
fn o_gate_do_texto_base64_fica_exatamente_em_4_para_cada_3_bytes_mais_o_preenchimento() {
    // zip de 30 bytes = 10 grupos de 3 = 40 caracteres, mais 4 de folga para o preenchimento "=": o gate é 44. Texto que NÃO é
    // base64: passar do gate dá "zip_grande_demais" (recusado antes de decodificar); ficar nele dá "zip_invalido" (decodificou e falhou).
    let lim = Limites {
        zip: 30,
        ..Limites::default()
    };
    let d = dir_com_hinario("gate_borda");
    let ate = |n: usize| importar_base64_com(&d, &"@".repeat(n), &lim).unwrap_err();
    assert_eq!(
        codigo(&ate(44)),
        "zip_invalido",
        "44 caracteres passam o gate"
    );
    assert_eq!(
        codigo(&ate(45)),
        "zip_grande_demais",
        "45 já passam do gate"
    );
    assert_eq!(codigo(&ate(60)), "zip_grande_demais");
    assert_eq!(codigo(&ate(1)), "zip_invalido");
}

#[test]
fn base64_no_limite_do_zip_passa_e_um_byte_a_mais_nao() {
    let d = dir_com_hinario("base64_limite");
    let z = pacote_ok();
    let lim = Limites {
        zip: z.len(),
        ..Limites::default()
    };
    assert!(importar_base64_com(&d, &STANDARD.encode(&z), &lim).is_ok());
    let mais = [z.clone(), vec![0]].concat();
    let e = importar_base64_com(
        &dir_com_hinario("base64_limite2"),
        &STANDARD.encode(&mais),
        &lim,
    )
    .unwrap_err();
    assert_eq!(codigo(&e), "zip_grande_demais");
    std::fs::remove_dir_all(&d).ok();
}
