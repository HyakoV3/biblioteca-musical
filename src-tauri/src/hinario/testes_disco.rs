//! Testes de `hinario.rs`: o pacote em disco: carregar, importar, semear o conteúdo incluso e remover.

use super::testes_apoio::{args, dir_teste};
use super::*;

#[test]
fn sem_pasta_usa_exemplo() {
    assert!(carregar(None).unwrap().exemplo);
    assert!(carregar(Some(Path::new("/nao/existe"))).unwrap().exemplo);
}

#[test]
fn arquivo_invalido_gera_erro_em_vez_de_exemplo() {
    let dir = std::env::temp_dir().join("bm_teste_invalido");
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(dir.join("hinario.json"), "{ quebrado").unwrap();
    assert!(carregar(Some(&dir)).is_err());
    std::fs::remove_dir_all(&dir).ok();
}

const VALIDO: &str = r#"{"versao":1,"hinario":{"id":"x","nome":"X"},"hinos":[{"numero":1,"titulo":"A"},{"numero":2,"titulo":"B"}]}"#;

#[test]
fn pasta_de_partituras_ilegivel_nao_derruba_o_hinario() {
    let d = dir_teste("partituras_ilegiveis");
    importar(&d, VALIDO).unwrap();
    // a marca `.hinario` vira uma pasta: ler o arquivo falha por outro motivo que não "não existe"
    std::fs::create_dir_all(d.join("partituras/.hinario")).unwrap();
    let p = carregar(Some(&d)).expect("o hinário abre mesmo com a pasta de partituras ilegível");
    assert!(!p.exemplo && p.hinario.hinos.len() == 2);
    assert!(p.partituras.is_empty());
    let motivo = p.partituras_erro.expect("o motivo vai à parte");
    assert!(motivo.starts_with("[\"partituras_ler\""), "{motivo}");
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn importar_grava_e_carregar_le() {
    let d = dir_teste("ok");
    let p = importar(&d, VALIDO).unwrap();
    assert!(!p.exemplo && p.hinario.hinos.len() == 2);
    let lido = carregar(Some(&d)).unwrap();
    assert!(!lido.exemplo && lido.hinario.hinario.id == "x");
    assert!(!d.join("hinario.json.tmp").exists());
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn importar_invalido_nao_substitui_o_atual() {
    let d = dir_teste("inv");
    importar(&d, VALIDO).unwrap();
    assert_eq!(
        args(&importar(&d, "{ quebrado").unwrap_err())[0],
        "json_invalido"
    );
    assert!(
        importar(
            &d,
            r#"{"versao":2,"hinario":{"id":"a","nome":"A"},"hinos":[]}"#
        )
        .is_err()
    );
    assert_eq!(carregar(Some(&d)).unwrap().hinario.hinario.id, "x");
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn importar_rejeita_vazio_e_numero_repetido() {
    let d = dir_teste("val");
    let vazio = r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[]}"#;
    assert_eq!(args(&importar(&d, vazio).unwrap_err()), ["vazio"]);
    let rep = r#"{"versao":1,"hinario":{"id":"a","nome":"A"},"hinos":[{"numero":5,"titulo":"A"},{"numero":5,"titulo":"B"}]}"#;
    assert_eq!(args(&importar(&d, rep).unwrap_err()), ["repetido", "5"]);
    std::fs::remove_dir_all(&d).ok();
}

const OUTRO: &str =
    r#"{"versao":1,"hinario":{"id":"y","nome":"Y"},"hinos":[{"numero":9,"titulo":"Z"}]}"#;

#[test]
fn semear_sem_conteudo_incluso_nao_faz_nada() {
    let d = dir_teste("sem0");
    semear(&d, "").unwrap();
    assert!(!d.exists());
    assert!(carregar(Some(&d)).unwrap().exemplo);
}

#[test]
fn semear_grava_como_importado_e_so_uma_vez() {
    let d = dir_teste("sem1");
    semear(&d, VALIDO).unwrap();
    let p = carregar(Some(&d)).unwrap();
    assert!(!p.exemplo && p.hinario.hinario.id == "x");
    // a pessoa remove o conteúdo: continua removido (a mesma versão não é reaplicada)
    remover(&d).unwrap();
    semear(&d, VALIDO).unwrap();
    assert!(!d.join("hinario.json").exists());
    assert!(carregar(Some(&d)).unwrap().exemplo);
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn semear_versao_nova_do_conteudo_substitui() {
    let d = dir_teste("sem2");
    semear(&d, VALIDO).unwrap();
    semear(&d, OUTRO).unwrap();
    assert_eq!(carregar(Some(&d)).unwrap().hinario.hinario.id, "y");
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn semear_nao_sobrescreve_importacao_da_propria_pessoa() {
    let d = dir_teste("sem3");
    importar(&d, OUTRO).unwrap(); // importou antes de existir marca
    semear(&d, VALIDO).unwrap();
    assert_eq!(carregar(Some(&d)).unwrap().hinario.hinario.id, "y");
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn semear_com_conteudo_incluso_invalido_da_erro() {
    let d = dir_teste("sem4");
    assert!(semear(&d, "{ quebrado").is_err());
    assert!(!d.join(".incluso").exists());
}

#[test]
fn remover_volta_ao_exemplo() {
    let d = dir_teste("rem");
    importar(&d, VALIDO).unwrap();
    assert!(remover(&d).unwrap().exemplo);
    assert!(remover(&d).unwrap().exemplo); // idempotente
    std::fs::remove_dir_all(&d).ok();
}
