//! Testes do pacote: o conteúdo real do responsável (fora do `cargo test` normal) e o pacote real.

use super::apoio::*;
use crate::pacote::tipos::*;
use crate::pacote::*;

/// Confere um hinário e um pacote REAIS (os do responsável, que não vão para o Git): `BM_HINARIO` (o `.json`) e `BM_ZIP`
/// (o pacote de partituras). Passa o hinário pelo leitor e cada SVG pela limpeza do app, e falha se alguma partitura for recusada ou
/// não puder ser lida de volta. Fora do `cargo test` normal:
/// `BM_HINARIO=... BM_ZIP=... cargo test --lib conteudo_real -- --ignored --nocapture`.
#[test]
#[ignore = "precisa dos arquivos reais (BM_HINARIO e BM_ZIP)"]
fn conteudo_real() {
    let json = std::fs::read_to_string(std::env::var("BM_HINARIO").expect("BM_HINARIO")).unwrap();
    let zip = std::fs::read(std::env::var("BM_ZIP").expect("BM_ZIP")).unwrap();
    let d = dir_teste("real");
    let p = hinario::importar(&d, &json).unwrap();
    println!("hinário lido: {} hinos", p.hinario.hinos.len());
    let r = importar_zip(&d, &zip).unwrap();
    println!(
        "partituras importadas: {}; recusadas: {}",
        r.partituras,
        r.recusadas.len()
    );
    for x in r.recusadas.iter().take(40) {
        println!("  recusada {}: {}", x.numero, x.motivo);
    }
    let numeros = numeros(&d, &p.hinario.hinario.id).unwrap();
    let mut falhas = 0;
    for n in &numeros {
        for paisagem in [false, true] {
            if let Err(e) = ler_partitura(&d, *n, paisagem) {
                println!("  leitura falhou: hino {n}, paisagem={paisagem}: {e}");
                falhas += 1;
            }
        }
    }
    println!(
        "hinos com partitura: {}; leituras com falha: {falhas}",
        numeros.len()
    );
    // a pasta de teste guarda o hinário e as partituras limpas (dezenas de MB): sai antes do assert, para valer também na falha
    std::fs::remove_dir_all(&d).ok();
    assert!(
        r.partituras > 0 && !numeros.is_empty(),
        "nenhuma partitura importada"
    );
    assert!(r.recusadas.is_empty() && falhas == 0);
}

/// Importa um pacote de partituras de verdade (não versionado), para o hinário real:
/// `BM_HINARIO=hinario.json BM_PACOTE_ZIP=partituras.zip cargo test pacote_real -- --ignored --nocapture`.
/// Confere que nada foi recusado e que cada partitura importada pode ser lida de volta.
#[test]
#[ignore = "defina BM_HINARIO=hinario.json e BM_PACOTE_ZIP=caminho/para/partituras.zip"]
fn pacote_real_e_importado_e_lido_de_volta() {
    let caminho = std::env::var("BM_PACOTE_ZIP").expect("defina BM_PACOTE_ZIP");
    let bytes = std::fs::read(&caminho).unwrap();
    let json =
        std::fs::read_to_string(std::env::var("BM_HINARIO").expect("defina BM_HINARIO")).unwrap();
    let d = dir_teste("real");
    hinario::importar(&d, &json).unwrap();
    let inicio = std::time::Instant::now();
    let r = importar_zip(&d, &bytes).unwrap();
    println!(
        "{} hinos, {} partituras importadas, {} recusadas, em {:?} (zip de {} bytes)",
        r.pacote.hinario.hinos.len(),
        r.partituras,
        r.recusadas.len(),
        inicio.elapsed(),
        bytes.len()
    );
    assert!(r.recusadas.is_empty(), "recusadas: {:?}", r.recusadas);
    assert!(r.partituras > 0, "o pacote não tem nenhuma partitura");
    let carregado = hinario::carregar(Some(&d)).unwrap();
    assert_eq!(carregado.partituras, r.pacote.partituras);
    let mut com_paisagem = 0;
    for n in &carregado.partituras {
        let retrato = ler_partitura(&d, *n, false).unwrap();
        assert!(retrato.starts_with("<svg xmlns="), "hino {n}");
        let paisagem = ler_partitura(&d, *n, true).unwrap();
        assert!(paisagem.starts_with("<svg xmlns="), "hino {n} (paisagem)");
        // se o pacote trouxe a paisagem, ela é outro desenho (outra largura de página); se não, vale o retrato
        if d.join("partituras")
            .join(Variante::Paisagem.arquivo(*n))
            .exists()
        {
            com_paisagem += 1;
            assert_ne!(paisagem, retrato, "hino {n}: a paisagem é igual ao retrato");
        } else {
            assert_eq!(paisagem, retrato, "hino {n}");
        }
    }
    println!(
        "{com_paisagem} de {} com versão de paisagem",
        carregado.partituras.len()
    );
    std::fs::remove_dir_all(&d).ok();
}
