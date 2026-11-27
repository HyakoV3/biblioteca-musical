//! Testes de `hinario.rs`: as vozes e as notas: a passada final, a introdução, o nome das vozes, as notas e o andamento inválidos.

use super::testes_apoio::args;
use super::*;

fn json_com_final(vozes_final: &str) -> String {
    format!(
        r#"{{"versao":1,"hinario":{{"id":"a","nome":"A"}},"hinos":[{{"numero":457,"titulo":"T",
        "vozes":[{{"nome":"Soprano","notas":[[0,1,60]]}},{{"nome":"Baixo","notas":[[0,1,48]]}}],
        "final":{{"vozes":{vozes_final}}}}}]}}"#
    )
}

#[test]
fn passada_final_e_lida_e_volta_com_o_nome_final() {
    let h = ler(&json_com_final(
        r#"[{"nome":"Soprano","notas":[[0,1,60],[1,2,62]]},{"nome":"Baixo","notas":[[0,3,48]]}]"#,
    ))
    .unwrap();
    let f = h.hinos[0]
        .passada_final
        .as_ref()
        .expect("deveria ter final");
    assert_eq!(f.vozes[0].notas.len(), 2);
    // ao serializar, a chave continua "final" (e some quando não há final)
    let saida = serde_json::to_string(&h.hinos[0]).unwrap();
    assert!(saida.contains(r#""final":{"vozes""#), "{saida}");
    let sem =
        ler(r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[{"numero":1,"titulo":"T"}]}"#)
            .unwrap();
    assert!(sem.hinos[0].passada_final.is_none());
    assert!(
        !serde_json::to_string(&sem.hinos[0])
            .unwrap()
            .contains("final")
    );
}

#[test]
fn final_com_vozes_diferentes_das_da_passada_normal_e_recusado() {
    // número de vozes diferente
    let e = ler(&json_com_final(
        r#"[{"nome":"Soprano","notas":[[0,1,60]]}]"#,
    ))
    .unwrap_err();
    assert_eq!(args(&e)[..2], ["vozes_final", "457"], "{e}");
    // mesmo número, mas nomes ou ordem diferentes
    let e = ler(&json_com_final(
        r#"[{"nome":"Baixo","notas":[[0,1,48]]},{"nome":"Soprano","notas":[[0,1,60]]}]"#,
    ))
    .unwrap_err();
    assert!(e.contains("Baixo, Soprano"), "{e}");
}

fn json_com_introducao(vozes_intro: &str) -> String {
    format!(
        r#"{{"versao":1,"hinario":{{"id":"a","nome":"A"}},"hinos":[{{"numero":1,"titulo":"T",
        "vozes":[{{"nome":"Soprano","notas":[[0,1,60]]}},{{"nome":"Baixo","notas":[[0,1,48]]}}],
        "introducao":{{"vozes":{vozes_intro}}}}}]}}"#
    )
}

#[test]
fn introducao_e_lida_volta_na_saida_e_some_quando_nao_ha() {
    let h = ler(&json_com_introducao(
        r#"[{"nome":"Soprano","notas":[[0,1,60]]},{"nome":"Baixo","notas":[[0,1,48]]}]"#,
    ))
    .unwrap();
    assert_eq!(
        h.hinos[0]
            .introducao
            .as_ref()
            .expect("deveria ter introdução")
            .vozes
            .len(),
        2
    );
    assert!(
        serde_json::to_string(&h.hinos[0])
            .unwrap()
            .contains(r#""introducao":{"vozes""#)
    );
    let sem =
        ler(r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[{"numero":1,"titulo":"T"}]}"#)
            .unwrap();
    assert!(sem.hinos[0].introducao.is_none());
    assert!(
        !serde_json::to_string(&sem.hinos[0])
            .unwrap()
            .contains("introducao")
    );
}

#[test]
fn nome_de_voz_com_barra_vertical_nao_embaralha_os_argumentos_do_erro() {
    // O nome vem do arquivo importado: pode ter qualquer caractere, inclusive o separador de antes.
    let e = ler(&json_com_final(
        r#"[{"nome":"A|B","notas":[[0,1,60]]},{"nome":"C\"D","notas":[[0,1,48]]}]"#,
    ))
    .unwrap_err();
    assert_eq!(
        args(&e),
        ["vozes_final", "457", "A|B, C\"D", "Soprano, Baixo"],
        "{e}"
    );
}

#[test]
fn introducao_com_vozes_diferentes_das_da_passada_normal_e_recusada() {
    let e = ler(&json_com_introducao(
        r#"[{"nome":"Soprano","notas":[[0,1,60]]}]"#,
    ))
    .unwrap_err();
    assert_eq!(args(&e)[..2], ["vozes_intro", "1"], "{e}");
}

fn json_com_nota(nota: &str, andamento: &str) -> String {
    format!(
        r#"{{"versao":1,"hinario":{{"id":"a","nome":"A"}},"hinos":[{{"numero":7,"titulo":"T",{andamento}
        "vozes":[{{"nome":"Soprano","notas":[{nota}]}}]}}]}}"#
    )
}

#[test]
fn nota_com_tempo_duracao_ou_midi_invalidos_recusa_o_hinario() {
    // PERS-003: o hino 7, a voz Soprano
    for ruim in [
        "[-1,1,60]",
        "[0,0,60]",
        "[0,-2,60]",
        "[0,1,200]",
        "[0,1e39,60]",
    ] {
        let e = ler(&json_com_nota(ruim, "")).unwrap_err();
        assert_eq!(args(&e), ["nota_invalida", "7", "Soprano"], "{ruim}: {e}");
    }
    assert!(ler(&json_com_nota("[0,1,60],[1,0.5,127]", "")).is_ok());
}

#[test]
fn nota_invalida_na_introducao_e_no_final_tambem_recusa() {
    let json = r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[{"numero":7,"titulo":"T",
        "vozes":[{"nome":"S","notas":[[0,1,60]]}],
        "final":{"vozes":[{"nome":"S","notas":[[0,1,60]]}]},
        "introducao":{"vozes":[{"nome":"S","notas":[[0,-1,60]]}]}}]}"#;
    assert_eq!(args(&ler(json).unwrap_err())[0], "nota_invalida");
}

#[test]
fn andamento_fora_de_20_a_300_recusa_o_hinario() {
    for (a, ok) in [
        (19, false),
        (20, true),
        (300, true),
        (301, false),
        (0, false),
    ] {
        let r = ler(&json_com_nota("[0,1,60]", &format!(r#""andamento":{a},"#)));
        assert_eq!(r.is_ok(), ok, "andamento {a}");
        if !ok {
            assert_eq!(
                args(&r.unwrap_err()),
                ["andamento_invalido", "7", &a.to_string()]
            );
        }
    }
}
