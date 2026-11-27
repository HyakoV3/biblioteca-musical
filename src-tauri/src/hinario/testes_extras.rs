//! Testes de `hinario.rs`: os extras do hino: a sincronia do karaokê e os compassos (lidos, descartados quando malformados).

use super::testes_apoio::args;
use super::*;

fn json_com_sincronia(sincronia: &str) -> String {
    format!(
        r#"{{"versao":1,"hinario":{{"id":"a","nome":"A"}},"hinos":[{{"numero":1,"titulo":"T","letra":["1. la lá"],
        "vozes":[{{"nome":"Soprano","notas":[[0,1,60],[1,1,62]]}}],"sincronia":{sincronia}}}]}}"#
    )
}

#[test]
fn sincronia_e_lida_volta_na_saida_e_some_quando_nao_ha() {
    let h = ler(&json_com_sincronia(
        r#"{"normal":[{"estrofe":1,"linhas":[[[0,0,2],[1.5,3,5]]]}],"final":[{"estrofe":1,"linhas":[[[0,0,2]]]}]}"#,
    ))
    .unwrap();
    let s = h.hinos[0]
        .sincronia
        .as_ref()
        .expect("deveria ter sincronia");
    assert_eq!(s.normal[0].estrofe, 1);
    assert_eq!(
        s.normal[0].linhas[0],
        vec![Trecho(0.0, 0, 2), Trecho(1.5, 3, 5)]
    );
    assert_eq!(
        s.passada_final.as_ref().unwrap()[0].linhas[0],
        vec![Trecho(0.0, 0, 2)]
    );
    // ao serializar, a chave do final continua "final"
    let saida = serde_json::to_string(&h.hinos[0]).unwrap();
    assert!(
        saida.contains(r#""sincronia":{"normal":[{"estrofe":1"#)
            && saida.contains(r#""final":[{"estrofe":1"#),
        "{saida}"
    );

    let sem =
        ler(r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[{"numero":1,"titulo":"T"}]}"#)
            .unwrap();
    assert!(sem.hinos[0].sincronia.is_none());
    assert!(
        !serde_json::to_string(&sem.hinos[0])
            .unwrap()
            .contains("sincronia")
    );
}

#[test]
fn sincronia_com_o_coro_na_estrofe_0_e_aceita() {
    let h = ler(&json_com_sincronia(
        r#"{"normal":[{"estrofe":1,"linhas":[[[0,0,2]]]},{"estrofe":0,"linhas":[[[4,0,2]]]}]}"#,
    ))
    .unwrap();
    let s = h.hinos[0]
        .sincronia
        .as_ref()
        .expect("devia manter a sincronia");
    assert_eq!(s.normal[1].estrofe, 0);
}

#[test]
fn sincronia_malformada_e_descartada_sem_recusar_o_hino() {
    // trecho com de >= ate, tempo negativo e (no final) trecho invertido: cada um derruba só a sincronia
    for ruim in [
        r#"{"normal":[{"estrofe":1,"linhas":[[[0,3,3]]]}]}"#,
        r#"{"normal":[{"estrofe":1,"linhas":[[[-1,0,2]]]}]}"#,
        r#"{"normal":[{"estrofe":1,"linhas":[[[0,0,2]]]}],"final":[{"estrofe":1,"linhas":[[[0,5,2]]]}]}"#,
    ] {
        let h = ler(&json_com_sincronia(ruim)).unwrap_or_else(|e| panic!("não devia recusar: {e}"));
        assert_eq!(h.hinos[0].titulo, "T");
        assert!(h.hinos[0].sincronia.is_none(), "devia descartar: {ruim}");
    }
}

fn json_com_compassos(compassos: &str) -> String {
    format!(
        r#"{{"versao":1,"hinario":{{"id":"a","nome":"A"}},"hinos":[{{"numero":1,"titulo":"T",
        "vozes":[{{"nome":"Soprano","notas":[[0,1,60],[1,1,62]]}}],"compassos":{compassos}}}]}}"#
    )
}

#[test]
fn compassos_sao_lidos_voltam_na_saida_com_a_chave_final_e_somem_quando_nao_ha() {
    let h = ler(&json_com_compassos(
        r#"{"normal":[[0,0],[4,1],[8,2]],"final":[[0,0],[4,1],[8,3]],"introducao":[[0,0],[4,1]]}"#,
    ))
    .unwrap();
    let c = h.hinos[0]
        .compassos
        .as_ref()
        .expect("deveria ter compassos");
    assert_eq!(
        c.normal,
        vec![
            InicioDeCompasso(0.0, 0),
            InicioDeCompasso(4.0, 1),
            InicioDeCompasso(8.0, 2)
        ]
    );
    assert_eq!(c.passada_final.as_ref().unwrap().len(), 3);
    assert_eq!(
        c.introducao.as_ref().unwrap(),
        &vec![InicioDeCompasso(0.0, 0), InicioDeCompasso(4.0, 1)]
    );
    // ao serializar para a interface, a chave do final continua "final"; sem o final nem a introdução, elas não aparecem
    let saida = serde_json::to_string(&h.hinos[0]).unwrap();
    assert!(
        saida.contains(r#""compassos":{"normal":[[0.0,0],[4.0,1],[8.0,2]],"final":[[0.0,0],[4.0,1],[8.0,3]],"introducao":[[0.0,0],[4.0,1]]}"#),
        "{saida}"
    );
    let so_normal = ler(&json_com_compassos(r#"{"normal":[[0,0]]}"#)).unwrap();
    let saida = serde_json::to_string(&so_normal.hinos[0]).unwrap();
    assert!(
        saida.contains(r#""compassos":{"normal":[[0.0,0]]}"#),
        "{saida}"
    );

    let sem =
        ler(r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[{"numero":1,"titulo":"T"}]}"#)
            .unwrap();
    assert!(sem.hinos[0].compassos.is_none());
    assert!(
        !serde_json::to_string(&sem.hinos[0])
            .unwrap()
            .contains("compassos")
    );
}

#[test]
fn compassos_malformados_sao_descartados_sem_recusar_o_hino() {
    // lista vazia, tempo negativo, instante repetido, fora de ordem e (no final ou na introdução) o mesmo: cada um derruba só os compassos
    for ruim in [
        r#"{"normal":[]}"#,
        r#"{"normal":[[-1,0]]}"#,
        r#"{"normal":[[0,0],[0,1]]}"#,
        r#"{"normal":[[4,0],[2,1]]}"#,
        r#"{"normal":[[0,0],[4,1]],"final":[[3,0],[1,1]]}"#,
        r#"{"normal":[[0,0],[4,1]],"final":[]}"#,
        r#"{"normal":[[0,0],[4,1]],"introducao":[[0,0],[0,1]]}"#,
        r#"{"normal":[[0,0],[4,1]],"introducao":[]}"#,
    ] {
        let h = ler(&json_com_compassos(ruim)).unwrap_or_else(|e| panic!("não devia recusar: {e}"));
        assert_eq!(h.hinos[0].titulo, "T");
        assert_eq!(h.hinos[0].vozes.len(), 1, "as notas continuam");
        assert!(h.hinos[0].compassos.is_none(), "devia descartar: {ruim}");
    }
}

#[test]
fn compassos_com_numero_que_estoura_o_f32_nao_viram_infinito_na_lista() {
    // 1e39 não cabe num f32: o que o serde faz com ele decide se o teste de `is_finite` é alcançável pelo JSON
    match ler(&json_com_compassos(r#"{"normal":[[1e39,0]]}"#)) {
        Ok(h) => assert!(
            h.hinos[0].compassos.is_none(),
            "um tempo infinito não pode ficar"
        ),
        Err(e) => assert_eq!(args(&e)[0], "json_invalido", "{e}"),
    }
}

#[test]
fn compassos_com_formato_errado_recusam_so_pelo_json_invalido_como_qualquer_campo() {
    // um item que não é [numero, indice] não é JSON de um compasso: o erro é o de JSON inválido de sempre, não um comportamento novo
    let e = ler(&json_com_compassos(r#"{"normal":[["a",0]]}"#)).unwrap_err();
    assert_eq!(args(&e)[0], "json_invalido", "{e}");
}
