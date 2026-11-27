//! Testes do pacote: uma importação ou remoção de cada vez.

use super::apoio::*;
use crate::pacote::*;

// ---- uma importação ou remoção de cada vez ----

/// Roda `f` numa thread enquanto a tranca está presa aqui: ela tem de esperar (não acabar e não tocar em `d`), e só depois de
/// a tranca ser solta é que termina.
fn espera_a_tranca<T: Send + 'static>(d: &Path, f: impl FnOnce() -> T + Send + 'static) -> T {
    let antes = arquivos(d);
    let guarda = hinario::trancar();
    let t = std::thread::spawn(f);
    std::thread::sleep(std::time::Duration::from_millis(300));
    assert!(!t.is_finished(), "tem de esperar a tranca");
    assert_eq!(
        arquivos(d),
        antes,
        "e não pode ter tocado em nada enquanto espera"
    );
    drop(guarda);
    t.join().unwrap()
}

#[test]
fn importar_zip_espera_a_tranca() {
    let d = dir_com_hinario("tranca_zip");
    let (d2, z) = (d.clone(), pacote_ok());
    let r = espera_a_tranca(&d, move || importar_zip(&d2, &z));
    assert_eq!(r.unwrap().partituras, 2);
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn importar_json_espera_a_tranca() {
    let d = dir_com_hinario("tranca_json");
    let d2 = d.clone();
    let r = espera_a_tranca(&d, move || hinario::importar(&d2, JSON));
    assert!(r.is_ok());
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn remover_espera_a_tranca() {
    let d = dir_com_hinario("tranca_remover");
    let d2 = d.clone();
    let r = espera_a_tranca(&d, move || hinario::remover(&d2));
    assert!(r.unwrap().exemplo);
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn importacoes_em_paralelo_deixam_o_disco_consistente() {
    let d = dir_com_hinario("paralelo");
    let a = zip_de(&[("partituras/hino-1.svg", SVG)]);
    let b = zip_de(&[("partituras/hino-2.svg", SVG)]);
    let mut threads = Vec::new();
    for i in 0..8 {
        let (d2, z) = (d.clone(), if i % 2 == 0 { a.clone() } else { b.clone() });
        threads.push(std::thread::spawn(move || {
            importar_zip(&d2, &z).unwrap().partituras
        }));
        let d3 = d.clone();
        threads.push(std::thread::spawn(move || {
            hinario::importar(&d3, JSON).unwrap();
            0
        }));
    }
    for t in threads {
        t.join().unwrap();
    }
    let n = numeros(&d, "x").unwrap();
    assert!(n == vec![1] || n == vec![2], "{n:?}");
    assert!(!d.join("partituras.novo").exists() && !d.join("hinario.json.tmp").exists());
    assert_eq!(hinario::carregar(Some(&d)).unwrap().partituras, n);
    std::fs::remove_dir_all(&d).ok();
}
