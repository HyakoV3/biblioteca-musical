//! O que os testes do pacote compartilham: os arquivos de exemplo e os montadores de zip e de pasta.

use crate::hinario;
use crate::pacote::*;
use std::io::{Cursor, Write};
use std::path::Path;
use zip::write::SimpleFileOptions;

pub(super) const SVG: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><g class="a"><path d="M0 0L1 1"/></g></svg>"##;
/// Outro desenho (a versão larga), para saber qual das duas foi lida.
pub(super) const SVG_LARGO: &str = r##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 10"><g class="larga"><path d="M0 0L9 9"/></g></svg>"##;
pub(super) const JSON: &str = r#"{"versao":1,"hinario":{"id":"x","nome":"X"},"hinos":[{"numero":1,"titulo":"A"},{"numero":2,"titulo":"B"},{"numero":283,"titulo":"C"}]}"#;

pub(super) fn dir_teste(nome: &str) -> std::path::PathBuf {
    let d = std::env::temp_dir().join(format!("bm_pacote_{nome}_{}", std::process::id()));
    std::fs::remove_dir_all(&d).ok();
    d
}

/// Um diretório com o hinário (`JSON`, id "x", hinos 1, 2 e 283) já instalado: as partituras só entram para um hinário instalado.
pub(super) fn dir_com_hinario(nome: &str) -> std::path::PathBuf {
    let d = dir_teste(nome);
    hinario::importar(&d, JSON).unwrap();
    d
}

pub(super) fn args(e: &str) -> Vec<String> {
    serde_json::from_str(e).unwrap_or_else(|_| panic!("erro não é um JSON de códigos: {e}"))
}

pub(super) fn codigo(e: &str) -> String {
    args(e)[0].clone()
}

/// Monta um zip com os arquivos dados (nome, conteúdo), na ordem dada.
pub(super) fn zip_de(arquivos: &[(&str, &str)]) -> Vec<u8> {
    let mut w = zip::ZipWriter::new(Cursor::new(Vec::new()));
    for (nome, conteudo) in arquivos {
        if nome.ends_with('/') {
            w.add_directory(*nome, SimpleFileOptions::default())
                .unwrap();
        } else {
            w.start_file(*nome, SimpleFileOptions::default()).unwrap();
            w.write_all(conteudo.as_bytes()).unwrap();
        }
    }
    w.finish().unwrap().into_inner()
}

/// O mesmo pacote, com a versão de paisagem de cada partitura.
pub(super) fn pacote_com_paisagem() -> Vec<u8> {
    zip_de(&[
        ("partituras/hino-1.svg", SVG),
        ("partituras/hino-1-paisagem.svg", SVG_LARGO),
        ("partituras/hino-283.svg", SVG),
        ("partituras/hino-283-paisagem.svg", SVG_LARGO),
    ])
}

pub(super) fn pacote_ok() -> Vec<u8> {
    zip_de(&[
        ("partituras/", ""),
        ("partituras/hino-1.svg", SVG),
        ("partituras/hino-283.svg", SVG),
    ])
}

pub(super) fn arquivos(dir: &Path) -> Vec<String> {
    let mut v = Vec::new();
    fn anda(base: &Path, p: &Path, v: &mut Vec<String>) {
        for e in std::fs::read_dir(p).into_iter().flatten().flatten() {
            let caminho = e.path();
            v.push(
                caminho
                    .strip_prefix(base)
                    .unwrap()
                    .to_string_lossy()
                    .into_owned(),
            );
            if caminho.is_dir() {
                anda(base, &caminho, v);
            }
        }
    }
    anda(dir, dir, &mut v);
    v.sort();
    v
}

/// Limites pequenos, para os testes que precisam estourá-los.
pub(super) fn pequenos() -> Limites {
    Limites {
        zip: 10_000,
        entradas: 4,
        descompactado: 5_000,
        svg: 1_000,
    }
}

/// O mesmo zip importado com um limite no valor exato (aceito) e com um limite logo abaixo (recusado com o código dado).
pub(super) fn aceita_no_limite_e_recusa_abaixo(
    d: &Path,
    z: &[u8],
    aceito: &Limites,
    recusado: &Limites,
    codigo_esperado: &str,
) {
    assert!(importar_zip_com(d, z, aceito).is_ok());
    let e = importar_zip_com(d, z, recusado).unwrap_err();
    assert_eq!(codigo(&e), codigo_esperado);
}
