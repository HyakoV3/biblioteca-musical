//! Testes do pacote: as versões de retrato e de paisagem.

use super::apoio::*;
use crate::pacote::*;

// ---- versões de retrato e de paisagem ----

#[test]
fn importa_as_duas_versoes_e_a_contagem_e_de_hinos() {
    let d = dir_com_hinario("variantes");
    let r = importar_zip(&d, &pacote_com_paisagem()).unwrap();
    assert_eq!(
        r.partituras, 2,
        "duas partituras (hinos), e não quatro arquivos"
    );
    assert_eq!(r.pacote.partituras, vec![1, 283]);
    assert!(r.recusadas.is_empty());
    assert_eq!(
        arquivos(&d),
        [
            "hinario.json",
            "partituras",
            "partituras/.hinario",
            "partituras/hino-1-paisagem.svg",
            "partituras/hino-1.svg",
            "partituras/hino-283-paisagem.svg",
            "partituras/hino-283.svg"
        ]
    );
    // o app relê do disco: a lista de hinos não duplica
    assert_eq!(
        hinario::carregar(Some(&d)).unwrap().partituras,
        vec![1, 283]
    );
    assert_eq!(numeros(&d, "x").unwrap(), vec![1, 283]);
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn le_a_versao_pedida_e_a_paisagem_ausente_volta_para_o_retrato() {
    let d = dir_com_hinario("le_variante");
    importar_zip(&d, &pacote_com_paisagem()).unwrap();
    let retrato = ler_partitura(&d, 1, false).unwrap();
    let paisagem = ler_partitura(&d, 1, true).unwrap();
    assert!(
        retrato.contains("viewBox=\"0 0 10 10\"") && !retrato.contains("larga"),
        "{retrato}"
    );
    assert!(
        paisagem.contains("viewBox=\"0 0 30 10\"") && paisagem.contains("larga"),
        "{paisagem}"
    );
    // sem a paisagem no pacote: a de retrato serve nas duas telas
    importar_zip(&d, &zip_de(&[("partituras/hino-2.svg", SVG)])).unwrap();
    assert_eq!(
        ler_partitura(&d, 2, true).unwrap(),
        ler_partitura(&d, 2, false).unwrap()
    );
    // e sem o hino, nenhuma das duas
    for paisagem in [false, true] {
        assert_eq!(
            codigo(&ler_partitura(&d, 1, paisagem).unwrap_err()),
            "sem_partitura"
        );
    }
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn so_com_a_paisagem_a_partitura_e_recusada_e_o_retrato_nao_e_inventado() {
    let d = dir_com_hinario("so_paisagem");
    let z = zip_de(&[
        ("partituras/hino-1-paisagem.svg", SVG_LARGO),
        ("partituras/hino-2.svg", SVG),
    ]);
    let r = importar_zip(&d, &z).unwrap();
    assert_eq!(r.pacote.partituras, vec![2]);
    assert_eq!(r.recusadas.len(), 1);
    assert_eq!(r.recusadas[0].numero, 1);
    assert!(
        r.recusadas[0].motivo.starts_with("[\"svg_paisagem\""),
        "{:?}",
        r.recusadas
    );
    assert!(
        r.recusadas[0].motivo.contains("pacote_sem_retrato"),
        "{:?}",
        r.recusadas
    );
    assert!(!d.join("partituras/hino-1-paisagem.svg").exists());
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn paisagem_que_nao_passa_na_limpeza_e_recusada_mas_o_retrato_entra() {
    let d = dir_com_hinario("paisagem_ruim");
    let z = zip_de(&[
        ("partituras/hino-1.svg", SVG),
        (
            "partituras/hino-1-paisagem.svg",
            r#"<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>"#,
        ),
    ]);
    let r = importar_zip(&d, &z).unwrap();
    assert_eq!(r.pacote.partituras, vec![1]);
    assert_eq!(r.recusadas.len(), 1);
    assert!(
        r.recusadas[0].motivo.starts_with("[\"svg_paisagem\"")
            && r.recusadas[0].motivo.contains("svg_elemento"),
        "{:?}",
        r.recusadas
    );
    assert!(
        d.join("partituras/hino-1.svg").exists()
            && !d.join("partituras/hino-1-paisagem.svg").exists()
    );
    // sem a paisagem, a leitura em tela larga cai no retrato
    assert_eq!(
        ler_partitura(&d, 1, true).unwrap(),
        ler_partitura(&d, 1, false).unwrap()
    );
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn paisagem_de_hino_que_o_hinario_nao_tem_e_recusada() {
    let d = dir_com_hinario("paisagem_sem_hino");
    let z = zip_de(&[
        ("partituras/hino-1.svg", SVG),
        ("partituras/hino-77.svg", SVG),
        ("partituras/hino-77-paisagem.svg", SVG),
    ]);
    let r = importar_zip(&d, &z).unwrap();
    assert_eq!(r.pacote.partituras, vec![1]);
    // o hino 77 aparece UMA vez (pelo retrato); a paisagem dele é pulada, não contada de novo
    assert_eq!(r.recusadas.len(), 1);
    assert_eq!(r.recusadas[0].numero, 77);
    assert_eq!(r.recusadas[0].motivo, erro("pacote_sem_hino", &[]));
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn so_a_paisagem_de_hino_que_o_hinario_nao_tem_e_recusada_uma_vez() {
    let d = dir_com_hinario("so_paisagem_sem_hino");
    let z = zip_de(&[
        ("partituras/hino-1.svg", SVG),
        ("partituras/hino-77-paisagem.svg", SVG),
    ]);
    let r = importar_zip(&d, &z).unwrap();
    assert_eq!(r.pacote.partituras, vec![1]);
    assert_eq!(r.recusadas.len(), 1, "{:?}", r.recusadas);
    assert_eq!(r.recusadas[0].numero, 77);
    assert_eq!(
        r.recusadas[0].motivo,
        erro("svg_paisagem", &[erro("pacote_sem_hino", &[])])
    );
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn retrato_recusado_nao_gera_uma_segunda_recusa_pela_paisagem() {
    // o retrato do hino 1 não passa na limpeza: uma recusa, com o motivo verdadeiro (e não "falta a versão de retrato")
    let d = dir_com_hinario("retrato_ruim");
    let z = zip_de(&[
        (
            "partituras/hino-1.svg",
            r#"<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>"#,
        ),
        ("partituras/hino-1-paisagem.svg", SVG_LARGO),
        ("partituras/hino-283.svg", SVG),
    ]);
    let r = importar_zip(&d, &z).unwrap();
    assert_eq!(r.pacote.partituras, vec![283]);
    assert_eq!(r.recusadas.len(), 1, "{:?}", r.recusadas);
    assert_eq!(r.recusadas[0].numero, 1);
    assert!(
        r.recusadas[0].motivo.contains("svg_elemento")
            && !r.recusadas[0].motivo.contains("svg_paisagem"),
        "{:?}",
        r.recusadas
    );
    assert!(!d.join("partituras/hino-1-paisagem.svg").exists());
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn a_paisagem_tambem_e_limpa_na_leitura_e_tem_o_limite_de_tamanho() {
    let d = dir_com_hinario("paisagem_adulterada");
    importar_zip(&d, &pacote_com_paisagem()).unwrap();
    std::fs::write(
        d.join("partituras/hino-1-paisagem.svg"),
        r#"<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>"#,
    )
    .unwrap();
    // a paisagem recusada não derruba o hino: a leitura cai no retrato
    assert_eq!(
        ler_partitura(&d, 1, true).unwrap(),
        ler_partitura(&d, 1, false).unwrap()
    );
    std::fs::write(
        d.join("partituras/hino-283-paisagem.svg"),
        vec![b'x'; (Limites::default().svg + 1) as usize],
    )
    .unwrap();
    assert_eq!(
        ler_partitura(&d, 283, true).unwrap(),
        ler_partitura(&d, 283, false).unwrap()
    );
    // o retrato recusado continua sendo erro, com o motivo
    std::fs::write(
        d.join("partituras/hino-283.svg"),
        vec![b'x'; (Limites::default().svg + 1) as usize],
    )
    .unwrap();
    let e = ler_partitura(&d, 283, false).unwrap_err();
    assert_eq!(codigo(&e), "partitura_invalida");
    assert!(args(&e)[2].contains("pacote_svg_grande"), "{e}");
    // sem retrato, só a paisagem recusada: o motivo dela é o erro
    std::fs::remove_file(d.join("partituras/hino-283.svg")).unwrap();
    let e = ler_partitura(&d, 283, true).unwrap_err();
    assert!(args(&e)[2].contains("pacote_svg_grande"), "{e}");
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn paisagem_solta_no_disco_sem_o_retrato_nao_conta_como_partitura() {
    // um arquivo de paisagem sem o retrato do mesmo hino (adulterado ou sobra) não faz o hino "ter partitura": a aba apareceria e a
    // leitura em retrato falharia
    let d = dir_com_hinario("paisagem_solta");
    importar_zip(&d, &pacote_com_paisagem()).unwrap();
    std::fs::write(d.join("partituras/hino-2-paisagem.svg"), SVG_LARGO).unwrap();
    assert_eq!(numeros(&d, "x").unwrap(), vec![1, 283]);
    std::fs::remove_file(d.join("partituras/hino-1.svg")).unwrap();
    assert_eq!(
        numeros(&d, "x").unwrap(),
        vec![283],
        "a paisagem do hino 1 continua lá, mas sozinha não conta"
    );
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn importar_de_novo_troca_as_duas_versoes_e_remover_apaga_tudo() {
    let d = dir_com_hinario("troca_variantes");
    importar_zip(&d, &pacote_com_paisagem()).unwrap();
    // um pacote só com retratos tira as paisagens antigas
    importar_zip(&d, &zip_de(&[("partituras/hino-1.svg", SVG)])).unwrap();
    assert_eq!(
        arquivos(&d),
        [
            "hinario.json",
            "partituras",
            "partituras/.hinario",
            "partituras/hino-1.svg"
        ]
    );
    importar_zip(&d, &pacote_com_paisagem()).unwrap();
    assert!(
        hinario::remover_partituras(&d)
            .unwrap()
            .partituras
            .is_empty()
    );
    assert_eq!(arquivos(&d), ["hinario.json"]);
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn os_limites_contam_os_dois_arquivos_de_cada_hino() {
    let d = dir_com_hinario("lim_variantes");
    let z = pacote_com_paisagem(); // 4 arquivos
    assert!(
        importar_zip_com(
            &d,
            &z,
            &Limites {
                entradas: 4,
                ..pequenos()
            }
        )
        .is_ok()
    );
    let e = importar_zip_com(
        &d,
        &z,
        &Limites {
            entradas: 3,
            ..pequenos()
        },
    )
    .unwrap_err();
    assert_eq!(codigo(&e), "zip_muitos_arquivos");
    let total = (SVG.len() * 2 + SVG_LARGO.len() * 2) as u64;
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
