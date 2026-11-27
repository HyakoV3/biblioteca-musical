//! Testes de `hinario.rs`: a leitura do `hinario.json`: o exemplo, os campos opcionais, a autoria, o idioma, a versão e a saída do conversor.

use super::testes_apoio::{args, dir_teste};
use super::*;

#[test]
fn exemplo_embutido_e_valido() {
    let h = ler(EXEMPLO).unwrap();
    assert_eq!(h.hinario.id, "exemplo");
    assert_eq!(h.hinos.len(), 5);
    assert_eq!(h.hinos[0].vozes.len(), 4);
    assert_eq!(h.hinos[0].vozes[0].notas[0], Nota(0.0, 1.0, 72));
}

#[test]
fn titulos_por_idioma_sao_lidos_limpos_e_opcionais() {
    let json = r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[
        {"numero":1,"titulo":"T","titulos":{"pt":"Título","en":"  ","fr":"Titre","es":"Título es"}},
        {"numero":2,"titulo":"U","titulos":{"fr":"Titre"}},
        {"numero":3,"titulo":"V"}]}"#;
    let h = ler(json).unwrap();
    let t1 = h.hinos[0].titulos.as_ref().unwrap();
    assert_eq!(
        t1.keys().map(String::as_str).collect::<Vec<_>>(),
        ["es", "pt"]
    ); // "en" vazio e "fr" desconhecido saem
    assert!(h.hinos[1].titulos.is_none() && h.hinos[2].titulos.is_none()); // sem nada útil, ou sem o campo (hinário antigo): nenhum
    assert!(
        !serde_json::to_string(&h.hinos[2])
            .unwrap()
            .contains("titulos")
    ); // e não volta para a interface
    assert!(ler(r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[{"numero":1,"titulo":"T","titulos":{"pt":3}}]}"#).is_err()); // tipo errado recusa
}

#[test]
fn notas_sao_arrays_no_json() {
    let v: Voz = serde_json::from_str(r#"{"nome":"S","notas":[[0,1.5,60]]}"#).unwrap();
    assert_eq!(v.notas[0], Nota(0.0, 1.5, 60));
    assert_eq!(serde_json::to_string(&v.notas[0]).unwrap(), "[0.0,1.5,60]");
}

#[test]
fn campos_opcionais_tem_padrao() {
    let h =
        ler(r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[{"numero":7,"titulo":"T"}]}"#)
            .unwrap();
    let hino = &h.hinos[0];
    assert!(hino.letra.is_empty() && hino.tonalidade.is_none());
    assert!(hino.vozes.is_empty() && hino.andamento.is_none());
    assert!(h.hinario.idioma.is_none() && hino.autoria.is_none());
}

#[test]
fn autoria_do_hino_e_lida() {
    let h = ler(
        r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[{"numero":1,"titulo":"T","autoria":"Fulana de Tal"}]}"#,
    )
    .unwrap();
    assert_eq!(h.hinos[0].autoria.as_deref(), Some("Fulana de Tal"));
}

#[test]
fn idioma_do_conteudo_e_lido_e_nao_aparece_quando_ausente() {
    let com =
        ler(r#"{"versao":1,"hinario":{"id":"a","nome":"A","idioma":"es"},"hinos":[]}"#).unwrap();
    assert_eq!(com.hinario.idioma.as_deref(), Some("es"));
    assert!(
        serde_json::to_string(&com.hinario)
            .unwrap()
            .contains(r#""idioma":"es""#)
    );

    let sem = ler(r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[]}"#).unwrap();
    assert!(
        !serde_json::to_string(&sem.hinario)
            .unwrap()
            .contains("idioma")
    );
}

#[test]
fn rejeita_versao_desconhecida() {
    let e = ler(r#"{"versao":2,"hinario":{"id":"a","nome":"A"},"hinos":[]}"#).unwrap_err();
    assert_eq!(args(&e), ["versao", "2", "1"]);
}

#[test]
fn saida_do_conversor_mscx2json_e_aceita() {
    // Gerada por tools/mscx2json a partir de partituras fictícias.
    let h = ler(include_str!(
        "../../../tools/mscx2json/tests/fixtures/hinario.json"
    ))
    .unwrap();
    assert_eq!(h.hinos.len(), 3);
    assert_eq!(h.hinos[0].andamento, Some(80));
    assert_eq!(h.hinos[0].vozes[0].notas[0], Nota(0.0, 1.0, 72));
    // O hino 3 traz o que o conversor gera além das notas (a fixture é conferida contra o conversor em tools/mscx2json): o leitor tem de
    // aceitar e manter o final, a introdução, a letra, a sincronia e os compassos.
    let h3 = &h.hinos[2];
    assert_eq!(h3.letra, vec!["1. Um dois três fim de todos"]);
    let final_ = h3.passada_final.as_ref().expect("o hino 3 tem final");
    assert_eq!(final_.vozes.len(), h3.vozes.len());
    assert!(h3.introducao.is_some());
    assert!(
        h3.sincronia.is_some(),
        "a sincronia gerada pelo conversor foi descartada pelo leitor"
    );
    let compassos = h3
        .compassos
        .as_ref()
        .expect("o leitor descartou os compassos gerados pelo conversor");
    assert_eq!(compassos.normal.len(), 3);
    assert!(compassos.passada_final.is_some() && compassos.introducao.is_some());
}

/// Valida um arquivo real (não versionado): BM_AMOSTRA=caminho cargo test -- --ignored
#[test]
#[ignore = "defina BM_AMOSTRA=caminho/para/hinario.json"]
fn arquivo_real_de_amostra_e_aceito() {
    let caminho = std::env::var("BM_AMOSTRA").expect("defina BM_AMOSTRA");
    let texto = std::fs::read_to_string(caminho).unwrap();
    let d = dir_teste("amostra");
    let p = importar(&d, &texto).unwrap();
    println!("{} hinos aceitos", p.hinario.hinos.len());
    assert!(p.hinario.hinos.iter().all(|h| !h.vozes.is_empty()));
    std::fs::remove_dir_all(&d).ok();
}
