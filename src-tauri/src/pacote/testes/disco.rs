//! Testes do pacote: o JSON sozinho, a remoção, a leitura e as falhas de leitura.

use super::apoio::*;
use crate::pacote::*;

// ---- JSON sozinho, remoção e leitura ----

#[test]
fn remover_so_as_partituras_mantem_o_hinario() {
    let d = dir_com_hinario("remover_so_partituras");
    importar_zip(&d, &pacote_ok()).unwrap();
    let p = hinario::remover_partituras(&d).unwrap();
    assert!(p.partituras.is_empty());
    assert!(!p.exemplo, "o hinário importado continua");
    assert_eq!(p.hinario.hinario.id, "x");
    assert_eq!(arquivos(&d), ["hinario.json"]);
    // sem partituras (ou chamado de novo) também dá certo
    assert!(
        hinario::remover_partituras(&d)
            .unwrap()
            .partituras
            .is_empty()
    );
    // e dá para importar de novo
    assert_eq!(importar_zip(&d, &pacote_ok()).unwrap().partituras, 2);
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn importar_json_do_mesmo_hinario_mantem_as_partituras() {
    let d = dir_com_hinario("json_mesmo");
    importar_zip(&d, &pacote_ok()).unwrap();
    let p = hinario::importar(&d, JSON).unwrap();
    assert_eq!(p.partituras, vec![1, 283]);
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn importar_json_de_outro_hinario_apaga_as_partituras() {
    let d = dir_com_hinario("json_outro");
    importar_zip(&d, &pacote_ok()).unwrap();
    let outro = JSON.replace(r#""id":"x""#, r#""id":"y""#);
    let p = hinario::importar(&d, &outro).unwrap();
    assert!(p.partituras.is_empty());
    assert!(!d.join("partituras").exists());
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn remover_apaga_as_partituras_e_volta_ao_exemplo() {
    let d = dir_com_hinario("remover");
    importar_zip(&d, &pacote_ok()).unwrap();
    let p = hinario::remover(&d).unwrap();
    assert!(p.exemplo && p.partituras == crate::exemplo::numeros());
    assert!(arquivos(&d).is_empty(), "{:?}", arquivos(&d));
    assert!(hinario::remover(&d).unwrap().exemplo); // idempotente
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn numeros_ignora_marca_de_outro_hinario_e_arquivos_estranhos() {
    let d = dir_com_hinario("numeros");
    importar_zip(&d, &pacote_ok()).unwrap();
    std::fs::write(d.join("partituras/hino-5.svg.bak"), "x").unwrap();
    std::fs::write(d.join("partituras/leia-me.txt"), "x").unwrap();
    std::fs::write(d.join("partituras/hino-007.svg"), "x").unwrap();
    assert_eq!(numeros(&d, "x").unwrap(), vec![1, 283]);
    assert!(numeros(&d, "outro").unwrap().is_empty());
    assert!(numeros(&d, "").unwrap().is_empty());
    assert!(numeros(&dir_teste("nao_existe"), "x").unwrap().is_empty());
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn id_com_caracteres_estranhos_funciona_como_marca() {
    let d = dir_teste("id_estranho");
    let json = JSON.replace(r#""id":"x""#, r#""id":" a\nb\"c ""#);
    hinario::importar(&d, &json).unwrap();
    let z = zip_de(&[("partituras/hino-1.svg", SVG)]);
    let r = importar_zip(&d, &z).unwrap();
    assert_eq!(r.pacote.partituras, vec![1]);
    assert_eq!(hinario::carregar(Some(&d)).unwrap().partituras, vec![1]);
    assert!(
        numeros(&d, "a\nb\"c").unwrap().is_empty(),
        "a marca é exata"
    );
    std::fs::remove_dir_all(&d).ok();
}

// ---- falhas de leitura não viram "sem partitura" nem apagam nada ----

/// Deixa `partituras/.hinario` ilegível (um diretório no lugar do arquivo: o erro não é "não existe").
fn estraga_a_marca(d: &Path) {
    std::fs::remove_file(d.join("partituras/.hinario")).unwrap();
    std::fs::create_dir(d.join("partituras/.hinario")).unwrap();
}

#[test]
fn marca_ilegivel_nao_apaga_as_partituras_e_o_erro_sobe() {
    let d = dir_com_hinario("marca_ilegivel");
    importar_zip(&d, &pacote_ok()).unwrap();
    estraga_a_marca(&d);
    // alinhar (importar um JSON de outro hinário) NÃO pode tratar "não consegui ler" como "é de outro hinário"
    assert_eq!(codigo(&alinhar(&d, "outro").unwrap_err()), "partituras_ler");
    assert!(d.join("partituras/hino-1.svg").exists() && d.join("partituras/hino-283.svg").exists());
    assert_eq!(codigo(&numeros(&d, "x").unwrap_err()), "partituras_ler");
    let outro = JSON.replace(r#""id":"x""#, r#""id":"y""#);
    assert_eq!(
        codigo(&hinario::importar(&d, &outro).unwrap_err()),
        "partituras_ler"
    );
    assert!(
        d.join("partituras/hino-1.svg").exists(),
        "as partituras continuam lá"
    );
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn sem_marca_e_sem_pasta_e_so_ausencia_e_nao_erro() {
    let d = dir_com_hinario("sem_marca");
    assert!(numeros(&d, "x").unwrap().is_empty()); // nem a pasta existe
    std::fs::create_dir_all(d.join("partituras")).unwrap();
    std::fs::write(d.join("partituras/hino-1.svg"), SVG).unwrap();
    assert!(numeros(&d, "x").unwrap().is_empty()); // pasta sem marca: não é deste hinário
    alinhar(&d, "x").unwrap(); // e aí sim é apagada
    assert!(!d.join("partituras").exists());
    std::fs::remove_dir_all(&d).ok();
}

#[cfg(unix)]
#[test]
fn pasta_de_partituras_que_nao_da_para_listar_e_erro_e_nao_lista_vazia() {
    use std::os::unix::fs::PermissionsExt;
    let d = dir_com_hinario("sem_listar");
    importar_zip(&d, &pacote_ok()).unwrap();
    let pasta = d.join("partituras");
    // só "x": dá para abrir o .hinario pelo caminho, mas não listar a pasta
    std::fs::set_permissions(&pasta, std::fs::Permissions::from_mode(0o100)).unwrap();
    let resultado = if std::fs::read_dir(&pasta).is_ok() {
        None // rodando como root: as permissões não valem, e não há o que provar aqui
    } else {
        Some(numeros(&d, "x"))
    };
    std::fs::set_permissions(&pasta, std::fs::Permissions::from_mode(0o755)).unwrap();
    if let Some(r) = resultado {
        assert_eq!(codigo(&r.unwrap_err()), "partituras_ler");
    }
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn le_a_partitura_pelo_numero() {
    let d = dir_com_hinario("partituras_ler");
    importar_zip(&d, &pacote_ok()).unwrap();
    let svg = ler_partitura(&d, 283, false).unwrap();
    assert!(
        svg.starts_with("<svg xmlns=") && svg.contains("<path d=\"M0 0L1 1\"></path>"),
        "{svg}"
    );
    assert_eq!(
        args(&ler_partitura(&d, 2, false).unwrap_err()),
        vec!["sem_partitura".to_string(), "2".to_string()]
    );
    std::fs::remove_dir_all(&d).ok();
}

#[test]
fn leitura_limpa_de_novo_e_recusa_arquivo_adulterado() {
    let d = dir_com_hinario("adulterado");
    importar_zip(&d, &pacote_ok()).unwrap();
    std::fs::write(
        d.join("partituras/hino-1.svg"),
        r#"<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>"#,
    )
    .unwrap();
    let e = ler_partitura(&d, 1, false).unwrap_err();
    let a = args(&e);
    assert_eq!((a[0].as_str(), a[1].as_str()), ("partitura_invalida", "1"));
    assert!(a[2].contains("svg_elemento"), "{e}");
    // arquivo grande demais
    std::fs::write(
        d.join("partituras/hino-283.svg"),
        vec![b'x'; (Limites::default().svg + 1) as usize],
    )
    .unwrap();
    let e = ler_partitura(&d, 283, false).unwrap_err();
    assert_eq!(codigo(&e), "partitura_invalida");
    assert!(args(&e)[2].contains("pacote_svg_grande"), "{e}"); // pelo tamanho, antes de tentar ler
    std::fs::remove_dir_all(&d).ok();
}
