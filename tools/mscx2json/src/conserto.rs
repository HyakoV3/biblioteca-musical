//! Conserto, sílaba a sílaba, dos erros de digitação dos arquivos do autor que têm uma só leitura possível.

use crate::percurso::Silaba;
use std::collections::BTreeMap;

const EPS: f64 = 1e-6;

/// Pronomes que se ligam ao verbo com hífen ("cantá-lo", "dá-lhe").
pub(crate) const CLITICOS: &[&str] = &["lo", "la", "los", "las", "lhe", "lhes"];

/// Por estrofe: a sílaba atual (instante, se continua a palavra, texto) e a do instante anterior (se continua, texto).
struct Vista {
    anterior: Option<(bool, String)>,
    t: f64,
    continua: bool,
    texto: String,
}

impl Vista {
    fn nova() -> Self {
        Vista {
            anterior: None,
            t: f64::NEG_INFINITY,
            continua: false,
            texto: String::new(),
        }
    }

    /// Chega uma sílaba do instante `t`: se é um instante novo, a sílaba que estava vira a anterior.
    fn avancar(&mut self, t: f64) {
        if t > self.t + EPS {
            self.anterior = self
                .t
                .is_finite()
                .then(|| (self.continua, self.texto.clone()));
            self.t = t;
        }
    }

    fn lembrar(&mut self, sil: &Silaba) {
        self.continua = sil.continua;
        self.texto = sil.texto.clone();
    }
}

/// O texto com um "I" maiúsculo no começo trocado por "l" (se vem uma minúscula depois): "Io" -> "lo".
fn com_l_no_comeco(texto: &str) -> String {
    let mut letras = texto.chars();
    if letras.next() == Some('I') && letras.next().is_some_and(|c| c.is_lowercase()) {
        format!("l{}", &texto[1..])
    } else {
        texto.to_string()
    }
}

/// O verbo anterior termina em vogal acentuada (ignorando a pontuação do fim)?
fn termina_em_vogal_acentuada(anterior: &str) -> bool {
    anterior
        .trim_end_matches(|c: char| !c.is_alphabetic())
        .chars()
        .last()
        .is_some_and(|c| "áàâéêíóôú".contains(c))
}

/// O texto com o hífen, se a sílaba é um pronome colado ao verbo da sílaba anterior (que termina em vogal acentuada).
fn texto_com_hifen(sil: &Silaba, anterior: &str) -> Option<String> {
    let com_l = com_l_no_comeco(&sil.texto);
    let radical: String = com_l.chars().take_while(|c| c.is_alphabetic()).collect();
    let e_pronome = !sil.continua && CLITICOS.contains(&radical.as_str());
    (e_pronome && termina_em_vogal_acentuada(anterior)).then(|| format!("-{com_l}"))
}

/// Conserta, sílaba a sílaba, os erros de digitação dos arquivos do autor que têm UMA só leitura possível, ANTES de montar as linhas
/// (assim as marcas do karaokê nascem já do texto certo). `silabas` deve estar ordenada pelo tempo. Tudo o que for ambíguo fica para o
/// arquivo de correções (`correcoes.rs`), em que o responsável diz o que é: uma regra "esperta" já trocou "mão" por "mãe".
/// 1. Pronome (-lo, -la, -los, -las, -lhe, -lhes) colado ao verbo que termina em vogal acentuada, sem hífen: ganha o hífen. Aí um "I"
///    maiúsculo no começo do pronome só pode ser um "l" digitado errado ("cantáIo" -> "cantá-lo"); fora desse caso, um "I" no meio
///    da palavra poderia ser "l" ou "i" e não se mexe.
/// 2. "~" literal (o autor o usa como a elisão) vira espaço, como o símbolo de elisão do MuseScore.
pub(crate) fn corrigir_silabas(silabas: &mut [Silaba]) {
    for sil in silabas.iter_mut() {
        if sil.texto.contains('~') {
            sil.texto = sil.texto.replace('~', " ");
        }
    }
    let mut estado: BTreeMap<u32, Vista> = BTreeMap::new();
    for sil in silabas.iter_mut() {
        let e = estado.entry(sil.verso).or_insert_with(Vista::nova);
        e.avancar(sil.t);
        if let Some((true, anterior)) = &e.anterior
            && let Some(novo) = texto_com_hifen(sil, anterior)
        {
            sil.texto = novo;
        }
        e.lembrar(sil);
    }
}
