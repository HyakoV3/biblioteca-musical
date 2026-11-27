//! Nomes das partes e das vozes de cada pauta.

use crate::modelo::{Evento, Hino, Voz};

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

/// O nome de uma pauta: o da parte (ou o da pauta) e o sufixo `(pauta N)` quando a parte tem várias pautas.
#[derive(Clone)]
pub(crate) struct NomeDaPauta {
    base: String,
    sufixo: String,
}

impl NomeDaPauta {
    pub(crate) fn nova(base: String, sufixo: String) -> Self {
        NomeDaPauta { base, sufixo }
    }

    fn partes(&self) -> Vec<&str> {
        self.base.split(" e ").collect()
    }

    /// Com "Parte I e II" na pauta, no máximo tantas vozes quantas partes há; senão, sem limite.
    pub(crate) fn limite(&self) -> Option<usize> {
        let n = self.partes().len();
        (n > 1).then_some(n)
    }

    /// O nome da pauta como aparece nos avisos.
    pub(crate) fn rotulo(&self) -> String {
        format!("{}{}", self.base, self.sufixo)
    }

    /// O nome de cada voz de uma pauta: o da parte (ou o da pauta), com o número da voz quando a pauta se divide em várias.
    fn voz(&self, r: usize, max: usize) -> String {
        let partes = self.partes();
        if max == 1 {
            self.rotulo()
        } else if partes.len() == max {
            format!("{}{}", nome_da_parte(&partes, r), self.sufixo)
        } else {
            format!("{} ({})", self.rotulo(), r + 1)
        }
    }

    /// As vozes de uma pauta, já com os nomes, a partir das notas de cada uma.
    pub(crate) fn nomear(&self, linhas: Vec<Vec<Evento>>) -> Vec<Voz> {
        let max = linhas.len();
        linhas
            .into_iter()
            .enumerate()
            .map(|(r, notas)| Voz {
                nome: self.voz(r, max),
                notas,
            })
            .collect()
    }
}
