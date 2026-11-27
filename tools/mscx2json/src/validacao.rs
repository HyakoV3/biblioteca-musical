//! Conferência da saída antes de gravar.

use crate::modelo::{Evento, Hino, Voz};

fn validar_andamento(h: &Hino) -> Result<(), String> {
    match h.andamento {
        Some(a) if !(20..=300).contains(&a) => {
            Err(format!("hino {}: andamento {a} fora de 20 a 300", h.numero))
        }
        _ => Ok(()),
    }
}

/// Por que a nota é inválida (tempo, duração ou MIDI), ou `None` se está boa.
fn defeito_da_nota(e: &Evento) -> Option<String> {
    if !e.inicio.is_finite() || e.inicio < 0.0 {
        return Some(format!("tempo inválido ({})", e.inicio));
    }
    if !e.dur.is_finite() || e.dur <= 0.0 {
        return Some(format!("duração inválida ({})", e.dur));
    }
    (e.midi > 127).then(|| format!("MIDI {} fora de 0 a 127", e.midi))
}

/// Onde as notas conferidas estão: o hino e a faixa (vozes, passada do final ou introdução).
struct Local<'a> {
    hino: u32,
    onde: &'a str,
}

impl Local<'_> {
    fn conferir_voz(&self, voz: &Voz) -> Result<(), String> {
        for (i, e) in voz.notas.iter().enumerate() {
            if let Some(defeito) = defeito_da_nota(e) {
                return Err(format!(
                    "hino {}, {}, \"{}\", nota {i}: {defeito}",
                    self.hino, self.onde, voz.nome
                ));
            }
        }
        Ok(())
    }
}

fn validar_vozes(h: &Hino) -> Result<(), String> {
    let faixas = [
        ("vozes", Some(&h.vozes)),
        ("passada do final", h.passada_final.as_ref()),
        ("introdução", h.introducao.as_ref()),
    ];
    for (onde, vozes) in faixas {
        let local = Local {
            hino: h.numero,
            onde,
        };
        for voz in vozes.into_iter().flatten() {
            local.conferir_voz(voz)?;
        }
    }
    Ok(())
}

/// Os tempos da sincronia da letra e dos compassos.
fn tempos_de_sincronia_e_compassos(h: &Hino) -> Vec<f64> {
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
    tempos
}

/// MSCX-007: confere a saída ANTES de gravar. Todo tempo e toda duração têm de ser finitos (tempo >= 0, duração > 0), todo MIDI de 0 a 127 e o
/// andamento de 20 a 300: o leitor do app recusa o hinário inteiro por qualquer um desses (ver `hinario.rs`), então é melhor falhar aqui, com o
/// nome do hino, a voz e a nota, do que publicar um pacote que o app não abre.
pub fn validar(h: &Hino) -> Result<(), String> {
    validar_andamento(h)?;
    validar_vozes(h)?;
    let tempos = tempos_de_sincronia_e_compassos(h);
    if let Some(t) = tempos.iter().find(|t| !t.is_finite() || **t < 0.0) {
        return Err(format!(
            "hino {}: tempo inválido na sincronia ou nos compassos ({t})",
            h.numero
        ));
    }
    Ok(())
}
