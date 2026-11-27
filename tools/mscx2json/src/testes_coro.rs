//! Testes do conversor sobre o coro, o final e o refrão com estrofe trocada.

use crate::testes_apoio::*;

// --- Coro do final: vai para a última estrofe. Texto fictício. ---

fn silaba_em(t: f64, verso: u32, texto: &str) -> Silaba {
    Silaba {
        t,
        voz: 0,
        verso,
        continua: false,
        quebra_antes: false,
        texto: texto.to_string(),
    }
}

/// Três estrofes de duas sílabas (tempos 0 a 5, com a estrofe 3 entre 4 e 5) e o coro depois (tempos 10 e 11).
fn estrofes_com_coro(verso_do_coro: u32) -> Vec<Silaba> {
    vec![
        silaba_em(0.0, 0, "alfa"),
        silaba_em(1.0, 0, "beta"),
        silaba_em(2.0, 1, "gama"),
        silaba_em(3.0, 1, "delta"),
        silaba_em(4.0, 2, "eta"),
        silaba_em(5.0, 2, "teta"),
        silaba_em(10.0, verso_do_coro, "coro"),
        silaba_em(11.0, verso_do_coro, "final"),
    ]
}

#[test]
fn o_fecho_da_ultima_estrofe_escrito_sob_a_estrofe_1_fica_na_ultima_e_so_o_resto_vira_final() {
    // a 2ª casa começa em 10: "g" (sob a estrofe 1) fecha a última estrofe, que termina em 10,5; o coro vem depois
    let mut s = vec![
        silaba_em(0.0, 0, "alfa"),
        silaba_em(2.0, 1, "gama"),
        silaba_em(4.0, 2, "eta"),
        silaba_em(10.0, 0, "g"),
        silaba_em(10.5, 2, "fim"),
        silaba_em(11.0, 0, "coro"),
        silaba_em(12.0, 0, "final"),
    ];
    assert_eq!(separar_o_final(&mut s, 10.0), 2);
    let (letra, _) = montar_letra(s, vec![]);
    assert_eq!(
        letra,
        vec![
            "1. alfa",
            "",
            "2. gama",
            "",
            "3. eta g fim",
            "",
            "Final. coro final"
        ]
    );
}

#[test]
fn texto_do_final_escrito_sob_a_estrofe_1_vira_o_bloco_final_depois_da_ultima() {
    let mut s = estrofes_com_coro(0);
    separar_o_final(&mut s, 10.0);
    let (letra, _) = montar_letra(s, vec![9.5]);
    assert_eq!(
        letra,
        vec![
            "1. alfa beta",
            "",
            "2. gama delta",
            "",
            "3. eta teta",
            "",
            "Final. coro final"
        ]
    );
}

#[test]
fn coro_que_ja_esta_na_ultima_estrofe_fica_como_esta() {
    let mut s = estrofes_com_coro(2);
    separar_o_final(&mut s, 10.0);
    assert!(s.iter().filter(|x| x.t >= 10.0).all(|x| x.verso == 2));
    assert!(
        s.iter()
            .filter(|x| x.t < 10.0)
            .map(|x| x.verso)
            .eq([0, 0, 1, 1, 2, 2])
    );
}

#[test]
fn coro_sob_mais_de_uma_estrofe_nao_e_mexido() {
    // Texto do final sob as estrofes 1 e 2: não há como saber a qual pertence cada trecho.
    let mut s = estrofes_com_coro(0);
    s[7].verso = 1;
    separar_o_final(&mut s, 10.0);
    assert_eq!((s[6].verso, s[7].verso), (0, 1));
}

#[test]
fn refrao_com_as_primeiras_silabas_na_estrofe_errada_volta_para_a_estrofe_do_resto() {
    // estrofes 0, 1 e 2 juntas nos tempos 0 a 2; depois o refrão (3 a 6): as duas primeiras sílabas marcadas como estrofe 1.
    let mut s = vec![
        silaba_em(0.0, 0, "a"),
        silaba_em(0.0, 1, "b"),
        silaba_em(0.0, 2, "c"),
        silaba_em(2.0, 0, "d"),
        silaba_em(2.0, 1, "e"),
        silaba_em(2.0, 2, "f"),
        silaba_em(3.0, 1, "A"),
        silaba_em(4.0, 1, "Ro"),
        silaba_em(5.0, 0, "cha"),
        silaba_em(6.0, 0, "eternal"),
    ];
    assert_eq!(refrao_com_estrofe_trocada(&mut s), 2);
    let versos: Vec<u32> = s.iter().filter(|x| x.t >= 3.0).map(|x| x.verso).collect();
    assert_eq!(versos, vec![0, 0, 0, 0]);
    // as estrofes em si não mudam
    assert_eq!(s.iter().filter(|x| x.t < 3.0 && x.verso == 1).count(), 2);
}

#[test]
fn silaba_sem_letra_solta_no_refrao_nao_conta_como_estrofe_junta() {
    // o "'" da estrofe 0 cai junto com "deira," da estrofe 1 depois das estrofes (hino 399): não prende o corte
    let mut s = vec![
        silaba_em(0.0, 0, "a"),
        silaba_em(0.0, 1, "b"),
        silaba_em(3.0, 1, "És"),
        silaba_em(4.0, 1, "deira,"),
        silaba_em(4.0, 0, "'"),
        silaba_em(5.0, 0, "ó"),
        silaba_em(6.0, 0, "Rei"),
    ];
    assert_eq!(refrao_com_estrofe_trocada(&mut s), 2);
    assert!(s.iter().filter(|x| x.t >= 3.0).all(|x| x.verso == 0));
}

#[test]
fn sem_resto_depois_das_estrofes_nada_muda() {
    let mut s = vec![
        silaba_em(0.0, 0, "a"),
        silaba_em(0.0, 1, "b"),
        silaba_em(1.0, 0, "c"),
        silaba_em(1.0, 1, "d"),
    ];
    assert_eq!(refrao_com_estrofe_trocada(&mut s), 0);
}

#[test]
fn resto_ja_numa_estrofe_so_nao_muda() {
    // a última estrofe é mais comprida: depois das juntas só existe a estrofe 1, então não há o que corrigir
    let mut s = vec![
        silaba_em(0.0, 0, "a"),
        silaba_em(0.0, 1, "b"),
        silaba_em(2.0, 1, "c"),
        silaba_em(3.0, 1, "d"),
    ];
    assert_eq!(refrao_com_estrofe_trocada(&mut s), 0);
    assert!(s.iter().filter(|x| x.t >= 2.0).all(|x| x.verso == 1));
}

#[test]
fn empate_no_resto_fica_com_a_menor_estrofe() {
    let mut s = vec![
        silaba_em(0.0, 0, "a"),
        silaba_em(0.0, 1, "b"),
        silaba_em(3.0, 1, "x"),
        silaba_em(4.0, 0, "y"),
    ];
    assert_eq!(refrao_com_estrofe_trocada(&mut s), 1);
    assert!(s.iter().filter(|x| x.t >= 3.0).all(|x| x.verso == 0));
}

#[test]
fn o_que_sobra_depois_das_estrofes_vira_o_coro() {
    // estrofes 0 e 1 juntas nos tempos 0 e 1; depois, 6 sílabas só da estrofe 0: o coro
    let mut s = vec![
        silaba_em(0.0, 0, "a"),
        silaba_em(0.0, 1, "b"),
        silaba_em(1.0, 0, "c"),
        silaba_em(1.0, 1, "d"),
    ];
    for (i, x) in ["A", "Ro", "cha", "ce", "les", "tial"].iter().enumerate() {
        s.push(silaba_em(3.0 + i as f64, 0, x));
    }
    assert_eq!(separar_o_coro(&mut s), 6);
    assert!(s.iter().filter(|x| x.t >= 3.0).all(|x| x.verso == CORO));
    assert!(s.iter().filter(|x| x.t < 3.0).all(|x| x.verso != CORO));
    let (letra, marcas) = montar_letra(s, vec![]);
    assert_eq!(
        letra,
        vec!["1. a c", "", "Coro. A Ro cha ce les tial", "", "2. b d"]
    );
    assert!(marcas.iter().any(|m| m.verso == CORO));
}

fn base_de_duas_estrofes() -> Vec<Silaba> {
    vec![
        silaba_em(0.0, 0, "a"),
        silaba_em(0.0, 1, "b"),
        silaba_em(1.0, 0, "c"),
        silaba_em(1.0, 1, "d"),
    ]
}

#[test]
fn final_mais_longo_da_ultima_estrofe_nao_e_coro() {
    // o resto está na estrofe de maior número (a 1): é só a última estrofe, mais comprida
    let mut s = base_de_duas_estrofes();
    for i in 0..8 {
        s.push(silaba_em(3.0 + i as f64, 1, "xis"));
    }
    assert_eq!(separar_o_coro(&mut s), 0);
    assert!(s.iter().all(|x| x.verso != CORO));
}

#[test]
fn silaba_repetida_em_duas_vozes_conta_uma_vez() {
    // 3 sílabas escritas nas duas vozes = 3, abaixo do mínimo
    let mut s = base_de_duas_estrofes();
    for i in 0..3 {
        let mut a = silaba_em(3.0 + i as f64, 0, "fim");
        a.voz = 0;
        let mut b = silaba_em(3.0 + i as f64, 0, "fim");
        b.voz = 1;
        s.push(a);
        s.push(b);
    }
    assert_eq!(separar_o_coro(&mut s), 0);
}

#[test]
fn corte_no_meio_de_uma_palavra_deixa_o_pedaco_na_estrofe() {
    // "gló-ri-a": "gló" canta junto com a estrofe 1 (é o último instante com estrofes juntas); "ri" e "a" vêm depois
    let mut glo = silaba_em(1.0, 0, "gló");
    glo.continua = true;
    let mut ri = silaba_em(2.0, 0, "ri");
    ri.continua = true;
    let mut s = vec![
        silaba_em(0.0, 0, "a"),
        silaba_em(0.0, 1, "b"),
        glo,
        silaba_em(1.0, 1, "d"),
        ri,
    ];
    s.push(silaba_em(3.0, 0, "a"));
    for (i, x) in ["Aleluia", "ao", "Senhor", "dos", "céus", "amém"]
        .iter()
        .enumerate()
    {
        s.push(silaba_em(5.0 + i as f64, 0, x));
    }
    assert_eq!(separar_o_coro(&mut s), 6);
    assert!(s.iter().filter(|x| x.t <= 3.0).all(|x| x.verso != CORO));
    assert!(s.iter().filter(|x| x.t >= 5.0).all(|x| x.verso == CORO));
}

#[test]
fn resto_curto_depois_das_estrofes_nao_e_coro() {
    // fim de estrofe escrito uma vez só (menos de 6 sílabas): fica na estrofe
    let mut s = vec![
        silaba_em(0.0, 0, "a"),
        silaba_em(0.0, 1, "b"),
        silaba_em(3.0, 0, "fim"),
        silaba_em(4.0, 0, "da"),
    ];
    assert_eq!(separar_o_coro(&mut s), 0);
    assert!(s.iter().all(|x| x.verso != CORO));
}

#[test]
fn hino_de_uma_estrofe_so_nao_muda() {
    let mut s = vec![silaba_em(0.0, 0, "alfa"), silaba_em(10.0, 0, "coro")];
    separar_o_final(&mut s, 10.0);
    assert!(s.iter().all(|x| x.verso == 0));
}

#[test]
fn no_hino_com_final_o_texto_escrito_sob_a_estrofe_1_vira_o_bloco_final() {
    // Mesma estrutura do hino com final: o texto do trecho final (compassos 5 e 6) está sob a estrofe 1 (<no>0),
    // e a 2ª casa traz só a última sílaba da estrofe 2.
    let comp = |extra: &str, pitch: u8, letras: &[(u32, &str)]| {
        let ls: String = letras
            .iter()
            .map(|(no, t)| format!("<Lyrics><no>{no}</no><text>{t}</text></Lyrics>"))
            .collect();
        format!(
            "<Measure>{extra}<voice>{C44}<Chord><durationType>whole</durationType>{ls}<Note><pitch>{pitch}</pitch></Note></Chord></voice></Measure>"
        )
    };
    let medidas = [
        comp("<startRepeat/>", 60, &[(0, "a"), (1, "b")]),
        comp("", 62, &[(0, "c"), (1, "d")]),
        comp(
            r#"<endRepeat>2</endRepeat><Volta id="1"><endings>2</endings></Volta>"#,
            64,
            &[(0, "e"), (1, "f")],
        ),
        comp(
            r#"<endSpanner id="1"/><Volta id="2"><endings>3</endings></Volta>"#,
            65,
            &[(1, "g")],
        ),
        comp(r#"<endSpanner id="2"/>"#, 67, &[(0, "coro")]),
        comp("", 69, &[(0, "final")]),
    ]
    .concat();
    let h = converter(&doc(&parte(1, "S"), &pauta(1, &medidas)), 1).unwrap();
    assert_eq!(
        h.letra,
        vec!["1. a c e", "", "2. b d f g", "", "Final. coro final"]
    );
}
