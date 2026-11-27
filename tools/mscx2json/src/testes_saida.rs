//! Testes do conversor sobre a saída do conversor, o relatório de avisos e o `--avisos`.

use crate::testes_apoio::*;

/// O hinário que `executar` monta a partir das partituras fictícias de `tests/fixtures` (a mesma conversão, sem passar pelo `stdout`).
fn hinario_das_fixtures() -> serde_json::Value {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
    let mut hinos: Vec<Hino> = vec![];
    for n in [1, 2, 3] {
        let xml = std::fs::read_to_string(dir.join(format!("hino-{n}.mscx"))).unwrap();
        let mut h = converter_com(&xml, n, &[]).unwrap();
        nomes_satb(&mut h);
        hinos.push(h);
    }
    json!({
        "versao": 1,
        "hinario": cabecalho("exemplo-conversor", "Fictício (conversor)", None),
        "hinos": hinos.iter().map(para_json).collect::<Vec<_>>(),
    })
}

#[test]
fn a_saida_do_conversor_bate_com_a_fixture_que_o_leitor_do_app_testa() {
    // `src-tauri` lê `tests/fixtures/hinario.json` num teste: se o conversor passa a gerar outra coisa (campo novo, final, introdução,
    // letra, compassos) e a fixture fica velha, o leitor continua "passando" com um JSON que o conversor não gera mais.
    // Para regenerar de propósito: BM_REGERAR_FIXTURE=1 cargo test a_saida_do_conversor
    let caminho = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/hinario.json");
    let atual = hinario_das_fixtures();
    if std::env::var("BM_REGERAR_FIXTURE").is_ok_and(|v| v == "1") {
        std::fs::write(&caminho, serde_json::to_string(&atual).unwrap()).unwrap();
    }
    let guardada: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(&caminho).unwrap()).unwrap();
    assert_eq!(
        atual, guardada,
        "a fixture hinario.json está velha: regenere com BM_REGERAR_FIXTURE=1 cargo test a_saida_do_conversor"
    );
    // O hino 3 exercita o que o app lê além das notas: final, introdução, letra, sincronia e compassos.
    let h3 = &atual["hinos"][2];
    for campo in ["final", "introducao", "letra", "sincronia", "compassos"] {
        assert!(
            h3.get(campo).is_some(),
            "o hino 3 da fixture deveria ter {campo}"
        );
    }
}

#[test]
fn relatorio_de_avisos_lista_por_hino_e_pula_os_sem_aviso() {
    let r = relatorio_de_avisos(&[
        (PathBuf::from("hino-1.mscx"), vec![]),
        (
            PathBuf::from("hino-2.mscx"),
            vec!["primeiro".into(), "segundo".into()],
        ),
    ]);
    assert_eq!(r, "hino-2.mscx\n  - primeiro\n  - segundo\n");
    assert_eq!(
        relatorio_de_avisos(&[(PathBuf::from("hino-1.mscx"), vec![])]),
        "sem avisos\n"
    );
}

/// Pasta temporária de um teste, apagada ao sair do escopo (mesmo se uma conferência falhar).
struct PastaTemp(PathBuf);

impl PastaTemp {
    fn nova(nome: &str) -> Self {
        let d = std::env::temp_dir().join(format!("mscx2json-{nome}-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        PastaTemp(d)
    }
}

impl Drop for PastaTemp {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn texto_args(v: &[&str]) -> Vec<String> {
    v.iter().map(|x| x.to_string()).collect()
}

#[test]
fn avisos_vao_para_o_arquivo_pedido() {
    let pasta = PastaTemp::nova("avisos");
    let dir = &pasta.0;
    let medidas = [comp_marcado("<startRepeat/>", 60), comp_marcado("", 62)].concat();
    std::fs::write(
        dir.join("hino-1.mscx"),
        doc(&parte(1, "S"), &pauta(1, &medidas)),
    )
    .unwrap();
    let relatorio = dir.join("avisos.txt");
    executar(texto_args(&[
        "--id",
        "x",
        "--nome",
        "X",
        "--avisos",
        relatorio.to_str().unwrap(),
        dir.to_str().unwrap(),
    ]))
    .unwrap();
    let texto = std::fs::read_to_string(&relatorio).unwrap();
    assert!(
        texto.contains("hino-1.mscx") && texto.contains("estrutura não reconhecida"),
        "{texto}"
    );
}

#[test]
fn avisos_recusa_o_que_nao_e_caminho_de_relatorio() {
    // o valor seguinte é outra opção, e não um caminho
    let e = executar(texto_args(&["--avisos", "--id", "x", "--nome", "X", "."])).unwrap_err();
    assert!(e.contains("--avisos precisa do caminho"), "{e}");
    // nunca grava sobre uma partitura
    let e = executar(texto_args(&[
        "--id",
        "x",
        "--nome",
        "X",
        "--avisos",
        "hino-1.mscx",
        "hino-1.mscx",
    ]))
    .unwrap_err();
    assert!(e.contains(".mscx"), "{e}");
}

#[test]
fn avisos_registra_o_erro_e_nao_deixa_relatorio_velho() {
    let pasta = PastaTemp::nova("avisos-erro");
    let dir = &pasta.0;
    let relatorio = dir.join("avisos.txt");
    std::fs::write(&relatorio, "velho").unwrap();
    std::fs::write(dir.join("hino-1.mscx"), "isto não é xml").unwrap();
    let e = executar(texto_args(&[
        "--id",
        "x",
        "--nome",
        "X",
        "--avisos",
        relatorio.to_str().unwrap(),
        dir.to_str().unwrap(),
    ]))
    .unwrap_err();
    let texto = std::fs::read_to_string(&relatorio).unwrap();
    assert_eq!(texto, format!("erro: {e}\n"));
}

#[test]
fn avisos_registra_arquivo_ignorado_e_correcao_sem_hino() {
    let pasta = PastaTemp::nova("avisos-ignorado");
    let dir = &pasta.0;
    let medidas = comp_marcado("", 60);
    std::fs::write(
        dir.join("coro-1.mscx"),
        doc(&parte(1, "S"), &pauta(1, &medidas)),
    )
    .unwrap();
    let relatorio = dir.join("avisos.txt");
    // todos os arquivos ignorados: não há hino algum e o relatório não pode dizer "sem avisos"
    let _ = executar(texto_args(&[
        "--id",
        "x",
        "--nome",
        "X",
        "--avisos",
        relatorio.to_str().unwrap(),
        dir.join("coro-1.mscx").to_str().unwrap(),
    ]));
    let texto = std::fs::read_to_string(&relatorio).unwrap();
    assert!(
        texto.contains("coro-1.mscx") && texto.contains("ignorado") || texto.starts_with("erro: "),
        "{texto}"
    );
    assert!(!texto.contains("sem avisos"), "{texto}");
}

#[test]
fn hino_sem_compassos_nao_tem_o_campo() {
    let mut h = converter(&hino_com_asterisco(), 1).unwrap();
    h.compassos = None;
    assert!(para_json(&h).get("compassos").is_none());
}

#[test]
fn compassos_da_passada_desloca_cada_intervalo_pelo_acumulado() {
    // 4 compassos de 2 batidas; passada = compassos [0,1) e [2,4): o 2º intervalo recomeça em 2 (acumulado), e não em 4
    let inicios = [0.0, 2.0, 4.0, 6.0, 8.0];
    assert_eq!(
        compassos_da_passada(&inicios, &[(0, 1), (2, 4)]),
        vec![(0.0, 0), (2.0, 2), (4.0, 3)]
    );
    assert_eq!(
        compassos_da_passada(&inicios, &[(0, 4)]),
        vec![(0.0, 0), (2.0, 1), (4.0, 2), (6.0, 3)]
    );
    assert!(compassos_da_passada(&inicios, &[]).is_empty());
}

#[test]
fn compassos_da_introducao_com_poucos_inicios_nao_estoura() {
    assert!(compassos_da_introducao(&[], 5.0).is_empty());
    assert!(compassos_da_introducao(&[0.0], 5.0).is_empty()); // só o "fim da partitura", sem nenhum compasso
    assert_eq!(
        compassos_da_introducao(&[0.0, 4.0, 8.0], 6.0),
        vec![(0.0, 0), (4.0, 1)]
    );
}
