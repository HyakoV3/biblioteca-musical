//! Nomes das partes e das vozes de cada pauta.

use crate::modelo::Hino;

/// "Parte I..IV" -> vozes do coro, na ordem do hinário.
pub fn nomes_satb(h: &mut Hino) {
    // As vozes da passada do final precisam ter os mesmos nomes das da passada normal.
    for v in h
        .vozes
        .iter_mut()
        .chain(h.passada_final.iter_mut().flatten())
        .chain(h.introducao.iter_mut().flatten())
    {
        let novo = match v.nome.as_str() {
            "Parte I" => "Soprano",
            "Parte II" => "Contralto",
            "Parte III" => "Tenor",
            "Parte IV" => "Baixo",
            _ => continue,
        };
        v.nome = novo.to_string();
    }
}

pub(crate) fn e_romano(s: &str) -> bool {
    !s.is_empty() && s.chars().all(|c| matches!(c, 'I' | 'V' | 'X'))
}

/// "Parte I e II" -> ["Parte I", "Parte II"]: completa o prefixo quando sobra só o numeral.
pub(crate) fn nome_da_parte(partes: &[&str], i: usize) -> String {
    let p = partes[i].trim();
    let prefixo = partes[0].split_whitespace().next().unwrap_or("");
    if i > 0 && e_romano(p) && prefixo != p {
        format!("{prefixo} {p}")
    } else {
        p.to_string()
    }
}

/// O nome de cada voz de uma pauta: o da parte (ou o da pauta), com o número da voz quando a pauta se divide em várias.
pub(crate) fn nome_da_voz(
    base: &str,
    sufixo: &str,
    partes: &[&str],
    r: usize,
    max: usize,
) -> String {
    if max == 1 {
        format!("{base}{sufixo}")
    } else if partes.len() == max {
        format!("{}{sufixo}", nome_da_parte(partes, r))
    } else {
        format!("{base}{sufixo} ({})", r + 1)
    }
}
