//! Testes do pacote: os limites de tamanho.

use super::apoio::*;
use crate::pacote::*;

// ---- limites ----

#[test]
fn zip_grande_demais() {
    let d = dir_com_hinario("lim_zip");
    let z = pacote_ok();
    let lim = Limites {
        zip: z.len() - 1,
        ..pequenos()
    };
    assert_eq!(
        codigo(&importar_zip_com(&d, &z, &lim).unwrap_err()),
        "zip_grande_demais"
    );
    let lim = Limites {
        zip: z.len(),
        ..pequenos()
    };
    assert!(importar_zip_com(&d, &z, &lim).is_ok());
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn arquivos_demais() {
    let d = dir_com_hinario("lim_entradas");
    let z = zip_de(&[
        ("partituras/hino-1.svg", SVG),
        ("partituras/hino-2.svg", SVG),
        ("partituras/hino-3.svg", SVG),
    ]);
    assert!(
        importar_zip_com(
            &d,
            &z,
            &Limites {
                entradas: 3,
                ..pequenos()
            }
        )
        .is_ok()
    );
    let e = importar_zip_com(
        &d,
        &z,
        &Limites {
            entradas: 2,
            ..pequenos()
        },
    )
    .unwrap_err();
    assert_eq!(codigo(&e), "zip_muitos_arquivos");
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn total_descompactado_alto_demais_recusa_antes_de_descompactar() {
    let d = dir_com_hinario("lim_total");
    let z = pacote_ok();
    let total = (SVG.len() * 2) as u64;
    assert!(
        importar_zip_com(
            &d,
            &z,
            &Limites {
                descompactado: total,
                ..pequenos()
            }
        )
        .is_ok()
    );
    let e = importar_zip_com(
        &d,
        &z,
        &Limites {
            descompactado: total - 1,
            ..pequenos()
        },
    )
    .unwrap_err();
    assert_eq!(codigo(&e), "zip_descompactado_grande");
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn svg_acima_do_limite_e_recusado_so_ele() {
    let d = dir_com_hinario("lim_svg");
    let grande = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg"><desc>{}</desc></svg>"#,
        "x".repeat(2_000)
    );
    let z = zip_de(&[
        ("partituras/hino-1.svg", SVG),
        ("partituras/hino-2.svg", &grande),
    ]);
    let lim = Limites {
        descompactado: 10_000,
        ..pequenos()
    };
    let r = importar_zip_com(&d, &z, &lim).unwrap();
    assert_eq!(r.pacote.partituras, vec![1]);
    assert_eq!(r.recusadas.len(), 1);
    assert_eq!(r.recusadas[0].numero, 2);
    assert!(
        r.recusadas[0].motivo.contains("pacote_svg_grande"),
        "{:?}",
        r.recusadas
    );
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn svg_no_limite_exato_entra_e_um_byte_a_mais_nao() {
    let d = dir_com_hinario("lim_exato");
    let lim = Limites {
        descompactado: 10_000,
        ..pequenos()
    };
    let com_tamanho = |bytes: usize| {
        let base = r#"<svg xmlns="http://www.w3.org/2000/svg"><desc></desc></svg>"#;
        format!(
            r#"<svg xmlns="http://www.w3.org/2000/svg"><desc>{}</desc></svg>"#,
            "x".repeat(bytes - base.len())
        )
    };
    let exato = com_tamanho(lim.svg as usize);
    assert_eq!(exato.len() as u64, lim.svg);
    let passa = zip_de(&[("partituras/hino-1.svg", &exato)]);
    assert_eq!(
        importar_zip_com(&d, &passa, &lim)
            .unwrap()
            .pacote
            .partituras,
        vec![1]
    );
    let passou = com_tamanho(lim.svg as usize + 1);
    let nao = zip_de(&[("partituras/hino-1.svg", &passou)]);
    let r = importar_zip_com(&d, &nao, &lim).unwrap();
    assert_eq!(r.partituras, 0);
    assert_eq!(r.recusadas.len(), 1);
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn cabecalho_que_mente_sobre_o_tamanho_nao_fura_o_limite() {
    // O tamanho declarado do SVG é trocado por 1 (no cabeçalho local e no diretório central), mas o conteúdo continua grande.
    // A biblioteca do zip recusa a entrada ("maior que o tamanho declarado"); se um dia deixasse passar, `ler_entrada` ainda
    // corta a leitura no limite (coberto por `svg_acima_do_limite_e_recusado_so_ele`). Em nenhum caso o SVG entra inteiro.
    let d = dir_com_hinario("mentira");
    let grande = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg"><desc>{}</desc></svg>"#,
        "x".repeat(3_000)
    );
    let mut z = zip_de(&[("partituras/hino-1.svg", &grande)]);
    let real = (grande.len() as u32).to_le_bytes();
    let falso = 1u32.to_le_bytes();
    let mut trocas = 0;
    for i in 0..z.len() - 4 {
        if z[i..i + 4] == real {
            z[i..i + 4].copy_from_slice(&falso);
            trocas += 1;
        }
    }
    assert!(
        trocas >= 2,
        "o tamanho aparece no cabeçalho local e no diretório central ({trocas})"
    );
    let lim = Limites {
        descompactado: 20_000,
        ..pequenos()
    };
    let e = importar_zip_com(&d, &z, &lim).unwrap_err();
    assert_eq!(codigo(&e), "zip_invalido", "{e}");
    assert!(!d.join("partituras/hino-1.svg").exists());
    assert_eq!(arquivos(&d), ["hinario.json"], "nada é gravado");
    std::fs::remove_dir_all(&d).ok();
}
