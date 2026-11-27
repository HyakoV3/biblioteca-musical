//! Testes do conversor sobre a divisão em vozes, a validação e o recorte das passadas.

use crate::testes_apoio::*;

fn nota_acorde(inicio: f64, dur: f64, midi: u8) -> Acorde {
    Acorde {
        inicio,
        dur,
        notas: vec![(midi, false, false)],
    }
}

fn pausa_acorde(inicio: f64, dur: f64) -> Acorde {
    Acorde {
        inicio,
        dur,
        notas: vec![],
    }
}

fn triplas(v: &[Evento]) -> Vec<(f64, f64, u8)> {
    v.iter().map(|e| (e.inicio, e.dur, e.midi)).collect()
}

#[test]
fn pausa_escrita_de_uma_camada_cala_a_voz_em_vez_de_repetir_a_nota_da_outra() {
    // MUS-003: a camada 1 canta 64 por 2 batidas; a camada 2 tem uma pausa escrita na 1ª batida e canta 60 na 2ª.
    let c1 = vec![nota_acorde(0.0, 2.0, 64)];
    let c2 = vec![pausa_acorde(0.0, 1.0), nota_acorde(1.0, 1.0, 60)];
    let (v, _) = dividir_em_vozes(vec![c1, c2], Some(2));
    assert_eq!(triplas(&v[0]), vec![(0.0, 2.0, 64)]);
    assert_eq!(triplas(&v[1]), vec![(1.0, 1.0, 60)]); // sem a pausa escrita, a voz 2 repetiria o 64 na 1ª batida
}

#[test]
fn sem_pausa_escrita_o_unissono_continua_repetido_nas_vozes_de_baixo() {
    let c1 = vec![nota_acorde(0.0, 2.0, 64)];
    let c2 = vec![nota_acorde(1.0, 1.0, 60)];
    let (v, _) = dividir_em_vozes(vec![c1, c2], Some(2));
    assert_eq!(triplas(&v[1]), vec![(0.0, 1.0, 64), (1.0, 1.0, 60)]);
}

#[test]
fn camada_so_de_pausas_nao_cala_voz_nenhuma() {
    let c1 = vec![nota_acorde(0.0, 2.0, 64)];
    let c2 = vec![pausa_acorde(0.0, 2.0)];
    let c3 = vec![nota_acorde(1.0, 1.0, 60)];
    let (v, _) = dividir_em_vozes(vec![c1, c2, c3], Some(2));
    assert_eq!(triplas(&v[1]), vec![(0.0, 1.0, 64), (1.0, 1.0, 60)]);
}

#[test]
fn unissono_que_se_divide_nao_reataca_a_nota_longa() {
    // MSCX-005: a camada 1 só tem a nota curta (64, na 2ª batida); a 2 tem a nota longa (64, 0 a 2). A curta vem ANTES na ordem dos eventos,
    // então a escolha por ordem trocava de nota no meio e a voz reatacava: [(0,1,64),(1,1,64)].
    let c1 = vec![nota_acorde(1.0, 1.0, 64)];
    let c2 = vec![nota_acorde(0.0, 2.0, 64)];
    let (v, _) = dividir_em_vozes(vec![c1, c2], Some(1));
    assert_eq!(triplas(&v[0]), vec![(0.0, 2.0, 64)]);
}

#[test]
fn pausa_escrita_na_segunda_camada_deixa_a_voz_em_silencio_no_arquivo_inteiro() {
    // MUS-003 de ponta a ponta: duas camadas (<voice>) numa pauta "Soprano e Contralto"; a 2ª tem pausa escrita na 1ª metade do compasso.
    let v1 = format!("{C44}{}{}", acorde("half", 64), acorde("half", 64));
    let v2 = format!(
        "<Rest><durationType>half</durationType></Rest>{}",
        acorde("half", 60)
    );
    let xml = format!("<Measure><voice>{v1}</voice><voice>{v2}</voice></Measure>");
    let h = converter(&doc(&parte(1, "Soprano e Contralto"), &pauta(1, &xml)), 1).unwrap();
    assert_eq!(h.vozes.len(), 2);
    assert_eq!(notas(&h, 0), vec![(0.0, 2.0, 64), (2.0, 2.0, 64)]);
    assert_eq!(notas(&h, 1), vec![(2.0, 2.0, 60)]); // antes: (0, 2, 64) a mais, a nota da outra voz
}

fn hino_com_nota(inicio: f64, dur: f64, midi: u8) -> Hino {
    let corpo = format!("{C44}{}", acorde("whole", 60));
    let mut h = converter(&doc(&parte(1, "S"), &pauta(1, &compasso(&corpo))), 1).unwrap();
    h.vozes = vec![Voz {
        nome: "S".into(),
        notas: vec![Evento { inicio, dur, midi }],
    }];
    h
}

#[test]
fn validar_aceita_a_saida_boa_e_recusa_tempo_duracao_e_midi_invalidos() {
    assert!(validar(&hino_com_nota(0.0, 1.0, 60)).is_ok());
    assert!(
        validar(&hino_com_nota(-1.0, 1.0, 60))
            .unwrap_err()
            .contains("tempo inválido")
    );
    assert!(
        validar(&hino_com_nota(f64::NAN, 1.0, 60))
            .unwrap_err()
            .contains("tempo inválido")
    );
    assert!(
        validar(&hino_com_nota(0.0, 0.0, 60))
            .unwrap_err()
            .contains("duração inválida")
    );
    assert!(
        validar(&hino_com_nota(0.0, f64::INFINITY, 60))
            .unwrap_err()
            .contains("duração inválida")
    );
    let e = validar(&hino_com_nota(0.0, 1.0, 200)).unwrap_err();
    assert!(e.contains("MIDI 200") && e.contains("hino 1"), "{e}");
    let mut h = hino_com_nota(0.0, 1.0, 60);
    h.andamento = Some(400);
    assert!(validar(&h).unwrap_err().contains("andamento 400"));
}

#[test]
fn selecionar_recorta_e_cola_sem_buracos_e_limita_a_duracao() {
    let a = |inicio: f64, dur: f64| Acorde {
        inicio,
        dur,
        notas: vec![(60, false, false)],
    };
    // compassos de 4 batidas: [0,4) [4,8) [8,12)
    let inicios = [0.0, 4.0, 8.0, 12.0];
    // uma nota que começa no compasso 2 e dura 6 batidas (passa do fim do segmento)
    let acordes = [a(0.0, 4.0), a(4.0, 6.0), a(8.0, 4.0)];
    let s = selecionar(&acordes, &inicios, &[(0, 1), (2, 3)]);
    let v: Vec<(f64, f64)> = s.iter().map(|x| (x.inicio, x.dur)).collect();
    assert_eq!(v, vec![(0.0, 4.0), (4.0, 4.0)]); // o compasso 2 saiu; o 3 foi colado logo depois
    let s = selecionar(&acordes, &inicios, &[(1, 2)]);
    assert_eq!((s[0].inicio, s[0].dur), (0.0, 4.0)); // duração cortada no fim do segmento (6 -> 4)
}

#[test]
fn renomear_vozes_vale_tambem_para_a_passada_do_final() {
    let voz = |n: &str| Voz {
        nome: n.to_string(),
        notas: vec![],
    };
    let partes = || {
        vec![
            voz("Parte I"),
            voz("Parte II"),
            voz("Parte III"),
            voz("Parte IV"),
        ]
    };
    let mut h = Hino {
        numero: 1,
        titulo: "T".into(),
        autoria: None,
        passada_final: Some(partes()),
        introducao: Some(partes()),
        andamento: None,
        armadura: 0,
        modo: "maior",
        vozes: partes(),
        letra: vec![],
        sincronia: None,
        compassos: None,
        avisos: vec![],
    };
    nomes_satb(&mut h);
    let normal: Vec<_> = h.vozes.iter().map(|v| v.nome.clone()).collect();
    let final_: Vec<_> = h
        .passada_final
        .unwrap()
        .iter()
        .map(|v| v.nome.clone())
        .collect();
    assert_eq!(normal, vec!["Soprano", "Contralto", "Tenor", "Baixo"]);
    assert_eq!(
        final_, normal,
        "as vozes do final devem ter os mesmos nomes, na mesma ordem"
    );
}
