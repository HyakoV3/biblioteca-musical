//! Conferência da saída antes de gravar.

use crate::modelo::Hino;

/// MSCX-007: confere a saída ANTES de gravar. Todo tempo e toda duração têm de ser finitos (tempo >= 0, duração > 0), todo MIDI de 0 a 127 e o
/// andamento de 20 a 300: o leitor do app recusa o hinário inteiro por qualquer um desses (ver `hinario.rs`), então é melhor falhar aqui, com o
/// nome do hino, a voz e a nota, do que publicar um pacote que o app não abre.
pub fn validar(h: &Hino) -> Result<(), String> {
    if let Some(a) = h.andamento
        && !(20..=300).contains(&a)
    {
        return Err(format!("hino {}: andamento {a} fora de 20 a 300", h.numero));
    }
    let faixas = [
        ("vozes", Some(&h.vozes)),
        ("passada do final", h.passada_final.as_ref()),
        ("introdução", h.introducao.as_ref()),
    ];
    for (onde, vozes) in faixas {
        for voz in vozes.into_iter().flatten() {
            for (i, e) in voz.notas.iter().enumerate() {
                if !e.inicio.is_finite() || e.inicio < 0.0 {
                    return Err(format!(
                        "hino {}, {onde}, \"{}\", nota {i}: tempo inválido ({})",
                        h.numero, voz.nome, e.inicio
                    ));
                }
                if !e.dur.is_finite() || e.dur <= 0.0 {
                    return Err(format!(
                        "hino {}, {onde}, \"{}\", nota {i}: duração inválida ({})",
                        h.numero, voz.nome, e.dur
                    ));
                }
                if e.midi > 127 {
                    return Err(format!(
                        "hino {}, {onde}, \"{}\", nota {i}: MIDI {} fora de 0 a 127",
                        h.numero, voz.nome, e.midi
                    ));
                }
            }
        }
    }
    let mut tempos: Vec<f64> = vec![];
    if let Some(s) = &h.sincronia {
        for e in s.normal.iter().chain(s.passada_final.iter().flatten()) {
            tempos.extend(e.linhas.iter().flatten().map(|t| t.0));
        }
    }
    if let Some(c) = &h.compassos {
        for lista in [
            Some(&c.normal),
            c.passada_final.as_ref(),
            c.introducao.as_ref(),
        ] {
            tempos.extend(lista.into_iter().flatten().map(|x| x.0));
        }
    }
    if let Some(t) = tempos.iter().find(|t| !t.is_finite() || **t < 0.0) {
        return Err(format!(
            "hino {}: tempo inválido na sincronia ou nos compassos ({t})",
            h.numero
        ));
    }
    Ok(())
}
