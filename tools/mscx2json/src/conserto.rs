//! Conserto, sílaba a sílaba, dos erros de digitação dos arquivos do autor que têm uma só leitura possível.

use crate::percurso::Silaba;
use std::collections::BTreeMap;

/// Pronomes que se ligam ao verbo com hífen ("cantá-lo", "dá-lhe").
pub(crate) const CLITICOS: &[&str] = &["lo", "la", "los", "las", "lhe", "lhes"];

/// Conserta, sílaba a sílaba, os erros de digitação dos arquivos do autor que têm UMA só leitura possível, ANTES de montar as linhas
/// (assim as marcas do karaokê nascem já do texto certo). `silabas` deve estar ordenada pelo tempo. Tudo o que for ambíguo fica para o
/// arquivo de correções (`correcoes.rs`), em que o responsável diz o que é: uma regra "esperta" já trocou "mão" por "mãe".
/// 1. Pronome (-lo, -la, -los, -las, -lhe, -lhes) colado ao verbo que termina em vogal acentuada, sem hífen: ganha o hífen. Aí um "I"
///    maiúsculo no começo do pronome só pode ser um "l" digitado errado ("cantáIo" -> "cantá-lo"); fora desse caso, um "I" no meio
///    da palavra poderia ser "l" ou "i" e não se mexe.
/// 2. "~" literal (o autor o usa como a elisão) vira espaço, como o símbolo de elisão do MuseScore.
pub(crate) fn corrigir_silabas(silabas: &mut [Silaba]) {
    const EPS: f64 = 1e-6;
    for sil in silabas.iter_mut() {
        if sil.texto.contains('~') {
            sil.texto = sil.texto.replace('~', " ");
        }
    }
    /// Por estrofe: a sílaba atual (instante, se continua a palavra, texto) e a do instante anterior (se continua, texto).
    struct Vista {
        anterior: Option<(bool, String)>,
        t: f64,
        continua: bool,
        texto: String,
    }
    let mut estado: BTreeMap<u32, Vista> = BTreeMap::new();
    for sil in silabas.iter_mut() {
        let e = estado.entry(sil.verso).or_insert(Vista {
            anterior: None,
            t: f64::NEG_INFINITY,
            continua: false,
            texto: String::new(),
        });
        if sil.t > e.t + EPS {
            e.anterior = e.t.is_finite().then(|| (e.continua, e.texto.clone()));
        }
        if let Some((true, anterior)) = &e.anterior {
            let mut letras = sil.texto.chars();
            let com_l =
                if letras.next() == Some('I') && letras.next().is_some_and(|c| c.is_lowercase()) {
                    format!("l{}", &sil.texto[1..])
                } else {
                    sil.texto.clone()
                };
            let radical: String = com_l.chars().take_while(|c| c.is_alphabetic()).collect();
            let acentuada = anterior
                .trim_end_matches(|c: char| !c.is_alphabetic())
                .chars()
                .last()
                .is_some_and(|c| "áàâéêíóôú".contains(c));
            if !sil.continua && acentuada && CLITICOS.contains(&radical.as_str()) {
                sil.texto = format!("-{com_l}");
            }
        }
        if sil.t > e.t + EPS {
            e.t = sil.t;
        }
        e.continua = sil.continua;
        e.texto = sil.texto.clone();
    }
}
