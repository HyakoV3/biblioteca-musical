//! A estrutura de repetição da partitura: as marcas de repetição e de volta e o plano das passadas.

use roxmltree::Node;

/// Marcas de repetição lidas da primeira pauta (índices de compasso começam em 0).
#[derive(Default)]
pub(crate) struct Estrutura {
    /// Instante, em batidas, em que cada compasso começa; o último valor é o fim da partitura.
    pub(crate) inicios: Vec<f64>,
    pub(crate) inicio_repeticao: Option<usize>,
    pub(crate) fim_repeticao: Option<usize>,
    /// Quantas barras de início e de fim de repetição a partitura tem, e quantos saltos (`Jump`) e marcas (`Marker`): o padrão do final
    /// aceita no máximo uma barra de início, exatamente uma de fim e nenhum salto ou marca.
    pub(crate) barras_de_inicio: usize,
    pub(crate) barras_de_fim: usize,
    pub(crate) saltos: usize,
    /// Casas de volta: (primeiro compasso, compasso onde termina, exclusivo).
    pub(crate) voltas: Vec<(usize, Option<usize>)>,
    pub(crate) ids_volta: Vec<String>,
}

impl Estrutura {
    /// Registra as marcas de repetição, de salto e de volta do compasso `ci`.
    pub(crate) fn registrar_marcas(&mut self, compasso: Node, ci: usize) {
        for n in compasso.descendants() {
            match n.tag_name().name() {
                "startRepeat" => {
                    self.inicio_repeticao = Some(ci);
                    self.barras_de_inicio += 1;
                }
                "endRepeat" => {
                    self.fim_repeticao = Some(ci);
                    self.barras_de_fim += 1;
                }
                "Jump" | "Marker" => self.saltos += 1,
                "Volta" => {
                    self.voltas.push((ci, None));
                    self.ids_volta
                        .push(n.attribute("id").unwrap_or("").to_string());
                }
                "endSpanner" => self.fechar_volta(n, ci),
                _ => {}
            }
        }
    }

    /// O colchete da volta termina no começo do compasso onde aparece o seu endSpanner.
    fn fechar_volta(&mut self, fim: Node, ci: usize) {
        let posicao = fim
            .attribute("id")
            .and_then(|id| self.ids_volta.iter().position(|v| v == id));
        if let Some(i) = posicao {
            self.voltas[i].1 = Some(ci);
        }
    }
}

/// Quais compassos (intervalos `[de, até)`) tocam na passada normal e na passada do final.
pub(crate) struct Plano {
    pub(crate) normal: Vec<(usize, usize)>,
    pub(crate) final_: Vec<(usize, usize)>,
    pub(crate) descricao: String,
}

/// Reconhece o padrão dos hinos com final, confirmado pelo responsável no hino 457:
///   início de repetição no começo · compasso com fim de repetição e 1ª casa de volta · 2ª casa de volta
///   logo depois · trecho final até o fim da partitura.
/// Passada normal = do começo até o fim da 1ª casa. Passada do final = do começo até antes da 1ª casa,
/// depois a 2ª casa e tudo o que vem a seguir. Qualquer outra estrutura devolve `None`: mais de uma repetição, salto ou marca (`Jump`,
/// `Marker`) faria o plano ignorar um trecho que a partitura manda tocar.
pub(crate) fn plano_passadas(e: &Estrutura) -> Option<Plano> {
    let n = e.inicios.len().checked_sub(1)?;
    if e.voltas.len() != 2 || e.barras_de_inicio > 1 || e.barras_de_fim != 1 || e.saltos > 0 {
        return None;
    }
    let ((a1, f1), (a2, f2)) = (e.voltas[0], e.voltas[1]);
    let (f1, f2) = (f1?, f2?);
    let fim_rep = e.fim_repeticao?;
    if f1 != a2 || fim_rep + 1 != f1 || f2 > n || e.inicio_repeticao.unwrap_or(0) != 0 {
        return None;
    }
    Some(Plano {
        normal: vec![(0, f1)],
        final_: vec![(0, a1), (a2, n)],
        descricao: format!(
            "passada normal = compassos 1 a {f1}; passada do final = compassos 1 a {a1} e {} a {n}",
            a2 + 1
        ),
    })
}
