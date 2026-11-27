//! Testes do pacote: a importação do zip: o que entra, o que é recusado e o que fica no disco.

use super::apoio::*;
use crate::pacote::tipos::*;
use crate::pacote::*;
use crate::svg;

// ---- importação ----

#[test]
fn importa_json_e_partituras() {
    let d = dir_com_hinario("ok");
    let r = importar_zip(&d, &pacote_ok()).unwrap();
    assert_eq!(r.partituras, 2);
    assert!(r.recusadas.is_empty());
    assert_eq!(r.pacote.partituras, vec![1, 283]);
    assert!(!r.pacote.exemplo && r.pacote.hinario.hinos.len() == 3);
    assert_eq!(
        arquivos(&d),
        [
            "hinario.json",
            "partituras",
            "partituras/.hinario",
            "partituras/hino-1.svg",
            "partituras/hino-283.svg"
        ]
    );
    // o app relê tudo do disco
    let lido = hinario::carregar(Some(&d)).unwrap();
    assert_eq!(lido.partituras, vec![1, 283]);
    // e o SVG gravado é o reescrito
    assert!(
        std::fs::read_to_string(d.join("partituras/hino-1.svg"))
            .unwrap()
            .starts_with("<svg xmlns=")
    );
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn importar_avisa_o_andamento_da_primeira_a_ultima_partitura() {
    let d = dir_com_hinario("andamento");
    // 25 arquivos: o aviso sai a cada 10 (posições 0, 10 e 20) e fecha com (total, total).
    let nomes: Vec<String> = (1..=25)
        .map(|n| format!("partituras/hino-{n}.svg"))
        .collect();
    let arquivos: Vec<(&str, &str)> = nomes.iter().map(|n| (n.as_str(), SVG)).collect();
    let z = zip_de(&arquivos);
    let texto = STANDARD.encode(&z);
    let mut avisos: Vec<(u32, u32)> = Vec::new();
    importar_base64_progresso(&d, &texto, &mut |feito, total| avisos.push((feito, total))).unwrap();
    assert_eq!(avisos, vec![(0, 25), (10, 25), (20, 25), (25, 25)]);
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn o_que_fica_no_disco_e_o_svg_reescrito_e_nao_o_original() {
    let d = dir_com_hinario("reescrito");
    let original = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\">\n  <g>\n    <path d=\"M0 0\"/>\n  </g>\n</svg>\n".to_string();
    let z = zip_de(&[("partituras/hino-1.svg", &original)]);
    importar_zip(&d, &z).unwrap();
    let gravado = std::fs::read_to_string(d.join("partituras/hino-1.svg")).unwrap();
    assert_eq!(gravado, svg::limpar(&original).unwrap());
    assert!(
        !gravado.contains("<?xml") && !gravado.contains("xlink") && !gravado.contains('\n'),
        "{gravado}"
    );
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn zip_sem_nenhuma_partitura_e_recusado() {
    let d = dir_com_hinario("sem_svg");
    for z in [zip_de(&[]), zip_de(&[("partituras/", "")])] {
        let e = importar_zip(&d, &z).unwrap_err();
        assert_eq!(codigo(&e), "partituras_nenhuma", "{e}");
    }
    assert_eq!(arquivos(&d), ["hinario.json"]);
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn svg_que_nao_passa_na_limpeza_e_recusado_e_o_resto_entra() {
    let d = dir_com_hinario("recusa");
    let z = zip_de(&[
        ("partituras/hino-1.svg", SVG),
        (
            "partituras/hino-2.svg",
            r#"<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>"#,
        ),
        ("partituras/hino-283.svg", "não é xml"),
    ]);
    let r = importar_zip(&d, &z).unwrap();
    assert_eq!(r.partituras, 1);
    assert_eq!(r.pacote.partituras, vec![1]);
    assert_eq!(r.recusadas.len(), 2);
    assert_eq!(r.recusadas[0].numero, 2);
    assert!(
        r.recusadas[0].motivo.contains("svg_elemento"),
        "{:?}",
        r.recusadas
    );
    assert_eq!(r.recusadas[1].numero, 283);
    assert!(r.recusadas[1].motivo.contains("svg_xml"));
    assert!(
        !d.join("partituras/hino-2.svg").exists() && !d.join("partituras/hino-283.svg").exists()
    );
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn svg_de_hino_que_o_hinario_nao_tem_e_recusado() {
    let d = dir_com_hinario("sem_hino");
    let z = zip_de(&[
        ("partituras/hino-1.svg", SVG),
        ("partituras/hino-77.svg", SVG),
    ]);
    let r = importar_zip(&d, &z).unwrap();
    assert_eq!(r.pacote.partituras, vec![1]);
    assert_eq!(
        r.recusadas,
        vec![Recusada {
            numero: 77,
            motivo: erro("pacote_sem_hino", &[])
        }]
    );
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn nenhuma_partitura_aceita_nao_deixa_pasta_nem_marca() {
    let d = dir_com_hinario("nenhuma");
    let z = zip_de(&[("partituras/hino-1.svg", "x")]);
    let r = importar_zip(&d, &z).unwrap();
    assert_eq!(r.partituras, 0);
    assert_eq!(r.recusadas.len(), 1);
    assert_eq!(arquivos(&d), ["hinario.json"]);
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn nome_inesperado_recusa_o_pacote_inteiro_sem_gravar_nada() {
    for ruim in [
        "../evil.svg",
        "partituras/../x.svg",
        "/abs.svg",
        "hinario.json.bak",
        "partituras/sub/hino-1.svg",
        "partituras/hino-01.svg",
        "partituras/hino-1.SVG",
        "partituras\\hino-1.svg",
        "leia-me.txt",
        "partituras/hino-1.timemap.json",
        "hinario.json",
    ] {
        let d = dir_com_hinario("inesperado");
        let z = zip_de(&[("partituras/hino-1.svg", SVG), (ruim, "x")]);
        let e = importar_zip(&d, &z).unwrap_err();
        assert_eq!(
            args(&e),
            vec!["zip_inesperado".to_string(), ruim.to_string()],
            "{ruim}"
        );
        assert_eq!(arquivos(&d), ["hinario.json"], "{ruim}");
        std::fs::remove_dir_all(&d).ok();
    }
}

#[test]
fn nome_repetido_recusa_o_pacote() {
    let d = dir_com_hinario("repetido");
    // "hino-2" e "hino-1" têm o mesmo tamanho: trocar os bytes do nome (na entrada e no diretório central) duplica a entrada.
    let z = zip_de(&[
        ("partituras/hino-1.svg", SVG),
        ("partituras/hino-2.svg", SVG),
    ]);
    let mut z = z;
    let alvo = b"hino-2";
    let mut achou = 0;
    for i in 0..z.len() - alvo.len() {
        if &z[i..i + alvo.len()] == alvo {
            z[i..i + alvo.len()].copy_from_slice(b"hino-1");
            achou += 1;
        }
    }
    assert_eq!(achou, 2, "o nome aparece na entrada e no diretório central");
    let e = importar_zip(&d, &z).unwrap_err();
    assert_eq!(codigo(&e), "zip_repetido", "{e}");
    assert_eq!(arquivos(&d), ["hinario.json"]);
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn zip_ruim_nao_grava_nada() {
    let d = dir_com_hinario("zip_ruim");
    for lixo in [&b""[..], b"nao e zip", b"PK\x03\x04quebrado", &[0u8; 64]] {
        assert_eq!(codigo(&importar_zip(&d, lixo).unwrap_err()), "zip_invalido");
    }
    assert_eq!(arquivos(&d), ["hinario.json"]);
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn sem_hinario_instalado_nao_importa_e_nao_grava_nada() {
    // as partituras valem para um hinário: sem ele não há como saber a que hinos pertencem
    let d = dir_teste("sem_hinario");
    let e = importar_zip(&d, &pacote_ok()).unwrap_err();
    assert_eq!(codigo(&e), "partituras_sem_hinario", "{e}");
    assert!(!d.exists() || arquivos(&d).is_empty(), "{:?}", arquivos(&d));
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn importar_partituras_nao_mexe_no_hinario_instalado() {
    let d = dir_com_hinario("hinario_intacto");
    let antes = std::fs::read(d.join("hinario.json")).unwrap();
    importar_zip(&d, &pacote_ok()).unwrap();
    assert_eq!(std::fs::read(d.join("hinario.json")).unwrap(), antes);
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn importar_de_novo_troca_as_partituras_antigas() {
    let d = dir_com_hinario("troca");
    importar_zip(&d, &pacote_ok()).unwrap();
    let z = zip_de(&[("partituras/hino-2.svg", SVG)]);
    let r = importar_zip(&d, &z).unwrap();
    assert_eq!(r.pacote.partituras, vec![2]);
    assert_eq!(
        arquivos(&d),
        [
            "hinario.json",
            "partituras",
            "partituras/.hinario",
            "partituras/hino-2.svg"
        ]
    );
    // um zip sem nenhuma partitura é recusado e as que já estavam ficam
    assert_eq!(
        codigo(&importar_zip(&d, &zip_de(&[])).unwrap_err()),
        "partituras_nenhuma"
    );
    assert_eq!(numeros(&d, "x").unwrap(), vec![2]);
    // todas as partituras do zip recusadas: também ficam as que já estavam
    let ruim = zip_de(&[
        ("partituras/hino-77.svg", SVG),
        ("partituras/hino-1.svg", "nao e svg"),
    ]);
    let r = importar_zip(&d, &ruim).unwrap();
    assert_eq!((r.partituras, r.recusadas.len()), (0, 2));
    assert_eq!(r.pacote.partituras, vec![2]);
    assert_eq!(numeros(&d, "x").unwrap(), vec![2]);
    assert!(!d.join("partituras.novo").exists());
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn sobra_de_importacao_interrompida_e_limpa() {
    let d = dir_com_hinario("sobra");
    std::fs::create_dir_all(d.join("partituras.novo")).unwrap();
    std::fs::write(d.join("partituras.novo/hino-9.svg"), "lixo").unwrap();
    importar_zip(&d, &pacote_ok()).unwrap();
    assert!(!d.join("partituras.novo").exists());
    assert!(!d.join("partituras/hino-9.svg").exists());
    assert!(!d.join("hinario.json.tmp").exists());
    std::fs::remove_dir_all(&d).ok();
}
